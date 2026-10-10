import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { ExpensesReportSheet, expensesPeriodLabel } from '../components/reports/documents/ExpensesReportSheet';
import { MonthlyReportSheet } from '../components/reports/documents/MonthlyReportSheet';
import { TreasuryReportSheet } from '../components/reports/documents/TreasuryReportSheet';
import { EXPENSES_REPORT_WORDS, MONTHLY_REPORT_WORDS, TREASURY_REPORT_WORDS, reportTranslator } from '../components/reports/documentWords';
import { distinctScreenNumbers } from '../testing/screenNumbers';
import { translations } from '../translations';
import type { ClientDzd, ClientTransactionDzd, TreasuryTx, Tx } from '../types';
import { buildExpensesReport, expensesPeriods, expensesReportFileName, type ExpensesPeriodKey } from './expensesReport';
import { buildMonthlyReport, monthlyReportFileName } from './monthlyReport';
import { computePamLedger } from './pamLedger';
import { buildMonthlyPdfReport, buildPersonalExpensesPdfReport, buildTreasuryPdf } from './pdfReports';
import { buildTreasuryReport, treasuryReportFileName } from './treasuryReport';

// V3-6 moves the monthly report, the personal-expenses report and the treasury report to the
// client report's look (the shared report frame, in Arabic or French). Their numbers must not move:
// each number of the new page is the number the old printed report (pdfReports.ts) showed, for
// every month, period and movement of the fixtures below. The operation names are the app's own
// (« Achat USDT »), the old report used longer ones (« Achat USDT (Portefeuille) »).

const two = (value: number) => String(value).padStart(2, '0');
const at = (year: number, month: number, day: number, hour = 12, minute = 0) => new Date(year, month - 1, day, hour, minute).getTime();
const dayOf = (ts: number) => { const d = new Date(ts); return `${two(d.getDate())}/${two(d.getMonth() + 1)}/${d.getFullYear()}`; };
const timeOf = (ts: number) => { const d = new Date(ts); return `${two(d.getHours())}:${two(d.getMinutes())}`; };
const NOW = at(2026, 10, 9, 15);
const T = reportTranslator('fr');

// ---- Reading the two pages ----
const decode = (text: string) => text.replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, '\'').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const strip = (html: string) => decode(html.replace(/<[^>]*>/g, ''));
/** The same text whatever the spaces and the minus sign: « −1 234,50 DZD » = « -1 234,50 DZD ». */
const squash = (text: string) => text.replace(/[\s  ⁦⁩]/g, '').replace(/[−–—]/g, '-');
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The old page's cards: « executive-card » and « card », by label. */
function oldCards(html: string) {
    const cards = new Map<string, string>();
    for (const match of html.matchAll(/<div class="(?:executive-card|movement-card|card)[^"]*">\s*<div class="label">([\s\S]*?)<\/div>\s*<div class="value[^"]*">([\s\S]*?)<\/div>/g))
        cards.set(decode(match[1]).trim(), squash(strip(match[2])));
    return cards;
}
/** The new page's cards (title and big number) and facts (small label and number), by label. */
function newCards(html: string) {
    const cards = new Map<string, string>();
    for (const match of html.matchAll(/<\/i>([^<]*)<\/span><span class="self-start[^"]*">([\s\S]*?)<\/span>/g))
        cards.set(decode(match[1]).trim(), squash(strip(match[2])));
    for (const match of html.matchAll(/<small class="text-\[11px\] text-neutral-500">([^<]*)<\/small><b class="self-start text-sm[^"]*">([\s\S]*?)<\/b>/g))
        cards.set(decode(match[1]).trim(), squash(strip(match[2])));
    return cards;
}
const cells = (rowHtml: string) => [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((cell) => squash(strip(cell[1])));
/** The body rows of the old page's table under a section title. */
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
const hasOldSection = (html: string, titleStart: string) => html.includes(`<h2 class="section-title">${titleStart}`);
const hasNewSection = (html: string, title: string) => html.includes(`<p class="text-[13.5px] font-bold">${title}</p>`);
/** The number in a note such as « 3 autre(s) client(s) non affiché(s) ». */
const noteCount = (html: string, pattern: RegExp) => {
    const match = strip(html).replace(/\s+/g, ' ').match(pattern);
    return match ? Number(match[1]) : 0;
};

// =====================================================================================
// The monthly report
// =====================================================================================
const clients: ClientDzd[] = [
    { id: 'c01', fullName: 'Sofiane Haddad' }, { id: 'c02', fullName: 'Lina Mansouri' }, { id: 'c03', fullName: 'Karim & Fils <SARL> D\'Alger' },
    { id: 'c04', fullName: 'Omar Kaci' }, { id: 'c05', fullName: 'Yacine Benali' }, { id: 'c06', fullName: 'Nadia Cherif' },
    { id: 'c07', fullName: 'Amine Bouzid' }, { id: 'c08', fullName: 'Samira Khelifi' }, { id: 'c09', fullName: 'Walid Merabet' },
    { id: 'c10', fullName: 'Rania Belkacem' }, { id: 'c11', fullName: 'Tarek Zerrouki' }, { id: 'c12', fullName: 'Imane Ferhat' },
];
const getClientName = (client: ClientDzd) => client.fullName;

let txCount = 0;
const base = (ts: number) => ({ date: dayOf(ts), time: timeOf(ts), timestamp: ts });
const buyUsdt = (id: string, ts: number, quantity: number, price: number, extra: Partial<Tx> = {}): Tx => ({ id, type: 'buy', currency: 'USDT', quantity, price, total: quantity * price, ...base(ts), ...extra } as Tx);
const sellUsdt = (id: string, ts: number, quantity: number, sell: number, extra: Partial<Tx> = {}): Tx => ({ id, type: 'sell', currency: 'USDT', quantity, sell, total: quantity * sell, ...base(ts), ...extra } as Tx);
const buyEur = (id: string, ts: number, quantity: number, price: number, extra: Partial<Tx> = {}): Tx => ({ id, type: 'buy', currency: 'EUR', quantity, price, total: quantity * price, ...base(ts), ...extra } as Tx);
const sellEur = (id: string, ts: number, quantity: number, sell: number, extra: Partial<Tx> = {}): Tx => ({ id, type: 'sell', currency: 'EUR', quantity, sell, total: quantity * sell, ...base(ts), ...extra } as Tx);

const transactions: Tx[] = [];
const clientRows: ClientTransactionDzd[] = [];
const link = (tx: Tx, clientId: string, extra: Partial<ClientTransactionDzd> = {}) => {
    clientRows.push({ id: `link-${tx.id}-${clientId}`, clientId, timestamp: tx.timestamp, date: tx.date, time: tx.time, montant: tx.type === 'sell' ? -(tx.total ?? 0) : (tx.total ?? 0), type: tx.type === 'sell' ? 'Vente USDT' : 'Paiement Effectué', linkedTxId: tx.id, linkRole: 'primary', ...extra });
};
const clientMove = (id: string, clientId: string, ts: number, montant: number, type: ClientTransactionDzd['type'], notes?: string, extra: Partial<ClientTransactionDzd> = {}) => {
    clientRows.push({ id, clientId, timestamp: ts, date: dayOf(ts), time: timeOf(ts), montant, type, notes, ...extra });
};

// August: the first ten sales have nothing in stock (they are listed as alerts), then purchases.
for (let index = 0; index < 10; index++) {
    const tx = sellUsdt(`aug-s${index}`, at(2026, 8, 1 + index, 10), 100 + index * 50.5, 250 + index);
    transactions.push(tx);
    link(tx, clients[index % 3].id);
}
transactions.push(buyUsdt('aug-b1', at(2026, 8, 15, 9), 20_000, 241.5));
transactions.push(buyEur('aug-e1', at(2026, 8, 16, 9), 3_000, 262.4));
transactions.push(sellUsdt('aug-s11', at(2026, 8, 20, 14), 1_500, 256.25, {}));
link(transactions[transactions.length - 1], 'c01');

// September: ordinary month.
for (let index = 0; index < 6; index++) {
    const tx = buyUsdt(`sep-b${index}`, at(2026, 9, 1 + index * 4, 9 + index), 1_000 + index * 333.33, 243 + index * 0.75);
    transactions.push(tx);
    if (index % 2 === 0)
        link(tx, clients[3 + index].id);
}
for (let index = 0; index < 7; index++) {
    const tx = sellUsdt(`sep-s${index}`, at(2026, 9, 2 + index * 3, 11 + (index % 5)), 400 + index * 123.45, 255 + index * 0.6);
    transactions.push(tx);
    link(tx, clients[index % 5].id);
}
transactions.push(buyEur('sep-e1', at(2026, 9, 12, 9), 1_200, 261.1));
transactions.push(sellEur('sep-e2', at(2026, 9, 25, 16), 800, 266.55));
link(transactions[transactions.length - 1], 'c02', { type: 'Vente EUR' });

// October: a long month, more than 25 operations, 12 clients, a sale paid in euros, manual adjustments.
for (let index = 0; index < 14; index++) {
    const tx = buyUsdt(`oct-b${index}`, at(2026, 10, 1 + (index % 9), 8 + index % 10, index), 900 + index * 211.17, 244 + (index % 7) * 0.9);
    transactions.push(tx);
    if (index % 3 === 0)
        link(tx, clients[index % 12].id);
}
for (let index = 0; index < 20; index++) {
    const tx = sellUsdt(`oct-s${index}`, at(2026, 10, 1 + (index % 9), 11 + index % 8, 7 + index), 300 + index * 97.31, 254 + (index % 11) * 0.85, index === 3 ? { notes: 'Livraison "express" & frais' } : {});
    transactions.push(tx);
    link(tx, clients[index % 12].id, index === 4 ? { linkRole: 'dzd_receiver' } : {});
}
// The same sale linked twice (the receiver of the dinars is the secondary link).
link(transactions[transactions.length - 1], 'c12', { linkRole: 'dzd_receiver', id: 'dup-link' });
// A sale linked to a client that is not in the list any more.
{
    const tx = sellUsdt('oct-ghost', at(2026, 10, 8, 18), 60_000, 257.3);
    transactions.push(tx);
    link(tx, 'c-ghost');
}
transactions.push(buyEur('oct-e1', at(2026, 10, 3, 9), 2_000, 262.8));
{
    const tx = sellEur('oct-e2', at(2026, 10, 6, 15), 750.5, 267.1, { notes: 'EUR en espèces' });
    transactions.push(tx);
    link(tx, 'c07', { type: 'Vente EUR' });
}
{
    const tx = sellUsdt('oct-eur', at(2026, 10, 7, 12), 500, 258, { settlementCurrency: 'EUR', sellPriceEur: 0.9432, saleValueEur: 471.6, eurToDzdRateAtSale: 273.5, notes: 'Réglé en euros' });
    transactions.push(tx);
    link(tx, 'c05');
}
transactions.push({ id: 'oct-adj1', type: 'Ajout Manuel', currency: 'USDT', quantity: 12.5, price: 0, ...base(at(2026, 10, 5, 20)), notes: 'Correction' } as Tx);
transactions.push({ id: 'oct-adj2', type: 'Retrait Manuel', currency: 'EUR', quantity: 5, price: 0, ...base(at(2026, 10, 5, 21)) } as Tx);
transactions.push(sellUsdt('oct-nolink', at(2026, 10, 9, 10), 120, 256));

// Movements of the clients' accounts (dinars), alone: receipts, payouts, transfers, other kinds.
const moveTypes: ClientTransactionDzd['type'][] = ['Règlement Reçu', 'Paiement Effectué', 'Solde Initial', 'Ajustement Solde', 'Vente service numérique', 'Remise solde', 'Achat EUR'];
for (let index = 0; index < 34; index++) {
    const type = moveTypes[index % moveTypes.length];
    clientMove(`mv${index}`, clients[(index * 5) % 12].id, at(2026, 10, 1 + (index % 9), 8 + index % 12, (index * 7) % 60), (index % 2 ? -1 : 1) * (1_500.5 + index * 3_217.25), type, index % 4 === 0 ? `Note ${index} "a" & <b>` : index % 4 === 1 ? 'Reçu de Omar Kaci' : undefined);
}
// A transfer between two clients, on both sides, and one whose other side is a client that is gone.
{
    const ts = at(2026, 10, 4, 13, 20);
    clientMove('tr-out', 'c01', ts, -25_000, 'Transfert Sortant', 'Transfert vers Lina Mansouri', { linkedTxId: 'tr-in' });
    clientMove('tr-in', 'c02', ts, 25_000, 'Transfert Entrant', 'Transfert de Sofiane Haddad', { linkedTxId: 'tr-out' });
    clientMove('tr2-out', 'c03', at(2026, 10, 5, 9, 5), -8_000, 'Transfert Sortant', 'Pour le loyer');
    clientMove('tr2-in', 'c04', at(2026, 10, 5, 9, 5), 8_000, 'Transfert Entrant');
    clientMove('tr3-out', 'c05', at(2026, 10, 6, 9, 5), -1_000, 'Transfert Sortant', undefined, { linkedTxId: 'tr3-in' });
    clientMove('tr3-in', 'c-gone', at(2026, 10, 6, 9, 5), 1_000, 'Transfert Entrant', undefined, { linkedTxId: 'tr3-out' });
    clientMove('tr4-out', 'c06', at(2026, 10, 7, 9, 5), -3_300, 'Transfert Sortant');
    clientMove('ghost-move', 'c-ghost', at(2026, 10, 7, 10, 5), 4_000, 'Règlement Reçu');
}
// November: only a client movement, no portfolio operation.
clientMove('nov-1', 'c09', at(2026, 11, 3, 10), 12_000, 'Règlement Reçu', 'Acompte');

const pamLedger = computePamLedger(transactions);
const portfolioStats = pamLedger.portfolioStats;
const monthInput = (month: number, year = 2026) => ({ month, year, transactions, clientTransactions: clientRows, clients, getClientName, portfolioStats, pamLedger });

// The old report names its operations in long French; the new one uses the app's names.
const OLD_TO_NEW_TYPES: Record<string, string> = {
    'Achat USDT (Portefeuille)': 'Achat USDT',
    'Achat EUR (Portefeuille)': 'Achat EUR',
    'Vente USDT au Client': 'Vente USDT',
    'Vente EUR au Client': 'Vente EUR',
    'Vente USDT->EUR': 'Vente USDT → EUR',
    'Vente USDT -> EUR': 'Vente USDT → EUR',
    'Ajustement + Portefeuille': 'Correction de solde +',
    'Ajustement - Portefeuille': 'Correction de solde -',
    'Solde initial client': 'Solde initial',
    'Correction solde client': 'Correction de solde client',
};
const TYPE_MAP = new Map(Object.entries(OLD_TO_NEW_TYPES).map(([oldName, newName]) => [squash(oldName), squash(newName)]));
/** The new name of an operation, from the old page's name (already squashed by the table reader). */
const typeName = (oldName: string) => TYPE_MAP.get(oldName) ?? oldName;
/** The old page wrote « Non lie » without the accent. */
const clientName = (oldName: string) => (oldName === squash('Non lie') ? squash('Non lié') : oldName);

let monthlyCompared = 0;
const seenFeatures = new Set<string>();
for (const [name, month] of [['August (alerts, hidden alerts)', 7], ['September', 8], ['October (long)', 9], ['November (client movement only)', 10], ['January 2020 (nothing at all)', 0]] as Array<[string, number]>) {
    const year = month === 0 ? 2020 : 2026;
    const input = monthInput(month, year);
    const oldHtml = buildMonthlyPdfReport({ ...input, monthLabel: translations.fr.common.months[month] }).html;
    const report = buildMonthlyReport(input);
    const fr = renderToStaticMarkup(<MonthlyReportSheet report={report} lang="fr" issuedAt={NOW} variant="print"/>);
    const what = `monthly report, ${name}`;
    const w = MONTHLY_REPORT_WORDS.fr;

    // The summary and the state of the portfolio.
    const before = oldCards(oldHtml);
    const after = newCards(fr);
    assert.ok(before.size >= 8, `${what}: the old cards were read (${before.size})`);
    for (const [oldLabel, newLabel] of [['USDT achete / vendu', w.usdtBoughtSold], ['EUR achete / vendu', w.eurBoughtSold], ['Operations', w.operations], ['Profit de vente réalisé (PAM)', w.realizedProfit], ['Top client — profit de vente (PAM)', w.topClient], ['Profit de vente cumulé (PAM)', w.cumulativeProfit]] as const)
        assert.equal(after.get(newLabel), before.get(oldLabel), `${what}: ${oldLabel}`);
    for (const label of ['Achats Portefeuille', 'Ventes Portefeuille', 'Mouvements clients']) {
        const old = strip(oldHtml).match(new RegExp(`${escapeRegExp(label)}:\\s*(\\d+)`));
        assert.ok(old, `${what}: old ${label}`);
        assert.equal(after.get(label), old[1], `${what}: ${label}`);
    }
    // The cards of the portfolio: available quantity, then the average buying price under it.
    {
        const old = [...oldHtml.matchAll(/<div class="card">\s*<div class="label">([^<]*)<\/div>\s*<div class="value">([^<]*)<\/div>\s*<div class="muted">Prix moyen d’achat \(PAM\): ([^<]*)<\/div>/g)];
        assert.equal(old.length, 2, `${what}: two portfolio cards`);
        assert.equal(after.get(w.usdtAvailable), squash(old[0][2]), `${what}: USDT available`);
        assert.equal(after.get(w.eurAvailable), squash(old[1][2]), `${what}: EUR available`);
        const averages = [...strip(fr).matchAll(/Prix moyen d’achat \(PAM\): ?([^A-Za-z]*DZD)/g)].map((match) => squash(match[1]));
        assert.deepEqual(averages, old.map((card) => squash(card[3])), `${what}: average buying prices`);
    }

    // The alerts: a listed sale per uncosted row.
    assert.equal(hasNewSection(fr, w.uncostedTitle), hasOldSection(oldHtml, 'Alertes comptables'), `${what}: alerts shown together`);
    if (report.uncosted) {
        seenFeatures.add('alerts');
        const rows = oldRows(oldHtml, 'Alertes comptables');
        const now = newRows(fr, w.uncostedTitle);
        assert.deepEqual(now, rows.map((row) => row), `${what}: alert rows`);
        const pills = strip(oldHtml).match(/uncostedQuantitySold: (\d+)\s*Quantité sans coût: ([\d\s.,  ]+) (\w+)/);
        assert.ok(pills, `${what}: old alert pills`);
        assert.equal(String(report.uncosted.count), pills[1]);
        assert.equal(after.get(w.uncostedCount), pills[1], `${what}: alert count`);
        assert.equal(after.get(w.uncostedQuantity), squash(`${pills[2].trim()}${pills[3]}`), `${what}: quantity without cost`);
        assert.equal(report.uncosted.hidden, noteCount(oldHtml, /(\d+) autre\(s\) transaction\(s\) masquée/), `${what}: hidden alerts`);
        if (report.uncosted.hidden > 0)
            seenFeatures.add('hidden alerts');
    }

    // The ranking of clients.
    {
        const rows = hasOldSection(oldHtml, 'Top Clients du Mois') ? oldRows(oldHtml, 'Top Clients du Mois') : [];
        assert.equal(report.ranking.rows.length, rows.length, `${what}: ranking length`);
        assert.ok(hasOldSection(oldHtml, `Top Clients du Mois (${rows.length})`), `${what}: old ranking title`);
        assert.ok(hasNewSection(fr, w.rankingTitle(rows.length)), `${what}: new ranking title`);
        if (rows.length)
            assert.deepEqual(newRows(fr, w.rankingTitle(rows.length)), rows, `${what}: ranking rows`);
        else
            assert.ok(strip(fr).includes(w.rankingEmpty) && oldHtml.includes('Aucun classement client disponible sur cette période.'), `${what}: no ranking`);
        assert.equal(report.ranking.hidden, noteCount(oldHtml, /(\d+) autre\(s\) client\(s\) non affiché/), `${what}: hidden clients`);
        if (report.ranking.hidden > 0)
            seenFeatures.add('hidden clients');
        if (rows.some((row) => row[1] === squash('Client inconnu')))
            seenFeatures.add('unknown client');
    }

    // The portfolio operations.
    {
        const count = report.portfolioOperations.rows.length;
        const title = `Détails opérations portefeuille (${count})`;
        assert.ok(hasOldSection(oldHtml, title), `${what}: old operations title`);
        const rows = count ? oldRows(oldHtml, title) : [];
        assert.equal(rows.length, count, `${what}: operations length`);
        if (count) {
            const now = newRows(fr, w.operationsTitle(count));
            assert.equal(now.length, count);
            rows.forEach((row, index) => {
                const found = now[index];
                // Date, [type], client, quantity, price, total, profit, notes
                assert.deepEqual([found[0], found[2], found[3], found[4], found[5], found[6], found[7]], [row[0], clientName(row[2]), row[3], row[4], row[5], row[6], row[7]], `${what}: operation ${index}`);
                assert.equal(found[1], typeName(row[1]), `${what}: name of operation ${index}`);
                if (row[1].includes('->'))
                    seenFeatures.add('sale in euros');
                if (row[2] === squash('Non lie'))
                    seenFeatures.add('unlinked');
            });
        }
        else
            assert.ok(strip(fr).includes(w.operationsEmpty) && oldHtml.includes('Aucune opération portefeuille enregistrée sur cette période.'), `${what}: no operation`);
        assert.equal(report.portfolioOperations.hidden, noteCount(oldHtml, /(\d+) opération\(s\) supplémentaire/), `${what}: hidden operations`);
        if (report.portfolioOperations.hidden > 0)
            seenFeatures.add('hidden operations');
    }

    // The movements of the clients' accounts.
    {
        const count = report.clientMovements.rows.length;
        const title = `Mouvements clients DZD (${count})`;
        assert.ok(hasOldSection(oldHtml, title), `${what}: old movements title`);
        const rows = count ? oldRows(oldHtml, title) : [];
        assert.equal(rows.length, count, `${what}: movements length`);
        if (count) {
            const now = newRows(fr, w.movementsTitle(count));
            rows.forEach((row, index) => {
                const found = now[index];
                assert.deepEqual([found[0], found[1], found[3], found[4]], [row[0], row[1], row[3], row[4]], `${what}: movement ${index}`);
                assert.equal(found[2], typeName(row[2]), `${what}: name of movement ${index}`);
                if (row[2].startsWith('Transfert'))
                    seenFeatures.add('transfer');
            });
        }
        else
            assert.ok(strip(fr).includes(w.movementsEmpty) && oldHtml.includes('Aucun mouvement client DZD sur cette période.'), `${what}: no movement`);
        assert.equal(report.clientMovements.hidden, noteCount(oldHtml, /(\d+) mouvement\(s\) client supplémentaire/), `${what}: hidden movements`);
        if (report.clientMovements.hidden > 0)
            seenFeatures.add('hidden movements');
    }

    // Every list row is a PDF row, and the Arabic page shows exactly the same numbers.
    assert.equal((fr.match(/data-pdf-row=""/g) ?? []).length, (report.uncosted?.rows.length ?? 0) + report.ranking.rows.length + report.portfolioOperations.rows.length + report.clientMovements.rows.length, `${what}: PDF rows`);
    const arabic = renderToStaticMarkup(<MonthlyReportSheet report={report} lang="ar" issuedAt={NOW} variant="screen"/>);
    assert.deepEqual(distinctScreenNumbers(arabic), distinctScreenNumbers(fr), `${what}: Arabic and French show the same numbers`);
    assert.ok(arabic.includes('dir="rtl"') && arabic.includes(MONTHLY_REPORT_WORDS.ar.summaryTitle), `${what}: the Arabic page is right to left and in Arabic`);
    monthlyCompared++;
}
assert.equal(monthlyCompared, 5);
for (const feature of ['alerts', 'hidden alerts', 'hidden clients', 'hidden operations', 'hidden movements', 'unknown client', 'sale in euros', 'unlinked', 'transfer'])
    assert.ok(seenFeatures.has(feature), `The fixture reaches: ${feature}`);
assert.equal(monthlyReportFileName(9, 2026), 'ProDigital_Rapport-mensuel_2026-10.pdf');

console.log('monthly report comparison passed');

// =====================================================================================
// The personal-expenses report
// =====================================================================================
const expense = (id: string, ts: number, amount: number, fields: Partial<TreasuryTx> = {}): TreasuryTx => ({
    id, amount, timestamp: ts, date: dayOf(ts), time: timeOf(ts), type: 'Retrait', origin: 'personal_expense', source: 'Caisse', ...fields,
});
const expenses: TreasuryTx[] = [];
// Two years of ordinary expenses, more than forty in October.
for (let index = 0; index < 46; index++)
    expenses.push(expense(`x-oct-${index}`, at(2026, 10, 1 + (index % 9), 8 + (index % 12), (index * 11) % 60), 750.5 + index * 413.27, {
        source: index % 3 === 0 ? 'BaridiMob' : index % 7 === 0 ? undefined : 'Caisse',
        notes: index % 4 === 0 ? undefined : index % 5 === 0 ? `Restaurant "Le Bosphore" & amis ${index}` : `Dépense ${index}`,
        ...(index % 9 === 4 ? { advanceState: 'settled' as const, settledAmount: 520.25 + index } : {}),
    }));
for (let index = 0; index < 12; index++)
    expenses.push(expense(`x-sep-${index}`, at(2026, 9, 2 + index * 2, 10), 1_200.75 + index * 300));
for (let index = 0; index < 5; index++)
    expenses.push(expense(`x-aug-${index}`, at(2026, 8, 3 + index * 6, 18), 9_000 + index));
for (let index = 0; index < 8; index++)
    expenses.push(expense(`x-2025-${index}`, at(2025, 2 + index, 14, 9), 4_321.5 + index * 100));
// Left out of every period: an advance not yet reconciled, and the money returned from one.
expenses.push(expense('x-pending', at(2026, 10, 9, 9), 50_000, { advanceState: 'pending' }));
expenses.push(expense('x-return', at(2026, 10, 9, 10), 12_000, { origin: 'personal_expense_return', type: 'Ajout' }));
expenses.push(expense('x-pending-prev', at(2026, 10, 8, 9), 77_000, { advanceState: 'pending' }));
// Today, yesterday and the week before.
expenses.push(expense('x-today-1', at(2026, 10, 9, 8, 30), 3_100.5, { notes: 'Café' }));
expenses.push(expense('x-today-2', at(2026, 10, 9, 13, 5), 15_250, { source: 'BaridiMob' }));
expenses.push(expense('x-yesterday', at(2026, 10, 8, 19), 2_000));
expenses.push(expense('x-last-week', at(2026, 10, 2, 11), 6_400.4, { notes: 'Semaine dernière' }));
// A day with nothing before it, a year without a previous year.
const managerProfits = [122_420.55, 0, 3_000];

/** The period and previous period as the old export computed them (useReportExports before V3-6), with « now » given. */
function oldPeriod(periodKey: ExpensesPeriodKey, nowTs: number) {
    const d = new Date(nowTs);
    let periodStart: number;
    let periodEnd: number;
    let periodLabel: string;
    if (periodKey === 'day') {
        const sd = new Date(d);
        sd.setHours(0, 0, 0, 0);
        periodStart = sd.getTime();
        const ed = new Date(sd);
        ed.setHours(23, 59, 59, 999);
        periodEnd = ed.getTime();
        periodLabel = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }
    else if (periodKey === 'week') {
        const sd = new Date(d);
        const dow = sd.getDay();
        const diff = dow === 0 ? -6 : 1 - dow;
        sd.setDate(sd.getDate() + diff);
        sd.setHours(0, 0, 0, 0);
        periodStart = sd.getTime();
        const ed = new Date(sd);
        ed.setDate(ed.getDate() + 6);
        ed.setHours(23, 59, 59, 999);
        periodEnd = ed.getTime();
        periodLabel = `Semaine du ${sd.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;
    }
    else if (periodKey === 'month') {
        const sd = new Date(d.getFullYear(), d.getMonth(), 1);
        periodStart = sd.getTime();
        periodEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
        periodLabel = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    }
    else {
        const sd = new Date(d.getFullYear(), 0, 1);
        periodStart = sd.getTime();
        periodEnd = new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999).getTime();
        periodLabel = String(d.getFullYear());
    }
    const prevStart = (() => {
        const ps = new Date(periodStart);
        if (periodKey === 'day') {
            ps.setDate(ps.getDate() - 1);
            ps.setHours(0, 0, 0, 0);
            return ps.getTime();
        }
        if (periodKey === 'week') {
            ps.setDate(ps.getDate() - 7);
            return ps.getTime();
        }
        if (periodKey === 'month')
            return new Date(ps.getFullYear(), ps.getMonth() - 1, 1).getTime();
        return new Date(ps.getFullYear() - 1, 0, 1).getTime();
    })();
    const prevEnd = (() => {
        if (periodKey === 'day') {
            const e = new Date(prevStart);
            e.setHours(23, 59, 59, 999);
            return e.getTime();
        }
        if (periodKey === 'week') {
            const e = new Date(prevStart);
            e.setDate(e.getDate() + 6);
            e.setHours(23, 59, 59, 999);
            return e.getTime();
        }
        if (periodKey === 'month') {
            const e = new Date(prevStart);
            return new Date(e.getFullYear(), e.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
        }
        return new Date(new Date(prevStart).getFullYear(), 11, 31, 23, 59, 59, 999).getTime();
    })();
    return { periodStart, periodEnd, periodLabel, prevStart, prevEnd };
}
const oldNetExpense = (tx: TreasuryTx): number => {
    if (tx.origin === 'personal_expense_return')
        return 0;
    if (tx.advanceState === 'settled')
        return Number(tx.settledAmount || 0);
    return Number(tx.amount || 0);
};

let expensesCompared = 0;
const seenExpenseFeatures = new Set<string>();
const NOWS = [NOW, at(2026, 10, 12, 9), at(2024, 2, 29, 23, 59), at(2027, 1, 1, 0, 0)];
for (const nowTs of NOWS) {
    for (const periodKey of ['day', 'week', 'month', 'year'] as ExpensesPeriodKey[]) {
        for (const managerProfit of managerProfits) {
            const what = `expenses report, ${periodKey} of ${dayOf(nowTs)}, manager profit ${managerProfit}`;
            const old = oldPeriod(periodKey, nowTs);
            const periods = expensesPeriods(periodKey, nowTs);
            assert.deepEqual([periods.start, periods.end, periods.previousStart, periods.previousEnd], [old.periodStart, old.periodEnd, old.prevStart, old.prevEnd], `${what}: the same periods as before`);
            const previousPeriodTotal = expenses
                .filter((tx) => tx.timestamp >= old.prevStart && tx.timestamp <= old.prevEnd && tx.advanceState !== 'pending' && tx.origin !== 'personal_expense_return')
                .reduce((sum, tx) => sum + oldNetExpense(tx), 0);
            const oldHtml = buildPersonalExpensesPdfReport({ expenses, periodLabel: old.periodLabel, periodKey, periodStart: old.periodStart, periodEnd: old.periodEnd, previousPeriodTotal, managerProfitAvailable: managerProfit }).html;
            const report = buildExpensesReport({ expenses, periodKey, now: nowTs, managerProfitAvailable: managerProfit });
            const fr = renderToStaticMarkup(<ExpensesReportSheet report={report} lang="fr" issuedAt={NOW} variant="print"/>);
            const w = EXPENSES_REPORT_WORDS.fr;
            assert.equal(expensesPeriodLabel(periodKey, report.periodStart, 'fr'), old.periodLabel, `${what}: the period's name`);
            assert.equal(strip(oldHtml).replace(/\s+/g, ' ').includes(`Période: ${old.periodLabel} · ${w[periodKey]}`), true, `${what}: the old kicker`);

            const before = oldCards(oldHtml);
            const after = newCards(fr);
            for (const [oldLabel, newLabel] of [['Total dépensé', w.totalSpent], ['Nombre d\'opérations', w.operationCount], ['Moyenne / jour', w.averagePerDay], ['% du profit consommé', w.profitConsumed], ['Profit gérant à retirer', w.profitToWithdraw], ['Période précédente', w.previousPeriod]] as const) {
                assert.ok(before.has(oldLabel), `${what}: old ${oldLabel}`);
                assert.equal(after.get(newLabel), before.get(oldLabel), `${what}: ${oldLabel}`);
            }
            // Against the previous period.
            const oldVersus = strip(oldHtml).replace(/\s+/g, ' ').match(/(Pas de période précédente comparable|[+-]?[\d\s.,  ]+% vs période précédente)/);
            assert.ok(oldVersus, `${what}: old comparison`);
            const newLead = squash(strip(fr.match(/<p data-pdf-break="" class="rounded-lg bg-primary\/5[^>]*>([\s\S]*?)<\/p>/)![1]));
            assert.equal(newLead, squash(oldVersus[1]).replace('vspériodeprécédente', 'vspériodeprécédente'), `${what}: comparison with the previous period`);
            seenExpenseFeatures.add(report.versusPrevious === null ? 'no previous period' : report.versusPrevious > 0 ? 'more than before' : 'less than before');

            // The biggest expense.
            const oldBiggest = oldHtml.match(/<div class="pill emphasis">\s*<strong>([^<]*)<\/strong> · ([\s\S]*?) · <strong>([^<]*)<\/strong>/);
            if (oldBiggest) {
                const newBiggest = fr.match(/<p data-pdf-break="" class="rounded-lg bg-surface-muted px-3 py-2 text-\[13px\]">([\s\S]*?)<\/p>/)!;
                assert.equal(squash(strip(newBiggest[1])), squash(`${decode(oldBiggest[1])} · ${decode(oldBiggest[2])} · ${decode(oldBiggest[3])}`), `${what}: biggest expense`);
                seenExpenseFeatures.add('biggest');
            }
            else
                assert.ok(oldHtml.includes('Aucune dépense.') && strip(fr).includes(w.noExpense) && report.biggest === null, `${what}: no biggest expense`);

            // The list, row by row.
            const rows = report.rows.length ? oldRows(oldHtml, 'Détail des opérations') : [];
            assert.equal(rows.length, report.rows.length, `${what}: every expense`);
            if (rows.length) {
                const now = newRows(fr, w.detailTitle);
                rows.forEach((row, index) => {
                    const found = now[index];
                    const source = row[2] === squash('Caisse') ? squash(T('transactions.cash')) : row[2] === squash('BaridiMob') ? squash(T('transactions.baridi')) : row[2];
                    assert.deepEqual(found, [row[0], row[1], source, row[3], row[4]], `${what}: expense ${index}`);
                    if (row[3].endsWith(squash('Régularisé')))
                        seenExpenseFeatures.add('settled advance');
                    if (row[2] === '-')
                        seenExpenseFeatures.add('no source');
                });
                seenExpenseFeatures.add('expenses');
            }
            else
                assert.ok(oldHtml.includes('Aucune dépense pour cette période.') && strip(fr).includes(w.emptyPeriod), `${what}: no expense`);
            assert.equal((fr.match(/data-pdf-row=""/g) ?? []).length, report.rows.length, `${what}: PDF rows`);

            // The total at the end.
            const oldFinal = oldHtml.match(/<div class="final-total-value">([^<]*)<\/div>/)!;
            assert.equal(squash(strip(fr.match(/<b class="text-\[19px\] text-financial-loss">([\s\S]*?)<\/b>/)![1])), squash(oldFinal[1]), `${what}: final total`);
            assert.ok(strip(fr).includes(w.signature) && oldHtml.includes('Signature'), `${what}: signature`);

            // The Arabic page shows exactly the same numbers.
            const arabic = renderToStaticMarkup(<ExpensesReportSheet report={report} lang="ar" issuedAt={NOW} variant="screen"/>);
            assert.deepEqual(distinctScreenNumbers(arabic).filter((token) => !/^\d{4}$/.test(token)), distinctScreenNumbers(fr).filter((token) => !/^\d{4}$/.test(token)), `${what}: Arabic and French show the same numbers`);
            expensesCompared++;
        }
    }
}
assert.equal(expensesCompared, NOWS.length * 4 * managerProfits.length);
for (const feature of ['no previous period', 'more than before', 'less than before', 'biggest', 'settled advance', 'no source', 'expenses'])
    assert.ok(seenExpenseFeatures.has(feature), `The expenses fixture reaches: ${feature}`);
assert.equal(expensesReportFileName(at(2026, 10, 1, 0), at(2026, 10, 31, 23)), 'ProDigital_Depenses_2026-10-01_2026-10-31.pdf');
console.log(`expenses report comparison passed (${expensesCompared} reports)`);

// =====================================================================================
// The treasury report
// =====================================================================================
const TYPES = ['Ajout', 'Retrait', 'Adjustment (+)', 'Adjustment (-)', 'Transfer'];
const treasuryRows = (count: number) => Array.from({ length: count }, (_, index) => {
    const ts = at(2026, 10, 1 + (index % 9), 8 + (index % 12), (index * 13) % 60);
    return {
        date: dayOf(ts), time: timeOf(ts), type: TYPES[index % TYPES.length], source: index % 4 === 3 ? '' : index % 2 ? 'BaridiMob' : 'Caisse',
        amount: 1_500.4 + index * 2_917.6, notes: index % 3 === 0 ? '' : index % 3 === 1 ? `Règlement "client" & <frais> ${index}` : 'Retrait pour le loyer',
        origin: index % 2 ? 'client_tx' : undefined,
    };
});
const TREASURY_OLD_TO_NEW: Record<string, string> = {
    'Ajout': T('treasury.inShort'),
    'Retrait': T('treasury.outShort'),
    'Adjustment (+)': T('treasury.adjustmentIn'),
    'Adjustment (-)': T('treasury.adjustmentOut'),
    'Transfer': T('ledger.internalTransfer'),
};
let treasuryCompared = 0;
for (const [count, balances] of [[0, { caisse: 0, baridi: 0 }], [1, { caisse: 1_234.5, baridi: -20 }], [7, { caisse: 95_000, baridi: 1_250_300.75 }], [60, { caisse: -4_500.5, baridi: 87_654_321 }]] as Array<[number, { caisse: number; baridi: number }]>) {
    const what = `treasury report, ${count} movements`;
    const rows = treasuryRows(count);
    const oldHtml = buildTreasuryPdf(rows, balances, 'Exporté le 10/10/2026').html;
    const report = buildTreasuryReport({ rows, balances, issuedAt: NOW });
    const fr = renderToStaticMarkup(<TreasuryReportSheet report={report} lang="fr" variant="print"/>);
    const w = TREASURY_REPORT_WORDS.fr;

    const before = oldCards(oldHtml);
    const after = newCards(fr);
    for (const [oldLabel, newLabel] of [['Caisse', w.caisse], ['BaridiMob', w.baridi], ['Flux net (période)', w.netFlow], ['Total entrées', w.totalIn], ['Total sorties', w.totalOut], ['Mouvements', w.movementCount]] as const) {
        assert.ok(before.has(oldLabel), `${what}: old ${oldLabel}`);
        assert.equal(after.get(newLabel), before.get(oldLabel), `${what}: ${oldLabel}`);
    }
    const oldRowsList = count ? oldRows(oldHtml, 'Mouvements de trésorerie') : [];
    assert.equal(oldRowsList.length, count, `${what}: every movement`);
    if (count) {
        const now = newRows(fr, w.movementsTitle(count));
        oldRowsList.forEach((row, index) => {
            const source = row[3] === squash('Caisse') ? squash(T('transactions.cash')) : row[3] === squash('BaridiMob') ? squash(T('transactions.baridi')) : row[3];
            assert.deepEqual(now[index], [row[0], row[1], squash(TREASURY_OLD_TO_NEW[rows[index].type]), source, row[4], row[5]], `${what}: movement ${index}`);
        });
    }
    else
        assert.ok(strip(fr).includes(w.empty), `${what}: nothing to list`);
    assert.equal((fr.match(/data-pdf-row=""/g) ?? []).length, count, `${what}: PDF rows`);
    const arabic = renderToStaticMarkup(<TreasuryReportSheet report={report} lang="ar" variant="screen"/>);
    assert.deepEqual(distinctScreenNumbers(arabic), distinctScreenNumbers(fr), `${what}: Arabic and French show the same numbers`);
    treasuryCompared++;
}
assert.equal(treasuryCompared, 4);
assert.equal(treasuryReportFileName(NOW), 'ProDigital_Tresorerie_2026-10-09.pdf');
console.log('treasury report comparison passed');
