import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
    CLIENT_SHADOW_EXPECTED_FIXTURES,
    CLIENT_SHADOW_EXPECTED_KINDS,
    CLIENT_SHADOW_KINDS,
    CLIENT_SHADOW_WRITERS,
    CLIENTS_V2_READINESS,
    areReversalPostingsExact,
    buildClientPositionSnapshot,
    buildClientShadowDraft,
    buildClientShadowReversalDraft,
    clearClientShadowDiagnostics,
    compareClientShadow,
    getClientShadowDiagnostics,
    recordClientShadow,
    reconcileLegacyClientsToShadow,
    validateAccountingOperation,
} from './index';

assert.equal(CLIENTS_V2_READINESS, 'shadow', 'Clients readiness must never activate V2 or closure.');
assert.deepEqual([...CLIENT_SHADOW_KINDS].sort(), [...CLIENT_SHADOW_EXPECTED_KINDS].sort(), 'Every observed Client writer kind needs an independent accounting fixture.');
assert.ok(CLIENT_SHADOW_WRITERS.length >= 16, 'The complete Client writer inventory must remain explicit.');
for (const writer of CLIENT_SHADOW_WRITERS.filter((writer) => writer.v2Policy === 'shadow_observed')) {
    const source = readFileSync(new URL(`../${writer.file.replace(/^src\//, '')}`, import.meta.url), 'utf8');
    assert.match(source, /recordClientShadow/, `${writer.id} must invoke the non-blocking Client Shadow observer.`);
    assert.doesNotMatch(source, /commitFinancialOperation|accounting_operations/, `${writer.id} must not activate a V2 writer in Shadow.`);
}

const pureBuilderSource = readFileSync(new URL('./clientShadow.ts', import.meta.url), 'utf8');
assert.doesNotMatch(pureBuilderSource, /firebase|recordClientShadow|Date\.now|Math\.random/, 'Client Draft builders must remain pure and Firestore-free.');
const diagnosticsSource = readFileSync(new URL('./clientShadowDiagnostics.ts', import.meta.url), 'utf8');
assert.doesNotMatch(diagnosticsSource, /firebase|collection\(|\.set\(|\.update\(|\.delete\(/, 'Client diagnostics must not write Firebase.');

for (const fixture of CLIENT_SHADOW_EXPECTED_FIXTURES) {
    const result = compareClientShadow(fixture.intent, fixture.legacyFacts);
    assert.equal(result.matches, true, fixture.label);
    assert.deepEqual(result.integrityErrors, [], `${fixture.label} must produce balanced postings.`);
    assert.equal(result.draft.kind, fixture.expectedKind, fixture.label);
    assert.deepEqual(
        result.draft.postings.map(({ account, side, amountDzd, clientId }) => ({ account, side, amountDzd, ...(clientId ? { clientId } : {}) })),
        fixture.expectedPostings,
        fixture.label,
    );
    assert.deepEqual(result.ledgerEffects, fixture.expectedEffects, fixture.label);
}

const snapshot = buildClientPositionSnapshot([
    { id: 'advance', clientId: 'a', timestamp: 1, montant: 30 },
    { id: 'debt-covered', clientId: 'a', timestamp: 2, montant: -10 },
    { id: 'debt-old', clientId: 'a', timestamp: 3, montant: -40, creditDueDate: '2026-08-25' },
    { id: 'debt-new', clientId: 'a', timestamp: 4, montant: -50, creditDueDate: '2026-08-26' },
    { id: 'history-only', clientId: 'a', timestamp: 5, montant: -999, affectsBalance: false },
], 'a', 5);
assert.equal(snapshot.balanceDzd, -70, 'History-only rows must not alter the Shadow position.');
assert.equal(snapshot.advanceDzd, 0);
assert.equal(snapshot.receivableDzd, 70);
assert.deepEqual(snapshot.receivableLots.map((lot) => ({ id: lot.sourceTxId, remaining: lot.remainingDzd, dueDate: lot.dueDate })), [
    { id: 'debt-old', remaining: 20, dueDate: '2026-08-25' },
    { id: 'debt-new', remaining: 50, dueDate: '2026-08-26' },
]);

const receivableTransfer = CLIENT_SHADOW_EXPECTED_FIXTURES.find((fixture) => fixture.intent.kind === 'client_receivable_transfer')!;
const receivableDraft = buildClientShadowDraft(receivableTransfer.intent);
assert.deepEqual((receivableDraft.metadata?.fifoLots as Array<{ sourceTxId: string; remainingDzd: number; dueDate?: string }>).map((lot) => ({ sourceTxId: lot.sourceTxId, remainingDzd: lot.remainingDzd, dueDate: lot.dueDate })), [
    { sourceTxId: 'debt-a-old', remainingDzd: 40, dueDate: '2026-08-22' },
    { sourceTxId: 'debt-a-new', remainingDzd: 10, dueDate: '2026-08-23' },
], 'Client receivable transfer must preserve FIFO provenance and due dates.');

const advanceTransfer = CLIENT_SHADOW_EXPECTED_FIXTURES.find((fixture) => fixture.intent.kind === 'client_advance_transfer')!;
assert.throws(() => buildClientShadowDraft({ ...advanceTransfer.intent, amountDzd: 101 }), /exceeds source advance/i, 'Advance transfer must reject more than the source balance.');
assert.throws(() => buildClientShadowDraft({ ...receivableTransfer.intent, amountDzd: 101 }), /exceeds source receivable/i, 'Receivable transfer must reject more than the source balance.');

const adjustment = CLIENT_SHADOW_EXPECTED_FIXTURES.find((fixture) => fixture.intent.kind === 'client_balance_adjustment')!;
assert.throws(() => buildClientShadowDraft({ ...adjustment.intent, reason: '' }), /requires a reason/i, 'Future V2 corrections require a reason.');
const initial = CLIENT_SHADOW_EXPECTED_FIXTURES.find((fixture) => fixture.intent.kind === 'client_initial_balance')!;
assert.throws(() => buildClientShadowDraft({ ...initial.intent, counterpartAccount: '' as never }), /explicit counterpart/i, 'Future V2 corrections require an explicit counterpart.');

const supplierCredit = CLIENT_SHADOW_EXPECTED_FIXTURES.find((fixture) => fixture.intent.kind === 'client_credit_purchase' && fixture.intent.counterparty.kind === 'supplier')!;
const supplierDraft = buildClientShadowDraft(supplierCredit.intent);
assert.equal(supplierDraft.postings.some((posting) => posting.account === 'liability.client_payable'), false, 'Supplier credit must not use client_payable.');

const sale = CLIENT_SHADOW_EXPECTED_FIXTURES.find((fixture) => fixture.intent.kind === 'client_credit_sale')!;
const reversal = buildClientShadowReversalDraft(buildClientShadowDraft(sale.intent), {
    operationId: 'fixture:client-sale:reversal', actorUid: 'owner', effectiveAt: sale.intent.effectiveAt + 1,
});
assert.equal(reversal.reversalOf, sale.intent.operationId);
assert.equal(reversal.status, 'reversal');
assert.deepEqual(validateAccountingOperation(reversal), []);
assert.equal(areReversalPostingsExact({ ...buildClientShadowDraft(sale.intent), idempotencyPayload: 'fixture' }, reversal), true, 'A Client reversal is an exact immutable inverse.');

clearClientShadowDiagnostics();
const originalWarn = console.warn;
const warnings: unknown[][] = [];
console.warn = (...args: unknown[]) => warnings.push(args);
try {
    const mismatch = recordClientShadow(sale.intent, { clientDeltas: { 'client-a': -99 } });
    assert.equal(mismatch?.matches, false, 'Shadow mismatch must be recorded for review.');
    assert.equal(getClientShadowDiagnostics().length, 1);
    assert.doesNotThrow(() => recordClientShadow({ ...sale.intent, amountDzd: 0 }), 'Shadow failures must never block Legacy.');
    assert.equal(getClientShadowDiagnostics().length, 1, 'Rejected drafts are not V2 financial operations.');
}
finally {
    console.warn = originalWarn;
}
assert.equal(warnings.length, 2, 'Mismatch and rejected draft are diagnostics only.');

const readReconciliation = reconcileLegacyClientsToShadow([
    { id: 'advance-a', clientId: 'a', timestamp: 1, montant: 100 },
    { id: 'sale-a', clientId: 'a', timestamp: 2, montant: -40 },
    { id: 'sale-b', clientId: 'b', timestamp: 3, montant: -50 },
    { id: 'history-b', clientId: 'b', timestamp: 4, montant: 999, affectsBalance: false },
], ['a', 'b', 'empty']);
assert.equal(readReconciliation.ok, true, 'Read-only Legacy and Shadow client totals must reconcile.');
assert.equal(readReconciliation.clientCount, 3);
assert.equal(readReconciliation.ignoredHistoryOnlyCount, 1);
assert.deepEqual(readReconciliation.legacy, { netClientBalanceDzd: 10, receivableDzd: 50, advancesOrPayablesDzd: 60 });
assert.deepEqual(readReconciliation.shadow, readReconciliation.legacy);
assert.deepEqual(readReconciliation.differences, { netClientBalanceDzd: 0, receivableDzd: 0, advancesOrPayablesDzd: 0 });

console.log(`Clients shadow tests passed (${CLIENT_SHADOW_EXPECTED_FIXTURES.length} independent movement fixtures).`);
