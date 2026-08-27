import { createIdempotencyPayload } from './commit';
import { areReversalPostingsExact, validateAccountingOperation } from './integrity';
import {
    ACCOUNTING_V2,
    type AccountingOperation,
    type AccountingOperationDraft,
    type LedgerPosting,
    type ProfitAllocationSnapshot,
    type ProjectionReference,
} from './types';

export type LifecycleAction = 'cancel' | 'edit' | 'correction' | 'archive_entity';
export type LifecycleEntityKind = 'client' | 'investor' | 'asset';

export class LifecycleV2Error extends Error {
    constructor(readonly code: string, message: string) {
        super(message);
        this.name = 'LifecycleV2Error';
    }
}

export type LifecycleReversalArgs = {
    actorUid: string;
    effectiveAt: number;
    reason: string;
    operationId?: string;
    lifecycleAction?: 'cancel' | 'edit';
};

export type LifecycleCorrectionArgs = {
    actorUid: string;
    effectiveAt: number;
    reason: string;
};

export type LifecycleCorrectionDrafts = {
    reversal: AccountingOperationDraft;
    correction: AccountingOperationDraft;
};

export type LifecycleArchiveDecision = {
    action: 'archive_entity';
    entityKind: LifecycleEntityKind;
    entityId: string;
    actorUid: string;
    effectiveAt: number;
    reason: string;
    financialHistoryAction: 'preserve';
    canDeleteFinancialHistory: false;
    metadata: {
        mode: 'shadow';
        domain: 'lifecycleV2';
        lifecycleAction: 'archive_entity';
        immutable: true;
    };
};

export type LifecycleAtomicWritePlan = {
    singleFirestoreTransactionRequired: true;
    operationPaths: string[];
    reversalIndexPaths: string[];
    projectionPaths: string[];
    allPaths: string[];
};

export type LifecycleIdempotencyState = {
    operationPayloads?: Record<string, string>;
    reversalIndex?: Record<string, string>;
};

export type LifecycleIdempotencyPreview = {
    status: 'new' | 'already_committed';
    operationId: string;
    idempotencyPayload: string;
};

function requireNonEmpty(value: string, code: string, message: string): string {
    const trimmed = value.trim();
    if (!trimmed) throw new LifecycleV2Error(code, message);
    return trimmed;
}

function assertEffectiveAt(value: number, code = 'INVALID_EFFECTIVE_AT'): void {
    if (!Number.isFinite(value) || value <= 0) {
        throw new LifecycleV2Error(code, 'effectiveAt must be a valid accounting timestamp.');
    }
}

function oppositeSide(side: LedgerPosting['side']): LedgerPosting['side'] {
    return side === 'debit' ? 'credit' : 'debit';
}

function stableStringify(value: unknown): string {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(object[key])}`).join(',')}}`;
}

function postingWithoutLifecycleFields(posting: LedgerPosting): Omit<LedgerPosting, 'id' | 'side'> {
    const { id: _id, side: _side, ...rest } = posting;
    return rest;
}

function operationForIntegrity(operation: AccountingOperationDraft): AccountingOperation {
    return { ...operation, idempotencyPayload: createIdempotencyPayload(operation) };
}

function sanitizedProjectionTail(projection: ProjectionReference, index: number): string {
    const collection = projection.collection.replace(/[^A-Za-z0-9_.-]+/g, '_');
    const id = projection.id.replace(/[^A-Za-z0-9_.:-]+/g, '_');
    return `${index}:${collection}:${id}`;
}

function reverseProjectionReferences(original: AccountingOperationDraft, operationId: string): ProjectionReference[] {
    return original.projections.map((projection, index) => ({
        collection: projection.collection,
        id: `${operationId}:reversal:${sanitizedProjectionTail(projection, index)}`,
    }));
}

export function getLifecycleReversalOperationId(originalOperationId: string): string {
    const originalId = requireNonEmpty(originalOperationId, 'ORIGINAL_OPERATION_ID_REQUIRED', 'Original operation id is required.');
    return `reversal:${originalId}`;
}

export function reverseLedgerPostingLiteral(posting: LedgerPosting): LedgerPosting {
    return {
        ...posting,
        id: `reversal:${posting.id}`,
        side: oppositeSide(posting.side),
    };
}

export function reverseProfitAllocationSnapshotLiteral(snapshot: ProfitAllocationSnapshot | undefined): ProfitAllocationSnapshot | undefined {
    if (!snapshot) return undefined;
    return {
        projectProfitDzd: -snapshot.projectProfitDzd,
        managerFeeDzd: -snapshot.managerFeeDzd,
        managerCapitalDzd: -snapshot.managerCapitalDzd,
        externalInvestorShares: snapshot.externalInvestorShares.map((share) => ({
            ...share,
            amountDzd: -share.amountDzd,
        })),
        managerFeePercentage: snapshot.managerFeePercentage,
        eligibleInvestorCapital: snapshot.eligibleInvestorCapital.map((capital) => ({ ...capital })),
    };
}

export function areLifecyclePostingsLiteralInverse(original: AccountingOperationDraft, reversal: AccountingOperationDraft): boolean {
    if (reversal.reversalOf !== original.operationId || reversal.postings.length !== original.postings.length) return false;
    return original.postings.every((posting, index) => {
        const reversed = reversal.postings[index];
        return reversed.id === `reversal:${posting.id}`
            && reversed.side === oppositeSide(posting.side)
            && stableStringify(postingWithoutLifecycleFields(reversed)) === stableStringify(postingWithoutLifecycleFields(posting));
    });
}

export function validateLifecycleDraft(operation: AccountingOperationDraft): string[] {
    const errors = validateAccountingOperation(operation);
    if (operation.kind === 'reversal') {
        if (!operation.reason?.trim()) errors.push('A lifecycle reversal requires a reason.');
        if (operation.reversalOf && operation.operationId !== getLifecycleReversalOperationId(operation.reversalOf)) {
            errors.push('A lifecycle reversal operationId must be reversal:{originalOperationId}.');
        }
        if ((operation.metadata as Record<string, unknown> | undefined)?.immutable !== true) {
            errors.push('A lifecycle reversal must be immutable.');
        }
        const originalEffectiveAt = (operation.metadata as Record<string, unknown> | undefined)?.originalEffectiveAt;
        if (!Number.isFinite(Number(originalEffectiveAt))) {
            errors.push('A lifecycle reversal must record originalEffectiveAt.');
        }
    }
    return errors;
}

export function validateLifecycleReversal(original: AccountingOperationDraft, reversal: AccountingOperationDraft): string[] {
    const errors = validateLifecycleDraft(reversal);
    if (original.kind === 'reversal' || original.status !== 'posted') {
        errors.push('Only an original posted financial operation can be reversed.');
    }
    if (!areLifecyclePostingsLiteralInverse(original, reversal)) {
        errors.push('Lifecycle reversal postings must be a literal inverse of original.postings.');
    }
    if (!areReversalPostingsExact(operationForIntegrity(original), reversal)) {
        errors.push('Lifecycle reversal postings must be an exact accounting inverse.');
    }
    const metadata = reversal.metadata as Record<string, unknown> | undefined;
    if (metadata?.originalEffectiveAt !== original.effectiveAt) {
        errors.push('Lifecycle reversal must keep originalEffectiveAt from the original operation.');
    }
    return errors;
}

export function buildLifecycleReversalDraft(original: AccountingOperationDraft, args: LifecycleReversalArgs): AccountingOperationDraft {
    if (original.status !== 'posted' || original.kind === 'reversal') {
        throw new LifecycleV2Error('REVERSAL_TARGET_NOT_POSTED', 'Only a posted non-reversal operation can be reversed.');
    }
    assertEffectiveAt(args.effectiveAt);
    if (args.effectiveAt < original.effectiveAt) {
        throw new LifecycleV2Error('REVERSAL_BACKDATES_HISTORY', 'A reversal cannot rewrite history before the original effectiveAt.');
    }
    const reason = requireNonEmpty(args.reason, 'REVERSAL_REASON_REQUIRED', 'A reversal reason is required.');
    const operationId = args.operationId || getLifecycleReversalOperationId(original.operationId);
    const expectedOperationId = getLifecycleReversalOperationId(original.operationId);
    if (operationId !== expectedOperationId) {
        throw new LifecycleV2Error('REVERSAL_OPERATION_ID_NOT_STABLE', 'A reversal operationId must be reversal:{originalOperationId}.');
    }
    const profitAllocation = reverseProfitAllocationSnapshotLiteral(original.profitAllocation);
    const draft: AccountingOperationDraft = {
        operationId,
        accountingVersion: ACCOUNTING_V2,
        kind: 'reversal',
        status: 'reversal',
        effectiveAt: args.effectiveAt,
        actorUid: requireNonEmpty(args.actorUid, 'ACTOR_REQUIRED', 'actorUid is required.'),
        reason,
        reversalOf: original.operationId,
        postings: original.postings.map(reverseLedgerPostingLiteral),
        projections: reverseProjectionReferences(original, operationId),
        ...(profitAllocation ? { profitAllocation } : {}),
        metadata: {
            mode: 'shadow',
            domain: 'lifecycleV2',
            lifecycleAction: args.lifecycleAction || 'cancel',
            immutable: true,
            reversalOf: original.operationId,
            originalKind: original.kind,
            originalEffectiveAt: original.effectiveAt,
            reversalEffectiveAt: args.effectiveAt,
            reversedProjectionCount: original.projections.length,
        },
    };
    const errors = validateLifecycleReversal(original, draft);
    if (errors.length > 0) throw new LifecycleV2Error('INVALID_LIFECYCLE_REVERSAL', errors.join(' '));
    return draft;
}

export function buildLifecycleCorrectionDrafts(
    original: AccountingOperationDraft,
    correctedDraft: AccountingOperationDraft,
    args: LifecycleCorrectionArgs,
): LifecycleCorrectionDrafts {
    assertEffectiveAt(args.effectiveAt);
    const reason = requireNonEmpty(args.reason, 'CORRECTION_REASON_REQUIRED', 'A correction reason is required.');
    if (correctedDraft.kind === 'reversal' || correctedDraft.status !== 'posted') {
        throw new LifecycleV2Error('CORRECTION_MUST_BE_POSTED', 'The corrected operation must be a new posted financial operation.');
    }
    if (correctedDraft.reversalOf) {
        throw new LifecycleV2Error('CORRECTION_CANNOT_SET_REVERSAL_OF', 'The corrected operation cannot set reversalOf.');
    }
    const reversal = buildLifecycleReversalDraft(original, {
        actorUid: args.actorUid,
        effectiveAt: args.effectiveAt,
        reason,
        lifecycleAction: 'edit',
    });
    if (correctedDraft.operationId === original.operationId || correctedDraft.operationId === reversal.operationId) {
        throw new LifecycleV2Error('CORRECTION_OPERATION_ID_CONFLICT', 'The corrected operation must have a new operationId.');
    }
    const correction: AccountingOperationDraft = {
        ...correctedDraft,
        actorUid: requireNonEmpty(args.actorUid, 'ACTOR_REQUIRED', 'actorUid is required.'),
        effectiveAt: args.effectiveAt,
        status: 'posted',
        reason: correctedDraft.reason || `Correction of ${original.operationId}: ${reason}`,
        metadata: {
            ...(correctedDraft.metadata || {}),
            mode: 'shadow',
            domain: 'lifecycleV2',
            lifecycleAction: 'correction',
            immutable: true,
            corrects: original.operationId,
            correctionOfReversal: reversal.operationId,
            originalEffectiveAt: original.effectiveAt,
            correctionEffectiveAt: args.effectiveAt,
        },
    };
    const errors = validateAccountingOperation(correction);
    if (errors.length > 0) throw new LifecycleV2Error('INVALID_LIFECYCLE_CORRECTION', errors.join(' '));
    return { reversal, correction };
}

export function buildLifecycleArchiveDecision(args: {
    entityKind: LifecycleEntityKind;
    entityId: string;
    actorUid: string;
    effectiveAt: number;
    reason: string;
}): LifecycleArchiveDecision {
    assertEffectiveAt(args.effectiveAt);
    return {
        action: 'archive_entity',
        entityKind: args.entityKind,
        entityId: requireNonEmpty(args.entityId, 'ENTITY_ID_REQUIRED', 'Entity id is required.'),
        actorUid: requireNonEmpty(args.actorUid, 'ACTOR_REQUIRED', 'actorUid is required.'),
        effectiveAt: args.effectiveAt,
        reason: requireNonEmpty(args.reason, 'ARCHIVE_REASON_REQUIRED', 'Archive reason is required.'),
        financialHistoryAction: 'preserve',
        canDeleteFinancialHistory: false,
        metadata: {
            mode: 'shadow',
            domain: 'lifecycleV2',
            lifecycleAction: 'archive_entity',
            immutable: true,
        },
    };
}

export function previewLifecycleIdempotency(
    operation: AccountingOperationDraft,
    state: LifecycleIdempotencyState = {},
): LifecycleIdempotencyPreview {
    const errors = validateLifecycleDraft(operation);
    if (errors.length > 0) throw new LifecycleV2Error('INVALID_LIFECYCLE_OPERATION', errors.join(' '));
    const idempotencyPayload = createIdempotencyPayload(operation);
    const existingPayload = state.operationPayloads?.[operation.operationId];
    if (existingPayload !== undefined) {
        if (existingPayload !== idempotencyPayload) {
            throw new LifecycleV2Error('IDEMPOTENCY_KEY_CONFLICT', 'operationId already exists with a different lifecycle payload.');
        }
        return { status: 'already_committed', operationId: operation.operationId, idempotencyPayload };
    }
    if (operation.kind === 'reversal' && operation.reversalOf) {
        const existingReversal = state.reversalIndex?.[operation.reversalOf];
        if (existingReversal && existingReversal !== operation.operationId) {
            throw new LifecycleV2Error('REVERSAL_ALREADY_EXISTS', 'The original operation already has a different reversal.');
        }
    }
    return { status: 'new', operationId: operation.operationId, idempotencyPayload };
}

export function buildLifecycleAtomicWritePlan(operations: readonly AccountingOperationDraft[]): LifecycleAtomicWritePlan {
    const operationPaths: string[] = [];
    const reversalIndexPaths: string[] = [];
    const projectionPaths: string[] = [];
    operations.forEach((operation) => {
        const errors = validateLifecycleDraft(operation);
        if (errors.length > 0) throw new LifecycleV2Error('INVALID_ATOMIC_PLAN_OPERATION', errors.join(' '));
        operationPaths.push(`accounting_operations/${operation.operationId}`);
        if (operation.kind === 'reversal' && operation.reversalOf) {
            reversalIndexPaths.push(`accounting_reversal_index/${operation.reversalOf}`);
        }
        operation.projections.forEach((projection) => {
            projectionPaths.push(`${projection.collection}/${projection.id}`);
        });
    });
    const allPaths = [...operationPaths, ...reversalIndexPaths, ...projectionPaths];
    if (new Set(allPaths).size !== allPaths.length) {
        throw new LifecycleV2Error('ATOMIC_PLAN_HAS_DUPLICATE_PATHS', 'Lifecycle operation, reversal index, and projections must not contain duplicate write paths.');
    }
    return {
        singleFirestoreTransactionRequired: true,
        operationPaths,
        reversalIndexPaths,
        projectionPaths,
        allPaths,
    };
}
