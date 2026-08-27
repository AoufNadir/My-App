import { db, fieldValueServerTimestamp, type FirestoreDocumentReference } from '../firebase';
import { assertAccountingV2WriteEnabled, getAccountingV2Status, type AccountingV2Status } from './closure';
import { areReversalPostingsExact, validateAccountingOperation } from './integrity';
import type { AccountingCheckpoint, AccountingOperation, AccountingOperationDraft } from './types';

export type CommitFinancialOperationResult = {
    status: 'committed' | 'already_committed';
    operationId: string;
};

export class AccountingOperationError extends Error {
    constructor(readonly code: string, message: string) {
        super(message);
        this.name = 'AccountingOperationError';
    }
}

function stableStringify(value: unknown): string {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(object[key])}`).join(',')}}`;
}

/** Exact canonical payload retained with the operation to detect key reuse. */
export function createIdempotencyPayload(operation: AccountingOperationDraft): string {
    return stableStringify({
        operationId: operation.operationId,
        accountingVersion: operation.accountingVersion,
        kind: operation.kind,
        status: operation.status,
        effectiveAt: operation.effectiveAt,
        actorUid: operation.actorUid,
        reason: operation.reason || null,
        reversalOf: operation.reversalOf || null,
        postings: operation.postings,
        projections: operation.projections,
        profitAllocation: operation.profitAllocation || null,
        metadata: operation.metadata || null,
    });
}

function asOperation(data: unknown): AccountingOperation | null {
    if (!data || typeof data !== 'object') return null;
    return data as AccountingOperation;
}

function assertValidDraft(operation: AccountingOperationDraft, closureAt: number): void {
    const errors = validateAccountingOperation(operation);
    if (errors.length > 0) {
        throw new AccountingOperationError('INVALID_ACCOUNTING_OPERATION', errors.join(' '));
    }
    if (operation.effectiveAt < closureAt) {
        throw new AccountingOperationError('EFFECTIVE_DATE_BEFORE_CLOSURE', 'V2 operations cannot be backdated before closureAt. Use an explicit correction after activation.');
    }
}

/**
 * Prepared Core Ledger commit path. No current writer calls it. Until a later
 * production release supplies closureAt, the activation guard throws before it
 * accesses Firestore, so this phase cannot create V2 documents.
 */
export async function commitFinancialOperation(
    userDocRef: FirestoreDocumentReference,
    operation: AccountingOperationDraft,
    activationStatus = getAccountingV2Status(),
): Promise<CommitFinancialOperationResult> {
    const closureAt = assertAccountingV2WriteEnabled(activationStatus);
    assertValidDraft(operation, closureAt);
    const idempotencyPayload = createIdempotencyPayload(operation);

    return db.runTransaction(async (transaction) => {
        const operationRef = userDocRef.collection('accounting_operations').doc(operation.operationId);
        const existingSnapshot = await transaction.get(operationRef);
        if (existingSnapshot.exists) {
            const existing = asOperation(existingSnapshot.data());
            if (!existing || existing.idempotencyPayload !== idempotencyPayload) {
                throw new AccountingOperationError('IDEMPOTENCY_KEY_CONFLICT', 'operationId already exists with a different payload.');
            }
            return { status: 'already_committed', operationId: operation.operationId };
        }

        if (operation.kind === 'reversal' && operation.reversalOf) {
            const originalRef = userDocRef.collection('accounting_operations').doc(operation.reversalOf);
            const reversalIndexRef = userDocRef.collection('accounting_reversal_index').doc(operation.reversalOf);
            const [originalSnapshot, reversalIndexSnapshot] = await Promise.all([
                transaction.get(originalRef),
                transaction.get(reversalIndexRef),
            ]);
            const original = asOperation(originalSnapshot.data());
            if (!originalSnapshot.exists || !original || original.accountingVersion !== 2) {
                throw new AccountingOperationError('REVERSAL_TARGET_NOT_FOUND', 'A reversal must target an existing V2 operation.');
            }
            if (reversalIndexSnapshot.exists) {
                throw new AccountingOperationError('REVERSAL_ALREADY_EXISTS', 'The original operation already has a reversal.');
            }
            if (!areReversalPostingsExact(original, operation)) {
                throw new AccountingOperationError('REVERSAL_POSTINGS_MISMATCH', 'Reversal postings must be the exact inverse of the original operation.');
            }
            transaction.set(reversalIndexRef, {
                reversalOperationId: operation.operationId,
                reversalOf: operation.reversalOf,
                createdAt: fieldValueServerTimestamp(),
            });
        }

        const checkpointRef = userDocRef.collection('accounting_checkpoints').doc('v2');
        const checkpointSnapshot = await transaction.get(checkpointRef);
        const previousCheckpoint = (checkpointSnapshot.data() || {}) as Partial<AccountingCheckpoint>;
        transaction.set(operationRef, {
            ...operation,
            idempotencyPayload,
            createdAt: fieldValueServerTimestamp(),
        });
        transaction.set(checkpointRef, {
            accountingVersion: 2,
            revision: Number(previousCheckpoint.revision || 0) + 1,
            lastOperationId: operation.operationId,
            updatedAt: fieldValueServerTimestamp(),
        });
        return { status: 'committed', operationId: operation.operationId };
    });
}
