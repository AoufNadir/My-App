import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { deriveInvestorEconomics, type ManagerFeeHistoryEntry } from '../hooks/useInvestorEconomics';
import type { Investor, InvestorTransaction, TreasuryTx, Tx } from '../types';
import { InvestorReportSheet } from '../components/investor-details/InvestorReportSheet';
import { INVESTOR_REPORT_WORDS } from '../components/investor-details/investorReportText';
import { distinctScreenNumbers } from '../testing/screenNumbers';
import type { DebtWriteOff } from './debtWriteOffs';
import { buildInvestorReport, investorReportFileName, prepareInvestorReportInput, type InvestorReportDateRange, type InvestorReportOperationKind, type InvestorReportSources, type PreparedInvestorReport } from './investorReport';
import { computePamLedger } from './pamLedger';
import { buildInvestorPdfReport } from './pdfReports';

// V3-5 moves the investor report to the client report's look. Its numbers must not move: the
// preparation is the old handleExportInvestorReport code, and every number of the new page is the
// number the old printed report (buildInvestorPdfReport) showed, for a plain investor, the
// manager with personal expenses, an archived investor, and every kind of period.

const two = (value: number) => String(value).padStart(2, '0');
const at = (year: number, month: number, day: number, hour = 12, minute = 0) => new Date(year, month - 1, day, hour, minute).getTime();
const endOf = (year: number, month: number, day: number) => new Date(year, month - 1, day, 23, 59, 59, 999).getTime();
const dayOf = (ts: number) => { const d = new Date(ts); return `${two(d.getDate())}/${two(d.getMonth() + 1)}/${d.getFullYear()}`; };
const timeOf = (ts: number) => { const d = new Date(ts); return `${two(d.getHours())}:${two(d.getMinutes())}`; };
const NOW = at(2026, 10, 9, 15);

// ---- Fake data: four investors (the manager, two active, one archived), two years of sales ----
const person = (fields: Partial<Investor> & Pick<Investor, 'id' | 'name' | 'entryDate' | 'initialCapital'>): Investor => ({
    capitalInvested: fields.initialCapital, sharePercentage: 0, totalProfit: 0, withdrawnProfit: 0, availableProfit: 0, isActive: true, ...fields,
});
const investors: Investor[] = [
    person({ id: 'inv-m', name: 'Yacine Benali', entryDate: '2025-01-15', initialCapital: 1_000_000, isManager: true, notes: 'Gérant et porteur du projet.' }),
    person({ id: 'inv-a', name: 'Sofiane Haddad', entryDate: '2025-03-01', initialCapital: 300_000, notes: 'Retraits le 1er du mois, par BaridiMob.' }),
    person({ id: 'inv-b', name: 'Lina Mansouri', entryDate: '2026-02-10', initialCapital: 120_000 }),
    person({ id: 'inv-c', name: 'Omar Kaci', entryDate: '2025-06-01', initialCapital: 150_000, isActive: false, archived: true }),
];
const sale = (id: string, ts: number, quantity: number, sell: number): Tx => ({ id, type: 'sell', currency: 'USDT', quantity, sell, total: quantity * sell, date: dayOf(ts), time: timeOf(ts), timestamp: ts } as Tx);
const purchase = (id: string, ts: number, quantity: number, price: number): Tx => ({ id, type: 'buy', currency: 'USDT', quantity, price, total: quantity * price, date: dayOf(ts), time: timeOf(ts), timestamp: ts } as Tx);
const transactions: Tx[] = [
    purchase('b1', at(2025, 2, 1, 10), 10_000, 240),
    sale('s1', at(2025, 4, 10, 14), 3_000, 252),
    sale('s2', at(2025, 8, 20, 11), 2_500, 255.5),
    purchase('b2', at(2025, 12, 5, 9), 6_000, 245.75),
    sale('s3', at(2026, 1, 15, 16), 4_000, 258.25),
    sale('s4', at(2026, 5, 3, 10), 3_500, 251.4),
    sale('s5', at(2026, 8, 12, 15), 2_000, 262),
    sale('s6', at(2026, 9, 18, 17), 500, 260.75),
    sale('s7', at(2026, 10, 2, 11), 300, 263.1),
];
const itx = (id: string, investorId: string, type: InvestorTransaction['type'], amount: number, ts: number, extra: Partial<InvestorTransaction> = {}): InvestorTransaction => ({
    id, investorId, type, amount, date: dayOf(ts), time: timeOf(ts), timestamp: ts, ...extra,
});
// The row written with a new investor's first capital (useInvestorHandlers).
const OPENING: Partial<InvestorTransaction> = { origin: 'initial_capital', notes: 'Capital Initial' };
const investorTransactions: InvestorTransaction[] = [
    itx('m1', 'inv-m', 'deposit_capital', 1_000_000, at(2025, 1, 15, 9), OPENING),
    itx('m2', 'inv-m', 'deposit_capital', 200_000, at(2026, 5, 10, 16), { paymentSource: 'Caisse' }),
    itx('m3', 'inv-m', 'reinvest_profit', 15_000, at(2026, 6, 30, 18)),
    itx('m4', 'inv-m', 'withdraw_capital', 30_000, at(2026, 8, 5, 10), { paymentSource: 'BaridiMob', notes: 'Retrait capital août' }),
    itx('m5', 'inv-m', 'withdraw_profit', 12_000, at(2026, 9, 20, 13)),
    itx('m6', 'inv-m', 'withdraw_capital', 5_000, at(2026, 9, 25, 17), { origin: 'personal_expense' }),
    // An older row: a personal expense known only by its link to the treasury row.
    itx('m7', 'inv-m', 'withdraw_capital', 7_500, at(2026, 9, 27, 12), { linkedTreasuryTxId: 'e9' }),
    itx('a1', 'inv-a', 'deposit_capital', 300_000, at(2025, 3, 1, 10), { ...OPENING, paymentSource: 'Caisse' }),
    // Legacy row: the current code no longer writes it.
    itx('a2', 'inv-a', 'profit_distribution', 18_200, at(2025, 12, 31, 18)),
    itx('a3', 'inv-a', 'withdraw_profit', 20_000, at(2026, 1, 5, 11), { paymentSource: 'BaridiMob', notes: 'Retrait janvier' }),
    itx('a4', 'inv-a', 'deposit_capital', 100_000, at(2026, 4, 15, 9, 30), { paymentSource: 'Caisse' }),
    itx('a5', 'inv-a', 'reinvest_profit', 4_200, at(2026, 7, 1, 10)),
    itx('a6', 'inv-a', 'withdraw_capital', 50_000, at(2026, 9, 10, 10), { paymentSource: 'Caisse', notes: 'Retrait partiel "urgent" & frais' }),
    itx('a7', 'inv-a', 'withdraw_profit', 6_500.75, at(2026, 10, 1, 9, 5), { paymentSource: 'BaridiMob', notes: 'L’avance d’octobre' }),
    itx('b1', 'inv-b', 'deposit_capital', 120_000, at(2026, 2, 10, 12), { ...OPENING, paymentSource: 'USDT' }),
    itx('b2', 'inv-b', 'withdraw_profit', 9_000, at(2026, 7, 15, 14), { paymentSource: 'EUR' }),
    itx('c1', 'inv-c', 'deposit_capital', 150_000, at(2025, 6, 1, 10), { ...OPENING, paymentSource: 'Caisse' }),
    itx('c2', 'inv-c', 'withdraw_profit', 19_450, at(2026, 3, 1, 10), { paymentSource: 'Caisse' }),
    itx('c3', 'inv-c', 'withdraw_capital', 150_000, at(2026, 3, 1, 10, 30), { paymentSource: 'Caisse' }),
];
const treasury = (id: string, amount: number, ts: number, fields: Partial<TreasuryTx>): TreasuryTx => ({ id, amount, timestamp: ts, date: dayOf(ts), time: timeOf(ts), type: 'Retrait', source: 'Caisse', ...fields });
const personalExpenses: TreasuryTx[] = [
    treasury('e1', 9_000, at(2025, 12, 20, 11), { origin: 'personal_expense', notes: 'Fournitures' }),
    treasury('e2', 20_000, at(2026, 3, 12, 15), { origin: 'personal_expense', notes: 'Cadeau' }),
    treasury('e3', 6_500, at(2026, 8, 2, 21), { origin: 'personal_expense', notes: 'Restaurant' }),
    treasury('e4', 15_000, at(2026, 9, 15, 8), { origin: 'personal_expense', advanceState: 'settled', settledAmount: 11_200 }),
    treasury('e5', 8_000, at(2026, 9, 28, 18, 45), { origin: 'personal_expense', source: 'BaridiMob' }),
    treasury('e9', 7_500, at(2026, 9, 27, 12), { origin: 'personal_expense', notes: 'Payé sur le capital' }),
    treasury('e6', 2_500, at(2026, 10, 3, 13), { origin: 'personal_expense' }),
];
const deliveryExpenses: TreasuryTx[] = [
    treasury('d1', 4_500, at(2026, 5, 20, 10), { origin: 'delivery_expense' }),
    treasury('d2', 1_200, at(2026, 9, 5, 16), { origin: 'delivery_expense' }),
];
const debtWriteOffs: DebtWriteOff[] = [{ id: 'w1', clientId: 'cl-1', amountDzd: 3_000, timestamp: at(2026, 6, 15, 10) }];
const managerFeeHistory: ManagerFeeHistoryEntry[] = [{ percentage: 25, effectiveFrom: at(2025, 1, 1, 0) }, { percentage: 30, effectiveFrom: at(2026, 1, 1, 0) }];
const managerFeePercentage = '30';
const pamLedger = computePamLedger(transactions);
// As the app hands them to the reports: investors already derived from the whole history.
const derivedInvestors = deriveInvestorEconomics({ investors, investorTransactions, transactions, managerFeePercentage, managerFeeHistory, pamLedger, deliveryExpenses, debtWriteOffs, personalExpenses }).derivedInvestors;
const sources: InvestorReportSources = { derivedInvestors, investorTransactions, transactions, managerFeePercentage, managerFeeHistory, pamLedger, deliveryExpenses, debtWriteOffs, personalExpenses };

// ---- The old preparation, as handleExportInvestorReport did it before V3-5 (V3-4) ----
function oldPreparation(investorId: string, range: InvestorReportDateRange): PreparedInvestorReport {
    const periodEconomics = deriveInvestorEconomics({
        investors: derivedInvestors, investorTransactions, transactions, managerFeePercentage, managerFeeHistory, pamLedger,
        periodStartTs: range.startTs, periodEndTs: range.endTs, deliveryExpenses, debtWriteOffs, personalExpenses,
    });
    const investor = periodEconomics.derivedInvestors.find((item) => item.id === investorId);
    if (!investor)
        return { ok: false, reason: 'notFound' };
    const closingEndTs = range.endTs ?? null;
    const transactionsAtClose = closingEndTs == null ? transactions : transactions.filter((tx) => Number(tx.timestamp) <= closingEndTs);
    const investorTransactionsAtClose = closingEndTs == null ? investorTransactions : investorTransactions.filter((tx) => Number(tx.timestamp) <= closingEndTs);
    const deliveryExpensesAtClose = closingEndTs == null ? deliveryExpenses : (deliveryExpenses || []).filter((tx) => Number(tx.timestamp) <= closingEndTs);
    const debtWriteOffsAtClose = closingEndTs == null ? debtWriteOffs : (debtWriteOffs || []).filter((row) => row.timestamp <= closingEndTs);
    const personalExpensesAtClose = closingEndTs == null ? personalExpenses : (personalExpenses || []).filter((tx) => Number(tx.timestamp) <= closingEndTs);
    const closingEconomics = deriveInvestorEconomics({
        investors: derivedInvestors, investorTransactions: investorTransactionsAtClose, transactions: transactionsAtClose, managerFeePercentage, managerFeeHistory,
        pamLedger: computePamLedger(transactionsAtClose), periodEndTs: closingEndTs, deliveryExpenses: deliveryExpensesAtClose, debtWriteOffs: debtWriteOffsAtClose, personalExpenses: personalExpensesAtClose,
    });
    const closingInvestor = closingEconomics.derivedInvestors.find((item) => item.id === investorId);
    if (!closingInvestor)
        return { ok: false, reason: 'notFoundAtClose' };
    const reportInvestor = { ...investor, capitalInvested: closingInvestor.capitalInvested, availableProfit: closingInvestor.availableProfit, displayAvailableProfit: closingInvestor.displayAvailableProfit, sharePercentage: closingInvestor.sharePercentage };
    return { ok: true, input: { investor: reportInvestor, investorTransactions: investorTransactions.filter((tx) => tx.investorId === investorId), personalExpenses, reportStartTs: range.startTs, reportEndTs: range.endTs } };
}

// ---- Reading the two pages ----
const decode = (text: string) => text.replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, '\'').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
// The same number, whatever the spaces, the minus sign or the unit: « −1 234,50 DZD » = « -1 234,50 DZD ».
const numberOf = (text: string) => decode(text).replace(/[\s\u00A0\u202F]/g, '').replace(/[−—]/g, '-').replace(/DZD$/, '');
const first = (html: string, pattern: RegExp, what: string) => {
    const match = html.match(pattern);
    assert.ok(match, `${what}: not found`);
    return match[1];
};
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

type Row = { date: string; time: string; label: string; amount: string; source: string; notes: string };
function oldPage(html: string, isManager: boolean) {
    const text = html.replace(/\s+/g, ' ');
    const summary = (label: string) => numberOf(first(text, new RegExp(`${label}</div> <div class="investor-summary-value">([^<]+)</div>`), `old ${label}`));
    const quick = (label: string) => numberOf(first(text, new RegExp(`<span>${label}</span> <strong>([^<]+)</strong>`), `old ${label}`));
    const movementLine = text.includes('<div class="investor-movement-line">');
    const movement = (label: string) => numberOf(first(text, new RegExp(`<strong>${label}</strong> <b class="[^"]*">([^<]+)</b>`), `old ${label}`));
    const rows: Row[] = [...text.matchAll(/<tr> <td class="investor-date"><span>([^<]+)<\/span><span class="investor-time">([^<]+)<\/span><\/td> <td>([^<]+)<\/td> <td class="num investor-amount (?:good|bad)">([^<]+)<\/td> <td>([^<]*)<\/td> <td>([^<]*)<\/td> <\/tr>/g)]
        .map((match) => ({ date: match[1], time: match[2], label: decode(match[3]), amount: numberOf(match[4]), source: decode(match[5]), notes: decode(match[6]) }));
    return {
        capital: summary('Capital actuel'),
        availableProfit: summary('Profit disponible'),
        estimatedValue: summary('Valeur estim&eacute;e'),
        share: summary('Part du fonds'),
        periodProfit: quick('Profit net de la p&eacute;riode'),
        yield: quick('Rendement de la p&eacute;riode'),
        count: quick('Nombre de mouvements'),
        movements: movementLine ? [
            movement('Ajouts capital'),
            movement(isManager ? 'B&eacute;n&eacute;fices conserv&eacute;s' : 'R&eacute;investi'),
            movement(isManager ? 'D&eacute;penses personnelles' : 'Retraits b&eacute;n&eacute;fices'),
            movement('Mouvement net'),
        ] : null,
        rows,
    };
}
function newPage(html: string, isManager: boolean) {
    const w = INVESTOR_REPORT_WORDS.fr;
    const card = (title: string) => numberOf(first(html, new RegExp(`</i>${escapeRegExp(title)}</span><span class="self-start[^"]*"><bdi[^>]*>([^<]+)</bdi>`), `new ${title}`));
    const fact = (label: string) => numberOf(first(html, new RegExp(`<small class="text-\\[11px\\] text-neutral-500">${escapeRegExp(label)}</small><b class="self-start text-sm[^"]*"><bdi[^>]*>([^<]+)</bdi>`), `new ${label}`));
    const movementBox = !html.includes(w.noMovement);
    const movement = (label: string) => numberOf(first(html, new RegExp(`<span class="min-w-0">${escapeRegExp(label)}</span><span class="shrink-0 font-semibold[^"]*"><bdi[^>]*>([^<]+)</bdi>`), `new ${label}`));
    const rows = [...html.matchAll(/<tr data-pdf-row=""(?: data-pdf-break="")?><td class="[^"]*"><bdi[^>]*>([^<]+)<\/bdi><small[^>]*><bdi[^>]*>([^<]+)<\/bdi><\/small><\/td><td class="[^"]*">([^<]+)(?:<small[^>]*><bdi>([^<]*)<\/bdi><\/small>)?<\/td><td class="[^"]*"><bdi[^>]*>([^<]+)<\/bdi><\/td><\/tr>/g)]
        .map((match) => ({ date: match[1], time: match[2], label: decode(match[3]), detail: decode(match[4] ?? ''), amount: numberOf(match[5]) }));
    return {
        capital: card(w.capital),
        availableProfit: card(w.availableProfit),
        estimatedValue: card(w.estimatedValue),
        share: card(w.fundShare),
        periodProfit: fact(w.periodProfit),
        yield: fact(w.periodYield),
        count: fact(w.movementCount),
        movements: movementBox ? [movement(w.deposits), movement(isManager ? w.retained : w.reinvested), movement(isManager ? w.personalExpenses : w.profitOut), movement(w.netMovement)] : null,
        rows,
    };
}

// How the old page named each operation, and the new name for the same operation.
const OLD_NAMES: Record<string, InvestorReportOperationKind> = {
    'Dépôt capital': 'deposit',
    'Retrait capital': 'withdrawCapital',
    'Dépense personnelle (capital)': 'personalExpenseCapital',
    'Retrait bénéfice': 'withdrawProfit',
    'Dépense personnelle': 'personalExpense',
    'Réinvestissement': 'reinvest',
    'Bénéfices conservés': 'retained',
    profit_distribution: 'distribution',
};
const DOT = '\u00A0· ';

const ranges: Array<[string, InvestorReportDateRange]> = [
    ['this month', { startTs: at(2026, 10, 1, 0), endTs: endOf(2026, 10, 9) }],
    ['September', { startTs: at(2026, 9, 1, 0), endTs: endOf(2026, 9, 30) }],
    ['2025', { startTs: at(2025, 1, 1, 0), endTs: endOf(2025, 12, 31) }],
    ['this year to today', { startTs: at(2026, 1, 1, 0), endTs: endOf(2026, 10, 9) }],
    ['a month without operations', { startTs: at(2025, 5, 1, 0), endTs: endOf(2025, 5, 31) }],
    ['whole history', {}],
    ['a start only', { startTs: at(2026, 6, 1, 0) }],
    ['an end only', { endTs: endOf(2026, 3, 31) }],
];
const seen = new Set<string>();
let compared = 0;
for (const investor of investors) {
    for (const [name, range] of ranges) {
        const what = `${investor.name}, ${name}`;
        const prepared = prepareInvestorReportInput(sources, investor.id, range);
        const old = oldPreparation(investor.id, range);
        assert.deepEqual(prepared, old, `${what}: the same preparation as before`);
        assert.ok(prepared.ok && old.ok);
        const isManager = investor.isManager === true;
        const before = oldPage(buildInvestorPdfReport(old.input).html, isManager);
        const report = buildInvestorReport(prepared.input, NOW);
        const html = renderToStaticMarkup(<InvestorReportSheet report={report} lang="fr" variant="print"/>);
        const after = newPage(html, isManager);

        for (const key of ['capital', 'availableProfit', 'estimatedValue', 'share', 'periodProfit', 'yield', 'count', 'movements'] as const)
            assert.deepEqual(after[key], before[key], `${what}: ${key}`);
        assert.equal(after.rows.length, before.rows.length, `${what}: every operation`);
        assert.equal(after.rows.length, report.operations.length);
        before.rows.forEach((row, index) => {
            const now = after.rows[index];
            const kind = OLD_NAMES[row.label];
            assert.ok(kind, `${what}: old name ${row.label}`);
            seen.add(kind);
            assert.equal(now.date, row.date, `${what}: date of row ${index}`);
            assert.equal(now.time, row.time, `${what}: time of row ${index}`);
            assert.equal(now.label, INVESTOR_REPORT_WORDS.fr.operation[kind], `${what}: the investor page's name for ${row.label}`);
            if (kind === 'distribution') {
                // The old page wrote this legacy row « - » under its technical name; the investor page shows it « + ».
                assert.equal(now.amount, row.amount.replace(/^-/, '+'), `${what}: distribution row ${index}`);
                assert.match(row.amount, /^-/);
            }
            else
                assert.equal(now.amount, row.amount, `${what}: amount of row ${index}`);
            assert.equal(now.detail, [row.source === '—' ? '' : row.source, row.notes === '—' ? '' : row.notes].filter(Boolean).join(DOT), `${what}: source and notes of row ${index}`);
        });

        // The Arabic page shows exactly the same numbers.
        const arabic = renderToStaticMarkup(<InvestorReportSheet report={report} lang="ar" variant="screen"/>);
        assert.deepEqual(distinctScreenNumbers(arabic), distinctScreenNumbers(html), `${what}: Arabic and French show the same numbers`);
        compared++;
    }
}
assert.equal(compared, investors.length * ranges.length);
// Every way of naming an operation was met at least once, the manager's included.
assert.deepEqual([...seen].sort(), ['deposit', 'distribution', 'personalExpense', 'personalExpenseCapital', 'reinvest', 'retained', 'withdrawCapital', 'withdrawProfit']);

// The fixture reaches the cases that matter: personal expenses and kept profit for the manager,
// a loss-making balance, and no capital (no yield).
{
    const managerYear = buildInvestorReport((prepareInvestorReportInput(sources, 'inv-m', ranges[3][1]) as Extract<PreparedInvestorReport, { ok: true }>).input, NOW);
    assert.ok(managerYear.profitOut > 0 && managerYear.reinvested > 0, 'manager: personal expenses and profit kept');
    assert.equal(managerYear.estimatedValue, managerYear.capital, 'manager: his capital already holds his profit');
    const archived = buildInvestorReport((prepareInvestorReportInput(sources, 'inv-c', {}) as Extract<PreparedInvestorReport, { ok: true }>).input, NOW);
    assert.equal(archived.yieldPct, null, 'archived, all capital withdrawn: no yield');
    const empty = buildInvestorReport((prepareInvestorReportInput(sources, 'inv-a', ranges[4][1]) as Extract<PreparedInvestorReport, { ok: true }>).input, NOW);
    assert.equal(empty.operations.length, 0);
    assert.ok(empty.capital > 0, 'no operation in the period, but the situation is still there');
}

// An unknown investor: no report (the old window said « Investisseur introuvable »).
assert.deepEqual(prepareInvestorReportInput(sources, 'nobody', {}), { ok: false, reason: 'notFound' });

// Reference and file name: the period, then the investor.
{
    const september = buildInvestorReport((prepareInvestorReportInput(sources, 'inv-a', ranges[1][1]) as Extract<PreparedInvestorReport, { ok: true }>).input, NOW);
    assert.equal(september.reference, 'I-20260901-20260930-INVA');
    assert.equal(investorReportFileName(september), 'ProDigital_Sofiane-Haddad_2026-09-01_2026-09-30.pdf');
    const all = buildInvestorReport((prepareInvestorReportInput(sources, 'inv-a', {}) as Extract<PreparedInvestorReport, { ok: true }>).input, NOW);
    assert.equal(all.reference, 'I-ALL-20261009-INVA');
    assert.equal(investorReportFileName(all), 'ProDigital_Sofiane-Haddad_2026-10-09.pdf');
    assert.equal(investorReportFileName({ ...all, investorName: 'ياسين' }), 'ProDigital_2026-10-09.pdf', 'A name in Arabic letters stays out of the file name');
    assert.equal(investorReportFileName({ ...all, investorName: 'Réda Aït-Ali' }), 'ProDigital_Reda-Ait-Ali_2026-10-09.pdf');
}

console.log(`investor report tests passed (${compared} reports compared with the old one)`);
