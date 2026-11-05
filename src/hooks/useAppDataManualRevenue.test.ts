import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// V9-10, kept by V10-3: the old Services page's assets and their clients are no longer read, only its
// operations (their revenue stays in the owner's profit). In V9-5 a switch for this skipped the app's own
// clients by mistake, so the Home page never finished loading: every collection of the app must always be
// subscribed, whatever the manual services do.

const source = readFileSync(new URL('./useAppData.ts', import.meta.url), 'utf8');
const subscription = (key: string) => {
    const start = source.indexOf(`subscribeToCollection(\n            '${key}',`);
    assert.ok(start > 0, `the « ${key} » subscription exists`);
    const lineStart = source.lastIndexOf('\n', start) + 1;
    return source.slice(lineStart, source.indexOf(');', start));
};

for (const key of ['transactions', 'clients', 'clientTransactions', 'treasuryTransactions', 'digitalServiceTransactions', 'manualAssetTransactions'])
    assert.ok(!/manual(Revenue|Services|Assets)\w* \?/.test(subscription(key)), `« ${key} » is never skipped by an inline switch`);
assert.ok(subscription('clients').includes("'dzd_clients'"), 'the app\'s own clients are the dzd_clients collection');
assert.ok(subscription('manualAssetTransactions').includes("'actifTransactions'"), 'the old services\' operations are still read');
assert.ok(!source.includes("collection('manual_assets')") && !source.includes("collection('manual_asset_clients')"), 'the assets and their clients are not read any more');
assert.ok(!/\bmanualAssets\b|\bmanualAssetClients\b|\bassetClientBalances\b/.test(source), 'no state of them is kept either');
console.log('useAppData manual services tests passed');
