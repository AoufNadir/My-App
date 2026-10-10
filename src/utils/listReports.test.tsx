import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { ClientListSheet } from '../components/reports/documents/ClientListSheet';
import { InvestorListSheet } from '../components/reports/documents/InvestorListSheet';
import { TransactionListSheet } from '../components/reports/documents/TransactionListSheet';
import { CLIENT_LIST_WORDS, INVESTOR_LIST_WORDS, TRANSACTION_LIST_WORDS } from '../components/reports/documentWords';
import { distinctScreenNumbers } from '../testing/screenNumbers';
import { buildClientListReport, buildInvestorListReport, buildTransactionListReport, clientListFileName, investorEntryDay, investorListFileName, transactionListFileName, type ClientListInput, type InvestorListInput, type TransactionListInput } from './listReports';
import { buildClientListPdf, buildInvestorListPdf, buildTransactionListPdf } from './pdfReports';

// V3-7 moves the client list, the investor list and the operations log to the client report's
// look (the shared report frame, in Arabic or French). Their numbers must not move: each number of
// the new page is the number the old printed report (pdfReports.ts) showed, for every row of the
// fixtures below. The old log had eleven columns: the new one has seven (the time under the date,
// the category under the type, the currency under the quantity, the tags under the notes).

const at = (year: number, month: number, day: number, hour = 12, minute = 0) => new Date(year, month - 1, day, hour, minute).getTime();
const NOW = at(2026, 10, 10, 15);

// ---- Reading the two pages ----
const decode = (text: string) => text.replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, '\'').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const strip = (html: string) => decode(html.replace(/<[^>]*>/g, ''));
/** The same text whatever the spaces and the minus sign: « −1 234,50 DZD » = « -1 234,50 DZD ». */
const squash = (text: string) => text.replace(/[\s  ⁦⁩]/g, '').replace(/[−–—]/g, '-');
/** An empty cell shows « — »; the comparison writes every dash as a minus sign. */
const DASH = squash('—');
const cells = (rowHtml: string) => [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((cell) => squash(strip(cell[1])));
/** The old page's cards, by label: the big number and the small line under it. */
function oldCards(html: string) {
    const cards = new Map<string, { value: string; note: string }>();
    for (const match of html.matchAll(/<div class="executive-card[^"]*">\s*<div class="label">([\s\S]*?)<\/div>\s*<div class="value[^"]*">([\s\S]*?)<\/div>(?:<div class="muted">([\s\S]*?)<\/div>)?/g))
        cards.set(decode(match[1]).trim(), { value: squash(strip(match[2])), note: decode(match[3] ?? '').trim() });
    return cards;
}
/** The new page's cards: the title, the big number and the small line under it. */
function newCards(html: string) {
    const cards = new Map<string, { value: string; note: string }>();
    for (const match of html.matchAll(/<\/i>([^<]*)<\/span><span class="self-start[^"]*">([\s\S]*?)<\/span>(?:<small class="text-\[11px\] text-neutral-500">([^<]*)<\/small>)?/g))
        cards.set(decode(match[1]).trim(), { value: squash(strip(match[2])), note: decode(match[3] ?? '').trim() });
    for (const match of html.matchAll(/<small class="text-\[11px\] text-neutral-500">([^<]*)<\/small><b class="self-start text-sm[^"]*">([\s\S]*?)<\/b>/g))
        cards.set(decode(match[1]).trim(), { value: squash(strip(match[2])), note: '' });
    return cards;
}
function oldRows(html: string, titleStart: string): string[][] {
    const start = html.indexOf(`<h2 class="section-title">${titleStart}`);
    assert.ok(start >= 0, `old section ${titleStart}`);
    const block = html.slice(start, html.indexOf('</section>', start));
    return [...block.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((row) => cells(row[1])).filter((row) => row.length > 0);
}
function newRows(html: string, title: string): string[][] {
    const start = html.indexOf(`<p class="text-[13.5px] font-bold">${title}</p>`);
    assert.ok(start >= 0, `new section ${title}`);
    const block = html.slice(start, html.indexOf('</section>', start));
    return [...block.matchAll(/<tr data-pdf-row=""[^>]*>([\s\S]*?)<\/tr>/g)].map((row) => cells(row[1]));
}
/** « 1 028,4 » or « -1 234 » as a number: the old log wrote plain « 1028.4 », the new one the French way. */
const readNumber = (text: string) => Number(text.replace(/[^\d,.\-]/g, '').replace(/,/g, '.'));
const oldCard = (cards: Map<string, { value: string; note: string }>, label: string) => {
    const card = cards.get(label);
    assert.ok(card, `old card ${label}`);
    return card;
};

// =====================================================================================
// The client list
// =====================================================================================
const NAMES = ['Nadia Cherif', 'Amine Bouzid', 'Sofiane "Sofi" Haddad', 'Meriem & Sœur Touati', 'Walid <Merabet>', 'Ghita Boukhalfa'];
const BALANCES = [0, 0.004, -0.004, 0.01, -0.01, 0.011, -0.011, 1234.5, -987_654.49, 15_000_000, -0.5, 12.5, -45_000.75];
const clientRows = (count: number): ClientListInput[] => Array.from({ length: count }, (_, index) => ({
    name: `${NAMES[index % NAMES.length]} ${index}`,
    phone: index % 3 === 0 ? undefined : `0550 ${String(100_000 + index * 37).slice(0, 6)}`,
    email: index % 4 === 0 ? undefined : `client${index}@example.invalid`,
    redotpay: index % 5 === 0 ? '' : `RP-${1000 + index}`,
    balance: BALANCES[index % BALANCES.length] * (index > BALANCES.length ? 1.5 : 1),
}));
let clientCompared = 0;
for (const count of [0, 1, 6, 13, 60]) {
    const what = `client list, ${count} clients`;
    const rows = clientRows(count);
    const oldHtml = buildClientListPdf(rows).html;
    const report = buildClientListReport({ rows, issuedAt: NOW });
    const fr = renderToStaticMarkup(<ClientListSheet report={report} lang="fr" variant="print"/>);
    const w = CLIENT_LIST_WORDS.fr;

    // The old sums, to the centime (the page only shows whole dinars, so a centime could hide there).
    assert.equal(report.totalDebt, rows.reduce((sum, row) => (row.balance < 0 ? sum + Math.abs(row.balance) : sum), 0), `${what}: every balance below zero is a debt`);
    assert.equal(report.totalAdvance, rows.reduce((sum, row) => (row.balance > 0 ? sum + row.balance : sum), 0), `${what}: every balance above zero is an advance`);
    assert.equal(report.debtCount, rows.filter((row) => row.balance < -0.01).length, `${what}: a client is in debt from a centime on`);
    assert.equal(report.advanceCount, rows.filter((row) => row.balance > 0.01).length, `${what}: a client is in credit from a centime on`);

    const before = oldCards(oldHtml);
    const after = newCards(fr);
    assert.equal(after.get(w.totalClients)?.value, oldCard(before, 'Total clients').value, `${what}: total`);
    assert.equal(after.get(w.toCollect)?.value, oldCard(before, 'Montants à encaisser des clients').value, `${what}: to collect`);
    assert.equal(after.get(w.toCollect)?.note, oldCard(before, 'Montants à encaisser des clients').note, `${what}: clients in debt`);
    assert.equal(after.get(w.inTheirFavour)?.value, oldCard(before, 'Soldes en faveur des clients').value, `${what}: in their favour`);
    assert.equal(after.get(w.inTheirFavour)?.note, oldCard(before, 'Soldes en faveur des clients').note, `${what}: clients in credit`);

    const oldList = count ? oldRows(oldHtml, 'Liste des clients') : [];
    assert.equal(oldList.length, count, `${what}: every client`);
    if (count) {
        const now = newRows(fr, w.listTitle(count));
        assert.equal(now.length, count, `${what}: the new list`);
        oldList.forEach((row, index) => {
            // The old balance cell carries the currency (« +1 234 DZD »), the new column's title does.
            assert.deepEqual(now[index], [row[0], row[1], row[2], row[3], row[4], row[5].replace(/DZD$/, ''), row[6]], `${what}: client ${index}`);
        });
    }
    else
        assert.ok(strip(fr).includes(w.empty), `${what}: nothing to list`);
    assert.equal((fr.match(/data-pdf-row=""/g) ?? []).length, count, `${what}: PDF rows`);
    const arabic = renderToStaticMarkup(<ClientListSheet report={report} lang="ar" variant="screen"/>);
    assert.deepEqual(distinctScreenNumbers(arabic), distinctScreenNumbers(fr), `${what}: Arabic and French show the same numbers`);
    for (const word of [CLIENT_LIST_WORDS.ar.title, CLIENT_LIST_WORDS.ar.toCollect, ...(count ? [CLIENT_LIST_WORDS.ar.colName] : [])])
        assert.ok(arabic.includes(word), `${what}: Arabic ${word}`);
    assert.ok(!arabic.includes(CLIENT_LIST_WORDS.fr.toCollect), `${what}: no French left in the Arabic page`);
    clientCompared++;
}
assert.equal(clientCompared, 5);
assert.equal(clientListFileName(NOW), 'ProDigital_Clients_2026-10-10.pdf');

// =====================================================================================
// The investor list
// =====================================================================================
const INVESTOR_NAMES = ['Karim Benali', 'Lydia Hamidi', 'Yacine "Yass" Merzouk', 'Samia & Frère Ait', 'Tarek <Belkacem>'];
const investorRows = (count: number, withLoss: boolean): InvestorListInput[] => Array.from({ length: count }, (_, index) => {
    const manager = index === 0;
    return {
        name: `${INVESTOR_NAMES[index % INVESTOR_NAMES.length]} ${index}`,
        isManager: manager,
        isActive: index % 4 !== 3,
        capitalInvested: 500_000 + index * 123_456.7,
        availableProfit: manager ? 0 : 12_345.6 + index * 777.4,
        withdrawnProfit: index * 5_000.5,
        totalProfit: (withLoss && index === count - 1 ? -10 : 1) * (45_000.4 + index * 3_210.9),
        roi: manager ? null : index % 3 === 0 ? 0 : index % 3 === 1 ? 8.456 * (index + 1) : -2.5,
        // A plain day, a whole timestamp (what the app saves) and no date at all
        entryDate: index % 5 === 4 ? '' : index % 2 === 0 ? `2026-0${1 + (index % 9)}-1${index % 9}` : `2026-0${1 + (index % 9)}-1${index % 9}T12:00:00.000Z`,
    };
});
let investorCompared = 0;
for (const [count, withLoss] of [[0, false], [1, false], [7, false], [12, false], [5, true]] as Array<[number, boolean]>) {
    const what = `investor list, ${count} investors${withLoss ? ' (one with a loss)' : ''}`;
    const rows = investorRows(count, withLoss);
    const oldHtml = buildInvestorListPdf(rows).html;
    const report = buildInvestorListReport({ rows, issuedAt: NOW });
    const fr = renderToStaticMarkup(<InvestorListSheet report={report} lang="fr" variant="print"/>);
    const w = INVESTOR_LIST_WORDS.fr;

    const before = oldCards(oldHtml);
    const after = newCards(fr);
    assert.equal(after.get(w.capital)?.value, oldCard(before, 'Capital investi').value, `${what}: capital`);
    assert.equal(after.get(w.capital)?.note, oldCard(before, 'Capital investi').note, `${what}: active investors`);
    assert.equal(after.get(w.availableProfits)?.value, oldCard(before, 'Profits disponibles des investisseurs').value, `${what}: available profits`);
    // The old card always wrote a « + », even before a loss (« +-5 DZD »); the new one writes the sign of the number.
    const oldTotal = oldCard(before, 'Profit total cumulé').value;
    assert.equal(after.get(w.totalProfit)?.value, report.totalGain < 0 ? oldTotal.replace('+-', '-') : oldTotal, `${what}: total profit`);
    if (withLoss)
        assert.ok(report.totalGain < 0 && oldTotal.startsWith('+-'), `${what}: the case where the old sign was wrong is in the fixture`);

    const oldList = count ? oldRows(oldHtml, 'Liste des investisseurs') : [];
    assert.equal(oldList.length, count, `${what}: every investor`);
    if (count) {
        const now = newRows(fr, w.listTitle(count));
        oldList.forEach((row, index) => {
            const investor = rows[index];
            // Name, role and status: three cells of the old page, one cell of the new one.
            const nameCell = `${squash(investor.name)}${row[2]}·${row[3]}`;
            // The old page wrote the saved text (« 2026-03-12T12:00:00.000Z »), the new one the day (« 12/03/2026 »).
            const entryDay = row[9] === '' ? DASH : row[9].slice(0, 10).split('-').reverse().join('/');
            assert.deepEqual(now[index], [row[0], nameCell, row[4], row[5], row[6], row[7], row[8], entryDay], `${what}: investor ${index}`);
            assert.equal(row[2], squash(investor.isManager ? 'Gérant' : 'Investisseur'), `${what}: the role the old page wrote`);
            assert.equal(row[3], squash(investor.isActive ? 'Actif' : 'Inactif'), `${what}: the status the old page wrote`);
        });
    }
    else
        assert.ok(strip(fr).includes(w.empty), `${what}: nothing to list`);
    assert.equal((fr.match(/data-pdf-row=""/g) ?? []).length, count, `${what}: PDF rows`);
    const arabic = renderToStaticMarkup(<InvestorListSheet report={report} lang="ar" variant="screen"/>);
    assert.deepEqual(distinctScreenNumbers(arabic), distinctScreenNumbers(fr), `${what}: Arabic and French show the same numbers`);
    for (const word of [INVESTOR_LIST_WORDS.ar.title, INVESTOR_LIST_WORDS.ar.capital, ...(count ? [INVESTOR_LIST_WORDS.ar.colName] : [])])
        assert.ok(arabic.includes(word), `${what}: Arabic ${word}`);
    investorCompared++;
}
assert.equal(investorCompared, 5);
assert.equal(investorEntryDay('2025-01-15'), '15/01/2025');
assert.equal(investorEntryDay('2025-01-15T12:00:00.000Z'), '15/01/2025');
assert.equal(investorEntryDay('  2025-01-15  '), '15/01/2025');
assert.equal(investorEntryDay(''), '');
assert.equal(investorEntryDay('   '), '');
assert.equal(investorEntryDay('not a date'), 'not a date');
assert.equal(investorListFileName(NOW), 'ProDigital_Investisseurs_2026-10-10.pdf');

// =====================================================================================
// The operations log
// =====================================================================================
const CATEGORY_FR = { portfolio: 'Portefeuille', client: 'Client', digital_service: 'Service numérique', treasury: 'Trésorerie' } as const;
const PORTFOLIO_TYPES: Array<{ label: string; side: 'buy' | 'sell'; currency: string }> = [
    { label: 'Achat USDT', side: 'buy', currency: 'USDT' },
    { label: 'Vente USDT', side: 'sell', currency: 'USDT' },
    { label: 'Vente USDT (en EUR)', side: 'sell', currency: 'USDT' },
    { label: 'Achat EUR', side: 'buy', currency: 'EUR' },
    { label: 'Vente EUR', side: 'sell', currency: 'EUR' },
];
const QUANTITIES = [1028.4, 25_000, 0.5, 2_589.1234, 7, 1_500_000];
const PRICES = [251.3, 244.1, 252.95, 262.4017, 0.9215, 0];
const TAGS = [[], ['credit'], ['credit', 'urgent'], ['vip']];
/** The same operations in the two shapes: what the old log took (all text) and what the new one takes. */
type OldLogRow = Parameters<typeof buildTransactionListPdf>[0][number];
function logRows(count: number): { old: OldLogRow[]; now: TransactionListInput[] } {
    const old: OldLogRow[] = [];
    const now: TransactionListInput[] = [];
    for (let index = 0; index < count; index++) {
        const ts = at(2026, 10, 1 + (index % 9), 8 + (index % 12), (index * 13) % 60);
        const date = `${String(new Date(ts).getDate()).padStart(2, '0')}/10/2026`;
        const time = `${String(new Date(ts).getHours()).padStart(2, '0')}:${String(new Date(ts).getMinutes()).padStart(2, '0')}`;
        const client = index % 3 === 0 ? '' : `${NAMES[index % NAMES.length]}`;
        const notes = index % 2 === 0 ? '' : index % 4 === 1 ? `Acompte "novembre" & <frais> ${index}` : 'Règlement du mois';
        const tags = TAGS[index % TAGS.length];
        const quantity = QUANTITIES[index % QUANTITIES.length];
        const price = PRICES[index % PRICES.length];
        const total = quantity * price + 0.4;
        const kind = index % 4;
        if (kind === 0) {
            const type = PORTFOLIO_TYPES[index % PORTFOLIO_TYPES.length];
            old.push({ date, time, category: 'Portefeuille', type: type.label, currency: type.currency, quantity: String(quantity), price: String(price), totalDzd: String(Math.round(total)), client, notes, tags: tags.map((tag) => (tag === 'credit' ? 'Paiement différé' : tag)).join(';') });
            now.push({ category: 'portfolio', date, time, type: type.label, currency: type.currency, quantity, price, totalDzd: Math.round(total), client, notes, tags, side: type.side });
        }
        else if (kind === 1) {
            old.push({ date, time, category: 'Client', type: 'Encaissement du client', currency: 'DZD', quantity: '', price: '', totalDzd: String(Math.round(Math.abs(total))), client, notes, tags: tags.map((tag) => (tag === 'credit' ? 'Paiement différé' : tag)).join(';') });
            now.push({ category: 'client', date, time, type: 'Encaissement du client', currency: 'DZD', quantity: null, price: null, totalDzd: Math.round(Math.abs(total)), client, notes, tags });
        }
        else if (kind === 2) {
            old.push({ date, time, category: 'Service numérique', type: 'Vente service numérique', currency: 'EUR', quantity: String(quantity), price: '', totalDzd: String(Math.round(total)), client, notes, tags: tags.map((tag) => (tag === 'credit' ? 'Paiement différé' : tag)).join(';') });
            now.push({ category: 'digital_service', date, time, type: 'Vente service numérique', currency: 'EUR', quantity, price: null, totalDzd: Math.round(total), client, notes, tags });
        }
        else {
            old.push({ date, time, category: 'Trésorerie', type: 'Retrait de trésorerie', currency: 'DZD', quantity: '', price: '', totalDzd: String(Math.round(total)), client: '', notes, tags: tags.map((tag) => (tag === 'credit' ? 'Paiement différé' : tag)).join(';') });
            now.push({ category: 'treasury', date, time, type: 'Retrait de trésorerie', currency: 'DZD', quantity: null, price: null, totalDzd: Math.round(total), client: '', notes, tags });
        }
    }
    return { old, now };
}
let logCompared = 0;
for (const count of [0, 1, 9, 40, 130]) {
    const what = `operations log, ${count} operations`;
    const { old, now: rows } = logRows(count);
    const oldHtml = buildTransactionListPdf(old, `${count} opérations`).html;
    const report = buildTransactionListReport({ rows, issuedAt: NOW });
    const fr = renderToStaticMarkup(<TransactionListSheet report={report} lang="fr" variant="print"/>);
    const w = TRANSACTION_LIST_WORDS.fr;

    const before = oldCards(oldHtml);
    const after = newCards(fr);
    for (const [oldLabel, newLabel] of [['Total opérations', w.totalOperations], ['Achats portefeuille', w.portfolioBuys], ['Ventes portefeuille', w.portfolioSales]] as const)
        assert.equal(after.get(newLabel)?.value, oldCard(before, oldLabel).value, `${what}: ${oldLabel}`);

    const oldList = count ? oldRows(oldHtml, 'Historique des opérations') : [];
    assert.equal(oldList.length, count, `${what}: every operation`);
    if (count) {
        const shown = newRows(fr, w.listTitle(count));
        assert.equal(shown.length, count, `${what}: the new log`);
        oldList.forEach((row, index) => {
            const [date, time, category, type, currency, quantity, price, total, client, notes, tags] = row;
            const [dateTime, typeCategory, quantityCurrency, shownPrice, shownTotal, shownClient, notesTags] = shown[index];
            assert.equal(dateTime, `${date}${time}`, `${what}: operation ${index} date and time`);
            assert.equal(category, squash(CATEGORY_FR[rows[index].category]), `${what}: operation ${index} the category the old page wrote`);
            assert.equal(typeCategory, `${type}${squash(w.categories[rows[index].category])}`, `${what}: operation ${index} type and category`);
            // The quantity and its currency: the number is the same, written with separators.
            const quantityText = quantityCurrency.slice(0, quantityCurrency.length - squash(currency).length);
            assert.ok(quantityCurrency.endsWith(squash(currency)), `${what}: operation ${index} currency`);
            if (quantity === '')
                assert.equal(quantityText, '', `${what}: operation ${index} no quantity`);
            else
                assert.equal(readNumber(quantityText), Number(quantity), `${what}: operation ${index} quantity`);
            if (price === '')
                assert.equal(shownPrice, DASH, `${what}: operation ${index} no price`);
            else
                assert.equal(readNumber(shownPrice), Number(price), `${what}: operation ${index} price`);
            assert.equal(readNumber(shownTotal), Number(total), `${what}: operation ${index} total`);
            assert.equal(shownClient, client === '' ? DASH : client, `${what}: operation ${index} client`);
            assert.equal(notesTags, `${notes === '' ? DASH : notes}${tags.split(';').filter(Boolean).join('')}`, `${what}: operation ${index} notes and tags`);
        });
    }
    else
        assert.ok(strip(fr).includes(w.empty), `${what}: nothing to list`);
    assert.equal((fr.match(/data-pdf-row=""/g) ?? []).length, count, `${what}: PDF rows`);
    const arabic = renderToStaticMarkup(<TransactionListSheet report={report} lang="ar" variant="screen"/>);
    assert.deepEqual(distinctScreenNumbers(arabic), distinctScreenNumbers(fr), `${what}: Arabic and French show the same numbers`);
    for (const word of [TRANSACTION_LIST_WORDS.ar.title, TRANSACTION_LIST_WORDS.ar.portfolioBuys, ...(count ? [TRANSACTION_LIST_WORDS.ar.colType] : [])])
        assert.ok(arabic.includes(word), `${what}: Arabic ${word}`);
    if (count > 3)
        assert.ok(arabic.includes('دفع مؤجل'), `${what}: the « credit » tag is written in Arabic`);
    logCompared++;
}
assert.equal(logCompared, 5);
assert.equal(transactionListFileName(NOW), 'ProDigital_Operations_2026-10-10.pdf');

// The old log counted purchases and sales by the words of the label (« vente », « achat »), so an Arabic
// app's export counted none; the new one counts them from the operation itself, whatever the language.
{
    const rows: TransactionListInput[] = [
        { category: 'portfolio', date: '01/10/2026', time: '10:00', type: 'شراء USDT', currency: 'USDT', quantity: 100, price: 240, totalDzd: 24_000, client: '', notes: '', tags: [], side: 'buy' },
        { category: 'portfolio', date: '02/10/2026', time: '10:00', type: 'بيع USDT', currency: 'USDT', quantity: 50, price: 255, totalDzd: 12_750, client: '', notes: '', tags: [], side: 'sell' },
        { category: 'portfolio', date: '03/10/2026', time: '10:00', type: 'بيع USDT', currency: 'USDT', quantity: 20, price: 255, totalDzd: 5_100, client: '', notes: '', tags: [], side: 'sell' },
        { category: 'client', date: '03/10/2026', time: '11:00', type: 'تحصيل من العميل', currency: 'DZD', quantity: null, price: null, totalDzd: 5_100, client: 'X', notes: '', tags: [], side: undefined },
    ];
    const report = buildTransactionListReport({ rows, issuedAt: NOW });
    assert.equal(report.buyCount, 1);
    assert.equal(report.sellCount, 2);
    const oldArabic = buildTransactionListPdf(rows.map((row) => ({ date: row.date, time: row.time, category: CATEGORY_FR[row.category], type: row.type, currency: row.currency, quantity: String(row.quantity ?? ''), price: String(row.price ?? ''), totalDzd: String(row.totalDzd), client: row.client, notes: row.notes, tags: '' })), '4').html;
    assert.equal(oldCard(oldCards(oldArabic), 'Achats portefeuille').value, '0');
}

// Operations that are neither purchases nor sales (a manual stock adjustment) are in the total only.
{
    const base = { date: '01/10/2026', time: '10:00', currency: 'USDT', quantity: 10, price: 0, totalDzd: 0, client: '', notes: '', tags: [] as string[] };
    const report = buildTransactionListReport({ rows: [{ ...base, category: 'portfolio', type: 'Ajustement stock (+)' }, { ...base, category: 'portfolio', type: 'Achat USDT', side: 'buy' }], issuedAt: NOW });
    assert.deepEqual([report.operationCount, report.buyCount, report.sellCount], [2, 1, 0]);
}

console.log('client list, investor list and operations log comparison passed');
