import assert from 'node:assert/strict';
import {
    applyTimestampQueryPlan,
    buildAppDataQueryPlan,
} from './useAppData';

type SpyQuery = {
    calls: string[];
    orderBy: (field: string, direction: 'asc' | 'desc') => SpyQuery;
    limit: (count: number) => SpyQuery;
};

function createSpyQuery(): SpyQuery {
    const query: SpyQuery = {
        calls: [],
        orderBy(field, direction) {
            query.calls.push(`orderBy:${field}:${direction}`);
            return query;
        },
        limit(count) {
            query.calls.push(`limit:${count}`);
            return query;
        },
    };
    return query;
}

// Recent history must be fetched newest-first, bounded in Firestore.
const transactionsPlan = buildAppDataQueryPlan({ view: 'transactions', resultLimit: 100 });
assert.deepEqual(transactionsPlan.collections.transactions, {
    mode: 'full',
    order: 'asc',
});
assert.deepEqual(transactionsPlan.collections.clientTransactions, {
    mode: 'recent',
    order: 'desc',
    limit: 100,
});
assert.deepEqual(transactionsPlan.collections.treasuryTransactions, {
    mode: 'recent',
    order: 'desc',
    limit: 100,
});

const recentQuery = createSpyQuery();
applyTimestampQueryPlan(recentQuery, transactionsPlan.collections.clientTransactions);
assert.deepEqual(recentQuery.calls, ['orderBy:timestamp:desc', 'limit:100']);

// A full collection must never receive a zero or artificial limit.
const clientsPlan = buildAppDataQueryPlan({ view: 'dzd', resultLimit: 100 });
assert.deepEqual(clientsPlan.collections.clientTransactions, {
    mode: 'full',
    order: 'asc',
});
const fullQuery = createSpyQuery();
applyTimestampQueryPlan(fullQuery, clientsPlan.collections.clientTransactions);
assert.deepEqual(fullQuery.calls, ['orderBy:timestamp:asc']);

// Treasury, Services, and Investors must subscribe to their actual required data.
const treasuryPlan = buildAppDataQueryPlan({ view: 'tresorerie', resultLimit: 80 });
assert.deepEqual(treasuryPlan.collections.treasuryTransactions, {
    mode: 'full',
    order: 'asc',
}, 'Treasury must use complete raw events as a temporary accuracy fallback while the stored summary is stale');
assert.equal(treasuryPlan.collections.treasuryCards.mode, 'full');

const servicesPlan = buildAppDataQueryPlan({ view: 'services', resultLimit: 100 });
assert.equal(servicesPlan.collections.manualAssets.mode, 'full');
assert.equal(servicesPlan.collections.manualAssetClients.mode, 'full');
assert.equal(servicesPlan.collections.manualAssetTransactions.mode, 'full');

const investorsPlan = buildAppDataQueryPlan({ view: 'investors', resultLimit: 100 });
assert.equal(investorsPlan.collections.investors.mode, 'full');
assert.equal(investorsPlan.collections.investorTransactions.mode, 'full');

// Query-plan identity must change when view or page size changes so listeners rebind.
assert.notEqual(
    buildAppDataQueryPlan({ view: 'transactions', resultLimit: 100 }).signature,
    buildAppDataQueryPlan({ view: 'transactions', resultLimit: 200 }).signature,
);
assert.notEqual(
    buildAppDataQueryPlan({ view: 'transactions', resultLimit: 100 }).signature,
    buildAppDataQueryPlan({ view: 'tresorerie', resultLimit: 100 }).signature,
);

console.log('useAppData query plan tests passed');