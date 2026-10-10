import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { CurrencyAmount } from '../components/financial/CurrencyAmount';
import type { ClientDzd, ClientTransactionDzd, TreasuryCard, TreasuryTx, Tx } from '../types';
import type { CapitalSnapshot } from '../utils/capitalSnapshot';
import type { PamLedgerResult } from '../utils/pamLedger';
import type { ManagerProfitBreakdown } from '../hooks/useInvestorEconomics';
import type { FinancialAuditData } from '../components/financial/OwnerProfitSummary';
import { LanguageProvider } from '../contexts/LanguageContext';
import { translations } from '../translations';
import type { OwnerProfitSplit } from '../utils/serviceProfitOverview';
import { DashboardPage } from './DashboardPage';

// V4-1: the profit of the other businesses (design, printing, digital services) has a card of its own
// on the Home page, and « mon profit réel » is the USDT and EUR sales alone. This test renders the page
// with the same made-up figures in every case and checks what is shown, where, and that nothing is lost:
// the old total of the page is still what « mon profit » and the new card add up to.

const storage = new Map<string, string>();
(globalThis as { window?: unknown }).window = {
    localStorage: {
        getItem: (key: string) => (storage.has(key) ? storage.get(key)! : null),
        setItem: (key: string, value: string) => { storage.set(key, String(value)); },
        removeItem: (key: string) => { storage.delete(key); },
    },
};
const PERIOD_STORAGE_KEY = 'app_dashboard_profit_period';
const PERIODS = ['today', 'week', 'month', 'year'] as const;
type Period = typeof PERIODS[number];
const noop = () => undefined;

// Made-up figures, none alike, so an amount can only come from where it should.
const dailyOverview = {
    caisse: 1_250_431,
    baridi: 480_217,
    activeClients: 3,
    todayProfit: 12_345.4,
    todaySellCount: 4,
    weekToDateProfit: 43_210.6,
    monthToDateProfit: 184_523.2,
    yearToDateProfit: 1_520_987.7,
    allTimeProfit: 3_004_117,
    todayUsdtSold: 1000,
    todayEurSold: 0,
    monthToDateUsdtSold: 21_000,
    monthToDateEurSold: 900,
    yearToDateUsdtSold: 160_000,
    yearToDateEurSold: 7_000,
    allTimeUsdtSold: 400_000,
    allTimeEurSold: 20_000,
};
const TRADING = { today: 8_100, week: 29_050, month: 121_346, year: 998_765 };
const SERVICES = {
    today: { manual: 3_000, digital: 520 },
    week: { manual: 12_500, digital: 1_875 },
    month: { manual: 31_400, digital: 6_240 },
    year: { manual: 187_250, digital: 42_030 },
    allTime: { manual: 250_900, digital: 55_060 },
};
const split = (services = SERVICES, trading = TRADING): OwnerProfitSplit => ({ trading: { ...trading }, services: JSON.parse(JSON.stringify(services)) });
const withSplit = (value?: OwnerProfitSplit) => {
    const totalOf = (period: Period) => TRADING[period] + SERVICES[period].manual + SERVICES[period].digital;
    return {
        ...dailyOverview,
        // What the page was given before V4-1: one total per period that included the other businesses.
        ownerProfitToday: totalOf('today'),
        ownerProfitWeek: totalOf('week'),
        ownerProfitMonth: totalOf('month'),
        ownerProfitYear: totalOf('year'),
        ownerProfitAllTime: 2_001_002,
        ...(value ? { ownerProfitSplit: value } : {}),
    };
};
const capitalSnapshot: CapitalSnapshot = {
    caisseBalance: 1_250_431, baridiBalance: 480_217, cashTotal: 1_730_648, stockValue: 2_100_559, treasuryCardsTotal: 0,
    receivables: 310_155, clientAdvances: 45_120, netClientPosition: 265_035, serviceReceivables: 0, serviceClientAdvances: 0,
    servicesCapitalImpact: 0, managerPendingAdvances: 0, totalCapital: 4_096_242, investorLiability: 900_333, netOwnedCapital: 3_195_909,
};
const baseProps = {
    managerProfitBreakdown: {} as ManagerProfitBreakdown,
    financialAudit: {} as FinancialAuditData,
    dailyOverview: withSplit(split()),
    portfolioStats: { usdt: { available: 8_000.25, locked: 420.5, avgBuy: 245 }, eur: { available: 1_100, locked: 50.75, avgBuy: 262 } },
    treasuryStats: {},
    totals: {},
    treasuryCards: [] as TreasuryCard[],
    investorLiability: 900_333,
    investorBreakdown: { capital: 800_000, profits: 100_333, total: 900_333 },
    capitalSnapshot,
    globalNetProfit: 0,
    overdueDebtClients: [],
    overdueDebtClientCount: 0,
    isDataReady: true,
    onNewTransaction: noop,
    onOpenClients: noop,
    onOpenClient: noop,
    onOpenClientDebts: noop,
    onOpenTreasury: noop,
    onOpenAnalytics: noop,
    transactions: [] as Tx[],
    clientTransactionsDzd: [] as ClientTransactionDzd[],
    clientsDzd: [] as ClientDzd[],
    treasuryTransactions: [] as TreasuryTx[],
    profitByTxId: {} as PamLedgerResult['profitByTxId'],
    getRelativeDateLabel: (date: string) => date,
    getClientFullName: (client: ClientDzd) => (client as unknown as { fullName: string }).fullName,
    openForm: noop,
    openAdjustmentModal: noop,
    setTxToDelete: noop,
};
type PageProps = Parameters<typeof DashboardPage>[0];

function render(props: Partial<PageProps> = {}, options: { period?: Period; lang?: 'fr' | 'ar' } = {}) {
    storage.clear();
    storage.set(PERIOD_STORAGE_KEY, options.period ?? 'month');
    storage.set('app_lang', options.lang ?? 'fr');
    return renderToStaticMarkup(<LanguageProvider><DashboardPage {...baseProps} {...props}/></LanguageProvider>);
}
function amountsIn(html: string): string[] {
    return [...html.matchAll(/<bdi dir="ltr">(.*?)<\/bdi>/g)].map((match) => match[1]
        .replace(/<!-- -->/g, '')
        .replace(/<span[^>]*>/g, ' ')
        .replace(/<\/span>/g, '')
        .replace(/\s+/g, ' ')
        .trim());
}
const amountText = (value: number) => amountsIn(renderToStaticMarkup(<CurrencyAmount value={value} currency="DZD" decimals={0}/>))[0];
const sections = (html: string) => html.match(/<section[\s\S]*?<\/section>/g) ?? [];
const sectionWith = (html: string, text: string) => sections(html).find((section) => section.includes(text));
const fr = translations.fr as unknown as { dashboard: Record<string, string>; digitalServices: Record<string, string> };
const ar = translations.ar as unknown as typeof fr;
const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/'/g, '&#x27;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const periodKey = { today: 'ownerProfitToday', week: 'ownerProfitWeek', month: 'ownerProfitMonth', year: 'ownerProfitYear' } as const;
const cardTitle = (lang: typeof fr) => escapeHtml(lang.dashboard.otherProfitsTitle);
// The period sits above the amount, alone in its line.
const periodCaption = (lang: typeof fr, period: Period) => `>${escapeHtml(lang.dashboard[periodKey[period]])}<`;
const linkIn = (card: string, label: string) => card.includes(`>${escapeHtml(label)}<svg`) && card.includes('<button');

// ---- 1. For every period: « mon profit » is the sales alone, the card shows the other businesses, and they add up to the old total ----
for (const period of PERIODS) {
    const html = render({}, { period });
    const hero = sectionWith(html, escapeHtml(fr.dashboard.profitSummary));
    assert.ok(hero, `${period}: the hero card is there`);
    const heroAmounts = amountsIn(hero!);
    assert.equal(heroAmounts[0], amountText(([dailyOverview.todayProfit, dailyOverview.weekToDateProfit, dailyOverview.monthToDateProfit, dailyOverview.yearToDateProfit])[PERIODS.indexOf(period)]), `${period}: the sales profit is as before`);
    assert.equal(heroAmounts[1], amountText(TRADING[period]), `${period}: « mon profit » is the USDT and EUR sales alone`);
    assert.ok(hero!.includes(escapeHtml(fr.dashboard.ownerProfitSummaryTradingHint)), `${period}: its line says so`);
    assert.ok(!hero!.includes(escapeHtml(fr.dashboard.ownerProfitSummaryHint)), `${period}: the old line (which included the services) is gone`);
    const oldTotal = TRADING[period] + SERVICES[period].manual + SERVICES[period].digital;
    assert.ok(!heroAmounts.includes(amountText(oldTotal)), `${period}: the old total is not shown as « mon profit »`);

    const card = sectionWith(html, cardTitle(fr));
    assert.ok(card, `${period}: the card of the other businesses is there`);
    assert.ok(card!.includes(periodCaption(fr, period)), `${period}: it names the period, ${fr.dashboard[periodKey[period]]}`);
    for (const other of PERIODS.filter((candidate) => candidate !== period))
        assert.ok(!card!.includes(periodCaption(fr, other)), `${period}: and not ${other}`);
    const cardAmounts = amountsIn(card!);
    const { manual, digital } = SERVICES[period];
    assert.deepEqual(cardAmounts, [amountText(manual + digital), amountText(manual), amountText(digital)], `${period}: total, services and digital services`);
    assert.ok(card!.includes(escapeHtml(fr.dashboard.otherProfitsServices)) && card!.includes(escapeHtml(fr.digitalServices.short)), `${period}: both lines are named`);
    assert.ok(card!.includes(escapeHtml(fr.dashboard.otherProfitsHint)), `${period}: the card says it is apart from the sales`);
    // Nothing is lost: what « mon profit » and the card show add up to what the page showed before.
    assert.equal(TRADING[period] + (manual + digital), oldTotal, `${period}: sales + other businesses = the old total`);
    // The sales profit is never mixed into the card, and the other periods' amounts are not shown.
    assert.ok(!cardAmounts.includes(amountText(TRADING[period])), `${period}: the card has no sales profit`);
    for (const other of PERIODS.filter((candidate) => candidate !== period))
        assert.ok(!amountsIn(html).includes(amountText(SERVICES[other].manual + SERVICES[other].digital)), `${period}: the ${other} figures of the card are hidden`);
    // Order on the page: the hero, then the card, then the balances.
    assert.ok(html.indexOf(escapeHtml(fr.dashboard.profitSummary)) < html.indexOf(cardTitle(fr)), `${period}: the card comes under the hero`);
    assert.ok(html.indexOf(cardTitle(fr)) < html.indexOf(escapeHtml((translations.fr as unknown as { common: Record<string, string> }).common.caisseBalance)), `${period}: and above the balances`);
}

// ---- 2. Only the businesses that have earned something get a line ----
{
    const onlyManual = split({ ...SERVICES, allTime: { manual: 250_900, digital: 0 }, month: { manual: 31_400, digital: 0 } });
    const html = render({ dailyOverview: withSplit(onlyManual) });
    const card = sectionWith(html, cardTitle(fr))!;
    assert.deepEqual(amountsIn(card), [amountText(31_400), amountText(31_400)], 'services only: the total and one line');
    assert.ok(card.includes(escapeHtml(fr.dashboard.otherProfitsServices)) && !card.includes(escapeHtml(fr.digitalServices.short)), 'no digital line');
    const onlyDigital = split({ ...SERVICES, allTime: { manual: 0, digital: 55_060 }, month: { manual: 0, digital: 6_240 } });
    const card2 = sectionWith(render({ dailyOverview: withSplit(onlyDigital) }), cardTitle(fr))!;
    assert.deepEqual(amountsIn(card2), [amountText(6_240), amountText(6_240)], 'digital only: the total and one line');
    assert.ok(card2.includes(escapeHtml(fr.digitalServices.short)) && !card2.includes(escapeHtml(fr.dashboard.otherProfitsServices)), 'no services line');
}

// ---- 3. No other business yet: no card, and « mon profit » is still the sales alone ----
{
    const none = split({ today: { manual: 0, digital: 0 }, week: { manual: 0, digital: 0 }, month: { manual: 0, digital: 0 }, year: { manual: 0, digital: 0 }, allTime: { manual: 0, digital: 0 } });
    const html = render({ dailyOverview: { ...dailyOverview, ownerProfitToday: 8_100, ownerProfitWeek: 29_050, ownerProfitMonth: 121_346, ownerProfitYear: 998_765, ownerProfitAllTime: 2_001_002, ownerProfitSplit: none } });
    assert.ok(!html.includes(escapeHtml(fr.dashboard.otherProfitsTitle)), 'no card without any other business');
    assert.equal(amountsIn(sectionWith(html, escapeHtml(fr.dashboard.profitSummary))!)[1], amountText(121_346), '« mon profit » is as before');
}

// ---- 4. An empty period shows zeros, since the businesses are in use ----
{
    const quiet = split({ ...SERVICES, today: { manual: 0, digital: 0 } });
    const card = sectionWith(render({ dailyOverview: withSplit(quiet) }, { period: 'today' }), cardTitle(fr))!;
    assert.deepEqual(amountsIn(card), [amountText(0), amountText(0), amountText(0)], 'zero today, lines still there');
    assert.ok(card.includes(periodCaption(fr, 'today')), 'it says today');
    assert.ok(!card.includes('text-financial-loss') && !card.includes('text-financial-profit'), 'zero is neither a profit nor a loss');
}

// ---- 5. A digital service sold at a loss is shown as a loss ----
{
    const losing = split({ ...SERVICES, month: { manual: 1_000, digital: -4_500 }, allTime: { manual: 250_900, digital: -4_500 } });
    const card = sectionWith(render({ dailyOverview: withSplit(losing) }), cardTitle(fr))!;
    assert.deepEqual(amountsIn(card), [amountText(-3_500), amountText(1_000), amountText(-4_500)], 'total and lines, with the loss');
    assert.ok(card.includes('text-financial-loss') && card.includes('text-financial-profit'), 'the loss is red and the profit green');
}

// ---- 6. The card opens the Services page, when the page can ----
{
    const withLink = sectionWith(render({ onOpenServices: noop }), cardTitle(fr))!;
    assert.ok(linkIn(withLink, fr.dashboard.otherProfitsOpen), 'a button to the services');
    const without = sectionWith(render(), cardTitle(fr))!;
    assert.ok(!without.includes('<button'), 'no button without the link');
}

// ---- 7. Without the split (the stored summary has only the total), the page is what it was ----
{
    const html = render({ dailyOverview: withSplit() });
    const hero = sectionWith(html, escapeHtml(fr.dashboard.profitSummary))!;
    const oldTotal = TRADING.month + SERVICES.month.manual + SERVICES.month.digital;
    assert.equal(amountsIn(hero)[1], amountText(oldTotal), 'the total that includes the other businesses');
    assert.ok(hero.includes(escapeHtml(fr.dashboard.ownerProfitSummaryHint)) && !hero.includes(escapeHtml(fr.dashboard.ownerProfitSummaryTradingHint)), 'with its old line');
    assert.ok(!html.includes(escapeHtml(fr.dashboard.otherProfitsTitle)), 'and no card');
}

// ---- 8. Arabic: the same amounts, in Arabic ----
{
    for (const period of PERIODS) {
        const htmlAr = render({ onOpenServices: noop }, { period, lang: 'ar' });
        const htmlFr = render({ onOpenServices: noop }, { period, lang: 'fr' });
        const cardAr = sectionWith(htmlAr, cardTitle(ar));
        assert.ok(cardAr, `${period}: the Arabic card is there`);
        assert.deepEqual(amountsIn(cardAr!), amountsIn(sectionWith(htmlFr, cardTitle(fr))!), `${period}: same amounts in both languages`);
        assert.ok(cardAr!.includes(periodCaption(ar, period)), `${period}: the period in Arabic`);
        assert.ok(cardAr!.includes(ar.dashboard.otherProfitsServices) && cardAr!.includes(ar.digitalServices.short) && cardAr!.includes(ar.dashboard.otherProfitsHint) && linkIn(cardAr!, ar.dashboard.otherProfitsOpen), `${period}: lines, hint and button in Arabic`);
        const text = cardAr!.replace(/<[^>]*>/g, ' ');
        assert.ok(!/[A-Za-zÀ-ÿ]{4,}/.test(text.replace(/\bDZD\b/g, '')), `${period}: no French left in the Arabic card (${text.replace(/\s+/g, ' ').trim()})`);
        const heroAr = sectionWith(htmlAr, ar.dashboard.profitSummary)!;
        assert.ok(heroAr.includes(ar.dashboard.ownerProfitSummaryTradingHint), `${period}: Arabic line of « mon profit »`);
    }
    assert.equal(ar.dashboard.otherProfitsTitle, 'أرباح الأعمال الأخرى');
}

console.log('DashboardServiceProfit tests passed');
