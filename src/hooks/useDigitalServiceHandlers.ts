import { useMemo, useState } from 'react';
import { db, type FirestoreDocumentReference } from '../firebase';
import type { ClientDzd, ClientTransactionDzd, DigitalServiceTransaction, PortfolioStats } from '../types';
import { now, parseAndEvaluate } from '../utils';
import { roundM } from '../utils/money';
import { recordTreasuryLegacyDeletionShadow, recordTreasuryShadow } from '../accounting/treasuryShadowDiagnostics';
import { recordPortfolioShadow } from '../accounting/portfolioShadowDiagnostics';
import { inventoryFromLegacyPortfolioStats } from '../accounting/portfolioShadowLegacyAdapter';
import { recordClientShadow } from '../accounting/clientShadowDiagnostics';
import { clientPositionFromLegacyRows } from '../accounting/clientShadowLegacyAdapter';
import { recordServiceShadow } from '../accounting/serviceShadowDiagnostics';
import { mustPrepareWriterReadModelDelta } from '../readModels/preparedWriterDeltas';
import { commitLegacyWithReadModelDeltas } from '../readModels/productionSummaryWriter';
import { transitionClientBalanceDelta, invertReadModelDelta, combineReadModelDeltas, buildReadModelDelta, type ReadModelDelta } from '../readModels/readModelDeltas';
import { readDigitalServiceTxLegacy } from '../readModels/legacyReadDelta';
import {
    computeDigitalServicePreview,
    isAssetWallet,
    isCashWallet,
    type DigitalServiceSaleWallet,
    type FinancialWallet,
} from '../utils/digitalServiceAccounting';

type UseDigitalServiceHandlersArgs = {
    userDocRef: FirestoreDocumentReference;
    clientsDzd: ClientDzd[];
    clientTransactionsDzd: ClientTransactionDzd[];
    portfolioStats: PortfolioStats;
    treasuryStats: {
        caisse: number;
        baridi: number;
    };
    setAlert: (msg: string) => void;
};

const SALE_PAYMENT_METHOD: Record<DigitalServiceSaleWallet, 'Espèces' | 'BaridiMob' | 'Crédit' | 'USDT' | 'EUR'> = {
    Caisse: 'Espèces',
    BaridiMob: 'BaridiMob',
    Credit: 'Crédit',
    USDT: 'USDT',
    EUR: 'EUR',
};

function toIsoToday() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function resolveDateParts(isoDate: string) {
    if (!isoDate) return now();
    const [y, m, d] = isoDate.split('-').map(Number);
    if (!y || !m || !d) return now();
    const today = new Date();
    if (today.getFullYear() === y && today.getMonth() + 1 === m && today.getDate() === d) {
        return now();
    }
    const customDate = new Date(y, m - 1, d, 12, 0, 0);
    return {
        timestamp: customDate.getTime(),
        date: customDate.toLocaleDateString('fr-FR'),
        time: customDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    };
}

function clientName(client?: ClientDzd) {
    return client?.fullName || client?.nom || 'Client';
}

function ownerProfitPeriodDeltas(timestamp: number, ownerProfitDzd: number) {
    const nowDate = new Date();
    const dayStart = new Date(nowDate);
    dayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(nowDate);
    const dow = weekStart.getDay();
    weekStart.setDate(weekStart.getDate() - (dow === 0 ? 6 : dow - 1));
    weekStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(nowDate.getFullYear(), nowDate.getMonth(), 1).getTime();
    const yearStart = new Date(nowDate.getFullYear(), 0, 1).getTime();
    return {
        ownerProfitTodayDelta: timestamp >= dayStart.getTime() ? ownerProfitDzd : 0,
        ownerProfitWeekDelta: timestamp >= weekStart.getTime() ? ownerProfitDzd : 0,
        ownerProfitMonthDelta: timestamp >= monthStart ? ownerProfitDzd : 0,
        ownerProfitYearDelta: timestamp >= yearStart ? ownerProfitDzd : 0,
        ownerProfitAllTimeDelta: ownerProfitDzd,
    };
}

export function useDigitalServiceHandlers({ userDocRef, clientsDzd, clientTransactionsDzd, portfolioStats, treasuryStats, setAlert }: UseDigitalServiceHandlersArgs) {
    const [isDigitalServiceModalOpen, setIsDigitalServiceModalOpen] = useState(false);
    const [isDigitalServiceSaving, setIsDigitalServiceSaving] = useState(false);
    const [editingDigitalServiceTx, setEditingDigitalServiceTx] = useState<DigitalServiceTransaction | null>(null);
    const [digitalServiceClientId, setDigitalServiceClientId] = useState('');
    const [digitalServiceName, setDigitalServiceName] = useState('');
    const [digitalServicePurchaseWallet, setDigitalServicePurchaseWallet] = useState<FinancialWallet>('Caisse');
    const [digitalServicePurchaseAmount, setDigitalServicePurchaseAmount] = useState('');
    const [digitalServiceSaleWallet, setDigitalServiceSaleWallet] = useState<DigitalServiceSaleWallet>('Caisse');
    const [digitalServiceSaleAmount, setDigitalServiceSaleAmount] = useState('');
    const [digitalServiceDate, setDigitalServiceDate] = useState(toIsoToday());
    const [digitalServiceNote, setDigitalServiceNote] = useState('');

    const computeDigitalServiceReadModelDelta = (input: {
        mainRefId: string;
        operationId: string;
        stamp: { timestamp: number; date: string; time: string };
        purchaseWallet: FinancialWallet;
        saleWallet: DigitalServiceSaleWallet;
        purchaseAmount: number;
        saleAmount: number;
        preview: ReturnType<typeof computeDigitalServicePreview>;
        clientId: string;
    }): ReadModelDelta => {
        const { mainRefId, operationId, stamp, purchaseWallet, saleWallet, purchaseAmount, saleAmount, preview, clientId } = input;
        const wallets: Record<string, number> = {};
        if (isCashWallet(purchaseWallet)) {
            wallets[purchaseWallet] = roundM((wallets[purchaseWallet] || 0) - preview.purchaseAmountDzd);
        }
        if (isCashWallet(saleWallet)) {
            wallets[saleWallet] = roundM((wallets[saleWallet] || 0) + preview.saleAmountDzd);
        }
        const portfolio: Record<string, { quantityDelta: number; costBasisDeltaDzd: number }> = {};
        if (isAssetWallet(purchaseWallet)) {
            portfolio[purchaseWallet] = { quantityDelta: -purchaseAmount, costBasisDeltaDzd: -preview.purchaseAmountDzd };
        }
        if (isAssetWallet(saleWallet)) {
            const current = portfolio[saleWallet] || { quantityDelta: 0, costBasisDeltaDzd: 0 };
            portfolio[saleWallet] = {
                quantityDelta: roundM(current.quantityDelta + saleAmount),
                costBasisDeltaDzd: roundM(current.costBasisDeltaDzd + preview.saleAmountDzd),
            };
        }
        const clientsDelta = saleWallet === 'Credit'
            ? (() => {
                const before = clientPositionFromLegacyRows(clientTransactionsDzd, clientId, stamp.timestamp).balanceDzd;
                const delta = transitionClientBalanceDelta(before, before - preview.saleAmountDzd);
                const day = new Date(stamp.timestamp);
                day.setHours(0, 0, 0, 0);
                const dayStart = day.getTime();
                const dayEnd = dayStart + 86_400_000 - 1;
                delta.activeClientsTodayDelta = clientTransactionsDzd.some((tx) => tx.clientId === clientId && tx.timestamp >= dayStart && tx.timestamp <= dayEnd) ? 0 : 1;
                return delta;
            })()
            : undefined;
        return mustPrepareWriterReadModelDelta('services.digital', {
            operationId,
            effectiveAt: stamp.timestamp,
            payload: {
                type: 'digital_service_sale',
                txId: mainRefId,
                clientId,
                purchaseWallet,
                saleWallet,
                purchaseAmount,
                saleAmount,
                purchaseAmountDzd: preview.purchaseAmountDzd,
                saleAmountDzd: preview.saleAmountDzd,
                profitDzd: preview.profitDzd,
            },
            affectedSummaries: ['dashboard_summary', 'services_summary', 'treasury_summary', 'portfolio_summary', 'clients_summary', 'investors_summary', 'financial_summary'],
            wallets: Object.keys(wallets).length ? wallets as any : undefined,
            portfolio: Object.keys(portfolio).length ? portfolio as any : undefined,
            clients: clientsDelta,
            services: {
                digitalServiceProfitDelta: preview.profitDzd,
                serviceRevenueDelta: preview.profitDzd,
                netCapitalImpactDelta: 0,
            },
            investors: {
                managerServiceProfitDelta: preview.profitDzd,
                managerActualOwnerCapitalDelta: preview.profitDzd,
            },
            dashboardDaily: ownerProfitPeriodDeltas(stamp.timestamp, preview.profitDzd),
            recentOperation: {
                operationId,
                source: 'legacy',
                type: 'Service numérique',
                effectiveAt: stamp.timestamp,
            },
        });
    };

    const rates = useMemo(() => ({
        usdtPma: Number(portfolioStats.usdt.avgBuy || 0),
        eurPma: Number(portfolioStats.eur.avgBuy || 0),
    }), [portfolioStats.usdt.avgBuy, portfolioStats.eur.avgBuy]);

    const digitalServicePreview = useMemo(() => {
        const purchaseAmount = parseAndEvaluate(digitalServicePurchaseAmount);
        const saleAmount = parseAndEvaluate(digitalServiceSaleAmount);
        if (!Number.isFinite(purchaseAmount) || !Number.isFinite(saleAmount)) return null;
        return computeDigitalServicePreview({
            purchaseWallet: digitalServicePurchaseWallet,
            purchaseAmount,
            saleWallet: digitalServiceSaleWallet,
            saleAmount,
            rates,
        });
    }, [digitalServicePurchaseAmount, digitalServicePurchaseWallet, digitalServiceSaleAmount, digitalServiceSaleWallet, rates]);

    const resetDigitalServiceForm = () => {
        setEditingDigitalServiceTx(null);
        setDigitalServiceClientId('');
        setDigitalServiceName('');
        setDigitalServicePurchaseWallet('Caisse');
        setDigitalServicePurchaseAmount('');
        setDigitalServiceSaleWallet('Caisse');
        setDigitalServiceSaleAmount('');
        setDigitalServiceDate(toIsoToday());
        setDigitalServiceNote('');
    };

    const openDigitalServiceModal = (tx: DigitalServiceTransaction | null = null) => {
        if (tx) {
            setEditingDigitalServiceTx(tx);
            setDigitalServiceClientId(tx.clientId);
            setDigitalServiceName(tx.serviceName || '');
            setDigitalServicePurchaseWallet(tx.purchaseWallet);
            setDigitalServicePurchaseAmount(String(tx.purchaseAmount || ''));
            setDigitalServiceSaleWallet(tx.saleWallet);
            setDigitalServiceSaleAmount(String(tx.saleAmount || ''));
            setDigitalServiceNote(tx.notes || '');
            if (tx.timestamp) {
                const d = new Date(tx.timestamp);
                setDigitalServiceDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
            }
            else {
                setDigitalServiceDate(toIsoToday());
            }
            setIsDigitalServiceModalOpen(true);
            return;
        }
        resetDigitalServiceForm();
        setIsDigitalServiceModalOpen(true);
    };

    const closeDigitalServiceModal = () => {
        setIsDigitalServiceModalOpen(false);
        resetDigitalServiceForm();
    };

    const validateDigitalService = (purchaseAmount: number, saleAmount: number) => {
        if (!digitalServiceClientId) return '⚠️ Client requis.';
        if (!digitalServiceName.trim()) return '⚠️ Service numérique requis.';
        if (!Number.isFinite(purchaseAmount) || purchaseAmount <= 0) return '⚠️ Prix d’achat invalide.';
        if (!Number.isFinite(saleAmount) || saleAmount <= 0) return '⚠️ Prix de vente invalide.';
        if (isAssetWallet(digitalServicePurchaseWallet) && rates[digitalServicePurchaseWallet === 'USDT' ? 'usdtPma' : 'eurPma'] <= 0) {
            return `⚠️ PMA ${digitalServicePurchaseWallet} indisponible.`;
        }
        if (isAssetWallet(digitalServiceSaleWallet) && rates[digitalServiceSaleWallet === 'USDT' ? 'usdtPma' : 'eurPma'] <= 0) {
            return `⚠️ PMA ${digitalServiceSaleWallet} indisponible.`;
        }
        const epsilon = 0.005;
        const currentAvailable = digitalServicePurchaseWallet === 'Caisse'
            ? treasuryStats.caisse
            : digitalServicePurchaseWallet === 'BaridiMob'
                ? treasuryStats.baridi
                : digitalServicePurchaseWallet === 'USDT'
                    ? Number(portfolioStats.usdt.available || 0)
                    : Number(portfolioStats.eur.available || 0);
        const restoredOldPurchase = editingDigitalServiceTx?.purchaseWallet === digitalServicePurchaseWallet
            ? Number(editingDigitalServiceTx.purchaseAmount || 0)
            : 0;
        const removedOldSale = editingDigitalServiceTx?.saleWallet === digitalServicePurchaseWallet
            ? Number(editingDigitalServiceTx.saleAmount || 0)
            : 0;
        const availableForPurchase = currentAvailable + restoredOldPurchase - removedOldSale;
        if (purchaseAmount > availableForPurchase + epsilon) return `⚠️ Solde ${digitalServicePurchaseWallet} insuffisant.`;
        return '';
    };

    const deleteLinkedDigitalServiceChildren = async (batch: ReturnType<typeof db.batch>, txId: string) => {
        const [treasuryChildren, portfolioChildren, clientChildren] = await Promise.all([
            userDocRef.collection('treasury_txs').where('linkedDigitalServiceTxId', '==', txId).get(),
            userDocRef.collection('usdt_txs').where('linkedDigitalServiceTxId', '==', txId).get(),
            userDocRef.collection('dzd_client_txs').where('linkedDigitalServiceTxId', '==', txId).get(),
        ]);
        treasuryChildren.forEach((doc) => {
            recordTreasuryLegacyDeletionShadow({
                operationId: `shadow:digital-service-delete:${txId}:${doc.id}`,
                actorUid: userDocRef.id,
                effectiveAt: Date.now(),
                row: doc.data(),
            });
            batch.delete(doc.ref);
        });
        portfolioChildren.forEach((doc) => batch.delete(doc.ref));
        clientChildren.forEach((doc) => batch.delete(doc.ref));
    };

    const handleSaveDigitalService = async () => {
        if (isDigitalServiceSaving) return;
        const purchaseAmount = roundM(parseAndEvaluate(digitalServicePurchaseAmount));
        const saleAmount = roundM(parseAndEvaluate(digitalServiceSaleAmount));
        const validationError = validateDigitalService(purchaseAmount, saleAmount);
        if (validationError) {
            setAlert(validationError);
            return;
        }
        const preview = computeDigitalServicePreview({
            purchaseWallet: digitalServicePurchaseWallet,
            purchaseAmount,
            saleWallet: digitalServiceSaleWallet,
            saleAmount,
            rates,
        });
        setIsDigitalServiceSaving(true);
        try {
            const stamp = resolveDateParts(digitalServiceDate);
            const client = clientsDzd.find((item) => item.id === digitalServiceClientId);
            const serviceLabel = digitalServiceName.trim();
            const note = digitalServiceNote.trim();
            const mainRef = editingDigitalServiceTx
                ? userDocRef.collection('digital_service_txs').doc(editingDigitalServiceTx.id)
                : userDocRef.collection('digital_service_txs').doc();
            const batch = db.batch();
            if (editingDigitalServiceTx) {
                await deleteLinkedDigitalServiceChildren(batch, editingDigitalServiceTx.id);
            }
            const linkedTreasuryTxIds: string[] = [];
            const linkedPortfolioTxIds: string[] = [];
            let linkedClientTxId = '';

            const childBase = {
                linkedDigitalServiceTxId: mainRef.id,
                origin: 'digital_service_sale',
            };
            if (isCashWallet(digitalServicePurchaseWallet)) {
                const ref = userDocRef.collection('treasury_txs').doc();
                linkedTreasuryTxIds.push(ref.id);
                batch.set(ref, {
                    ...childBase,
                    timestamp: stamp.timestamp,
                    date: stamp.date,
                    time: stamp.time,
                    type: 'Retrait',
                    source: digitalServicePurchaseWallet,
                    amount: preview.purchaseAmountDzd,
                    notes: `Achat service numérique: ${serviceLabel}`,
                });
            }
            else {
                const ref = userDocRef.collection('usdt_txs').doc();
                linkedPortfolioTxIds.push(ref.id);
                batch.set(ref, {
                    ...childBase,
                    timestamp: stamp.timestamp,
                    date: stamp.date,
                    time: stamp.time,
                    type: 'Retrait Manuel',
                    currency: digitalServicePurchaseWallet,
                    quantity: purchaseAmount,
                    price: preview.purchaseRateToDzd,
                    total: preview.purchaseAmountDzd,
                    notes: `Achat service numérique: ${serviceLabel}`,
                });
            }

            if (isCashWallet(digitalServiceSaleWallet)) {
                const ref = userDocRef.collection('treasury_txs').doc();
                linkedTreasuryTxIds.push(ref.id);
                batch.set(ref, {
                    ...childBase,
                    timestamp: stamp.timestamp + 1,
                    date: stamp.date,
                    time: stamp.time,
                    type: 'Ajout',
                    source: digitalServiceSaleWallet,
                    amount: preview.saleAmountDzd,
                    notes: `Vente service numérique: ${serviceLabel}`,
                });
            }
            else if (isAssetWallet(digitalServiceSaleWallet)) {
                const ref = userDocRef.collection('usdt_txs').doc();
                linkedPortfolioTxIds.push(ref.id);
                batch.set(ref, {
                    ...childBase,
                    timestamp: stamp.timestamp + 1,
                    date: stamp.date,
                    time: stamp.time,
                    type: 'Ajout Manuel',
                    currency: digitalServiceSaleWallet,
                    quantity: saleAmount,
                    price: preview.saleRateToDzd,
                    total: preview.saleAmountDzd,
                    notes: `Vente service numérique: ${serviceLabel}`,
                });
            }

            const clientTxRef = userDocRef.collection('dzd_client_txs').doc();
            linkedClientTxId = clientTxRef.id;
            batch.set(clientTxRef, {
                ...childBase,
                clientId: digitalServiceClientId,
                timestamp: stamp.timestamp + 2,
                date: stamp.date,
                time: stamp.time,
                montant: -preview.saleAmountDzd,
                type: 'Vente service numérique',
                notes: [
                    serviceLabel,
                    `Client: ${clientName(client)}`,
                    note,
                    `Achat ${purchaseAmount} ${preview.purchaseCurrency} (${preview.purchaseAmountDzd.toFixed(2)} DZD)`,
                    `Vente ${saleAmount} ${preview.saleCurrency} (${preview.saleAmountDzd.toFixed(2)} DZD)`,
                    `Marge ${preview.profitDzd.toFixed(2)} DZD`,
                ].filter(Boolean).join(' - '),
                paymentMethod: SALE_PAYMENT_METHOD[digitalServiceSaleWallet],
                affectsBalance: digitalServiceSaleWallet === 'Credit',
                origin: 'digital_service_sale',
            });

            batch.set(mainRef, {
                type: 'digital_service_sale',
                clientId: digitalServiceClientId,
                serviceName: serviceLabel,
                purchaseWallet: digitalServicePurchaseWallet,
                purchaseCurrency: preview.purchaseCurrency,
                purchaseAmount,
                purchaseRateToDzd: preview.purchaseRateToDzd,
                purchaseAmountDzd: preview.purchaseAmountDzd,
                saleWallet: digitalServiceSaleWallet,
                saleCurrency: preview.saleCurrency,
                saleAmount,
                saleRateToDzd: preview.saleRateToDzd,
                saleAmountDzd: preview.saleAmountDzd,
                profitDzd: preview.profitDzd,
                date: stamp.date,
                time: stamp.time,
                timestamp: stamp.timestamp,
                notes: note,
                linkedTreasuryTxIds,
                linkedPortfolioTxIds,
                linkedClientTxId,
            });
            if (isCashWallet(digitalServicePurchaseWallet)) {
                recordTreasuryShadow({
                    operationId: `shadow:digital-service-purchase:${mainRef.id}`,
                    actorUid: userDocRef.id,
                    effectiveAt: stamp.timestamp,
                    kind: 'digital_service_purchase_cash',
                    wallet: digitalServicePurchaseWallet,
                    amountDzd: preview.purchaseAmountDzd,
                    clientId: digitalServiceClientId,
                }, [{ type: 'Retrait', source: digitalServicePurchaseWallet, amount: preview.purchaseAmountDzd }]);
            }
            if (isCashWallet(digitalServiceSaleWallet)) {
                recordTreasuryShadow({
                    operationId: `shadow:digital-service-sale:${mainRef.id}`,
                    actorUid: userDocRef.id,
                    effectiveAt: stamp.timestamp + 1,
                    kind: 'digital_service_sale_cash',
                    wallet: digitalServiceSaleWallet,
                    amountDzd: preview.saleAmountDzd,
                    clientId: digitalServiceClientId,
                }, [{ type: 'Ajout', source: digitalServiceSaleWallet, amount: preview.saleAmountDzd }]);
            }
            const portfolioWarnings = editingDigitalServiceTx
                ? ['Legacy update replaces existing Portfolio rows; V2 immutable reversal is prepared only.']
                : [];
            if (isAssetWallet(digitalServicePurchaseWallet)) {
                const currency = digitalServicePurchaseWallet;
                const avgBuy = currency === 'USDT' ? portfolioStats.usdt.avgBuy : portfolioStats.eur.avgBuy;
                recordPortfolioShadow({
                    operationId: `shadow:digital-service-purchase-asset:${mainRef.id}`,
                    actorUid: userDocRef.id,
                    effectiveAt: stamp.timestamp,
                    kind: 'portfolio_digital_service_purchase_asset',
                    currency,
                    quantity: purchaseAmount,
                    inventoryBefore: inventoryFromLegacyPortfolioStats(portfolioStats, currency),
                }, {
                    quantityDeltas: { [currency]: -purchaseAmount },
                    costBasisDeltasDzd: { [currency]: -roundM(avgBuy * purchaseAmount) },
                    warnings: portfolioWarnings,
                });
            }
            if (isAssetWallet(digitalServiceSaleWallet)) {
                const currency = digitalServiceSaleWallet;
                recordPortfolioShadow({
                    operationId: `shadow:digital-service-sale-asset:${mainRef.id}`,
                    actorUid: userDocRef.id,
                    effectiveAt: stamp.timestamp + 1,
                    kind: 'portfolio_digital_service_sale_asset',
                    currency,
                    quantity: saleAmount,
                    inventoryBefore: inventoryFromLegacyPortfolioStats(portfolioStats, currency),
                    valueDzd: preview.saleAmountDzd,
                }, {
                    quantityDeltas: { [currency]: saleAmount },
                    costBasisDeltasDzd: { [currency]: preview.saleAmountDzd },
                    warnings: portfolioWarnings,
                });
            }
            if (!editingDigitalServiceTx && digitalServiceSaleWallet === 'Credit') {
                recordClientShadow({
                    operationId: `shadow:digital-service-client-credit:${mainRef.id}`,
                    actorUid: userDocRef.id,
                    effectiveAt: stamp.timestamp + 2,
                    kind: 'client_service_credit_sale',
                    clientId: digitalServiceClientId,
                    amountDzd: preview.saleAmountDzd,
                    positionBefore: clientPositionFromLegacyRows(clientTransactionsDzd, digitalServiceClientId, stamp.timestamp),
                    revenueAccount: 'income.digital_service_sale',
                }, { clientDeltas: { [digitalServiceClientId]: -preview.saleAmountDzd } });
            }
            const servicePurchase = isAssetWallet(digitalServicePurchaseWallet)
                ? {
                    wallet: digitalServicePurchaseWallet,
                    quantity: purchaseAmount,
                    amountDzd: preview.purchaseAmountDzd,
                    // Legacy values use current PAM for the purchase DZD value.
                    // PortfolioV2 therefore reports no unexplained FX here.
                    assetCostBasisDzd: preview.purchaseAmountDzd,
                }
                : { wallet: digitalServicePurchaseWallet, amountDzd: preview.purchaseAmountDzd };
            const serviceSale = digitalServiceSaleWallet === 'Credit'
                ? { wallet: 'Credit' as const, amountDzd: preview.saleAmountDzd, clientId: digitalServiceClientId }
                : isAssetWallet(digitalServiceSaleWallet)
                    ? { wallet: digitalServiceSaleWallet, quantity: saleAmount, amountDzd: preview.saleAmountDzd }
                    : { wallet: digitalServiceSaleWallet, amountDzd: preview.saleAmountDzd };
            recordServiceShadow({
                operationId: `shadow:digital-service:${mainRef.id}`,
                actorUid: userDocRef.id,
                effectiveAt: stamp.timestamp,
                kind: 'digital_service_sale',
                clientId: digitalServiceClientId,
                serviceName: serviceLabel,
                purchase: servicePurchase,
                sale: serviceSale,
            }, {
                serviceRevenueDzd: preview.saleAmountDzd,
                serviceCostDzd: preview.purchaseAmountDzd,
                directFeesDzd: 0,
                serviceProfitDzd: preview.profitDzd,
                fxGainLossDzd: 0,
                clientReceivableDzd: digitalServiceSaleWallet === 'Credit' ? preview.saleAmountDzd : 0,
                supplierPayableDzd: 0,
                ...(editingDigitalServiceTx ? { warnings: ['Legacy edit replaces linked rows; V2 immutable reversal is prepared only.'] } : {}),
            });
            const newDigitalServiceDelta = computeDigitalServiceReadModelDelta({
                mainRefId: mainRef.id,
                operationId: `legacy:edit:digital_service_txs:${mainRef.id}:${stamp.timestamp}:new`,
                stamp,
                purchaseWallet: digitalServicePurchaseWallet,
                saleWallet: digitalServiceSaleWallet,
                purchaseAmount,
                saleAmount,
                preview,
                clientId: digitalServiceClientId,
            });
            const readModelDelta = !editingDigitalServiceTx
                ? newDigitalServiceDelta
                : await (async () => {
                    // Read legacy main doc + linked rows; use STORED DZD values from
                    // the main doc — never recompute historical conversions with current PAM.
                    const legacyResult = await readDigitalServiceTxLegacy(editingDigitalServiceTx.id, userDocRef);
                    if (!legacyResult.main) {
                        console.error('Legacy digital service not found for edit:', editingDigitalServiceTx.id);
                        return newDigitalServiceDelta;
                    }
                    const oldMain = legacyResult.main as any;
                    const linkedClientRows = legacyResult.linkedRows.filter(r => r.collection === 'dzd_client_txs');
                    const linkedClientRow = linkedClientRows[0]?.data as any;
                    const oldPurchaseWallet = (oldMain.purchaseWallet || 'Caisse') as FinancialWallet;
                    const oldSaleWallet = (oldMain.saleWallet || 'Caisse') as DigitalServiceSaleWallet;
                    const oldPurchaseAmount = roundM(Number(oldMain.purchaseAmount || 0));
                    const oldSaleAmount = roundM(Number(oldMain.saleAmount || 0));
                    // Stored financial effect from the original document
                    const oldPreview = {
                        purchaseCurrency: (oldMain.purchaseCurrency || 'USDT') as 'USDT' | 'EUR',
                        saleCurrency: (oldMain.saleCurrency || 'USDT') as 'USDT' | 'EUR',
                        purchaseRateToDzd: Number(oldMain.purchaseRateToDzd || 0),
                        saleRateToDzd: Number(oldMain.saleRateToDzd || 0),
                        purchaseAmountDzd: roundM(Number(oldMain.purchaseAmountDzd || 0)),
                        saleAmountDzd: roundM(Number(oldMain.saleAmountDzd || 0)),
                        profitDzd: roundM(Number(oldMain.profitDzd || 0)),
                    };
                    const oldDigitalServiceDelta = computeDigitalServiceReadModelDelta({
                        mainRefId: mainRef.id,
                        operationId: `legacy:edit:digital_service_txs:${mainRef.id}:${stamp.timestamp}:old`,
                        stamp: { timestamp: Number(oldMain.timestamp || stamp.timestamp), date: oldMain.date || stamp.date, time: oldMain.time || stamp.time },
                        purchaseWallet: oldPurchaseWallet,
                        saleWallet: oldSaleWallet,
                        purchaseAmount: oldPurchaseAmount,
                        saleAmount: oldSaleAmount,
                        preview: oldPreview as any,
                        clientId: oldMain.clientId || linkedClientRow?.clientId || digitalServiceClientId,
                    });
                    return combineReadModelDeltas(invertReadModelDelta(oldDigitalServiceDelta), newDigitalServiceDelta);
                })();
            await commitLegacyWithReadModelDeltas({
                userDocRef,
                batch,
                deltas: readModelDelta ? [readModelDelta] : [],
            });
            setAlert(editingDigitalServiceTx ? '✅ Vente de service numérique mise à jour.' : '✅ Vente de service numérique enregistrée.');
            closeDigitalServiceModal();
        }
        catch (e) {
            console.error(e);
            setAlert('❌ Erreur lors de l’enregistrement du service numérique.');
        }
        finally {
            setIsDigitalServiceSaving(false);
        }
    };

    const handleDeleteDigitalService = async (tx: DigitalServiceTransaction) => {
        if (isDigitalServiceSaving) return;
        setIsDigitalServiceSaving(true);
        try {
            // Stored financial effect from the original document (no current-PAM recompute)
            const oldPreview = {
                purchaseCurrency: (tx.purchaseCurrency || 'USDT') as 'USDT' | 'EUR',
                saleCurrency: (tx.saleCurrency || 'USDT') as 'USDT' | 'EUR',
                purchaseRateToDzd: Number(tx.purchaseRateToDzd || 0),
                saleRateToDzd: Number(tx.saleRateToDzd || 0),
                purchaseAmountDzd: roundM(Number(tx.purchaseAmountDzd || 0)),
                saleAmountDzd: roundM(Number(tx.saleAmountDzd || 0)),
                profitDzd: roundM(Number(tx.profitDzd || 0)),
            };
            const oldDigitalServiceDelta = computeDigitalServiceReadModelDelta({
                mainRefId: tx.id,
                operationId: `legacy:delete-build:digital_service_txs:${tx.id}`,
                stamp: { timestamp: Number(tx.timestamp || Date.now()), date: tx.date || '', time: tx.time || '' },
                purchaseWallet: (tx.purchaseWallet || 'Caisse') as FinancialWallet,
                saleWallet: (tx.saleWallet || 'Caisse') as DigitalServiceSaleWallet,
                purchaseAmount: roundM(Number(tx.purchaseAmount || 0)),
                saleAmount: roundM(Number(tx.saleAmount || 0)),
                preview: oldPreview,
                clientId: tx.clientId,
            });
            const { recentOperation: _omit, ...invertedFields } = invertReadModelDelta(oldDigitalServiceDelta);
            const deleteDelta = buildReadModelDelta({
                ...invertedFields,
                payload: { editInverse: true, type: 'legacy_delete', txId: tx.id, collection: 'digital_service_txs', deleteOperation: 'inverse' },
                operationId: `legacy:delete:digital_service_txs:${tx.id}`,
                effectiveAt: oldDigitalServiceDelta.effectiveAt,
                affectedSummaries: oldDigitalServiceDelta.affectedSummaries,
            });
            const batch = db.batch();
            batch.delete(userDocRef.collection('digital_service_txs').doc(tx.id));
            await deleteLinkedDigitalServiceChildren(batch, tx.id);
            await commitLegacyWithReadModelDeltas({ userDocRef, batch, deltas: [deleteDelta] });
            setAlert('✅ Vente de service numérique supprimée.');
        }
        catch (e) {
            console.error(e);
            setAlert('❌ Erreur lors de la suppression du service numérique.');
        }
        finally {
            setIsDigitalServiceSaving(false);
        }
    };

    return {
        isDigitalServiceModalOpen,
        isDigitalServiceSaving,
        editingDigitalServiceTx,
        digitalServiceClientId,
        setDigitalServiceClientId,
        digitalServiceName,
        setDigitalServiceName,
        digitalServicePurchaseWallet,
        setDigitalServicePurchaseWallet,
        digitalServicePurchaseAmount,
        setDigitalServicePurchaseAmount,
        digitalServiceSaleWallet,
        setDigitalServiceSaleWallet,
        digitalServiceSaleAmount,
        setDigitalServiceSaleAmount,
        digitalServiceDate,
        setDigitalServiceDate,
        digitalServiceNote,
        setDigitalServiceNote,
        digitalServicePreview,
        openDigitalServiceModal,
        closeDigitalServiceModal,
        handleSaveDigitalService,
        handleDeleteDigitalService,
    };
}
