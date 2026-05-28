/**
 * Regression tests for Section D (Investors & Profit Distribution) of MATH_AUDIT_REPORT.md
 *
 * Covers: T-D-001 → T-D-019 (all feasible as pure-function tests).
 *
 * Function under test: `deriveInvestorEconomics` from src/hooks/useInvestorEconomics.ts
 * (exported pure function — does not require React testing library).
 *
 * Test runner: matches existing scripts/investorEconomics.pamLedger.test.ts pattern.
 * Run with TypeScript loader (e.g., `node --import tsx scripts/section-D.test.ts`).
 */

import assert from 'node:assert/strict';

import { deriveInvestorEconomics } from '../src/hooks/useInvestorEconomics.js';
import type { Investor, InvestorTransaction, Tx } from '../src/types';

// ---------- helpers (matching existing pattern) ----------

function tx(input: Partial<Tx> & Pick<Tx, 'id' | 'type' | 'quantity' | 'timestamp'>): Tx {
    return {
        date: '01/01/2026',
        time: '10:00',
        currency: 'USDT',
        ...input,
    } as Tx;
}

function investor(input: Partial<Investor> & Pick<Investor, 'id'>): Investor {
    const capital = input.initialCapital ?? input.capitalInvested ?? 0;
    return {
        name: input.id,
        entryDate: new Date(0).toISOString(),
        capitalInvested: capital,
        initialCapital: capital,
        sharePercentage: 0,
        totalProfit: 0,
        withdrawnProfit: 0,
        availableProfit: 0,
        isActive: true,
        ...input,
    } as Investor;
}

function investorTx(input: Partial<InvestorTransaction> & Pick<InvestorTransaction, 'id' | 'investorId' | 'type' | 'amount' | 'timestamp'>): InvestorTransaction {
    return {
        date: '01/01/2026',
        time: '10:00',
        notes: '',
        ...input,
    } as InvestorTransaction;
}

function assertMoney(actual: number, expected: number, message?: string): void {
    assert.equal(actual, expected, message);
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

/**
 * Builds a simple buy+sell pair that produces a derived profit.
 * Buy 100 @ 200 (timestamp = 1000), sell 100 @ 250 (timestamp = sellTs).
 * derivedProfit = (250 - 200) × 100 = 5000.
 */
function buildBuySellFixture(sellTs: number = 2000, sellPrice: number = 250): Tx[] {
    return [
        tx({ id: 'buy-1', type: 'buy', quantity: 100, price: 200, total: 20000, timestamp: 1000 }),
        tx({ id: 'sell-1', type: 'sell', quantity: 100, sell: sellPrice, timestamp: sellTs }),
    ];
}

// =============================================================
// T-D-001: capitalAtTs returns 0 when all movements happen after the sell timestamp
// =============================================================

test('T-D-001: capitalAtTs_returnsZeroWhenAllMovementsAfterTs', () => {
    const inv = investor({ id: 'inv-a', entryDate: new Date(500).toISOString(), initialCapital: 100000 });
    const movements: InvestorTransaction[] = [
        investorTx({ id: 'mv-1', investorId: 'inv-a', type: 'deposit_capital', amount: 50000, timestamp: 5000 }), // AFTER sell at 2000
    ];
    const result = deriveInvestorEconomics({
        investors: [inv],
        investorTransactions: movements,
        transactions: buildBuySellFixture(2000),
        managerFeePercentage: '0',
    });
    // Investor has movements but none before sellTs=2000 → capitalAtTs=0 → not eligible → unallocated
    assertMoney(result.derivedInvestors[0].totalProfit, 0, 'Investor with no movement before sell must get 0 profit');
    assertMoney(result.totals.unallocatedProfit, 5000, 'Profit goes to unallocated when no eligible investor at sale');
    // Q9 final: pre-investor profit stays suspended; not routed to manager share.
    assertMoney(result.totals.managerShare, 0, 'Pre-investor profit stays suspended (not assigned to manager)');
    assertMoney(result.totals.investorShare, 0);
    assertMoney(result.totals.reconciliationDifference, 0, 'Recon = derivedProfit - manager - investor - unallocated = 0');
});

// =============================================================
// T-D-002: capitalAtTs returns initialCapital when investor has zero movements
// =============================================================

test('T-D-002: capitalAtTs_returnsInitialCapitalWhenNoMovements', () => {
    const inv = investor({ id: 'inv-a', entryDate: new Date(500).toISOString(), initialCapital: 100000 });
    const result = deriveInvestorEconomics({
        investors: [inv],
        investorTransactions: [], // no movements
        transactions: buildBuySellFixture(2000),
        managerFeePercentage: '0',
    });
    // Investor entered before sellTs and has no movements → uses initialCapital → eligible → gets full profit
    assertMoney(result.derivedInvestors[0].totalProfit, 5000, 'Investor with no movements falls back to initialCapital');
});

// =============================================================
// T-D-003: reinvest_profit adds to capital (treated as +capital movement)
// =============================================================

test('T-D-003: capitalAtTs_reinvestProfitAddsToCapital', () => {
    const inv = investor({ id: 'inv-a', entryDate: new Date(500).toISOString(), initialCapital: 0 });
    const movements: InvestorTransaction[] = [
        investorTx({ id: 'mv-1', investorId: 'inv-a', type: 'deposit_capital', amount: 100000, timestamp: 600 }),
        investorTx({ id: 'mv-2', investorId: 'inv-a', type: 'reinvest_profit', amount: 50000, timestamp: 700 }),
    ];
    const result = deriveInvestorEconomics({
        investors: [inv],
        investorTransactions: movements,
        transactions: buildBuySellFixture(2000),
        managerFeePercentage: '0',
    });
    // capitalAtTs(2000) should be 150000 (deposit + reinvest), eligible, gets full profit
    assertMoney(result.derivedInvestors[0].totalProfit, 5000, 'Investor with deposit + reinvest must get full profit');
});

// =============================================================
// T-D-004: investor with entryDate AFTER sell timestamp gets no share
// =============================================================

test('T-D-004: eligibleInvestors_excludesEntryAfterSellTs', () => {
    const inv = investor({ id: 'inv-a', entryDate: new Date(3000).toISOString(), initialCapital: 100000 }); // AFTER sell at 2000
    const result = deriveInvestorEconomics({
        investors: [inv],
        investorTransactions: [],
        transactions: buildBuySellFixture(2000),
        managerFeePercentage: '0',
    });
    assertMoney(result.derivedInvestors[0].totalProfit, 0, 'Investor entering after sell must get 0');
    assertMoney(result.totals.unallocatedProfit, 5000, 'Profit goes to unallocated');
    // Q9 final: pre-entry profit stays suspended; not routed to manager share.
    assertMoney(result.totals.managerShare, 0, 'Pre-entry profit stays suspended (not assigned to manager)');
    assertMoney(result.totals.reconciliationDifference, 0);
});

// =============================================================
// T-D-005: distributeProportionally on negative total still sums exactly to total (no leak)
// =============================================================

test('T-D-005: distributeProportionally_negativeTotalSumsExactlyToTotal', () => {
    // Two investors, capitals 60000 / 40000, sell at -1000 DZD loss with 0% fee
    const investors: Investor[] = [
        investor({ id: 'inv-a', entryDate: new Date(0).toISOString(), initialCapital: 60000 }),
        investor({ id: 'inv-b', entryDate: new Date(0).toISOString(), initialCapital: 40000 }),
    ];
    // Build a loss scenario: buy 100 @ 200 (cost 20000), sell 100 @ 190 (revenue 19000) → loss -1000
    const transactions: Tx[] = [
        tx({ id: 'buy-1', type: 'buy', quantity: 100, price: 200, total: 20000, timestamp: 1000 }),
        tx({ id: 'sell-1', type: 'sell', quantity: 100, sell: 190, timestamp: 2000 }),
    ];
    const result = deriveInvestorEconomics({
        investors,
        investorTransactions: [],
        transactions,
        managerFeePercentage: '0',
    });
    // With 0% fee, all -1000 goes to investors split 60/40 → -600 / -400
    assertMoney(result.derivedInvestors[0].totalProfit, -600, 'Investor A bears 60% of -1000 loss');
    assertMoney(result.derivedInvestors[1].totalProfit, -400, 'Investor B bears 40% of -1000 loss');
    // Sum must equal exactly -1000 (largest-remainder method)
    assertMoney(
        result.derivedInvestors[0].totalProfit + result.derivedInvestors[1].totalProfit,
        -1000,
        'Shares must sum exactly to -1000',
    );
});

// =============================================================
// T-D-006: Q1 final decision: manager fee applies on loss too (current behavior, confirmed)
// On -1000 loss with 20% fee: investors bear -800, manager bears -200.
// =============================================================

test('T-D-006: managerFee_onLossOfMinusThousandAt20Percent_managerBears200', () => {
    const inv = investor({ id: 'inv-a', entryDate: new Date(0).toISOString(), initialCapital: 100000 });
    const transactions: Tx[] = [
        tx({ id: 'buy-1', type: 'buy', quantity: 100, price: 200, total: 20000, timestamp: 1000 }),
        tx({ id: 'sell-1', type: 'sell', quantity: 100, sell: 190, timestamp: 2000 }),
    ];
    const result = deriveInvestorEconomics({
        investors: [inv],
        investorTransactions: [],
        transactions,
        managerFeePercentage: '20',
    });
    // Q1 confirmed: investorPool = -1000 × 0.8 = -800; managerShare = -1000 - (-800) = -200
    assertMoney(result.derivedInvestors[0].totalProfit, -800, 'Investor bears -800 (80% of loss)');
    assertMoney(result.totals.managerShare, -200, 'Manager bears -200 (20% of loss)');
    assertMoney(result.totals.investorShare, -800);
    assertMoney(result.totals.derivedProfit, -1000);
});

// =============================================================
// T-D-007: unallocatedProfit accumulates pre-investor sells and stays suspended (Q9 final)
// =============================================================

test('T-D-007: unallocatedProfit_accumulatesPreInvestorSells_andStaysSuspended', () => {
    const inv = investor({ id: 'inv-a', entryDate: new Date(5000).toISOString(), initialCapital: 100000 });
    const result = deriveInvestorEconomics({
        investors: [inv],
        investorTransactions: [],
        transactions: buildBuySellFixture(2000), // sell at 2000, BEFORE investor entry at 5000
        managerFeePercentage: '0',
    });
    assertMoney(result.totals.unallocatedProfit, 5000, 'Sell before investor entry → unallocated');
    assertMoney(result.totals.investorShare, 0);
    // Q9 final: pre-investor profit stays suspended only, NOT routed to manager.
    assertMoney(result.totals.managerShare, 0, 'Pre-investor profit is suspended (not in manager share)');
    assertMoney(result.totals.reconciliationDifference, 0, 'Recon = derived - manager - investor - unallocated = 0');
});

// =============================================================
// T-D-008: unallocatedProfit does NOT redistribute after investor joins; stays suspended (Q9 final)
// =============================================================

test('T-D-008: unallocatedProfit_doesNotRedistributeAfterInvestorJoins_staysSuspended', () => {
    const inv = investor({ id: 'inv-a', entryDate: new Date(5000).toISOString(), initialCapital: 100000 });
    // Two sells: one before investor entry (unallocated), one after (allocated)
    const transactions: Tx[] = [
        tx({ id: 'buy-1', type: 'buy', quantity: 200, price: 200, total: 40000, timestamp: 1000 }),
        tx({ id: 'sell-1', type: 'sell', quantity: 100, sell: 250, timestamp: 2000 }), // before entry → unallocated 5000
        tx({ id: 'sell-2', type: 'sell', quantity: 100, sell: 260, timestamp: 6000 }), // after entry → 6000 to investor
    ];
    const result = deriveInvestorEconomics({
        investors: [inv],
        investorTransactions: [],
        transactions,
        managerFeePercentage: '0',
    });
    // Investor gets only the post-entry profit, NOT the unallocated one
    assertMoney(result.derivedInvestors[0].totalProfit, 6000, 'Investor gets only post-entry profit');
    assertMoney(result.totals.unallocatedProfit, 5000, 'Pre-entry profit stays unallocated');
    // Q9 final: pre-entry profit is suspended (NOT in manager share); manager has 0 since fee=0 on post-entry sell.
    assertMoney(result.totals.managerShare, 0, 'Manager share = 0 (fee=0 on post-entry sell; pre-entry profit suspended)');
    assertMoney(result.totals.investorShare, 6000);
    assertMoney(result.totals.derivedProfit, 11000, 'Total derived profit includes allocated and unallocated rows');
    assertMoney(result.totals.reconciliationDifference, 0, 'Recon = 11000 - 0 - 6000 - 5000 = 0');
});

// =============================================================
// T-D-009: availableProfit = totalProfit - withdrawnProfit - reinvestedProfit
// =============================================================

test('T-D-009: availableProfit_subtractsBothWithdrawnAndReinvested', () => {
    const inv = investor({ id: 'inv-a', entryDate: new Date(0).toISOString(), initialCapital: 100000 });
    const movements: InvestorTransaction[] = [
        investorTx({ id: 'mv-d', investorId: 'inv-a', type: 'deposit_capital', amount: 100000, timestamp: 500 }),
        investorTx({ id: 'mv-w', investorId: 'inv-a', type: 'withdraw_profit', amount: 1000, timestamp: 3000 }),
        investorTx({ id: 'mv-r', investorId: 'inv-a', type: 'reinvest_profit', amount: 500, timestamp: 4000 }),
    ];
    const result = deriveInvestorEconomics({
        investors: [inv],
        investorTransactions: movements,
        transactions: buildBuySellFixture(2000), // 5000 profit
        managerFeePercentage: '0',
    });
    // totalProfit = 5000, withdrawn=1000, reinvested=500 → available = 5000 - 1000 - 500 = 3500
    assertMoney(result.derivedInvestors[0].totalProfit, 5000);
    assertMoney(result.derivedInvestors[0].availableProfit, 3500, 'availableProfit = total - withdrawn - reinvested');
});

// =============================================================
// T-D-010: availableProfitNegative warning triggers at threshold -0.01
// =============================================================

test('T-D-010: availableProfitNegative_warningTriggersAtMinus0_01', () => {
    const inv = investor({ id: 'inv-a', entryDate: new Date(0).toISOString(), initialCapital: 100000 });
    // Withdraw more than the profit → availableProfit becomes negative
    const movements: InvestorTransaction[] = [
        investorTx({ id: 'mv-w', investorId: 'inv-a', type: 'withdraw_profit', amount: 6000, timestamp: 3000 }),
    ];
    const result = deriveInvestorEconomics({
        investors: [inv],
        investorTransactions: movements,
        transactions: buildBuySellFixture(2000), // 5000 profit
        managerFeePercentage: '0',
    });
    // availableProfit = 5000 - 6000 = -1000 < -0.01 → warning fires
    const warning = result.warnings.find((w) => w.code === 'available_profit_negative' && w.investorId === 'inv-a');
    assert.ok(warning, 'available_profit_negative warning must fire when availableProfit < -0.01');
    assert.equal(warning?.severity, 'high');
});

// =============================================================
// T-D-011: withdrawalsExceedDerivedProfit warning triggers when withdrawals > totalProfit + 0.01
// =============================================================

test('T-D-011: withdrawalsExceedDerivedProfit_warningTriggersAt0_01Above', () => {
    const inv = investor({ id: 'inv-a', entryDate: new Date(0).toISOString(), initialCapital: 100000 });
    const movements: InvestorTransaction[] = [
        investorTx({ id: 'mv-w', investorId: 'inv-a', type: 'withdraw_profit', amount: 6000, timestamp: 3000 }),
    ];
    const result = deriveInvestorEconomics({
        investors: [inv],
        investorTransactions: movements,
        transactions: buildBuySellFixture(2000), // 5000 profit
        managerFeePercentage: '0',
    });
    // withdrawn=6000 > totalProfit=5000 + 0.01 → warning fires
    const warning = result.warnings.find((w) => w.code === 'withdrawals_exceed_derived_profit' && w.investorId === 'inv-a');
    assert.ok(warning, 'withdrawals_exceed_derived_profit warning must fire');
    assert.equal(warning?.severity, 'high');
});

// =============================================================
// T-D-012: negativeDerivedProfit warning fires per eligible investor on a loss sell
// =============================================================

test('T-D-012: negativeDerivedProfit_warningPerEligibleInvestor', () => {
    const investors: Investor[] = [
        investor({ id: 'inv-a', entryDate: new Date(0).toISOString(), initialCapital: 60000 }),
        investor({ id: 'inv-b', entryDate: new Date(0).toISOString(), initialCapital: 40000 }),
    ];
    const transactions: Tx[] = [
        tx({ id: 'buy-1', type: 'buy', quantity: 100, price: 200, total: 20000, timestamp: 1000 }),
        tx({ id: 'sell-1', type: 'sell', quantity: 100, sell: 190, timestamp: 2000 }),
    ];
    const result = deriveInvestorEconomics({
        investors,
        investorTransactions: [],
        transactions,
        managerFeePercentage: '0',
    });
    // Both investors must get a negative_derived_profit warning
    const warningsA = result.warnings.filter((w) => w.code === 'negative_derived_profit' && w.investorId === 'inv-a');
    const warningsB = result.warnings.filter((w) => w.code === 'negative_derived_profit' && w.investorId === 'inv-b');
    assert.equal(warningsA.length, 1, 'investor A receives 1 negative_derived_profit warning');
    assert.equal(warningsB.length, 1, 'investor B receives 1 negative_derived_profit warning');
});

// =============================================================
// T-D-013: uncosted_quantity_sold severity is HIGH when oversell, WARNING otherwise
// =============================================================

test('T-D-013: uncostedQuantitySold_severityHighWhenOversell', () => {
    const inv = investor({ id: 'inv-a', entryDate: new Date(0).toISOString(), initialCapital: 100000 });
    // Buy 100 (costed), but sell 150 → quantityWithoutCostBasis=50, oversell=true → severity=high
    const transactions: Tx[] = [
        tx({ id: 'buy-1', type: 'buy', quantity: 100, price: 200, total: 20000, timestamp: 1000 }),
        tx({ id: 'sell-1', type: 'sell', quantity: 150, sell: 250, timestamp: 2000 }),
    ];
    const result = deriveInvestorEconomics({
        investors: [inv],
        investorTransactions: [],
        transactions,
        managerFeePercentage: '0',
    });
    const warning = result.warnings.find((w) => w.code === 'uncosted_quantity_sold' && w.investorId === 'inv-a');
    assert.ok(warning, 'uncosted_quantity_sold warning must fire');
    assert.equal(warning?.severity, 'high', 'severity must be high when oversell is true');
});

// =============================================================
// T-D-014: reconciliationDifference is always 0 after distribution (managerShare + investorShare = derivedProfit)
// =============================================================

test('T-D-014: reconciliationDifference_alwaysZeroAfterDistribution', () => {
    const investors: Investor[] = [
        investor({ id: 'inv-a', entryDate: new Date(0).toISOString(), initialCapital: 60000 }),
        investor({ id: 'inv-b', entryDate: new Date(0).toISOString(), initialCapital: 40000 }),
    ];
    const result = deriveInvestorEconomics({
        investors,
        investorTransactions: [],
        transactions: buildBuySellFixture(2000), // 5000 profit
        managerFeePercentage: '15',
    });
    // managerShare = 750, investorShare = 4250, derivedProfit = 5000 → diff = 0
    assertMoney(result.totals.reconciliationDifference, 0, 'reconciliationDifference must be 0');
});

// =============================================================
// T-D-015: invalid entryDate is excluded until corrected
// =============================================================

test('T-D-015: toMs_invalidEntryDateIsExcludedUntilCorrected', () => {
    // Investor with garbage entryDate → entryTs is pushed safely into the future → not eligible
    const inv = investor({ id: 'inv-a', entryDate: 'NOT-A-VALID-DATE' as any, initialCapital: 100000 });
    const result = deriveInvestorEconomics({
        investors: [inv],
        investorTransactions: [],
        transactions: buildBuySellFixture(2000),
        managerFeePercentage: '0',
    });
    assertMoney(result.derivedInvestors[0].totalProfit, 0, 'Investor with invalid date is excluded from historical profit');
    // Q9 final: excluded-investor profit stays suspended (not assigned to manager).
    assertMoney(result.totals.unallocatedProfit, 5000, 'Excluded-investor profit goes to unallocated');
    assertMoney(result.totals.managerShare, 0, 'Excluded-investor profit is NOT assigned to manager');
    assertMoney(result.totals.reconciliationDifference, 0);
});

// =============================================================
// T-D-016: investor with capital = 0 at sell is excluded
// =============================================================

test('T-D-016: eligibleInvestors_zeroCapitalIsExcluded', () => {
    const inv = investor({ id: 'inv-a', entryDate: new Date(0).toISOString(), initialCapital: 0 });
    const result = deriveInvestorEconomics({
        investors: [inv],
        investorTransactions: [],
        transactions: buildBuySellFixture(2000),
        managerFeePercentage: '0',
    });
    assertMoney(result.derivedInvestors[0].totalProfit, 0, 'Zero-capital investor gets nothing');
    assertMoney(result.totals.unallocatedProfit, 5000, 'Profit goes to unallocated');
});

// =============================================================
// T-D-017: negative capital (over-withdrawn) is clamped to 0 — no negative share
// =============================================================

test('T-D-017: eligibleInvestors_negativeCapitalClampedToZero', () => {
    const inv = investor({ id: 'inv-a', entryDate: new Date(500).toISOString(), initialCapital: 0 });
    const movements: InvestorTransaction[] = [
        investorTx({ id: 'mv-1', investorId: 'inv-a', type: 'deposit_capital', amount: 10000, timestamp: 600 }),
        investorTx({ id: 'mv-2', investorId: 'inv-a', type: 'withdraw_capital', amount: 50000, timestamp: 700 }),
    ];
    const result = deriveInvestorEconomics({
        investors: [inv],
        investorTransactions: movements,
        transactions: buildBuySellFixture(2000),
        managerFeePercentage: '0',
    });
    // capitalAtTs(2000) = 10000 - 50000 = -40000 → clamped to 0 → not eligible
    assertMoney(result.derivedInvestors[0].totalProfit, 0, 'Investor with negative capital gets nothing');
    assertMoney(result.totals.unallocatedProfit, 5000);
});

// =============================================================
// T-D-018: chronologicalSells includes zero-profit warning rows
// =============================================================

test('T-D-018: chronologicalSells_includesZeroProfitSellsWithUncostedFlag (POST FIX-3 / Q10)', () => {
    const inv = investor({ id: 'inv-a', entryDate: new Date(0).toISOString(), initialCapital: 100000 });
    // Build a sell where derivedProfit = 0 BUT uncostedQuantitySold flag is true
    // Buy 100 @ 200 then add 50 (qty-only), sell 150 @ 200 (avg buy = 200, sell = 200 → profit = 0,
    // but quantityWithoutCostBasis = 50)
    const transactions: Tx[] = [
        tx({ id: 'buy-1', type: 'buy', quantity: 100, price: 200, total: 20000, timestamp: 1000 }),
        tx({
            id: 'qty-only-add',
            type: 'Ajout Manuel',
            quantity: 50,
            timestamp: 1500,
        }),
        tx({ id: 'sell-zero-profit', type: 'sell', quantity: 150, sell: 200, timestamp: 2000 }),
    ];
    const result = deriveInvestorEconomics({
        investors: [inv],
        investorTransactions: [],
        transactions,
        managerFeePercentage: '0',
    });
    // POST FIX-3: zero-profit sells with uncosted flag are now PROCESSED → warning emitted.
    const uncostedWarnings = result.warnings.filter(
        (w) => w.code === 'uncosted_quantity_sold' && w.txId === 'sell-zero-profit',
    );
    assert.equal(
        uncostedWarnings.length,
        1,
        'POST FIX-3: zero-profit sell with uncostedQuantitySold flag must still emit warning to investor',
    );
    // Profit distribution at zero is still zero — no allocation impact
    assertMoney(result.derivedInvestors[0].totalProfit, 0, 'Zero-profit sell distributes 0');
    assertMoney(result.totals.reconciliationDifference, 0);
});

// =============================================================
// T-D-019: report period only includes profits and profit movements inside selected dates
// =============================================================

test('T-D-019: periodRange_reportsOnlySelectedProfitWindow', () => {
    const inv = investor({ id: 'inv-a', entryDate: new Date(0).toISOString(), initialCapital: 100000 });
    const transactions: Tx[] = [
        tx({ id: 'buy-1', type: 'buy', quantity: 300, price: 100, total: 30000, timestamp: 1000 }),
        tx({ id: 'sell-month-1', type: 'sell', quantity: 100, sell: 110, timestamp: 2000 }),
        tx({ id: 'sell-month-2', type: 'sell', quantity: 100, sell: 120, timestamp: 3000 }),
        tx({ id: 'sell-month-3', type: 'sell', quantity: 100, sell: 130, timestamp: 4000 }),
    ];
    const movements: InvestorTransaction[] = [
        investorTx({ id: 'withdraw-outside-period', investorId: 'inv-a', type: 'withdraw_profit', amount: 500, timestamp: 2200 }),
        investorTx({ id: 'withdraw-inside-period', investorId: 'inv-a', type: 'withdraw_profit', amount: 300, timestamp: 3200 }),
    ];
    const result = deriveInvestorEconomics({
        investors: [inv],
        investorTransactions: movements,
        transactions,
        managerFeePercentage: '0',
        periodStartTs: 2500,
        periodEndTs: 3500,
    });

    assertMoney(result.totals.derivedProfit, 2000, 'Only month-2 sell profit is included in period derived profit');
    assertMoney(result.totals.investorShare, 2000, 'Only month-2 investor share is included in period investor share');
    assertMoney(result.derivedInvestors[0].totalProfit, 2000, 'Investor report profit must only include selected period');
    assertMoney(result.derivedInvestors[0].availableProfit, 1700, 'Only withdrawals inside period reduce period available profit');
    assertMoney(result.totals.reconciliationDifference, 0);
});

console.log('\n✅ Section D regression tests: all 19 assertions completed.');
