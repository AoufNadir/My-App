import type { FirestoreDocumentReference, FirestoreTransaction, FirestoreWriteBatch } from '../firebase';
import type {
    DashboardReadModelSet,
    ReadModelName,
} from './dashboardReadModels';
import { INITIAL_READ_MODEL_DOCUMENT_IDS, stableReadModelPayloadHash } from './initialSnapshotWriter';
import { READ_MODEL_APPLIED_OPS_PATH, applyReadModelDelta, type ReadModelDelta } from './readModelDeltas';
import {
    getSummaryWriteMode,
    isSummaryWriteEnabled,
    isSummaryWriteFailureBlocking,
    type SummaryWriteMode,
} from './readModelActivation';

export const IDEMPOTENCY_KEY_CONFLICT = 'IDEMPOTENCY_KEY_CONFLICT';
export const READ_MODEL_SNAPSHOT_MISSING = 'READ_MODEL_SNAPSHOT_MISSING';
export const PARTIAL_IDEMPOTENCY_UNSUPPORTED = 'PARTIAL_IDEMPOTENCY_UNSUPPORTED';
export const READ_MODEL_DELTA_REQUIRED = 'READ_MODEL_DELTA_REQUIRED';

type ReadModelDocumentMap = Record<ReadModelName, Record<string, unknown>>;

export type CommitLegacyWithReadModelDeltasResult = {
    status:
        | 'legacy_only'
        | 'applied'
        | 'idempotent'
        | 'shadow_failed_legacy_committed';
    summaryWriteMode: SummaryWriteMode;
    appliedOperations: number;
    skippedOperations: number;
    affectedSummaries: ReadModelName[];
    error?: string;
};

export type CommitLegacyWithReadModelDeltasInput = {
    userDocRef: FirestoreDocumentReference;
    batch: FirestoreWriteBatch;
    deltas?: readonly ReadModelDelta[];
    summaryWriteMode?: SummaryWriteMode | string;
};

function uniqueReadModelNames(names: readonly ReadModelName[]): ReadModelName[] {
    return Array.from(new Set(names));
}

function readModelsFromDocuments(docs: ReadModelDocumentMap): DashboardReadModelSet {
    const dashboard = docs.dashboard_summary as DashboardReadModelSet['dashboard'];
    return {
        mode: 'shadow',
        meta: dashboard.meta,
        dashboard,
        treasury: docs.treasury_summary as DashboardReadModelSet['treasury'],
        portfolio: docs.portfolio_summary as DashboardReadModelSet['portfolio'],
        clients: docs.clients_summary as DashboardReadModelSet['clients'],
        investors: docs.investors_summary as DashboardReadModelSet['investors'],
        services: docs.services_summary as DashboardReadModelSet['services'],
        financial: docs.financial_summary as DashboardReadModelSet['financial'],
    };
}

function envelope(readModelName: ReadModelName, readModel: Record<string, unknown>, payloadHash: string, updatedAt: number): Record<string, unknown> {
    const meta = (readModel.meta || {}) as Record<string, unknown>;
    return {
        ...readModel,
        readModelName,
        schemaVersion: meta.schemaVersion,
        revision: readModel.revision,
        snapshotRevision: meta.snapshotRevision,
        generationId: meta.generationId,
        payloadHash,
        updatedAt,
        writeMode: 'incremental_delta',
        sourceOfTruth: 'legacy_writer',
        firestoreUpdatedAt: updatedAt,
    };
}

async function readSnapshotDocuments(
    transaction: FirestoreTransaction,
    userDocRef: FirestoreDocumentReference,
): Promise<ReadModelDocumentMap> {
    const collectionRef = userDocRef.collection('read_models');
    const docs = {} as ReadModelDocumentMap;
    for (const docId of INITIAL_READ_MODEL_DOCUMENT_IDS) {
        const snap = await transaction.get(collectionRef.doc(docId));
        if (!snap.exists) {
            throw new Error(`${READ_MODEL_SNAPSHOT_MISSING}:${docId}`);
        }
        docs[docId] = snap.data() as Record<string, unknown>;
    }
    return docs;
}

function replayBatchIntoTransaction(transaction: FirestoreTransaction, batch: FirestoreWriteBatch): void {
    batch.operations.forEach((operation) => {
        if (operation.kind === 'set') {
            transaction.set(operation.ref, operation.data, operation.options);
        }
        else if (operation.kind === 'update') {
            transaction.update(operation.ref, operation.data);
        }
        else {
            transaction.delete(operation.ref);
        }
    });
}

function unappliedDeltasOrThrow(applied: Array<{ exists: boolean; payloadHash?: string }>, deltas: readonly ReadModelDelta[]): ReadModelDelta[] {
    const pending: ReadModelDelta[] = [];
    let skipped = 0;
    deltas.forEach((delta, index) => {
        const existing = applied[index];
        if (!existing.exists) {
            pending.push(delta);
            return;
        }
        if (existing.payloadHash !== delta.payloadHash) {
            throw new Error(`${IDEMPOTENCY_KEY_CONFLICT}:${delta.operationId}`);
        }
        skipped += 1;
    });
    if (skipped > 0 && pending.length > 0) {
        throw new Error(PARTIAL_IDEMPOTENCY_UNSUPPORTED);
    }
    return pending;
}

async function commitReadModelTransaction(input: Required<Pick<CommitLegacyWithReadModelDeltasInput, 'userDocRef' | 'batch'>> & {
    deltas: readonly ReadModelDelta[];
    summaryWriteMode: SummaryWriteMode;
}): Promise<CommitLegacyWithReadModelDeltasResult> {
    const { userDocRef, batch, deltas, summaryWriteMode } = input;
    return userDocRef.firestore.runTransaction(async (transaction) => {
        const appliedRefs = deltas.map((delta) => userDocRef.collection(READ_MODEL_APPLIED_OPS_PATH).doc(delta.operationId));
        const appliedSnaps = [];
        for (const ref of appliedRefs) {
            appliedSnaps.push(await transaction.get(ref));
        }
        const appliedState = appliedSnaps.map((snap) => ({
            exists: snap.exists,
            payloadHash: snap.exists ? String(snap.data()?.payloadHash || '') : undefined,
        }));
        const pendingDeltas = unappliedDeltasOrThrow(appliedState, deltas);
        const skippedOperations = deltas.length - pendingDeltas.length;
        if (pendingDeltas.length === 0) {
            return {
                status: 'idempotent',
                summaryWriteMode,
                appliedOperations: 0,
                skippedOperations,
                affectedSummaries: [],
            } satisfies CommitLegacyWithReadModelDeltasResult;
        }

        let nextSnapshot = readModelsFromDocuments(await readSnapshotDocuments(transaction, userDocRef));
        pendingDeltas.forEach((delta) => {
            nextSnapshot = applyReadModelDelta(nextSnapshot, delta);
        });

        replayBatchIntoTransaction(transaction, batch);

        const affectedSummaries = uniqueReadModelNames(pendingDeltas.flatMap((delta) => delta.affectedSummaries));
        const docs: ReadModelDocumentMap = {
            dashboard_summary: nextSnapshot.dashboard as unknown as Record<string, unknown>,
            treasury_summary: nextSnapshot.treasury as unknown as Record<string, unknown>,
            portfolio_summary: nextSnapshot.portfolio as unknown as Record<string, unknown>,
            clients_summary: nextSnapshot.clients as unknown as Record<string, unknown>,
            investors_summary: nextSnapshot.investors as unknown as Record<string, unknown>,
            services_summary: nextSnapshot.services as unknown as Record<string, unknown>,
            financial_summary: nextSnapshot.financial as unknown as Record<string, unknown>,
        };
        const updatedAt = Date.now();
        const nextPayloadHash = stableReadModelPayloadHash(nextSnapshot);
        affectedSummaries.forEach((docId) => {
            transaction.set(
                userDocRef.collection('read_models').doc(docId),
                envelope(docId, docs[docId], nextPayloadHash, updatedAt),
                { merge: false },
            );
        });
        pendingDeltas.forEach((delta) => {
            transaction.set(userDocRef.collection(READ_MODEL_APPLIED_OPS_PATH).doc(delta.operationId), {
                operationId: delta.operationId,
                payloadHash: delta.payloadHash,
                generationId: nextSnapshot.meta.generationId,
                affectedSummaries: delta.affectedSummaries,
                effectiveAt: delta.effectiveAt,
                appliedAt: updatedAt,
                summaryPayloadHash: nextPayloadHash,
            }, { merge: false });
        });
        return {
            status: 'applied',
            summaryWriteMode,
            appliedOperations: pendingDeltas.length,
            skippedOperations,
            affectedSummaries,
        } satisfies CommitLegacyWithReadModelDeltasResult;
    });
}

export async function applyReadModelDeltasWithinTransaction(input: {
    userDocRef: FirestoreDocumentReference;
    transaction: FirestoreTransaction;
    deltas?: readonly ReadModelDelta[];
    summaryWriteMode?: SummaryWriteMode | string;
}): Promise<CommitLegacyWithReadModelDeltasResult> {
    const summaryWriteMode = getSummaryWriteMode(input.summaryWriteMode);
    const deltas = input.deltas?.filter(Boolean) || [];
    if (summaryWriteMode === 'read' && deltas.length === 0) {
        throw new Error(READ_MODEL_DELTA_REQUIRED);
    }
    if (!isSummaryWriteEnabled(summaryWriteMode) || deltas.length === 0) {
        return {
            status: 'legacy_only',
            summaryWriteMode,
            appliedOperations: 0,
            skippedOperations: 0,
            affectedSummaries: [],
        };
    }

    try {
        const appliedRefs = deltas.map((delta) => input.userDocRef.collection(READ_MODEL_APPLIED_OPS_PATH).doc(delta.operationId));
        const appliedSnaps = [];
        for (const ref of appliedRefs) {
            appliedSnaps.push(await input.transaction.get(ref));
        }
        const appliedState = appliedSnaps.map((snap) => ({
            exists: snap.exists,
            payloadHash: snap.exists ? String(snap.data()?.payloadHash || '') : undefined,
        }));
        const pendingDeltas = unappliedDeltasOrThrow(appliedState, deltas);
        const skippedOperations = deltas.length - pendingDeltas.length;
        if (pendingDeltas.length === 0) {
            return {
                status: 'idempotent',
                summaryWriteMode,
                appliedOperations: 0,
                skippedOperations,
                affectedSummaries: [],
            };
        }

        let nextSnapshot = readModelsFromDocuments(await readSnapshotDocuments(input.transaction, input.userDocRef));
        pendingDeltas.forEach((delta) => {
            nextSnapshot = applyReadModelDelta(nextSnapshot, delta);
        });

        const affectedSummaries = uniqueReadModelNames(pendingDeltas.flatMap((delta) => delta.affectedSummaries));
        const docs: ReadModelDocumentMap = {
            dashboard_summary: nextSnapshot.dashboard as unknown as Record<string, unknown>,
            treasury_summary: nextSnapshot.treasury as unknown as Record<string, unknown>,
            portfolio_summary: nextSnapshot.portfolio as unknown as Record<string, unknown>,
            clients_summary: nextSnapshot.clients as unknown as Record<string, unknown>,
            investors_summary: nextSnapshot.investors as unknown as Record<string, unknown>,
            services_summary: nextSnapshot.services as unknown as Record<string, unknown>,
            financial_summary: nextSnapshot.financial as unknown as Record<string, unknown>,
        };
        const updatedAt = Date.now();
        const nextPayloadHash = stableReadModelPayloadHash(nextSnapshot);
        affectedSummaries.forEach((docId) => {
            input.transaction.set(
                input.userDocRef.collection('read_models').doc(docId),
                envelope(docId, docs[docId], nextPayloadHash, updatedAt),
                { merge: false },
            );
        });
        pendingDeltas.forEach((delta) => {
            input.transaction.set(input.userDocRef.collection(READ_MODEL_APPLIED_OPS_PATH).doc(delta.operationId), {
                operationId: delta.operationId,
                payloadHash: delta.payloadHash,
                generationId: nextSnapshot.meta.generationId,
                affectedSummaries: delta.affectedSummaries,
                effectiveAt: delta.effectiveAt,
                appliedAt: updatedAt,
                summaryPayloadHash: nextPayloadHash,
            }, { merge: false });
        });
        return {
            status: 'applied',
            summaryWriteMode,
            appliedOperations: pendingDeltas.length,
            skippedOperations,
            affectedSummaries,
        };
    }
    catch (error) {
        if (isSummaryWriteFailureBlocking(summaryWriteMode)) {
            throw error;
        }
        console.warn('[read-model summary_write_shadow failure]', error);
        return {
            status: 'shadow_failed_legacy_committed',
            summaryWriteMode,
            appliedOperations: 0,
            skippedOperations: 0,
            affectedSummaries: [],
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

export async function commitLegacyWithReadModelDeltas(
    input: CommitLegacyWithReadModelDeltasInput,
): Promise<CommitLegacyWithReadModelDeltasResult> {
    const summaryWriteMode = getSummaryWriteMode(input.summaryWriteMode);
    const deltas = input.deltas?.filter(Boolean) || [];
    if (summaryWriteMode === 'read' && deltas.length === 0 && input.batch.operations.length > 0) {
        throw new Error(READ_MODEL_DELTA_REQUIRED);
    }
    if (!isSummaryWriteEnabled(summaryWriteMode) || deltas.length === 0) {
        await input.batch.commit();
        return {
            status: 'legacy_only',
            summaryWriteMode,
            appliedOperations: 0,
            skippedOperations: 0,
            affectedSummaries: [],
        };
    }

    try {
        return await commitReadModelTransaction({
            userDocRef: input.userDocRef,
            batch: input.batch,
            deltas,
            summaryWriteMode,
        });
    }
    catch (error) {
        if (isSummaryWriteFailureBlocking(summaryWriteMode)) {
            throw error;
        }
        console.warn('[read-model summary_write_shadow failure]', error);
        await input.batch.commit();
        return {
            status: 'shadow_failed_legacy_committed',
            summaryWriteMode,
            appliedOperations: 0,
            skippedOperations: 0,
            affectedSummaries: [],
            error: error instanceof Error ? error.message : String(error),
        };
    }
}
