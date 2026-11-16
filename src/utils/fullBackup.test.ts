import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BACKUP_COLLECTIONS, buildFullBackup, daysSinceBackup, plainValue } from './fullBackup';

// V16-2: the full backup reads every collection of the account and writes nothing.
const data: Record<string, Array<{ id: string; data: Record<string, unknown> }>> = {
    usdt_txs: [{ id: 't1', data: { type: 'buy', quantity: 100, at: { toDate: () => new Date('2026-11-01T10:00:00Z') } } }],
    dzd_clients: [{ id: 'c1', data: { fullName: 'Client' } }],
    deliveries: [{ id: 'd1', data: { qty: 5 } }],
};
const writes: string[] = [];
const source = {
    get: async () => ({ data: () => ({ customAccounts: [{ id: 'acc_x', name: 'BNA', kind: 'bank' }] }) }),
    collection: (name: string) => ({ get: async () => ({ docs: (data[name] ?? []).map((d) => ({ id: d.id, data: () => d.data })) }) }),
    set: async () => { writes.push('set'); },
};
const { backup, counts, total } = await buildFullBackup(source, new Date('2026-11-16T12:00:00Z'));
assert.equal(total, 3);
assert.equal(counts.deliveries, 1, 'collections the old button forgot are in');
assert.deepEqual(Object.keys(backup.collections), [...BACKUP_COLLECTIONS], 'every collection, even empty ones');
assert.deepEqual((backup.collections.usdt_txs[0].data as { at: unknown }).at, { __timestamp: '2026-11-01T10:00:00.000Z' }, 'timestamps readable');
assert.deepEqual((backup.user as { customAccounts: unknown[] }).customAccounts.length, 1, 'the settings (accounts, currencies) are in');
assert.equal(writes.length, 0, 'nothing written');
for (const name of ['digital_service_txs', 'inventory_checks', 'movement_reasons', 'subscriptions', 'pricing_plans', 'client_confirmations', 'investors', 'investor_transactions'])
    assert.ok((BACKUP_COLLECTIONS as readonly string[]).includes(name), name);
// every money collection guarded by the write gate is in the backup
const gate = readFileSync(new URL('../firebase.ts', import.meta.url), 'utf8');
for (const name of /FINANCIAL_COLLECTIONS = new Set\(\[([\s\S]*?)\]\)/.exec(gate)![1].match(/'([a-zA-Z_]+)'/g)!.map((s) => s.slice(1, -1)))
    assert.ok((BACKUP_COLLECTIONS as readonly string[]).includes(name), `money collection ${name} is backed up`);
assert.deepEqual(plainValue([1, { a: null }]), [1, { a: null }]);
assert.equal(daysSinceBackup(null), null);
assert.equal(daysSinceBackup('2026-11-09T12:00:00Z', Date.parse('2026-11-16T12:00:00Z')), 7);
console.log('full backup tests passed');
