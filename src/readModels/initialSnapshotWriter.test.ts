import assert from 'node:assert/strict';
import type { ClientDzd, ClientTransactionDzd, DigitalServiceTransaction, Investor, InvestorTransaction, ManualAsset, ManualAssetClient, ManualAssetTransaction, TreasuryCard, TreasuryTx, Tx } from '../types';
import { computeCapitalSnapshot } from '../utils/capitalSnapshot';
import { buildDashboardReadModelShadowFromLegacy, type BuildDashboardReadModelsInput, type DashboardReadModelLegacyBaseline } from './dashboardReadModels';
import {
    INITIAL_READ_MODEL_DOCUMENT_IDS,
    prepareInitialReadModelSnapshot,
    stableReadModelPayloadHash,
    writeInitialReadModelSnapshot,
    type ManualSnapshotDocumentReference,
    type ManualSnapshotDocumentSnapshot,
    type ManualSnapshotUserDocumentReference,
} from './initialSnapshotWriter';

const asOf = new Date('2026-08-23T12:00:00.000Z').getTime();
const dayStart = new Date('2026-08-23T00:00:00.000Z').getTime();

const transactions: Tx[] = [
    {
        id: 'buy-1',
        type: 'buy',
        quantity: 20,
        price: 200,
        total: 4000,
        date: '23/08/2026',
        time: '08:00',
        timestamp: dayStart + 1000,
        currency: 'USDT',
    },
    {
        id: 'sell-1',
        type: 'sell',
        quantity: 5,
        sell: 260,
        total: 1300,
        date: '23/08/2026',
        time: '09:00',
        timestamp: dayStart + 2000,
        currency: 'USDT',
    },
];

const clientsDzd: ClientDzd[] = [
    { id: 'client-1', fullName: 'Client One' },
];

const clientTransactionsDzd: ClientTransactionDzd[] = [
    {
        id: 'client-debt-1',
        clientId: 'client-1',
        montant: -500,
        type: 'Vente USDT',
        date: '23/08/2026',
        time: '09:00',
        timestamp: dayStart + 2000,
    },
];

const treasuryTransactions: TreasuryTx[] = [
    {
        id: 'cash-opening',
        type: 'Ajout',
        source: 'Caisse',
        amount: 2500,
        date: '23/08/2026',
        time: '07:00',
        timestamp: dayStart,
    },
];

const treasuryCards: TreasuryCard[] = [
    { id: 'card-1', name: 'Card', value: 100 },
];

const manualAssets: ManualAsset[] = [
    { id: 'asset-1', name: 'Service', createdAt: dayStart, updatedAt: dayStart },
];

const manualAssetClients: ManualAssetClient[] = [];
const manualAssetTransactions: ManualAssetTransaction[] = [];
const digitalServiceTransactions: DigitalServiceTransaction[] = [
    {
        id: 'digital-1',
        type: 'digital_service_sale',
        clientId: 'client-1',
        serviceName: 'Digital',
        purchaseWallet: 'Caisse',
        purchaseCurrency: 'DZD',
        purchaseAmount: 100,
        purchaseRateToDzd: 1,
        purchaseAmountDzd: 100,
        saleWallet: 'Caisse',
        saleCurrency: 'DZD',
        saleAmount: 250,
        saleRateToDzd: 1,
        saleAmountDzd: 250,
        profitDzd: 150,
        date: '23/08/2026',
        time: '11:00',
        timestamp: dayStart + 5000,
    },
];

const investors: Investor[] = [
    {
        id: 'manager',
        name: 'Manager',
        entryDate: '2026-08-01',
        capitalInvested: 10000,
        initialCapital: 10000,
        sharePercentage: 0,
        totalProfit: 0,
        withdrawnProfit: 0,
        availableProfit: 0,
        isActive: true,
        isManager: true,
    },
];
const investorTransactions: InvestorTransaction[] = [];

function buildInput(overrides: Partial<BuildDashboardReadModelsInput> = {}): BuildDashboardReadModelsInput {
    return {
        transactions,
        clientsDzd,
        clientTransactionsDzd,
        treasuryTransactions,
        treasuryCards,
        manualAssets,
        manualAssetClients,
        manualAssetTransactions,
        digitalServiceTransactions,
        investors,
        investorTransactions,
        managerFeePercentage: 30,
        managerFeeHistory: [{ id: 'initial-30', percentage: 30, effectiveFrom: dayStart - 1, createdAt: dayStart - 1 }],
        ownerOpeningCapital: 10000,
        preTrackingPersonalExpenses: 0,
        getClientFullName: (client) => client.fullName,
        asOf,
        generationId: 'manual-generation-1',
        snapshotRevision: 1,
        summaryRevisions: {
            dashboard_summary: 1,
            treasury_summary: 1,
            portfolio_summary: 1,
            clients_summary: 1,
            investors_summary: 1,
            services_summary: 1,
            financial_summary: 1,
        },
        ...overrides,
    };
}

function buildLegacyBaseline(input: BuildDashboardReadModelsInput): DashboardReadModelLegacyBaseline {
    const shadow = buildDashboardReadModelShadowFromLegacy(input);
    const capitalSnapshot = computeCapitalSnapshot({
        caisseBalance: shadow.treasury.caisseBalance,
        baridiBalance: shadow.treasury.baridiBalance,
        portfolioStats: shadow.portfolio.positions,
        totalDettes: -shadow.clients.totalReceivables,
        totalAvances: shadow.clients.totalAdvances,
        treasuryCards,
        investorLiability: shadow.investors.investorLiability,
        services: shadow.services,
        managerPendingAdvances: shadow.treasury.managerPendingAdvances,
    });
    return {
        treasuryStats: { caisse: shadow.treasury.caisseBalance, baridi: shadow.treasury.baridiBalance },
        portfolioStats: shadow.portfolio.positions,
        totals: { totalDettes: -shadow.clients.totalReceivables, totalAvances: shadow.clients.totalAdvances },
        investorBreakdown: shadow.investors.investorBreakdown,
        investorLiability: shadow.investors.investorLiability,
        capitalSnapshot,
        servicesSummary: shadow.services,
        dailyOverview: shadow.financial.dailyOverview,
        globalNetProfit: shadow.investors.globalNetProfit,
        managerProfitBreakdown: shadow.investors.managerProfitBreakdown,
        financialAudit: shadow.financial.financialAudit,
    };
}

class FakeDocRef implements ManualSnapshotDocumentReference {
    constructor(readonly path: string, private readonly store: Map<string, Record<string, unknown>>) {}

    async get(): Promise<ManualSnapshotDocumentSnapshot> {
        const value = this.store.get(this.path);
        return {
            exists: Boolean(value),
            data: () => value,
        };
    }
}

class FakeCollectionRef {
    constructor(private readonly prefix: string, private readonly store: Map<string, Record<string, unknown>>) {}

    doc(id: string) {
        return new FakeDocRef(`${this.prefix}/${id}`, this.store);
    }
}

class FakeBatch {
    private readonly writes: Array<{ ref: FakeDocRef; data: Record<string, unknown> }> = [];

    constructor(private readonly store: Map<string, Record<string, unknown>>) {}

    set(ref: ManualSnapshotDocumentReference, data: Record<string, unknown>) {
        this.writes.push({ ref: ref as FakeDocRef, data });
    }

    async commit() {
        this.writes.forEach(({ ref, data }) => this.store.set(ref.path, data));
    }
}

class FakeUserDocRef implements ManualSnapshotUserDocumentReference {
    readonly firestore = {
        batch: () => new FakeBatch(this.store),
    };

    constructor(private readonly store: Map<string, Record<string, unknown>>) {}

    collection(name: string) {
        return new FakeCollectionRef(`users/test-user/${name}`, this.store);
    }
}

const input = buildInput();
const legacyBaseline = buildLegacyBaseline(input);
const prepared = prepareInitialReadModelSnapshot({ buildInput: input, legacyBaseline });

assert.equal(prepared.reconciliation.ok, true);
assert.equal(prepared.payloadHash, stableReadModelPayloadHash(prepared.readModels));
assert.equal(prepared.readModels.dashboard.money.clientReceivables, 500);
assert.equal(prepared.readModels.dashboard.recentOperations.items.length, 0);
assert.ok(prepared.readModels.dashboard.recentOperations.items.length <= prepared.readModels.dashboard.recentOperations.maxItems);

const store = new Map<string, Record<string, unknown>>();
const userDocRef = new FakeUserDocRef(store);

const firstWrite = await writeInitialReadModelSnapshot({
    userDocRef,
    buildInput: input,
    legacyBaseline,
    serverTimestamp: () => 'SERVER_TIMESTAMP',
});

assert.equal(firstWrite.status, 'written');
assert.equal(firstWrite.wrote, true);
assert.equal(store.size, INITIAL_READ_MODEL_DOCUMENT_IDS.length);

const dashboardDoc = store.get('users/test-user/read_models/dashboard_summary');
assert.ok(dashboardDoc);
assert.equal(dashboardDoc?.payloadHash, firstWrite.payloadHash);
assert.equal(dashboardDoc?.writeMode, 'manual_initial_snapshot');
assert.equal(dashboardDoc?.sourceOfTruth, 'legacy_rebuild');
assert.equal(dashboardDoc?.firestoreUpdatedAt, 'SERVER_TIMESTAMP');

const secondWrite = await writeInitialReadModelSnapshot({
    userDocRef,
    buildInput: input,
    legacyBaseline,
    serverTimestamp: () => 'SERVER_TIMESTAMP_2',
});

assert.equal(secondWrite.status, 'already_exists');
assert.equal(secondWrite.wrote, false);
assert.equal(store.size, INITIAL_READ_MODEL_DOCUMENT_IDS.length);

const conflictingInput = buildInput({ snapshotRevision: 2 });
const conflictingBaseline = buildLegacyBaseline(conflictingInput);
const conflict = await writeInitialReadModelSnapshot({
    userDocRef,
    buildInput: conflictingInput,
    legacyBaseline: conflictingBaseline,
});

assert.equal(conflict.status, 'conflict');
assert.equal(conflict.wrote, false);
assert.equal(store.size, INITIAL_READ_MODEL_DOCUMENT_IDS.length);

const badBaseline: DashboardReadModelLegacyBaseline = {
    ...legacyBaseline,
    treasuryStats: { ...legacyBaseline.treasuryStats, caisse: legacyBaseline.treasuryStats.caisse + 1 },
};
const failed = await writeInitialReadModelSnapshot({
    userDocRef: new FakeUserDocRef(new Map()),
    buildInput: input,
    legacyBaseline: badBaseline,
});

assert.equal(failed.status, 'reconciliation_failed');
assert.equal(failed.wrote, false);

console.log('initial snapshot writer tests passed');
