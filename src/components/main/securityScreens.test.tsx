import { FIXED_NOW } from '../../testing/fixedClock';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LanguageProvider, useLanguage } from '../../contexts/LanguageContext';
import type { ClientDzd, ClientTransactionDzd, Investor, TreasuryTx, Tx } from '../../types';
import { distinctScreenNumbers, screenText, showSpaces } from '../../testing/screenNumbers';
import { computePamLedger } from '../../utils/pamLedger';
import { buildPricingContext } from '../../services/smartPricingEngine';
import { useGlobalSearch } from '../../hooks/useGlobalSearch';
import { GlobalSearchDialog } from './MainDialogs';
import { MainClientSummaryDialog } from './MainClientSummaryDialog';
import { MonthPlanSheet } from '../calculator/MonthPlanSheet';
import { MainUtilityDialogs } from './MainUtilityDialogs'; // v29-only
import { NewTransactionMenuDialog } from '../transactions/NewTransactionMenuDialog'; // v29-only
import { Auth } from '../Auth'; // v29-only
import { AuthLockScreen } from '../AuthLockScreen'; // v29-only
import { authLockStore } from '../../hooks/useAuthLock'; // v29-only
import { translations } from '../../translations'; // v29-only

// V2-9 redrew the global search, the month plan, the client summary (share button on the
// client page), the settings window, the lock screen, the sign-in screen and the (+) menu.
// Same fake data, French and Arabic, clock fixed on 30/09/2026 15:00: the search, the month
// plan and the client summary show exactly the numbers V2-8 showed, written the same way.
// Every screen reads in Arabic with no French word left, and the lock screen asks for as many
// digits as the PIN has (4, 5 or 6).

const storage = new Map<string, string>();
(globalThis as { window?: unknown }).window = {
    localStorage: {
        getItem: (key: string) => (storage.has(key) ? storage.get(key)! : null),
        setItem: (key: string, value: string) => { storage.set(key, String(value)); },
        removeItem: (key: string) => { storage.delete(key); },
    },
    matchMedia: () => ({ matches: false }),
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
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
const asyncNoop = async () => undefined;
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
    trade('s3', 'sell', 'EUR', 300, 262, at(2026, 9, 26, 12), { notes: 'Vente salon' } as Partial<Tx>),
];
const portfolioStats = computePamLedger(transactions, { nowMs: FIXED_NOW }).portfolioStats;

// ---- Clients: one owing money, one with an advance, one at zero, a supplier ----
const clientsDzd: ClientDzd[] = [
    { id: 'c1', fullName: 'Karim Belkacem', phone: '0555 10 20 30', creditLimit: 150_000 },
    { id: 'c2', fullName: 'Nadia Ferhat', phone: '0661 40 50 60' },
    { id: 'c3', fullName: 'Amine Bouzid' },
    { id: 'c4', fullName: 'Salima Hadj', isFournisseur: true },
    { id: 'c6', fullName: 'Walid Cherif', phone: '0770 11 22 33' },
];
const ctx = (id: string, clientId: string, montant: number, type: ClientTransactionDzd['type'], ts: number, extra: Partial<ClientTransactionDzd> = {}): ClientTransactionDzd => ({
    id, clientId, montant, type, date: dayOf(ts), time: timeOf(ts), timestamp: ts, affectsBalance: true, ...extra,
});
const clientTransactionsDzd: ClientTransactionDzd[] = [
    ctx('k1', 'c1', -224_100, 'Vente USDT', at(2026, 9, 5, 14), { linkedTxId: 's1', linkRole: 'primary', paymentMethod: 'Crédit' }),
    ctx('k2', 'c1', 139_100, 'Règlement Reçu', at(2026, 9, 12, 10), { paymentMethod: 'Espèces' }),
    ctx('k7', 'c1', -20_000, 'Transfert Sortant', at(2026, 9, 14, 17, 30), { linkedTxId: 'k8' }),
    ctx('k8', 'c2', 20_000, 'Transfert Entrant', at(2026, 9, 14, 17, 30), { linkedTxId: 'k7' }),
    ctx('k3', 'c2', -300_000, 'Vente USDT', at(2026, 9, 25, 16), { linkedTxId: 's2', linkRole: 'primary', paymentMethod: 'Espèces', affectsBalance: false }),
    ctx('k4', 'c2', 40_000, 'Règlement Reçu', at(2026, 9, 20, 11), { paymentMethod: 'BaridiMob' }),
    ctx('k5', 'c3', 5_000, 'Ajustement Solde', at(2026, 9, 15, 9), { notes: 'Correction' }),
    ctx('k6', 'c4', -12_500, 'Solde Initial', at(2026, 6, 1, 9)),
];
const clientBalances = new Map<string, number>();
clientsDzd.forEach((client) => clientBalances.set(client.id, 0));
clientTransactionsDzd.forEach((tx) => { if (tx.affectsBalance !== false) clientBalances.set(tx.clientId, (clientBalances.get(tx.clientId) || 0) + tx.montant); });
const getClientFullName = (client: ClientDzd) => client.fullName || client.nom || '';
const treasuryTransactions: TreasuryTx[] = [
    { id: 'tr1', type: 'Transfer', source: 'Caisse', destination: 'BaridiMob', amount: 150_000, date: '26/09/2026', time: '10:15', timestamp: at(2026, 9, 26, 10, 15) },
    { id: 'tr2', type: 'Retrait', source: 'Caisse', amount: 2_500, notes: 'Livraison salon', date: '27/09/2026', time: '18:40', timestamp: at(2026, 9, 27, 18, 40) },
];
const investor = (id: string, name: string, capitalInvested: number, extra: Partial<Investor> = {}): Investor => ({
    id, name, entryDate: '2026-01-15', capitalInvested, initialCapital: capitalInvested, sharePercentage: 0,
    totalProfit: 0, withdrawnProfit: 0, availableProfit: 0, isActive: true, ...extra,
});
const investors: Investor[] = [
    investor('i0', 'Yacine Mansouri', 2_400_000, { isManager: true }),
    investor('i1', 'Lina Saadi', 1_000_000),
    investor('i2', 'Omar Sahli', 350_000, { isActive: false }),
];

// ---- Smart pricing, as MainApp builds it ----
const plan = { schemaVersion: 1 as const, monthKey: '2026-09', revision: 1, monthlyGoal: 120_000, minimumGoal: 80_000, expectedMonthlyVolume: { USDT: 60_000 } };
const pricingContext = buildPricingContext({ transactions, clients: clientsDzd, clientTransactions: clientTransactionsDzd, currency: 'USDT', pam: portfolioStats.usdt.avgBuy, available: portfolioStats.usdt.available, plan, mtdProfit: 112_000 });

// ---- The screens ----
function SearchScreen({ query }: { query: string }) {
    const { t } = useLanguage();
    const search = useGlobalSearch({
        clientTransactionsDzd, clientsDzd, getClientFullName, setDateRange: noop, setFilterMode: noop, setSelectedClientId: noop, setView: noop,
        t, transactions, treasuryTransactions, investors, setSelectedInvestorId: noop,
    });
    // The query typed in the field, set while rendering (the server render has no effects).
    if (search.globalSearchQuery !== query)
        search.setGlobalSearchQuery(query);
    return <GlobalSearchDialog {...{
        isOpen: true, onClose: noop, query, setQuery: noop, results: search.globalSearchResults, onSelectResult: noop,
        title: t('common.globalSearch'), placeholder: t('common.searchPlaceholder'), noResultsText: t('common.noResults'), clientsText: t('nav.clients'), transactionsText: t('nav.transactions'),
    }}/>;
}
const searchScreen = (query: string) => (lang: Lang) => render(<SearchScreen query={query}/>, lang);
const summaryScreen = (clientId: string) => (lang: Lang) => render(<WithT>{(t) => <MainClientSummaryDialog {...{
    summaryClient: clientsDzd.find((client) => client.id === clientId) || null, setSummaryClient: noop, t, clientBalances, clientTransactionsDzd, clientsDzd, transactions,
    setAlert: noop, getClientFullName,
}}/>}</WithT>, lang);
const monthPlanScreen = (lang: Lang) => render(<MonthPlanSheet {...{
    isOpen: true, onClose: noop, context: pricingContext, clients: clientsDzd.map((client) => ({ id: client.id, name: getClientFullName(client) })), suggestedGoal: 95_000, syncState: 'synced' as const,
    onSavePlan: asyncNoop, onSavePolicy: asyncNoop, onSaveDailyMarketOverride: asyncNoop, onSaveDailyClientOverride: asyncNoop, onClearOverride: asyncNoop, onUseInSale: noop,
}}/>, lang);

const SCREENS = {
    searchClient: searchScreen('karim'),
    searchAllGroups: searchScreen('sa'),
    searchInvestor: searchScreen('lina'),
    searchDate: searchScreen('26/09/2026'),
    searchNone: searchScreen('zzz'),
    summaryOwes: summaryScreen('c1'),
    summaryAdvance: summaryScreen('c2'),
    summaryAdjusted: summaryScreen('c3'),
    summarySupplier: summaryScreen('c4'),
    summaryEmpty: summaryScreen('c6'),
    monthPlan: monthPlanScreen,
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

// Recorded on V2-8 (548a217) with the same data and clock; French and Arabic gave the same lists.
// The client summary lists were recorded again on V4-4: the picture sent to the client moved to the
// shared report sheet (balance with its side, reference, last operations as the client report reads
// them). The numbers in the window itself did not change.
const BEFORE: Record<keyof typeof SCREENS, string[]> = {
    searchClient: ['+139100.00', '-20000.00', '-224100.00', '05/09/2026 14:00', '0555 10 20 30', '1', '12/09/2026 10:00', '14/09/2026 17:30', '4', '900'],
    searchAllGroups: ['-12500.00', '01/06/2026 09:00', '1', '1⍽000⍽000', '2', '2500.00', '26/09/2026 12:00', '27/09/2026 18:40', '3', '300', '350⍽000'],
    searchInvestor: ['1', '1⍽000⍽000'],
    searchDate: ['150000.00', '2', '26/09/2026 10:15', '26/09/2026 12:00', '300'],
    searchNone: [],
    summaryOwes: ['+139·100', '+139⍽100,00', '-105⍽000,00', '-20260905', '-20260930', '-20⍽000,00', '-224⍽100,00', '05/09/2026', '0555 10 20 30', '1', '105·000', '10:00', '12/09/2026', '14/09/2026', '14:00', '17:30', '224·100', '249,00', '3', '30/09/2026', '7', '900', '900,00', '−20·000'],
    summaryAdvance: ['+20·000', '+20⍽000,00', '+40·000', '+40⍽000,00', '+60⍽000,00', '-20260914', '-20260930', '-300⍽000,00', '0661 40 50 60', '11:00', '14/09/2026', '16:00', '17:30', '1·200', '1⍽200,00', '2', '20/09/2026', '25/09/2026', '250,00', '3', '30/09/2026', '300·000', '60·000', '7'],
    summaryAdjusted: ['+5·000', '+5⍽000,00', '-20260915', '-20260930', '09:00', '1', '15/09/2026', '3', '30/09/2026', '5·000', '7'],
    summarySupplier: ['-12⍽500,00', '-20260601', '-20260930', '01/06/2026', '09:00', '1', '12·500', '30/09/2026', '4', '7', '−12·500'],
    summaryEmpty: ['-20260930', '0', '0,00', '0770 11 22 33', '30/09/2026', '5', '6', '7'],
    monthPlan: ['100', '112⍽000', '120⍽000', '500', '5⍽900,00', '8⍽000', '95⍽000'],
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
assert.deepEqual(changed, [], 'the search, the month plan and the client summary show the same numbers, written the same way');

// ---- The other screens, then: no French word left in Arabic ----
const lookup = (lang: Lang, key: string): unknown => key.split('.').reduce<any>((node, part) => node?.[part], translations[lang]);
const label = (lang: Lang, key: string) => {
    const text = lookup(lang, key);
    assert.equal(typeof text, 'string', `${lang}: ${key}`);
    return text as string;
};
const textOf = (html: string) => screenText(html).replace(/\s*\|(?:\s*\|)*\s*/g, '|').replace(/^\||\|$/g, '');
/** Attribute values a reader hears or sees: labels, placeholders, titles, image text. */
const attributesOf = (html: string) => [...html.matchAll(/\s(?:aria-label|placeholder|title|alt)="([^"]*)"/g)].map((match) => match[1]).join('|');
// Text that is the same in both languages: what was typed (names, phones, notes), currencies,
// the brand, Google, an e-mail example and the other language's name on the language button.
const names = [...clientsDzd.map(getClientFullName), ...investors.map((inv) => inv.name)];
const initials = names.map((name) => name.split(' ').map((part) => part[0]).join('').toUpperCase());
const DATA_TEXT = [...names, ...initials.map((pair) => `|${pair}|`), 'Vente salon', 'Livraison salon', 'Correction', 'zzz'];
const SAME_IN_BOTH = /^(USDT|EUR|DZD|PAM|PMA|PDF|JSON|VIP|Pro|Digital|ProDigital|Google|WhatsApp|BaridiMob|Français|Ctrl|Esc|Enter)$/;
function frenchWords(html: string): string[] {
    let text = `${textOf(html)}|${attributesOf(html)}`;
    for (const data of DATA_TEXT)
        text = text.split(data).join('| |');
    text = text.replace(/\S+@\S+/g, ' ');
    return [...new Set((text.match(/[A-Za-zÀ-ÿ’']{2,}/g) || []).filter((word) => !SAME_IN_BOTH.test(word)))];
}
const sharedScreens: Record<string, (lang: Lang) => string> = { ...SCREENS };
const pinSettings = (lang: Lang) => render(<WithT>{(t) => <MainUtilityDialogs {...{
    isSettingsModalOpen: true, setIsSettingsModalOpen: noop, t, setIsResetModalOpen: noop, isResetModalOpen: false, handleExportBackup: noop,
    isCreateAssetModalOpen: false, setIsCreateAssetModalOpen: noop, isTreasuryCardModalOpen: false, setIsTreasuryCardModalOpen: noop,
    treasuryCardToDelete: null, treasuryTxToDelete: null,
}}/>}</WithT>, lang);
const lockScreen = (pinLength: number | null) => (lang: Lang) => render(<AuthLockScreen onUnlock={async () => false} pinLength={pinLength}/>, lang);
const menu = (lang: Lang) => render(<WithT>{(t) => <NewTransactionMenuDialog {...{
    isOpen: true, onClose: noop, t, openForm: noop, openWalletTransferModal: noop, openTransferModal: noop, openAdjustmentModal: noop,
    openDeliveryExpenseModal: noop, openDigitalServiceModal: noop, openPersonalWithdrawalModal: noop,
}}/>}</WithT>, lang);
sharedScreens.settingsPinOff = pinSettings;
sharedScreens.lock4 = lockScreen(4);
sharedScreens.lock5 = lockScreen(5);
sharedScreens.lock6 = lockScreen(6);
sharedScreens.lockOldPin = lockScreen(null);
sharedScreens.signIn = (lang) => render(<Auth/>, lang);
sharedScreens.newOperationMenu = menu;
const settingsOff = { fr: pinSettings('fr'), ar: pinSettings('ar') };
await authLockStore.setPin('48291');
sharedScreens.settingsPinOn = pinSettings;
const settingsOn = { fr: pinSettings('fr'), ar: pinSettings('ar') };
const french = Object.entries(sharedScreens)
    .map(([name, renderScreen]) => [name, frenchWords(renderScreen('ar'))] as const)
    .filter(([, words]) => words.length > 0)
    .map(([name, words]) => `${name}: ${words.join(' ')}`);
assert.deepEqual(french, [], 'no French word left on the Arabic screens');

// ---- Settings: « Sécurité et sauvegarde », the PIN card, the backup card and Close ----
for (const lang of ['fr', 'ar'] as const) {
    const off = textOf(settingsOff[lang]);
    for (const key of ['settings.securityTitle', 'settings.pinTitle', 'settings.pinDescription', 'settings.enablePin', 'settings.backupTitle', 'settings.backupDownload', 'common.close'])
        assert.ok(off.includes(label(lang, key)), `${lang} settings, no PIN: ${key}`);
    assert.equal((settingsOff[lang].match(/maxLength="6"/g) || []).length, 2, `${lang}: two PIN fields of up to 6 digits`);
    assert.ok(!off.includes(label(lang, 'settings.lockNow')), `${lang}: nothing to lock without a PIN`);
    const on = textOf(settingsOn[lang]);
    for (const key of ['settings.pinActive', 'settings.pinActiveDetail', 'settings.lockNow', 'settings.disablePin'])
        assert.ok(on.includes(label(lang, key)), `${lang} settings, PIN on: ${key}`);
    assert.ok(!settingsOn[lang].includes('type="password"'), `${lang}: no PIN field once the PIN is on`);
}

// ---- Lock screen: one dot per digit of the PIN, and the subtitle says how many ----
const dots = (html: string) => (html.match(/h-3\.5 w-3\.5 rounded-full/g) || []).length;
for (const lang of ['fr', 'ar'] as const) {
    for (const length of [4, 5, 6]) {
        const html = lockScreen(length)(lang);
        assert.equal(dots(html), length, `${lang}: ${length} dots for a ${length}-digit PIN`);
        assert.ok(textOf(html).includes(label(lang, 'lock.enterCodeDigits').replace('{count}', String(length))), `${lang}: asks for ${length} digits`);
        assert.equal((html.match(/<button type="button"/g) || []).length, 11, `${lang}: ten digit keys and the erase key`);
        assert.ok(html.includes(`aria-label="${label(lang, 'lock.erase')}"`), `${lang}: the erase key is named`);
    }
    // A PIN saved before its length was kept: 4 dots to start, and the subtitle says 4 to 6.
    const old = lockScreen(null)(lang);
    assert.equal(dots(old), 4, `${lang}: an old PIN starts with 4 dots`);
    assert.ok(textOf(old).includes(label(lang, 'lock.enterCodeRange')), `${lang}: an old PIN may have 4 to 6 digits`);
}

// ---- Client summary: the window follows the app's language, the picture the client's own ----
{
    const fr = summaryScreen('c1')('fr');
    const ar = summaryScreen('c1')('ar');
    // V4-4: the picture is the shared report sheet, in the client's report language (the app's
    // language until one is chosen for this client).
    for (const text of ['Relevé de compte', 'Reste à payer', 'dernières opérations', 'Situation au'])
        assert.ok(textOf(fr).includes(text), `French picture: ${text}`);
    assert.ok(/<article dir="rtl" lang="ar"/.test(ar), 'the Arabic picture is written right to left');
    for (const text of ['كشف حساب مختصر', 'الباقي عليك', 'عمليات'])
        assert.ok(textOf(ar).includes(text), `Arabic picture: ${text}`);
    // The window still keeps « 900,00 USDT @ 249,00 DZD » and each date line in their own order.
    assert.equal(ar.split('<bdi>900,00 USDT @ 249,00 DZD</bdi>').length - 1, 1, 'the sale line, isolated on the screen');
    assert.equal(ar.split('<bdi>05/09/2026 · 14:00</bdi>').length - 1, 1, 'its date, isolated too');
    // A WhatsApp button for a client with a phone number.
    assert.ok(textOf(fr).includes('WhatsApp'), 'the client with a phone gets a WhatsApp button');
}

console.log('securityScreens.test: the search, the month plan and the client summary show the same numbers as V2-8; settings, lock (4 to 6 digits), sign-in and (+) read in Arabic with no French left');
