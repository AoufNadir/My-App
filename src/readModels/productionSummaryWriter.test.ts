import assert from 'node:assert/strict';
import type { ClientDzd, ClientTransactionDzd, Investor, InvestorTransaction, TreasuryTx, Tx } from '../types';
import { buildDashboardReadModelShadowFromLegacy, type DashboardReadModelSet, type ReadModelName } from './dashboardReadModels';
import { INITIAL_READ_MODEL_DOCUMENT_IDS } from './initialSnapshotWriter';
import { buildReadModelDelta } from './readModelDeltas';
import {
    IDEMPOTENCY_KEY_CONFLICT,
    READ_MODEL_DELTA_REQUIRED,
    READ_MODEL_SNAPSHOT_MISSING,
    commitLegacyWithReadModelDeltas,
} from './productionSummaryWriter';

const asOf = new Date('2026-08-23T12:00:00.000Z').getTime();

function baseSnapshot(): DashboardReadModelSet {
    return buildDashboardReadModelShadowFromLegacy({
        transactions: [] as Tx[],
        clientsDzd: [] as ClientDzd[],
        clientTransactionsDzd: [] as ClientTransactionDzd[],
        treasuryTransactions: [
            {
                id: 'opening-cash',
                type: 'Ajout',
                source: 'Caisse',
                amount: 1000,
                date: '23/08/2026',
                time: '12:00',
                timestamp: asOf,
            },
        ] as TreasuryTx[],
        treasuryCards: [],
        manualAssets: [],
        manualAssetClients: [],
        manualAssetTransactions: [],
        digitalServiceTransactions: [],
        investors: [] as Investor[],
        investorTransactions: [] as InvestorTransaction[],
        managerFeePercentage: 30,
        managerFeeHistory: [{ id: 'initial', percentage: 30, effectiveFrom: asOf - 1, createdAt: asOf - 1 }],
        ownerOpeningCapital: 1000,
        preTrackingPersonalExpenses: 0,
        getClientFullName: (client) => client.fullName,
        asOf,
        generationId: 'production-writer-test',
        snapshotRevision: 1,
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

class FakeDocRef {
    constructor(readonly path: string) {}

    get id() {
        return this.path.split('/').pop() || '';
    }

    collection(name: string) {
        return new FakeCollectionRef(`${this.path}/${name}`);
    }
}

class FakeCollectionRef {
    constructor(private readonly prefix: string) {}

    doc(id = `auto-${Math.random().toString(36).slice(2)}`) {
        return new FakeDocRef(`${this.prefix}/${id}`);
    }
}

class FakeTransaction {
    constructor(private readonly store: Map<string, Record<string, unknown>>) {}

    async get(ref: FakeDocRef) {
        const value = this.store.get(ref.path);
        return {
            exists: Boolean(value),
            data: () => value,
        };
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
    failTransactions = false;
    transactionRuns = 0;

    constructor(private readonly store: Map<string, Record<string, unknown>>) {}

    async runTransaction<T>(fn: (transaction: FakeTransaction) => Promise<T>): Promise<T> {
        this.transactionRuns += 1;
        if (this.failTransactions)
            throw new Error('TRANSACTION_FAILED');
        return fn(new FakeTransaction(this.store));
    }
}

class FakeUserDocRef extends FakeDocRef {
    readonly firestore: FakeFirestore;

    constructor(store: Map<string, Record<string, unknown>>) {
        super('users/test-user');
        this.firestore = new FakeFirestore(store);
    }
}

class FakeBatch {
    readonly operations: Array<
        | { kind: 'set'; ref: FakeDocRef; data: Record<string, unknown>; options?: unknown }
        | { kind: 'update'; ref: FakeDocRef; data: Record<string, unknown> }
        | { kind: 'delete'; ref: FakeDocRef }
    > = [];
    commitCount = 0;

    constructor(private readonly store: Map<string, Record<string, unknown>>) {}

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
        this.operations.forEach((operation) => {
            if (operation.kind === 'set') this.store.set(operation.ref.path, operation.data);
            else if (operation.kind === 'update') this.store.set(operation.ref.path, { ...(this.store.get(operation.ref.path) || {}), ...operation.data });
            else this.store.delete(operation.ref.path);
        });
    }
}

function seedReadModels(store: Map<string, Record<string, unknown>>, snapshot = baseSnapshot()) {
    INITIAL_READ_MODEL_DOCUMENT_IDS.forEach((docId) => {
        store.set(`users/test-user/read_models/${docId}`, readModelDoc(snapshot, docId));
    });
}

const delta = buildReadModelDelta({
    operationId: 'op:treasury-add:1',
    effectiveAt: asOf,
    payload: { type: 'treasury_add', amount: 250 },
    affectedSummaries: ['dashboard_summary', 'treasury_summary', 'financial_summary'],
    wallets: { Caisse: 250 },
});

{
    const store = new Map<string, Record<string, unknown>>();
    seedReadModels(store);
    const userDocRef = new FakeUserDocRef(store);
    const batch = new FakeBatch(store);
    batch.set(new FakeDocRef('users/test-user/treasury_txs/tx-1'), { amount: 250 });

    const result = await commitLegacyWithReadModelDeltas({
        userDocRef: userDocRef as any,
        batch: batch as any,
        deltas: [delta],
        summaryWriteMode: 'summary_write_shadow',
    });

    assert.equal(result.status, 'applied');
    assert.equal(batch.commitCount, 0, 'legacy writes must be replayed inside the transaction');
    assert.equal(store.get('users/test-user/treasury_txs/tx-1')?.amount, 250);
    assert.equal(store.get('users/test-user/read_model_applied_ops/op:treasury-add:1')?.payloadHash, delta.payloadHash);
    assert.equal(store.get('users/test-user/read_models/treasury_summary')?.caisseBalance, 1250);
    assert.equal(store.get('users/test-user/read_models/dashboard_summary')?.writeMode, 'incremental_delta');
}

{
    const store = new Map<string, Record<string, unknown>>();
    seedReadModels(store);
    store.set('users/test-user/read_model_applied_ops/op:treasury-add:1', {
        operationId: delta.operationId,
        payloadHash: delta.payloadHash,
    });
    const userDocRef = new FakeUserDocRef(store);
    const batch = new FakeBatch(store);
    batch.set(new FakeDocRef('users/test-user/treasury_txs/tx-duplicate'), { amount: 999 });

    const result = await commitLegacyWithReadModelDeltas({
        userDocRef: userDocRef as any,
        batch: batch as any,
        deltas: [delta],
        summaryWriteMode: 'read',
    });

    assert.equal(result.status, 'idempotent');
    assert.equal(batch.commitCount, 0);
    assert.equal(store.has('users/test-user/treasury_txs/tx-duplicate'), false, 'idempotent retry must not replay legacy writes');
}

{
    const store = new Map<string, Record<string, unknown>>();
    seedReadModels(store);
    store.set('users/test-user/read_model_applied_ops/op:treasury-add:1', {
        operationId: delta.operationId,
        payloadHash: 'different-hash',
    });
    const userDocRef = new FakeUserDocRef(store);
    const batch = new FakeBatch(store);
    await assert.rejects(
        () => commitLegacyWithReadModelDeltas({
            userDocRef: userDocRef as any,
            batch: batch as any,
            deltas: [delta],
            summaryWriteMode: 'read',
        }),
        (error) => error instanceof Error && error.message.startsWith(IDEMPOTENCY_KEY_CONFLICT),
    );
}

{
    const store = new Map<string, Record<string, unknown>>();
    seedReadModels(store);
    store.delete('users/test-user/read_models/financial_summary');
    const userDocRef = new FakeUserDocRef(store);
    const batch = new FakeBatch(store);
    batch.set(new FakeDocRef('users/test-user/treasury_txs/tx-shadow-fallback'), { amount: 250 });

    const result = await commitLegacyWithReadModelDeltas({
        userDocRef: userDocRef as any,
        batch: batch as any,
        deltas: [delta],
        summaryWriteMode: 'summary_write_shadow',
    });

    assert.equal(result.status, 'shadow_failed_legacy_committed');
    assert.match(result.error || '', new RegExp(READ_MODEL_SNAPSHOT_MISSING));
    assert.equal(batch.commitCount, 1);
    assert.equal(store.get('users/test-user/treasury_txs/tx-shadow-fallback')?.amount, 250);
}

{
    const store = new Map<string, Record<string, unknown>>();
    seedReadModels(store);
    const userDocRef = new FakeUserDocRef(store);
    userDocRef.firestore.failTransactions = true;
    const batch = new FakeBatch(store);
    batch.set(new FakeDocRef('users/test-user/treasury_txs/tx-read-failure'), { amount: 250 });

    await assert.rejects(
        () => commitLegacyWithReadModelDeltas({
            userDocRef: userDocRef as any,
            batch: batch as any,
            deltas: [delta],
            summaryWriteMode: 'read',
        }),
        /TRANSACTION_FAILED/,
    );
    assert.equal(batch.commitCount, 0);
    assert.equal(store.has('users/test-user/treasury_txs/tx-read-failure'), false);
}

{
    const store = new Map<string, Record<string, unknown>>();
    seedReadModels(store);
    const userDocRef = new FakeUserDocRef(store);
    const batch = new FakeBatch(store);
    batch.set(new FakeDocRef('users/test-user/treasury_txs/tx-without-delta'), { amount: 250 });

    await assert.rejects(
        () => commitLegacyWithReadModelDeltas({
            userDocRef: userDocRef as any,
            batch: batch as any,
            deltas: [],
            summaryWriteMode: 'read',
        }),
        new RegExp(READ_MODEL_DELTA_REQUIRED),
    );
    assert.equal(batch.commitCount, 0);
    assert.equal(store.has('users/test-user/treasury_txs/tx-without-delta'), false);
}

console.log('production summary writer tests passed');
