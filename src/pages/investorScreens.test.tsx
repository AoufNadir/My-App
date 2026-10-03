import { FIXED_NOW } from '../testing/fixedClock';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LanguageProvider } from '../contexts/LanguageContext';
import type { InvestorTransaction, ManualAsset, ManualAssetClient, ManualAssetTransaction, TreasuryTx } from '../types';
import type { DerivedInvestor, InvestorEconomicsResult, ManagerProfitBreakdown } from '../hooks/useInvestorEconomics';
import type { CapitalSnapshot, InvestorBreakdown } from '../utils/capitalSnapshot';
import { distinctScreenNumbers, screenText, showSpaces } from '../testing/screenNumbers';
import { InvestorsPage } from './InvestorsPage';
import { InvestorDetailsPage } from './InvestorDetailsPage';
import { InvestorDashboardPage } from './InvestorDashboardPage';
import { ServicesPage } from './ServicesPage';
import { ManualAssetPage } from './ManualAssetPage';
import { ManualClientPage } from './ManualClientPage';
import { PersonalExpensesPage } from './PersonalExpensesPage';
import { InvestorDetailsContent } from '../components/investor-details/InvestorDetailsContent';
import { ProfitDistributionSheet } from '../components/investors/ProfitDistributionSheet';
import { CommissionEditorModal } from '../components/investors/CommissionEditorModal';
import { ManualAssetReportsSection } from '../components/manual-asset/ManualAssetReportsSection';
import { ManualClientTransactionDialog } from '../components/manual-client/ManualClientTransactionDialog';
import { calculateWithdrawableProfit } from '../utils/profitDistribution';
import { translations } from '../translations';

// V2-7 redrew Investisseurs, Services, Mes dépenses and the investor portal. Same fake data,
// French and Arabic, clock fixed on 30/09/2026 15:00: every number of the previous screens
// (V2-6) is still shown, written the same way, and no new one appears.

const storage = new Map<string, string>();
(globalThis as { window?: unknown }).window = {
    localStorage: {
        getItem: (key: string) => (storage.has(key) ? storage.get(key)! : null),
        setItem: (key: string, value: string) => { storage.set(key, String(value)); },
        removeItem: (key: string) => { storage.delete(key); },
    },
    matchMedia: () => ({ matches: false }),
};
// Outside a browser the portal chart cannot measure its box, and recharts warns on every render.
const warn = console.warn;
console.warn = (...args: unknown[]) => { if (!String(args[0]).includes('of chart should be greater than 0')) warn(...args); };
type Lang = 'fr' | 'ar';
function render(node: React.ReactElement, lang: Lang) {
    storage.set('app_lang', lang);
    return renderToStaticMarkup(<LanguageProvider>{node}</LanguageProvider>);
}
const noop = () => undefined;
const asyncNoop = async () => undefined;
const two = (value: number) => String(value).padStart(2, '0');
const at = (year: number, month: number, day: number, hour = 12, minute = 0) => new Date(year, month - 1, day, hour, minute).getTime();
const dayOf = (ts: number) => { const d = new Date(ts); return `${two(d.getDate())}/${two(d.getMonth() + 1)}/${d.getFullYear()}`; };
const timeOf = (ts: number) => { const d = new Date(ts); return `${two(d.getHours())}:${two(d.getMinutes())}`; };

// ---- Investors: the manager, two active investors (one owing money) and an archived one ----
function investor(fields: Partial<DerivedInvestor> & Pick<DerivedInvestor, 'id' | 'name' | 'entryDate'>): DerivedInvestor {
    return {
        capitalInvested: 0, initialCapital: 0, sharePercentage: 0, totalProfit: 0, withdrawnProfit: 0, availableProfit: 0,
        isActive: true, entryTs: new Date(fields.entryDate).getTime(), txs: [], hasCapitalMovements: true, reinvestedProfit: 0,
        profitWithdrawals: 0, personalExpenses: 0, currentPersonalExpenses: 0, totalPersonalExpenses: 0, managerCapital: null,
        accountingWarnings: [], displayAvailableProfit: fields.availableProfit ?? 0, roi: null,
        ...fields,
    };
}
const manager = investor({ id: 'inv-m', name: 'Yacine Benali', entryDate: '2025-01-15', isManager: true, capitalInvested: 1_200_000, initialCapital: 1_000_000, sharePercentage: 0.6977, totalProfit: 186_420, withdrawnProfit: 64_000, notes: 'Gérant et porteur du projet.' });
const sofiane = investor({ id: 'inv-a', name: 'Sofiane Haddad', entryDate: '2025-03-01', capitalInvested: 400_000, initialCapital: 300_000, sharePercentage: 0.2326, totalProfit: 62_450.5, withdrawnProfit: 20_000, reinvestedProfit: 4_200, availableProfit: 38_250.5, displayAvailableProfit: 38_251, roi: 15.6126, notes: 'Retraits le 1er du mois, par BaridiMob.' });
const lina = investor({ id: 'inv-b', name: 'Lina Mansouri', entryDate: '2026-02-10', capitalInvested: 120_000, initialCapital: 120_000, sharePercentage: 0.0698, totalProfit: 5_800, withdrawnProfit: 9_000, availableProfit: -3_200, roi: 4.8333 });
const omar = investor({ id: 'inv-c', name: 'Omar Kaci', entryDate: '2025-06-01', isActive: false, archived: true, initialCapital: 150_000, totalProfit: 21_300, withdrawnProfit: 19_450, availableProfit: 1_850 });
const investors = [manager, sofiane, lina, omar];

const capitalSnapshot: CapitalSnapshot = {
    caisseBalance: 1_250_000, baridiBalance: 480_000, cashTotal: 1_730_000, stockValue: 1_541_524, treasuryCardsTotal: 375_000,
    receivables: 310_000, clientAdvances: 45_000, netClientPosition: 265_000, serviceReceivables: 18_000, serviceClientAdvances: 3_500,
    servicesCapitalImpact: 14_500, managerPendingAdvances: 15_000, totalCapital: 3_941_024, investorLiability: 556_900.5, netOwnedCapital: 3_384_123.5,
};
const investorBreakdown: InvestorBreakdown = { capital: 520_000, profits: 36_900.5, total: 556_900.5 };
const totalsWithCosts: InvestorEconomicsResult['totals'] = {
    derivedProfit: 241_870, managerShare: 55_926, investorShare: 185_944, reconciliationDifference: 0,
    totalDeliveryExpenses: 4_500, totalDebtWriteOffs: 1_200, netDistributableProfit: 236_170,
};
const totalsWithoutCosts: InvestorEconomicsResult['totals'] = { ...totalsWithCosts, totalDeliveryExpenses: 0, totalDebtWriteOffs: 0, netDistributableProfit: 241_870, reconciliationDifference: 12.5 };
const managerProfitBreakdown: ManagerProfitBreakdown = {
    managerFeePercentage: 30, projectNetProfit: 241_870, openingCapital: 1_000_000, historicalOwnerCapital: 3_377_400, actualOwnerCapital: 3_384_123.5,
    tradingOwnerProfit: 172_520, serviceProfit: 13_900, ideaShareProfit: 72_561, personalCapitalProfit: 99_959, ownerTotalProfit: 186_420,
    externalInvestorsProfit: 55_450, totalDeliveryExpenses: 4_500, totalDebtWriteOffs: 1_200, profitWithdrawals: 0, personalExpenses: 38_000,
    currentPersonalExpenses: 26_000, totalPersonalExpenses: 64_000, withdrawnProfit: 64_000, reinvestedProfit: 0, availableProfit: 122_420,
    profitDeficit: 0, displayAvailableProfit: 122_420, retainedProfit: 122_420, capitalAdditions: 200_000, capitalWithdrawals: 5_000,
    personalExpensesChargedToProfit: 64_000, personalExpensesChargedToCapital: 0, personalExpensesFundedByCapital: 0,
    balanceSheetOwnerCapital: 3_384_123.5, ownerCapitalReconciliationDifference: 6_723.5,
};
const periodLock = {
    lockedThrough: new Date(2026, 7, 31, 23, 59, 59, 999).getTime(), reason: 'profit_distribution' as const,
    updatedAt: at(2026, 9, 2, 10), isLoaded: true, saveLockedThrough: asyncNoop,
};
const treasuryStats = { caisse: 1_250_000, baridi: 480_000 };
const userDocRef = {} as never;

const itx = (id: string, investorId: string, type: InvestorTransaction['type'], amount: number, ts: number, extra: Partial<InvestorTransaction> = {}): InvestorTransaction => ({
    id, investorId, type, amount, date: dayOf(ts), time: timeOf(ts), timestamp: ts, ...extra,
} as InvestorTransaction);
const sofianeTxs = [
    itx('t1', 'inv-a', 'deposit_capital', 300_000, at(2025, 3, 1, 10), { paymentSource: 'Caisse' }),
    itx('t2', 'inv-a', 'profit_distribution', 18_200, at(2025, 12, 31, 18)),
    itx('t3', 'inv-a', 'withdraw_profit', 20_000, at(2026, 1, 5, 11), { paymentSource: 'BaridiMob', notes: 'Retrait janvier' }),
    itx('t4', 'inv-a', 'deposit_capital', 100_000, at(2026, 4, 15, 9, 30), { paymentSource: 'Caisse' }),
    itx('t5', 'inv-a', 'reinvest_profit', 4_200, at(2026, 7, 1, 10)),
    itx('t6', 'inv-a', 'profit_distribution', 44_250.5, at(2026, 8, 31, 19)),
];
const managerTxs = [
    itx('m1', 'inv-m', 'deposit_capital', 1_000_000, at(2025, 1, 15, 9)),
    itx('m2', 'inv-m', 'deposit_capital', 200_000, at(2026, 5, 10, 16)),
    itx('m3', 'inv-m', 'withdraw_profit', 12_000, at(2026, 9, 20, 13)),
    itx('m4', 'inv-m', 'withdraw_capital', 5_000, at(2026, 9, 25, 17), { origin: 'personal_expense' } as Partial<InvestorTransaction>),
];

// ---- Personal expenses of the manager: this week, this month, earlier, and two advances ----
const expense = (id: string, amount: number, ts: number, notes: string, extra: Partial<TreasuryTx> = {}): TreasuryTx => ({
    id, timestamp: ts, date: dayOf(ts), time: timeOf(ts), type: 'Retrait', source: 'Caisse', amount, notes, origin: 'personal_expense', ...extra,
});
const personalExpenses: TreasuryTx[] = [
    expense('e1', 2_500, at(2026, 9, 30, 13, 10), 'Déjeuner'),
    expense('e2', 8_000, at(2026, 9, 28, 18, 45), 'Courses', { source: 'BaridiMob' }),
    expense('e3', 15_000, at(2026, 9, 15, 8), 'Avance carburant', { advanceState: 'settled', settledAmount: 11_200, spentDescription: 'Plein essence + péage' }),
    expense('e4', 4_300, at(2026, 9, 3, 17, 20), 'Pharmacie'),
    expense('e5', 12_000, at(2026, 8, 20, 10), 'Billet avion'),
    expense('e6', 6_500, at(2026, 8, 2, 21), 'Restaurant'),
    expense('e7', 20_000, at(2026, 3, 12, 15), 'Cadeau mariage'),
    expense('e8', 9_000, at(2025, 12, 20, 11), 'Fournitures'),
    expense('p1', 10_000, at(2026, 9, 29, 9), 'Avance voyage Oran', { advanceState: 'pending' }),
    expense('p2', 5_000, at(2026, 9, 22, 14), 'Avance réparation voiture', { advanceState: 'pending', source: 'BaridiMob' }),
    expense('r1', 3_800, at(2026, 9, 15, 18), 'Retour avance carburant', { type: 'Ajout', origin: 'personal_expense_return' }),
];

// ---- Services: two with clients, one empty, one archived ----
const asset = (id: string, name: string, description?: string, archived = false): ManualAsset => ({ id, name, description, createdAt: at(2025, 6, 1), updatedAt: at(2026, 9, 1), archived });
const manualAssets = [
    asset('svc-design', 'Conception graphique', 'Logos, flyers et cartes'),
    asset('svc-print', 'Impression'),
    asset('svc-web', 'Sites web', 'Vitrines et boutiques'),
    asset('svc-old', 'Photocopie', undefined, true),
];
const serviceClient = (id: string, assetId: string, fullName: string, phone?: string): ManualAssetClient => ({ id, assetId, fullName, phone, createdAt: at(2025, 7, 1), updatedAt: at(2026, 9, 1) });
const manualAssetClients = [
    serviceClient('c-d1', 'svc-design', 'Agence Nour', '0555 12 34 56'),
    serviceClient('c-d2', 'svc-design', 'Studio Atlas'),
    serviceClient('c-d3', 'svc-design', 'Café Medina', '0661 22 33 44'),
    serviceClient('c-p1', 'svc-print', 'Librairie Ibn Khaldoun'),
    serviceClient('c-p2', 'svc-print', 'École Les Pins', '0770 45 67 89'),
];
const stx = (id: string, actifId: string, clientId: string, type: ManualAssetTransaction['type'], amount: number, ts: number, extra: Partial<ManualAssetTransaction> = {}): ManualAssetTransaction => ({
    id, actifId, clientId, type, amount, date: dayOf(ts), time: timeOf(ts), timestamp: ts, ...extra,
});
const manualAssetTransactions = [
    stx('d1', 'svc-design', 'c-d1', 'service', -18_000, at(2026, 7, 4, 10), { serviceType: 'Logo' }),
    stx('d2', 'svc-design', 'c-d1', 'payment_received', 10_000, at(2026, 7, 20, 15), { paymentMethod: 'cash' }),
    stx('d3', 'svc-design', 'c-d1', 'service', -6_500, at(2026, 9, 3, 11), { serviceType: 'Flyers', notes: '500 exemplaires' }),
    stx('d4', 'svc-design', 'c-d2', 'service', -4_000, at(2026, 9, 10, 9), { serviceType: 'Cartes de visite' }),
    stx('d5', 'svc-design', 'c-d2', 'payment_received', 7_500, at(2026, 9, 12, 16), { paymentMethod: 'baridi' }),
    stx('d6', 'svc-design', 'c-d3', 'service', -9_000, at(2026, 9, 18, 14), { serviceType: 'Menu' }),
    stx('d7', 'svc-design', 'c-d3', 'payment_received', 9_000, at(2026, 9, 25, 12), { paymentMethod: 'cash' }),
    stx('d8', 'svc-design', 'c-d1', 'adjustment', 500, at(2026, 9, 26, 10), { notes: 'Arrondi' }),
    stx('p1', 'svc-print', 'c-p1', 'service', -12_000, at(2026, 8, 8, 10), { serviceType: 'Affiches' }),
    stx('p2', 'svc-print', 'c-p1', 'payment_received', 12_000, at(2026, 8, 30, 17), { paymentMethod: 'cash' }),
    stx('p3', 'svc-print', 'c-p2', 'service', -7_000, at(2026, 9, 21, 9), { serviceType: 'Brochures' }),
    stx('p4', 'svc-print', 'c-p2', 'payment_received', 3_000, at(2026, 9, 28, 11), { paymentMethod: 'baridi' }),
];
const assetClientBalances = new Map<string, number>();
for (const tx of manualAssetTransactions)
    assetClientBalances.set(`${tx.actifId}_${tx.clientId}`, (assetClientBalances.get(`${tx.actifId}_${tx.clientId}`) || 0) + tx.amount);
const designClients = manualAssetClients.filter((client) => client.assetId === 'svc-design');
const designTxs = manualAssetTransactions.filter((tx) => tx.actifId === 'svc-design');
const nourTxs = manualAssetTransactions.filter((tx) => tx.clientId === 'c-d1');

// ---- Screens ----
function renderInvestors(lang: Lang, totals = totalsWithCosts) {
    return render(<InvestorsPage investors={investors} capitalSnapshot={capitalSnapshot} investorBreakdown={investorBreakdown} onOpenInvestor={noop} onAddInvestor={noop} onEditInvestor={noop} onDeleteInvestor={noop} investorEconomicsTotals={totals} managerFeePercentage="30" saveManagerFeePercentage={asyncNoop} userDocRef={userDocRef} setAlert={noop} treasuryStats={treasuryStats} managerProfitBreakdown={managerProfitBreakdown} periodLock={periodLock}/>, lang);
}
function renderDistribution(lang: Lang) {
    const payable = investors.filter((inv) => !inv.isManager);
    return render(<ProfitDistributionSheet isOpen onClose={noop} investors={payable} suggestedTotal={calculateWithdrawableProfit(payable)} userDocRef={userDocRef} setAlert={noop} treasuryStats={treasuryStats} periodLockedThrough={periodLock.lockedThrough}/>, lang);
}
function renderCommission(lang: Lang) {
    return render(<CommissionEditorModal isOpen onClose={noop} value="30" onSave={asyncNoop} managerFeeAmount={totalsWithCosts.managerShare}/>, lang);
}
function renderInvestorDetail(lang: Lang, who: DerivedInvestor, txs: InvestorTransaction[]) {
    return render(<InvestorDetailsPage investor={who} transactions={txs} onBack={noop} onAddCapital={noop} onWithdrawCapital={noop} onWithdrawProfit={noop} onReinvestProfit={noop} onDeleteTransaction={noop} onExportReport={noop} globalNetProfit={241_870} managerFeePercentage={30} totalCapital={1_720_000} capitalSnapshot={capitalSnapshot} managerProfitBreakdown={managerProfitBreakdown} personalExpenses={personalExpenses}/>, lang);
}
function renderInvestorHistory(lang: Lang, who: DerivedInvestor, txs: InvestorTransaction[]) {
    const ordered = [...txs].sort((a, b) => b.timestamp - a.timestamp);
    return render(<InvestorDetailsContent investor={who} capitalSnapshot={capitalSnapshot} managerProfitBreakdown={managerProfitBreakdown} orderedTransactions={ordered} activeTab="history" setActiveTab={noop} onAddCapital={noop} onWithdrawCapital={noop} onWithdrawProfit={noop} onReinvestProfit={noop} onDeleteTransaction={noop} personalExpenses={personalExpenses}/>, lang);
}
function renderPortal(lang: Lang, who: DerivedInvestor, txs: InvestorTransaction[]) {
    return render(<InvestorDashboardPage investor={who} transactions={txs} globalNetProfit={241_870} managerFeePercentage={30} totalCapital={1_720_000} onExportReport={noop}/>, lang);
}
function renderServices(lang: Lang) {
    return render(<ServicesPage manualAssets={manualAssets} manualAssetClients={manualAssetClients} manualAssetTransactions={manualAssetTransactions} assetClientBalances={assetClientBalances} onOpenManualAsset={noop} onOpenCreateManualAsset={noop} onDeleteManualAsset={noop}/>, lang);
}
function renderServiceDetail(lang: Lang) {
    return render(<ManualAssetPage asset={manualAssets[0]} clients={designClients} assetTransactions={designTxs} clientBalances={assetClientBalances} onBack={noop} onSelectClient={noop} onCreateClient={noop} onUpdateClient={noop} onDeleteClient={noop}/>, lang);
}
function renderServiceYear(lang: Lang) {
    const props = { assetId: 'svc-design', assetName: manualAssets[0].name, clients: designClients, assetTransactions: designTxs, clientBalances: assetClientBalances, initialView: 'annual' as const };
    return render(<ManualAssetReportsSection {...props}/>, lang);
}
function renderServiceClient(lang: Lang) {
    return render(<ManualClientPage client={manualAssetClients[0]} transactions={nourTxs} balance={assetClientBalances.get('svc-design_c-d1') || 0} onBack={noop} onAddTransaction={noop} onUpdateTransaction={noop} onDeleteTransaction={noop}/>, lang);
}
function renderServiceTxDialog(lang: Lang) {
    return render(<ManualClientTransactionDialog isTxModalOpen editingTx={null} txType="service" setTxType={noop} amount="2500" setAmount={noop} serviceType="Flyers" setServiceType={noop} notes="" setNotes={noop} paymentMethod="cash" setPaymentMethod={noop} currentBalance={assetClientBalances.get('svc-design_c-d1') || 0} onClose={noop} onSave={noop}/>, lang);
}
type Period = 'day' | 'week' | 'month' | 'year';
function renderExpenses(lang: Lang, period: Period = 'month') {
    const props = { personalExpenses, managerAvailableProfit: 122_420, managerExists: true, onOpenReconcile: noop, onEditExpense: noop, onDeleteExpense: noop, onExportReport: noop, initialPeriod: period };
    return render(<PersonalExpensesPage {...props}/>, lang);
}

const SCREENS = {
    investors: (lang: Lang) => renderInvestors(lang),
    investorsNoCosts: (lang: Lang) => renderInvestors(lang, totalsWithoutCosts),
    distribution: renderDistribution,
    commission: renderCommission,
    investorDetail: (lang: Lang) => renderInvestorDetail(lang, sofiane, sofianeTxs),
    investorHistory: (lang: Lang) => renderInvestorHistory(lang, sofiane, sofianeTxs),
    oweDetail: (lang: Lang) => renderInvestorDetail(lang, lina, []),
    managerDetail: (lang: Lang) => renderInvestorDetail(lang, manager, managerTxs),
    managerHistory: (lang: Lang) => renderInvestorHistory(lang, manager, managerTxs),
    portal: (lang: Lang) => renderPortal(lang, sofiane, sofianeTxs),
    portalManager: (lang: Lang) => renderPortal(lang, manager, managerTxs),
    services: renderServices,
    serviceDetail: renderServiceDetail,
    serviceYear: renderServiceYear,
    serviceClient: renderServiceClient,
    serviceTxDialog: renderServiceTxDialog,
    expenses: (lang: Lang) => renderExpenses(lang),
    expensesDay: (lang: Lang) => renderExpenses(lang, 'day'),
    expensesWeek: (lang: Lang) => renderExpenses(lang, 'week'),
    expensesYear: (lang: Lang) => renderExpenses(lang, 'year'),
};

// Recording mode, run on the previous version: prints the numbers of each screen.
if (process.env.SCREEN_CAPTURE) {
    const captured: Record<string, string[]> = {};
    for (const [name, renderScreen] of Object.entries(SCREENS))
        for (const lang of ['fr', 'ar'] as const)
            captured[`${name}.${lang}`] = showSpaces(distinctScreenNumbers(renderScreen(lang)));
    console.log(JSON.stringify(captured));
    process.exit(0);
}

// The numbers each screen showed before V2-7 (recorded on V2-6, 44ae829, same data; ⍽ is the
// narrow space between thousands). French and Arabic showed the same ones.
const BEFORE: Record<keyof typeof SCREENS, string[]> = {
    investors: ['+15.6', '+1⍽850', '+38⍽251', '+4.8', '0', '02/09/2026', '120⍽000', '14⍽500', '15⍽000', '1⍽200', '1⍽541⍽524', '1⍽730⍽000', '2024', '2025', '2026', '236⍽170', '265⍽000', '3', '30', '31/08/2026', '36⍽901', '375⍽000', '38⍽250', '3⍽200', '3⍽384⍽124', '3⍽941⍽024', '400⍽000', '4⍽500', '520⍽000', '55⍽926'],
    investorsNoCosts: ['+15.6', '+1⍽850', '+38⍽251', '+4.8', '0', '02/09/2026', '12,50', '120⍽000', '14⍽500', '15⍽000', '1⍽541⍽524', '1⍽730⍽000', '2024', '2025', '2026', '265⍽000', '275⍽971', '3', '30', '31/08/2026', '36⍽901', '375⍽000', '38⍽250', '3⍽200', '3⍽384⍽124', '3⍽941⍽024', '400⍽000', '520⍽000', '55⍽926'],
    distribution: ['100.0', '1⍽250⍽000', '38⍽250', '38⍽250,5', '480⍽000'],
    commission: ['55⍽926,00'],
    investorDetail: ['+15,61', '01/03/2025', '1', '20⍽000', '23,26', '38⍽251', '400⍽000', '578', '6', '62⍽451'],
    investorHistory: ['+100⍽000', '+15,61', '+18⍽200', '+300⍽000', '+44⍽251', '+4⍽200', '-20⍽000', '01/03/2025', '01/07/2026', '05/01/2026', '09:30', '10:00', '11:00', '15/04/2026', '18:00', '19:00', '20⍽000', '23,26', '31/08/2026', '31/12/2025', '38⍽251', '400⍽000', '6', '62⍽451'],
    oweDetail: ['+4,83', '0', '10/02/2026', '120⍽000', '232', '3⍽200', '5⍽800', '6,98', '9⍽000'],
    managerDetail: ['0', '122⍽420', '13⍽900', '15/01/2025', '186⍽420', '1⍽000⍽000', '1⍽200', '241⍽870', '26⍽000', '30', '38⍽000', '3⍽377⍽400', '3⍽384⍽124', '4', '4⍽500', '55⍽450', '623', '64⍽000', '6⍽724', '72⍽561', '99⍽959'],
    managerHistory: ['+1⍽000⍽000', '+200⍽000', '-12⍽000', '-5⍽000', '0', '09:00', '10/05/2026', '122⍽420', '13:00', '13⍽900', '15/01/2025', '16:00', '17:00', '186⍽420', '1⍽000⍽000', '1⍽200', '20/09/2026', '241⍽870', '25/09/2026', '26⍽000', '30', '38⍽000', '3⍽377⍽400', '3⍽384⍽124', '4', '4⍽500', '55⍽450', '64⍽000', '6⍽724', '72⍽561', '99⍽959'],
    portal: ['+100⍽000', '+15,61', '+18⍽200', '+300⍽000', '+44⍽251', '+4⍽200', '+62⍽451', '-20⍽000', '01/03/2025', '01/07/2026', '05/01/2026', '09:30', '10:00', '11:00', '15/04/2026', '18:00', '19:00', '2026', '31/08/2026', '31/12/2025', '400⍽000', '438⍽251', '579'],
    portalManager: ['+15,53', '+186⍽420', '+1⍽000⍽000', '+200⍽000', '-12⍽000', '-5⍽000', '09:00', '10/05/2026', '13:00', '15/01/2025', '16:00', '17:00', '1⍽200⍽000', '20/09/2026', '2026', '25/09/2026', '624'],
    services: ['+10⍽500', '+4⍽000', '0', '14⍽500', '18⍽000', '2', '3', '4', '41⍽500', '5'],
    serviceDetail: ['0', '0,00', '0555 12 34 56', '0661 22 33 44', '1', '10⍽500,00', '14⍽000', '14⍽000,00', '16⍽500,00', '19⍽500,00', '2', '2026', '3', '3⍽500', '3⍽500,00', '4⍽000,00', '6⍽500,00', '7⍽500,00', '9⍽000,00'],
    serviceYear: ['0,00', '1', '10⍽000,00', '14⍽000,00', '2', '2026', '24⍽500,00', '26⍽500,00', '3', '37⍽500,00', '3⍽500,00', '4⍽000,00', '7⍽500,00', '9⍽000,00'],
    serviceClient: ['03/09/2026', '04/07/2026', '0555 12 34 56', '10:00', '10⍽000', '11:00', '14⍽000,00', '15:00', '18⍽000', '20/07/2026', '26/09/2026', '500', '6⍽500'],
    serviceTxDialog: ['14⍽000,00', '16⍽500,00'],
    expenses: ['+40,5', '-11⍽200', '-2⍽500', '-4⍽300', '-8⍽000', '03/09/2026', '08:00', '09:00', '10⍽000', '10⍽500', '11⍽200', '13:10', '14:00', '15/09/2026', '15⍽000', '17,5', '17:20', '18:45', '2', '2026', '22/09/2026', '26⍽000', '28/09/2026', '29/09/2026', '2⍽500', '30/09/2026', '4', '5⍽000', '64⍽500', '73⍽500', '867'],
    expensesDay: ['-2⍽500', '09:00', '1', '10⍽000', '10⍽500', '13:10', '14:00', '15⍽000', '2', '2,0', '2026', '22/09/2026', '26⍽000', '29/09/2026', '2⍽500', '30', '30/09/2026', '5⍽000', '64⍽500', '73⍽500'],
    expensesWeek: ['-2⍽500', '-8⍽000', '09:00', '10⍽000', '10⍽500', '13:10', '14:00', '15⍽000', '18:45', '1⍽500', '2', '22/09/2026', '26⍽000', '28', '28/09/2026', '29/09/2026', '2⍽500', '30/09/2026', '5⍽000', '64⍽500', '7,9', '73⍽500', '8⍽000'],
    expensesYear: ['+616,7', '-11⍽200', '-12⍽000', '-20⍽000', '-2⍽500', '-4⍽300', '-6⍽500', '-8⍽000', '02/08/2026', '03/09/2026', '08:00', '09:00', '10:00', '10⍽000', '10⍽500', '12/03/2026', '13:10', '14:00', '15/09/2026', '15:00', '15⍽000', '177', '17:20', '18:45', '2', '20/08/2026', '2026', '20⍽000', '21:00', '22/09/2026', '26⍽000', '28/09/2026', '29/09/2026', '2⍽500', '30/09/2026', '34,5', '5⍽000', '64⍽500', '7', '73⍽500'],
};
const changed: string[] = [];
for (const [name, renderScreen] of Object.entries(SCREENS) as Array<[keyof typeof SCREENS, (lang: Lang) => string]>)
    for (const lang of ['fr', 'ar'] as const) {
        const now = showSpaces(distinctScreenNumbers(renderScreen(lang)));
        const lost = BEFORE[name].filter((token) => !now.includes(token));
        const added = now.filter((token) => !BEFORE[name].includes(token));
        if (lost.length || added.length)
            changed.push(`${name}.${lang}: no longer shown [${lost.join(' ')}], new [${added.join(' ')}]`);
    }
assert.deepEqual(changed, [], 'every screen shows the same numbers, written the same way');

// Each figure still sits next to its own label, in the same order where the order matters.
const label = (lang: Lang, key: string) => key.split('.').reduce<any>((node, part) => node[part], translations[lang]) as string;
const textOf = (html: string) => screenText(html).replace(/\s*\|(?:\s*\|)*\s*/g, '|');
const n = (shown: string) => shown.replace(/(\d) (?=\d)/g, '$1\u202f');
function assertPairs(screen: keyof typeof SCREENS, lang: Lang, pairs: Array<[string, string]>) {
    const text = textOf(SCREENS[screen](lang));
    for (const [key, value] of pairs) {
        const pair = `${key.includes('.') ? label(lang, key) : key}|${n(value)}`;
        assert.ok(text.includes(pair), `${screen}.${lang}: "${pair}"`);
    }
}
function assertOrder(screen: keyof typeof SCREENS, lang: Lang, parts: string[]) {
    const text = textOf(SCREENS[screen](lang));
    let from = 0;
    for (const part of parts) {
        const at = text.indexOf(n(part), from);
        assert.ok(at >= from, `${screen}.${lang}: "${part}" after the previous part`);
        from = at + 1;
    }
}
for (const lang of ['fr', 'ar'] as const) {
    assertPairs('investors', lang, [
        ['investors.capitalInvested', '520 000'], ['investors.capitalProject', '3 941 024'], ['investors.capitalOwned', '3 384 124'],
        ['investors.profitsToPay', '36 901'], ['investors.managerShare', '55 926'],
        ['finance.liquidity', '1 730 000'], ['finance.stock', '1 541 524'], ['finance.netPosition', '265 000'], ['finance.treasuryCards', '375 000'],
        ['finance.servicesNetPosition', '14 500'], ['personalExpenses.personalAdvance', '15 000'], ['investors.managerCommissionRate', '30'],
        ['investors.deliveryExpenses', '4 500'], ['investors.debtWriteOffs', '1 200'], ['investors.netDistributableProfit', '236 170'],
    ]);
    assert.ok(textOf(SCREENS.investors(lang)).includes(`${label(lang, 'profitDistribution.availableToWithdraw')} :|${n('38 250')}`), `investors.${lang}: amount the plan can pay`);
    // The list keeps its order; each investor shows his own capital, then his profit and return.
    assertOrder('investors', lang, ['Yacine Benali', '3 384 124', 'Sofiane Haddad', '400 000', '+38 251', '+15.6%', 'Lina Mansouri', '120 000', label(lang, 'investors.balanceToRegularize'), '3 200', '+4.8%', 'Omar Kaci', '0', '+1 850']);
    assertPairs('investorsNoCosts', lang, [['investors.attributedProfit', '275 971']]);
    // The status pill sits between the capital label and its amount.
    assertOrder('investorDetail', lang, [label(lang, 'investors.capitalInvested'), '400 000']);
    assertPairs('investorDetail', lang, [
        ['investors.availableProfit', '38 251'], ['investors.totalProfitCumulative', '62 451'],
        ['investors.totalWithdrawn', '20 000'], ['investors.fundShare', '23,26'], ['investors.cumulativeReturn', '+15,61'], ['investors.investmentDuration', '578'],
    ]);
    assertPairs('oweDetail', lang, [['investors.balanceToRegularize', '3 200'], ['investors.totalProfitCumulative', '5 800'], ['investors.totalWithdrawn', '9 000']]);
    assertOrder('managerDetail', lang, [label(lang, 'investors.managerOwnedCapital'), '3 384 124']);
    assertPairs('managerDetail', lang, [
        ['investors.totalEarned', '186 420'], ['investors.openingCapital', '1 000 000'],
        ['investors.totalPersonalExpenses', '64 000'], ['investors.profitsReinvestedInCapital', '122 420'], ['investors.capitalFromHistory', '3 377 400'],
    ]);
    assertOrder('investorHistory', lang, ['31/08/2026', '+44 251', '01/07/2026', '+4 200', '15/04/2026', '+100 000', '05/01/2026', '-20 000', '31/12/2025', '+18 200', '01/03/2025', '+300 000']);
    // Investor portal: for the manager it keeps showing the capital he put in under « capital propre » (open question, unchanged).
    assertPairs('portal', lang, [['investorDashboard.currentValueEstimate', '438 251'], ['investors.capitalInvested', '400 000'], ['investors.totalProfitCumulative', '+62 451']]);
    assertPairs('portalManager', lang, [['investors.managerOwnedCapital', '1 200 000']]);
    assertPairs('services', lang, [['services.toReceive', '18 000'], ['services.capitalImpact', '14 500'], ['transactions.paymentReceived', '41 500'], ['services.clients', '5']]);
    assertOrder('services', lang, ['Conception graphique', '+10 500', 'Impression', '+4 000', 'Sites web', '0']);
    assertPairs('serviceDetail', lang, [['services.toReceive', '14 000,00'], ['services.clientAdvances', '3 500,00'], ['services.capitalImpact', '10 500,00'], ['services.servicesBilled', '19 500,00'], ['services.collected', '16 500,00']]);
    assertPairs('serviceYear', lang, [['services.servicesBilled', '37 500,00'], ['services.collected', '26 500,00']]);
    assertPairs('expenses', lang, [
        ['personalExpenses.totalThisMonth', '26 000'], ['personalExpenses.today', '2 500'], ['personalExpenses.thisWeek', '10 500'],
        ['personalExpenses.thisYear', '64 500'], ['personalExpenses.sinceStart', '73 500'], ['personalExpenses.pending', '15 000'],
        ['personalExpenses.averagePerDay', '867'], ['personalExpenses.biggestExpense', '11 200'],
    ]);
    assertPairs('expenses', lang, [[label(lang, 'personalExpenses.totalOps').replace('{count}', '4'), '26 000']]);
    assertPairs('expensesWeek', lang, [[label(lang, 'personalExpenses.totalOps').replace('{count}', '2'), '10 500']]);
    assertPairs('expensesDay', lang, [[label(lang, 'personalExpenses.totalOp').replace('{count}', '1'), '2 500']]);
}

assert.ok(FIXED_NOW > 0);
console.log('investorScreens.test: Investisseurs, Services, Mes dépenses and the investor portal show the same numbers as before, in French and Arabic');
