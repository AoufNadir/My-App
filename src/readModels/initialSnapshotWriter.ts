import {
    buildDashboardReadModelShadowFromLegacy,
    reconcileDashboardReadModelsWithLegacy,
    type BuildDashboardReadModelsInput,
    type DashboardReadModelLegacyBaseline,
    type DashboardReadModelReconciliation,
    type DashboardReadModelSet,
    type ReadModelName,
} from './dashboardReadModels';

export const INITIAL_READ_MODEL_DOCUMENT_IDS: ReadModelName[] = [
    'dashboard_summary',
    'treasury_summary',
    'portfolio_summary',
    'clients_summary',
    'investors_summary',
    'services_summary',
    'financial_summary',
];

type SnapshotData = Record<string, unknown> | undefined;

export type ManualSnapshotDocumentSnapshot = {
    exists: boolean;
    data: () => SnapshotData;
};

export type ManualSnapshotDocumentReference = {
    get: () => Promise<ManualSnapshotDocumentSnapshot>;
};

export type ManualSnapshotCollectionReference = {
    doc: (id: string) => ManualSnapshotDocumentReference;
};

export type ManualSnapshotWriteBatch = {
    set: (ref: ManualSnapshotDocumentReference, data: Record<string, unknown>, options?: { merge?: boolean }) => void;
    commit: () => Promise<void>;
};

export type ManualSnapshotUserDocumentReference = {
    collection: (name: string) => ManualSnapshotCollectionReference;
    firestore: {
        batch: () => ManualSnapshotWriteBatch;
    };
};

export type InitialReadModelSnapshotPreparation = {
    readModels: DashboardReadModelSet;
    reconciliation: DashboardReadModelReconciliation;
    payloadHash: string;
};

export type InitialReadModelSnapshotWriteStatus =
    | 'written'
    | 'already_exists'
    | 'conflict'
    | 'reconciliation_failed';

export type InitialReadModelSnapshotWriteResult = InitialReadModelSnapshotPreparation & {
    status: InitialReadModelSnapshotWriteStatus;
    wrote: boolean;
    documentIds: ReadModelName[];
    existingPayloadHash?: string;
    reason?: string;
};

export type WriteInitialReadModelSnapshotInput = {
    userDocRef: ManualSnapshotUserDocumentReference;
    buildInput: BuildDashboardReadModelsInput;
    legacyBaseline: DashboardReadModelLegacyBaseline;
    toleranceDzd?: number;
    allowOverwrite?: boolean;
    serverTimestamp?: () => unknown;
};

function normalizeForStableStringify(value: unknown): unknown {
    if (Array.isArray(value))
        return value.map(normalizeForStableStringify);
    if (value && typeof value === 'object') {
        const normalized: Record<string, unknown> = {};
        Object.keys(value as Record<string, unknown>).sort().forEach((key) => {
            normalized[key] = normalizeForStableStringify((value as Record<string, unknown>)[key]);
        });
        return normalized;
    }
    if (typeof value === 'number' && !Number.isFinite(value))
        return null;
    return value;
}

export function stableReadModelStringify(value: unknown): string {
    return JSON.stringify(normalizeForStableStringify(value));
}

export function stableReadModelPayloadHash(value: unknown): string {
    const input = stableReadModelStringify(value);
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    for (let index = 0; index < input.length; index += 1) {
        const char = input.charCodeAt(index);
        h1 = Math.imul(h1 ^ char, 2654435761);
        h2 = Math.imul(h2 ^ char, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return `${(h2 >>> 0).toString(16).padStart(8, '0')}${(h1 >>> 0).toString(16).padStart(8, '0')}`;
}

export function prepareInitialReadModelSnapshot(input: {
    buildInput: BuildDashboardReadModelsInput;
    legacyBaseline: DashboardReadModelLegacyBaseline;
    toleranceDzd?: number;
}): InitialReadModelSnapshotPreparation {
    const readModels = buildDashboardReadModelShadowFromLegacy(input.buildInput);
    const reconciliation = reconcileDashboardReadModelsWithLegacy(
        readModels,
        input.legacyBaseline,
        input.toleranceDzd ?? 0.01,
    );
    const payloadHash = stableReadModelPayloadHash(readModels);
    return { readModels, reconciliation, payloadHash };
}

function readModelDocuments(readModels: DashboardReadModelSet): Record<ReadModelName, unknown> {
    return {
        dashboard_summary: readModels.dashboard,
        treasury_summary: readModels.treasury,
        portfolio_summary: readModels.portfolio,
        clients_summary: readModels.clients,
        investors_summary: readModels.investors,
        services_summary: readModels.services,
        financial_summary: readModels.financial,
    };
}

function snapshotWriteEnvelope(input: {
    readModelName: ReadModelName;
    readModel: unknown;
    payloadHash: string;
    firestoreUpdatedAt: unknown;
}): Record<string, unknown> {
    const readModel = input.readModel as Record<string, unknown>;
    const meta = (readModel.meta || {}) as Record<string, unknown>;
    return {
        ...readModel,
        readModelName: input.readModelName,
        schemaVersion: meta.schemaVersion,
        revision: readModel.revision,
        snapshotRevision: meta.snapshotRevision,
        generationId: meta.generationId,
        payloadHash: input.payloadHash,
        updatedAt: meta.updatedAt,
        writeMode: 'manual_initial_snapshot',
        sourceOfTruth: 'legacy_rebuild',
        firestoreUpdatedAt: input.firestoreUpdatedAt,
    };
}

export async function writeInitialReadModelSnapshot(
    input: WriteInitialReadModelSnapshotInput,
): Promise<InitialReadModelSnapshotWriteResult> {
    const prepared = prepareInitialReadModelSnapshot({
        buildInput: input.buildInput,
        legacyBaseline: input.legacyBaseline,
        toleranceDzd: input.toleranceDzd,
    });
    const documentIds = [...INITIAL_READ_MODEL_DOCUMENT_IDS];
    if (!prepared.reconciliation.ok) {
        return {
            ...prepared,
            status: 'reconciliation_failed',
            wrote: false,
            documentIds,
            reason: 'Legacy and read model values differ beyond tolerance.',
        };
    }

    const readModelsCollection = input.userDocRef.collection('read_models');
    const dashboardRef = readModelsCollection.doc('dashboard_summary');
    const existingSnapshot = await dashboardRef.get();
    if (existingSnapshot.exists) {
        const existingPayloadHash = String(existingSnapshot.data()?.payloadHash || '');
        if (existingPayloadHash === prepared.payloadHash) {
            return {
                ...prepared,
                status: 'already_exists',
                wrote: false,
                documentIds,
                existingPayloadHash,
            };
        }
        if (!input.allowOverwrite) {
            return {
                ...prepared,
                status: 'conflict',
                wrote: false,
                documentIds,
                existingPayloadHash,
                reason: 'Existing dashboard_summary has a different payloadHash. Pass allowOverwrite explicitly after review.',
            };
        }
    }

    const batch = input.userDocRef.firestore.batch();
    const firestoreUpdatedAt = input.serverTimestamp ? input.serverTimestamp() : Date.now();
    const docs = readModelDocuments(prepared.readModels);
    documentIds.forEach((docId) => {
        batch.set(
            readModelsCollection.doc(docId),
            snapshotWriteEnvelope({
                readModelName: docId,
                readModel: docs[docId],
                payloadHash: prepared.payloadHash,
                firestoreUpdatedAt,
            }),
            { merge: false },
        );
    });
    await batch.commit();
    return {
        ...prepared,
        status: 'written',
        wrote: true,
        documentIds,
    };
}
