import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LanguageProvider } from '../../contexts/LanguageContext';
import type { ClientDzd, ClientTransactionDzd, OverdueDebtClient, Tx } from '../../types';
import { buildClientStatementTransactions } from '../../utils/clientStatementTransactions';
import { distinctScreenNumbers, screenText, showSpaces } from '../../testing/screenNumbers';
import { ClientDetailsView } from './ClientDetailsView';
import { ClientsListView } from './ClientsListView';
import { OverdueDebtsModal } from './OverdueDebtsModal';

// V2-5 redrew the Clients list and the client page. Same fake data, French and Arabic: every
// number of the previous screens (V2-4) is still shown, written the same way, and no new one
// appears. Each client keeps its own amount, and the client page keeps its balance and history.

const storage = new Map<string, string>();
(globalThis as { window?: unknown }).window = {
    localStorage: {
        getItem: (key: string) => (storage.has(key) ? storage.get(key)! : null),
        setItem: (key: string, value: string) => { storage.set(key, String(value)); },
        removeItem: (key: string) => { storage.delete(key); },
    },
    matchMedia: () => ({ matches: false }),
};
function render(node: React.ReactElement, lang: 'fr' | 'ar') {
    storage.set('app_lang', lang);
    return renderToStaticMarkup(<LanguageProvider>{node}</LanguageProvider>);
}
const noop = () => undefined;
const DAY = 86_400_000;
const now = Date.now();
const noon = (iso: string) => new Date(`${iso}T12:00:00Z`).getTime();
const frDate = (iso: string) => iso.split('-').reverse().join('/');

// ---- Fake clients ----
const clients: ClientDzd[] = [
    { id: 'c1', fullName: 'Amine Kaci', phone: '0555001122', redotpayId: '1704037642', binanceEmail: 'amine@example.com', notes: 'Livraison le jeudi', creditLimit: 50_000, group: 'Oran' },
    { id: 'c2', fullName: 'Sara Belkacem', phone: '0661223344' },
    { id: 'c3', fullName: 'Yacine Mansouri' },
    { id: 'c4', fullName: 'Nadia Ferhat', creditLimit: 2_000, group: 'Alger' },
    { id: 'c5', fullName: 'Atlas Fournisseur', isFournisseur: true },
    { id: 'c6', fullName: 'Karim Bensaid', group: 'Oran' },
];
const balances = new Map<string, number>([
    ['c1', -85_000], ['c2', 15_000.5], ['c3', 0], ['c4', -2_500.5], ['c5', 120_000], ['c6', -40_000],
]);
const overdue: OverdueDebtClient[] = [
    { clientId: 'c1', fullName: 'Amine Kaci', overdueAmount: 85_000, daysOverdue: 12, oldestUnpaidTimestamp: now - 42 * DAY, oldestUnpaidDate: '20/08/2026', lastPaymentTimestamp: null, balance: -85_000 },
    { clientId: 'c6', fullName: 'Karim Bensaid', overdueAmount: 40_000, daysOverdue: 30, oldestUnpaidTimestamp: now - 60 * DAY, oldestUnpaidDate: '01/08/2026', lastPaymentTimestamp: null, balance: -40_000 },
];
const loyalty = new Map<string, 'vip' | 'regular' | 'petit' | 'new' | 'inactive' | 'fournisseur'>([
    ['c1', 'regular'], ['c2', 'vip'], ['c3', 'new'], ['c4', 'petit'], ['c5', 'fournisseur'], ['c6', 'inactive'],
]);
const prevMonthVolume = new Map([['c1', 12_400], ['c2', 850], ['c4', 120], ['c5', 9_000]]);
const lastSell = new Map([['c1', now - 2 * DAY - 3_600_000], ['c2', now - 3_600_000], ['c4', now - DAY - 3_600_000], ['c6', now - 45 * DAY - 3_600_000]]);
const fullName = (client: ClientDzd) => client.fullName;

function renderList(lang: 'fr' | 'ar') {
    return render(<ClientsListView openClientModal={noop} clientSearchQuery="" setClientSearchQuery={noop} clientSortMode="all" setClientSortMode={noop}
        filteredClientsDzd={clients} clientBalances={balances} getClientFullName={fullName} handleTouchStart={noop} handleTouchEnd={noop}
        setClientToDelete={noop} setSelectedClientId={noop} overdueDebtClients={overdue} clientLoyaltyMap={loyalty}
        clientPrevMonthVolume={prevMonthVolume} clientLastSellDate={lastSell} handleZeroOutBalance={async () => undefined} onImportClients={async () => undefined}/>, lang);
}

// ---- The client page: Amine Kaci, over his credit limit ----
const clientTx = (id: string, iso: string, time: string, montant: number, type: ClientTransactionDzd['type'], extra: Partial<ClientTransactionDzd> = {}): ClientTransactionDzd => ({
    id, clientId: 'c1', timestamp: noon(iso) + Number(time.slice(0, 2)) * 60_000, date: frDate(iso), time, montant, type, ...extra,
});
const sales: Tx[] = [
    { id: 'sell-usdt', type: 'sell', currency: 'USDT', quantity: 1_000, sell: 245, total: 245_000, date: '14/09/2026', time: '14:32', timestamp: noon('2026-09-14') },
    { id: 'sell-eur', type: 'sell', currency: 'EUR', quantity: 200, sell: 262, total: 52_400, date: '02/09/2026', time: '17:05', timestamp: noon('2026-09-02') },
];
const history: ClientTransactionDzd[] = [
    clientTx('t1', '2026-09-14', '14:32', -245_000, 'Vente USDT', { linkedTxId: 'sell-usdt', linkRole: 'primary' }),
    clientTx('t2', '2026-09-14', '11:10', 50_000, 'Règlement Reçu', { paymentMethod: 'Espèces', notes: 'Versement agence' }),
    clientTx('t3', '2026-09-10', '09:40', -10_000, 'Transfert Sortant', { linkedTxId: 't3b' }),
    clientTx('t4', '2026-09-02', '17:05', -52_400, 'Vente EUR', { linkedTxId: 'sell-eur', linkRole: 'primary' }),
    clientTx('t5', '2026-08-20', '10:00', 172_400.75, 'Règlement Reçu', { paymentMethod: 'BaridiMob' }),
    clientTx('t6', '2026-08-01', '08:15', -1_500, 'Paiement Effectué'),
];
const counterpart: ClientTransactionDzd = { ...clientTx('t3b', '2026-09-10', '09:40', 10_000, 'Transfert Entrant', { linkedTxId: 't3' }), clientId: 'c2' };
const allClientTx = [...history, counterpart];
const statement = buildClientStatementTransactions({ clientId: 'c1', clientTransactions: allClientTx });
const groupedHistory: Record<string, ClientTransactionDzd[]> = {};
for (const tx of statement)
    (groupedHistory[tx.date] ||= []).push(tx);

function renderDetails(lang: 'fr' | 'ar') {
    return render(<ClientDetailsView selectedClientId="c1" selectedClient={clients[0]} selectedClientBalance={-85_000} groupedHistory={groupedHistory}
        clientTransactionsDzd={allClientTx} clientsDzd={clients} setSelectedClientId={noop} getClientFullName={fullName} openClientSummary={noop}
        openClientModal={noop} copiedValue={null} handleCopy={noop} transactions={sales} profitByTxId={{ 'sell-usdt': { derivedProfit: 2_100 } }}
        handleEditClientTx={noop} handleDeleteClientTxClick={noop} openClientTxModal={noop} openClientToClientTransferModal={noop}/>, lang);
}

// ---- Numbers of the V2-4 screens, recorded from the same data before the redesign ----
// ⍽ stands for the narrow no-break space that separates thousands.
const fromShown = (tokens: string[]) => tokens.map((token) => token.replace(/⍽/g, ' '));
const BEFORE = {
    list: fromShown(['12', '12.4', '120', '120⍽000,00', '15⍽000,50', '2', '2⍽500,50', '3', '30', '40⍽000,00', '45', '6', '850', '85⍽000,00']),
    details: fromShown(['+2⍽100', '-85⍽000', '01/08/2026', '02/09/2026', '0555001122', '08:15', '09:40', '10/09/2026', '10:00', '10⍽000,00', '11:10', '14/09/2026', '14:32', '170', '1704037642', '172⍽400,75', '17:05', '1⍽000', '1⍽500,00', '20/08/2026', '200', '245,00', '262,00', '50⍽000', '50⍽000,00', '6', '85⍽000']),
};
function assertSameNumbers(html: string, before: string[], screen: string) {
    assert.deepEqual(showSpaces(distinctScreenNumbers(html)), showSpaces(before), `${screen}: same numbers, same writing`);
}
/** Text from one marker to the next one, to check that a value sits in the right row. */
function segment(text: string, from: string, to?: string) {
    const start = text.indexOf(from);
    assert.ok(start >= 0, `${from} shown`);
    const end = to ? text.indexOf(to, start + from.length) : text.length;
    return text.slice(start, end < 0 ? text.length : end);
}

// ---- 1. Clients list ----
for (const lang of ['fr', 'ar'] as const) {
    const html = renderList(lang);
    assertSameNumbers(html, BEFORE.list, `list ${lang}`);
    const text = screenText(html);
    const order = ['Amine Kaci', 'Sara Belkacem', 'Yacine Mansouri', 'Nadia Ferhat', 'Atlas Fournisseur', 'Karim Bensaid'];
    const amounts = ['85 000,00', '15 000,50', null, '2 500,50', '120 000,00', '40 000,00'];
    order.forEach((name, index) => {
        const row = segment(text, name, order[index + 1]);
        const amount = amounts[index];
        if (amount)
            assert.ok(row.includes(amount), `${lang}: ${name} keeps ${amount}`);
        else
            assert.ok(!/\d{3},\d\d/.test(row), `${lang}: ${name} shows no balance`);
    });
    const debt = lang === 'fr' ? 'Dette' : 'دين';
    assert.ok(segment(text, 'Amine Kaci', 'Sara Belkacem').includes(debt), `${lang}: debt named`);
    assert.ok(segment(text, 'Amine Kaci', 'Sara Belkacem').includes(`12${lang === 'fr' ? 'j' : 'ي'}`), `${lang}: days late`);
}
{
    const html = renderList('fr');
    assert.match(html, /class="[^"]*text-financial-debt[^"]*"[^>]*><bdi dir="ltr">85 000,00/, 'a debt is orange');
    assert.match(html, /class="[^"]*text-financial-profit[^"]*"[^>]*><bdi dir="ltr">15 000,50/, 'an advance is green');
    // Late payers first, as one alert that opens their list.
    const text = screenText(html);
    assert.ok(text.indexOf('2 client(s) en retard de paiement') < text.indexOf('Amine Kaci'), 'alert above the list');
    // Chips: the counts of the previous overview card, and one tap filters.
    for (const [chip, count] of [['Dettes', '3'], ['Avances', '2'], ['Retards', '2']] as const)
        assert.match(html, new RegExp(`aria-pressed="false"[^>]*>(?:<span[^>]*>[^<]*</span>)?<span>${chip}</span><span[^>]*>${count}</span>`), `${chip} chip counts ${count}`);
    assert.match(html, /aria-pressed="true"[^>]*><span>Tous<\/span>/, 'all clients by default');
    // The counts follow the search, not the chip: with the debts chip on, the other chips keep their numbers.
    const debtsOnly = render(<ClientsListView openClientModal={noop} clientSearchQuery="" setClientSearchQuery={noop} clientSortMode="debts" setClientSortMode={noop}
        filteredClientsDzd={clients.filter((client) => balances.get(client.id)! < 0)} searchedClientsDzd={clients} clientBalances={balances} getClientFullName={fullName}
        handleTouchStart={noop} handleTouchEnd={noop} setClientToDelete={noop} setSelectedClientId={noop} overdueDebtClients={overdue}/>, 'fr');
    assert.match(debtsOnly, /aria-pressed="true"[^>]*><span>Dettes<\/span><span[^>]*>3<\/span>/);
    assert.match(debtsOnly, /<span>Avances<\/span><span[^>]*>2<\/span>/);
    assert.ok(!screenText(debtsOnly).includes('Sara Belkacem'), 'the list itself is filtered');
}

// ---- 2. Client page ----
for (const lang of ['fr', 'ar'] as const) {
    const html = renderDetails(lang);
    assertSameNumbers(html, BEFORE.details, `client page ${lang}`);
    const text = screenText(html);
    // The history keeps its rows and their order: newest first.
    const rows = ['1 000', '50 000,00', '10 000,00', '200', '172 400,75', '1 500,00'];
    const positions = rows.map((value) => text.indexOf(value, text.indexOf('14:32') - 400));
    assert.ok(positions.every((position, index) => position >= 0 && (index === 0 || position > positions[index - 1])), `${lang}: history rows in the same order`);
    assert.ok(text.indexOf('-85 000') < text.indexOf('14:32'), `${lang}: balance above the history`);
}
{
    const html = renderDetails('fr');
    assert.match(html, /class="[^"]*text-financial-debt[^"]*"[^>]*><bdi dir="ltr">-85 000/, 'a debt balance is orange');
    assert.match(html, /Plafond de dette client dépassé \(170%\)/, 'credit limit alert unchanged');
    assert.ok(screenText(html).indexOf('Plafond de dette client dépassé') < screenText(html).indexOf('14:32'), 'alert before the history');
}

// The late payers window: same total, same debts, same days and dates as V2-4, in the same order.
{
    const debtors: OverdueDebtClient[] = [
        { clientId: 'c6', fullName: 'Karim Bensaid', overdueAmount: 40_000, daysOverdue: 30, oldestUnpaidTimestamp: new Date(2026, 7, 3).getTime(), oldestUnpaidDate: '03/08/2026', lastPaymentTimestamp: null, balance: -40_000 },
        { clientId: 'c1', fullName: 'Amine Kaci', overdueAmount: 35_000.5, daysOverdue: 12, oldestUnpaidTimestamp: new Date(2026, 7, 21).getTime(), oldestUnpaidDate: '21/08/2026', lastPaymentTimestamp: new Date(2026, 8, 14, 11, 10).getTime(), balance: -85_000 },
    ];
    const before = fromShown(['-35⍽000,50', '-40⍽000,00', '-75⍽000,50', '03/08/2026', '1', '12', '14/09/2026', '2', '21/08/2026', '30']);
    for (const lang of ['fr', 'ar'] as const) {
        const html = render(<OverdueDebtsModal isOpen onClose={noop} overdueDebtors={debtors} onOpenClient={noop}/>, lang);
        assertSameNumbers(html, before, `late payers ${lang}`);
        const text = screenText(html);
        const order = ['-75\u202f000,50', 'Karim Bensaid', '-40\u202f000,00', 'Amine Kaci', '-35\u202f000,50'].map((part) => text.indexOf(part));
        assert.ok(order.every((position, index) => position >= 0 && (index === 0 || position > order[index - 1])), `late payers ${lang}: total, then each debt with its client`);
    }
}

console.log('clientScreens.test: the Clients list and the client page show the same numbers as before, in French and Arabic');
