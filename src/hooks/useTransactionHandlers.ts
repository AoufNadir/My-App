import { useState, useMemo } from 'react';
import { db, fieldValueDelete, type FirestoreDocumentReference } from '../firebase';
import { Tx, PortfolioStats, ClientDzd, TreasuryTx, ClientTransactionDzd } from '../types';
import { now, parseAndEvaluate } from '../utils';
import { roundM } from '../utils/money';
import { formatNumber } from '../pages/shared/pageFormat';
import { applyTransactionDelete } from '../transactionService';
interface HandlerProps {
    userDocRef: FirestoreDocumentReference;
    portfolioStats: PortfolioStats;
    transactions: Tx[];
    clientsDzd: ClientDzd[];
    clientTransactionsDzd: ClientTransactionDzd[];
    treasuryStats: {
        caisse: number;
        baridi: number;
    };
    suggestedProfitMargin: string;
    suggestedSellingPrice: string;
    suggestedSellingPriceEur: string;
    setAlert: (msg: string) => void;
    setSelectedClientId: (id: string | null) => void;
    setView: (view: 'transactions' | 'dzd' | 'tresorerie' | 'statistiques' | 'tresorerie' | 'investors') => void;
}
type TransactionFormMode = 'buy_usdt' | 'sell_usdt' | 'buy_eur' | 'sell_eur';
type PortfolioCurrency = 'USDT' | 'EUR';
type SettlementCurrency = 'DZD' | 'EUR';
export function useTransactionHandlers({ userDocRef, portfolioStats, transactions, clientsDzd, clientTransactionsDzd, treasuryStats, suggestedProfitMargin, suggestedSellingPrice, suggestedSellingPriceEur, setAlert, setSelectedClientId, setView }: HandlerProps) {
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
    const [sellSettlementCurrency, setSellSettlementCurrency] = useState<SettlementCurrency>('DZD');
    const [sellEurToDzdRate, setSellEurToDzdRate] = useState('');
    const [buyUsdtMode, setBuyUsdtMode] = useState<'with_dzd' | 'with_eur' | null>(null);
    const [buyEurForUsdtAmount, setBuyEurForUsdtAmount] = useState('');
    const [eurDzdPrice, setEurDzdPrice] = useState('');
    const [eurUsdtRate, setEurUsdtRate] = useState('');
    const [linkedClientId, setLinkedClientId] = useState('none');
    const [linkedClientDzdId, setLinkedClientDzdId] = useState('none');
    const [clientPaymentStatus, setClientPaymentStatus] = useState<'credit' | 'baridi' | 'cash'>('cash');
    const [notes, setNotes] = useState('');
    const [txTags, setTxTags] = useState<string[]>([]);
    const [profitPercent, setProfitPercent] = useState('');
    const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
    const [adjustmentTab, setAdjustmentTab] = useState<'add' | 'subtract'>('add');
    const [adjustmentAsset, setAdjustmentAsset] = useState('DZD-Caisse');
    const [adjustmentAmount, setAdjustmentAmount] = useState('');
    const [adjustmentPrice, setAdjustmentPrice] = useState('');
    const [adjustmentNote, setAdjustmentNote] = useState('');
    const [adjustmentClientId, setAdjustmentClientId] = useState('');
    const [editingTreasuryTx, setEditingTreasuryTx] = useState<TreasuryTx | null>(null);
    const [isDeliveryExpenseModalOpen, setIsDeliveryExpenseModalOpen] = useState(false);
    const [deliveryExpenseAmount, setDeliveryExpenseAmount] = useState('');
    const [deliveryExpenseMethod, setDeliveryExpenseMethod] = useState<'Caisse' | 'BaridiMob'>('Caisse');
    const [deliveryExpenseDate, setDeliveryExpenseDate] = useState<string>('');
    const [deliveryExpenseNote, setDeliveryExpenseNote] = useState('');
    const getPortfolioAssetStats = (currency: PortfolioCurrency) => (currency === 'USDT' ? portfolioStats.usdt : portfolioStats.eur);
    const usdtFromEurCalc = useMemo(() => {
        const eurQty = parseAndEvaluate(buyEurForUsdtAmount);
        const eurPrice = parseAndEvaluate(eurDzdPrice);
        const rate = parseAndEvaluate(eurUsdtRate);
        if (eurQty <= 0 || eurPrice <= 0 || rate <= 0)
            return null;
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
            ? transactions.find((tx) => tx.linkedTxId === editingTx.id &&
                tx.type === 'Retrait Manuel' &&
                tx.currency === 'EUR')
            : null;
        const linkedEurQtyOnEdit = Number(linkedEurWithdrawalOnEdit?.quantity || 0);
        const eurAvailableForBuy = portfolioStats.eur.available + (linkedEurQtyOnEdit > 0 ? linkedEurQtyOnEdit : 0);
        if (mode === 'buy_usdt') {
            if (buyUsdtMode === 'with_dzd') {
                if (parseAndEvaluate(buyUsdtAmount) <= 0)
                    addError('buyUsdtAmount', 'Veuillez entrer la quantité');
                if (parseAndEvaluate(buyUsdtPrice) <= 0)
                    addError('buyUsdtPrice', 'Veuillez entrer le prix');
                if (parseAndEvaluate(buyUsdtTotal) <= 0)
                    addError('buyUsdtTotal', 'Montant total invalide');
                if (!linkedClientId || linkedClientId === '' || linkedClientId === 'none')
                    addError('linkedClientId', 'Veuillez sélectionner un client');
                if (clientPaymentStatus === 'cash' && linkedClientDzdId && linkedClientDzdId !== 'none' && linkedClientDzdId === linkedClientId) {
                    addError('linkedClientDzdId', 'Le client DZD doit etre different du client principal');
                }
            }
            else if (buyUsdtMode === 'with_eur') {
                if (parseAndEvaluate(buyEurForUsdtAmount) <= 0)
                    addError('buyEurForUsdtAmount', 'Quantité requise');
                if (parseAndEvaluate(eurDzdPrice) <= 0)
                    addError('eurDzdPrice', 'Prix requis');
                if (parseAndEvaluate(eurUsdtRate) <= 0)
                    addError('eurUsdtRate', 'Taux requis');
                if (parseAndEvaluate(buyEurForUsdtAmount) > eurAvailableForBuy)
                    addError('buyEurForUsdtAmount', 'Solde insuffisant');
            }
        }
        else if (mode === 'buy_eur') {
            if (parseAndEvaluate(buyEurAmount) <= 0)
                addError('buyEurAmount', 'Quantité requise');
            if (parseAndEvaluate(buyEurPrice) <= 0)
                addError('buyEurPrice', 'Prix requis');
            if (parseAndEvaluate(buyEurTotal) <= 0)
                addError('buyEurTotal', 'Montant total invalide');
            if (!linkedClientId || linkedClientId === '' || linkedClientId === 'none')
                addError('linkedClientId', 'Veuillez sélectionner un client');
            if (clientPaymentStatus === 'cash' && linkedClientDzdId && linkedClientDzdId !== 'none' && linkedClientDzdId === linkedClientId) {
                addError('linkedClientDzdId', 'Le client DZD doit etre different du client principal');
            }
        }
        else if (mode === 'sell_usdt' || mode === 'sell_eur') {
            const amt = parseAndEvaluate(sellAmount);
            const sellCurrency: PortfolioCurrency = mode === 'sell_eur' ? 'EUR' : 'USDT';
            const isUsdtSettledInEur = sellCurrency === 'USDT' && sellSettlementCurrency === 'EUR';
            const canUseLinkedDzdClient = !isUsdtSettledInEur && (clientPaymentStatus === 'cash' || clientPaymentStatus === 'baridi');
            if (amt <= 0)
                addError('sellAmount', 'Quantité requise');
            if (parseAndEvaluate(sellPrice) <= 0)
                addError('sellPrice', 'Prix requis');
            if (parseAndEvaluate(sellTotal) <= 0)
                addError('sellTotal', 'Montant total invalide');
            if (isUsdtSettledInEur && parseAndEvaluate(sellEurToDzdRate) <= 0)
                addError('sellEurToDzdRate', 'Taux EUR/DZD requis');
            const avail = getPortfolioAssetStats(sellCurrency).available + (editingTx?.type === 'sell' ? editingTx.quantity : 0);
            if (amt > avail)
                addError('sellAmount', 'Solde insuffisant');
            if (!linkedClientId || linkedClientId === '' || linkedClientId === 'none')
                addError('linkedClientId', 'Veuillez sélectionner un client');
            if (canUseLinkedDzdClient && linkedClientDzdId && linkedClientDzdId !== 'none' && linkedClientDzdId === linkedClientId) {
                addError('linkedClientDzdId', 'Le client DZD doit etre different du client principal');
            }
        }
        return { isValid, errors };
    }, [mode, buyUsdtMode, buyUsdtAmount, buyUsdtPrice, buyUsdtTotal, buyEurForUsdtAmount, eurDzdPrice, eurUsdtRate, buyEurAmount, buyEurPrice, buyEurTotal, sellAmount, sellPrice, sellTotal, sellSettlementCurrency, sellEurToDzdRate, portfolioStats, editingTx, linkedClientId, linkedClientDzdId, clientPaymentStatus, transactions]);
    const openForm = (newMode: TransactionFormMode, txToEdit: Tx | null = null) => {
        setBuyUsdtAmount('');
        setBuyUsdtPrice('');
        setBuyEurAmount('');
        setBuyEurPrice('');
        setSellAmount('');
        setSellPrice('');
        setSellTotal('');
        setProfitPercent('');
        setNotes('');
        setBuyUsdtMode(null);
        setBuyEurForUsdtAmount('');
        setEurDzdPrice('');
        setEurUsdtRate('');
        setSellSettlementCurrency('DZD');
        setSellEurToDzdRate('');
        setBuyUsdtTotal('');
        setBuyEurTotal('');
        setClientPaymentStatus('cash');
        setEditingTx(txToEdit);
        setMode(newMode);
        setIsTotalManual(false);
        setLinkedClientId('none');
        setLinkedClientDzdId('none');
        if (txToEdit) {
            if (txToEdit.type === 'buy') {
                if (txToEdit.currency === 'USDT') {
                    const linkedEurWithdrawal = transactions.find((tx) => tx.linkedTxId === txToEdit.id &&
                        tx.type === 'Retrait Manuel' &&
                        tx.currency === 'EUR');
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
                    }
                    else {
                        setBuyUsdtMode('with_dzd');
                        setBuyUsdtAmount(Number(txToEdit.quantity || 0).toFixed(2));
                        setBuyUsdtPrice((txToEdit.price ?? 0).toString());
                        const existingTotal = Number(txToEdit.total || 0);
                        const fallbackTotal = Math.round((txToEdit.quantity || 0) * (txToEdit.price || 0));
                        setBuyUsdtTotal((existingTotal > 0 ? Math.round(existingTotal) : fallbackTotal).toString());
                    }
                }
                else {
                    setBuyEurAmount(txToEdit.quantity.toString());
                    setBuyEurPrice((txToEdit.price ?? 0).toString());
                    const existingTotal = Number(txToEdit.total || 0);
                    const fallbackTotal = Math.round((txToEdit.quantity || 0) * (txToEdit.price || 0));
                    setBuyEurTotal((existingTotal > 0 ? Math.round(existingTotal) : fallbackTotal).toString());
                }
            }
            else {
                const sellCurrency: PortfolioCurrency = txToEdit.currency === 'EUR' ? 'EUR' : 'USDT';
                const sellAssetStats = getPortfolioAssetStats(sellCurrency);
                const existingSettlementCurrency: SettlementCurrency = sellCurrency === 'USDT' && txToEdit.settlementCurrency === 'EUR' ? 'EUR' : 'DZD';
                setSellAmount(Number(txToEdit.quantity || 0).toFixed(2));
                setSellSettlementCurrency(existingSettlementCurrency);
                setSellPrice((existingSettlementCurrency === 'EUR' ? (txToEdit.sellPriceEur ?? 0) : (txToEdit.sell ?? 0)).toString());
                setSellEurToDzdRate(existingSettlementCurrency === 'EUR' && txToEdit.eurToDzdRateAtSale
                    ? txToEdit.eurToDzdRateAtSale.toString()
                    : '');
                const existingTotal = Number(existingSettlementCurrency === 'EUR' ? txToEdit.saleValueEur : txToEdit.total || 0);
                const fallbackTotal = (txToEdit.quantity || 0) * (existingSettlementCurrency === 'EUR'
                    ? Number(txToEdit.sellPriceEur || 0)
                    : Number(txToEdit.sell || 0));
                setSellTotal((existingTotal > 0 ? existingTotal : fallbackTotal).toString());
                if (sellAssetStats.avgBuy > 0 && txToEdit.sell) {
                    const margin = txToEdit.sell - sellAssetStats.avgBuy;
                    setProfitPercent(margin.toFixed(2));
                }
            }
            setNotes(txToEdit.notes ?? '');
            setTxTags(Array.isArray(txToEdit.tags) ? txToEdit.tags : []);
            const linkedDzdTxs = clientTransactionsDzd.filter(t => t.linkedTxId === txToEdit.id);
            const primaryLinkedTx = linkedDzdTxs.find(t => t.linkRole !== 'dzd_receiver') || linkedDzdTxs[0];
            const linkedDzdCollectorTx = linkedDzdTxs.find(t => t.linkRole === 'dzd_receiver');
            if (primaryLinkedTx) {
                setLinkedClientId(primaryLinkedTx.clientId);
                if (primaryLinkedTx.paymentMethod === 'Crédit')
                    setClientPaymentStatus('credit');
                else if (primaryLinkedTx.paymentMethod === 'BaridiMob')
                    setClientPaymentStatus('baridi');
                else
                    setClientPaymentStatus('cash');
            }
            else if (txToEdit.linkedClientId) {
                setLinkedClientId(txToEdit.linkedClientId);
                if (txToEdit.clientPaymentStatus)
                    setClientPaymentStatus(txToEdit.clientPaymentStatus);
            }
            if (linkedDzdCollectorTx)
                setLinkedClientDzdId(linkedDzdCollectorTx.clientId);
            else if (txToEdit.linkedClientDzdId)
                setLinkedClientDzdId(txToEdit.linkedClientDzdId);
        }
        else {
            if (newMode === 'buy_eur' && portfolioStats.eur.avgBuy > 0)
                setBuyEurPrice(portfolioStats.eur.avgBuy.toFixed(2));
            if (newMode === 'sell_usdt' || newMode === 'sell_eur') {
                const sellCurrency: PortfolioCurrency = newMode === 'sell_eur' ? 'EUR' : 'USDT';
                const sellAssetStats = getPortfolioAssetStats(sellCurrency);
                if (newMode === 'sell_usdt' && portfolioStats.eur.avgBuy > 0) {
                    setSellEurToDzdRate(portfolioStats.eur.avgBuy.toFixed(2));
                }
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
    const closeForm = () => { setMode(null); setEditingTx(null); setBuyUsdtMode(null); setSellTotal(''); setBuyUsdtTotal(''); setBuyEurTotal(''); setSellSettlementCurrency('DZD'); setSellEurToDzdRate(''); setLinkedClientDzdId('none'); setIsTotalManual(false); setTxTags([]); };
    const handleBuy = async () => {
        if (!formValidation.isValid || isSaving)
            return;
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
                    // FIX-10 (Q2 reversal): preserve up to 2 decimals so the user can send the
                    // exact amount to the client (e.g. 100.50 USDT, not rounded to 101).
                    quantity = roundM(parseAndEvaluate(buyUsdtAmount));
                    price = parseAndEvaluate(buyUsdtPrice);
                }
                else {
                    eurSpentForConversion = parseAndEvaluate(buyEurForUsdtAmount);
                    quantity = roundM(usdtFromEurCalc!.usdtQty);
                    price = usdtFromEurCalc!.usdtPriceDzd;
                }
            }
            else {
                currency = 'EUR';
                quantity = roundM(parseAndEvaluate(buyEurAmount));
                price = parseAndEvaluate(buyEurPrice);
            }
            let totalCost = quantity * price;
            if (isTotalManual) {
                if (mode === 'buy_usdt' && buyUsdtMode === 'with_dzd')
                    totalCost = parseAndEvaluate(buyUsdtTotal);
                else if (mode === 'buy_eur')
                    totalCost = parseAndEvaluate(buyEurTotal);
            }
            if (mode === 'buy_usdt' && buyUsdtMode === 'with_eur' && usdtFromEurCalc) {
                totalCost = usdtFromEurCalc.totalCostDzd;
            }
            totalCost = Math.round(totalCost);
            const buyMetadata: any = {
                purchaseFundingCurrency: mode === 'buy_usdt' && buyUsdtMode === 'with_eur' ? 'EUR' : 'DZD'
            };
            if (mode === 'buy_usdt' && buyUsdtMode === 'with_eur') {
                buyMetadata.purchaseAmountEur = eurSpentForConversion;
                buyMetadata.eurToDzdRateAtPurchase = parseAndEvaluate(eurDzdPrice);
                buyMetadata.eurPerUsdtAtPurchase = parseAndEvaluate(eurUsdtRate);
            }
            const { date, time, timestamp } = now();
            const shouldLinkCashToDzdClient = clientPaymentStatus === 'cash' && linkedClientDzdId !== 'none';
            const createLinkedEurConversionTx = () => {
                if (mode !== 'buy_usdt' || buyUsdtMode !== 'with_eur' || eurSpentForConversion <= 0)
                    return;
                batch.set(userDocRef.collection('usdt_txs').doc(), {
                    timestamp: timestamp - 1,
                    type: 'Retrait Manuel',
                    currency: 'EUR',
                    quantity: eurSpentForConversion,
                    date,
                    time,
                    notes: `Achat de ${formatNumber(quantity, { min: 0, max: 2 })} USDT`,
                    linkedTxId: mainTxId
                });
            };
            if (editingTx) {
                batch.update(mainTxRef, {
                    quantity, price, total: totalCost, notes: notes.trim(),
                    tags: txTags.length > 0 ? txTags : fieldValueDelete(),
                    sell: fieldValueDelete(), profit: fieldValueDelete(),
                    settlementCurrency: fieldValueDelete(),
                    sellPriceEur: fieldValueDelete(),
                    saleValueEur: fieldValueDelete(),
                    eurToDzdRateAtSale: fieldValueDelete(),
                    purchaseAmountEur: fieldValueDelete(),
                    eurToDzdRateAtPurchase: fieldValueDelete(),
                    eurPerUsdtAtPurchase: fieldValueDelete(),
                    currency, clientPaymentStatus: clientPaymentStatus,
                    ...buyMetadata
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
                        type: 'Règlement Reçu', notes: `Financement achat de ${formatNumber(quantity, { min: 0, max: 2 })} ${currency}`,
                        linkedTxId: editingTx.id,
                        linkRole: 'primary',
                        paymentMethod: paymentMethodByStatus[clientPaymentStatus],
                        affectsBalance: affectsClientBalance(clientPaymentStatus)
                    });
                }
                if (shouldLinkCashToDzdClient) {
                    batch.set(userDocRef.collection('dzd_client_txs').doc(), {
                        clientId: linkedClientDzdId, timestamp: timestamp + 1, date, time, montant: totalCost,
                        type: 'Ajustement Solde', notes: `Avance DZD liee a achat de ${formatNumber(quantity, { min: 0, max: 2 })} ${currency}`,
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
                        notes: `Achat ${formatNumber(quantity, { min: 0, max: 2 })} ${currency}`, linkedTxId: editingTx.id
                    });
                }
                setAlert('✅ Transaction mise à jour.');
            }
            else {
                batch.set(mainTxRef, {
                    timestamp, type: 'buy', quantity, price, total: totalCost,
                    date, time, notes: notes.trim(),
                    ...(txTags.length > 0 ? { tags: txTags } : {}),
                    currency, clientPaymentStatus: clientPaymentStatus,
                    ...buyMetadata
                });
                createLinkedEurConversionTx();
                if (buyUsdtMode !== 'with_eur' && clientPaymentStatus !== 'credit' && !shouldLinkCashToDzdClient) {
                    const source = clientPaymentStatus === 'baridi' ? 'BaridiMob' : 'Caisse';
                    batch.set(userDocRef.collection('treasury_txs').doc(), {
                        timestamp, date, time, type: 'Retrait', source, amount: totalCost,
                        notes: `Achat ${formatNumber(quantity, { min: 0, max: 2 })} ${currency}`, linkedTxId: mainTxRef.id
                    });
                }
                if (linkedClientId !== 'none') {
                    batch.set(userDocRef.collection('dzd_client_txs').doc(), {
                        clientId: linkedClientId, timestamp, date, time, montant: totalCost,
                        type: 'Règlement Reçu', notes: `Financement achat de ${formatNumber(quantity, { min: 0, max: 2 })} ${currency}`,
                        linkedTxId: mainTxRef.id,
                        linkRole: 'primary',
                        paymentMethod: paymentMethodByStatus[clientPaymentStatus],
                        affectsBalance: affectsClientBalance(clientPaymentStatus)
                    });
                }
                if (shouldLinkCashToDzdClient) {
                    batch.set(userDocRef.collection('dzd_client_txs').doc(), {
                        clientId: linkedClientDzdId, timestamp: timestamp + 1, date, time, montant: totalCost,
                        type: 'Ajustement Solde', notes: `Avance DZD liee a achat de ${formatNumber(quantity, { min: 0, max: 2 })} ${currency}`,
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
        }
        catch (e) {
            console.error(e);
            setAlert('❌ Erreur.');
        }
        finally {
            setIsSaving(false);
        }
    };
    const handleSell = async () => {
        if (!formValidation.isValid || isSaving)
            return;
        setIsSaving(true);
        try {
            const sellCurrency: PortfolioCurrency = mode === 'sell_eur' ? 'EUR' : 'USDT';
            const clientTxType = sellCurrency === 'EUR' ? 'Vente EUR' : 'Vente USDT';
            const sellAssetStats = getPortfolioAssetStats(sellCurrency);
            const isUsdtSettledInEur = sellCurrency === 'USDT' && sellSettlementCurrency === 'EUR';
            // FIX-10 (Q2 reversal): preserve up to 2 decimals (see handleBuy comment).
            const quantity = roundM(parseAndEvaluate(sellAmount));
            const inputSellPrice = parseAndEvaluate(sellPrice);
            const eurToDzdRateAtSale = parseAndEvaluate(sellEurToDzdRate);
            const avg = sellAssetStats.avgBuy;
            const totalInput = parseAndEvaluate(sellTotal);
            let saleValueEur = 0;
            let saleValueDzd = 0;
            let sell = inputSellPrice;
            if (isUsdtSettledInEur) {
                saleValueEur = isTotalManual && totalInput > 0 ? totalInput : quantity * inputSellPrice;
                saleValueDzd = saleValueEur * eurToDzdRateAtSale;
                sell = quantity > 0 ? saleValueDzd / quantity : inputSellPrice * eurToDzdRateAtSale;
            }
            else {
                saleValueDzd = isTotalManual && totalInput > 0 ? totalInput : quantity * inputSellPrice;
                sell = quantity > 0 ? saleValueDzd / quantity : inputSellPrice;
            }
            const totalRevenue = Math.round(saleValueDzd);
            const profit = Number((saleValueDzd - (avg * quantity)).toFixed(2));
            const { date, time, timestamp } = now();
            const shouldLinkSettlementToDzdClient = !isUsdtSettledInEur && (clientPaymentStatus === 'cash' || clientPaymentStatus === 'baridi') && linkedClientDzdId !== 'none';
            const batch = db.batch();
            const settlementMetadata: any = isUsdtSettledInEur
                ? {
                    settlementCurrency: 'EUR',
                    sellPriceEur: inputSellPrice,
                    saleValueEur,
                    eurToDzdRateAtSale
                }
                : {
                    settlementCurrency: 'DZD',
                    sellPriceEur: fieldValueDelete(),
                    saleValueEur: fieldValueDelete(),
                    eurToDzdRateAtSale: fieldValueDelete()
                };
            const settlementMetadataForCreate: any = isUsdtSettledInEur
                ? {
                    settlementCurrency: 'EUR',
                    sellPriceEur: inputSellPrice,
                    saleValueEur,
                    eurToDzdRateAtSale
                }
                : { settlementCurrency: 'DZD' };
            const createLinkedEurSettlementTx = (parentTxId: string) => {
                if (!isUsdtSettledInEur || saleValueEur <= 0 || eurToDzdRateAtSale <= 0)
                    return;
                batch.set(userDocRef.collection('usdt_txs').doc(), {
                    timestamp: timestamp + 1,
                    type: 'buy',
                    currency: 'EUR',
                    quantity: roundM(saleValueEur),
                    price: eurToDzdRateAtSale,
                    total: totalRevenue,
                    date,
                    time,
                    notes: `Encaissement EUR - Vente de ${formatNumber(quantity, { min: 0, max: 2 })} USDT`,
                    linkedTxId: parentTxId
                });
            };
            const clientSaleNote = isUsdtSettledInEur
                ? `Vente de ${formatNumber(quantity, { min: 0, max: 2 })} USDT @ ${inputSellPrice.toFixed(4)} EUR (${formatNumber(saleValueEur, { min: 0, max: 2 })} EUR x ${eurToDzdRateAtSale.toFixed(2)} DZD)`
                : `Vente de ${formatNumber(quantity, { min: 0, max: 2 })} ${sellCurrency} @ ${sell.toFixed(2)}`;
            const treasurySaleNote = isUsdtSettledInEur
                ? ''
                : `Vente ${formatNumber(quantity, { min: 0, max: 2 })} ${sellCurrency}`;
            if (editingTx) {
                const mainSellUpdate: any = {
                    quantity, sell, total: totalRevenue, profit, notes: notes.trim(),
                    tags: txTags.length > 0 ? txTags : fieldValueDelete(),
                    price: fieldValueDelete(),
                    purchaseFundingCurrency: fieldValueDelete(),
                    purchaseAmountEur: fieldValueDelete(),
                    eurToDzdRateAtPurchase: fieldValueDelete(),
                    eurPerUsdtAtPurchase: fieldValueDelete(),
                    currency: sellCurrency, linkedClientId, clientPaymentStatus: clientPaymentStatus,
                    ...settlementMetadata
                };
                if (shouldLinkSettlementToDzdClient) {
                    mainSellUpdate.linkedClientDzdId = linkedClientDzdId;
                }
                else {
                    mainSellUpdate.linkedClientDzdId = fieldValueDelete();
                }
                batch.update(userDocRef.collection('usdt_txs').doc(editingTx.id), mainSellUpdate);
                const qsClient = await userDocRef.collection('dzd_client_txs').where('linkedTxId', '==', editingTx.id).get();
                qsClient.forEach(d => batch.delete(d.ref));
                const qsTreasury = await userDocRef.collection('treasury_txs').where('linkedTxId', '==', editingTx.id).get();
                qsTreasury.forEach(d => batch.delete(d.ref));
                const qsLinkedUsdt = await userDocRef.collection('usdt_txs').where('linkedTxId', '==', editingTx.id).get();
                qsLinkedUsdt.forEach(d => batch.delete(d.ref));
                createLinkedEurSettlementTx(editingTx.id);
                if (linkedClientId !== 'none') {
                    batch.set(userDocRef.collection('dzd_client_txs').doc(), {
                        clientId: linkedClientId, timestamp, date, time, montant: -totalRevenue,
                        type: clientTxType, notes: clientSaleNote,
                        linkedTxId: editingTx.id,
                        linkRole: 'primary',
                        paymentMethod: isUsdtSettledInEur ? paymentMethodByStatus['cash'] : paymentMethodByStatus[clientPaymentStatus],
                        affectsBalance: isUsdtSettledInEur ? false : affectsClientBalance(clientPaymentStatus)
                    });
                }
                if (shouldLinkSettlementToDzdClient) {
                    batch.set(userDocRef.collection('dzd_client_txs').doc(), {
                        clientId: linkedClientDzdId, timestamp: timestamp + 1, date, time, montant: -totalRevenue,
                        type: 'Paiement Effectué', notes: `Paiement DZD lie a vente de ${formatNumber(quantity, { min: 0, max: 2 })} ${sellCurrency}`,
                        linkedTxId: editingTx.id,
                        linkRole: 'dzd_receiver',
                        paymentMethod: paymentMethodByStatus[clientPaymentStatus],
                        affectsBalance: true
                    });
                }
                if (!isUsdtSettledInEur && clientPaymentStatus !== 'credit' && !shouldLinkSettlementToDzdClient) {
                    const source = clientPaymentStatus === 'baridi' ? 'BaridiMob' : 'Caisse';
                    batch.set(userDocRef.collection('treasury_txs').doc(), {
                        timestamp, date, time, type: 'Ajout', source, amount: totalRevenue,
                        notes: treasurySaleNote, linkedTxId: editingTx.id
                    });
                }
                setAlert('✅ Transaction mise à jour.');
            }
            else {
                const ref = userDocRef.collection('usdt_txs').doc();
                const mainSellCreate: any = {
                    timestamp, type: 'sell', quantity, sell, total: totalRevenue, profit,
                    date, time, notes: notes.trim(), currency: sellCurrency,
                    ...(txTags.length > 0 ? { tags: txTags } : {}),
                    linkedClientId, clientPaymentStatus: clientPaymentStatus,
                    ...settlementMetadataForCreate
                };
                if (shouldLinkSettlementToDzdClient) {
                    mainSellCreate.linkedClientDzdId = linkedClientDzdId;
                }
                batch.set(ref, mainSellCreate);
                createLinkedEurSettlementTx(ref.id);
                if (!isUsdtSettledInEur && clientPaymentStatus !== 'credit' && !shouldLinkSettlementToDzdClient) {
                    const source = clientPaymentStatus === 'baridi' ? 'BaridiMob' : 'Caisse';
                    batch.set(userDocRef.collection('treasury_txs').doc(), {
                        timestamp, date, time, type: 'Ajout', source, amount: totalRevenue,
                        notes: treasurySaleNote, linkedTxId: ref.id
                    });
                }
                if (linkedClientId !== 'none') {
                    batch.set(userDocRef.collection('dzd_client_txs').doc(), {
                        clientId: linkedClientId, timestamp, date, time, montant: -totalRevenue,
                        type: clientTxType, notes: clientSaleNote,
                        linkedTxId: ref.id,
                        linkRole: 'primary',
                        paymentMethod: isUsdtSettledInEur ? paymentMethodByStatus['cash'] : paymentMethodByStatus[clientPaymentStatus],
                        affectsBalance: isUsdtSettledInEur ? false : affectsClientBalance(clientPaymentStatus)
                    });
                }
                if (shouldLinkSettlementToDzdClient) {
                    batch.set(userDocRef.collection('dzd_client_txs').doc(), {
                        clientId: linkedClientDzdId, timestamp: timestamp + 1, date, time, montant: -totalRevenue,
                        type: 'Paiement Effectué', notes: `Paiement DZD lie a vente de ${formatNumber(quantity, { min: 0, max: 2 })} ${sellCurrency}`,
                        linkedTxId: ref.id,
                        linkRole: 'dzd_receiver',
                        paymentMethod: paymentMethodByStatus[clientPaymentStatus],
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
        }
        catch (e) {
            console.error(e);
            setAlert('❌ Erreur.');
        }
        finally {
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
        if (isSaving)
            return;
        setIsSaving(true);
        try {
            const batch = db.batch();
            const stamp = now();
            if (adjustmentAsset === 'USDT' || adjustmentAsset === 'EUR') {
                const type = adjustmentTab === 'add' ? 'Ajout Manuel' : 'Retrait Manuel';
                const priceNum = parseAndEvaluate(adjustmentPrice);
                const txData: any = {
                    timestamp: stamp.timestamp, type, currency: adjustmentAsset,
                    quantity: roundM(amountNum), date: stamp.date, time: stamp.time,
                    notes: adjustmentNote || 'Ajustement Manuel'
                };
                if (priceNum > 0) {
                    txData.price = priceNum;
                    txData.total = Number((amountNum * priceNum).toFixed(2));
                }
                batch.set(userDocRef.collection('usdt_txs').doc(), txData);
            }
            else {
                const type = adjustmentTab === 'add' ? 'Ajout' : 'Retrait';
                const source = adjustmentAsset === 'DZD-Caisse' ? 'Caisse' : 'BaridiMob';
                const note = adjustmentNote || 'Ajustement Trésorerie';
                const clientTxType = adjustmentTab === 'add' ? 'Règlement Reçu' : 'Paiement Effectué';
                const clientAmount = adjustmentTab === 'add' ? amountNum : -amountNum;
                if (editingTreasuryTx) {
                    const linkedAdjustmentClientTx = clientTransactionsDzd.find((tx) => tx.linkedTxId === editingTreasuryTx.id && tx.origin === 'adjustment');
                    const linkedTimestamp = editingTreasuryTx.timestamp || stamp.timestamp;
                    const linkedDate = editingTreasuryTx.date || stamp.date;
                    const linkedTime = editingTreasuryTx.time || stamp.time;
                    batch.update(userDocRef.collection('treasury_txs').doc(editingTreasuryTx.id), {
                        type, source, amount: amountNum, notes: note
                    });
                    if (linkedAdjustmentClientTx && adjustmentClientId) {
                        batch.update(userDocRef.collection('dzd_client_txs').doc(linkedAdjustmentClientTx.id), {
                            clientId: adjustmentClientId,
                            timestamp: linkedTimestamp,
                            date: linkedDate,
                            time: linkedTime,
                            montant: clientAmount,
                            type: clientTxType,
                            notes: `${note} (${source})`
                        });
                    }
                    else if (linkedAdjustmentClientTx) {
                        batch.delete(userDocRef.collection('dzd_client_txs').doc(linkedAdjustmentClientTx.id));
                    }
                    else if (adjustmentClientId) {
                        batch.set(userDocRef.collection('dzd_client_txs').doc(), {
                            clientId: adjustmentClientId, timestamp: linkedTimestamp,
                            date: linkedDate, time: linkedTime, montant: clientAmount,
                            type: clientTxType, notes: `${note} (${source})`,
                            linkedTxId: editingTreasuryTx.id, origin: 'adjustment'
                        });
                    }
                }
                else {
                    const treasuryTxRef = userDocRef.collection('treasury_txs').doc();
                    batch.set(treasuryTxRef, { timestamp: stamp.timestamp, date: stamp.date, time: stamp.time, type, source, amount: amountNum, notes: note });
                    if (adjustmentClientId) {
                        const client = clientsDzd.find(c => c.id === adjustmentClientId);
                        if (client) {
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
        }
        catch (e) {
            console.error(e);
            setAlert('❌ Erreur.');
        }
        finally {
            setIsSaving(false);
        }
    };
    const handleDeleteTx = async (txId: string, type: 'usdt_tx' | 'client_tx' | 'treasury_tx' | 'asset_tx') => {
        setIsSaving(true);
        try {
            const result = await applyTransactionDelete(txId, type, userDocRef);
            if (result.success)
                setAlert('✅ Supprimé.');
            else
                setAlert(`❌ ${result.error || 'Erreur.'}`);
        }
        catch (e) {
            console.error(e);
            setAlert('❌ Erreur.');
        }
        finally {
            setIsSaving(false);
        }
    };
    const openAdjustmentModal = (type: 'add' | 'subtract' = 'add', txToEdit: TreasuryTx | null = null) => {
        setAdjustmentTab(type);
        setEditingTreasuryTx(txToEdit);
        setAdjustmentPrice('');
        if (txToEdit) {
            const linkedAdjustmentClientTx = clientTransactionsDzd.find((tx) => tx.linkedTxId === txToEdit.id && tx.origin === 'adjustment');
            setAdjustmentAmount(txToEdit.amount.toString());
            setAdjustmentAsset(txToEdit.source === 'Caisse' ? 'DZD-Caisse' : 'DZD-Baridi');
            setAdjustmentNote(txToEdit.notes || '');
            setAdjustmentClientId(linkedAdjustmentClientTx?.clientId || '');
        }
        else {
            setAdjustmentAmount('');
            setAdjustmentNote('');
            setAdjustmentAsset('DZD-Caisse');
            setAdjustmentClientId('');
        }
        setIsAdjustmentModalOpen(true);
    };
    const openDeliveryExpenseModal = () => {
        const today = new Date();
        const isoToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        setDeliveryExpenseAmount('');
        setDeliveryExpenseMethod('Caisse');
        setDeliveryExpenseDate(isoToday);
        setDeliveryExpenseNote('');
        setIsDeliveryExpenseModalOpen(true);
    };
    const closeDeliveryExpenseModal = () => {
        setIsDeliveryExpenseModalOpen(false);
    };
    const handleSaveDeliveryExpense = async () => {
        const amountNum = parseAndEvaluate(deliveryExpenseAmount);
        if (isNaN(amountNum) || amountNum <= 0) {
            setAlert('⚠️ Montant invalide.');
            return;
        }
        const epsilon = 0.005;
        const availableBalance = deliveryExpenseMethod === 'Caisse' ? treasuryStats.caisse : treasuryStats.baridi;
        if (amountNum > availableBalance + epsilon) {
            setAlert(deliveryExpenseMethod === 'Caisse' ? '⚠️ Solde Caisse insuffisant.' : '⚠️ Solde BaridiMob insuffisant.');
            return;
        }
        if (isSaving)
            return;
        setIsSaving(true);
        try {
            let timestamp = Date.now();
            let dateStr = '';
            let timeStr = '';
            if (deliveryExpenseDate) {
                const [y, m, d] = deliveryExpenseDate.split('-').map(Number);
                if (y && m && d) {
                    const picked = new Date();
                    const isToday = picked.getFullYear() === y &&
                        picked.getMonth() + 1 === m &&
                        picked.getDate() === d;
                    if (isToday) {
                        const nowStamp = now();
                        timestamp = nowStamp.timestamp;
                        dateStr = nowStamp.date;
                        timeStr = nowStamp.time;
                    }
                    else {
                        const customDate = new Date(y, m - 1, d, 12, 0, 0);
                        timestamp = customDate.getTime();
                        dateStr = customDate.toLocaleDateString('fr-FR');
                        timeStr = customDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                    }
                }
            }
            if (!dateStr) {
                const nowStamp = now();
                timestamp = nowStamp.timestamp;
                dateStr = nowStamp.date;
                timeStr = nowStamp.time;
            }
            await userDocRef.collection('treasury_txs').add({
                timestamp,
                date: dateStr,
                time: timeStr,
                type: 'Retrait',
                source: deliveryExpenseMethod,
                amount: amountNum,
                notes: deliveryExpenseNote.trim() || 'Frais de livraison',
                origin: 'delivery_expense'
            });
            setAlert('✅ Frais de livraison enregistrés.');
            setIsDeliveryExpenseModalOpen(false);
        }
        catch (e) {
            console.error(e);
            setAlert('❌ Erreur.');
        }
        finally {
            setIsSaving(false);
        }
    };
    const [txToDelete, setTxToDelete] = useState<Tx | TreasuryTx | null>(null);
    // Transfer State
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [transferAmount, setTransferAmount] = useState('');
    const [transferFromClientId, setTransferFromClientId] = useState('');
    const [transferToClientId, setTransferToClientId] = useState('');
    const [transferNotes, setTransferNotes] = useState('');
    const [editingTransferTx, setEditingTransferTx] = useState<ClientTransactionDzd | null>(null);
    // Transfer Balance Logic
    const getClientBalance = (clientId: string): number => {
        return clientTransactionsDzd
            .filter(tx => tx.clientId === clientId && tx.affectsBalance !== false)
            .reduce((acc, tx) => acc + tx.montant, 0);
    };
    const transferFromBalance = useMemo(() => {
        if (!transferFromClientId)
            return 0;
        return getClientBalance(transferFromClientId);
    }, [transferFromClientId, clientTransactionsDzd]);
    const transferToBalance = useMemo(() => {
        if (!transferToClientId)
            return 0;
        return getClientBalance(transferToClientId);
    }, [transferToClientId, clientTransactionsDzd]);
    const findTransferCounterpart = (tx: ClientTransactionDzd) => {
        if (tx.type !== 'Transfert Sortant' && tx.type !== 'Transfert Entrant')
            return null;
        const counterpartType = tx.type === 'Transfert Sortant' ? 'Transfert Entrant' : 'Transfert Sortant';
        const counterpartAmount = -tx.montant;
        const candidates = clientTransactionsDzd.filter((candidate) => candidate.id !== tx.id
            && candidate.clientId !== tx.clientId
            && candidate.type === counterpartType
            && candidate.date === tx.date
            && candidate.time === tx.time
            && Math.abs(candidate.montant - counterpartAmount) <= 0.01
            && Math.abs(candidate.timestamp - tx.timestamp) <= 1);
        if (candidates.length === 0)
            return null;
        return [...candidates].sort((left, right) => Math.abs(left.timestamp - tx.timestamp) - Math.abs(right.timestamp - tx.timestamp))[0];
    };
    const resetTransferForm = () => {
        setEditingTransferTx(null);
        setTransferAmount('');
        setTransferFromClientId('');
        setTransferToClientId('');
        setTransferNotes('');
    };
    const closeTransferModal = () => {
        setIsTransferModalOpen(false);
        resetTransferForm();
    };
    const openTransferModal = (txToEdit: ClientTransactionDzd | null = null) => {
        if (!txToEdit) {
            resetTransferForm();
            setIsTransferModalOpen(true);
            return;
        }
        const counterpart = findTransferCounterpart(txToEdit);
        if (!counterpart) {
            setAlert('⚠️ Impossible de retrouver le transfert lié.');
            return;
        }
        const outgoingTx = txToEdit.type === 'Transfert Sortant' ? txToEdit : counterpart;
        const incomingTx = outgoingTx.id === txToEdit.id ? counterpart : txToEdit;
        setEditingTransferTx(outgoingTx);
        setTransferFromClientId(outgoingTx.clientId);
        setTransferToClientId(incomingTx.clientId);
        setTransferAmount(Math.abs(outgoingTx.montant).toString());
        setTransferNotes(outgoingTx.notes || incomingTx.notes || '');
        setIsTransferModalOpen(true);
    };
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
            setTransferAmount('');
            setTransferFromClientId('');
            setTransferToClientId('');
            setTransferNotes('');
        }
        catch (e) {
            console.error(e);
            setAlert('❌ Erreur transfert.');
        }
        finally {
            setIsSaving(false);
        }
    };
    const handleSaveTransferWithEditing = async () => {
        const amt = parseAndEvaluate(transferAmount);
        if (amt <= 0 || !transferFromClientId || !transferToClientId || transferFromClientId === transferToClientId) {
            setAlert('⚠️ Paramètres de transfert invalides.');
            return;
        }
        if (!editingTransferTx) {
            await handleSaveTransfer();
            return;
        }
        setIsSaving(true);
        try {
            const counterpart = findTransferCounterpart(editingTransferTx);
            if (!counterpart) {
                setAlert('⚠️ Impossible de retrouver le transfert lié.');
                return;
            }
            const { date, time, timestamp } = now();
            const batch = db.batch();
            const fromC = clientsDzd.find(c => c.id === transferFromClientId);
            const toC = clientsDzd.find(c => c.id === transferToClientId);
            batch.update(userDocRef.collection('dzd_client_txs').doc(editingTransferTx.id), {
                clientId: transferFromClientId,
                timestamp,
                date,
                time,
                montant: amt,
                type: 'Transfert Sortant',
                notes: transferNotes.trim() || `Transfert vers ${toC?.fullName || 'Client'}`,
                paymentMethod: 'Crédit'
            });
            batch.update(userDocRef.collection('dzd_client_txs').doc(counterpart.id), {
                clientId: transferToClientId,
                timestamp: timestamp + 1,
                date,
                time,
                montant: -amt,
                type: 'Transfert Entrant',
                notes: transferNotes.trim() || `Transfert de ${fromC?.fullName || 'Client'}`,
                paymentMethod: 'Crédit'
            });
            await batch.commit();
            setAlert('✅ Transfert mis à jour.');
            closeTransferModal();
        }
        catch (e) {
            console.error(e);
            setAlert('❌ Erreur transfert.');
        }
        finally {
            setIsSaving(false);
        }
    };
    const handleConfirmDeleteTx = async () => {
        if (!txToDelete)
            return;
        if ((txToDelete as any).currency) {
            const parentUsdtId = (txToDelete as any).linkedTxId;
            await handleDeleteTx(parentUsdtId || txToDelete.id, 'usdt_tx');
        }
        else {
            await handleDeleteTx(txToDelete.id, 'treasury_tx');
        }
        setTxToDelete(null);
    };
    return {
        isSaving, setIsSaving, mode, setMode, editingTx, setEditingTx, isTotalManual, setIsTotalManual,
        buyUsdtAmount, setBuyUsdtAmount, buyUsdtPrice, setBuyUsdtPrice, buyUsdtTotal, setBuyUsdtTotal,
        buyEurAmount, setBuyEurAmount, buyEurPrice, setBuyEurPrice, buyEurTotal, setBuyEurTotal,
        sellAmount, setSellAmount, sellPrice, setSellPrice, sellTotal, setSellTotal,
        sellSettlementCurrency, setSellSettlementCurrency, sellEurToDzdRate, setSellEurToDzdRate,
        buyUsdtMode, setBuyUsdtMode, buyEurForUsdtAmount, setBuyEurForUsdtAmount,
        eurDzdPrice, setEurDzdPrice, eurUsdtRate, setEurUsdtRate,
        linkedClientId, setLinkedClientId, linkedClientDzdId, setLinkedClientDzdId, clientPaymentStatus, setClientPaymentStatus,
        notes, setNotes, txTags, setTxTags, profitPercent, setProfitPercent,
        isAdjustmentModalOpen, setIsAdjustmentModalOpen, adjustmentTab, setAdjustmentTab,
        adjustmentAsset, setAdjustmentAsset, adjustmentAmount, setAdjustmentAmount,
        adjustmentPrice, setAdjustmentPrice, adjustmentNote, setAdjustmentNote,
        adjustmentClientId, setAdjustmentClientId, editingTreasuryTx, setEditingTreasuryTx,
        usdtFromEurCalc, formValidation, openForm, closeForm, handleBuy, handleSell,
        handleGlobalAdjustment, handleDeleteTx, openAdjustmentModal,
        isDeliveryExpenseModalOpen, setIsDeliveryExpenseModalOpen,
        deliveryExpenseAmount, setDeliveryExpenseAmount,
        deliveryExpenseMethod, setDeliveryExpenseMethod,
        deliveryExpenseDate, setDeliveryExpenseDate,
        deliveryExpenseNote, setDeliveryExpenseNote,
        openDeliveryExpenseModal, closeDeliveryExpenseModal, handleSaveDeliveryExpense,
        txToDelete, setTxToDelete, handleConfirmDeleteTx,
        isTransferModalOpen, setIsTransferModalOpen, transferAmount, setTransferAmount,
        transferFromClientId, setTransferFromClientId, transferToClientId, setTransferToClientId,
        transferNotes, setTransferNotes, editingTransferTx, openTransferModal, closeTransferModal, handleSaveTransfer: handleSaveTransferWithEditing,
        transferFromBalance, transferToBalance
    };
}
