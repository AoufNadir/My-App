import { FIXED_NOW } from '../../testing/fixedClock';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LanguageProvider, useLanguage } from '../../contexts/LanguageContext';
import type { ClientDzd, ClientTransactionDzd, TreasuryTx, Tx } from '../../types';
import { distinctScreenNumbers, screenText, showSpaces } from '../../testing/screenNumbers';
import { computePamLedger } from '../../utils/pamLedger';
import { buildPricingContext } from '../../services/smartPricingEngine';
import { computeDigitalServicePreview, computeProjectExpensePreview, type DigitalServiceSaleWallet, type FinancialWallet } from '../../utils/digitalServiceAccounting';
import { clientTxEditAmountInput, normalizeClientTxType, paymentStatusForExistingClientTx } from '../../utils/clientTxEdit';
import { selectableClients } from '../../utils/clientRegistry';
import { parseAndEvaluate } from '../../utils';
import { MainTransactionDialog } from './MainTransactionDialog';
import { MainClientOperationsDialogs } from './MainClientOperationsDialogs';
import { ClientTransferDialog, WalletTransferDialog } from './MainDialogs';
import { DeliveryExpenseModal } from '../modals/DeliveryExpenseModal';
import { DigitalServiceSaleModal } from '../modals/DigitalServiceSaleModal';
import { PersonalWithdrawalModal } from '../modals/PersonalWithdrawalModal';
import { PersonalAdvanceReconcileModal } from '../modals/PersonalAdvanceReconcileModal';
import { translations } from '../../translations';
import { KNOWN_FORM_MESSAGES, translateFormMessage } from '../../utils/formMessages';

// V2-8 redrew the operation windows: buy and sell, the two transfers, the treasury adjustment,
// the client operation, delivery costs, the digital service sale, the personal withdrawal and
// the advance settlement. Same fake data and inputs, French and Arabic, clock fixed on
// 30/09/2026 15:00: every number the previous windows (V2-7) showed is still shown, written
// the same way. The only new numbers are the totals now kept at the bottom of the window, and
// each one is the amount typed in its field or the preview's own figure.
// (What the windows save is checked against V2-7 by a separate browser run, scenario by scenario.)

const storage = new Map<string, string>();
(globalThis as { window?: unknown }).window = {
    localStorage: {
        getItem: (key: string) => (storage.has(key) ? storage.get(key)! : null),
        setItem: (key: string, value: string) => { storage.set(key, String(value)); },
        removeItem: (key: string) => { storage.delete(key); },
    },
    matchMedia: () => ({ matches: false }),
};
type Lang = 'fr' | 'ar';
type T = (key: string) => string;
function render(node: React.ReactElement, lang: Lang) {
    storage.set('app_lang', lang);
    return renderToStaticMarkup(<LanguageProvider>{node}</LanguageProvider>);
}
/** The windows that take `t` from MainApp get it here, in the reader's language. */
function WithT({ children }: { children: (t: T) => React.ReactElement }) {
    const { t } = useLanguage();
    return children(t as T);
}
const noop = () => undefined;
const fieldBase = 'bg-surface-muted border-border text-neutral-900 focus:ring-primary';
const two = (value: number) => String(value).padStart(2, '0');
const at = (year: number, month: number, day: number, hour = 12, minute = 0) => new Date(year, month - 1, day, hour, minute).getTime();
const dayOf = (ts: number) => { const d = new Date(ts); return `${two(d.getDate())}/${two(d.getMonth() + 1)}/${d.getFullYear()}`; };
const timeOf = (ts: number) => { const d = new Date(ts); return `${two(d.getHours())}:${two(d.getMinutes())}`; };

// ---- Stock: USDT and EUR bought and sold this summer ----
const trade = (id: string, type: 'buy' | 'sell', currency: 'USDT' | 'EUR', quantity: number, price: number, ts: number, extra: Partial<Tx> = {}): Tx => ({
    id, type, currency, quantity, ...(type === 'buy' ? { price } : { sell: price }), total: Math.round(quantity * price),
    date: dayOf(ts), time: timeOf(ts), timestamp: ts, ...extra,
} as Tx);
const transactions: Tx[] = [
    trade('b1', 'buy', 'USDT', 6_000, 243.5, at(2026, 8, 20, 10)),
    trade('e1', 'buy', 'EUR', 1_500, 251, at(2026, 8, 22, 11)),
    trade('s1', 'sell', 'USDT', 900, 249, at(2026, 9, 5, 14), { linkedClientId: 'c1', clientPaymentStatus: 'credit' } as Partial<Tx>),
    trade('b2', 'buy', 'USDT', 2_000, 245, at(2026, 9, 18, 9)),
    trade('s2', 'sell', 'USDT', 1_200, 250, at(2026, 9, 25, 16), { linkedClientId: 'c2', clientPaymentStatus: 'cash' } as Partial<Tx>),
    trade('s3', 'sell', 'EUR', 300, 262, at(2026, 9, 26, 12)),
];
const portfolioStats = computePamLedger(transactions, { nowMs: FIXED_NOW }).portfolioStats;
const pam = (value: number) => value.toFixed(2);

// ---- Clients: one owing money, one with an advance, one at zero, a supplier, and a deleted one ----
const clientsDzd: ClientDzd[] = [
    { id: 'c1', fullName: 'Karim Belkacem', phone: '0555 10 20 30', creditLimit: 150_000 },
    { id: 'c2', fullName: 'Nadia Ferhat', phone: '0661 40 50 60' },
    { id: 'c3', fullName: 'Amine Bouzid' },
    { id: 'c4', fullName: 'Salima Hadj', isFournisseur: true },
    { id: 'c5', fullName: 'Rachid Ouali', archived: true, isActive: false },
];
const ctx = (id: string, clientId: string, montant: number, type: ClientTransactionDzd['type'], ts: number, extra: Partial<ClientTransactionDzd> = {}): ClientTransactionDzd => ({
    id, clientId, montant, type, date: dayOf(ts), time: timeOf(ts), timestamp: ts, affectsBalance: true, ...extra,
});
const clientTransactionsDzd: ClientTransactionDzd[] = [
    ctx('k1', 'c1', -224_100, 'Vente USDT', at(2026, 9, 5, 14), { linkedTxId: 's1', linkRole: 'primary', paymentMethod: 'Crédit' }),
    ctx('k2', 'c1', 139_100, 'Règlement Reçu', at(2026, 9, 12, 10), { paymentMethod: 'Espèces' }),
    ctx('k3', 'c2', -300_000, 'Vente USDT', at(2026, 9, 25, 16), { linkedTxId: 's2', linkRole: 'primary', paymentMethod: 'Espèces', affectsBalance: false }),
    ctx('k4', 'c2', 40_000, 'Règlement Reçu', at(2026, 9, 20, 11), { paymentMethod: 'BaridiMob' }),
    ctx('k5', 'c3', 5_000, 'Ajustement Solde', at(2026, 9, 15, 9), { notes: 'Correction' }),
    ctx('k6', 'c4', -12_500, 'Solde Initial', at(2026, 6, 1, 9)),
];
const clientBalances = new Map<string, number>();
clientsDzd.forEach((client) => clientBalances.set(client.id, 0));
clientTransactionsDzd.forEach((tx) => { if (tx.affectsBalance !== false) clientBalances.set(tx.clientId, (clientBalances.get(tx.clientId) || 0) + tx.montant); });
const getClientFullName = (client: ClientDzd) => client.fullName || client.nom || '';
const treasuryStats = { caisse: 1_250_000, baridi: 480_000 };
const treasuryCards = [{ id: 'card-1', name: 'Carte Visa prépayée', value: 375_000 }];

// ---- Smart pricing, as MainApp builds it ----
const plan = { schemaVersion: 1 as const, monthKey: '2026-09', revision: 1, monthlyGoal: 120_000, minimumGoal: 80_000, expectedMonthlyVolume: { USDT: 60_000 } };
const smartPricingByCurrency = {
    USDT: buildPricingContext({ transactions, clients: clientsDzd, clientTransactions: clientTransactionsDzd, currency: 'USDT', pam: portfolioStats.usdt.avgBuy, available: portfolioStats.usdt.available, plan, mtdProfit: 112_000 }),
    EUR: buildPricingContext({ transactions, clients: clientsDzd, clientTransactions: clientTransactionsDzd, currency: 'EUR', pam: portfolioStats.eur.avgBuy, available: portfolioStats.eur.available, plan: { ...plan, monthlyGoal: 0, minimumGoal: 0 }, mtdProfit: 3_300 }),
};
const rates = { usdtPma: Number(portfolioStats.usdt.avgBuy || 0), eurPma: Number(portfolioStats.eur.avgBuy || 0) };

// ---- Buy / sell window: the hook's state for each case, and its save check ----
type Validation = { isValid: boolean; errors: Record<string, string> };
const valid: Validation = { isValid: true, errors: {} };
const invalid = (errors: Record<string, string>): Validation => ({ isValid: false, errors });
function transactionWindow(lang: Lang, state: Record<string, unknown>) {
    return render(<WithT>{(t) => <MainTransactionDialog {...{
        mode: null, editingTx: null, closeForm: noop, openForm: noop, t, fieldBase, buyUsdtMode: null, setBuyUsdtMode: noop, setEurDzdPrice: noop, portfolioStats,
        buyUsdtAmount: '', setBuyUsdtAmount: noop, isTotalManual: false, buyUsdtPrice: '', setBuyUsdtPrice: noop, buyUsdtTotal: '', setBuyUsdtTotal: noop, setIsTotalManual: noop,
        formValidation: valid, linkedClientId: 'none', setLinkedClientId: noop, linkedClientDzdId: 'none', setLinkedClientDzdId: noop, openClientModal: noop, clientsDzd,
        clientPaymentStatus: 'cash', setClientPaymentStatus: noop, creditDueDate: '', setCreditDueDate: noop, pendingCreditRisk: null, confirmCreditRisk: noop, cancelCreditRisk: noop,
        notes: '', setNotes: noop, txTags: [], setTxTags: noop, buyEurForUsdtAmount: '', setBuyEurForUsdtAmount: noop, eurDzdPrice: '', eurUsdtRate: '', setEurUsdtRate: noop,
        sellAmount: '', setSellAmount: noop, sellPrice: '', setSellPrice: noop, sellTotal: '', setSellTotal: noop, sellSettlementCurrency: 'DZD', setSellSettlementCurrency: noop,
        sellEurToDzdRate: '', setSellEurToDzdRate: noop, profitPercent: '', setProfitPercent: noop, buyEurAmount: '', setBuyEurAmount: noop, buyEurPrice: '', setBuyEurPrice: noop,
        buyEurTotal: '', setBuyEurTotal: noop, clientBalances, handleBuy: noop, handleSell: noop, isSaving: false, buyRestriction: 'free', setBuyRestriction: noop,
        realPurchaseTime: '', setRealPurchaseTime: noop, smartPricingByCurrency, smartQuoteRef: { current: null },
        ...state,
    }}/>}</WithT>, lang);
}
const buyWithDzd = { mode: 'buy_usdt', buyUsdtMode: 'with_dzd', buyUsdtAmount: '1000.00', buyUsdtPrice: '246.5', buyUsdtTotal: '246500', linkedClientId: 'c2' };
const buyEur = { mode: 'buy_eur', buyEurAmount: '500', buyEurPrice: '252', buyEurTotal: '126000', linkedClientId: 'c1' };
const eurSale: Tx = { ...trade('s4', 'sell', 'USDT', 800, 0, at(2026, 9, 27, 11)), settlementCurrency: 'EUR', sellPriceEur: 1.15, saleValueEur: 920, eurToDzdRateAtSale: 251, total: 0, sell: 0 } as Tx;

// ---- Client operation and treasury adjustment, wired like MainAppDialogs ----
function clientOperations(lang: Lang, state: Record<string, unknown>) {
    return render(<WithT>{(t) => <MainClientOperationsDialogs {...{
        isClientTxModalOpen: false, setIsClientTxModalOpen: noop, editingClientTx: null, t, clientTxType: 'Règlement Reçu', setClientTxType: noop, fieldBase,
        clientTxUsdtAmount: '', setClientTxUsdtAmount: noop, clientTxSellPrice: '', setClientTxSellPrice: noop, clientTxEurAmount: '', setClientTxEurAmount: noop,
        clientTxEurPrice: '', setClientTxEurPrice: noop, clientTxAmount: '', setClientTxAmount: noop, clientTxNotes: '', setClientTxNotes: noop,
        clientTxPaymentStatus: 'cash', setClientTxPaymentStatus: noop, clientTxLinkedClientId: 'none', clientTxReceiverClientId: 'none', setClientTxReceiverClientId: noop,
        handleSaveClientTx: noop, selectedClientId: 'c1', isAdjustmentModalOpen: false, setIsAdjustmentModalOpen: noop, editingTreasuryTx: null,
        adjustmentTab: 'add', setAdjustmentTab: noop, adjustmentAsset: 'DZD-Caisse', setAdjustmentAsset: noop, adjustmentAmount: '', setAdjustmentAmount: noop,
        adjustmentClientId: 'none', clientBalances, portfolioStats, treasuryStats, clientsDzd, getClientFullName, setAdjustmentClientId: noop, adjustmentPrice: '',
        setAdjustmentPrice: noop, adjustmentNote: '', setAdjustmentNote: noop, treasuryCards, handleGlobalAdjustment: noop, isSaving: false,
        ...state,
    }}/>}</WithT>, lang);
}
const editedBalanceRow = clientTransactionsDzd[4];

// ---- The two transfers, with MainApp's labels ----
function walletTransfer(lang: Lang, state: Record<string, unknown>) {
    return render(<WithT>{(t) => <WalletTransferDialog {...({
        isOpen: true, onClose: noop, amount: '', setAmount: noop, source: 'Caisse', setSource: noop, destination: 'BaridiMob', setDestination: noop,
        notes: '', setNotes: noop, onMax: noop, onSwap: noop, onConfirm: noop, isInvalid: true, isSaving: false,
        caisseBalance: treasuryStats.caisse, baridiBalance: treasuryStats.baridi,
        amountLabel: t('transactions.amount'), fromLabel: t('transactions.from'), toLabel: t('transactions.to'), sourceLabel: t('common.source'),
        destinationLabel: t('common.destination'), notesOptionalLabel: t('common.notesOptional'), processingText: t('common.processing'), confirmText: t('transactions.confirmTransfer'),
        title: t('transactions.internalTransferShort'), subtitle: `${t('transactions.cash')} ↔ ${t('transactions.baridi')}`, sameAccountErrorText: t('formErrors.sameWallet'),
        ...state,
    } as Parameters<typeof WalletTransferDialog>[0])}/>}</WithT>, lang);
}
function clientTransfer(lang: Lang, fromClientId: string, toClientId: string, amount: string, notes = '') {
    return render(<WithT>{(t) => <ClientTransferDialog {...({
        isOpen: true, onClose: noop, fromClientId, setFromClientId: noop, toClientId, setToClientId: noop, amount, setAmount: noop, notes, setNotes: noop,
        onSave: noop, isSaving: false, clients: selectableClients(clientsDzd, [fromClientId, toClientId]).map((client) => ({ id: client.id, label: getClientFullName(client) })),
        fromBalance: clientBalances.get(fromClientId) || 0, toBalance: clientBalances.get(toClientId) || 0, onMaxFrom: noop, maxDisabled: false,
        date: '2026-09-30', setDate: noop, time: '15:00', setTime: noop, dateLabel: t('common.date'), timeLabel: t('common.time'),
        title: t('transactions.clientTransfer'), infoText: t('transactions.transferDebtCredit'), fromLabel: t('transactions.from'), toLabel: t('transactions.to'),
        amountLabel: t('transactions.amount'), notesLabel: t('common.notesOptional'), filterClientsLabel: t('transactions.filterClients'), balanceLabel: t('common.balance'),
        dinarLabel: t('common.dinar'), confirmLabel: t('transactions.confirmTransfer'),
    } as Parameters<typeof ClientTransferDialog>[0])}/>}</WithT>, lang);
}

// ---- Delivery cost, digital service sale, personal withdrawal and advance settlement ----
function expensePreview(wallet: FinancialWallet, amount: string) {
    const value = parseAndEvaluate(amount);
    return Number.isFinite(value) ? computeProjectExpensePreview({ wallet, amount: value, rates }) : null;
}
function delivery(lang: Lang, method: FinancialWallet, amount: string, note: string) {
    return render(<DeliveryExpenseModal isOpen onClose={noop} isSaving={false} amount={amount} setAmount={noop} method={method} setMethod={noop} date="2026-09-30" setDate={noop} note={note} setNote={noop} treasuryStats={treasuryStats} portfolioStats={portfolioStats} preview={expensePreview(method, amount)} onSave={noop}/>, lang);
}
function service(lang: Lang, fields: { clientId: string; name: string; purchaseWallet: FinancialWallet; purchaseAmount: string; saleWallet: DigitalServiceSaleWallet; saleAmount: string; note: string }) {
    const purchase = parseAndEvaluate(fields.purchaseAmount);
    const sale = parseAndEvaluate(fields.saleAmount);
    const preview = Number.isFinite(purchase) && Number.isFinite(sale)
        ? computeDigitalServicePreview({ purchaseWallet: fields.purchaseWallet, purchaseAmount: purchase, saleWallet: fields.saleWallet, saleAmount: sale, rates })
        : null;
    return render(<DigitalServiceSaleModal isOpen onClose={noop} isSaving={false} clientId={fields.clientId} setClientId={noop} serviceName={fields.name} setServiceName={noop} purchaseWallet={fields.purchaseWallet} setPurchaseWallet={noop} purchaseAmount={fields.purchaseAmount} setPurchaseAmount={noop} saleWallet={fields.saleWallet} setSaleWallet={noop} saleAmount={fields.saleAmount} setSaleAmount={noop} date="2026-09-30" setDate={noop} note={fields.note} setNote={noop} clientsDzd={clientsDzd} treasuryStats={treasuryStats} portfolioStats={portfolioStats} preview={preview} onOpenClientModal={noop} onSave={noop}/>, lang);
}
function withdrawal(lang: Lang, mode: 'expense' | 'advance', method: FinancialWallet, amount: string, note: string) {
    return render(<PersonalWithdrawalModal isOpen onClose={noop} isSaving={false} amount={amount} setAmount={noop} method={method} setMethod={noop} date="" setDate={noop} note={note} setNote={noop} mode={mode} setMode={noop} treasuryStats={treasuryStats} portfolioStats={portfolioStats} preview={expensePreview(method, amount)} managerAvailableProfit={122_420} managerCapitalInvested={1_200_000} managerExists onSave={noop}/>, lang);
}
const pendingAdvance: TreasuryTx = {
    id: 'p1', type: 'Retrait', source: 'Caisse', amount: 10_000, notes: 'Avance voyage Oran', origin: 'personal_expense', advanceState: 'pending',
    date: dayOf(at(2026, 9, 29, 9)), time: '09:00', timestamp: at(2026, 9, 29, 9),
} as TreasuryTx;
function reconcile(lang: Lang, actualAmount: string) {
    return render(<PersonalAdvanceReconcileModal isOpen onClose={noop} isSaving={false} advanceTx={pendingAdvance} actualAmount={actualAmount} setActualAmount={noop} spentDescription="" setSpentDescription={noop} onSave={noop}/>, lang);
}

const SCREENS = {
    buySource: (lang: Lang) => transactionWindow(lang, { mode: 'buy_usdt' }),
    buyDzdEmpty: (lang: Lang) => transactionWindow(lang, { mode: 'buy_usdt', buyUsdtMode: 'with_dzd', formValidation: invalid({ buyUsdtAmount: 'Veuillez entrer la quantité', buyUsdtPrice: 'Veuillez entrer le prix', buyUsdtTotal: 'Montant total invalide', linkedClientId: 'Veuillez sélectionner un client' }) }),
    buyDzd: (lang: Lang) => transactionWindow(lang, buyWithDzd),
    buyDzdLocked: (lang: Lang) => transactionWindow(lang, { ...buyWithDzd, buyRestriction: 'locked_24h', realPurchaseTime: '14:30', notes: 'Achat Binance P2P' }),
    buyWithEur: (lang: Lang) => transactionWindow(lang, { mode: 'buy_usdt', buyUsdtMode: 'with_eur', eurDzdPrice: pam(portfolioStats.eur.avgBuy), buyEurForUsdtAmount: '540', eurUsdtRate: '0.92' }),
    buyEur: (lang: Lang) => transactionWindow(lang, buyEur),
    buyEurCredit: (lang: Lang) => transactionWindow(lang, { ...buyEur, clientPaymentStatus: 'credit', formValidation: invalid({ creditDueDate: "Date d'échéance requise" }) }),
    sellSource: (lang: Lang) => transactionWindow(lang, { mode: 'sell_usdt' }),
    sellEur: (lang: Lang) => transactionWindow(lang, { mode: 'sell_eur', sellAmount: '300', sellPrice: '262', sellTotal: '78600', profitPercent: (262 - portfolioStats.eur.avgBuy).toFixed(2), linkedClientId: 'c3' }),
    sellEurOver: (lang: Lang) => transactionWindow(lang, { mode: 'sell_eur', sellAmount: '1500', sellPrice: '262', sellTotal: '393000', linkedClientId: 'c3', formValidation: invalid({ sellAmount: 'Solde insuffisant' }) }),
    editSell: (lang: Lang) => transactionWindow(lang, { mode: 'sell_usdt', editingTx: transactions[2], sellAmount: '900.00', sellPrice: '249', sellTotal: '224100', profitPercent: (249 - portfolioStats.usdt.avgBuy).toFixed(2), linkedClientId: 'c1', clientPaymentStatus: 'credit' }),
    editSellForEur: (lang: Lang) => transactionWindow(lang, { mode: 'sell_usdt', editingTx: eurSale, sellAmount: '800.00', sellPrice: '1.15', sellTotal: '920', sellSettlementCurrency: 'EUR', sellEurToDzdRate: pam(portfolioStats.eur.avgBuy), linkedClientId: 'c3' }),
    walletTransfer: (lang: Lang) => walletTransfer(lang, { amount: '150000', isInvalid: false }),
    walletTransferOver: (lang: Lang) => walletTransfer(lang, { amount: '600000', source: 'BaridiMob', destination: 'Caisse' }),
    clientTransfer: (lang: Lang) => clientTransfer(lang, 'c1', 'c2', '20000'),
    clientTransferSame: (lang: Lang) => clientTransfer(lang, 'c1', 'c1', '20000'),
    clientPayment: (lang: Lang) => clientOperations(lang, { isClientTxModalOpen: true, clientTxAmount: '25000', clientTxLinkedClientId: 'c1', selectedClientId: 'c1' }),
    clientPayout: (lang: Lang) => clientOperations(lang, { isClientTxModalOpen: true, clientTxType: 'Paiement Effectué', clientTxPaymentStatus: 'baridi', clientTxAmount: '10000', clientTxLinkedClientId: 'c2', selectedClientId: 'c2' }),
    clientEditBalance: (lang: Lang) => clientOperations(lang, {
        isClientTxModalOpen: true, editingClientTx: editedBalanceRow, clientTxType: normalizeClientTxType(editedBalanceRow.type), clientTxAmount: clientTxEditAmountInput(editedBalanceRow),
        clientTxNotes: editedBalanceRow.notes, clientTxPaymentStatus: paymentStatusForExistingClientTx(editedBalanceRow.paymentMethod), selectedClientId: 'c3',
    }),
    adjustDzd: (lang: Lang) => clientOperations(lang, { isAdjustmentModalOpen: true, adjustmentAmount: '30000', adjustmentClientId: 'c4' }),
    adjustUsdt: (lang: Lang) => clientOperations(lang, { isAdjustmentModalOpen: true, adjustmentTab: 'subtract', adjustmentAsset: 'USDT', adjustmentAmount: '120', adjustmentPrice: pam(portfolioStats.usdt.avgBuy) }),
    deliveryDzd: (lang: Lang) => delivery(lang, 'Caisse', '2500', 'Livraison Bab Ezzouar'),
    deliveryUsdt: (lang: Lang) => delivery(lang, 'USDT', '15', 'Frais réseau TRC20'),
    serviceEmpty: (lang: Lang) => service(lang, { clientId: '', name: '', purchaseWallet: 'Caisse', purchaseAmount: '', saleWallet: 'Caisse', saleAmount: '', note: '' }),
    serviceSale: (lang: Lang) => service(lang, { clientId: 'c3', name: 'Abonnement Netflix 12 mois', purchaseWallet: 'USDT', purchaseAmount: '12', saleWallet: 'Caisse', saleAmount: '3900', note: 'Compte famille' }),
    withdrawalExpense: (lang: Lang) => withdrawal(lang, 'expense', 'Caisse', '150000', 'Loyer octobre'),
    withdrawalAdvance: (lang: Lang) => withdrawal(lang, 'advance', 'BaridiMob', '10000', 'Voyage Constantine'),
    withdrawalUsdt: (lang: Lang) => withdrawal(lang, 'expense', 'USDT', '50', ''),
    withdrawalOver: (lang: Lang) => withdrawal(lang, 'expense', 'BaridiMob', '500000', ''),
    reconcileEmpty: (lang: Lang) => reconcile(lang, ''),
    reconcile: (lang: Lang) => reconcile(lang, '3800'),
};

// Recording mode, run on the previous version: prints the numbers of each window.
if (process.env.SCREEN_CAPTURE) {
    const captured: Record<string, string[]> = {};
    for (const [name, renderScreen] of Object.entries(SCREENS))
        for (const lang of ['fr', 'ar'] as const)
            captured[`${name}.${lang}`] = showSpaces(distinctScreenNumbers(renderScreen(lang)));
    console.log(JSON.stringify(captured));
    process.exit(0);
}

const BEFORE: Record<keyof typeof SCREENS, string[]> = {
    buySource: ['243.92', '5⍽900,00'],
    buyDzdEmpty: ['24', '243.92', '5⍽900,00'],
    buyDzd: ['1⍽000', '24', '243.92', '5⍽900,00'],
    buyDzdLocked: ['14:30', '1⍽000', '2', '24', '243.92', '5⍽900,00'],
    buyWithEur: ['1⍽200,00', '24', '242,75', '243.92', '251', '586,96', '5⍽900,00', '6⍽486,96'],
    buyEur: ['1⍽200,00', '251.00'],
    buyEurCredit: ['1⍽200,00', '251.00'],
    sellSource: ['243.92', '5⍽900,00'],
    sellEur: ['+11.00', '+3⍽300', '+750', '1⍽200,00', '251,00', '251.00', '253', '253,50', '254', '45'],
    sellEurOver: ['+16⍽500', '+3⍽000', '1⍽200,00', '251,00', '251.00', '252,50', '253', '253,50', '45'],
    editSell: ['+4⍽572', '+5.08', '+5⍽022', '19', '243,92', '243.92', '248', '249,50', '250', '5⍽900,00', '63', '900', '−450'],
    editSellForEur: ['+35⍽784', '243.92', '251.00', '5⍽900,00', '800'],
    walletTransfer: ['1⍽100⍽000,00', '1⍽250⍽000,00', '480⍽000,00', '630⍽000,00'],
    walletTransferOver: ['-120⍽000,00', '1⍽250⍽000,00', '1⍽850⍽000,00', '480⍽000,00'],
    clientTransfer: ['-65⍽000,00', '-85⍽000,00', '20⍽000,00', '40⍽000,00'],
    clientTransferSame: ['-85⍽000,00'],
    clientPayment: ['25⍽000,00'],
    clientPayout: ['10⍽000,00'],
    clientEditBalance: ['5⍽000,00'],
    adjustDzd: ['12⍽500', '1⍽280⍽000,00', '30⍽000,00'],
    adjustUsdt: ['120,00', '243,92', '29⍽270,40', '5⍽780,00', '5⍽900'],
    deliveryDzd: ['1⍽250⍽000'],
    deliveryUsdt: ['20', '243.92', '3⍽659', '5⍽900,00'],
    serviceEmpty: ['0', '1⍽250⍽000'],
    serviceSale: ['+973', '2⍽927', '3⍽900', '5⍽900,00'],
    withdrawalExpense: ['122⍽420', '1⍽250⍽000', '27⍽580'],
    withdrawalAdvance: ['480⍽000'],
    withdrawalUsdt: ['122⍽420', '12⍽196', '243.92', '5⍽900,00'],
    withdrawalOver: ['377⍽580', '480⍽000'],
    reconcileEmpty: ['09:00', '10⍽000', '29/09/2026'],
    reconcile: ['+3⍽800', '09:00', '10⍽000', '29/09/2026', '6⍽200'],
};
// The totals now kept at the bottom of the window, the only numbers V2-7 did not show: each one
// is the amount typed in its field (the hint of an empty advance settlement says "0 if all was spent").
const NEW_AT_BOTTOM: Partial<Record<keyof typeof SCREENS, string[]>> = {
    buyDzd: ['246⍽500'], buyDzdLocked: ['246⍽500'], buyEur: ['126⍽000'], buyEurCredit: ['126⍽000'],
    sellEur: ['78⍽600'], sellEurOver: ['393⍽000'], editSell: ['224⍽100'], editSellForEur: ['920,00'],
    walletTransfer: ['150⍽000,00'], walletTransferOver: ['600⍽000,00'], clientTransferSame: ['20⍽000,00'],
    deliveryDzd: ['2⍽500'], deliveryUsdt: ['15,00'],
    withdrawalExpense: ['150⍽000'], withdrawalAdvance: ['10⍽000'], withdrawalUsdt: ['50,00'], withdrawalOver: ['500⍽000'],
    reconcileEmpty: ['0'], reconcile: ['3⍽800'],
};
// The sale's estimated profit was already shown just above the buttons: it stays there, in the bar.
const KEPT_AT_BOTTOM: Partial<Record<keyof typeof SCREENS, string[]>> = {
    sellEur: ['+3⍽300'], sellEurOver: ['+16⍽500'], editSell: ['+4⍽572'], editSellForEur: ['+35⍽784'],
};
/** The window above its bottom bar, and the bar itself (its totals, why Confirm is off, its buttons). */
function splitAtBar(html: string): [string, string] {
    const at = html.indexOf('sticky bottom-0');
    if (at < 0)
        return [html, ''];
    assert.equal(html.indexOf('sticky bottom-0', at + 1), -1, 'one bar at the bottom');
    const tag = html.lastIndexOf('<', at);
    return [html.slice(0, tag), html.slice(tag)];
}
const changed: string[] = [];
for (const [name, renderScreen] of Object.entries(SCREENS) as Array<[keyof typeof SCREENS, (lang: Lang) => string]>)
    for (const lang of ['fr', 'ar'] as const) {
        const [body, bar] = splitAtBar(renderScreen(lang));
        const inBody = showSpaces(distinctScreenNumbers(body));
        const inBar = showSpaces(distinctScreenNumbers(bar));
        const newAtBottom = NEW_AT_BOTTOM[name] ?? [];
        const keptAtBottom = KEPT_AT_BOTTOM[name] ?? [];
        // The window itself shows exactly the numbers it showed before; the bar repeats some of
        // them and adds only the typed totals listed above.
        const lost = BEFORE[name].filter((token) => !(keptAtBottom.includes(token) ? inBar : inBody).includes(token));
        const added = [
            ...inBody.filter((token) => !BEFORE[name].includes(token)),
            ...inBar.filter((token) => !BEFORE[name].includes(token) && !newAtBottom.includes(token)),
        ];
        const missingTotals = newAtBottom.filter((token) => !inBar.includes(token));
        if (lost.length || added.length || missingTotals.length)
            changed.push(`${name}.${lang}: no longer shown [${lost.join(' ')}], new [${added.join(' ')}], total missing at the bottom [${missingTotals.join(' ')}]`);
    }
assert.deepEqual(changed, [], 'every window shows the same numbers, written the same way');

// What the bar says, in the reader's language: each total next to its label, then why Confirm is
// off, in red when a typed value is wrong and in grey when a field is still empty.
const lookup = (lang: Lang, key: string): unknown => key.split('.').reduce<any>((node, part) => node?.[part], translations[lang]);
const label = (lang: Lang, key: string) => {
    const text = lookup(lang, key);
    assert.equal(typeof text, 'string', `${lang}: ${key}`);
    return text as string;
};
const textOf = (html: string) => screenText(html).replace(/\s*\|(?:\s*\|)*\s*/g, '|').replace(/^\||\|$/g, '');
const n = (shown: string) => shown.replace(/(\d) (?=\d)/g, '$1 ');
type Bar = { stats?: Array<[string, string]>; reason?: string; tone?: 'fix' | 'missing' };
function assertBar(screen: keyof typeof SCREENS, lang: Lang, { stats = [], reason, tone }: Bar) {
    const [, bar] = splitAtBar(SCREENS[screen](lang));
    assert.ok(bar, `${screen}.${lang}: a bar at the bottom`);
    const beforeButtons = bar.slice(0, bar.indexOf('<button'));
    const expected = [...stats.flatMap(([key, value]) => [label(lang, key), n(value)]), ...(reason ? [reason] : [])].join('|');
    assert.equal(textOf(beforeButtons), expected, `${screen}.${lang}: the bar at the bottom`);
    if (reason) {
        const reasonClass = beforeButtons.match(/role="status" class="([^"]*)"/)?.[1] ?? '';
        assert.ok(reasonClass.includes(tone === 'fix' ? 'text-financial-loss' : 'text-neutral-600'), `${screen}.${lang}: reason shown as "${tone}"`);
    }
}
const total = (value: string): [string, string] => ['transactions.totalAmount', `${value} DZD`];
const profit = (value: string): [string, string] => ['transactions.estimatedProfit', `${value} DZD`];
for (const lang of ['fr', 'ar'] as const) {
    // Choosing how to buy or sell comes first, without a bar.
    assert.equal(splitAtBar(SCREENS.buySource(lang))[1], '', `buySource.${lang}: no bar`);
    assert.equal(splitAtBar(SCREENS.sellSource(lang))[1], '', `sellSource.${lang}: no bar`);
    // Buy and sell: the Total field, and the sale's estimated profit as in the summary above.
    assertBar('buyDzdEmpty', lang, { reason: label(lang, 'formErrors.quantityMissing'), tone: 'missing' });
    assertBar('buyDzd', lang, { stats: [total('246 500')] });
    assertBar('buyDzdLocked', lang, { stats: [total('246 500')] });
    assertBar('buyWithEur', lang, {});
    assertBar('buyEur', lang, { stats: [total('126 000')] });
    assertBar('buyEurCredit', lang, { stats: [total('126 000')], reason: label(lang, 'formErrors.dueDateRequired'), tone: 'missing' });
    assertBar('sellEur', lang, { stats: [total('78 600'), profit('+3 300')] });
    assertBar('sellEurOver', lang, { stats: [total('393 000'), profit('+16 500')], reason: label(lang, 'formErrors.insufficientBalance'), tone: 'fix' });
    assertBar('editSell', lang, { stats: [total('224 100'), profit('+4 572')] });
    assertBar('editSellForEur', lang, { stats: [['transactions.eurReceived', '920,00 EUR'], profit('+35 784')] });
    // Transfers: the amount typed.
    assertBar('walletTransfer', lang, { stats: [['transactions.amount', '150 000,00 DZD']] });
    assertBar('walletTransferOver', lang, { stats: [['transactions.amount', '600 000,00 DZD']], reason: label(lang, 'formErrors.insufficientBalance'), tone: 'fix' });
    assertBar('clientTransfer', lang, { stats: [['transactions.amount', '20 000,00 DZD']] });
    assertBar('clientTransferSame', lang, { stats: [['transactions.amount', '20 000,00 DZD']], reason: label(lang, 'formErrors.sameClient'), tone: 'fix' });
    // Client operation and adjustment: the same figures as their summary.
    assertBar('clientPayment', lang, { stats: [['transactions.clientBalanceImpact', '25 000,00 DZD']] });
    assertBar('clientPayout', lang, { stats: [['transactions.clientBalanceImpact', '10 000,00 DZD']] });
    assertBar('clientEditBalance', lang, { stats: [['transactions.clientBalanceImpact', '5 000,00 DZD']] });
    assertBar('adjustDzd', lang, { stats: [['transactions.amount', '30 000,00 DZD']] });
    assertBar('adjustUsdt', lang, { stats: [['transactions.quantity', '120,00 USDT'], ['transactions.equivalentDzd', '29 270,40 DZD']] });
    // Delivery cost, service sale, personal withdrawal: the amount, and its DZD value from the preview.
    assertBar('deliveryDzd', lang, { stats: [['delivery.amount', '2 500 DZD']] });
    assertBar('deliveryUsdt', lang, { stats: [['delivery.amount', '15,00 USDT'], ['delivery.valueDzd', '3 659 DZD']] });
    assertBar('serviceEmpty', lang, {});
    assertBar('serviceSale', lang, { stats: [['digitalServices.saleValueDzd', '3 900 DZD'], ['digitalServices.margin', '+973 DZD']] });
    assertBar('withdrawalExpense', lang, { stats: [['personalWithdrawal.amount', '150 000 DZD']] });
    assertBar('withdrawalAdvance', lang, { stats: [['personalWithdrawal.amount', '10 000 DZD']] });
    assertBar('withdrawalUsdt', lang, { stats: [['personalWithdrawal.amount', '50,00 USDT'], ['delivery.valueDzd', '12 196 DZD']] });
    assertBar('withdrawalOver', lang, {
        stats: [['personalWithdrawal.amount', '500 000 DZD']],
        reason: label(lang, 'personalWithdrawal.sourceInsufficient').replace('{source}', label(lang, 'transactions.baridi')), tone: 'fix',
    });
    // Advance settlement: what goes back to the wallet and what stays spent, as in the result above.
    assertBar('reconcileEmpty', lang, { reason: label(lang, 'personalAdvance.enterReturnedAmount'), tone: 'missing' });
    assertBar('reconcile', lang, { stats: [['personalAdvance.returnedAmount', '3 800 DZD'], ['personalAdvance.finalExpense', '6 200 DZD']] });
}

// The save checks still write their messages in French; every one of them reads in Arabic too.
for (const message of KNOWN_FORM_MESSAGES) {
    const arabic = translateFormMessage(message, (key) => lookup('ar', key));
    assert.ok(arabic && arabic !== message && !/[a-zé]{4}/i.test(arabic), `ar: "${message}"`);
    assert.ok(translateFormMessage(message, (key) => lookup('fr', key)), `fr: "${message}"`);
}

// V2-9, the user's choice: the two transfers, the client operation and the adjustment show a
// « Notes (optional) » field, wired to the note each window already saved (empty, the windows
// above show the same numbers as before); and buying EUR on credit asks for its due date, which
// its save check has always required, like a sale on credit.
const NOTE = 'Remis en main propre';
const esc = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
function notesField(html: string, id: string) {
    const match = html.match(new RegExp(`<label for="${id}"[^>]*>([^<]*)</label><textarea id="${id}"[^>]*placeholder="([^"]*)"[^>]*>([^<]*)</textarea>`));
    return match ? { label: match[1], placeholder: match[2], value: match[3] } : null;
}
const learnedDelay = { ...smartPricingByCurrency, EUR: { ...smartPricingByCurrency.EUR, debtByClientId: new Map([['c1', { ...(smartPricingByCurrency.EUR.debtByClientId?.get('c1') ?? {}), avgSettleDays: 12, settledLotCount: 2 }]]) } };
for (const lang of ['fr', 'ar'] as const) {
    const windows: Array<[string, string, string]> = [
        ['wallet transfer', walletTransfer(lang, { amount: '150000', isInvalid: false, notes: NOTE }), 'wallet_transfer_notes'],
        ['client transfer', clientTransfer(lang, 'c1', 'c2', '20000', NOTE), 'client_transfer_notes'],
        ['client operation', clientOperations(lang, { isClientTxModalOpen: true, clientTxAmount: '25000', clientTxLinkedClientId: 'c1', clientTxNotes: NOTE }), 'client_tx_notes'],
        ['adjustment', clientOperations(lang, { isAdjustmentModalOpen: true, adjustmentAmount: '30000', adjustmentClientId: 'c4', adjustmentNote: NOTE }), 'adjustment_notes'],
    ];
    for (const [name, html, id] of windows) {
        assert.deepEqual(notesField(html, id), { label: esc(label(lang, 'common.notesOptional')), placeholder: esc(label(lang, 'transactions.notesPlaceholder')), value: NOTE }, `${lang} ${name}: the note being saved is shown, under « Notes (optional) »`);
        assert.equal(html.split('<textarea').length - 1, 1, `${lang} ${name}: one notes field`);
    }
    // Empty in each window of the number check above.
    for (const screen of ['walletTransfer', 'clientTransfer', 'clientPayment', 'adjustDzd'] as const)
        assert.equal(notesField(SCREENS[screen](lang), { walletTransfer: 'wallet_transfer_notes', clientTransfer: 'client_transfer_notes', clientPayment: 'client_tx_notes', adjustDzd: 'adjustment_notes' }[screen])?.value, '', `${lang} ${screen}`);

    // Buying EUR: paid in cash, no due date; on credit, its date field, with the save check's
    // message under it in the reader's language; the date typed is shown back.
    assert.ok(!SCREENS.buyEur(lang).includes('credit_due_date'), `${lang}: a cash purchase has no due date`);
    const onCredit = SCREENS.buyEurCredit(lang);
    const dueDateInput = (html: string) => html.match(/<label for="credit_due_date"[^>]*>([^<]*)<\/label><input id="credit_due_date" type="date" min="([\d-]+)"[^>]*value="([^"]*)"\/>/);
    assert.deepEqual(dueDateInput(onCredit)?.slice(1), [esc(label(lang, 'smartPricing.dueDate')), '2026-10-01', ''], `${lang}: buying EUR on credit asks for its due date, from tomorrow on`);
    assert.ok(onCredit.includes(`<span role="alert" class="mt-1 block text-xs font-medium text-financial-loss">${esc(label(lang, 'formErrors.dueDateRequired'))}</span>`), `${lang}: what is missing, under the field`);
    assert.equal(dueDateInput(transactionWindow(lang, { ...buyEur, clientPaymentStatus: 'credit', creditDueDate: '2026-10-15' }))?.[3], '2026-10-15', `${lang}: the date typed`);
    // The client's average repayment delay is about a sale (the client paying us): shown when
    // selling to Karim on credit, not when buying from him.
    const hint = label(lang, 'smartPricing.avgSettleHint').replace('{days}', '12');
    assert.ok(transactionWindow(lang, { mode: 'sell_eur', sellAmount: '300', sellPrice: '262', sellTotal: '78600', linkedClientId: 'c1', clientPaymentStatus: 'credit', creditDueDate: '2026-10-12', smartPricingByCurrency: learnedDelay }).includes(hint), `${lang}: selling on credit shows the client's delay`);
    assert.ok(!transactionWindow(lang, { ...buyEur, clientPaymentStatus: 'credit', creditDueDate: '2026-10-15', smartPricingByCurrency: learnedDelay }).includes(hint), `${lang}: buying on credit does not`);
}

assert.ok(FIXED_NOW > 0);
console.log('operationWindows.test: the buy, sell, transfer and expense windows show the same numbers as before, in French and Arabic, with their totals at the bottom; four windows have their notes field and buying EUR on credit its due date');
