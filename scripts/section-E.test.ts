/**
 * Regression tests for Section E (Reports & Analytics) of MATH_AUDIT_REPORT.md
 *
 * Covers (where feasible):
 *   T-E-001, T-E-002: Static source checks on useReportExports.ts (verify current violation).
 *   T-E-003, T-E-004: getRealizedProfit fallback behavior (via buildMonthlyPdfReport).
 *   T-E-005: jGd0 case shows derivedProfit when pamLedger provided.
 *   T-E-006: Uncosted warnings section appears only when pamLedger provided.
 *   T-E-010: globalNetProfit sums USDT + EUR totalProfit (both DZD).
 *   T-E-013, T-E-014, T-E-015, T-E-016, T-E-017: Static/render checks on clientPdfReport / investorPdfReport / monthlyPdfReport.
 *
 * DEFERRED (require React testing library — out of scope for this audit):
 *   T-E-007, T-E-008, T-E-011, T-E-012: hook-level tests for useAnalyticsViewModel.
 *   T-E-009: cross-comparison hook vs pdf (depends on T-E-007).
 *
 * Test runner: matches existing scripts/pamLedger.test.ts pattern (custom test() helper).
 * Run with TypeScript loader (e.g., `node --import tsx scripts/section-E.test.ts`).
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { buildMonthlyPdfReport, buildClientPdfReport, buildInvestorPdfReport } from '../src/utils/pdfReports.js';
import { computePamLedger } from '../src/utils/pamLedger.js';
import type { Tx, ClientDzd, ClientTransactionDzd, Investor, InvestorTransaction } from '../src/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// ---------- helpers (same pattern as existing tests) ----------

function tx(input: Partial<Tx> & Pick<Tx, 'id' | 'type' | 'quantity' | 'timestamp'>): Tx {
    return {
        date: '01/01/2026',
        time: '10:00',
        currency: 'USDT',
        ...input,
    } as Tx;
}

function test(name: string, fn: () => void): void {
    try {
        fn();
        console.log(`PASS ${name}`);
    } catch (error) {
        console.error(`FAIL ${name}`);
        throw error;
    }
}

function compactNumberText(value: string): string {
    return value.replace(/[\s\u00a0\u202f]/g, '');
}

const noopGetClientName = (c: ClientDzd): string => c.fullName || 'Unknown';

const emptyPortfolioStats = {
    usdt: { available: 0, avgBuy: 0, totalProfit: 0 },
    eur: { available: 0, avgBuy: 0, totalProfit: 0 },
};

/**
 * Builds the jGd0Hug9GvHZ3pxrSrDR fixture: a USDT opening Ajout + a sell where
 * stored profit (2944.06) differs from derived PAM profit (849.00).
 */
function buildJGd0Fixture(): Tx[] {
    return [
        tx({
            id: 'opening-usdt-jgd0',
            timestamp: 1769100000000, // 22/01/2026 ~17:40
            type: 'Ajout Manuel',
            quantity: 1000,
            total: 248650, // costBasis ⇒ avgBuy = 248.65
            date: '22/01/2026',
            time: '17:40',
        }),
        tx({
            id: 'jGd0Hug9GvHZ3pxrSrDR',
            timestamp: 1769283803850, // 24/01/2026 20:43
            type: 'sell',
            quantity: 1000,
            sell: 249.5, // sellTotal = 249500
            profit: 2944.06, // ❌ stored snapshot (deliberately wrong)
            date: '24/01/2026',
            time: '20:43',
        }),
    ];
}

// =============================================================
// T-E-001: useReportExports.ts DOES pass pamLedger (after FIX-1)
// =============================================================

test('T-E-001: useReportExports_passesPamLedgerToBuildMonthly (POST FIX-1)', () => {
    const source = readFileSync(join(projectRoot, 'src/hooks/useReportExports.ts'), 'utf8');
    const buildMonthlyCallMatch = /buildMonthlyPdfReport\(\{[\s\S]*?\}\);/.exec(source);
    assert.ok(buildMonthlyCallMatch, 'buildMonthlyPdfReport call must exist in useReportExports.ts');
    const callBody = buildMonthlyCallMatch[0];
    assert.equal(
        callBody.includes('pamLedger'),
        true,
        'AFTER FIX-1: useReportExports must pass pamLedger to buildMonthlyPdfReport',
    );
});

// =============================================================
// T-E-002: useReportExports.ts imports computePamLedger (after FIX-1)
// =============================================================

test('T-E-002: useReportExports_importsComputePamLedger (POST FIX-1)', () => {
    const source = readFileSync(join(projectRoot, 'src/hooks/useReportExports.ts'), 'utf8');
    assert.ok(
        source.includes("import { computePamLedger }") || source.includes('from \'../utils/pamLedger\''),
        'AFTER FIX-1: useReportExports must import computePamLedger',
    );
    assert.ok(
        source.includes('useMemo(() => computePamLedger(transactions)'),
        'AFTER FIX-1: pamLedger must be computed via useMemo',
    );
});

// =============================================================
// T-E-003: getRealizedProfit returns 0 when profitByTxId is undefined (after FIX-2)
//           No more fallback to tx.profit. PDF without pamLedger shows 0 profit.
// =============================================================

test('T-E-003: getRealizedProfit_returnsZero_whenProfitByTxIdIsUndefined (POST FIX-2)', () => {
    const transactions = buildJGd0Fixture();
    const portfolioStats = {
        usdt: { available: 0, avgBuy: 248.65, totalProfit: 0 },
        eur: { available: 0, avgBuy: 0, totalProfit: 0 },
    };
    // Call WITHOUT pamLedger — should NOT fall back to tx.profit
    const report = buildMonthlyPdfReport({
        month: 0,
        year: 2026,
        monthLabel: 'Janvier',
        transactions,
        clientTransactions: [],
        clients: [],
        getClientName: noopGetClientName,
        portfolioStats,
        // pamLedger NOT passed
    });
    // After FIX-2: realized profit should NOT show 2944.06 (the stored snapshot)
    // Check the "Profit realise" summary card specifically
    const profitCardMatch = /Profit realise[\s\S]*?value[^>]*>([^<]+)/.exec(report.html);
    assert.ok(profitCardMatch, 'Profit realise card must render');
    const profitText = profitCardMatch[1];
    assert.equal(
        profitText.includes('944,06'),
        false,
        'POST FIX-2: profit card must NOT show stored 2944.06 (no fallback to tx.profit)',
    );
});

// =============================================================
// T-E-004: getRealizedProfit uses derivedProfit when profitByTxId is provided
// =============================================================

test('T-E-004: getRealizedProfit_usesDerivedProfit_whenProfitByTxIdIsProvided', () => {
    // NOTE: The simplified 1000/1000 synthetic fixture below mathematically yields
    // derivedProfit = 850 (= 249500 - 1000×248.65), NOT the production 849 (which
    // comes from the multi-transaction EUR↔USDT path in pamLedger.test.ts).
    // What matters for this test: derived (850) ≠ stored (2944.06), and derived wins.
    const transactions = buildJGd0Fixture();
    const pamLedger = computePamLedger(transactions);
    const portfolioStats = {
        usdt: { available: 0, avgBuy: 248.65, totalProfit: 850 },
        eur: { available: 0, avgBuy: 0, totalProfit: 0 },
    };
    const report = buildMonthlyPdfReport({
        month: 0,
        year: 2026,
        monthLabel: 'Janvier',
        transactions,
        clientTransactions: [],
        clients: [],
        getClientName: noopGetClientName,
        portfolioStats,
        pamLedger,
    });
    // With pamLedger, the realizedProfit summary should show the derived value (850),
    // not the stored snapshot (2944.06).
    assert.ok(
        report.html.includes('850,00') && !report.html.includes('2 944,06'),
        'PDF must show derived profit (850.00), not stored (2 944,06)',
    );
});

// =============================================================
// T-E-005: jGd0Hug9GvHZ3pxrSrDR — full integration: derived wins over stored (2944.06)
// Synthetic 1000/1000 fixture yields derived = 850. The production 849 reference is
// validated separately in scripts/pamLedger.test.ts using the full 15-tx fixture.
// =============================================================

test('T-E-005: monthlyPdfReport_jGd0_showsDerivedNotStored_whenPamLedgerProvided', () => {
    const transactions = buildJGd0Fixture();
    const pamLedger = computePamLedger(transactions);
    const jGd0Row = pamLedger.profitByTxId['jGd0Hug9GvHZ3pxrSrDR'];
    assert.ok(jGd0Row, 'jGd0 row must exist in profitByTxId');
    assert.equal(jGd0Row.derivedProfit, 850, 'simplified fixture: derived = 850 (= 249500 - 248650)');
    assert.equal(jGd0Row.storedProfit, 2944.06, 'stored profit must be 2944.06 (mismatch reference)');
    assert.equal(jGd0Row.flags.storedMismatch, true, 'storedMismatch flag must be true');

    // Build PDF with pamLedger
    const report = buildMonthlyPdfReport({
        month: 0,
        year: 2026,
        monthLabel: 'Janvier',
        transactions,
        clientTransactions: [],
        clients: [],
        getClientName: noopGetClientName,
        portfolioStats: {
            usdt: { available: 0, avgBuy: 248.65, totalProfit: 850 },
            eur: { available: 0, avgBuy: 0, totalProfit: 0 },
        },
        pamLedger,
    });
    // Realized profit summary card should display the derived value (850), not stored (2944.06).
    const profitCardMatch = /Profit realise[\s\S]*?value[^>]*>([^<]+)/.exec(report.html);
    assert.ok(profitCardMatch, 'Profit realise card must render');
    const profitText = profitCardMatch[1];
    assert.ok(
        profitText.includes('850') && !profitText.includes('944,06'),
        `Profit card must show derived (850), not stored (2944.06). Got: "${profitText}"`,
    );
});

// =============================================================
// T-E-006: Uncosted warnings section appears only when pamLedger.sellProfitRows is provided
// =============================================================

test('T-E-006: monthlyPdfReport_uncostedWarningsSection_appearsWhenPamLedgerProvided', () => {
    // Build a sell-with-uncosted-quantity fixture
    const transactions: Tx[] = [
        tx({
            id: 'qty-only-add',
            timestamp: 1769100000000,
            type: 'Ajout Manuel',
            quantity: 100,
            // NO total ⇒ quantityOnlyAdjustment ⇒ uncosted basis
            date: '22/01/2026',
        }),
        tx({
            id: 'sell-with-uncosted',
            timestamp: 1769283803850,
            type: 'sell',
            quantity: 100,
            sell: 250,
            date: '24/01/2026',
        }),
    ];
    const pamLedger = computePamLedger(transactions);
    // Sanity: uncostedQuantitySold flag must be on
    const sellRow = pamLedger.profitByTxId['sell-with-uncosted'];
    assert.ok(sellRow);
    assert.equal(sellRow.flags.uncostedQuantitySold, true, 'uncostedQuantitySold flag must be true');

    // Without pamLedger: uncostedWarningsHtml is empty (sellProfitRows is empty array)
    const reportWithout = buildMonthlyPdfReport({
        month: 0,
        year: 2026,
        monthLabel: 'Janvier',
        transactions,
        clientTransactions: [],
        clients: [],
        getClientName: noopGetClientName,
        portfolioStats: emptyPortfolioStats,
    });
    assert.equal(
        reportWithout.html.includes('Alertes Comptables PAM'),
        false,
        'CURRENT: warnings section absent when pamLedger missing',
    );

    // With pamLedger: warnings section appears
    const reportWith = buildMonthlyPdfReport({
        month: 0,
        year: 2026,
        monthLabel: 'Janvier',
        transactions,
        clientTransactions: [],
        clients: [],
        getClientName: noopGetClientName,
        portfolioStats: emptyPortfolioStats,
        pamLedger,
    });
    assert.ok(
        reportWith.html.includes('Alertes Comptables PAM'),
        'Warnings section must appear when pamLedger provided',
    );
});

// =============================================================
// T-E-010: globalNetProfit = usdt.totalProfit + eur.totalProfit (both in DZD)
// =============================================================

test('T-E-010: globalNetProfit_addsUsdtAndEurTotalsAsDzd', () => {
    const portfolioStats = {
        usdt: { available: 100, avgBuy: 250, totalProfit: 1000 },
        eur: { available: 50, avgBuy: 290, totalProfit: 500 },
    };
    const report = buildMonthlyPdfReport({
        month: 0,
        year: 2026,
        monthLabel: 'Janvier',
        transactions: [],
        clientTransactions: [],
        clients: [],
        getClientName: noopGetClientName,
        portfolioStats,
    });
    // globalNetProfit should be 1500 DZD (1000 + 500). French locale renders the
    // thousands separator as U+202F (narrow no-break space), so use a flexible match.
    assert.ok(
        /1\s*500,00/.test(report.html),
        'globalNetProfit must equal sum of usdt + eur totalProfit (1500 DZD)',
    );
});

// =============================================================
// T-E-013: buildClientPdfReport does NOT use getRealizedProfit (static check)
//           Client report uses ledger balances, not P&L from PAM.
// =============================================================

test('T-E-013: clientPdfReport_doesNotUseGetRealizedProfit', () => {
    const source = readFileSync(join(projectRoot, 'src/utils/pdfReports.ts'), 'utf8');
    // Locate buildClientPdfReport function body (between its export and the next `export function`)
    const clientFnStart = source.indexOf('export function buildClientPdfReport');
    assert.notEqual(clientFnStart, -1, 'buildClientPdfReport must exist');
    const nextExport = source.indexOf('export function', clientFnStart + 1);
    const clientFnBody = source.slice(clientFnStart, nextExport);
    assert.equal(
        clientFnBody.includes('getRealizedProfit'),
        false,
        'buildClientPdfReport must not use getRealizedProfit (it is balance-based, not PAM-based)',
    );
});

// =============================================================
// T-E-014: buildInvestorPdfReport uses input.investor.totalProfit (already-derived)
// =============================================================

test('T-E-014: investorPdfReport_usesDerivedTotalProfit_fromInput', () => {
    const investor: Investor = {
        id: 'inv-1',
        name: 'Test Investor',
        entryDate: new Date('2025-01-01').toISOString(),
        capitalInvested: 100000,
        initialCapital: 100000,
        sharePercentage: 1,
        totalProfit: 5000, // ← derived from useInvestorEconomics
        availableProfit: 5000,
        withdrawnProfit: 0,
        isActive: true,
    } as Investor;
    const investorTransactions: InvestorTransaction[] = [];

    const report = buildInvestorPdfReport({
        investor,
        investorTransactions,
    });
    const compactHtml = compactNumberText(report.html);
    assert.ok(compactHtml.includes('5000,00'), 'totalProfit 5000 must render');
    assert.ok(report.html.includes('Aucun mouvement sur cette p&eacute;riode'), 'empty investor report must render compact movement note');
    // No reference to getRealizedProfit / tx.profit in the investor report path
    const source = readFileSync(join(projectRoot, 'src/utils/pdfReports.ts'), 'utf8');
    const investorFnStart = source.indexOf('export function buildInvestorPdfReport');
    assert.notEqual(investorFnStart, -1, 'buildInvestorPdfReport must exist');
    const nextExport = source.indexOf('export function', investorFnStart + 1);
    const investorFnBody = source.slice(investorFnStart, nextExport);
    assert.equal(
        investorFnBody.includes('getRealizedProfit'),
        false,
        'buildInvestorPdfReport must not use getRealizedProfit',
    );
});

// =============================================================
// T-E-015: buildInvestorPdfReport renders compact executive summary
// =============================================================

test('T-E-015: investorPdfReport_rendersCompactExecutiveSummary', () => {
    const investor: Investor = {
        id: 'inv-2',
        name: 'Compact Investor',
        entryDate: new Date('2026-01-01').toISOString(),
        capitalInvested: 100000,
        initialCapital: 100000,
        sharePercentage: 0.25,
        totalProfit: 5000,
        availableProfit: 3500,
        withdrawnProfit: 1000,
        isActive: true,
        notes: 'Priority account',
    } as Investor;
    const investorTransactions: InvestorTransaction[] = [
        {
            id: 'deposit-1',
            investorId: investor.id,
            type: 'deposit_capital',
            amount: 10000,
            date: '02/01/2026',
            time: '10:00',
            timestamp: new Date('2026-01-02T10:00:00Z').getTime(),
        },
        {
            id: 'withdraw-capital-1',
            investorId: investor.id,
            type: 'withdraw_capital',
            amount: 2000,
            date: '03/01/2026',
            time: '10:00',
            timestamp: new Date('2026-01-03T10:00:00Z').getTime(),
        },
        {
            id: 'withdraw-profit-1',
            investorId: investor.id,
            type: 'withdraw_profit',
            amount: 1000,
            date: '04/01/2026',
            time: '10:00',
            timestamp: new Date('2026-01-04T10:00:00Z').getTime(),
        },
        {
            id: 'reinvest-1',
            investorId: investor.id,
            type: 'reinvest_profit',
            amount: 500,
            date: '05/01/2026',
            time: '10:00',
            timestamp: new Date('2026-01-05T10:00:00Z').getTime(),
        },
    ];

    const report = buildInvestorPdfReport({ investor, investorTransactions });
    const compactHtml = compactNumberText(report.html);

    assert.ok(report.html.includes('Capital actuel'), 'capital metric must render');
    assert.ok(report.html.includes('Part du fonds'), 'share metric must render');
    assert.ok(report.html.includes('Profit net attribu&eacute;'), 'net profit metric must render');
    assert.ok(report.html.includes('B&eacute;n&eacute;fices disponibles'), 'available profit metric must render');
    assert.ok(report.html.includes('Valeur estim&eacute;e'), 'estimated value metric must render');
    assert.ok(report.html.includes('Rendement estim&eacute;'), 'estimated yield metric must render');
    assert.ok(report.html.includes('Mouvements de la p&eacute;riode'), 'movement summary section must render');
    assert.ok(report.html.includes('Nombre de mouvements'), 'movement count must render');
    assert.ok(report.html.includes('Mouvement net capital'), 'net capital movement must render');
    assert.ok(compactHtml.includes('103500,00'), 'estimated value must be capital + available profit');
    assert.ok(report.html.includes('+5,00%'), 'estimated yield must be based on totalProfit / capitalInvested');
    assert.ok(compactHtml.includes('+8500,00DZD'), 'net capital movement must include deposits + reinvestments - capital withdrawals');
    assert.ok(report.html.includes('Priority account'), 'investor notes must render as a compact line');
    assert.equal(report.html.includes('Journal des Operations'), false, 'investor report must not render the old operation journal heading');
    assert.equal(report.html.includes('<table>'), false, 'investor report must not render a transaction table by default');
});

// =============================================================
// T-E-016: clientPdfReport renders an external, client-safe statement
// =============================================================

test('T-E-016: clientPdfReport_rendersExternalClientStatement', () => {
    const client: ClientDzd = {
        id: 'client-1',
        fullName: 'Client Example',
        phone: '0555000000',
    } as ClientDzd;
    const clientTransactions: ClientTransactionDzd[] = [
        {
            id: 'opening',
            clientId: client.id,
            timestamp: new Date('2025-12-31T10:00:00Z').getTime(),
            date: '31/12/2025',
            time: '10:00',
            montant: -1000,
            type: 'Solde Initial',
        },
        {
            id: 'payment',
            clientId: client.id,
            timestamp: new Date('2026-01-05T10:00:00Z').getTime(),
            date: '05/01/2026',
            time: '10:00',
            montant: 3000,
            type: 'Règlement Reçu',
            notes: 'Paiement client',
        },
        {
            id: 'sale',
            clientId: client.id,
            linkedTxId: 'sell-1',
            timestamp: new Date('2026-01-06T10:00:00Z').getTime(),
            date: '06/01/2026',
            time: '10:00',
            montant: -1500,
            type: 'Vente USDT',
        },
    ];
    const transactions: Tx[] = [
        tx({
            id: 'sell-1',
            type: 'sell',
            quantity: 10,
            sell: 250,
            profit: 100,
            timestamp: new Date('2026-01-06T10:00:00Z').getTime(),
        }),
    ];

    const report = buildClientPdfReport({
        clientId: client.id,
        month: 0,
        year: 2026,
        monthLabel: 'Janvier',
        clients: [client],
        clientTransactions,
        transactions,
        clientBalance: 500,
        getClientName: noopGetClientName,
    });

    assert.ok(report, 'client report must render');
    assert.ok(report!.html.includes('Releve client'), 'client report must use client-facing title');
    assert.ok(report!.html.includes('Synthese du releve'), 'client report must render statement summary');
    assert.ok(report!.html.includes('Total recu'), 'client report must render total received');
    assert.ok(report!.html.includes('Total paye'), 'client report must render total paid');
    assert.ok(report!.html.includes('Solde actuel'), 'client report must render current balance');
    assert.ok(report!.html.includes('Operations de la periode'), 'client report must render simplified operation table');
    assert.equal(report!.html.includes('Profit realise'), false, 'client-facing report must not expose profit');
    assert.equal(report!.html.includes('PAM'), false, 'client-facing report must not expose PAM/accounting internals');
});

// =============================================================
// T-E-017: monthlyPdfReport renders executive summary before detail tables
// =============================================================

test('T-E-017: monthlyPdfReport_rendersExecutiveSummaryAndShortDetails', () => {
    const transactions: Tx[] = [
        tx({
            id: 'buy-1',
            type: 'buy',
            quantity: 100,
            price: 240,
            total: 24000,
            timestamp: new Date('2026-01-02T10:00:00Z').getTime(),
        }),
        tx({
            id: 'sell-1',
            type: 'sell',
            quantity: 50,
            sell: 250,
            timestamp: new Date('2026-01-03T10:00:00Z').getTime(),
        }),
    ];
    const client: ClientDzd = { id: 'client-1', fullName: 'Client Example' } as ClientDzd;
    const clientTransactions: ClientTransactionDzd[] = [
        {
            id: 'client-sale',
            clientId: client.id,
            linkedTxId: 'sell-1',
            timestamp: new Date('2026-01-03T10:00:00Z').getTime(),
            date: '03/01/2026',
            time: '10:00',
            montant: -12500,
            type: 'Vente USDT',
        },
    ];
    const pamLedger = computePamLedger(transactions);
    const report = buildMonthlyPdfReport({
        month: 0,
        year: 2026,
        monthLabel: 'Janvier',
        transactions,
        clientTransactions,
        clients: [client],
        getClientName: noopGetClientName,
        portfolioStats: {
            usdt: { available: 50, avgBuy: 240, totalProfit: 500 },
            eur: { available: 0, avgBuy: 0, totalProfit: 0 },
        },
        pamLedger,
    });

    assert.ok(report.html.includes('Synthese executive'), 'monthly report must start with executive summary');
    assert.ok(report.html.includes('Top client profit'), 'monthly report must render top client signal');
    assert.ok(report.html.includes('Details operations portefeuille'), 'monthly report must render compact portfolio details');
    assert.ok(report.html.includes('Mouvements clients DZD'), 'monthly report must render compact client movements');
    assert.equal(report.html.includes('Journal Complet Transactions Portefeuille'), false, 'monthly report must not use old full journal title');
    assert.ok(report.html.includes('500,00'), 'monthly report must still render derived PAM profit');
});

// =============================================================
// DEFERRED (require React testing library):
//   T-E-007: useAnalyticsViewModel_realizedProfit_excludesTxProfit
//   T-E-008: useAnalyticsViewModel_heatmap_aggregatesByDayUsingDerivedProfit
//   T-E-009: monthlyClientRanking_pdfVsAnalytics_consistencyAfterFix
//   T-E-011: simSellResult_usesCurrentPamForSimulation
//   T-E-012: linkedClientResolution_primaryWinsOverSecondary
//
// These tests require running React hooks. The project does not have @testing-library/react
// or any React test renderer installed. Adding such infrastructure is OUT OF SCOPE for the
// audit. As a partial alternative, T-E-007 is partially covered by static check below.
// =============================================================

test('T-E-007 (PARTIAL/STATIC): useAnalyticsViewModel.ts uses derivedProfit, never tx.profit fallback', () => {
    const source = readFileSync(join(projectRoot, 'src/components/analytics/useAnalyticsViewModel.ts'), 'utf8');
    // Must use pamLedger.profitByTxId
    assert.ok(
        source.includes('pamLedger.profitByTxId'),
        'useAnalyticsViewModel must reference pamLedger.profitByTxId',
    );
    // Must NOT reference tx.profit on the right-hand side of += or = (i.e., as a value source)
    // We do a coarse check: no occurrence of "tx.profit" in the file at all.
    assert.equal(
        source.includes('tx.profit'),
        false,
        'useAnalyticsViewModel must not reference tx.profit as a profit source',
    );
});

console.log('\n✅ Section E regression tests: all assertions completed.');
console.log('Deferred tests (T-E-008, T-E-009, T-E-011, T-E-012): require React testing library.');
