import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { ClientDzd, ClientTransactionDzd, Investor, InvestorTransaction, TreasuryTx, Tx } from '../types';
import { buildDashboardReadModelShadowFromLegacy } from './dashboardReadModels';
import {
    IMMUTABLE_LEGACY,
    LEGACY_BACKFILL_REQUIRED_FOR_READ_MODE,
    getSummaryWriteMode,
    isImmutableLegacyMutationError,
    isSummaryWriteFailureBlocking,
    prepareReadModelDeltaApplication,
    resolveDashboardReadSource,
    resolveLegacyMutationPolicy,
    shouldSubscribeFullLegacyHistory,
    shouldUseDashboardSummaryForView,
} from './readModelActivation';
import { READ_MODEL_APPLIED_OPS_PATH, buildReadModelDelta } from './readModelDeltas';

const asOf = new Date('2026-08-23T12:00:00.000Z').getTime();

function baseSnapshot() {
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
        generationId: 'activation-test',
        snapshotRevision: 1,
    });
}

assert.equal(getSummaryWriteMode(undefined), 'off');
assert.equal(getSummaryWriteMode(''), 'off');
assert.equal(getSummaryWriteMode('summary_write_shadow'), 'summary_write_shadow');
assert.equal(getSummaryWriteMode('read'), 'read');
assert.equal(getSummaryWriteMode('anything-else'), 'off');
assert.equal(isSummaryWriteFailureBlocking('summary_write_shadow'), false);
assert.equal(isSummaryWriteFailureBlocking('read'), true);

assert.equal(shouldUseDashboardSummaryForView({ readModelsMode: 'read', view: 'dashboard' }), true);
assert.equal(shouldUseDashboardSummaryForView({ readModelsMode: 'read', view: 'transactions' }), false);
assert.equal(shouldUseDashboardSummaryForView({ readModelsMode: 'shadow', view: 'dashboard' }), false);
assert.equal(shouldSubscribeFullLegacyHistory({ readModelsMode: 'read', view: 'dashboard' }), false);
assert.equal(shouldSubscribeFullLegacyHistory({ readModelsMode: 'read', view: 'transactions' }), true);

assert.equal(resolveDashboardReadSource({ readModelsMode: 'shadow', hasDashboardSummary: false }), 'legacy_full_history');
assert.equal(resolveDashboardReadSource({ readModelsMode: 'read', hasDashboardSummary: true }), 'dashboard_summary');
assert.equal(resolveDashboardReadSource({ readModelsMode: 'read', hasDashboardSummary: false }), 'controlled_legacy_fallback');
assert.equal(resolveDashboardReadSource({ readModelsMode: 'read', hasDashboardSummary: false, fallbackAlreadyUsed: true }), 'unavailable');

assert.equal(LEGACY_BACKFILL_REQUIRED_FOR_READ_MODE, false);
assert.deepEqual(resolveLegacyMutationPolicy({ readModelsMode: 'legacy' }), {
    status: 'mutable_legacy',
    canMutate: true,
    legacyBackfillRequired: false,
});
assert.deepEqual(resolveLegacyMutationPolicy({ readModelsMode: 'shadow' }), {
    status: 'mutable_legacy',
    canMutate: true,
    legacyBackfillRequired: false,
});
assert.deepEqual(resolveLegacyMutationPolicy({ readModelsMode: 'read' }), {
    status: 'immutable_legacy',
    canMutate: false,
    reason: IMMUTABLE_LEGACY,
    legacyBackfillRequired: false,
});
assert.equal(isImmutableLegacyMutationError(IMMUTABLE_LEGACY), true);
assert.equal(isImmutableLegacyMutationError('OPERATION_INDEX_REQUIRED'), false);

const snapshot = baseSnapshot();
const delta = buildReadModelDelta({
    operationId: 'op:activation-test',
    effectiveAt: asOf,
    payload: { type: 'treasury_add', amount: 250 },
    affectedSummaries: ['dashboard_summary', 'treasury_summary', 'financial_summary'],
    wallets: { Caisse: 250 },
});

const disabled = prepareReadModelDeltaApplication({ snapshot, delta, summaryWriteMode: 'off' });
assert.equal(disabled.status, 'disabled');
assert.equal(disabled.failureBlocksLegacy, false);
assert.equal(disabled.idempotencyPath, READ_MODEL_APPLIED_OPS_PATH);
assert.equal(disabled.idempotencyDocId, delta.operationId);
assert.equal(disabled.nextSnapshot, undefined);

const shadow = prepareReadModelDeltaApplication({ snapshot, delta, summaryWriteMode: 'summary_write_shadow' });
assert.equal(shadow.status, 'prepared');
assert.equal(shadow.failureBlocksLegacy, false);
assert.equal(shadow.nextSnapshot?.treasury.caisseBalance, snapshot.treasury.caisseBalance + 250);
assert.equal(snapshot.treasury.caisseBalance, 1000, 'prepared shadow delta must not mutate the input snapshot');

const read = prepareReadModelDeltaApplication({ snapshot, delta, summaryWriteMode: 'read' });
assert.equal(read.status, 'prepared');
assert.equal(read.failureBlocksLegacy, true);

const mainAppSource = readFileSync('src/MainApp.tsx', 'utf8');
// The active view and its real positive/undefined resultLimit drive the listener plan.
assert.match(mainAppSource, /useAppData\(user,\s*refreshKey,\s*\{\s*view,\s*resultLimit,/s, 'MainApp must pass view and resultLimit to useAppData');
assert.doesNotMatch(mainAppSource, /requireManualAssets|requireInvestors|requireTreasuryCards|subscribeManualAssets|subscribeInvestors|subscribeTreasuryCards/, 'MainApp must not maintain contradictory require/subscribe flags');
assert.match(mainAppSource, /useDashboardSummaryReadModel\(userDocRef,\s*readModelsMode\)/, 'Dashboard read mode must subscribe to dashboard_summary');
assert.match(mainAppSource, /transactions:\s*dashboardSummary\s*\?\s*EMPTY_TRANSACTIONS\s*:\s*transactions/, 'Dashboard read props must not require full transaction history');
assert.doesNotMatch(mainAppSource, /writeInitialReadModelSnapshot\(/, 'Initial snapshot writer must never run automatically from MainApp');

const initialSnapshotSource = readFileSync('src/readModels/initialSnapshotWriter.ts', 'utf8');
assert.match(initialSnapshotSource, /manual_initial_snapshot/, 'Initial snapshot writer must remain explicit/manual');

const historyCardSource = readFileSync('src/components/transactions/TransactionsHistoryCard.tsx', 'utf8');
assert.match(historyCardSource, /INITIAL_VISIBLE\s*=\s*60/, 'History display must keep local pagination');
assert.match(historyCardSource, /setVisibleTransactionCount\(\(prev\) => prev \+ LOAD_MORE_COUNT\)/, 'History display must support load-more pagination');
assert.doesNotMatch(historyCardSource, /\.limit\(/, 'History pagination must stay display-only and never limit accounting source queries');

console.log('read model activation tests passed');