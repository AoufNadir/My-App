import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LanguageProvider } from '../contexts/LanguageContext';
import type { ClientDzd, ClientTransactionDzd, DigitalServiceTransaction, TreasuryTx, Tx } from '../types';
import type { TransactionFilterMode } from '../components/transactions/transactionsTypes';
import { distinctScreenNumbers, showSpaces } from '../testing/screenNumbers';
import { TransactionsPage } from './TransactionsPage';

// V2-5 redrew the Opérations page. Same fake data, French and Arabic, three filters: the page
// shows the numbers of the previous page (V2-4), written the same way. The only numbers that
// move are the filter counts, which were inside the closed "Filtrer" menu and are now on the chips.

const storage = new Map<string, string>();
(globalThis as { window?: unknown }).window = {
    localStorage: {
        getItem: (key: string) => (storage.has(key) ? storage.get(key)! : null),
        setItem: (key: string, value: string) => { storage.set(key, String(value)); },
        removeItem: (key: string) => { storage.delete(key); },
    },
    matchMedia: () => ({ matches: false }),
};
(globalThis as { localStorage?: unknown }).localStorage = (globalThis as { window: { localStorage: unknown } }).window.localStorage;
const noop = () => undefined;
const at = (iso: string, time: string) => new Date(`${iso}T${time}:00`).getTime();
const frDate = (iso: string) => iso.split('-').reverse().join('/');
const stamp = (iso: string, time: string) => ({ date: frDate(iso), time, timestamp: at(iso, time) });

const clients: ClientDzd[] = [{ id: 'c1', fullName: 'Amine Kaci' }, { id: 'c2', fullName: 'Sara Belkacem' }];
const transactions: Tx[] = [
    { id: 'b1', type: 'buy', currency: 'USDT', quantity: 2_000, price: 242.9, total: 485_800, ...stamp('2026-09-14', '09:05') },
    { id: 'b2', type: 'buy', currency: 'USDT', quantity: 500, price: 248.1, total: 124_050, purchaseFundingCurrency: 'EUR', purchaseAmountEur: 455.5, ...stamp('2026-09-13', '10:20') },
    { id: 'b3', type: 'buy', currency: 'EUR', quantity: 1_000, price: 255, total: 255_000, ...stamp('2026-09-12', '16:00') },
    { id: 's1', type: 'sell', currency: 'USDT', quantity: 1_000, sell: 245, total: 245_000, linkedClientId: 'c1', ...stamp('2026-09-14', '14:32') },
    { id: 's2', type: 'sell', currency: 'USDT', quantity: 300, sell: 246, total: 73_800, settlementCurrency: 'EUR', sellPriceEur: 0.92, saleValueEur: 276, ...stamp('2026-09-13', '18:45') },
    { id: 's3', type: 'sell', currency: 'EUR', quantity: 200, sell: 262, total: 52_400, linkedClientId: 'c2', ...stamp('2026-09-12', '17:05') },
    { id: 'm1', type: 'Ajout Manuel', currency: 'USDT', quantity: 50, ...stamp('2026-09-11', '08:00') },
];
const clientTransactionsDzd: ClientTransactionDzd[] = [
    { id: 'l1', clientId: 'c1', montant: -245_000, type: 'Vente USDT', linkedTxId: 's1', linkRole: 'primary', ...stamp('2026-09-14', '14:32') },
    { id: 'r1', clientId: 'c1', montant: 50_000, type: 'Règlement Reçu', paymentMethod: 'Espèces', notes: 'Versement agence', ...stamp('2026-09-14', '11:10') },
    { id: 'p1', clientId: 'c2', montant: -15_000, type: 'Paiement Effectué', paymentMethod: 'BaridiMob', ...stamp('2026-09-13', '12:00') },
    { id: 'o1', clientId: 'c1', montant: -10_000, type: 'Transfert Sortant', ...stamp('2026-09-10', '09:40') },
    { id: 'i1', clientId: 'c2', montant: 10_000, type: 'Transfert Entrant', ...stamp('2026-09-10', '09:40') },
];
const treasuryTransactions: TreasuryTx[] = [
    { id: 'ta', type: 'Ajout', source: 'Caisse', amount: 100_000, notes: 'Apport', ...stamp('2026-09-11', '10:00') },
    { id: 'tb', type: 'Retrait', source: 'BaridiMob', amount: 20_000, ...stamp('2026-09-10', '15:30') },
    { id: 'tc', type: 'Transfer', source: 'Caisse', destination: 'BaridiMob', amount: 30_000, ...stamp('2026-09-10', '11:15') },
];
const digitalServiceTransactions: DigitalServiceTransaction[] = [
    { id: 'd1', type: 'digital_service_sale', clientId: 'c2', serviceName: 'Netflix', purchaseWallet: 'Caisse', purchaseCurrency: 'DZD', purchaseAmount: 1_000, purchaseRateToDzd: 1, purchaseAmountDzd: 1_000,
        saleWallet: 'Caisse', saleCurrency: 'DZD', saleAmount: 1_500, saleRateToDzd: 1, saleAmountDzd: 1_500, profitDzd: 500, ...stamp('2026-09-12', '13:30') },
];
const SEPT_10_TO_13 = { start: new Date(2026, 8, 10, 0, 0, 0, 0), end: new Date(2026, 8, 13, 23, 59, 59, 999) };
const NO_DATES = { start: null, end: null };

type PageState = { name: string; filterMode: TransactionFilterMode; dateRange: { start: Date | null; end: Date | null } };
const STATES: PageState[] = [
    { name: 'all', filterMode: 'all', dateRange: NO_DATES },
    { name: 'buy', filterMode: 'buy', dateRange: NO_DATES },
    { name: 'clients-10-13', filterMode: 'clients', dateRange: SEPT_10_TO_13 },
];
function renderPage(state: PageState, lang: 'fr' | 'ar', data = { transactions, clientTransactionsDzd, treasuryTransactions, digitalServiceTransactions }) {
    storage.set('app_lang', lang);
    return renderToStaticMarkup(<LanguageProvider>
        <TransactionsPage openAdjustmentModal={noop} openForm={noop} filterMode={state.filterMode} setFilterMode={noop} transactions={data.transactions}
          profitByTxId={{ s1: { derivedProfit: 2_100 } } as never} getRelativeDateLabel={(date) => date} clientTransactionsDzd={data.clientTransactionsDzd}
          digitalServiceTransactions={data.digitalServiceTransactions} clientsDzd={clients} getClientFullName={(client) => client.fullName} setTxToDelete={noop}
          openDateFilterModal={noop} dateRange={state.dateRange} setDateRange={noop} onOpenNewOperation={noop} treasuryTransactions={data.treasuryTransactions}/>
      </LanguageProvider>);
}

const ROW_AMOUNT = /text-\[15px\] font-semibold leading-snug tabular-nums[^"]*">([^<]*)</g;
const ROW_TIME = /<p class="min-w-0 truncate text-xs leading-snug text-neutral-500">(\d{2}:\d{2})<\/p>/g;
/** The listed operations, in order: time and amount of each row. */
function listedRows(html: string): string[] {
    const amounts = [...html.matchAll(ROW_AMOUNT)].map((match) => match[1]);
    const times = [...html.matchAll(ROW_TIME)].map((match) => match[1]);
    assert.equal(amounts.length, times.length, 'one time per row');
    return showSpaces(amounts.map((amount, index) => `${times[index]} ${amount}`));
}

// What the V2-4 page showed with this data (identical in French and Arabic): its numbers, and its rows in order.
const BEFORE: Record<string, { numbers: string[]; rows: string[] }> = {
    'all': {
        numbers: ['+2⍽100', '0,911', '0,92', '08:00', '09:05', '09:40', '1', '10/09/2026', '100⍽000,00', '10:00', '10:20', '10⍽000,00', '11/09/2026', '11:10', '11:15', '12/09/2026', '12:00', '13/09/2026', '13:30', '14', '14/09/2026', '14:32', '15:30', '15⍽000,00', '16:00', '17:05', '18:45', '1⍽000', '1⍽000,00', '1⍽500,00', '200', '20⍽000,00', '242,90', '245,00', '255,00', '262,00', '276', '2⍽000', '3', '300', '30⍽000,00', '455,5', '50', '500', '500,00', '50⍽000,00', '7', '73⍽800,00'],
        rows: ['14:32 1⍽000 USDT', '11:10 50⍽000,00 DZD', '09:05 2⍽000 USDT', '18:45 276 EUR', '12:00 15⍽000,00 DZD', '10:20 455,5 EUR', '17:05 200 EUR', '16:00 1⍽000 EUR', '13:30 500,00 DZD', '10:00 100⍽000,00 DZD', '08:00 50 USDT', '15:30 20⍽000,00 DZD', '11:15 30⍽000,00 DZD', '09:40 10⍽000,00 DZD'],
    },
    'buy': {
        numbers: ['0', '0,911', '09:05', '10:20', '12/09/2026', '13/09/2026', '14/09/2026', '16:00', '1⍽000', '242,90', '255,00', '2⍽000', '3', '455,5', '500', '864⍽850'],
        rows: ['09:05 2⍽000 USDT', '10:20 455,5 EUR', '16:00 1⍽000 EUR'],
    },
    'clients-10-13': {
        numbers: ['0', '09:40', '10/09/2026', '10⍽000,00', '12:00', '13/09/2026', '15⍽000,00', '2', '25⍽000'],
        rows: ['12:00 15⍽000,00 DZD', '09:40 10⍽000,00 DZD'],
    },
};

// The V2-4 page opened on a card of counts for the listed operations: all, wallet, clients, treasury, services.
const BEFORE_COUNTS: Record<string, { total: number; crypto: number; client: number; treasury: number; digital: number }> = {
    'all': { total: 14, crypto: 7, client: 3, treasury: 3, digital: 1 },
    'buy': { total: 3, crypto: 3, client: 0, treasury: 0, digital: 0 },
    'clients-10-13': { total: 2, crypto: 0, client: 2, treasury: 0, digital: 0 },
};
// The family chips count every family for the period, whichever is picked.
const CHIP_LABELS = {
    fr: ['Tout', 'Achats', 'Ventes', 'Stock', 'Clients', 'Trésorerie', 'Services'],
    ar: ['الكل', 'المشتريات', 'المبيعات', 'المخزون', 'العملاء', 'الخزينة', 'الخدمات'],
};
const CHIP_COUNTS: Record<string, number[]> = {
    'all': [14, 3, 3, 1, 3, 3, 1],
    'buy': [14, 3, 3, 1, 3, 3, 1],
    'clients-10-13': [11, 2, 2, 1, 2, 3, 1],
};
const PRESSED_CHIP: Record<string, number> = { 'all': 0, 'buy': 1, 'clients-10-13': 4 };
// Numbers that moved, and why. Everything else on the page is the same set of numbers, written the same way.
const MOVED: Record<string, { gone: string[]; added: string[] }> = {
    // The wallet count (7) is now split on three chips: Achats 3 + Ventes 3 + Stock 1.
    'all': { gone: ['7'], added: [] },
    // The card counted 0 clients, treasury and services among the purchases; the chips now give each family's own count.
    'buy': { gone: ['0'], added: ['1', '14'] },
    'clients-10-13': { gone: ['0'], added: ['1', '11', '3'] },
};

const CHIP = /aria-pressed="(true|false)"[^>]*><span>([^<]*)<\/span><span dir="ltr"[^>]*>([^<]*)<\/span><\/button>/g;
function chipsOf(html: string) {
    return [...html.matchAll(CHIP)].map((match) => ({ pressed: match[1] === 'true', label: match[2], count: Number(match[3].replace(/\s/g, '')) }));
}
const titleCount = (html: string) => Number(/· <bdi>(\d[\d\u202f]*)<\/bdi><\/span><\/h2>/.exec(html)?.[1].replace(/\s/g, ''));

for (const state of STATES) {
    for (const lang of ['fr', 'ar'] as const) {
        const label = `${state.name} ${lang}`;
        const html = renderPage(state, lang);
        const before = BEFORE[state.name];
        const moved = MOVED[state.name];
        const expected = [...before.numbers.filter((token) => !moved.gone.includes(token)), ...moved.added].sort();
        assert.deepEqual(showSpaces(distinctScreenNumbers(html)), expected, `${label}: the same numbers, written the same way`);
        assert.deepEqual(listedRows(html), before.rows, `${label}: the same operations, in the same order`);

        const chips = chipsOf(html);
        assert.deepEqual(chips.map((chip) => chip.label), CHIP_LABELS[lang], `${label}: one chip per family`);
        assert.deepEqual(chips.map((chip) => chip.count), CHIP_COUNTS[state.name], `${label}: chip counts`);
        assert.deepEqual(chips.map((chip) => chip.pressed), chips.map((_, index) => index === PRESSED_CHIP[state.name]), `${label}: the picked family`);

        // Each count of the old card is still on the page.
        const counts = BEFORE_COUNTS[state.name];
        assert.equal(titleCount(html), counts.total, `${label}: listed operations, next to the title`);
        if (state.filterMode === 'all') {
            const [, buys, sells, stock, clientsCount, treasury, services] = CHIP_COUNTS[state.name];
            assert.equal(buys + sells + stock, counts.crypto, `${label}: wallet = purchases + sales + stock`);
            assert.deepEqual([clientsCount, treasury, services], [counts.client, counts.treasury, counts.digital], `${label}: clients, treasury, services`);
        }
        else {
            // A family on its own: the card gave its rows to that family and 0 to the others.
            const picked = PRESSED_CHIP[state.name] === 4 ? counts.client : counts.crypto;
            assert.equal(picked, counts.total, `${label}: every listed row is in the picked family`);
        }
    }
}

// The sum of a filtered list sits above the rows now, not below them.
{
    const html = renderPage(STATES[1], 'fr');
    const totalIndex = html.indexOf('Total ≈');
    assert.ok(totalIndex > html.indexOf('Journal des opérations') && totalIndex < html.indexOf('content-visibility'), 'total between the title and the first row');
    assert.match(html, /864\u202f850 <span[^>]*>DZD<\/span>/, 'total of the three purchases');
    assert.doesNotMatch(renderPage(STATES[0], 'fr'), /Total ≈/, 'no total for the whole list');
}

// The period and the detail of a family: next to the chips.
{
    const all = renderPage(STATES[0], 'fr');
    assert.match(all, />Toutes les dates</);
    assert.doesNotMatch(all, /Détail du filtre/, 'Tout has no detail');
    const period = renderPage(STATES[2], 'fr');
    assert.match(period, /<span dir="ltr"[^>]*>10\/09\/2026 – 13\/09\/2026<\/span>/, 'the period, as the operations write their days');
    assert.match(period, /aria-label="Détail du filtre : Tous"/, 'the detail of Clients');
}

// Services is a family of its own now: its chip lists the service sales.
{
    const html = renderPage({ name: 'services', filterMode: 'digital_services', dateRange: NO_DATES }, 'fr');
    assert.deepEqual(listedRows(html), ['13:30 500,00 DZD'], 'the Netflix sale only');
    assert.equal(chipsOf(html).find((chip) => chip.pressed)?.label, 'Services');
    assert.equal(titleCount(html), 1);
}

// An older saved filter outside the chips lights up its family and names itself in the detail.
{
    const html = renderPage({ name: 'legacy', filterMode: 'adjustments', dateRange: NO_DATES }, 'fr');
    assert.equal(chipsOf(html).find((chip) => chip.pressed)?.label, 'Stock');
    assert.match(html, /aria-label="Détail du filtre : Ajustements stock"/);
    assert.deepEqual(listedRows(html), ['08:00 50 USDT']);
}

// No operation yet: the list offers to add one.
{
    const html = renderPage(STATES[0], 'fr', { transactions: [], clientTransactionsDzd: [], treasuryTransactions: [], digitalServiceTransactions: [] });
    const emptyIndex = html.indexOf('role="status"');
    assert.ok(emptyIndex > html.indexOf('Journal des opérations'), 'empty list inside the card');
    assert.ok(html.indexOf('Nouvelle opération', emptyIndex) > emptyIndex, 'with the new-operation button');
    assert.equal(titleCount(html), 0);
}

console.log('TransactionsPage.test: OK');
