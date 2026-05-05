import { useState, useMemo } from 'react';
import { db, fieldValueDelete, type FirestoreDocumentReference } from '../firebase';
import {
    Tx, PortfolioStats, ClientDzd, TreasuryTx, ClientTransactionDzd
} from '../types';
import { now, parseAndEvaluate } from '../utils';
import { applyTransactionDelete } from '../transactionService';

interface HandlerProps {
    userDocRef: FirestoreDocumentReference;
    portfolioStats: PortfolioStats;
    transactions: Tx[];
    clientsDzd: ClientDzd[];
    clientTransactionsDzd: ClientTransactionDzd[];
    treasuryStats: { caisse: number; baridi: number };
    suggestedProfitMargin: string;
    suggestedSellingPrice: string;
    suggestedSellingPriceEur: string;
    setAlert: (msg: string) => void;
    setSelectedClientId: (id: string | null) => void;
    setView: (view: 'transactions' | 'dzd' | 'tresorerie' | 'statistiques' | 'tresorerie' | 'investors') => void;
}

type TransactionFormMode = 'buy_usdt' | 'sell_usdt' | 'buy_eur' | 'sell_eur';
type PortfolioCurrency = 'USDT' | 'EUR';

export function useTransactionHandlers({
    userDocRef, portfolioStats, transactions, clientsDzd, clientTransactionsDzd, treasuryStats,
    suggestedProfitMargin, suggestedSellingPrice, suggestedSellingPriceEur,
    setAlert, setSelectedClientId, setView
}: HandlerProps) {
    const [isSaving, setIsSaving] = useState(false);
    const paymentMethodByStatus: Record<'credit' | 'baridi' | 'cash', 'Crédit' | 'BaridiMob' | 'Espèces'> = {
        credit: 'Crédit',
        baridi: 'BaridiMob',
        cash: 'Espèces'
    };
    const affectsClientBalance = (status: 'credit' | 'baridi' | 'cash') => status === 'credit';

    // Modal State
    const [mode, setMode] = useState<TransactionFormMode | null>(null);
    const [editingTx, setEditingTx] = useState<Tx | null>(null);
    const [isTotalManual, setIsTotalManual] = useState(false);

    // Form State
    const [buyUsdtAmount, setBuyUsdtAmount] = useState('');
    const [buyUsdtPrice, setBuyUsdtPrice] = useState('');
    const [buyUsdtTotal, setBuyUsdtTotal] = useState('');
    const [buyEurAmount, setBuyEurAmount] = useState('');
    const [buyEurPrice, setBuyEurPrice] = useState('');
    const [buyEurTotal, setBuyEurTotal] = useState('');
    const [sellAmount, setSellAmount] = useState('');
    const [sellPrice, setSellPrice] = useState('');
    const [sellTotal, setSellTotal] = useState('');
    const [buyUsdtMode, setBuyUsdtMode] = useState<'with_dzd' | 'with_eur' | null>(null);
    const [buyEurForUsdtAmount, setBuyEurForUsdtAmount] = useState('');
    const [eurDzdPrice, setEurDzdPrice] = useState('');
    const [eurUsdtRate, setEurUsdtRate] = useState('');
    const [linkedClientId, setLinkedClientId] = useState('none');
    const [linkedClientDzdId, setLinkedClientDzdId] = useState('none');
    const [clientPaymentStatus, setClientPaymentStatus] = useState<'credit' | 'baridi' | 'cash'>('cash');
    const [notes, setNotes] = useState('');
    const [profitPercent, setProfitPercent] = useState('');

    const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
    const [adjustmentTab, setAdjustmentTab] = useState<'add' | 'subtract'>('add');
    const [adjustmentAsset, setAdjustmentAsset] = useState('DZD-Caisse');
    const [adjustmentAmount, setAdjustmentAmount] = useState('');
    const [adjustmentPrice, setAdjustmentPrice] = useState('');
    const [adjustmentNote, setAdjustmentNote] = useState('');
    const [adjustmentClientId, setAdjustmentClientId] = useState('');
    const [editingTreasuryTx, setEditingTreasuryTx] = useState<TreasuryTx | null>(null);

    const getPortfolioAssetStats = (currency: PortfolioCurrency) => (
        currency === 'USDT' ? portfolioStats.usdt : portfolioStats.eur
    );

    const usdtFromEurCalc = useMemo(() => {
        const eurQty = parseAndEvaluate(buyEurForUsdtAmount);
        const eurPrice = parseAndEvaluate(eurDzdPrice);
        const rate = parseAndEvaluate(eurUsdtRate);
        if (eurQty <= 0 || eurPrice <= 0 || rate <= 0) return null;
        return { usdtQty: eurQty / rate, usdtPriceDzd: eurPrice * rate, totalCostDzd: (eurQty / rate) * (eurPrice * rate) };
    }, [buyEurForUsdtAmount, eurDzdPrice, eurUsdtRate]);

    const formValidation = useMemo(() => {
        const errors: Record<string, string> = {};
        let isValid = true;

        const addError = (field: string, msg: string) => {
            errors[field] = msg;
            isValid = false;
        };

        const linkedEurWithdrawalOnEdit = editingTx
            ? transactions.find((tx) =>
                tx.linkedTxId === editingTx.id &&
                tx.type === 'Retrait Manuel' &&
                tx.currency === 'EUR'
            )
            : null;
        const linkedEurQtyOnEdit = Number(linkedEurWithdrawalOnEdit?.quantity || 0);
        const eurAvailableForBuy = portfolioStats.eur.available + (linkedEurQtyOnEdit > 0 ? linkedEurQtyOnEdit : 0);

        if (mode === 'buy_usdt') {
            if (buyUsdtMode === 'with_dzd') {
                if (parseAndEvaluate(buyUsdtAmount) <= 0) addError('buyUsdtAmount', 'Veuillez entrer la quantité');
                if (parseAndEvaluate(buyUsdtPrice) <= 0) addError('buyUsdtPrice', 'Veuillez entrer le prix');
                if (parseAndEvaluate(buyUsdtTotal) <= 0) addError('buyUsdtTotal', 'Montant total invalide');
                if (!linkedClientId || linkedClientId === '' || linkedClientId === 'none') addError('linkedClientId', 'Veuillez sélectionner un client');
                if (clientPaymentStatus === 'cash' && linkedClientDzdId && linkedClientDzdId !== 'none' && linkedClientDzdId === linkedClientId) {
                    addError('linkedClientDzdId', 'Le client DZD doit etre different du client principal');
                }
            } else if (buyUsdtMode === 'with_eur') {
                if (parseAndEvaluate(buyEurForUsdtAmount) <= 0) addError('buyEurForUsdtAmount', 'Quantité requise');
                if (parseAndEvaluate(eurDzdPrice) <= 0) addError('eurDzdPrice', 'Prix requis');
                if (parseAndEvaluate(eurUsdtRate) <= 0) addError('eurUsdtRate', 'Taux requis');
                if (parseAndEvaluate(buyEurForUsdtAmount) > eurAvailableForBuy) addError('buyEurForUsdtAmount', 'Solde insuffisant');
            }
        } else if (mode === 'buy_eur') {
            if (parseAndEvaluate(buyEurAmount) <= 0) addError('buyEurAmount', 'Quantité requise');
            if (parseAndEvaluate(buyEurPrice) <= 0) addError('buyEurPrice', 'Prix requis');
            if (parseAndEvaluate(buyEurTotal) <= 0) addError('buyEurTotal', 'Montant total invalide');
            if (!linkedClientId || linkedClientId === '' || linkedClientId === 'none') addError('linkedClientId', 'Veuillez sélectionner un client');
            if (clientPaymentStatus === 'cash' && linkedClientDzdId && linkedClientDzdId !== 'none' && linkedClientDzdId === linkedClientId) {
                addError('linkedClientDzdId', 'Le client DZD doit etre different du client principal');
            }
        } else if (mode === 'sell_usdt' || mode === 'sell_eur') {
            const amt = parseAndEvaluate(sellAmount);
            const sellCurrency: PortfolioCurrency = mode === 'sell_eur' ? 'EUR' : 'USDT';
            if (amt <= 0) addError('sellAmount', 'Quantité requise');
            if (parseAndEvaluate(sellPrice) <= 0) addError('sellPrice', 'Prix requis');
            if (parseAndEvaluate(sellTotal) <= 0) addError('sellTotal', 'Montant total invalide');
            const avail = getPortfolioAssetStats(sellCurrency).available + (editingTx?.type === 'sell' ? editingTx.quantity : 0);
            if (amt > avail) addError('sellAmount', 'Solde insuffisant');
            if (!linkedClientId || linkedClientId === '' || linkedClientId === 'none') addError('linkedClientId', 'Veuillez sélectionner un client');
            if (clientPaymentStatus === 'cash' && linkedClientDzdId && linkedClientDzdId !== 'none' && linkedClientDzdId === linkedClientId) {
                addError('linkedClientDzdId', 'Le client DZD doit etre different du client principal');
            }
        }

        return { isValid, errors };
    }, [mode, buyUsdtMode, buyUsdtAmount, buyUsdtPrice, buyUsdtTotal, buyEurForUsdtAmount, eurDzdPrice, eurUsdtRate, buyEurAmount, buyEurPrice, buyEurTotal, sellAmount, sellPrice, sellTotal, portfolioStats, editingTx, linkedClientId, linkedClientDzdId, clientPaymentStatus, transactions]);

    const openForm = (newMode: TransactionFormMode, txToEdit: Tx | null = null) => {
        setBuyUsdtAmount(''); setBuyUsdtPrice(''); setBuyEurAmount(''); setBuyEurPrice('');
        setSellAmount(''); setSellPrice(''); setSellTotal(''); setProfitPercent(''); setNotes('');
        setBuyUsdtMode(null); setBuyEurForUsdtAmount(''); setEurDzdPrice(''); setEurUsdtRate('');
        setBuyUsdtTotal(''); setBuyEurTotal(''); setClientPaymentStatus('cash');
        setEditingTx(txToEdit); setMode(newMode); setIsTotalManual(false);
        setLinkedClientId('none');
        setLinkedClientDzdId('none');

        if (txToEdit) {
            if (txToEdit.type === 'buy') {
                if (txToEdit.currency === 'USDT') {
                    const linkedEurWithdrawal = transactions.find((tx) =>
                        tx.linkedTxId === txToEdit.id &&
                        tx.type === 'Retrait Manuel' &&
                        tx.currency === 'EUR'
                    );

                    if (linkedEurWithdrawal) {
                        setBuyUsdtMode('with_eur');
                        const usdtQty = Number(txToEdit.quantity || 0);
                        const eurSpent = Number(linkedEurWithdrawal.quantity || 0);
                        const inferredRate = usdtQty > 0 ? (eurSpent / usdtQty) : 0;
                        const inferredEurPrice = inferredRate > 0
                            ? Number(txToEdit.price || 0) / inferredRate
                            : 0;

                        setBuyEurForUsdtAmount(eurSpent > 0 ? eurSpent.toFixed(2) : '');
                        setEurUsdtRate(inferredRate > 0 ? inferredRate.toFixed(4) : '');
                        setEurDzdPrice(inferredEurPrice > 0 ? inferredEurPrice.toFixed(2) : '');
                    } else {
                        setBuyUsdtMode('with_dzd');
                        setBuyUsdtAmount(Number(txToEdit.quantity || 0).toFixed(2));
                        setBuyUsdtPrice((txToEdit.price ?? 0).toString());
                        const existingTotal = Number(txToEdit.total || 0);
                        const fallbackTotal = Math.round((txToEdit.quantity || 0) * (txToEdit.price || 0));
                        setBuyUsdtTotal((existingTotal > 0 ? Math.round(existingTotal) : fallbackTotal).toString());
                    }
                } else {
                    setBuyEurAmount(txToEdit.quantity.toString());
                    setBuyEurPrice((txToEdit.price ?? 0).toString());
                    const existingTotal = Number(txToEdit.total || 0);
                    const fallbackTotal = Math.round((txToEdit.quantity || 0) * (txToEdit.price || 0));
                    setBuyEurTotal((existingTotal > 0 ? Math.round(existingTotal) : fallbackTotal).toString());
                }
            } else {
                const sellCurrency: PortfolioCurrency = txToEdit.currency === 'EUR' ? 'EUR' : 'USDT';
                const sellAssetStats = getPortfolioAssetStats(sellCurrency);
                setSellAmount(Number(txToEdit.quantity || 0).toFixed(2));
                setSellPrice((txToEdit.sell ?? 0).toString());
                const existingTotal = Number(txToEdit.total || 0);
                const fallbackTotal = Math.round((txToEdit.quantity || 0) * (txToEdit.sell || 0));
                setSellTotal((existingTotal > 0 ? Math.round(existingTotal) : fallbackTotal).toString());
                if (sellAssetStats.avgBuy > 0 && txToEdit.sell) {
                    const margin = txToEdit.sell - sellAssetStats.avgBuy;
                    setProfitPercent(margin.toFixed(2));
                }
            }
            setNotes(txToEdit.notes ?? '');
            const linkedDzdTxs = clientTransactionsDzd.filter(t => t.linkedTxId === txToEdit.id);
            const primaryLinkedTx = linkedDzdTxs.find(t => t.linkRole !== 'dzd_receiver') || linkedDzdTxs[0];
            const linkedDzdCollectorTx = linkedDzdTxs.find(t => t.linkRole === 'dzd_receiver');
            if (primaryLinkedTx) {
                setLinkedClientId(primaryLinkedTx.clientId);
                if (primaryLinkedTx.paymentMethod === 'Crédit') setClientPaymentStatus('credit');
                else if (primaryLinkedTx.paymentMethod === 'BaridiMob') setClientPaymentStatus('baridi');
                else setClientPaymentStatus('cash');
            }
            if (linkedDzdCollectorTx) setLinkedClientDzdId(linkedDzdCollectorTx.clientId);
        } else {
            if (newMode === 'buy_eur' && portfolioStats.eur.avgBuy > 0) setBuyEurPrice(portfolioStats.eur.avgBuy.toFixed(2));
            if (newMode === 'sell_usdt' || newMode === 'sell_eur') {
                const sellCurrency: PortfolioCurrency = newMode === 'sell_eur' ? 'EUR' : 'USDT';
                const sellAssetStats = getPortfolioAssetStats(sellCurrency);
                const configuredSuggestedPrice = sellCurrency === 'EUR'
                    ? suggestedSellingPriceEur
                    : suggestedSellingPrice;
                setProfitPercent(suggestedProfitMargin);
                let suggestedPrice = sellAssetStats.avgBuy + parseAndEvaluate(suggestedProfitMargin);
                if (configuredSuggestedPrice && parseFloat(configuredSuggestedPrice) > 0) {
                    suggestedPrice = parseFloat(configuredSuggestedPrice);
                    setProfitPercent((suggestedPrice - sellAssetStats.avgBuy).toFixed(2));
                }
                setSellPrice(suggestedPrice.toFixed(2));
            }
        }
    };

    const closeForm = () => { setMode(null); setEditingTx(null); setBuyUsdtMode(null); setSellTotal(''); setBuyUsdtTotal(''); setBuyEurTotal(''); setLinkedClientDzdId('none'); setIsTotalManual(false); };

    const handleBuy = async () => {
        if (!formValidation.isValid || isSaving) return;
        setIsSaving(true);
        try {
            const batch = db.batch();
            let quantity = 0, price = 0, currency = 'USDT';
            let eurSpentForConversion = 0;
            const mainTxRef = editingTx
                ? userDocRef.collection('usdt_txs').doc(editingTx.id)
                : userDocRef.collection('usdt_txs').doc();
            const mainTxId = mainTxRef.id;

            if (mode === 'buy_usdt') {
                if (buyUsdtMode === 'with_dzd') {
                    quantity = Number(parseAndEvaluate(buyUsdtAmount).toFixed(2));
                    price = parseAndEvaluate(buyUsdtPrice);
                } else {
                    eurSpentForConversion = parseAndEvaluate(buyEurForUsdtAmount);
                    quantity = Number(usdtFromEurCalc!.usdtQty.toFixed(2));
                    price = usdtFromEurCalc!.usdtPriceDzd;
                }
            } else {
                currency = 'EUR';
                quantity = parseAndEvaluate(buyEurAmount);
                price = parseAndEvaluate(buyEurPrice);
            }

            let totalCost = quantity * price;
            if (isTotalManual) {
                if (mode === 'buy_usdt' && buyUsdtMode === 'with_dzd') totalCost = parseAndEvaluate(buyUsdtTotal);
                else if (mode === 'buy_eur') totalCost = parseAndEvaluate(buyEurTotal);
            }
            if (mode === 'buy_usdt' && buyUsdtMode === 'with_eur' && usdtFromEurCalc) {
                totalCost = usdtFromEurCalc.totalCostDzd;
            }
            totalCost = Math.round(totalCost);

            const { date, time, timestamp } = now();
            const shouldLinkCashToDzdClient = clientPaymentStatus === 'cash' && linkedClientDzdId !== 'none';
            const createLinkedEurConversionTx = () => {
                if (mode !== 'buy_usdt' || buyUsdtMode !== 'with_eur' || eurSpentForConversion <= 0) return;
                batch.set(userDocRef.collection('usdt_txs').doc(), {
                    timestamp: timestamp - 1,
                    type: 'Retrait Manuel',
                    currency: 'EUR',
                    quantity: eurSpentForConversion,
                    date,
                    time,
                    notes: `Achat de ${quantity.toFixed(2)} USDT`,
                    linkedTxId: mainTxId
                });
            };

            if (editingTx) {
                batch.update(mainTxRef, {
                    quantity, price, total: totalCost, notes: notes.trim(),
                    sell: fieldValueDelete(), profit: fieldValueDelete(),
                    currency, clientPaymentStatus: clientPaymentStatus
                });

                const qsClient = await userDocRef.collection('dzd_client_txs').where('linkedTxId', '==', editingTx.id).get();
                qsClient.forEach(d => batch.delete(d.ref));

                const qsTreasury = await userDocRef.collection('treasury_txs').where('linkedTxId', '==', editingTx.id).get();
                qsTreasury.forEach(d => batch.delete(d.ref));

                const qsLinkedUsdt = await userDocRef.collection('usdt_txs').where('linkedTxId', '==', editingTx.id).get();
                qsLinkedUsdt.forEach(d => batch.delete(d.ref));

                createLinkedEurConversionTx();

                if (linkedClientId !== 'none') {
                    batch.set(userDocRef.collection('dzd_client_txs').doc(), {
                        clientId: linkedClientId, timestamp, date, time, montant: totalCost,
                        type: 'Règlement Reçu', notes: `Financement achat de ${quantity.toFixed(2)} ${currency}`,
                        linkedTxId: editingTx.id,
                        linkRole: 'primary',
                        paymentMethod: paymentMethodByStatus[clientPaymentStatus],
                        affectsBalance: affectsClientBalance(clientPaymentStatus)
                    });
                }

                if (shouldLinkCashToDzdClient) {
                    batch.set(userDocRef.collection('dzd_client_txs').doc(), {
                        clientId: linkedClientDzdId, timestamp: timestamp + 1, date, time, montant: totalCost,
                        type: 'Ajustement Solde', notes: `Avance DZD liee a achat de ${quantity.toFixed(2)} ${currency}`,
                        linkedTxId: editingTx.id,
                        linkRole: 'dzd_receiver',
                        paymentMethod: paymentMethodByStatus['credit'],
                        affectsBalance: true
                    });
                }

                if (buyUsdtMode !== 'with_eur' && clientPaymentStatus !== 'credit' && !shouldLinkCashToDzdClient) {
                    const source = clientPaymentStatus === 'baridi' ? 'BaridiMob' : 'Caisse';
                    batch.set(userDocRef.collection('treasury_txs').doc(), {
                        timestamp, date, time, type: 'Retrait', source, amount: totalCost,
                        notes: `Achat ${quantity.toFixed(2)} ${currency}`, linkedTxId: editingTx.id, origin: 'usdt_tx' as const
                    });
                }
                setAlert('✅ Transaction mise à jour.');
            } else {
                batch.set(mainTxRef, {
                    timestamp, type: 'buy', quantity, price, total: totalCost,
                    date, time, notes: notes.trim(), currency, clientPaymentStatus: clientPaymentStatus
                });

                createLinkedEurConversionTx();

                if (buyUsdtMode !== 'with_eur' && clientPaymentStatus !== 'credit' && !shouldLinkCashToDzdClient) {
                    const source = clientPaymentStatus === 'baridi' ? 'BaridiMob' : 'Caisse';
                    batch.set(userDocRef.collection('treasury_txs').doc(), {
                        timestamp, date, time, type: 'Retrait', source, amount: totalCost,
                        notes: `Achat ${quantity.toFixed(2)} ${currency}`, linkedTxId: mainTxRef.id, origin: 'usdt_tx' as const
                    });
                }

                if (linkedClientId !== 'none') {
                    batch.set(userDocRef.collection('dzd_client_txs').doc(), {
                        clientId: linkedClientId, timestamp, date, time, montant: totalCost,
                        type: 'Règlement Reçu', notes: `Financement achat de ${quantity.toFixed(2)} ${currency}`,
                        linkedTxId: mainTxRef.id,
                        linkRole: 'primary',
                        paymentMethod: paymentMethodByStatus[clientPaymentStatus],
                        affectsBalance: affectsClientBalance(clientPaymentStatus)
                    });
                }

                if (shouldLinkCashToDzdClient) {
                    batch.set(userDocRef.collection('dzd_client_txs').doc(), {
                        clientId: linkedClientDzdId, timestamp: timestamp + 1, date, time, montant: totalCost,
                        type: 'Ajustement Solde', notes: `Avance DZD liee a achat de ${quantity.toFixed(2)} ${currency}`,
                        linkedTxId: mainTxRef.id,
                        linkRole: 'dzd_receiver',
                        paymentMethod: paymentMethodByStatus['credit'],
                        affectsBalance: true
                    });
                }
                setAlert('✅ Transaction ajoutée.');
            }

            await batch.commit();
            closeForm();
            if (linkedClientId !== 'none') {
                setTimeout(() => {
                    setSelectedClientId(linkedClientId);
                    setView('dzd');
                }, 100);
            }
        } catch (e) {
            console.error(e);
            setAlert('❌ Erreur.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSell = async () => {
        if (!formValidation.isValid || isSaving) return;
        setIsSaving(true);
        try {
            const sellCurrency: PortfolioCurrency = mode === 'sell_eur' ? 'EUR' : 'USDT';
            const clientTxType = sellCurrency === 'EUR' ? 'Vente EUR' : 'Vente USDT';
            const sellAssetStats = getPortfolioAssetStats(sellCurrency);
            const quantity = Number(parseAndEvaluate(sellAmount).toFixed(2));
            const sell = parseAndEvaluate(sellPrice);
            const avg = sellAssetStats.avgBuy;
            const profit = Number(((sell - avg) * quantity).toFixed(2));
            const totalInput = parseAndEvaluate(sellTotal);

            let totalRevenue = quantity * sell;
            if (isTotalManual && totalInput > 0) totalRevenue = totalInput;
            totalRevenue = Math.round(totalRevenue);

            const { date, time, timestamp } = now();
            const shouldLinkCashToDzdClient = clientPaymentStatus === 'cash' && linkedClientDzdId !== 'none';
            const batch = db.batch();

            if (editingTx) {
                batch.update(userDocRef.collection('usdt_txs').doc(editingTx.id), {
                    quantity, sell, profit, notes: notes.trim(),
                    price: fieldValueDelete(), total: fieldValueDelete(),
                    currency: sellCurrency, clientPaymentStatus: clientPaymentStatus
                });

                const qsClient = await userDocRef.collection('dzd_client_txs').where('linkedTxId', '==', editingTx.id).get();
                qsClient.forEach(d => batch.delete(d.ref));

                const qsTreasury = await userDocRef.collection('treasury_txs').where('linkedTxId', '==', editingTx.id).get();
                qsTreasury.forEach(d => batch.delete(d.ref));

                if (linkedClientId !== 'none') {
                    batch.set(userDocRef.collection('dzd_client_txs').doc(), {
                        clientId: linkedClientId, timestamp, date, time, montant: -totalRevenue,
                        type: clientTxType, notes: `Vente de ${quantity.toFixed(2)} ${sellCurrency} @ ${sell.toFixed(2)}`,
                        linkedTxId: editingTx.id,
                        linkRole: 'primary',
                        paymentMethod: paymentMethodByStatus[clientPaymentStatus],
                        affectsBalance: affectsClientBalance(clientPaymentStatus)
                    });
                }

                if (shouldLinkCashToDzdClient) {
                    batch.set(userDocRef.collection('dzd_client_txs').doc(), {
                        clientId: linkedClientDzdId, timestamp: timestamp + 1, date, time, montant: -totalRevenue,
                        type: 'Ajustement Solde', notes: `Dette DZD liee a vente de ${quantity.toFixed(2)} ${sellCurrency}`,
                        linkedTxId: editingTx.id,
                        linkRole: 'dzd_receiver',
                        paymentMethod: paymentMethodByStatus['credit'],
                        affectsBalance: true
                    });
                }

                if (clientPaymentStatus !== 'credit' && !shouldLinkCashToDzdClient) {
                    const source = clientPaymentStatus === 'baridi' ? 'BaridiMob' : 'Caisse';
                    batch.set(userDocRef.collection('treasury_txs').doc(), {
                        timestamp, date, time, type: 'Ajout', source, amount: totalRevenue,
                        notes: `Vente ${quantity.toFixed(2)} ${sellCurrency}`, linkedTxId: editingTx.id, origin: 'usdt_tx' as const
                    });
                }
                setAlert('✅ Transaction mise à jour.');
            } else {
                const ref = userDocRef.collection('usdt_txs').doc();
                batch.set(ref, {
                    timestamp, type: 'sell', quantity, sell, profit,
                    date, time, notes: notes.trim(), currency: sellCurrency, clientPaymentStatus: clientPaymentStatus
                });

                if (clientPaymentStatus !== 'credit' && !shouldLinkCashToDzdClient) {
                    const source = clientPaymentStatus === 'baridi' ? 'BaridiMob' : 'Caisse';
                    batch.set(userDocRef.collection('treasury_txs').doc(), {
                        timestamp, date, time, type: 'Ajout', source, amount: totalRevenue,
                        notes: `Vente ${quantity.toFixed(2)} ${sellCurrency}`, linkedTxId: ref.id, origin: 'usdt_tx' as const
                    });
                }

                if (linkedClientId !== 'none') {
                    batch.set(userDocRef.collection('dzd_client_txs').doc(), {
                        clientId: linkedClientId, timestamp, date, time, montant: -totalRevenue,
                        type: clientTxType, notes: `Vente de ${quantity.toFixed(2)} ${sellCurrency} @ ${sell.toFixed(2)}`,
                        linkedTxId: ref.id,
                        linkRole: 'primary',
                        paymentMethod: paymentMethodByStatus[clientPaymentStatus],
                        affectsBalance: affectsClientBalance(clientPaymentStatus)
                    });
                }

                if (shouldLinkCashToDzdClient) {
                    batch.set(userDocRef.collection('dzd_client_txs').doc(), {
                        clientId: linkedClientDzdId, timestamp: timestamp + 1, date, time, montant: -totalRevenue,
                        type: 'Ajustement Solde', notes: `Dette DZD liee a vente de ${quantity.toFixed(2)} ${sellCurrency}`,
                        linkedTxId: ref.id,
                        linkRole: 'dzd_receiver',
                        paymentMethod: paymentMethodByStatus['credit'],
                        affectsBalance: true
                    });
                }
                setAlert('✅ Transaction ajoutée.');
            }

            await batch.commit();
            closeForm();
            if (linkedClientId !== 'none') {
                setTimeout(() => {
                    setSelectedClientId(linkedClientId);
                    setView('dzd');
                }, 100);
            }
        } catch (e) {
            console.error(e);
            setAlert('❌ Erreur.');
        } finally {
            setIsSaving(false);
        }
    };
    const handleGlobalAdjustment = async () => {
        const amountNum = parseAndEvaluate(adjustmentAmount);
        if (isNaN(amountNum) || amountNum <= 0) {
            setAlert('⚠️ Montant invalide.');
            return;
        }
        const epsilon = 0.005;
        if (adjustmentTab === 'subtract') {
            if (adjustmentAsset === 'USDT' && amountNum > (portfolioStats.usdt.available + epsilon)) {
                setAlert('⚠️ Solde USDT insuffisant.');
                return;
            }
            if (adjustmentAsset === 'EUR' && amountNum > (portfolioStats.eur.available + epsilon)) {
                setAlert('⚠️ Solde EUR insuffisant.');
                return;
            }
            if (adjustmentAsset === 'DZD-Caisse' && amountNum > (treasuryStats.caisse + epsilon)) {
                setAlert('⚠️ Solde Caisse insuffisant.');
                return;
            }
            if (adjustmentAsset === 'DZD-Baridi' && amountNum > (treasuryStats.baridi + epsilon)) {
                setAlert('⚠️ Solde BaridiMob insuffisant.');
                return;
            }
        }
        if (isSaving) return;
        setIsSaving(true);
        try {
            const batch = db.batch();
            const stamp = now();
            if (adjustmentAsset === 'USDT' || adjustmentAsset === 'EUR') {
                const type = adjustmentTab === 'add' ? 'Ajout Manuel' : 'Retrait Manuel';
                const priceNum = parseAndEvaluate(adjustmentPrice);
                const txData: any = {
                    timestamp: stamp.timestamp, type, currency: adjustmentAsset,
                    quantity: Number(amountNum.toFixed(2)), date: stamp.date, time: stamp.time,
                    notes: adjustmentNote || 'Ajustement Manuel'
                };
                if (priceNum > 0) {
                    txData.price = priceNum;
                    txData.total = Number((amountNum * priceNum).toFixed(2));
                }
                batch.set(userDocRef.collection('usdt_txs').doc(), txData);
            } else {
                const type = adjustmentTab === 'add' ? 'Ajout' : 'Retrait';
                const source = adjustmentAsset === 'DZD-Caisse' ? 'Caisse' : 'BaridiMob';
                const note = adjustmentNote || 'Ajustement Trésorerie';

                if (editingTreasuryTx) {
                    batch.update(userDocRef.collection('treasury_txs').doc(editingTreasuryTx.id), {
                        type, source, amount: amountNum, notes: note
                    });
                } else {
                    const treasuryTxRef = userDocRef.collection('treasury_txs').doc();
                    batch.set(treasuryTxRef, { timestamp: stamp.timestamp, date: stamp.date, time: stamp.time, type, source, amount: amountNum, notes: note });
                    if (adjustmentClientId) {
                        const client = clientsDzd.find(c => c.id === adjustmentClientId);
                        if (client) {
                            const clientTxType = adjustmentTab === 'add' ? 'Règlement Reçu' : 'Paiement Effectué';
                            const clientAmount = adjustmentTab === 'add' ? amountNum : -amountNum;
                            batch.set(userDocRef.collection('dzd_client_txs').doc(), {
                                clientId: adjustmentClientId, timestamp: stamp.timestamp,
                                date: stamp.date, time: stamp.time, montant: clientAmount,
                                type: clientTxType, notes: `${note} (${source})`,
                                linkedTxId: treasuryTxRef.id, origin: 'adjustment'
                            });
                        }
                    }
                }
            }
            await batch.commit();
            setAlert('✅ Opération réussie.');
            setIsAdjustmentModalOpen(false);
            if (adjustmentClientId) {
                setTimeout(() => {
                    setSelectedClientId(adjustmentClientId);
                    setView('dzd');
                }, 100);
            }
        } catch (e) {
            console.error(e);
            setAlert('❌ Erreur.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteTx = async (txId: string, type: 'usdt_tx' | 'client_tx' | 'treasury_tx' | 'asset_tx') => {
        setIsSaving(true);
        try {
            const result = await applyTransactionDelete(txId, type, userDocRef);
            if (result.success) setAlert('✅ Supprimé.');
            else setAlert(`❌ ${result.error || 'Erreur.'}`);
        } catch (e) {
            console.error(e);
            setAlert('❌ Erreur.');
        } finally {
            setIsSaving(false);
        }
    };

    const openAdjustmentModal = (type: 'add' | 'subtract' = 'add', txToEdit: TreasuryTx | null = null) => {
        setAdjustmentTab(type);
        setEditingTreasuryTx(txToEdit);
        setAdjustmentPrice('');
        if (txToEdit) {
            setAdjustmentAmount(txToEdit.amount.toString());
            setAdjustmentAsset(txToEdit.source === 'Caisse' ? 'DZD-Caisse' : 'DZD-Baridi');
            setAdjustmentNote(txToEdit.notes || '');
        } else {
            setAdjustmentAmount('');
            setAdjustmentNote('');
            setAdjustmentAsset('DZD-Caisse');
            setAdjustmentClientId('');
        }
        setIsAdjustmentModalOpen(true);
    };

    const [txToDelete, setTxToDelete] = useState<Tx | TreasuryTx | null>(null);

    // Transfer State
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [transferAmount, setTransferAmount] = useState('');
    const [transferFromClientId, setTransferFromClientId] = useState('');
    const [transferToClientId, setTransferToClientId] = useState('');
    const [transferNotes, setTransferNotes] = useState('');

    // Transfer Balance Logic
    const getClientBalance = (clientId: string): number => {
        return clientTransactionsDzd
            .filter(tx => tx.clientId === clientId && tx.affectsBalance !== false)
            .reduce((acc, tx) => acc + tx.montant, 0);
    };

    const transferFromBalance = useMemo(() => {
        if (!transferFromClientId) return 0;
        return getClientBalance(transferFromClientId);
    }, [transferFromClientId, clientTransactionsDzd]);

    const transferToBalance = useMemo(() => {
        if (!transferToClientId) return 0;
        return getClientBalance(transferToClientId);
    }, [transferToClientId, clientTransactionsDzd]);

    const handleSaveTransfer = async () => {
        const amt = parseAndEvaluate(transferAmount);
        if (amt <= 0 || !transferFromClientId || !transferToClientId || transferFromClientId === transferToClientId) {
            setAlert('⚠️ Paramètres de transfert invalides.');
            return;
        }
        setIsSaving(true);
        try {
            const { date, time, timestamp } = now();
            const batch = db.batch();
            const fromC = clientsDzd.find(c => c.id === transferFromClientId);
            const toC = clientsDzd.find(c => c.id === transferToClientId);

            // Source (De) advances money -> Credit (+amt)
            batch.set(userDocRef.collection('dzd_client_txs').doc(), {
                clientId: transferFromClientId, timestamp, date, time, montant: amt,
                type: 'Transfert Sortant', notes: transferNotes.trim() || `Transfert vers ${toC?.fullName || 'Client'}`,
                paymentMethod: 'Crédit'
            });

            // Destination (À) receives benefit -> Debit (-amt)
            batch.set(userDocRef.collection('dzd_client_txs').doc(), {
                clientId: transferToClientId, timestamp: timestamp + 1, date, time, montant: -amt,
                type: 'Transfert Entrant', notes: transferNotes.trim() || `Transfert de ${fromC?.fullName || 'Client'}`,
                paymentMethod: 'Crédit'
            });

            await batch.commit();
            setAlert('✅ Transfert réussi.');
            setIsTransferModalOpen(false);
            setTransferAmount(''); setTransferFromClientId(''); setTransferToClientId(''); setTransferNotes('');
        } catch (e) {
            console.error(e);
            setAlert('❌ Erreur transfert.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleConfirmDeleteTx = async () => {
        if (!txToDelete) return;
        if ((txToDelete as any).currency) {
            const parentUsdtId = (txToDelete as any).linkedTxId;
            await handleDeleteTx(parentUsdtId || txToDelete.id, 'usdt_tx');
        } else {
            await handleDeleteTx(txToDelete.id, 'treasury_tx');
        }
        setTxToDelete(null);
    };

    return {
        isSaving, setIsSaving, mode, setMode, editingTx, setEditingTx, isTotalManual, setIsTotalManual,
        buyUsdtAmount, setBuyUsdtAmount, buyUsdtPrice, setBuyUsdtPrice, buyUsdtTotal, setBuyUsdtTotal,
        buyEurAmount, setBuyEurAmount, buyEurPrice, setBuyEurPrice, buyEurTotal, setBuyEurTotal,
        sellAmount, setSellAmount, sellPrice, setSellPrice, sellTotal, setSellTotal,
        buyUsdtMode, setBuyUsdtMode, buyEurForUsdtAmount, setBuyEurForUsdtAmount,
        eurDzdPrice, setEurDzdPrice, eurUsdtRate, setEurUsdtRate,
        linkedClientId, setLinkedClientId, linkedClientDzdId, setLinkedClientDzdId, clientPaymentStatus, setClientPaymentStatus,
        notes, setNotes, profitPercent, setProfitPercent,
        isAdjustmentModalOpen, setIsAdjustmentModalOpen, adjustmentTab, setAdjustmentTab,
        adjustmentAsset, setAdjustmentAsset, adjustmentAmount, setAdjustmentAmount,
        adjustmentPrice, setAdjustmentPrice, adjustmentNote, setAdjustmentNote,
        adjustmentClientId, setAdjustmentClientId, editingTreasuryTx, setEditingTreasuryTx,
        usdtFromEurCalc, formValidation, openForm, closeForm, handleBuy, handleSell,
        handleGlobalAdjustment, handleDeleteTx, openAdjustmentModal,
        txToDelete, setTxToDelete, handleConfirmDeleteTx,
        isTransferModalOpen, setIsTransferModalOpen, transferAmount, setTransferAmount,
        transferFromClientId, setTransferFromClientId, transferToClientId, setTransferToClientId,
        transferNotes, setTransferNotes, handleSaveTransfer,
        transferFromBalance, transferToBalance
    };
}

















