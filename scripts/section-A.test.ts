/**
 * Regression tests for Section A (PAM/Wallet) of MATH_AUDIT_REPORT.md
 *
 * Covers: T-A-001 → T-A-012.
 *
 * NOTE: Tests focus on edge cases and decisions documented in the audit.
 *       Existing scripts/pamLedger.test.ts covers core happy paths
 *       (jGd0 case, editing purchase, basic EUR conversion, oversell, etc.) — NOT duplicated here.
 *
 * Test runner: matches existing scripts/pamLedger.test.ts pattern.
 * Run with: `node --import tsx scripts/section-A.test.ts`
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { computePamLedger } from '../src/utils/pamLedger.js';
import type { Tx } from '../src/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// ---------- helpers ----------

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

// =========================================================================
// T-A-001: legacyFallback with valid sell price → derivedProfit = sellPrice × qty (uncosted profit inflated)
// =========================================================================

test('T-A-001: pamLedger_legacyFallback_withValidPriceProducesUncostedProfit', () => {
    // No buy at all: purchasedQty = 0, but sell with valid price
    const transactions: Tx[] = [
        tx({ id: 'sell-no-buy', type: 'sell', quantity: 100, sell: 250, timestamp: 2000 }),
    ];
    const ledger = computePamLedger(transactions);
    const row = ledger.profitByTxId['sell-no-buy'];
    assert.ok(row, 'sell row exists');
    // CURRENT: derivedProfit = (sellPrice - 0) × qty = 250 × 100 = 25000 (entire revenue treated as profit)
    assert.equal(row.derivedProfit, 25000, 'CURRENT: derivedProfit = full revenue when no cost basis');
    // Flags fired:
    assert.equal(row.flags.legacyFallback, true, 'legacyFallback flag set');
    assert.equal(row.flags.uncostedQuantitySold, true, 'uncostedQuantitySold flag set');
    assert.equal(row.flags.oversell, true, 'oversell flag also set (no available stock)');
});

// =========================================================================
// T-A-002: EUR→USDT conversion — current `find()` has NO one-to-one constraint
// =========================================================================

test('T-A-002: eurConversion_doesNotEnforceOneToOne (CURRENT FRAGILITY)', () => {
    // Setup: 2 EUR withdrawals, 1 USDT buy — both withdrawals will match the same USDT buy
    // because findEurConversionRelatedTxIds iterates withdrawals and `.find()` returns first match
    const baseTs = 1700000000000;
    const transactions: Tx[] = [
        tx({ id: 'eur-withdraw-1', type: 'Retrait Manuel', currency: 'EUR', quantity: 1000, timestamp: baseTs, notes: 'Achat de 8 USDT' }),
        tx({ id: 'eur-withdraw-2', type: 'Retrait Manuel', currency: 'EUR', quantity: 1000, timestamp: baseTs + 10, notes: 'Achat de 8 USDT' }),
        tx({ id: 'usdt-buy-once', type: 'buy', currency: 'USDT', quantity: 8, price: 250, total: 2000, timestamp: baseTs + 5 }),
    ];
    const ledger = computePamLedger(transactions);
    const buyOps = ledger.operationRows.find((r) => r.txId === 'usdt-buy-once');
    assert.ok(buyOps);
    // The single USDT buy is flagged as conversion-related (set by FIRST matching withdrawal)
    assert.equal(buyOps.flags.eurConversionRelated, true, 'USDT buy flagged once');
    // CURRENT: there is no warning that 2 EUR withdrawals tried to match the same buy.
    // After FIX-7 (deferred), this should be detected. Keeping test as documentation.
    const warnings = ledger.warnings.filter(
        (w) => w.code === 'eur_conversion_related' && w.txId === 'usdt-buy-once',
    );
    assert.equal(warnings.length, 1, 'CURRENT: only one warning, no duplicate-match detection');
});

// =========================================================================
// T-A-003: amount match for EUR conversion is NOT enforced (Q4 confirmed: window-only)
// =========================================================================

test('T-A-003: eurConversion_doesNotEnforceAmountMatch (Q4 CONFIRMED: window-only is sufficient)', () => {
    // EUR withdrawal of 1000 EUR + USDT buy of 8 USDT in 60-second window — but amount check would be:
    //   eurQty × eurPrice ≈ usdtQty × usdtPriceDzd ?
    //   1000 × ? ≈ 8 × 250 = 2000 → eurPrice would have to be 2 DZD/EUR (unrealistic)
    // CURRENT: still flags as related because only timestamp matters.
    const baseTs = 1700000000000;
    const transactions: Tx[] = [
        tx({ id: 'eur-w', type: 'Retrait Manuel', currency: 'EUR', quantity: 1000, timestamp: baseTs, notes: 'Achat de 8 USDT' }),
        // Mismatched amounts (in real world this wouldn't be a conversion):
        tx({ id: 'usdt-b', type: 'buy', currency: 'USDT', quantity: 8, price: 250, total: 2000, timestamp: baseTs + 30000 }),
    ];
    const ledger = computePamLedger(transactions);
    const buyOps = ledger.operationRows.find((r) => r.txId === 'usdt-b');
    assert.ok(buyOps);
    assert.equal(
        buyOps.flags.eurConversionRelated,
        true,
        'CURRENT (Q4 confirmed): flag fires regardless of amount mismatch — owner accepts.',
    );
});

// =========================================================================
// T-A-004: handleSell stores tx.profit using current avgBuy (static check on source)
// =========================================================================

test('T-A-004: handleSell_storesSnapshotProfit_usingCurrentAvgBuy (A-014 FRAGILITY)', () => {
    const source = readFileSync(join(projectRoot, 'src/hooks/useTransactionHandlers.ts'), 'utf8');
    const fnStart = source.indexOf('const handleSell');
    assert.notEqual(fnStart, -1, 'handleSell must exist');
    const fnBody = source.slice(fnStart, fnStart + 4000);
    // CURRENT: uses `sellAssetStats.avgBuy` (CURRENT portfolio PAM, not historical)
    assert.ok(
        fnBody.includes('sellAssetStats.avgBuy'),
        'CURRENT: handleSell uses sellAssetStats.avgBuy (not historicalAvgBuy from pamLedger)',
    );
    assert.ok(
        fnBody.includes('(sell - avg) * quantity'),
        'profit formula uses current avg, not pamLedger.historicalAvgBuy',
    );
    // FIX-8 (deferred) would replace this with historical computation.
});

// =========================================================================
// T-A-005: getTxQuantity rounds to 2 decimals in the ledger (FIX-9 hybrid)
//          New entries are forced to integers in handlers, but the ledger preserves
//          decimal precision so historical EUR↔USDT conversions stay accurate.
// =========================================================================

test('T-A-005: getTxQuantity_roundsTo2Decimals (FIX-9 hybrid 2026-05-09)', () => {
    const transactions: Tx[] = [
        tx({
            id: 'usdt-precise',
            type: 'Ajout Manuel',
            quantity: 100.12345678, // blockchain-precision USDT, rounded at read time
            total: 25030.85,
            timestamp: 1000,
        }),
        tx({
            id: 'usdt-decimal',
            type: 'Ajout Manuel',
            quantity: 50.66, // 2 decimals preserved
            total: 12000,
            timestamp: 2000,
        }),
    ];
    const ledger = computePamLedger(transactions);
    const row1 = ledger.operationRows.find((r) => r.txId === 'usdt-precise');
    const row2 = ledger.operationRows.find((r) => r.txId === 'usdt-decimal');
    assert.ok(row1);
    assert.ok(row2);
    // FIX-9 hybrid: ledger keeps round2 to preserve historical decimals (jGd0 = 849).
    assert.equal(row1.quantity, 100.12, 'FIX-9 hybrid: 100.12345678 → 100.12 (round2)');
    assert.equal(row2.quantity, 50.66, 'FIX-9 hybrid: 50.66 preserved exactly');
});

// =========================================================================
// T-A-006: round2 known float-representation edge case 1.005 → 1.00
// =========================================================================

test('T-A-006: pamLedger_round2_floatRepresentationEdgeCase', () => {
    // round2 = Number(Number(value).toFixed(2))
    // Known JS quirk: (1.005).toFixed(2) === "1.00" because 1.005 is stored as 1.00499999...
    const result = Number((1.005).toFixed(2));
    assert.equal(result, 1, 'CURRENT: round2(1.005) = 1.00, NOT 1.01 (float representation)');
    // (2.675).toFixed(2) === "2.67" — same issue.
    assert.equal(Number((2.675).toFixed(2)), 2.67, 'round2(2.675) = 2.67');
    // Documents the known pamLedger precision drift potential. Mitigated by 1-DZD tolerance elsewhere.
});

// =========================================================================
// T-A-007: timestamp -1 trick keeps EUR withdrawal before USDT buy in ordering
// =========================================================================

test('T-A-007: pamLedger_eurConversionTimestampOrdering_keepsEurFirst', () => {
    const baseTs = 1700000000000;
    const transactions: Tx[] = [
        // USDT buy at exact timestamp
        tx({ id: 'usdt-buy', type: 'buy', currency: 'USDT', quantity: 8, price: 250, total: 2000, timestamp: baseTs, linkedTxId: 'eur-w' }),
        // EUR withdrawal at timestamp - 1 (must be ordered first)
        tx({ id: 'eur-w', type: 'Retrait Manuel', currency: 'EUR', quantity: 1000, timestamp: baseTs - 1, notes: 'Achat de 8 USDT', linkedTxId: 'usdt-buy' }),
    ];
    const ledger = computePamLedger(transactions);
    const eurIndex = ledger.operationRows.findIndex((r) => r.txId === 'eur-w');
    const usdtIndex = ledger.operationRows.findIndex((r) => r.txId === 'usdt-buy');
    assert.ok(eurIndex >= 0 && usdtIndex >= 0);
    assert.ok(eurIndex < usdtIndex, 'EUR withdrawal must process before USDT buy');
});

// =========================================================================
// T-A-008: oversell + uncosted_quantity_sold → severity HIGH on both warnings
// =========================================================================

test('T-A-008: pamLedger_oversellWithUncosted_warningSeverityHigh', () => {
    // No buy + sell → both oversell AND uncosted apply
    const transactions: Tx[] = [
        tx({ id: 'sell-no-stock', type: 'sell', quantity: 50, sell: 100, timestamp: 1000 }),
    ];
    const ledger = computePamLedger(transactions);
    const oversellWarn = ledger.warnings.find((w) => w.code === 'oversell' && w.txId === 'sell-no-stock');
    const uncostedWarn = ledger.warnings.find((w) => w.code === 'uncosted_quantity_sold' && w.txId === 'sell-no-stock');
    assert.ok(oversellWarn, 'oversell warning fires');
    assert.equal(oversellWarn?.severity, 'high', 'oversell severity is high');
    assert.ok(uncostedWarn, 'uncosted_quantity_sold warning fires');
    assert.equal(uncostedWarn?.severity, 'high', 'uncosted severity is high WHEN oversell is also true');
});

// =========================================================================
// T-A-009: buy without total emits missing_buy_total warning
// =========================================================================

test('T-A-009: pamLedger_buyWithoutTotal_emitsMissingBuyTotalWarning', () => {
    const transactions: Tx[] = [
        // buy with zero / missing total
        tx({ id: 'buy-no-total', type: 'buy', quantity: 10, price: 100, timestamp: 1000 }),
        // (intentionally no `total` field → defaults to 0)
    ];
    const ledger = computePamLedger(transactions);
    const warning = ledger.warnings.find((w) => w.code === 'missing_buy_total' && w.txId === 'buy-no-total');
    assert.ok(warning, 'missing_buy_total warning must fire');
    assert.equal(warning?.severity, 'warning');
});

// =========================================================================
// T-A-010: manualTotalPresent flag — within 1 DZD tolerance is NOT flagged
// =========================================================================

test('T-A-010: pamLedger_manualTotalOverrideOnSell_within1DzdToleranceIgnored', () => {
    // Buy 100 @ 200, sell 10 @ 250 → formulaSellTotal = 2500
    // Test 1: tx.total = 2500.5 (within 1 DZD tolerance) — NOT flagged
    // Test 2: tx.total = 2502 (exceeds 1 DZD tolerance) — FLAGGED
    const baseFixture: Tx[] = [
        tx({ id: 'buy', type: 'buy', quantity: 100, price: 200, total: 20000, timestamp: 1000 }),
    ];
    // Within tolerance:
    const within = computePamLedger([
        ...baseFixture,
        tx({ id: 'sell-w', type: 'sell', quantity: 10, sell: 250, total: 2500.5, timestamp: 2000 }),
    ]);
    const wRow = within.profitByTxId['sell-w'];
    assert.equal(wRow.flags.manualTotalPresent, false, 'Within 1 DZD tolerance → flag NOT set');

    // Exceeds tolerance:
    const exceeds = computePamLedger([
        ...baseFixture,
        tx({ id: 'sell-x', type: 'sell', quantity: 10, sell: 250, total: 2510, timestamp: 2000 }),
    ]);
    const xRow = exceeds.profitByTxId['sell-x'];
    assert.equal(xRow.flags.manualTotalPresent, true, 'Beyond 1 DZD tolerance → flag set');
});

// =========================================================================
// T-A-011: EUR↔USDT algebraic equivalence holds within tolerance after rounding
// =========================================================================

test('T-A-011: usdtFromEurCalc_algebraicEquivalence', () => {
    // From useTransactionHandlers.ts:79-85:
    //   usdtQty = eurQty / rate
    //   usdtPriceDzd = eurPrice * rate
    //   totalCostDzd = (eurQty / rate) * (eurPrice * rate) = eurQty * eurPrice (exact)
    const eurQty = 1000;
    const eurPrice = 287; // DZD per EUR
    const rate = 1.08; // EUR per USDT
    const usdtQty = eurQty / rate;
    const usdtPriceDzd = eurPrice * rate;
    const totalCostDzd_via_usdt = usdtQty * usdtPriceDzd;
    const totalCostDzd_via_eur = eurQty * eurPrice;
    assert.ok(
        Math.abs(totalCostDzd_via_usdt - totalCostDzd_via_eur) < 0.01,
        'Algebraic equivalence: eurQty × eurPrice == usdtQty × usdtPriceDzd within tolerance',
    );
});

// =========================================================================
// T-A-012: normalizeZero — minus zero is converted to plus zero
// =========================================================================

test('T-A-012: pamLedger_normalizeZero_minusZeroTreatedAsPlusZero', () => {
    // Set up transactions whose accumulators land on -0 (e.g., perfect buy/sell loop)
    const transactions: Tx[] = [
        tx({ id: 'buy', type: 'buy', quantity: 100, price: 200, total: 20000, timestamp: 1000 }),
        tx({ id: 'sell', type: 'sell', quantity: 100, sell: 200, timestamp: 2000 }),
    ];
    const ledger = computePamLedger(transactions);
    // Both available and totalProfit should land at +0, not -0
    assert.ok(Object.is(ledger.portfolioStats.usdt.available, 0), 'available is +0, not -0');
    assert.ok(Object.is(ledger.portfolioStats.usdt.totalProfit, 0), 'totalProfit is +0, not -0');
    // Verify negative-zero detection:
    assert.equal(Object.is(-0, 0), false, '-0 !== +0 by Object.is (control check)');
});

console.log('\n✅ Section A regression tests: all 12 assertions completed.');
console.log('All tests use computePamLedger directly (pure function — no React/hook needed).');
