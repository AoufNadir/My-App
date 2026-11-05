import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// V9-10: « manualRevenueOnly » skips the old Services page's assets and their clients, and nothing else.
// In V9-5 it skipped the app's own clients by mistake, so the Home page never finished loading.

const source = readFileSync(new URL('./useAppData.ts', import.meta.url), 'utf8');
const subscription = (key: string) => {
    const start = source.indexOf(`subscribeToCollection(\n            '${key}',`);
    assert.ok(start > 0, `the « ${key} » subscription exists`);
    const lineStart = source.lastIndexOf('\n', start) + 1;
    return source.slice(lineStart, source.indexOf(');', start));
};

for (const key of ['transactions', 'clients', 'clientTransactions', 'treasuryTransactions', 'digitalServiceTransactions', 'manualAssetTransactions'])
    assert.ok(!subscription(key).includes('manualRevenueOnly'), `« ${key} » is always subscribed`);
for (const key of ['manualAssets', 'manualAssetClients'])
    assert.ok(subscription(key).includes('manualRevenueOnly ?'), `« ${key} » is skipped when only the revenue is read`);
console.log('useAppData manual revenue tests passed');
