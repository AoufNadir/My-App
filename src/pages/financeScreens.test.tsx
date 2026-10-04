import { FIXED_NOW } from '../testing/fixedClock';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LanguageProvider, useLanguage } from '../contexts/LanguageContext';
import type { ClientDzd, ClientTransactionDzd, TreasuryCard, TreasuryTx, Tx } from '../types';
import { computeCapitalSnapshot } from '../utils/capitalSnapshot';
import { computePamLedger } from '../utils/pamLedger';
import { distinctScreenNumbers, screenText, showSpaces } from '../testing/screenNumbers';
import { TresoreriePage } from './TresoreriePage';
import { PortfolioPage } from './PortfolioPage';
import { AnalyticsPage, type AnalyticsTab } from './AnalyticsPage';
import { AnalyticsExportSheet } from '../components/analytics/AnalyticsExportSheet';
import { PamSimulator } from '../components/portfolio/PamSimulator';
import { CapitalBreakdown } from '../components/financial/CapitalOverviewCard';

// V2-6 redrew Trésorerie, Portefeuille and Analyse. Same fake data, French and Arabic, clock
// fixed on 30/09/2026 15:00: every number of the previous screens (V2-5) is still shown, written
// the same way, and no new one appears.

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
function render(node: React.ReactElement, lang: Lang) {
    storage.set('app_lang', lang);
    return renderToStaticMarkup(<LanguageProvider>{node}</LanguageProvider>);
}
const noop = () => undefined;
const HOUR = 3_600_000;
const two = (value: number) => String(value).padStart(2, '0');
const at = (year: number, month: number, day: number, hour = 12, minute = 0) => new Date(year, month - 1, day, hour, minute).getTime();
const dayOf = (ts: number) => { const d = new Date(ts); return `${two(d.getDate())}/${two(d.getMonth() + 1)}/${d.getFullYear()}`; };
const timeOf = (ts: number) => { const d = new Date(ts); return `${two(d.getHours())}:${two(d.getMinutes())}`; };

// ---- Trading history: USDT and EUR bought and sold since 2025 ----
const trade = (id: string, type: 'buy' | 'sell', currency: 'USDT' | 'EUR', quantity: number, price: number, ts: number, extra: Partial<Tx> = {}): Tx => ({
    id, type, currency, quantity,
    ...(type === 'buy' ? { price } : { sell: price }),
    total: Math.round(quantity * price * 100) / 100,
    date: dayOf(ts), time: timeOf(ts), timestamp: ts, ...extra,
});
const conversionTs = at(2026, 9, 28, 11);
const transactions: Tx[] = [
    trade('b0', 'buy', 'USDT', 2_000, 240, at(2025, 11, 5, 10)),
    trade('s0', 'sell', 'USDT', 500, 246, at(2025, 11, 20, 16)),
    trade('b1', 'buy', 'USDT', 5_000, 242, at(2026, 3, 2, 10)),
    trade('e1', 'buy', 'EUR', 1_000, 250, at(2026, 3, 3, 11)),
    trade('s1', 'sell', 'USDT', 800, 247, at(2026, 4, 10, 14)),
    trade('s2', 'sell', 'USDT', 600, 246.5, at(2026, 5, 15, 15)),
    trade('s3', 'sell', 'USDT', 700, 245, at(2026, 7, 8, 13)),
    trade('s4', 'sell', 'USDT', 1_000, 248, at(2026, 8, 12, 17)),
    trade('s5', 'sell', 'USDT', 300, 240, at(2026, 8, 25, 18)),
    trade('b2', 'buy', 'USDT', 2_000, 243.5, at(2026, 9, 3, 9, 30)),
    trade('s6', 'sell', 'USDT', 1_200, 249, at(2026, 9, 7, 14, 32)),
    trade('s7', 'sell', 'USDT', 400, 241, at(2026, 9, 14, 10, 15)),
    trade('s8', 'sell', 'EUR', 300, 262, at(2026, 9, 14, 16, 40)),
    trade('s9', 'sell', 'USDT', 900, 250, at(2026, 9, 22, 11, 5)),
    trade('e2', 'buy', 'EUR', 500, 252, at(2026, 9, 27, 10)),
    // 540 EUR turned into 500 USDT, saved at 250 DZD per EUR: the EUR PAM of that day is higher.
    { id: 'r1', type: 'Retrait Manuel', currency: 'EUR', quantity: 540, linkedTxId: 'u5', notes: 'Achat de 500 USDT', date: dayOf(conversionTs), time: '10:59', timestamp: conversionTs - 1 },
    trade('u5', 'buy', 'USDT', 500, 270, conversionTs, { purchaseFundingCurrency: 'EUR', purchaseAmountEur: 540, eurToDzdRateAtPurchase: 250, eurPerUsdtAtPurchase: 1.08, lockedUntil: conversionTs + 24 * HOUR }),
    // Still locked: until today 20:30, and until tomorrow 08:30.
    trade('b4', 'buy', 'USDT', 1_500, 244, at(2026, 9, 29, 20, 30), { lockedUntil: at(2026, 9, 30, 20, 30) }),
    trade('b3', 'buy', 'USDT', 1_000, 244.5, at(2026, 9, 30, 8, 30), { lockedUntil: at(2026, 10, 1, 8, 30) }),
];
const ledger = computePamLedger(transactions, { nowMs: FIXED_NOW });
// The ledger is memoized in the app: a batch whose lock ran out since then is still listed.
const portfolioStats = {
    ...ledger.portfolioStats,
    usdt: {
        ...ledger.portfolioStats.usdt,
        available: ledger.portfolioStats.usdt.available - 250,
        locked: ledger.portfolioStats.usdt.locked + 250,
        lockedBatches: [...ledger.portfolioStats.usdt.lockedBatches, { txId: 'expired', quantity: 250, lockedUntil: FIXED_NOW - HOUR }],
    },
};

// ---- Clients behind the sales ----
const clients: ClientDzd[] = [
    { id: 'c1', fullName: 'Amine Kaci' },
    { id: 'c2', fullName: 'Sara Belkacem' },
    { id: 'c3', fullName: 'Yacine Mansouri' },
];
const saleClient: Record<string, string> = { s0: 'c3', s1: 'c1', s2: 'c2', s3: 'c1', s4: 'c2', s5: 'c3', s6: 'c1', s7: 'c2', s8: 'c3', s9: 'c1' };
const clientTransactionsDzd: ClientTransactionDzd[] = transactions
    .filter((tx) => saleClient[tx.id])
    .map((tx) => ({
        id: `ct-${tx.id}`, clientId: saleClient[tx.id], timestamp: tx.timestamp, date: tx.date, time: tx.time,
        montant: -(tx.total ?? 0), type: tx.currency === 'EUR' ? 'Vente EUR' : 'Vente USDT', linkedTxId: tx.id, linkRole: 'primary',
    }));
const fullName = (client: ClientDzd) => client.fullName;

// ---- Treasury: cash movements of the last weeks ----
const move = (id: string, type: TreasuryTx['type'], source: TreasuryTx['source'], amount: number, ts: number, extra: Partial<TreasuryTx> = {}): TreasuryTx => ({
    id, type, source, amount, timestamp: ts, date: dayOf(ts), time: timeOf(ts), ...extra,
});
const treasuryTransactions: TreasuryTx[] = [
    move('m1', 'Ajout', 'Caisse', 245_000, at(2026, 9, 30, 9, 10), { notes: 'Règlement Amine', origin: 'client_tx' }),
    move('m2', 'Retrait', 'BaridiMob', 50_000, at(2026, 9, 29, 17, 20), { notes: 'Paiement fournisseur' }),
    move('m3', 'Adjustment (+)', 'Caisse', 1_500, at(2026, 9, 29, 12), { notes: 'Correction caisse', origin: 'balance_edit' }),
    move('m4', 'Adjustment (-)', 'BaridiMob', 800, at(2026, 9, 28, 10), { origin: 'balance_edit' }),
    move('m5', 'Transfer', 'Caisse', 100_000, at(2026, 9, 28, 9), { destination: 'BaridiMob' }),
    move('m6', 'Ajout', 'Caisse', 96_400, at(2026, 9, 27, 11, 30), { origin: 'client_tx' }),
    move('m7', 'Retrait', 'Caisse', 1_200, at(2026, 9, 26, 16), { notes: 'Frais de livraison', origin: 'delivery_expense', expenseWallet: 'Caisse' }),
    move('m8', 'Retrait', 'Caisse', 30_000, at(2026, 9, 25, 10), { notes: 'Profit Samir', origin: 'investor_profit_withdrawal' }),
    move('m9', 'Retrait', 'Caisse', 5_000, at(2026, 9, 25, 15), { notes: 'Dépense perso', origin: 'personal_expense' }),
    { id: 'm10', type: 'Retrait', amount: 25_000, timestamp: at(2026, 9, 24, 12), date: '24/09/2026', time: '12:00', notes: 'Frais payés en USDT', origin: 'delivery_expense', expenseWallet: 'USDT', expenseCurrency: 'USDT' },
    move('m11', 'Ajout', 'BaridiMob', 72_000, at(2026, 9, 24, 9)),
    move('m12', 'Ajout', 'Caisse', 18_000, at(2026, 9, 22, 10)),
    move('m13', 'Retrait', 'Caisse', 2_500, at(2026, 9, 20, 10)),
    move('m14', 'Ajout', 'BaridiMob', 12_000, at(2026, 9, 18, 10)),
    move('m15', 'Retrait', 'Caisse', 7_000, at(2026, 9, 15, 10)),
    move('m16', 'Ajout', 'Caisse', 40_000, at(2026, 9, 10, 10)),
    move('m17', 'Retrait', 'BaridiMob', 9_000, at(2026, 9, 8, 10)),
    move('m18', 'Ajout', 'Caisse', 3_000, at(2026, 9, 5, 10)),
];
const treasuryCards: TreasuryCard[] = [
    { id: 'k1', name: 'Coffre-fort', value: 300_000, notes: 'Clé chez Karim\nCompter le 15' },
    { id: 'k2', name: 'Compte CCP', value: 75_000 },
    { id: 'k3', name: 'Ancienne caisse', value: 0 },
];
const capitalSnapshot = computeCapitalSnapshot({
    caisseBalance: 1_250_000, baridiBalance: 480_000, portfolioStats, totalDettes: 310_000, totalAvances: 45_000,
    treasuryCards, investorLiability: 520_000, services: { amountToReceive: 18_000, clientAdvances: 3_500 },
});

function renderTreasury(lang: Lang) {
    return render(<TresoreriePage caisseBalance={1_250_000} baridiBalance={480_000} capitalSnapshot={capitalSnapshot}
        investorBreakdown={{ capital: 450_000, profits: 70_000, total: 520_000 }} treasuryCards={treasuryCards}
        openTreasuryModal={noop} openTreasuryCardModal={noop} setTreasuryCardToDelete={noop} openTreasuryBalanceEditModal={noop}
        openDeliveryExpenseModal={noop} treasuryTransactions={treasuryTransactions} onOpenServices={noop}/>, lang);
}

const parseAndEvaluate = (expr: string) => Number(String(expr).replace(',', '.'));
const pageProps = {
    statsView: 'usdt' as const, setStatsView: noop, setIsSettingsModalOpen: noop,
    portfolioStats, totalPortfolioValue: 0, smartTargetUsdt: 246.5, smartTargetEur: 0, parseAndEvaluate,
    usdtReportMonth: 8, setUsdtReportMonth: noop, usdtReportYear: 2026, setUsdtReportYear: noop,
    reportMonths: (year: number) => {
        const months = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
        return year === 2026 ? months.slice(0, 9) : months;
    },
    reportYears: [2024, 2025, 2026], monthlyStats: {}, transactions, selectedHeatmapDay: null, setSelectedHeatmapDay: noop,
    handleExportUsdtReport: noop, dzdDashboardStats: null, reportClient: '', setReportClient: noop, clientsDzd: clients,
    clientTransactionsDzd, getClientFullName: fullName, reportMonth: 8, setReportMonth: noop, reportYear: 2026, setReportYear: noop,
    openPortfolioBalanceEditModal: noop,
};
const renderPortfolio = (lang: Lang) => render(<PortfolioPage {...pageProps}/>, lang);
const renderSimulator = (lang: Lang) => render(<PamSimulator portfolioStats={portfolioStats} smartTargetUsdt={246.5} parseAndEvaluate={parseAndEvaluate}/>, lang);
const renderAnalytics = (lang: Lang, tab: AnalyticsTab = 'month') => render(<AnalyticsPage {...pageProps} initialTab={tab}/>, lang);
const renderExportSheet = (lang: Lang) => render(<AnalyticsExportSheet isOpen onClose={noop} monthLabel="Septembre" year={2026} realizedProfit={18_031} monthlyHasData
    onExportMonthly={noop} reportClient="" reportMonth={8} reportYear={2026} reportMonths={pageProps.reportMonths} reportYears={pageProps.reportYears}
    clientsDzd={clients} getClientFullName={fullName} onExportClient={noop}/>, lang);

const SCREENS = {
    treasury: renderTreasury,
    portfolio: renderPortfolio,
    simulator: renderSimulator,
    analytics: (lang: Lang) => renderAnalytics(lang),
    analyticsYear: (lang: Lang) => renderAnalytics(lang, 'year'),
    analyticsAllTime: (lang: Lang) => renderAnalytics(lang, 'alltime'),
    analyticsClients: (lang: Lang) => renderAnalytics(lang, 'clients'),
    analyticsExport: renderExportSheet,
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

// ---- Numbers of the V2-5 screens, recorded with the mode above before any change ----
// Portefeuille: with the locked batches unfolded. Analyse: Synthèse and Clients tabs, and the PDF sheet.
const fromShown = (tokens: string[]) => tokens.map((token) => token.replace(/⍽/g, '\u202f'));
const BEFORE = {
    treasury: fromShown(['+12⍽000', '+18⍽000', '+1⍽500', '+245⍽000', '+40⍽000', '+72⍽000', '+96⍽400', '-1⍽200', '-2⍽500', '-50⍽000', '-7⍽000', '-800', '10/09/2026', '14⍽500', '15', '15/09/2026', '18/09/2026', '1⍽250⍽000', '20/09/2026', '22/09/2026', '24/09/2026', '26/09/2026', '27/09/2026', '28/09/2026', '29/09/2026', '30/09/2026', '300⍽000,00', '310⍽000', '3⍽406⍽024', '3⍽926⍽024', '414⍽900', '45⍽000', '480⍽000', '520⍽000', '7', '75⍽000,00', '87⍽000']),
    portfolio: fromShown(['+0,32', '+2⍽251', '0', '05', '08:30', '1', '165⍽548', '17', '1⍽000,00', '1⍽375⍽976', '1⍽500,00', '1⍽541⍽524', '2', '20:30', '245,63', '245,71', '246,50', '250,83', '2⍽500,00', '30', '3⍽100,00', '450', '5⍽600,00', '660,00']),
    simulator: fromShown(['+0,32', '+2⍽251', '245,71', '246,50']),
    analytics: fromShown(['+14⍽954', '+18⍽031', '+2.33', '+21⍽746', '+2⍽423', '+2⍽977', '+3', '+3.46', '+3⍽600', '+4.62', '+4.96', '+4⍽369', '+5.46', '+5.77', '+6⍽000', '+6⍽138', '+7', '+8', '+8⍽915', '-09', '-523', '0', '0.8', '1', '10', '11', '12', '13', '14', '15', '16', '17', '18', '18⍽031', '19', '2', '20', '200.5', '2024', '2025', '2026', '21', '22', '23', '24', '248.08', '25', '25.1', '26', '27', '28', '29', '2⍽000', '2⍽100', '2⍽500', '3', '30', '300', '33⍽800', '36⍽800', '3⍽077', '3⍽600', '4', '400', '4⍽508', '5', '50.0', '50.3', '6', '6⍽400', '7', '75', '8', '80', '800', '8⍽031', '9']),
};
const numbersOf = (...htmls: string[]) => showSpaces([...new Set(htmls.flatMap((html) => distinctScreenNumbers(html)))].sort());
function assertSameNumbers(actual: string[], before: string[], screen: string) {
    assert.deepEqual(actual, showSpaces(before), `${screen}: same numbers, same writing`);
}
/** Visible text, one ` | ` between elements. */
const textOf = (html: string) => screenText(html).replace(/\|+/g, ' | ');
/** Text from one marker to the next one, to check that a value sits in the right place. */
function segment(text: string, from: string, to?: string) {
    const start = text.indexOf(from);
    assert.ok(start >= 0, `${from} shown`);
    const end = to ? text.indexOf(to, start + from.length) : text.length;
    assert.ok(end >= 0, `${to} shown after ${from}`);
    return text.slice(start, end);
}
const amount = (shown: string) => Number(shown.replace(/[\u202f\u00a0 ]/g, '').replace(',', '.'));

const WORDS = {
    fr: {
        movements: 'Mouvements récents', flow: 'Flux 7 jours', cards: 'Soldes sur cartes', flowIn: 'Entrées', flowOut: 'Sorties', weekdays: 'J | V | S | D | L | M | M',
        usdtCard: 'Prix moyen actuel (PAM) | 245,71', eurCard: 'EUR | 660,00', available: 'Disponible | 3\u202f100,00', locked: 'Bloqué | 2\u202f500,00',
        today: "aujourd'hui à 20:30", tomorrow: 'demain à 08:30', in: 'dans',
        vsAug: 'vs Aoû', activeDays: '3 jours actifs', bestDay: 'Meilleur jour', worstDay: 'Jour le plus faible', janToSep: 'Jan → Sep', calendarDays: 'L | M | M | J | V | S | D',
        topFive: 'Top 5 profit', winRate: 'Ventes profitables', avgProfit: 'Profit moyen / vente (PAM)', bestSale: 'Meilleure vente', thisMonth: 'ce mois', winningDays: 'Jours gagnants',
    },
    ar: {
        movements: 'آخر الحركات', flow: 'حركة 7 أيام', cards: 'أرصدة البطاقات', flowIn: 'الداخل', flowOut: 'الخارج', weekdays: 'خ | ج | س | ح | ن | ث | ر',
        usdtCard: 'متوسط الشراء الحالي (PAM) | 245,71', eurCard: 'EUR | 660,00', available: 'متاح | 3\u202f100,00', locked: 'مقفل | 2\u202f500,00',
        today: 'اليوم على 20:30', tomorrow: 'غدًا على 08:30', in: 'بعد',
        vsAug: 'مقارنة بـأوت', activeDays: '3 أيام نشطة', bestDay: 'أفضل يوم', worstDay: 'أضعف يوم', janToSep: 'جانفي → سبتمبر', calendarDays: 'ن | ث | ر | خ | ج | س | ح',
        topFive: 'أفضل 5 أرباح', winRate: 'مبيعات مربحة', avgProfit: 'متوسط ربح البيع (PAM)', bestSale: 'أفضل عملية بيع', thisMonth: 'هذا الشهر', winningDays: 'أيام الربح',
    },
};

function BreakdownInLanguage() {
    const { t } = useLanguage();
    return <CapitalBreakdown t={t} capitalSnapshot={capitalSnapshot} id="breakdown"/>;
}

for (const lang of ['fr', 'ar'] as const) {
    const words = WORDS[lang];

    // ---- Trésorerie ----
    const treasuryHtml = renderTreasury(lang);
    assertSameNumbers(numbersOf(treasuryHtml), BEFORE.treasury, `treasury.${lang}`);
    const treasury = textOf(treasuryHtml);
    // The 12 latest cash movements, newest first: no transfer, no investor or personal withdrawal,
    // no expense paid in USDT, and the two oldest ones are left out.
    const movements = segment(treasury, words.movements).match(/[+-]\d[\d\u202f]*/g);
    assert.deepEqual(movements?.map(amount), [245_000, -50_000, 1_500, -800, 96_400, -1_200, 72_000, 18_000, -2_500, 12_000, -7_000, 40_000], `treasury.${lang}: movements`);
    // Last 7 days, Thursday to today (Wednesday): what came in and went out of the Caisse and BaridiMob.
    const flow = segment(treasury, words.flow, words.cards);
    assert.ok(flow.includes(words.weekdays), `treasury.${lang}: one bar per day, today last`);
    assert.ok(flow.includes(`${words.flowIn} | 414\u202f900`) && flow.includes(`${words.flowOut} | 87\u202f000`), `treasury.${lang}: flow totals`);
    // « How is this computed » opens the lines of the snapshot: they add up to the figures of the card.
    const breakdown = textOf(render(<BreakdownInLanguage/>, lang)).match(/-?\d[\d\u202f]*/g)!.map(amount);
    const total = breakdown.indexOf(Math.round(capitalSnapshot.totalCapital));
    assert.deepEqual(breakdown.slice(0, total), [1_250_000, 480_000, 1_541_524, 375_000, 310_000, -45_000, 14_500], `treasury.${lang}: Caisse, BaridiMob, stock, cards, receivables, advances, services`);
    assert.equal(breakdown.slice(0, total).reduce((sum, value) => sum + value, 0), breakdown[total], `treasury.${lang}: lines add up to the net value`);
    assert.deepEqual(breakdown.slice(total), [3_926_024, -520_000, 3_406_024], `treasury.${lang}: net value, investors, own capital`);

    // ---- Portefeuille: the page and its PAM simulator window ----
    const portfolioHtml = renderPortfolio(lang);
    const simulatorHtml = renderSimulator(lang);
    assertSameNumbers(numbersOf(portfolioHtml, simulatorHtml), BEFORE.portfolio, `portfolio.${lang}`);
    assertSameNumbers(numbersOf(simulatorHtml), BEFORE.simulator, `simulator.${lang}`);
    const portfolio = textOf(portfolioHtml);
    const usdtCard = segment(portfolio, words.usdtCard, words.eurCard);
    assert.ok(usdtCard.includes(words.available) && usdtCard.includes(words.locked), `portfolio.${lang}: available and locked USDT`);
    const batches = usdtCard.match(/\d[\d\u202f]*,\d\d USDT/g);
    assert.deepEqual(batches, ['1\u202f500,00 USDT', '1\u202f500,00 USDT', '1\u202f000,00 USDT'], `portfolio.${lang}: next unlock, then each batch by unlock time`);
    assert.ok(usdtCard.includes(`${words.today} | 05h 30min`), `portfolio.${lang}: next unlock today at 20:30`);
    assert.ok(usdtCard.includes(`${words.in} 05h 30min`) && usdtCard.includes(`${words.tomorrow} | ${words.in} 17h 30min`), `portfolio.${lang}: countdown of each batch`);
    assert.ok(!segment(portfolio, words.eurCard).includes(words.available.split(' | ')[0]), `portfolio.${lang}: no lock on EUR`);

    // ---- Analyse: every tab and the PDF window ----
    const analytics = {
        month: renderAnalytics(lang), year: renderAnalytics(lang, 'year'), alltime: renderAnalytics(lang, 'alltime'), clients: renderAnalytics(lang, 'clients'),
    };
    assertSameNumbers(numbersOf(...Object.values(analytics), renderExportSheet(lang)), BEFORE.analytics, `analytics.${lang}`);
    const month = textOf(analytics.month);
    assert.ok(month.includes(`+18\u202f031 | DZD | ▲ 200.5% | ${words.vsAug}`), `analytics.${lang}: month profit compared with August`);
    assert.ok(month.includes(`${words.winRate} | 75% | ▲ 50.0%`) && month.includes(`${words.avgProfit} | 4\u202f508 | DZD | ▲ 50.3%`), `analytics.${lang}: month tiles`);
    assert.ok(month.includes(`${words.bestSale} | 8\u202f031 | DZD | ${words.thisMonth}`) && month.includes(`${words.winningDays} | 3`), `analytics.${lang}: best sale and winning days`);
    assert.ok(month.includes(`${words.activeDays} | +18\u202f031`) && month.includes(words.calendarDays), `analytics.${lang}: calendar header`);
    assert.ok(month.includes('7 | +8k') && month.includes('14 | +3k') && month.includes('22 | +7k'), `analytics.${lang}: profit days in the calendar`);
    assert.ok(month.includes(`${words.bestDay} | 7 | / | 8\u202f031`) && month.includes(`${words.worstDay} | 14 | / | 3\u202f077`), `analytics.${lang}: best and weakest day`);
    assert.ok(textOf(analytics.year).includes(`33\u202f800 | DZD | ${words.janToSep}`), `analytics.${lang}: profit since January`);
    assert.ok(textOf(analytics.alltime).includes('18\u202f031 | DZD | 2026-09') && textOf(analytics.alltime).includes('6\u202f400 USDT | 300 EUR'), `analytics.${lang}: all time`);
    const topFive = segment(textOf(analytics.clients), words.topFive).match(/[+-]\d[\d\u202f]*/g);
    assert.deepEqual(topFive?.map(amount), [14_954, 3_600, -523], `analytics.${lang}: clients of the month by profit`);
}

console.log('financeScreens.test: Trésorerie, Portefeuille and Analyse show the same numbers as before, in French and Arabic');
