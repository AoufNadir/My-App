import assert from 'node:assert/strict';
import { isCollectionReadyForCompute } from './queryPlanReadiness';

const states = {
    transactions: { received: true, fromCache: false, serverSynced: true },
    clients: { received: false, fromCache: false, serverSynced: false },
    clientTransactions: { received: false, fromCache: false, serverSynced: false },
};

// Investors need the full transaction ledger even when their view intentionally
// does not subscribe to unrelated client collections.
assert.equal(isCollectionReadyForCompute(states, 'transactions', true), true);
assert.equal(isCollectionReadyForCompute(states, 'transactions', false), true);
assert.equal(isCollectionReadyForCompute(states, 'clients', true), false);

const cachedOnly = {
    transactions: { received: true, fromCache: true, serverSynced: false },
};
assert.equal(isCollectionReadyForCompute(cachedOnly, 'transactions', false), true, 'Offline cache is valid only while offline');
assert.equal(isCollectionReadyForCompute(cachedOnly, 'transactions', true), false, 'Online computation must wait for server sync');

console.log('query-plan readiness tests passed');
