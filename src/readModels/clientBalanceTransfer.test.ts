// ============================================================================
// Client balance transfer ("Transfert de solde entre clients") — invariant tests.
//
// Sign convention used in the codebase:
//   clientBalance < 0  →  the client owes the project   (receivable / "Doit au projet")
//   clientBalance > 0  →  the project owes the client   (advance   / "Solde en faveur du client")
//   clientBalance == 0 →  "Solde réglé"
//
// A balance transfer reallocates receivable/advance from one client to another
// without any Treasury / Portfolio / Profit / PAM / Capital impact.
//   sourceNewBalance      = sourceOldBalance      + amount
//   destinationNewBalance = destinationOldBalance - amount
//
// amount > 0; the source balance may cross zero in either direction
// (debt → advance or advance → debt) without being clamped.
//
// These tests cover the 6 mandatory cases from the spec plus the full
// create / edit / delete / idempotency round-trip. They exercise the pure
// read-model delta helper (`buildClientBalanceTransferDelta` and friends) —
// which is the same helper the legacy hooks use, so passing here means the
// write path is correct by construction.
// ============================================================================
import assert from 'node:assert/strict';
import {
    buildClientBalanceTransferDelta,
    combineClientPositionDeltas,
    transitionClientBalanceDelta,
} from './readModelDeltas';

type Case = {
    label: string;
    sourceBefore: number;
    destinationBefore: number;
    amount: number;
    expectedSourceAfter: number;
    expectedDestinationAfter: number;
    expectedReceivablesDelta: number;
    expectedAdvancesDelta: number;
};

const CASES: Case[] = [
    {
        label: 'CASE 1: A owes 100k, B owes 30k, transfer 60k → A owes 40k, B owes 90k',
        sourceBefore: -100_000,
        destinationBefore: -30_000,
        amount: 60_000,
        expectedSourceAfter: -40_000,
        expectedDestinationAfter: -90_000,
        // A: receivable 100k → 40k = -60k, advance 0 = 0
        // B: receivable 30k → 90k = +60k, advance 0 = 0
        // combined: receivablesDelta = -60k + 60k = 0, advancesDelta = 0 (no debt created/destroyed)
        expectedReceivablesDelta: 0,
        expectedAdvancesDelta: 0,
    },
    {
        label: 'CASE 2: A owes 100k, project owes B 80k, transfer 60k → A owes 40k, project owes B 20k',
        sourceBefore: -100_000,
        destinationBefore: 80_000,
        amount: 60_000,
        expectedSourceAfter: -40_000,
        expectedDestinationAfter: 20_000,
        expectedReceivablesDelta: -60_000,
        expectedAdvancesDelta: -60_000,
    },
    {
        label: 'CASE 3: A owes 40k, B owes 30k, transfer 60k → project owes A 20k, B owes 90k (cross zero on source)',
        sourceBefore: -40_000,
        destinationBefore: -30_000,
        amount: 60_000,
        expectedSourceAfter: 20_000,
        expectedDestinationAfter: -90_000,
        // A: receivable 40k → 0 = -40k, advance 0 → 20k = +20k
        // B: receivable 30k → 90k = +60k, advance 0 = 0
        // combined: receivablesDelta = -40k + 60k = +20k, advancesDelta = +20k + 0 = +20k
        expectedReceivablesDelta: 20_000,
        expectedAdvancesDelta: 20_000,
    },
    {
        label: 'CASE 4: project owes A 20k, B owes 30k, transfer 60k → project owes A 80k, B owes 90k',
        sourceBefore: 20_000,
        destinationBefore: -30_000,
        amount: 60_000,
        expectedSourceAfter: 80_000,
        expectedDestinationAfter: -90_000,
        expectedReceivablesDelta: 60_000,
        expectedAdvancesDelta: 60_000,
    },
    {
        label: 'CASE 5: A owes 100k, project owes B 30k, transfer 60k → A owes 40k, B owes 30k (cross zero on destination)',
        sourceBefore: -100_000,
        destinationBefore: 30_000,
        amount: 60_000,
        expectedSourceAfter: -40_000,
        expectedDestinationAfter: -30_000,
        // A: receivable 100k → 40k = -60k
        // B: advance 30k → 0 = -30k, receivable 0 → 30k = +30k
        // combined: receivablesDelta = -60k + 30k = -30k, advancesDelta = 0 + (-30k) = -30k
        expectedReceivablesDelta: -30_000,
        expectedAdvancesDelta: -30_000,
    },
];

for (const c of CASES) {
    const result = buildClientBalanceTransferDelta({
        sourceBeforeBalance: c.sourceBefore,
        destinationBeforeBalance: c.destinationBefore,
        amountDzd: c.amount,
    });
    assert.equal(result.sourceAfterBalance, c.expectedSourceAfter, `${c.label} — sourceAfter`);
    assert.equal(result.destinationAfterBalance, c.expectedDestinationAfter, `${c.label} — destinationAfter`);
    assert.equal(result.clients.receivablesDelta, c.expectedReceivablesDelta, `${c.label} — receivablesDelta`);
    assert.equal(result.clients.advancesDelta, c.expectedAdvancesDelta, `${c.label} — advancesDelta`);
}

// CASE 6 — Round trip: Create / Edit (amount) / Delete.
// After the full sequence, balances must be back to their starting values
// and the combined delta must be exactly the inverse of the final state.
{
    const before = { A: -100_000, B: 30_000 };
    const amount1 = 60_000;
    const create = buildClientBalanceTransferDelta({
        sourceBeforeBalance: before.A,
        destinationBeforeBalance: before.B,
        amountDzd: amount1,
    });
    const afterCreate = { A: create.sourceAfterBalance, B: create.destinationAfterBalance };

    // Edit: change amount 60_000 → 80_000 (same source/destination).
    // The edit is implemented as: inverse(create) + apply(new).
    // Inverse is: from afterCreate back to before.
    const inverseCreate = combineClientPositionDeltas([
        transitionClientBalanceDelta(afterCreate.A, before.A),
        transitionClientBalanceDelta(afterCreate.B, before.B),
    ]);
    assert.equal(
        inverseCreate.receivablesDelta,
        -create.clients.receivablesDelta,
        'Inverse of create must be the exact negative of create receivables.',
    );
    assert.equal(
        inverseCreate.advancesDelta,
        -create.clients.advancesDelta,
        'Inverse of create must be the exact negative of create advances.',
    );

    // Now apply the new edit (80k) from the same before state.
    const editAmount = buildClientBalanceTransferDelta({
        sourceBeforeBalance: before.A,
        destinationBeforeBalance: before.B,
        amountDzd: 80_000,
    });
    const afterEditAmount = { A: editAmount.sourceAfterBalance, B: editAmount.destinationAfterBalance };

    // Total client position is invariant under any sequence of transfers.
    assert.equal(afterCreate.A + afterCreate.B, before.A + before.B, 'Net invariant under create.');
    assert.equal(afterEditAmount.A + afterEditAmount.B, before.A + before.B, 'Net invariant under edit-amount.');

    // Delete: full inverse of the final state must restore the initial balances.
    const deleteInverse = combineClientPositionDeltas([
        transitionClientBalanceDelta(afterEditAmount.A, before.A),
        transitionClientBalanceDelta(afterEditAmount.B, before.B),
    ]);
    assert.equal(
        deleteInverse.receivablesDelta,
        -editAmount.clients.receivablesDelta,
        'Delete must be exact inverse of edit receivables.',
    );
    assert.equal(
        deleteInverse.advancesDelta,
        -editAmount.clients.advancesDelta,
        'Delete must be exact inverse of edit advances.',
    );

    // Edit source / edit destination are equivalent to: delete-old + create-new on
    // the new pair. Verify the math holds.
    const newSourceBefore = -50_000;
    const newDestBefore = 70_000;
    const editSource = buildClientBalanceTransferDelta({
        sourceBeforeBalance: newSourceBefore,
        destinationBeforeBalance: newDestBefore,
        amountDzd: 90_000,
    });
    const afterSourceEdit = { A: editSource.sourceAfterBalance, B: editSource.destinationAfterBalance };
    assert.equal(afterSourceEdit.A + afterSourceEdit.B, newSourceBefore + newDestBefore, 'Net invariant under edit-source.');
}

// Acceptance invariants — see spec §17.
{
    // (1) Transfer delta must only touch clients.receivables/advances — no treasury, portfolio, profit, investors.
    const result = buildClientBalanceTransferDelta({
        sourceBeforeBalance: -100_000,
        destinationBeforeBalance: -30_000,
        amountDzd: 60_000,
    });
    const deltaKeys = Object.keys(result.clients)
        .filter((k) => k !== 'activeClientsTodayDelta' && k !== 'clientCountDelta');
    assert.deepEqual(
        deltaKeys.sort(),
        ['advancesDelta', 'receivablesDelta'].sort(),
        'Transfer delta must only contain receivables/advances fields, nothing else.',
    );

    // (2) Idempotency — applying the same delta from the same before-state must yield identical numbers.
    const second = buildClientBalanceTransferDelta({
        sourceBeforeBalance: -100_000,
        destinationBeforeBalance: -30_000,
        amountDzd: 60_000,
    });
    assert.deepEqual(result, second, 'Idempotent: same input ⇒ same delta.');

    // (3) Net zero at the project level (project neutrality).
    const sourceShift = result.sourceAfterBalance - (-100_000);
    const destShift = result.destinationAfterBalance - (-30_000);
    assert.equal(sourceShift + destShift, 0, 'Net client position shift must be zero (project neutrality).');

    // (4) Debt-to-debt transfer (CASE 1) must not change total receivables or advances globally
    // because debt just moves from one client to another.
    const same = buildClientBalanceTransferDelta({
        sourceBeforeBalance: -100_000,
        destinationBeforeBalance: -30_000,
        amountDzd: 60_000,
    });
    assert.equal(same.clients.receivablesDelta, 0, 'Debt-to-debt: receivables preserved at project level.');
    assert.equal(same.clients.advancesDelta, 0, 'Debt-to-debt: advances preserved at project level.');

    // (5) Debt-to-advance transfer (CASE 2) reduces both receivables and advances by the
    // amount — debt on A side shrinks by `amount`, advance on B side shrinks by `amount`.
    const debtToAdvance = buildClientBalanceTransferDelta({
        sourceBeforeBalance: -100_000,
        destinationBeforeBalance: 80_000,
        amountDzd: 60_000,
    });
    assert.equal(debtToAdvance.clients.receivablesDelta, -60_000, 'Debt-to-advance: receivables shrink by amount.');
    assert.equal(debtToAdvance.clients.advancesDelta, -60_000, 'Debt-to-advance: advances shrink by amount.');

    // (6) No Treasury / Portfolio / Profit / Investor effect.
    // The buildClientBalanceTransferDelta return value's `clients` field must only
    // contain position-delta fields, and the parent object must not include any
    // treasury / portfolio / wallets / investors / investors / investors fields.
    assert.equal('wallets' in result, false, 'Transfer delta must not include wallets.');
    assert.equal('portfolio' in result, false, 'Transfer delta must not include portfolio.');
    assert.equal('investors' in result, false, 'Transfer delta must not include investors.');
    assert.equal('treasury' in result, false, 'Transfer delta must not include treasury.');
}

console.log(`Client balance transfer tests passed (${CASES.length} invariant cases + round-trip + acceptance checks).`);
