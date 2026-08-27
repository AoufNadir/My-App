import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
    areLifecyclePostingsLiteralInverse,
    buildLifecycleArchiveDecision,
    buildLifecycleAtomicWritePlan,
    buildLifecycleCorrectionDrafts,
    buildLifecycleReversalDraft,
    clearLifecycleShadowDiagnostics,
    createIdempotencyPayload,
    getLifecycleReversalOperationId,
    getLifecycleShadowDiagnostics,
    LIFECYCLE_V2_COVERAGE,
    LIFECYCLE_V2_FIXTURES,
    LIFECYCLE_V2_ORIGINAL_CROSS_DOMAIN_OPERATION,
    LIFECYCLE_V2_READINESS,
    previewLifecycleIdempotency,
    reconcileAccountingOperations,
    recordLifecycleShadowDiagnostic,
    validateAccountingOperation,
    validateLifecycleReversal,
    type AccountingOperation,
    type AccountingOperationDraft,
} from './index';

function committed(operation: AccountingOperationDraft): AccountingOperation {
    return { ...operation, idempotencyPayload: createIdempotencyPayload(operation) };
}

const source = readFileSync(new URL('./lifecycleV2.ts', import.meta.url), 'utf8');
const diagnosticsSource = readFileSync(new URL('./lifecycleV2Diagnostics.ts', import.meta.url), 'utf8');

assert.equal(LIFECYCLE_V2_READINESS, 'ready');
assert.ok(LIFECYCLE_V2_COVERAGE.some((item) => item.id === 'lifecycle.v2-cross-domain' && item.v2Policy === 'full_reversal'));
assert.doesNotMatch(source, /commitFinancialOperation|from ['"].*firebase|runTransaction|\.set\(|\.update\(|\.delete\(/, 'LifecycleV2 builders must stay Shadow/Prepared and Firestore-free.');
assert.doesNotMatch(diagnosticsSource, /from ['"].*firebase|collection\(|\.set\(|\.update\(|\.delete\(/, 'LifecycleV2 diagnostics must not write Firebase.');

const { cancellation, edit, archiveEntity, correctionEffectiveAt, originalEffectiveAt, actorUid } = LIFECYCLE_V2_FIXTURES;
const original = cancellation.original;
const reversal = cancellation.reversal;

assert.equal(reversal.operationId, getLifecycleReversalOperationId(original.operationId));
assert.equal(reversal.reversalOf, original.operationId);
assert.equal(reversal.effectiveAt, correctionEffectiveAt);
assert.equal((reversal.metadata as Record<string, unknown>).originalEffectiveAt, originalEffectiveAt);
assert.equal((reversal.metadata as Record<string, unknown>).immutable, true);
assert.deepEqual(validateAccountingOperation(reversal), []);
assert.deepEqual(validateLifecycleReversal(original, reversal), []);
assert.equal(areLifecyclePostingsLiteralInverse(original, reversal), true, 'Cancellation must literally invert original.postings without recalculating economics.');
assert.equal(reversal.postings.length, original.postings.length);
assert.equal(reversal.postings[1].clientId, original.postings[1].clientId);
assert.equal(reversal.postings[1].currency, original.postings[1].currency);
assert.equal(reversal.postings[1].quantity, original.postings[1].quantity);
assert.equal(reversal.postings[1].unitRateDzd, original.postings[1].unitRateDzd);
assert.equal(reversal.profitAllocation?.projectProfitDzd, -original.profitAllocation!.projectProfitDzd);
assert.equal(reversal.profitAllocation?.managerFeeDzd, -original.profitAllocation!.managerFeeDzd);
assert.equal(reversal.profitAllocation?.managerCapitalDzd, -original.profitAllocation!.managerCapitalDzd);
assert.equal(reversal.profitAllocation?.externalInvestorShares[0].amountDzd, -original.profitAllocation!.externalInvestorShares[0].amountDzd);
assert.equal(original.profitAllocation?.projectProfitDzd, 25_500, 'The original snapshot must remain untouched.');

const canceledReport = reconcileAccountingOperations([committed(original), committed(reversal)]);
assert.equal(canceledReport.ok, true);
assert.equal(canceledReport.projectProfitDzd, 0);
assert.equal(canceledReport.assetsDzd, 0);
assert.equal(canceledReport.liabilitiesDzd, 0);

assert.throws(
    () => buildLifecycleReversalDraft(original, { actorUid, effectiveAt: correctionEffectiveAt, reason: '', }),
    /REVERSAL_REASON_REQUIRED|reason/i,
);
assert.throws(
    () => buildLifecycleReversalDraft(original, { actorUid, effectiveAt: originalEffectiveAt - 1, reason: 'Backdated reversal.', }),
    /REVERSAL_BACKDATES_HISTORY|history/i,
);
assert.throws(
    () => buildLifecycleReversalDraft(original, { actorUid, effectiveAt: correctionEffectiveAt, reason: 'Wrong id.', operationId: 'reversal:custom' }),
    /REVERSAL_OPERATION_ID_NOT_STABLE|reversal:\{originalOperationId\}/,
);
assert.throws(
    () => buildLifecycleReversalDraft(reversal, { actorUid, effectiveAt: correctionEffectiveAt + 1, reason: 'Reverse reversal.' }),
    /REVERSAL_TARGET_NOT_POSTED|posted non-reversal/i,
);

assert.equal(edit.reversal.operationId, reversal.operationId);
assert.equal(edit.reversal.effectiveAt, correctionEffectiveAt);
assert.equal(edit.correction.effectiveAt, correctionEffectiveAt, 'The replacement operation uses correction date, not original date.');
assert.equal(edit.correction.reversalOf, undefined);
assert.equal((edit.correction.metadata as Record<string, unknown>).corrects, original.operationId);
assert.equal((edit.correction.metadata as Record<string, unknown>).originalEffectiveAt, originalEffectiveAt);
assert.equal((edit.correction.metadata as Record<string, unknown>).correctionEffectiveAt, correctionEffectiveAt);
assert.equal((edit.correction.metadata as Record<string, unknown>).correctionOfReversal, edit.reversal.operationId);
const correctedReport = reconcileAccountingOperations([committed(original), committed(edit.reversal), committed(edit.correction)]);
assert.equal(correctedReport.ok, true);
assert.equal(correctedReport.projectProfitDzd, edit.correction.profitAllocation!.projectProfitDzd);
assert.equal(correctedReport.managerFeeDzd, edit.correction.profitAllocation!.managerFeeDzd);

assert.throws(
    () => buildLifecycleCorrectionDrafts(original, { ...original }, { actorUid, effectiveAt: correctionEffectiveAt, reason: 'No new id.' }),
    /CORRECTION_OPERATION_ID_CONFLICT|new operationId/i,
);
assert.throws(
    () => buildLifecycleCorrectionDrafts(original, { ...edit.correction, reversalOf: original.operationId }, { actorUid, effectiveAt: correctionEffectiveAt, reason: 'Bad corrected draft.' }),
    /CORRECTION_CANNOT_SET_REVERSAL_OF|reversalOf/i,
);

const newPreview = previewLifecycleIdempotency(reversal);
assert.equal(newPreview.status, 'new');
const retryPreview = previewLifecycleIdempotency(reversal, {
    operationPayloads: { [reversal.operationId]: createIdempotencyPayload(reversal) },
    reversalIndex: { [original.operationId]: reversal.operationId },
});
assert.equal(retryPreview.status, 'already_committed');
assert.throws(
    () => previewLifecycleIdempotency({ ...reversal, reason: 'Different reason.' }, {
        operationPayloads: { [reversal.operationId]: createIdempotencyPayload(reversal) },
        reversalIndex: { [original.operationId]: reversal.operationId },
    }),
    /IDEMPOTENCY_KEY_CONFLICT|different lifecycle payload/i,
);
assert.throws(
    () => previewLifecycleIdempotency(reversal, { reversalIndex: { [original.operationId]: 'reversal:other-operation' } }),
    /REVERSAL_ALREADY_EXISTS|different reversal/i,
);

const plan = buildLifecycleAtomicWritePlan([edit.reversal, edit.correction]);
assert.equal(plan.singleFirestoreTransactionRequired, true);
assert.ok(plan.operationPaths.includes(`accounting_operations/${edit.reversal.operationId}`));
assert.ok(plan.reversalIndexPaths.includes(`accounting_reversal_index/${original.operationId}`));
assert.equal(plan.projectionPaths.length, edit.reversal.projections.length + edit.correction.projections.length);
assert.equal(new Set(plan.allPaths).size, plan.allPaths.length, 'Operation, reversal index, and projection writes must be planned atomically without duplicate paths.');
const duplicateProjection: AccountingOperationDraft = {
    ...edit.correction,
    operationId: 'op:duplicate-projection',
    projections: [
        { collection: 'treasury_txs', id: 'op:duplicate-projection:row' },
        { collection: 'treasury_txs', id: 'op:duplicate-projection:row' },
    ],
};
assert.throws(() => buildLifecycleAtomicWritePlan([duplicateProjection]), /Projection references must be unique|duplicate/i);

assert.equal(archiveEntity.action, 'archive_entity');
assert.equal(archiveEntity.financialHistoryAction, 'preserve');
assert.equal(archiveEntity.canDeleteFinancialHistory, false);
assert.throws(
    () => buildLifecycleArchiveDecision({ entityKind: 'asset', entityId: '', actorUid, effectiveAt: correctionEffectiveAt, reason: 'Archive.' }),
    /ENTITY_ID_REQUIRED|Entity id/i,
);

clearLifecycleShadowDiagnostics();
recordLifecycleShadowDiagnostic({
    action: 'cancel',
    operationId: reversal.operationId,
    reversalOf: original.operationId,
    matches: true,
    errors: [],
    drafts: [reversal],
});
assert.equal(getLifecycleShadowDiagnostics().length, 1);

assert.equal(
    LIFECYCLE_V2_ORIGINAL_CROSS_DOMAIN_OPERATION.projections.length,
    cancellation.reversal.projections.length,
    'A cross-domain operation must be reversed as one complete unit.',
);

console.log('LifecycleV2 Shadow tests passed');
