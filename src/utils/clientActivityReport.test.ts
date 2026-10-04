import assert from 'node:assert/strict';

import type { ClientTransactionDzd, Tx } from '../types';
import { toCents } from './money';
import {
    balanceCalculation,
    breakdownPeriods,
    breakdownUnit,
    buildClientActivityReport,
    buildReportEntries,
    dayKey,
    defaultReportPeriod,
    listReportPeriods,
    monthPeriod,
    monthWeeks,
    parseDayKey,
    parsePeriodKey,
    periodContaining,
    periodDays,
    periodTotals,
    previousPeriod,
    rangePeriod,
    reportPeriodForDates,
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
assert.equal(previousPeriod(monthPeriod(2026, 0)).key, 'm-2025-12', 'January is compared with December');
assert.equal(previousPeriod(yearPeriod(2026)).key, 'y-2025');
assert.equal(parsePeriodKey('w-2026-10-2')?.from, monthWeeks(2026, 9)[1].from);
assert.equal(parsePeriodKey('m-2026-10')?.to, monthPeriod(2026, 9).to);
assert.equal(parsePeriodKey('y-2026')?.from, yearPeriod(2026).from);
assert.equal(parsePeriodKey('r-20260915-20261014')?.key, 'r-20260915-20261014');
assert.equal(parsePeriodKey('r-20261014-20260915'), null, 'A range that ends before it starts is no range');

// ---------- two dates: the period a report covers ----------
const day = (key: string, end = false) => parseDayKey(key, end)!;
const forDates = (start: string, end: string) => reportPeriodForDates(day(start), day(end, true), NOW);
assert.equal(parseDayKey('2026-02-30', false), null, 'Not a real day');
assert.equal(parseDayKey('', true), null);
assert.equal(dayKey(day('2026-09-01')), '2026-09-01');
assert.equal(forDates('2026-09-01', '2026-09-30').key, 'm-2026-09', 'A whole month is that month');
assert.equal(forDates('2026-10-01', '2026-10-03').key, 'm-2026-10', '« This month »: the 1st to today is the running month');
assert.equal(forDates('2026-10-01', '2026-10-31').key, 'm-2026-10', 'The running month to its last day too');
assert.equal(forDates('2026-01-01', '2026-10-03').key, 'y-2026', '« This year »: January 1st to today is the running year');
assert.equal(forDates('2025-01-01', '2025-12-31').key, 'y-2025', 'A whole year is that year');
assert.equal(forDates('2026-09-01', '2026-09-29').kind, 'range', 'A month without its last day is a range');
assert.equal(forDates('2026-10-01', '2026-10-02').kind, 'range', 'The 1st to yesterday is a range');
assert.equal(forDates('2026-01-01', '2026-03-31').kind, 'range', 'A quarter is a range');
assert.equal(forDates('2026-09-15', '2026-10-14').key, 'r-20260915-20261014');
assert.equal(periodDays(forDates('2026-09-15', '2026-10-14')), 30, 'Both days counted');
assert.equal(periodDays(forDates('2026-10-03', '2026-10-03')), 1);
assert.equal(periodDays(yearPeriod(2024)), 366);

// ---------- the period of the same length just before ----------
assert.equal(previousPeriod(rangePeriod(day('2026-09-15'), day('2026-10-14'))).key, 'r-20260816-20260914', 'The 30 days before 30 days');
assert.equal(previousPeriod(rangePeriod(day('2026-03-01'), day('2026-03-10'))).key, 'r-20260219-20260228', 'Across the end of February');
assert.equal(previousPeriod(monthWeeks(2026, 9)[1]).key, 'r-20260927-20261003', 'A week is compared with the seven days before it');

// ---------- the chart and table: weeks up to 31 days, months up to a year, years beyond ----------
assert.equal(breakdownUnit(monthPeriod(2026, 8)), 'week');
assert.equal(breakdownUnit(yearPeriod(2026)), 'month');
assert.equal(breakdownUnit(forDates('2026-09-04', '2026-10-04')), 'week', '31 days: weeks');
assert.equal(breakdownUnit(forDates('2026-09-03', '2026-10-04')), 'month', '32 days: months');
assert.equal(breakdownUnit(forDates('2025-10-04', '2026-10-04')), 'month', '366 days: months');
assert.equal(breakdownUnit(forDates('2025-10-03', '2026-10-04')), 'year', '367 days: years');
const rangeWeeks = breakdownPeriods(forDates('2026-09-10', '2026-09-24'), NOW);
assert.deepEqual(rangeWeeks.map((part) => `${dayKey(part.from)}/${dayKey(part.to)}/${part.cut ? 'cut' : 'whole'}`),
    ['2026-09-10/2026-09-12/cut', '2026-09-13/2026-09-19/whole', '2026-09-20/2026-09-24/cut'], 'Sunday to Saturday, cut at the range\'s first and last day');
assert.deepEqual(rangeWeeks.map((part) => part.week), [1, 2, 3]);
const rangeMonths = breakdownPeriods(forDates('2026-08-15', '2026-10-02'), NOW);
assert.deepEqual(rangeMonths.map((part) => `${dayKey(part.from)}/${dayKey(part.to)}/${part.cut ? 'cut' : 'whole'}`),
    ['2026-08-15/2026-08-31/cut', '2026-09-01/2026-09-30/whole', '2026-10-01/2026-10-02/cut']);
const rangeYears = breakdownPeriods(forDates('2024-11-20', '2026-10-02'), NOW);
assert.deepEqual(rangeYears.map((part) => `${dayKey(part.from)}/${dayKey(part.to)}`), ['2024-11-20/2024-12-31', '2025-01-01/2025-12-31', '2026-01-01/2026-10-02']);
assert.deepEqual(breakdownPeriods(forDates('2026-09-27', '2026-10-24'), NOW).map((part) => dayKey(part.from)), ['2026-09-27'],
    'Weeks after today are left out of a range that ends later');
for (const period of [forDates('2026-08-15', '2026-10-02'), forDates('2026-09-10', '2026-09-24'), forDates('2024-11-20', '2026-10-02')]) {
    const parts = breakdownPeriods(period, NOW);
    assert.equal(parts[0].from, period.from, `${period.key}: the first part starts on the first day`);
    assert.equal(parts[parts.length - 1].to, period.to, `${period.key}: the last part ends on the last day`);
    parts.slice(1).forEach((part, index) => assert.equal(part.from, parts[index].to + 1, `${period.key}: parts follow each other with no gap`));
}

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
assert.equal(septemberWeeks.kind, 'range', 'A week is reported as a span of days');
assert.equal(septemberWeeks.comparedWith?.period.key, 'r-20260923-20260926', 'September 27-30 is compared with the four days before');

// ---------- ج: the client's average price over the last three periods ----------
const october = build(monthPeriod(2026, 9));
const octoberUsdt = october.currencyCards.find((card) => card.currency === 'USDT')!;
assert.deepEqual(octoberUsdt.trend.map((point) => point.period.key), ['m-2026-08', 'm-2026-09', 'm-2026-10'], 'Three months, oldest first');
assert.equal(octoberUsdt.trend[0].averagePrice, (1000 * 250 + 400 * 251) / 1400);
assert.equal(octoberUsdt.trend[1].averagePrice, (800 * 249.5 + 600 * 248.75) / 1400, 'September: the USDT paid in EUR stays out of the DZD price');
assert.equal(Math.round(octoberUsdt.trend[2].averagePrice * 100) / 100, 250.25, 'Shown with two decimals: 1 200.5 USDT for 300 425.13 DZD');
assert.equal(october.currencyCards.some((card) => card.currency === 'EUR'), false, 'No EUR bought in October: no EUR card');
assert.equal(build(monthWeeks(2026, 9)[0]).currencyCards[0].trend.length, 0, 'October 1-3: no USDT in the six days before, no trend');
const septemberWeek3 = build(monthWeeks(2026, 8)[2]);
assert.deepEqual(septemberWeek3.currencyCards.find((card) => card.currency === 'USDT')?.trend.map((point) => point.period.key) ?? [], ['r-20260830-20260905', 'r-20260913-20260919'],
    'Seven days without USDT are skipped, the trend keeps the periods of the same length that have a price');

// ---------- the client's balance on the spot of every row ----------
const augustOps = build(monthPeriod(2026, 7)).operations!;
assert.deepEqual(augustOps.map((item) => item.balanceAfterCents), [-2000000, -27000000, -27000000, -12000000],
    'Opening balance, credit sale, cash sale (no change), payment');

// ---------- privacy at the model level: a EUR-settled sale has no DZD amount ----------
const eurEntry = entries.find((entry) => entry.id === rows.find((item) => item.linkedTxId === 'tx-eur')!.id)!;
assert.equal(eurEntry.dzdCents, null, 'The DZD value of a sale settled in EUR is our valuation: never shown');
assert.equal(eurEntry.eurAmount, 470);

// ---------- any span of days ----------
const summer = build(forDates('2026-08-15', '2026-10-02'));
assert.equal(summer.kind, 'range');
assert.equal(summer.days, 49);
assert.equal(summer.breakdownUnit, 'month');
assert.equal(summer.reference, 'R-20260815-20261002-C1');
assert.equal(summer.isLive, false);
assert.equal(summer.balance.openingCents, balanceCalculation(entries, { from: day('2026-08-15'), to: day('2026-08-15') }).openingCents, 'Opening: the balance before the first day');
assert.equal(summer.balance.closingCents, entries.filter((entry) => entry.timestamp <= day('2026-10-02', true)).reduce((sum, entry) => sum + entry.balanceCents, 0), 'Closing: the balance at the end of the last day');
assert.equal(summer.comparison.reduce((sum, row) => sum + row.totals.spentCents, 0), summer.totals.spentCents, 'The parts add up to the range');
assert.deepEqual(summer.comparison.map((row) => row.changePct), [null, null, null], 'No change against or from a part cut at the range\'s edge');
assert.equal(summer.operations.length, entries.filter((entry) => entry.timestamp >= day('2026-08-15') && entry.timestamp <= day('2026-10-02', true)).length, 'Every row of the range');
assert.equal(summer.operations[summer.operations.length - 1].balanceAfterCents, summer.balance.closingCents);
assert.equal(summer.comparedWith?.period.key, 'r-20260627-20260814', 'Compared with the 49 days before');
assert.equal(summer.comparedWith?.spentCents, toCents(1000 * 250 + 400 * 251), 'What was bought in those 49 days (August 3 and 12)');
assert.equal(summer.sinceJanuary, null, 'Since January: for a whole month only');
assert.equal(summer.biggestPurchase, null);
assert.equal(summer.bestMonth, null);
const wholeWeeks = build(forDates('2026-09-06', '2026-09-26'));
assert.equal(wholeWeeks.breakdownUnit, 'week');
assert.deepEqual(wholeWeeks.comparison.map((row) => row.changePct), [null, Math.round(((600 * 248.75 - 300 * 262.5) / (300 * 262.5)) * 100), null],
    'Whole weeks are compared with each other; a week without purchases has no change');
const liveRange = build(forDates('2026-09-20', '2026-10-10'));
assert.equal(liveRange.isLive, true);
assert.equal(liveRange.comparedWith, null, 'A range still running is compared with nothing');
assert.equal(liveRange.shownTo, NOW, 'Its data stop today');
assert.equal(liveRange.balance.closingCents, pageBalanceCents, 'A range up to today ends on the client page balance');
const fullYear = build(yearPeriod(2026));
assert.equal(fullYear.operations.length, entries.filter((entry) => entry.timestamp >= yearPeriod(2026).from).length, 'A yearly report lists its operations too');
assert.equal(fullYear.operations[fullYear.operations.length - 1].balanceAfterCents, pageBalanceCents);
const history = build(forDates('2024-11-20', '2026-10-03'));
assert.equal(history.breakdownUnit, 'year');
assert.equal(history.balance.openingCents, 0);
assert.equal(history.balance.closingCents, pageBalanceCents, 'The whole history ends on the client page balance');
assert.equal(history.operations.length, entries.length);

console.log('client activity report model tests passed');
