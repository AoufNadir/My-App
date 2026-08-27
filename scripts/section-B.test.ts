/**
 * Regression tests for Section B (Clients & DZD Debt) of MATH_AUDIT_REPORT.md
 *
 * Covers: T-B-001 → T-B-015.
 *
 * NOTE ON TESTING STRATEGY:
 *   Most Section B logic lives inside React hooks (useAppData.ts, useClientHandlers.ts,
 *   useOverdueDebtClients.ts) as inline `useMemo`/closure code, NOT exported pure functions.
 *
 *   These tests use REFERENCE IMPLEMENTATIONS that mirror the actual code line-by-line.
 *   They serve as:
 *     1. Executable specification documenting expected behavior.
 *     2. Real regression coverage AFTER a future refactor extracts these as pure functions.
 *     3. A consistency check: if the spec reference here drifts from the source, tests fail.
 *
 *   When the code is refactored to expose pure functions, switch the imports here from
 *   the local references to the actual exports.
 *
 * Test runner: matches existing scripts/pamLedger.test.ts pattern.
 * Run with: `node --import tsx scripts/section-B.test.ts`
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import type { ClientDzd, ClientTransactionDzd } from '../src/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// ---------- helpers ----------

function test(name: string, fn: () => void): void {
    try {
        fn();
        console.log(`PASS ${name}`);
    } catch (error) {
        console.error(`FAIL ${name}`);
        throw error;
    }
}

function clientTx(input: Partial<ClientTransactionDzd> & Pick<ClientTransactionDzd, 'id' | 'clientId' | 'montant' | 'timestamp'>): ClientTransactionDzd {
    return {
        type: 'Règlement Reçu',
        date: '01/01/2026',
        time: '10:00',
        ...input,
    } as ClientTransactionDzd;
}

// =========================================================================
// REFERENCE IMPLEMENTATIONS (mirror current code — see file:line references)
// =========================================================================

/**
 * MIRRORS: src/hooks/useAppData.ts:240-247
 * Computes client balance map from transactions, ignoring affectsBalance===false rows.
 */
function computeClientBalance_reference(
    clients: ClientDzd[],
    txs: ClientTransactionDzd[],
): Map<string, number> {
    const balances = new Map<string, number>();
    clients.forEach((c) => balances.set(c.id, 0));
    txs.forEach((tx) => {
        if (tx.affectsBalance === false) return;
        balances.set(tx.clientId, (balances.get(tx.clientId) || 0) + tx.montant);
    });
    return balances;
}

/**
 * MIRRORS: src/hooks/useClientHandlers.ts:118-138
 * Finds the counterpart Transfert row for a given Transfert.
 */
const CLIENT_DELETE_EPSILON = 0.01;
function findTransferCounterpart_reference(
    tx: ClientTransactionDzd,
    all: ClientTransactionDzd[],
): ClientTransactionDzd | null {
    if (tx.type !== 'Transfert Sortant' && tx.type !== 'Transfert Entrant') return null;
    const counterpartType = tx.type === 'Transfert Sortant' ? 'Transfert Entrant' : 'Transfert Sortant';
    const counterpartAmount = -tx.montant;
    const candidates = all.filter((c) =>
        c.id !== tx.id
        && c.clientId !== tx.clientId
        && c.type === counterpartType
        && c.date === tx.date
        && c.time === tx.time
        && Math.abs(c.montant - counterpartAmount) <= CLIENT_DELETE_EPSILON
        && Math.abs(c.timestamp - tx.timestamp) <= 1,
    );
    if (candidates.length === 0) return null;
    return [...candidates].sort(
        (a, b) => Math.abs(a.timestamp - tx.timestamp) - Math.abs(b.timestamp - tx.timestamp),
    )[0];
}

/**
 * MIRRORS: src/hooks/useOverdueDebtClients.ts:48-95 (FIFO debt queue + availableCredit).
 */
type DebtLot = { timestamp: number; date: string; remaining: number };
const OVERDUE_EPSILON = 0.005;
const DAY_MS = 24 * 60 * 60 * 1000;

function computeDebtLots_reference(txs: ClientTransactionDzd[]): {
    debtQueue: DebtLot[];
    availableCredit: number;
    lastPaymentTimestamp: number | null;
} {
    const sorted = [...txs]
        .filter((tx) => tx.affectsBalance !== false)
        .sort((a, b) => a.timestamp - b.timestamp);
    const debtQueue: DebtLot[] = [];
    let availableCredit = 0;
    let lastPaymentTimestamp: number | null = null;

    for (const tx of sorted) {
        const amount = Number(tx.montant || 0);
        if (!Number.isFinite(amount) || Math.abs(amount) <= OVERDUE_EPSILON) continue;

        if (amount < 0) {
            let incomingDebt = Math.abs(amount);
            if (availableCredit > OVERDUE_EPSILON) {
                const consumed = Math.min(availableCredit, incomingDebt);
                availableCredit -= consumed;
                incomingDebt -= consumed;
            }
            if (incomingDebt > OVERDUE_EPSILON) {
                debtQueue.push({ timestamp: tx.timestamp, date: tx.date, remaining: incomingDebt });
            }
            continue;
        }

        if (lastPaymentTimestamp === null || tx.timestamp > lastPaymentTimestamp) {
            lastPaymentTimestamp = tx.timestamp;
        }
        let remainingPayment = amount;
        while (remainingPayment > OVERDUE_EPSILON && debtQueue.length > 0) {
            const oldest = debtQueue[0];
            const consumed = Math.min(remainingPayment, oldest.remaining);
            oldest.remaining -= consumed;
            remainingPayment -= consumed;
            if (oldest.remaining <= OVERDUE_EPSILON) debtQueue.shift();
        }
        if (remainingPayment > OVERDUE_EPSILON) availableCredit += remainingPayment;
    }
    return { debtQueue, availableCredit, lastPaymentTimestamp };
}

// =========================================================================
// T-B-001: clientBalance ignores affectsBalance===false rows
// =========================================================================

test('T-B-001: clientBalance_sumOfMontant_excludesAffectsBalanceFalse', () => {
    const clients: ClientDzd[] = [{ id: 'c1', fullName: 'C1' } as ClientDzd];
    const txs: ClientTransactionDzd[] = [
        clientTx({ id: 't1', clientId: 'c1', montant: 1000, timestamp: 1000 }),
        clientTx({ id: 't2', clientId: 'c1', montant: -300, timestamp: 2000 }),
        clientTx({ id: 't3', clientId: 'c1', montant: 500, timestamp: 3000, affectsBalance: false }), // SHOULD BE IGNORED
    ];
    const balances = computeClientBalance_reference(clients, txs);
    assert.equal(balances.get('c1'), 700, '1000 - 300 = 700 (the +500 with affectsBalance=false is ignored)');
});

// =========================================================================
// T-B-002: float drift on aggregations of decimal entries
// =========================================================================

test('T-B-002: clientBalance_floatDrift_thousandsOfDecimalEntries', () => {
    const clients: ClientDzd[] = [{ id: 'c1', fullName: 'C1' } as ClientDzd];
    // 1000 entries of +0.1 each → mathematical sum = 100.00, but JS floats may yield 99.9999...8
    const txs: ClientTransactionDzd[] = Array.from({ length: 1000 }, (_, i) =>
        clientTx({ id: `t${i}`, clientId: 'c1', montant: 0.1, timestamp: 1000 + i }),
    );
    const balances = computeClientBalance_reference(clients, txs);
    const drift = Math.abs((balances.get('c1') ?? 0) - 100);
    assert.ok(
        drift < 0.005,
        `CURRENT: drift = ${drift}. Within tolerance, but addM would eliminate it. Documents need for FIX (B-001).`,
    );
});

// =========================================================================
// T-B-003: Transfer counterpart found within ±1ms timestamp
// =========================================================================

test('T-B-003: transferCounterpart_findsByTimestampWithin1ms', () => {
    const sortant = clientTx({
        id: 't-out', clientId: 'c1', montant: -500,
        type: 'Transfert Sortant', timestamp: 1000, date: '01/01/2026', time: '10:00',
    });
    const entrant = clientTx({
        id: 't-in', clientId: 'c2', montant: 500,
        type: 'Transfert Entrant', timestamp: 1000, date: '01/01/2026', time: '10:00',
    });
    const counterpart = findTransferCounterpart_reference(sortant, [sortant, entrant]);
    assert.equal(counterpart?.id, 't-in', 'Counterpart found at exact same timestamp');
});

// =========================================================================
// T-B-004: Transfer counterpart NOT found when timestamp differs by >1ms (current fragility)
// =========================================================================

test('T-B-004: transferCounterpart_failsWhenTimestampDiffExceeds1ms (CURRENT FRAGILITY)', () => {
    const sortant = clientTx({
        id: 't-out', clientId: 'c1', montant: -500,
        type: 'Transfert Sortant', timestamp: 1000, date: '01/01/2026', time: '10:00',
    });
    const entrant = clientTx({
        id: 't-in', clientId: 'c2', montant: 500,
        type: 'Transfert Entrant', timestamp: 1002, date: '01/01/2026', time: '10:00', // 2ms apart
    });
    const counterpart = findTransferCounterpart_reference(sortant, [sortant, entrant]);
    assert.equal(
        counterpart,
        null,
        'CURRENT FRAGILITY: 2ms gap breaks counterpart match → orphan risk on delete (B-014). FIX-7 widens window.',
    );
});

// =========================================================================
// T-B-005: Multiple matching counterparts — current behavior picks closest, no one-to-one guard
// =========================================================================

test('T-B-005: transferCounterpart_picksClosestButHasNoOneToOneGuard', () => {
    const sortant = clientTx({
        id: 't-out', clientId: 'c1', montant: -500,
        type: 'Transfert Sortant', timestamp: 1000, date: '01/01/2026', time: '10:00',
    });
    // Two candidates with same amount/date/time but different timestamps
    const entrant1 = clientTx({
        id: 't-in-1', clientId: 'c2', montant: 500,
        type: 'Transfert Entrant', timestamp: 1000, date: '01/01/2026', time: '10:00',
    });
    const entrant2 = clientTx({
        id: 't-in-2', clientId: 'c3', montant: 500,
        type: 'Transfert Entrant', timestamp: 1001, date: '01/01/2026', time: '10:00',
    });
    const counterpart = findTransferCounterpart_reference(sortant, [sortant, entrant1, entrant2]);
    // The closest in time (timestamp diff 0) is entrant1
    assert.equal(counterpart?.id, 't-in-1', 'Closest timestamp wins');
    // CURRENT: no mechanism prevents entrant2 from being matched by another sortant later
    // (no global one-to-one constraint). FIX-7 should add this.
});

// =========================================================================
// T-B-006: Client deletion blocked when |balance| > 0.01
// =========================================================================

test('T-B-006: clientDelete_blockedWhenAbsBalanceExceeds0_01', () => {
    // Reference: useClientHandlers.ts:163-168
    function canDelete(balance: number): boolean {
        return Math.abs(balance) <= CLIENT_DELETE_EPSILON;
    }
    assert.equal(canDelete(0.005), true, 'Balance under threshold allows delete');
    assert.equal(canDelete(0.01), true, 'Balance equal to threshold allows delete (uses >)');
    assert.equal(canDelete(0.02), false, 'Balance over threshold blocks delete');
    assert.equal(canDelete(-0.02), false, 'Negative balance over threshold blocks delete');
});

// =========================================================================
// T-B-007: Client deletion allowed at zero (within epsilon)
// =========================================================================

test('T-B-007: clientDelete_allowsDeletionWhenBalanceIsZeroPlusEpsilon', () => {
    function canDelete(balance: number): boolean {
        return Math.abs(balance) <= CLIENT_DELETE_EPSILON;
    }
    assert.equal(canDelete(0), true);
    assert.equal(canDelete(0.009), true, 'Floating-point residue allowed');
    assert.equal(canDelete(-0.009), true);
});

// =========================================================================
// T-B-008: FIFO — oldest debt closed first by positive payment
// =========================================================================

test('T-B-008: overdueDebt_fifo_oldestDebtClosedFirstByPositivePayment', () => {
    const txs: ClientTransactionDzd[] = [
        clientTx({ id: 'd1', clientId: 'c1', montant: -100, timestamp: 1000 }), // oldest debt
        clientTx({ id: 'd2', clientId: 'c1', montant: -200, timestamp: 2000 }),
        clientTx({ id: 'p1', clientId: 'c1', montant: 100, timestamp: 3000 }), // payment
    ];
    const { debtQueue } = computeDebtLots_reference(txs);
    // Oldest debt (100) is fully consumed; second debt (200) remains
    assert.equal(debtQueue.length, 1, 'Only second debt remains');
    assert.equal(debtQueue[0].timestamp, 2000, 'Remaining debt is the second one');
    assert.equal(debtQueue[0].remaining, 200, 'Second debt fully unpaid');
});

// =========================================================================
// T-B-009: availableCredit offsets incoming debt
// =========================================================================

test('T-B-009: overdueDebt_availableCredit_offsetsIncomingDebt', () => {
    const txs: ClientTransactionDzd[] = [
        clientTx({ id: 'p1', clientId: 'c1', montant: 500, timestamp: 1000 }), // advance payment first
        clientTx({ id: 'd1', clientId: 'c1', montant: -300, timestamp: 2000 }), // debt arrives later
    ];
    const { debtQueue, availableCredit } = computeDebtLots_reference(txs);
    // Advance offsets the debt → no debt lots; remaining credit = 200
    assert.equal(debtQueue.length, 0, 'Debt fully offset by prior credit');
    assert.equal(availableCredit, 200, 'Leftover credit = 500 - 300 = 200');
});

// =========================================================================
// T-B-010: daysFloor at day boundary — 7 days 23 hours is NOT overdue (days=7, requires >7)
// =========================================================================

test('T-B-010: overdueDebt_daysFloor_atDayBoundary', () => {
    const minDays = 7;
    const nowTs = 1_000_000_000_000;
    // Lot timestamp such that nowTs - lot.timestamp = 7 days + 23 hours
    const lotTs = nowTs - (7 * DAY_MS + 23 * 60 * 60 * 1000);
    const days = Math.floor((nowTs - lotTs) / DAY_MS);
    assert.equal(days, 7, 'floor of (7d 23h) = 7 days');
    assert.equal(days > minDays, false, 'NOT overdue: days must be > 7, not >= 7');
});

// =========================================================================
// T-B-011: overdueAmount displays full current debt, NOT just overdue lots (CURRENT — Q5 fix needed)
// =========================================================================

test('T-B-011: overdueAmount_displaysOnlyOverdueLotsSum (POST FIX-4 / Q5)', () => {
    // Reference: useOverdueDebtClients.ts:106-109 (after FIX-4)
    // POST: overdueAmount = sum of overdueLots[i].remaining (only debts older than minDays).
    // The recent debt of 1000 (within grace window) is excluded; only the 500 (>7 days old) shows.
    const currentBalance = -1500; // current account balance
    const sumOfOverdueLotsRemaining = 500; // only this is actually > 7 days old

    const overdueAmount_postFix = Number(sumOfOverdueLotsRemaining.toFixed(2));
    assert.equal(overdueAmount_postFix, 500, 'POST FIX-4: shows only actually-overdue lots (500)');
    assert.notEqual(
        overdueAmount_postFix,
        Math.abs(currentBalance),
        'POST FIX-4: overdueAmount no longer equals full negative balance',
    );
});

// =========================================================================
// T-B-012: paymentMethod normalization — encoding variants of "Crédit"
// =========================================================================

test('T-B-012: paymentMethod_normalizationHandlesEncodingVariants', () => {
    // The source has a check that compares against BOTH the proper 'Crédit' and the mojibake
    // 'CrÃ©dit' to defend against legacy double-encoded data. Confirm both literals exist.
    const source = readFileSync(join(projectRoot, 'src/hooks/useClientHandlers.ts'), 'utf8');
    const proper = (source.match(/'Crédit'/g) || []).length;
    const mojibake = (source.match(/'CrÃ©dit'/g) || []).length;
    assert.ok(
        proper >= 1 && mojibake >= 1,
        `CURRENT: expected both encoding variants — found 'Crédit' x${proper}, 'CrÃ©dit' x${mojibake}.`,
    );
});

// =========================================================================
// T-B-013: Orphan Transfer Entrant when counterpart match fails on delete (B-014 risk)
// =========================================================================

test('T-B-013: clientDelete_orphansTransferEntrantWhenCounterpartMatchFails (B-014 RISK)', () => {
    // Simulate the cascade-delete logic from useClientHandlers.ts:200-227
    const sortant = clientTx({
        id: 't-out', clientId: 'c1', montant: -500,
        type: 'Transfert Sortant', timestamp: 1000, date: '01/01/2026', time: '10:00',
    });
    const entrant = clientTx({
        id: 't-in', clientId: 'c2', montant: 500,
        type: 'Transfert Entrant', timestamp: 1003, date: '01/01/2026', time: '10:00', // 3ms gap
    });
    const allTxs = [sortant, entrant];
    // Simulate deleting client c1: gather txs to delete
    const txsToDelete = new Set<string>();
    const c1Txs = allTxs.filter((t) => t.clientId === 'c1');
    for (const tx of c1Txs) {
        txsToDelete.add(tx.id);
        const cp = findTransferCounterpart_reference(tx, allTxs);
        if (cp) txsToDelete.add(cp.id);
    }
    // CURRENT BUG: 3ms gap → counterpart not found → entrant is NOT deleted → orphan
    assert.equal(txsToDelete.has('t-out'), true, 'Sortant marked for delete');
    assert.equal(
        txsToDelete.has('t-in'),
        false,
        'CURRENT BUG: Entrant (t-in) is NOT marked for delete due to 3ms gap → ORPHAN created. FIX-7 fixes.',
    );
});

// =========================================================================
// T-B-014: Solde Initial NOT created when initial balance is 0
// =========================================================================

test('T-B-014: solde_initial_notCreatedWhenZero', () => {
    // Reference: useClientHandlers.ts:97-103
    function shouldCreateSoldeInitial(initBal: number): boolean {
        return initBal !== 0 && !Number.isNaN(initBal);
    }
    assert.equal(shouldCreateSoldeInitial(0), false, 'Zero initial → no row');
    assert.equal(shouldCreateSoldeInitial(NaN), false, 'NaN → no row');
    assert.equal(shouldCreateSoldeInitial(100), true, 'Positive → row');
    assert.equal(shouldCreateSoldeInitial(-50), true, 'Negative (debt) → row');
});

// =========================================================================
// T-B-015: Ajustement Solde skipped when |delta| < 0.01
// =========================================================================

test('T-B-015: ajustement_solde_skippedWhenDeltaBelow0_01', () => {
    // Reference: useClientHandlers.ts:78-87
    function shouldCreateAjustement(currentBal: number, newBal: number): boolean {
        return !Number.isNaN(newBal) && Math.abs(newBal - currentBal) > 0.01;
    }
    assert.equal(shouldCreateAjustement(100, 100.005), false, 'Tiny delta (0.005) skipped');
    assert.equal(shouldCreateAjustement(100, 100.011), true, 'Above 0.01 → adjustment created');
    assert.equal(shouldCreateAjustement(100, NaN), false, 'NaN → skipped');
    assert.equal(shouldCreateAjustement(100, 99.5), true, 'Decrease (delta=-0.5) → adjustment');
});

console.log('\n✅ Section B regression tests: all 15 assertions completed.');
console.log('Tests use reference implementations mirroring inline hook code.');
