import assert from 'node:assert/strict';
import type { ClientDzd, ClientTransactionDzd, Investor, InvestorTransaction, TreasuryTx, Tx } from './types';
import { applyTransactionDelete, LEGACY_EDIT_SOURCE_NOT_FOUND, LEGACY_LINKED_ROWS_INCOMPLETE } from './transactionService';
import { buildDashboardReadModelShadowFromLegacy, type DashboardReadModelSet, type ReadModelName } from './readModels/dashboardReadModels';
import { INITIAL_READ_MODEL_DOCUMENT_IDS } from './readModels/initialSnapshotWriter';
import { READ_MODEL_APPLIED_OPS_PATH, buildReadModelDelta, transitionClientBalanceDelta } from './readModels/readModelDeltas';
import { createLegacyOperationIndexDoc, legacyOperationIndexId, LEGACY_OPERATION_INDEX_COLLECTION } from './readModels/operationIndex';

type Store = Map<string, Record<string, unknown>>;
type Filter = { field: string; op: string; value: unknown };

const asOf = new Date('2026-08-26T10:00:00.000Z').getTime();

class FakeDocRef {
    constructor(readonly store: Store, readonly path: string, readonly firestore?: FakeFirestore) {}

    get id() {
        return this.path.split('/').pop() || '';
    }

    collection(name: string) {
        return new FakeCollectionRef(this.store, `${this.path}/${name}`, this.firestore);
    }

    async get() {
        const value = this.store.get(this.path);
        return {
            id: this.id,
            exists: Boolean(value),
            data: () => value,
            ref: this,
        };
    }
}

class FakeCollectionRef {
    constructor(private readonly store: Store, private readonly path: string, private readonly firestore?: FakeFirestore) {}

    doc(id = `auto-${Math.random().toString(36).slice(2)}`) {
        return new FakeDocRef(this.store, `${this.path}/${id}`, this.firestore);
    }

    where(field: string, op: string, value: unknown) {
        return new FakeQuery(this.store, this.path, [{ field, op, value }], undefined, this.firestore);
    }
}

class FakeQuery {
    constructor(
        private readonly store: Store,
        private readonly path: string,
        private readonly filters: Filter[],
        private readonly maxDocs?: number,
        private readonly firestore?: FakeFirestore,
    ) {}

    where(field: string, op: string, value: unknown) {
        return new FakeQuery(this.store, this.path, [...this.filters, { field, op, value }], this.maxDocs, this.firestore);
    }

    limit(maxDocs: number) {
        return new FakeQuery(this.store, this.path, this.filters, maxDocs, this.firestore);
    }

    async get() {
        const prefix = `${this.path}/`;
        const docs = Array.from(this.store.entries())
            .filter(([path]) => path.startsWith(prefix) && !path.slice(prefix.length).includes('/'))
            .map(([path, data]) => {
                const ref = new FakeDocRef(this.store, path, this.firestore);
                return { id: ref.id, ref, data: () => data };
            })
            .filter((doc) => this.filters.every((filter) => {
                const actual = doc.data()[filter.field];
                if (filter.op === '==') return actual === filter.value;
                if (filter.op === 'array-contains') return Array.isArray(actual) && actual.includes(filter.value);
                if (filter.op === '>=') return Number(actual) >= Number(filter.value);
                if (filter.op === '<=') return Number(actual) <= Number(filter.value);
                return false;
            }));
        return {
            docs: this.maxDocs ? docs.slice(0, this.maxDocs) : docs,
            forEach: (fn: (doc: { id: string; ref: FakeDocRef; data: () => Record<string, unknown> }) => void) => {
                (this.maxDocs ? docs.slice(0, this.maxDocs) : docs).forEach(fn);
            },
        };
    }
}

class FakeBatch {
    readonly operations: Array<
        | { kind: 'set'; ref: FakeDocRef; data: Record<string, unknown>; options?: unknown }
        | { kind: 'update'; ref: FakeDocRef; data: Record<string, unknown> }
        | { kind: 'delete'; ref: FakeDocRef }
    > = [];
    commitCount = 0;

    constructor(private readonly store: Store) {}

    set(ref: FakeDocRef, data: Record<string, unknown>, options?: unknown) {
        this.operations.push({ kind: 'set', ref, data, options });
    }

    update(ref: FakeDocRef, data: Record<string, unknown>) {
        this.operations.push({ kind: 'update', ref, data });
    }

    delete(ref: FakeDocRef) {
        this.operations.push({ kind: 'delete', ref });
    }

    async commit() {
        this.commitCount += 1;
        replay(this.store, this.operations);
    }
}

class FakeTransaction {
    constructor(private readonly store: Store) {}

    async get(ref: FakeDocRef) {
        return ref.get();
    }

    set(ref: FakeDocRef, data: Record<string, unknown>) {
        this.store.set(ref.path, data);
    }

    update(ref: FakeDocRef, data: Record<string, unknown>) {
        this.store.set(ref.path, { ...(this.store.get(ref.path) || {}), ...data });
    }

    delete(ref: FakeDocRef) {
        this.store.delete(ref.path);
    }
}

class FakeFirestore {
    constructor(private readonly store: Store) {}

    batch() {
        return new FakeBatch(this.store);
    }

    async runTransaction<T>(fn: (transaction: FakeTransaction) => Promise<T>): Promise<T> {
        return fn(new FakeTransaction(this.store));
    }
}

class FakeUserDocRef extends FakeDocRef {
    readonly firestore: FakeFirestore;

    constructor(store: Store) {
        const firestore = new FakeFirestore(store);
        super(store, 'users/test-user', firestore);
        this.firestore = firestore;
    }
}

function replay(store: Store, operations: FakeBatch['operations']) {
    operations.forEach((operation) => {
        if (operation.kind === 'set') store.set(operation.ref.path, operation.data);
        else if (operation.kind === 'update') store.set(operation.ref.path, { ...(store.get(operation.ref.path) || {}), ...operation.data });
        else store.delete(operation.ref.path);
    });
}

function readModelDoc(snapshot: DashboardReadModelSet, name: ReadModelName): Record<string, unknown> {
    if (name === 'dashboard_summary') return snapshot.dashboard as unknown as Record<string, unknown>;
    if (name === 'treasury_summary') return snapshot.treasury as unknown as Record<string, unknown>;
    if (name === 'portfolio_summary') return snapshot.portfolio as unknown as Record<string, unknown>;
    if (name === 'clients_summary') return snapshot.clients as unknown as Record<string, unknown>;
    if (name === 'investors_summary') return snapshot.investors as unknown as Record<string, unknown>;
    if (name === 'services_summary') return snapshot.services as unknown as Record<string, unknown>;
    return snapshot.financial as unknown as Record<string, unknown>;
}

function seedReadModels(store: Store, snapshot: DashboardReadModelSet) {
    INITIAL_READ_MODEL_DOCUMENT_IDS.forEach((docId) => {
        store.set(`users/test-user/read_models/${docId}`, readModelDoc(snapshot, docId));
    });
}

function clientSettlementSnapshot() {
    const clientTx = {
        id: 'client-tx-1',
        clientId: 'client-1',
        timestamp: asOf,
        date: '26/08/2026',
        time: '10:00',
        montant: 500,
        type: 'Règlement Reçu',
        paymentMethod: 'Espèces',
        linkedTxId: 'treasury-tx-1',
    } as ClientTransactionDzd;
    const treasuryTx = {
        id: 'treasury-tx-1',
        timestamp: asOf,
        date: '26/08/2026',
        time: '10:00',
        type: 'Ajout',
        source: 'Caisse',
        amount: 500,
        linkedTxId: 'client-tx-1',
        origin: 'client_tx',
    } as TreasuryTx;
    return buildDashboardReadModelShadowFromLegacy({
        transactions: [] as Tx[],
        clientsDzd: [{ id: 'client-1', fullName: 'Client Test' } as ClientDzd],
        clientTransactionsDzd: [clientTx],
        treasuryTransactions: [treasuryTx],
        treasuryCards: [],
        manualAssets: [],
        manualAssetClients: [],
        manualAssetTransactions: [],
        digitalServiceTransactions: [],
        investors: [] as Investor[],
        investorTransactions: [] as InvestorTransaction[],
        managerFeePercentage: 30,
        managerFeeHistory: [{ id: 'initial', percentage: 30, effectiveFrom: asOf - 1, createdAt: asOf - 1 }],
        ownerOpeningCapital: 0,
        preTrackingPersonalExpenses: 0,
        getClientFullName: (client) => client.fullName,
        asOf,
        generationId: 'tx-lifecycle-test',
        snapshotRevision: 1,
    });
}

function seedClientSettlement(store: Store) {
    seedReadModels(store, clientSettlementSnapshot());
    store.set('users/test-user/dzd_client_txs/client-tx-1', {
        clientId: 'client-1',
        timestamp: asOf,
        montant: 500,
        type: 'Règlement Reçu',
        paymentMethod: 'Espèces',
        linkedTxId: 'treasury-tx-1',
    });
    store.set('users/test-user/treasury_txs/treasury-tx-1', {
        timestamp: asOf,
        type: 'Ajout',
        source: 'Caisse',
        amount: 500,
        linkedTxId: 'client-tx-1',
        origin: 'client_tx',
    });
    store.set(
        `users/test-user/${LEGACY_OPERATION_INDEX_COLLECTION}/${legacyOperationIndexId('client_tx', 'client-tx-1')}`,
        createLegacyOperationIndexDoc({
            transactionId: 'client-tx-1',
            transactionType: 'client_tx',
            updatedAt: asOf,
            linkedRows: [{ collection: 'treasury_txs', id: 'treasury-tx-1', transactionType: 'treasury_tx' }],
        }),
    );
}

{
    const store = new Map<string, Record<string, unknown>>();
    seedClientSettlement(store);
    const userDocRef = new FakeUserDocRef(store);
    let hydratedLinkedRowsSeen = false;
    const result = await applyTransactionDelete(
        'client-tx-1',
        'client_tx',
        userDocRef as any,
        (resolvedType, resolvedTxId, mainData, linkedData) => {
            assert.equal(resolvedType, 'client_tx');
            assert.equal(resolvedTxId, 'client-tx-1');
            assert.equal(mainData.montant, 500);
            assert.equal(linkedData[0]?.amount, 500);
            hydratedLinkedRowsSeen = true;
            return buildReadModelDelta({
                operationId: `legacy:delete-build:dzd_client_txs:${resolvedTxId}`,
                effectiveAt: asOf,
                payload: { type: 'client_settlement_delete_test', txId: resolvedTxId },
                affectedSummaries: ['dashboard_summary', 'clients_summary', 'treasury_summary', 'financial_summary'],
                clients: transitionClientBalanceDelta(0, 500),
                wallets: { Caisse: 500 },
            });
        },
        { summaryWriteMode: 'read' },
    );

    assert.equal(result.success, true);
    assert.equal(hydratedLinkedRowsSeen, true, 'operation index rows must be hydrated before old-delta build');
    assert.equal(store.has('users/test-user/dzd_client_txs/client-tx-1'), false);
    assert.equal(store.has('users/test-user/treasury_txs/treasury-tx-1'), false);
    assert.equal(store.get('users/test-user/read_models/treasury_summary')?.caisseBalance, 0);
    assert.equal(store.get('users/test-user/read_models/clients_summary')?.totalAdvances, 0);
    const markerPath = `users/test-user/${READ_MODEL_APPLIED_OPS_PATH}/legacy:delete:dzd_client_txs:client-tx-1`;
    assert.equal(store.get(markerPath)?.operationId, 'legacy:delete:dzd_client_txs:client-tx-1');

    const retry = await applyTransactionDelete(
        'client-tx-1',
        'client_tx',
        userDocRef as any,
        () => {
            throw new Error('retry must not rebuild old delta');
        },
        { summaryWriteMode: 'read' },
    );
    assert.equal(retry.success, true);
}

{
    const store = new Map<string, Record<string, unknown>>();
    seedClientSettlement(store);
    store.delete('users/test-user/treasury_txs/treasury-tx-1');
    const result = await applyTransactionDelete(
        'client-tx-1',
        'client_tx',
        new FakeUserDocRef(store) as any,
        () => null,
        { summaryWriteMode: 'read' },
    );
    assert.equal(result.success, false);
    assert.match(result.error || '', new RegExp(LEGACY_LINKED_ROWS_INCOMPLETE));
}

{
    const store = new Map<string, Record<string, unknown>>();
    seedReadModels(store, clientSettlementSnapshot());
    const result = await applyTransactionDelete(
        'missing-client-tx',
        'client_tx',
        new FakeUserDocRef(store) as any,
        () => null,
        { summaryWriteMode: 'read' },
    );
    assert.equal(result.success, false);
    assert.match(result.error || '', new RegExp(LEGACY_EDIT_SOURCE_NOT_FOUND));
}

console.log('transaction service lifecycle tests passed');
