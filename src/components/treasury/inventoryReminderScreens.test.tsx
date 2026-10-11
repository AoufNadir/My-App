process.env.TZ = 'Africa/Algiers';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LanguageProvider } from '../../contexts/LanguageContext';
import { translations } from '../../translations';
import { InventoryReminderAlert } from './InventoryReminderAlert';
import { DashboardPage } from '../../pages/DashboardPage';
import { MainContentArea } from '../main/MainContentArea';
import { useNotifications } from '../../hooks/useNotifications';
import { useInventoryReminder } from '../../hooks/useInventoryReminder';
import type { InventoryReminder } from '../../utils/inventoryReminder';
import type { CapitalSnapshot } from '../../utils/capitalSnapshot';
import type { OverdueDebtClient } from '../../types';
import type { WeeklyRecap } from '../../hooks/useWeeklyRecap';

// V5-4: the daily reminder to count the cash. The home card, its place among the alerts, the redraw
// of the main area and the phone notification. The reminder only talks about WHEN the last count was
// saved: with it off, every screen renders exactly as before, and with it on no balance is added.

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
const amountsIn = (html: string) => [...html.matchAll(/<bdi dir="ltr">(.*?)<\/bdi>/g)].map((match) => match[1].replace(/<!-- -->/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
const translate = (lang: Lang) => (key: string): unknown => key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], translations[lang]);

const never: InventoryReminder = { daysSince: null, lastTimestamp: null };
const yesterday: InventoryReminder = { daysSince: 1, lastTimestamp: 1 };
const fiveDays: InventoryReminder = { daysSince: 5, lastTimestamp: 1 };

// ---- 1. The card: the sentence for each case, the two buttons, no balance ----
{
    const card = (reminder: InventoryReminder, lang: Lang) => render(<InventoryReminderAlert reminder={reminder} onOpen={noop} onSnooze={noop}/>, lang);
    for (const lang of ['fr', 'ar'] as const) {
        const words = translations[lang].inventoryReminder;
        assert.ok(text(card(never, lang)).includes(words.never), `${lang}: never counted`);
        assert.ok(text(card(yesterday, lang)).includes(words.yesterday), `${lang}: counted yesterday`);
        const days = text(card(fiveDays, lang));
        assert.ok(days.includes(words.days.split('{days}')[0]) && days.includes('5'), `${lang}: counted 5 days ago`);
        assert.ok(!days.includes('{'), `${lang}: no placeholder left`);
        for (const reminder of [never, yesterday, fiveDays]) {
            const html = card(reminder, lang);
            assert.ok(text(html).includes(words.title), `${lang}: title`);
            assert.ok(html.includes(`>${words.open}</button>`), `${lang}: the button that opens the inventory`);
            assert.ok(html.includes(`>${words.snooze}</button>`), `${lang}: the « tomorrow » button`);
            assert.equal(amountsIn(html).length, 0, `${lang}: no amount on the card`);
        }
    }
    // Three days or more: a warning tone instead of the information tone.
    assert.notEqual(card(yesterday, 'fr').replace(/Dernier inventaire.*?</, '<'), card(fiveDays, 'fr').replace(/Dernier inventaire.*?</, '<'), 'a late count is not drawn like yesterday\'s');
}

// ---- 2. The home page: unchanged without a reminder, the card among the alerts with one ----
{
    const NOW = new Date(2026, 9, 10, 18).getTime();
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
    const home = (props: Record<string, unknown>, lang: Lang = 'fr') => render(<DashboardPage {...baseProps} {...props}/>, lang);
    const labels = translations.fr.dashboard;
    const words = translations.fr.inventoryReminder;
    const before = home({});
    assert.ok(before.includes(labels.weeklyRecapTitle) && !before.includes(words.title), 'before: the weekly recap, no reminder');
    assert.equal(home({ inventoryReminder: null, onInventoryReminderSnooze: noop }), before, 'no reminder: the home page is unchanged');
    assert.equal(home({ inventoryReminder: fiveDays }), before, 'without the « tomorrow » action, no card');

    const withReminder = home({ inventoryReminder: fiveDays, onInventoryReminderSnooze: noop });
    assert.ok(withReminder.includes(words.title), 'the reminder shows');
    assert.deepEqual(amountsIn(withReminder), amountsIn(before), 'the same amounts as before: the card adds none');
    assert.ok(withReminder.indexOf(words.title) < withReminder.indexOf(labels.weeklyRecapTitle) || !withReminder.includes(labels.weeklyRecapTitle), 'the reminder comes before the weekly recap');
    // Two cards show, the rest folds: late clients first, then the reminder, the recap folds.
    const withDebts = home({ inventoryReminder: fiveDays, onInventoryReminderSnooze: noop, overdueDebtClients: [overdue], overdueDebtClientCount: 1 });
    assert.ok(withDebts.indexOf(labels.overdueClientsOne) < withDebts.indexOf(words.title), 'late clients first');
    assert.ok(!withDebts.includes(labels.weeklyRecapTitle) && withDebts.includes(labels.moreAlerts.replace('{count}', '1')), 'the weekly recap folds behind them');
    // Arabic.
    const ar = home({ inventoryReminder: never, onInventoryReminderSnooze: noop }, 'ar');
    assert.ok(ar.includes(translations.ar.inventoryReminder.title) && ar.includes(translations.ar.inventoryReminder.never), 'Arabic card');
}

// ---- 3. The main area redraws when the reminder changes ----
{
    const compare = (MainContentArea as unknown as { compare: (prev: Record<string, unknown>, next: Record<string, unknown>) => boolean }).compare;
    const prev = { t: noop, isFinancialDataReady: true, view: 'dashboard', dailyOverview: {}, dashboardPageProps: { inventoryReminder: fiveDays } };
    assert.equal(compare(prev, { ...prev, dashboardPageProps: { inventoryReminder: fiveDays } }), true, 'same reminder: no redraw');
    assert.equal(compare(prev, { ...prev, dashboardPageProps: { inventoryReminder: null } }), false, 'counted or put off: the home page redraws');
}

// ---- 4. The phone notification: once a day, in the app's language, only about the date ----
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
    const fresh = () => { notifications.length = 0; storage.delete('app_notif_last_inventory'); };

    fresh();
    let notify = withLanguage(translate('fr'));
    notify.notifyInventoryReminder(fiveDays);
    assert.deepEqual(notifications, [{ title: 'Inventaire de la caisse', body: 'Dernier inventaire il y a 5 jours. Comptez la caisse, BaridiMob et les portefeuilles.', tag: 'inventory-reminder' }], 'counted 5 days ago');
    notify.notifyInventoryReminder(fiveDays);
    assert.equal(notifications.length, 1, 'not twice the same day');

    fresh();
    notify.notifyInventoryReminder(never);
    assert.equal(notifications[0].body, 'Aucun inventaire enregistré pour le moment. Comptez la caisse, BaridiMob et les portefeuilles.', 'never counted');
    fresh();
    notify.notifyInventoryReminder(yesterday);
    assert.equal(notifications[0].body, 'Dernier inventaire hier. Comptez avant de fermer la journée.', 'counted yesterday');

    fresh();
    notify = withLanguage(translate('ar'));
    notify.notifyInventoryReminder(never);
    assert.deepEqual(notifications[0], { title: translations.ar.inventoryReminder.title, body: translations.ar.inventoryReminder.never, tag: 'inventory-reminder' }, 'Arabic');

    fresh();
    notify = withLanguage(undefined);
    notify.notifyInventoryReminder(yesterday);
    assert.deepEqual(notifications[0], { title: 'Inventaire de la caisse', body: 'Dernier inventaire hier. Comptez avant de fermer la journée.', tag: 'inventory-reminder' }, 'without a translation, the French text');

    fresh();
    notify.notifyInventoryReminder(null);
    assert.equal(notifications.length, 0, 'no reminder (counted today or put off): no notification');
    assert.equal(storage.has('app_notif_last_inventory'), false, 'and the day is not used up');
    FakeNotification.permission = 'denied';
    notify = withLanguage(translate('fr'));
    notify.notifyInventoryReminder(never);
    assert.equal(notifications.length, 0, 'permission refused: no notification');
    FakeNotification.permission = 'granted';
}

// ---- 5. Nothing is shown before the server has answered ----
{
    let seen: ReturnType<typeof useInventoryReminder> | null = null;
    function Probe({ enabled }: { enabled: boolean }) {
        seen = useInventoryReminder(null, enabled);
        return null;
    }
    for (const enabled of [false, true]) {
        seen = null;
        renderToStaticMarkup(<Probe enabled={enabled}/>);
        assert.equal((seen as ReturnType<typeof useInventoryReminder> | null)?.reminder, null, `enabled=${enabled}: no reminder until the saved counts were received`);
    }
}

console.log('inventoryReminderScreens.test: the count reminder card (AR/FR), its place among the home alerts, the redraw and the daily phone notification pass; the home page without it is unchanged');
