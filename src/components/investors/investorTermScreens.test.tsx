process.env.TZ = 'Africa/Algiers';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LanguageProvider } from '../../contexts/LanguageContext';
import { translations } from '../../translations';
import { CurrencyAmount } from '../financial/CurrencyAmount';
import { InvestorTermAlert, InvestorTermBadge } from './InvestorTermAlert';
import { InvestorsListSection } from './InvestorsListSection';
import { InvestorDetailsPage } from '../../pages/InvestorDetailsPage';
import { DashboardPage } from '../../pages/DashboardPage';
import { MainContentArea } from '../main/MainContentArea';
import { useNotifications } from '../../hooks/useNotifications';
import { investorTermWhenText, openInvestorTerm, type InvestorTerm } from '../../utils/investorTerms';
import type { DerivedInvestor } from '../../hooks/useInvestorEconomics';
import type { CapitalSnapshot } from '../../utils/capitalSnapshot';
import type { OverdueDebtClient } from '../../types';
import type { WeeklyRecap } from '../../hooks/useWeeklyRecap';

// V3-4 screens: the quarterly term card (home and investor page), the mark in the investor list,
// the order of the home alerts, and the phone notification. Without an open term, every screen
// renders exactly as before; with one, the card shows the investor list's own profit figure.

const storage = new Map<string, string>();
const fakeStorage = {
    getItem: (key: string) => (storage.has(key) ? storage.get(key)! : null),
    setItem: (key: string, value: string) => { storage.set(key, String(value)); },
    removeItem: (key: string) => { storage.delete(key); },
};
const notifications: Array<{ title: string; body?: string; tag?: string }> = [];
class FakeNotification {
    static permission = 'granted';
    static requestPermission() { return Promise.resolve('granted'); }
    constructor(title: string, options?: { body?: string; tag?: string }) { notifications.push({ title, body: options?.body, tag: options?.tag }); }
}
(globalThis as { window?: unknown }).window = { localStorage: fakeStorage, matchMedia: () => ({ matches: false }), Notification: FakeNotification };
(globalThis as { localStorage?: unknown }).localStorage = fakeStorage;
(globalThis as { Notification?: unknown }).Notification = FakeNotification;

type Lang = 'fr' | 'ar';
function render(node: React.ReactElement, lang: Lang = 'fr') {
    storage.set('app_lang', lang);
    return renderToStaticMarkup(<LanguageProvider>{node}</LanguageProvider>);
}
const noop = () => undefined;
const text = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&#x27;/g, '\'').replace(/&amp;/g, '&');
const figure = (value: string | number) => `<bdi dir="ltr" class="tabular-nums">${value}</bdi>`;
const amountsIn = (html: string) => [...html.matchAll(/<bdi dir="ltr">(.*?)<\/bdi>/g)].map((match) => match[1].replace(/<!-- -->/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
const amountOf = (value: number) => amountsIn(renderToStaticMarkup(<CurrencyAmount value={value} currency="DZD" decimals={0}/>))[0];
const translate = (lang: Lang) => (key: string): unknown => key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], translations[lang]);

// ---- Fake investors (made-up names and amounts), clock on Saturday 10/10/2026 18:00 ----
const NOW = new Date(2026, 9, 10, 18).getTime();
function investor(fields: Partial<DerivedInvestor> & Pick<DerivedInvestor, 'id' | 'name' | 'entryDate'>): DerivedInvestor {
    return {
        capitalInvested: 300_000, initialCapital: 300_000, sharePercentage: 0.2, totalProfit: 90_000, withdrawnProfit: 0, availableProfit: 0,
        isActive: true, entryTs: new Date(fields.entryDate).getTime(), txs: [], hasCapitalMovements: true, reinvestedProfit: 0,
        profitWithdrawals: 0, personalExpenses: 0, currentPersonalExpenses: 0, totalPersonalExpenses: 0, managerCapital: null,
        accountingWarnings: [], displayAvailableProfit: fields.availableProfit ?? 0, roi: 12.5,
        ...fields,
    };
}
const manager = investor({ id: 'inv-m', name: 'Gérant Test', entryDate: '2025-01-15', isManager: true, capitalInvested: 1_000_000 });
const karim = investor({ id: 'inv-k', name: 'Karim Test', entryDate: '2026-07-15T10:00:00.000Z', availableProfit: 85_000.4, displayAvailableProfit: 85_000 });
const sami = investor({ id: 'inv-s', name: 'Sami Test', entryDate: '2026-04-08', capitalInvested: 450_000, availableProfit: 52_067.08, displayAvailableProfit: 52_067 });
const lina = investor({ id: 'inv-l', name: 'Lina Test', entryDate: '2026-04-09', capitalInvested: 120_000, availableProfit: -3_200.4, displayAvailableProfit: -3_200 });
const nadia = investor({ id: 'inv-n', name: 'Nadia Test', entryDate: '2026-04-16', availableProfit: 30_496.6, displayAvailableProfit: 30_497 });
const termOf = (who: DerivedInvestor) => {
    const term = openInvestorTerm(who, [], NOW);
    assert.ok(term, `${who.name} has an open term`);
    return term;
};
const karimTerm = termOf(karim);
const samiTerm = termOf(sami);
const linaTerm = termOf(lina);
assert.equal(karimTerm.daysLeft, 5);
assert.equal(samiTerm.daysLeft, -2);
assert.equal(linaTerm.daysLeft, -1);

// ---- 1. The card, French ----
{
    const html = render(<InvestorTermAlert term={karimTerm} onReinvest={noop} onWithdraw={noop} onSnooze={noop}/>);
    assert.ok(html.includes('Échéance des 3 mois : <bdi>Karim Test</bdi>'), 'title with the name');
    assert.ok(html.includes(`Le ${figure('15/10/2026')}, dans ${figure(5)} jours`), 'when: in 5 days');
    assert.ok(text(html).includes('Profit disponible'), 'profit label');
    assert.deepEqual(amountsIn(html), [amountOf(85_000)], 'the whole-dinar profit, the only amount');
    for (const label of ['Réinvestir le profit', 'Retirer le profit', 'Me le rappeler dans 3 jours'])
        assert.ok(html.includes(`>${label}</button>`), `button ${label}`);
    assert.ok(!html.includes('disabled=""'), 'every button active');
    assert.ok(html.includes('bg-financial-asset-bg'), 'coming term: information tone');

    const late = render(<InvestorTermAlert term={samiTerm} onReinvest={noop} onWithdraw={noop}/>);
    assert.ok(late.includes(`Le ${figure('08/10/2026')}, il y a ${figure(2)} jours`), 'when: 2 days ago');
    assert.ok(late.includes('bg-financial-debt-bg'), 'late term: warning tone');
    assert.ok(!late.includes('Me le rappeler'), 'no « remind me » without its action');

    const owing = render(<InvestorTermAlert term={linaTerm} onReinvest={noop} onWithdraw={noop}/>);
    assert.ok(text(owing).includes('Solde à régulariser'), 'a negative balance is a balance to settle, as in the list');
    assert.deepEqual(amountsIn(owing), [amountOf(3_200)], 'shown without its sign');
    assert.ok(owing.includes('text-financial-loss'), 'in red');
    assert.match(owing, /<button[^>]*disabled=""[^>]*>Réinvestir le profit<\/button>/, 'nothing to reinvest: the button is off');

    const own = render(<InvestorTermAlert term={karimTerm} showName={false} onReinvest={noop} onWithdraw={noop}/>);
    assert.ok(own.includes('>Échéance des 3 mois<') && !own.includes('Karim Test'), 'on the investor page, no name');
}

// ---- 2. The card, Arabic, and how Arabic counts days ----
{
    const html = render(<InvestorTermAlert term={karimTerm} onReinvest={noop} onWithdraw={noop} onSnooze={noop}/>, 'ar');
    assert.ok(html.includes('موعد الأشهر الثلاثة: <bdi>Karim Test</bdi>'), 'Arabic title');
    assert.ok(html.includes(`الموعد ${figure('15/10/2026')}، بعد ${figure(5)} أيام`), 'the plan example: « الموعد 15/10/2026، بعد 5 أيام »');
    assert.ok(text(html).includes('الربح المتاح'), 'Arabic profit label');
    for (const label of ['إعادة استثمار الربح', 'سحب الربح', 'ذكّرني بعد 3 أيام'])
        assert.ok(html.includes(`>${label}</button>`), `Arabic button ${label}`);
    const late = render(<InvestorTermAlert term={samiTerm} onReinvest={noop} onWithdraw={noop}/>, 'ar');
    assert.ok(late.includes(`كان الموعد ${figure('08/10/2026')}، منذ يومين`), 'two days: « يومين »');

    const day = (daysLeft: number) => ({ daysLeft, state: daysLeft > 0 ? 'upcoming' as const : daysLeft === 0 ? 'due' as const : 'overdue' as const, termTs: new Date(2026, 9, 10 + daysLeft).getTime() });
    const ar = translate('ar');
    const fr = translate('fr');
    assert.equal(investorTermWhenText(day(1), ar), 'الموعد 11/10/2026، بعد يوم واحد');
    assert.equal(investorTermWhenText(day(2), ar), 'الموعد 12/10/2026، بعد يومين');
    assert.equal(investorTermWhenText(day(3), ar), 'الموعد 13/10/2026، بعد 3 أيام');
    assert.equal(investorTermWhenText(day(7), ar), 'الموعد 17/10/2026، بعد 7 أيام');
    assert.equal(investorTermWhenText(day(0), ar), 'الموعد اليوم، 10/10/2026');
    assert.equal(investorTermWhenText(day(-10), ar), 'كان الموعد 30/09/2026، منذ 10 أيام');
    assert.equal(investorTermWhenText(day(-11), ar), 'كان الموعد 29/09/2026، منذ 11 يوماً');
    assert.equal(investorTermWhenText(day(1), fr), 'Le 11/10/2026, dans 1 jour');
    assert.equal(investorTermWhenText(day(0), fr), 'Aujourd’hui, le 10/10/2026');
    assert.equal(investorTermWhenText(day(-45), fr), 'Le 26/08/2026, il y a 45 jours');
}

// ---- 3. The mark in the investor list ----
{
    assert.ok(render(<InvestorTermBadge term={karimTerm}/>).includes(`Échéance dans ${figure(5)} jours`), 'FR coming');
    assert.ok(render(<InvestorTermBadge term={{ ...karimTerm, daysLeft: 0, state: 'due' }}/>).includes('Échéance aujourd’hui'), 'FR today');
    assert.ok(render(<InvestorTermBadge term={samiTerm}/>).includes('Échéance passée'), 'FR late');
    assert.ok(render(<InvestorTermBadge term={karimTerm}/>, 'ar').includes(`الموعد بعد ${figure(5)} أيام`), 'AR coming');
    assert.ok(render(<InvestorTermBadge term={{ ...karimTerm, daysLeft: 0, state: 'due' }}/>, 'ar').includes('الموعد اليوم'), 'AR today');
    assert.ok(render(<InvestorTermBadge term={samiTerm}/>, 'ar').includes('فات الموعد'), 'AR late');

    const investors = [manager, karim, sami, nadia, lina];
    const list = (terms?: ReadonlyMap<string, InvestorTerm>, lang: Lang = 'fr') => render(<InvestorsListSection investors={investors} activeCount={5} onOpenInvestor={noop} onEditInvestor={noop} onDeleteInvestor={noop} termsByInvestorId={terms}/>, lang);
    const before = list();
    assert.equal(list(new Map()), before, 'no open term: the list is unchanged');
    const marked = list(new Map([[karimTerm.investorId, karimTerm], [samiTerm.investorId, samiTerm]]));
    assert.equal((marked.match(/Échéance /g) || []).length, 2, 'two marks');
    const rowOf = (html: string, name: string) => html.slice(html.indexOf(name), html.indexOf(name) + 1500);
    assert.ok(rowOf(marked, 'Karim Test').includes(`Échéance dans ${figure(5)} jours`), 'Karim marked');
    assert.ok(rowOf(marked, 'Sami Test').includes('Échéance passée'), 'Sami marked');
    assert.ok(!rowOf(marked, 'Nadia Test').includes('Échéance'), 'Nadia not marked');
    assert.deepEqual(amountsIn(marked), amountsIn(before), 'the same amounts as before, in the same order');
    // The card shows the figure the list shows for the same investor.
    const karimCard = render(<InvestorTermAlert term={karimTerm} onReinvest={noop} onWithdraw={noop}/>);
    assert.ok(amountsIn(rowOf(before, 'Karim Test')).includes(`+${amountOf(85_000)}`), 'the list shows +85 000');
    assert.deepEqual(amountsIn(karimCard), [amountOf(85_000)], 'and the card the same 85 000, without the plus sign');
}

// ---- 4. The investor page ----
{
    const capitalSnapshot = { netOwnedCapital: 3_000_000 } as CapitalSnapshot;
    const pageOf = (who: DerivedInvestor, term?: InvestorTerm | null) => render(<InvestorDetailsPage investor={who} transactions={[]} onBack={noop} onAddCapital={noop} onWithdrawCapital={noop} onWithdrawProfit={noop} onReinvestProfit={noop} onDeleteTransaction={noop} onExportReport={noop} globalNetProfit={0} managerFeePercentage={20} totalCapital={1_000_000} capitalSnapshot={capitalSnapshot} {...(term === undefined ? {} : { term })}/>);
    const before = pageOf(karim);
    assert.equal(pageOf(karim, null), before, 'no term: the page is unchanged');
    assert.equal(pageOf(karim, samiTerm), before, 'another investor\'s term is not shown');
    const withTerm = pageOf(karim, karimTerm);
    assert.ok(withTerm.indexOf('Échéance des 3 mois') > 0 && withTerm.indexOf('Échéance des 3 mois') < withTerm.indexOf('Capital des investisseurs externes'), 'the card sits above the capital');
    assert.ok(!withTerm.includes('Me le rappeler'), 'no « remind me » on the investor page');
    assert.ok(withTerm.includes('>Réinvestir le profit</button>') && withTerm.includes('>Retirer le profit</button>'), 'the two windows');
    assert.deepEqual(amountsIn(withTerm.replace(/^[\s\S]*?Capital des investisseurs externes/, '')), amountsIn(before.replace(/^[\s\S]*?Capital des investisseurs externes/, '')), 'the rest of the page shows the same amounts');
}

// ---- 5. The home alerts: the most urgent first, folded after two ----
{
    const overdue: OverdueDebtClient = { clientId: 'd1', fullName: 'Client Test', overdueAmount: 12_000, daysOverdue: 9, oldestUnpaidTimestamp: NOW - 16 * 86_400_000, oldestUnpaidDate: '24/09/2026', lastPaymentTimestamp: null, balance: -12_000 };
    const weeklyRecap: WeeklyRecap = { weekKey: '2026-W40', weekLabel: 'Semaine', profit: 43_200.5, sellCount: 18, usdtSold: 12_000.4, eurSold: 0, activeDays: 5, topClientName: null, topClientProfit: 0 };
    const capitalSnapshot = { caisseBalance: 900_000, baridiBalance: 100_000, cashTotal: 1_000_000, receivables: 12_000, clientAdvances: 0 } as CapitalSnapshot;
    const dailyOverview = { caisse: 900_000, baridi: 100_000, activeClients: 1, todayProfit: 0, monthToDateProfit: 54_400, yearToDateProfit: 300_000, allTimeProfit: 400_000, todayUsdtSold: 0, todayEurSold: 0, monthToDateUsdtSold: 0, monthToDateEurSold: 0, yearToDateUsdtSold: 0, yearToDateEurSold: 0, allTimeUsdtSold: 0, allTimeEurSold: 0, ownerProfitToday: 0, ownerProfitWeek: 0, ownerProfitMonth: 30_966, ownerProfitYear: 0, ownerProfitAllTime: 0 };
    const baseProps = {
        managerProfitBreakdown: {} as never, financialAudit: {} as never, dailyOverview, portfolioStats: { usdt: { available: 18_000, locked: 0, avgBuy: 244.6 }, eur: { available: 0, locked: 0 } },
        treasuryStats: {}, totals: {}, treasuryCards: [], capitalSnapshot, globalNetProfit: 0, overdueDebtClients: [] as OverdueDebtClient[], isDataReady: true,
        onNewTransaction: noop, onOpenClients: noop, onOpenClient: noop, onOpenClientDebts: noop, onOpenTreasury: noop, onOpenAnalytics: noop,
        transactions: [], clientTransactionsDzd: [], clientsDzd: [], treasuryTransactions: [], profitByTxId: {}, getRelativeDateLabel: (date: string) => date,
        getClientFullName: () => '', openForm: noop, openAdjustmentModal: noop, setTxToDelete: noop, weeklyRecap,
    };
    const termProps = { investorTerms: [samiTerm, karimTerm], onInvestorTermReinvest: noop, onInvestorTermWithdraw: noop, onInvestorTermSnooze: noop };
    const home = (props: Record<string, unknown>) => render(<DashboardPage {...baseProps} {...props}/>);
    const labels = translations.fr.dashboard;
    const before = home({});
    assert.ok(before.includes(labels.weeklyRecapTitle), 'before: the weekly recap shows');
    assert.equal(home({ investorTerms: [], onInvestorTermReinvest: noop, onInvestorTermWithdraw: noop }), before, 'no open term: the home page is unchanged');
    assert.equal(home({ investorTerms: [samiTerm] }), before, 'without the window actions, no card');

    const terms = home(termProps);
    const sIndex = terms.indexOf('Sami Test');
    const kIndex = terms.indexOf('Karim Test');
    assert.ok(sIndex > 0 && kIndex > sIndex, 'the late term first, then the coming one');
    assert.ok(!terms.includes(labels.weeklyRecapTitle) && terms.includes(labels.moreAlerts.replace('{count}', '1')), 'the weekly recap folds behind them');
    assert.equal((terms.match(/>Me le rappeler dans 3 jours</g) || []).length, 2, 'each home card can be put off');

    const withDebts = home({ ...termProps, overdueDebtClients: [overdue], overdueDebtClientCount: 1 });
    assert.ok(withDebts.includes(labels.overdueClientsOne), 'the late clients alert stays');
    assert.ok(withDebts.indexOf(labels.overdueClientsOne) < withDebts.indexOf('Sami Test'), 'late clients first');
    assert.ok(!withDebts.includes('Karim Test') && withDebts.includes(labels.moreAlerts.replace('{count}', '2')), 'the second term folds');
    assert.deepEqual(amountsIn(home({ ...termProps, investorTerms: [] })), amountsIn(before), 'the home amounts are the same as before');
}

// ---- 6. The memo of the main area redraws when the terms change ----
{
    const compare = (MainContentArea as unknown as { compare: (prev: Record<string, unknown>, next: Record<string, unknown>) => boolean }).compare;
    const dailyOverview = {};
    const dashboardPageProps = { investorTerms: [samiTerm] };
    const prev = { t: noop, isFinancialDataReady: true, view: 'dashboard', dailyOverview, dashboardPageProps };
    assert.equal(compare(prev, { ...prev, dashboardPageProps: { ...dashboardPageProps } }), true, 'same terms: no redraw');
    assert.equal(compare(prev, { ...prev, dashboardPageProps: { investorTerms: [] } }), false, 'a term put off or settled: the home page redraws');
    const termsBefore = new Map([[samiTerm.investorId, samiTerm]]);
    const investorsPrev = { t: noop, isFinancialDataReady: true, view: 'investors', dailyOverview, investorTermsByInvestorId: termsBefore };
    assert.equal(compare(investorsPrev, { ...investorsPrev }), true, 'investors page: same terms, no redraw');
    assert.equal(compare(investorsPrev, { ...investorsPrev, investorTermsByInvestorId: new Map() }), false, 'investors page: new terms, redraw');
}

// ---- 7. The phone notification: once a day, by name, in the app's language ----
{
    let api: ReturnType<typeof useNotifications> | null = null;
    function Probe({ t }: { t?: (key: string) => unknown }) {
        api = useNotifications(undefined, t);
        return null;
    }
    const withLanguage = (t?: (key: string) => unknown) => {
        renderToStaticMarkup(<Probe t={t}/>);
        assert.ok(api, 'the hook answers');
        return api;
    };
    const fresh = () => { notifications.length = 0; storage.delete('app_notif_last_investor_terms'); };

    fresh();
    let notify = withLanguage(translate('fr'));
    notify.notifyInvestorTerms([samiTerm, karimTerm]);
    assert.deepEqual(notifications, [{ title: '📅 2 échéances d’investisseurs', body: 'Sami Test, Karim Test : réinvestir ou retirer le profit.', tag: 'investor-terms' }], 'two terms by name');
    notify.notifyInvestorTerms([samiTerm, karimTerm]);
    assert.equal(notifications.length, 1, 'not twice the same day');

    fresh();
    notify.notifyInvestorTerms([samiTerm]);
    assert.deepEqual(notifications[0], { title: '📅 Échéance des 3 mois : Sami Test', body: 'Le 08/10/2026, il y a 2 jours', tag: 'investor-terms' }, 'one term with its day');

    fresh();
    notify.notifyInvestorTerms([samiTerm, karimTerm, linaTerm, { ...karimTerm, investorName: 'Autre Test' }]);
    assert.equal(notifications[0].body, 'Sami Test, Karim Test et 2 autres : réinvestir ou retirer le profit.', 'more than two: the first two and the count');

    fresh();
    notify = withLanguage(translate('ar'));
    notify.notifyInvestorTerms([samiTerm]);
    assert.deepEqual(notifications[0], { title: '📅 موعد الأشهر الثلاثة: Sami Test', body: 'كان الموعد 08/10/2026، منذ يومين', tag: 'investor-terms' }, 'Arabic');

    fresh();
    notify = withLanguage(undefined);
    notify.notifyInvestorTerms([karimTerm]);
    assert.deepEqual(notifications[0], { title: '📅 Échéance des 3 mois : Karim Test', body: 'Le 15/10/2026, dans 5 jours', tag: 'investor-terms' }, 'without a translation, the French text');

    fresh();
    notify.notifyInvestorTerms([]);
    assert.equal(notifications.length, 0, 'no term, no notification');
    FakeNotification.permission = 'default';
    notify.notifyInvestorTerms([karimTerm]);
    assert.equal(notifications.length, 0, 'notifications not allowed: nothing');
    FakeNotification.permission = 'granted';
}

console.log('investor term screens tests passed');
