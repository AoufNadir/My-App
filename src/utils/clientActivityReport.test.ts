import assert from 'node:assert/strict';

import type { ClientTransactionDzd, Tx } from '../types';
import { toCents } from './money';
import {
    balanceCalculation,
    buildClientActivityReport,
    buildReportEntries,
    comparisonPeriod,
    defaultReportPeriod,
    listReportPeriods,
    monthPeriod,
    monthWeeks,
    parsePeriodKey,
    periodContaining,
    periodTotals,
    yearPeriod,
    type ReportPeriod,
} from './clientActivityReport';

// ---------- fixtures: one client, every kind of ledger row, Aug to Oct 2026 ----------
const at = (month: number, day: number, hour = 12, minute = 0) => new Date(2026, month, day, hour, minute).getTime();
const NOW = at(9, 3, 18);
let seq = 0;
function row(clientId: string, timestamp: number, montant: number, type: ClientTransactionDzd['type'], extra: Partial<ClientTransactionDzd> = {}): ClientTransactionDzd {
    seq += 1;
    return { id: `r${String(seq).padStart(3, '0')}`, clientId, timestamp, date: '', time: '', montant, type, ...extra };
}
function sale(id: string, timestamp: number, currency: 'USDT' | 'EUR', quantity: number, sell: number, extra: Partial<Tx> = {}): Tx {
    // price, profit and the smart-pricing fields are ours: the report must never read them.
    return { id, type: 'sell', currency, quantity, sell, total: quantity * sell, price: 243.17, profit: 6891.55, spSegment: 'risky', spScore: 0.731, notes: 'NOTE-SECRET', tags: ['TAG-SECRET'], date: '', time: '', timestamp, ...extra };
}

const transactions: Tx[] = [];
const rows: ClientTransactionDzd[] = [];
function creditSale(timestamp: number, currency: 'USDT' | 'EUR', quantity: number, price: number) {
    const tx = sale(`tx${transactions.length + 1}`, timestamp, currency, quantity, price);
    transactions.push(tx);
    rows.push(row('c1', timestamp, -quantity * price, currency === 'USDT' ? 'Vente USDT' : 'Vente EUR', { linkedTxId: tx.id, linkRole: 'primary', paymentMethod: 'Crédit', affectsBalance: true, notes: 'NOTE-SECRET' }));
}
function cashSale(timestamp: number, currency: 'USDT' | 'EUR', quantity: number, price: number, method: 'Espèces' | 'BaridiMob') {
    const tx = sale(`tx${transactions.length + 1}`, timestamp, currency, quantity, price);
    transactions.push(tx);
    rows.push(row('c1', timestamp, -quantity * price, currency === 'USDT' ? 'Vente USDT' : 'Vente EUR', { linkedTxId: tx.id, linkRole: 'primary', paymentMethod: method, affectsBalance: false }));
}

rows.push(row('c1', at(7, 1, 9), -20000, 'Solde Initial', { paymentMethod: 'Crédit', notes: 'Solde initial' }));
creditSale(at(7, 3), 'USDT', 1000, 250);
cashSale(at(7, 12), 'USDT', 400, 251, 'Espèces');
rows.push(row('c1', at(7, 20), 150000, 'Règlement Reçu', { paymentMethod: 'Espèces', linkedTxId: 'treasury-1' }));
creditSale(at(8, 2), 'USDT', 800, 249.5);
cashSale(at(8, 8), 'EUR', 300, 262.5, 'BaridiMob');
creditSale(at(8, 15), 'USDT', 600, 248.75);
rows.push(row('c1', at(8, 21), 200000, 'Règlement Reçu', { paymentMethod: 'BaridiMob' }));
// USDT sold for EUR: the DZD amount is 470 € at OUR EUR cost (267.13), never shown.
const eurSettled = sale('tx-eur', at(8, 24), 'USDT', 500, 0, { settlementCurrency: 'EUR', sellPriceEur: 0.94, saleValueEur: 470, eurToDzdRateAtSale: 267.13 });
transactions.push(eurSettled);
rows.push(row('c1', at(8, 24), -470 * 267.13, 'Vente USDT', { linkedTxId: 'tx-eur', linkRole: 'primary', paymentMethod: 'Espèces', affectsBalance: false }));
// Debt moved from another client, never named.
rows.push(row('c2', at(8, 26), 15000, 'Transfert Sortant', { paymentMethod: 'Crédit' }));
rows.push(row('c1', at(8, 26, 12, 1), -15000, 'Transfert Entrant', { paymentMethod: 'Crédit', linkedTxId: 'r-other' }));
// Digital service on credit: its notes carry our margin.
rows.push(row('c1', at(8, 28), -12500, 'Vente service numérique', { paymentMethod: 'Crédit', affectsBalance: true, origin: 'digital_service_sale', notes: 'Netflix - Client: X - Achat 9 363 DZD - Marge 3 137 DZD' }));
// The client sells us 200 USDT on credit: we owe it to them.
const buyTx: Tx = { id: 'tx-buy', type: 'buy', currency: 'USDT', quantity: 200, price: 245, total: 49000, date: '', time: '', timestamp: at(9, 1) };
transactions.push(buyTx);
rows.push(row('c1', at(9, 1), 49000, 'Règlement Reçu', { linkedTxId: 'tx-buy', linkRole: 'primary', paymentMethod: 'Crédit', affectsBalance: true }));
creditSale(at(9, 2, 10), 'USDT', 1200.5, 250.25);
rows.push(row('c1', at(9, 2, 16), -5000, 'Paiement Effectué', { paymentMethod: 'Espèces' }));
rows.push(row('c1', at(9, 3, 9), 1000, 'Remise solde', { paymentMethod: 'Crédit', countsAsLoss: true }));
// Another client's rows are ignored.
rows.push(row('c2', at(9, 2), -999999, 'Vente USDT', { paymentMethod: 'Crédit' }));

const pageBalanceCents = rows.filter((item) => item.clientId === 'c1' && item.affectsBalance !== false).reduce((sum, item) => sum + toCents(item.montant), 0);
const build = (period: ReportPeriod) => buildClientActivityReport({ clientId: 'c1', clientRows: rows, transactions, period, now: NOW });

// ---------- weeks ----------
const octoberWeeks = monthWeeks(2026, 9).map((week) => `${week.firstDay}-${week.lastDay}`);
assert.deepEqual(octoberWeeks, ['1-3', '4-10', '11-17', '18-24', '25-31'], 'October 2026 starts on a Thursday: week 1 is 1-3, then Sunday to Saturday');
assert.deepEqual(monthWeeks(2026, 1).map((week) => `${week.firstDay}-${week.lastDay}`), ['1-7', '8-14', '15-21', '22-28'], 'February 2026 starts on a Sunday');
for (let month = 0; month < 12; month++) {
    const weeks = monthWeeks(2026, month);
    const full = monthPeriod(2026, month);
    assert.equal(weeks[0].from, full.from, 'Week 1 starts on the 1st');
    assert.equal(weeks[weeks.length - 1].to, full.to, 'The last week ends on the last day of the month');
    weeks.slice(1).forEach((week, index) => assert.equal(week.from, weeks[index].to + 1, 'Weeks follow each other with no gap'));
    weeks.slice(1, -1).forEach((week) => assert.equal(new Date(week.from).getDay(), 0, 'A full week starts on Sunday'));
}
assert.equal(comparisonPeriod(monthWeeks(2026, 9)[0]), null, 'Week 1 is not compared (the user\'s rule)');
assert.equal(comparisonPeriod(monthWeeks(2026, 9)[2])?.key, monthWeeks(2026, 9)[1].key, 'A week is compared with the week before it in the same month');
assert.equal(comparisonPeriod(monthPeriod(2026, 0))?.key, 'm-2025-12', 'January is compared with December');
assert.equal(parsePeriodKey('w-2026-10-2')?.from, monthWeeks(2026, 9)[1].from);
assert.equal(parsePeriodKey('m-2026-10')?.to, monthPeriod(2026, 9).to);
assert.equal(parsePeriodKey('y-2026')?.from, yearPeriod(2026).from);

// ---------- periods offered ----------
const firstAt = Math.min(...rows.filter((item) => item.clientId === 'c1').map((item) => item.timestamp));
const months = listReportPeriods('month', firstAt, NOW);
assert.deepEqual(months.map((item) => item.key), ['m-2026-10', 'm-2026-09', 'm-2026-08'], 'Months from now back to the first operation, newest first');
const weeks = listReportPeriods('week', firstAt, NOW);
assert.equal(weeks[0].key, 'w-2026-10-1');
assert.equal(weeks[1].key, 'w-2026-09-5', 'The week before October\'s week 1 is September\'s last week');
assert.equal(weeks[weeks.length - 1].key, periodContaining('week', firstAt).key);
assert.equal(defaultReportPeriod(weeks, [{ timestamp: at(8, 21) }], NOW).key, periodContaining('week', at(8, 21)).key, 'Default: the newest period with an operation');
assert.equal(defaultReportPeriod(months, [{ timestamp: at(8, 21) }, { timestamp: at(9, 2) }], NOW).key, 'm-2026-09', 'Default month: the last finished one with an operation, not the three days of October');
assert.equal(defaultReportPeriod(months, [{ timestamp: at(9, 2) }], NOW).key, 'm-2026-10', 'Only October has operations: October');
assert.equal(defaultReportPeriod(listReportPeriods('year', firstAt, NOW), [{ timestamp: at(9, 2) }], NOW).key, 'y-2026', 'Default year: the current year to date');

// ---------- every period: the calculation is exact and matches the client page ----------
const allPeriods = [...weeks, ...months, yearPeriod(2026)];
for (const period of allPeriods) {
    const report = build(period);
    const { openingCents, closingCents, lines } = report.balance;
    assert.equal(openingCents - lines.purchases + lines.payments + lines.saleToUs + lines.withdrawal + lines.transfer + lines.opening + lines.writeOff + lines.adjustment, closingCents,
        `${period.key}: opening − purchases + payments + other lines must equal closing`);
    if (report.operations) {
        const last = report.operations[report.operations.length - 1];
        assert.equal(last ? last.balanceAfterCents : openingCents, closingCents, `${period.key}: the balance after the last operation is the closing balance`);
    }
    assert.ok(lines.purchases >= 0 && lines.payments >= 0, `${period.key}: purchases and payments are amounts`);
    assert.equal(lines.purchases, report.totals.spentCents, `${period.key}: the calculation's purchases are the period's spending`);
}
for (const kind of ['week', 'month', 'year'] as const) {
    const current = build(periodContaining(kind, NOW));
    assert.equal(current.balance.closingCents, pageBalanceCents, `${kind}: the current period ends on the client page balance`);
}

// ---------- sums: weeks add up to their month, months to the year ----------
const entries = buildReportEntries(rows.filter((item) => item.clientId === 'c1'), transactions);
for (const month of months) {
    const monthTotals = periodTotals(entries, month);
    const weekSums = monthWeeks(month.year, month.month).map((week) => periodTotals(entries, week));
    assert.equal(weekSums.reduce((sum, week) => sum + week.spentCents, 0), monthTotals.spentCents, `${month.key}: weeks add up to the month`);
    assert.equal(weekSums.reduce((sum, week) => sum + week.currencies.USDT.quantity, 0), monthTotals.currencies.USDT.quantity, `${month.key}: USDT of the weeks add up to the month`);
    const weekCalcs = monthWeeks(month.year, month.month).map((week) => balanceCalculation(entries, week));
    assert.equal(weekCalcs[0].openingCents, balanceCalculation(entries, month).openingCents);
    assert.equal(weekCalcs[weekCalcs.length - 1].closingCents, balanceCalculation(entries, month).closingCents, `${month.key}: the last week closes on the month's closing balance`);
}
const yearReport = build(yearPeriod(2026));
assert.equal(yearReport.comparison.reduce((sum, item) => sum + item.totals.spentCents, 0), yearReport.totals.spentCents, 'Months add up to the year');

// ---------- what the September report says ----------
const september = build(monthPeriod(2026, 8));
const usdt = september.currencyCards.find((card) => card.currency === 'USDT')!;
assert.equal(usdt.quantity, 800 + 600 + 500, 'USDT bought in September, the 500 paid in EUR included');
assert.equal(usdt.dzdQuantity, 1400);
assert.equal(usdt.dzdCents, toCents(800 * 249.5 + 600 * 248.75), 'DZD amount of the USDT paid in DZD only');
assert.equal(usdt.eurQuantity, 500);
assert.equal(usdt.eurAmount, 470);
assert.equal(september.totals.spentCents, toCents(800 * 249.5 + 300 * 262.5 + 600 * 248.75 + 12500), 'Spent: DZD purchases and the service, never the EUR-settled sale\'s DZD value');
assert.equal(september.balance.lines.payments, toCents(300 * 262.5 + 200000), 'Payments: the EUR bought by BaridiMob on the spot and the BaridiMob payment');
assert.deepEqual(september.balance.paymentsByMethod, [{ method: 'baridi', cents: toCents(300 * 262.5 + 200000) }]);
assert.equal(september.balance.lines.transfer, toCents(-15000), 'The debt moved to this client');
assert.equal(september.biggestPurchase?.quantity, 800, 'Biggest purchase of the month by DZD amount');
assert.deepEqual(september.sinceJanuary?.quantities, { USDT: 1000 + 400 + 800 + 600 + 500, EUR: 300 });
assert.equal(september.comparedWith?.period.key, 'm-2026-08');
assert.ok(september.showEurColumn && september.showUsdtColumn);

const august = build(monthPeriod(2026, 7));
assert.equal(august.balance.openingCents, 0);
assert.equal(august.balance.lines.opening, toCents(-20000), 'The opening balance entered in August has its own line');
assert.equal(august.balance.lines.adjustment, 0);

// ---------- a running period is compared with nothing ----------
const octoberLive = build(monthPeriod(2026, 9));
assert.equal(octoberLive.isLive, true);
assert.equal(octoberLive.comparedWith, null, 'Three days of October are not compared with the whole of September');
assert.equal(octoberLive.balance.lines.writeOff, toCents(1000), 'The debt forgiven has its own line');
const yearRows = build(yearPeriod(2026)).comparison;
assert.equal(yearRows[yearRows.length - 1].period.key, 'm-2026-10');
assert.equal(yearRows[yearRows.length - 1].isLive, true);
assert.equal(yearRows[yearRows.length - 1].changePct, null, 'The running month has no change against the month before');
assert.notEqual(yearRows[yearRows.length - 2].changePct, null, 'September against August is a change');
const septemberWeeks = build(monthWeeks(2026, 8)[4]);
assert.equal(septemberWeeks.isLive, false);
assert.equal(septemberWeeks.comparedWith?.period.key, monthWeeks(2026, 8)[3].key, 'A finished week is compared with the week before it');

// ---------- ج: the client's average price over the last three periods ----------
const october = build(monthPeriod(2026, 9));
const octoberUsdt = october.currencyCards.find((card) => card.currency === 'USDT')!;
assert.deepEqual(octoberUsdt.trend.map((point) => point.period.key), ['m-2026-08', 'm-2026-09', 'm-2026-10'], 'Three months, oldest first');
assert.equal(octoberUsdt.trend[0].averagePrice, (1000 * 250 + 400 * 251) / 1400);
assert.equal(octoberUsdt.trend[1].averagePrice, (800 * 249.5 + 600 * 248.75) / 1400, 'September: the USDT paid in EUR stays out of the DZD price');
assert.equal(Math.round(octoberUsdt.trend[2].averagePrice * 100) / 100, 250.25, 'Shown with two decimals: 1 200.5 USDT for 300 425.13 DZD');
assert.equal(october.currencyCards.some((card) => card.currency === 'EUR'), false, 'No EUR bought in October: no EUR card');
assert.equal(build(monthWeeks(2026, 9)[0]).currencyCards[0].trend.length, 0, 'Week 1 has no trend: weeks are compared inside their month');
const septemberWeek3 = build(monthWeeks(2026, 8)[2]);
assert.deepEqual(septemberWeek3.currencyCards.find((card) => card.currency === 'USDT')?.trend.map((point) => point.period.week) ?? [], [1, 3],
    'A week without USDT is skipped, the trend keeps the weeks of the month that have a price');

// ---------- the client's balance on the spot of every row ----------
const augustOps = build(monthPeriod(2026, 7)).operations!;
assert.deepEqual(augustOps.map((item) => item.balanceAfterCents), [-2000000, -27000000, -27000000, -12000000],
    'Opening balance, credit sale, cash sale (no change), payment');

// ---------- privacy at the model level: a EUR-settled sale has no DZD amount ----------
const eurEntry = entries.find((entry) => entry.id === rows.find((item) => item.linkedTxId === 'tx-eur')!.id)!;
assert.equal(eurEntry.dzdCents, null, 'The DZD value of a sale settled in EUR is our valuation: never shown');
assert.equal(eurEntry.eurAmount, 470);

console.log('client activity report model tests passed');
