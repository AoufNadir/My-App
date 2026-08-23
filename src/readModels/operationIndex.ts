export const LEGACY_OPERATION_INDEX_COLLECTION = 'legacy_operation_index';
export const OPERATION_INDEX_REQUIRED = 'OPERATION_INDEX_REQUIRED';
export const OPERATION_INDEX_SCHEMA_VERSION = 1;

export type LegacyMutationTransactionType = 'usdt_tx' | 'client_tx' | 'treasury_tx' | 'asset_tx';

export type IndexedFinancialRow = {
    collection: string;
    id: string;
    role?: 'root' | 'linked' | 'counterpart' | 'derived';
    transactionType?: LegacyMutationTransactionType;
};

export type LegacyOperationIndexDoc = {
    schemaVersion: typeof OPERATION_INDEX_SCHEMA_VERSION;
    operationId: string;
    source: 'legacy.edit-delete';
    status: 'active' | 'deleted';
    root: IndexedFinancialRow;
    linkedRows: IndexedFinancialRow[];
    updatedAt: number;
    deletedAt?: number;
};

const LEGACY_COLLECTION_BY_TYPE: Record<LegacyMutationTransactionType, string> = {
    usdt_tx: 'usdt_txs',
    client_tx: 'dzd_client_txs',
    treasury_tx: 'treasury_txs',
    asset_tx: 'actifTransactions',
};

const TYPE_BY_LEGACY_COLLECTION: Record<string, LegacyMutationTransactionType> = {
    usdt_txs: 'usdt_tx',
    dzd_client_txs: 'client_tx',
    treasury_txs: 'treasury_tx',
    actifTransactions: 'asset_tx',
};

export function sanitizeOperationIndexId(value: string): string {
    return String(value || '')
        .trim()
        .replace(/\//g, '__slash__')
        .replace(/\s+/g, '_')
        .slice(0, 900);
}

export function legacyOperationIndexId(transactionType: LegacyMutationTransactionType, transactionId: string): string {
    return sanitizeOperationIndexId(`legacy:${transactionType}:${transactionId}`);
}

export function deterministicLinkedId(rootTransactionId: string, role: string): string {
    return sanitizeOperationIndexId(`${rootTransactionId}:${role}`);
}

export function legacyCollectionForType(transactionType: LegacyMutationTransactionType): string {
    return LEGACY_COLLECTION_BY_TYPE[transactionType];
}

export function legacyTypeForCollection(collection: string): LegacyMutationTransactionType | undefined {
    return TYPE_BY_LEGACY_COLLECTION[collection];
}

export function normalizeIndexedRow(row: IndexedFinancialRow): IndexedFinancialRow {
    const collection = String(row.collection || '').trim();
    const id = String(row.id || '').trim();
    const transactionType = row.transactionType || legacyTypeForCollection(collection);
    return {
        collection,
        id,
        role: row.role || 'linked',
        transactionType,
    };
}

export function dedupeIndexedRows(rows: readonly IndexedFinancialRow[]): IndexedFinancialRow[] {
    const byKey = new Map<string, IndexedFinancialRow>();
    rows.forEach((row) => {
        const normalized = normalizeIndexedRow(row);
        if (!normalized.collection || !normalized.id) return;
        const key = `${normalized.collection}/${normalized.id}`;
        byKey.set(key, normalized);
    });
    return Array.from(byKey.values()).sort((a, b) => {
        const left = `${a.collection}/${a.id}`;
        const right = `${b.collection}/${b.id}`;
        return left.localeCompare(right);
    });
}

export function createLegacyOperationIndexDoc(input: {
    transactionId: string;
    transactionType: LegacyMutationTransactionType;
    linkedRows: readonly IndexedFinancialRow[];
    updatedAt: number;
    deletedAt?: number;
    status?: 'active' | 'deleted';
}): LegacyOperationIndexDoc {
    const operationId = legacyOperationIndexId(input.transactionType, input.transactionId);
    const root = normalizeIndexedRow({
        collection: legacyCollectionForType(input.transactionType),
        id: input.transactionId,
        role: 'root',
        transactionType: input.transactionType,
    });
    const linkedRows = dedupeIndexedRows(input.linkedRows)
        .filter((row) => !(row.collection === root.collection && row.id === root.id));
    const doc: LegacyOperationIndexDoc = {
        schemaVersion: OPERATION_INDEX_SCHEMA_VERSION,
        operationId,
        source: 'legacy.edit-delete',
        status: input.status || 'active',
        root,
        linkedRows,
        updatedAt: input.updatedAt,
    };
    if (input.deletedAt !== undefined) {
        doc.deletedAt = input.deletedAt;
    }
    return doc;
}

export function flattenLegacyOperationIndexRows(index: LegacyOperationIndexDoc | null | undefined): IndexedFinancialRow[] {
    if (!index || index.status === 'deleted') return [];
    return dedupeIndexedRows([index.root, ...(index.linkedRows || [])]);
}

export function isOperationIndexRequiredError(error?: string): boolean {
    return error === OPERATION_INDEX_REQUIRED;
}
