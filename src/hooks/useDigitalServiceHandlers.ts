import { useMemo, useState } from 'react';
import { db, type FirestoreDocumentReference } from '../firebase';
import type { ClientDzd, DigitalServiceTransaction, PortfolioStats } from '../types';
import { now, parseAndEvaluate } from '../utils';
import { roundM } from '../utils/money';
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

export function useDigitalServiceHandlers({ userDocRef, clientsDzd, portfolioStats, treasuryStats, setAlert }: UseDigitalServiceHandlersArgs) {
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
        treasuryChildren.forEach((doc) => batch.delete(doc.ref));
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
            await batch.commit();
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
            const batch = db.batch();
            batch.delete(userDocRef.collection('digital_service_txs').doc(tx.id));
            await deleteLinkedDigitalServiceChildren(batch, tx.id);
            await batch.commit();
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
