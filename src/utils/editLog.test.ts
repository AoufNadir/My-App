import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deleteField } from 'firebase/firestore';
import { editLogEntryFor, moneyChange, setEditLogSource } from './editLog';
import { guardFindings } from '../services/guardChecks';
import { BACKUP_COLLECTIONS } from './fullBackup';

// V17-3: the edit log, on fake data.
const memory: Record<string, Record<string, Record<string, unknown>>> = {
    treasury_txs: { e7: { id: 'e7', origin: 'personal_expense', type: 'Retrait', amount: 385, source: 'Caisse', notes: 'café', timestamp: 1, lockedFlag: { a: 1 } } },
    usdt_txs: { s1: { id: 's1', type: 'sell', quantity: 100, sell: 262, timestamp: 2 } },
};
const isMoney = (c: string) => c === 'treasury_txs' || c === 'usdt_txs';
const NOW = 1_000_000;

// Without a source (nobody signed in, tests of other files) nothing is logged.
assert.equal(editLogEntryFor({ path: 'users/u/treasury_txs/e7', kind: 'delete', isMoney, now: NOW }), null);
setEditLogSource((c, id) => memory[c]?.[id]);

// A creation: no « before », no line.
assert.equal(editLogEntryFor({ path: 'users/u/treasury_txs/new', kind: 'set', data: { amount: 5 }, isMoney, now: NOW }), null);
// Not a money collection: no line.
assert.equal(editLogEntryFor({ path: 'users/u/movement_reasons/e7', kind: 'delete', isMoney, now: NOW }), null);

// 385 → 39 500: before and after kept, only the tracked plain fields.
const edit = editLogEntryFor({ path: 'users/u/treasury_txs/e7', kind: 'update', data: { amount: 39500, notes: deleteField() }, isMoney, now: NOW });
assert.ok(edit);
assert.equal(edit!.userPath, 'users/u');
assert.deepEqual(edit!.entry, {
    at: NOW, collection: 'treasury_txs', docId: 'e7', kind: 'edit',
    before: { amount: 385, type: 'Retrait', origin: 'personal_expense', source: 'Caisse', notes: 'café', timestamp: 1 },
    after: { amount: 39500, type: 'Retrait', origin: 'personal_expense', source: 'Caisse', timestamp: 1 },
});
assert.deepEqual(moneyChange(edit!.entry), { field: 'amount', from: 385, to: 39500 });

// A full set (no merge) replaces the line; a merge keeps what is not written.
const replaced = editLogEntryFor({ path: 'users/u/usdt_txs/s1', kind: 'set', data: { type: 'sell', quantity: 100, sell: 2620, timestamp: 2 }, isMoney, now: NOW });
assert.deepEqual(moneyChange(replaced!.entry), { field: 'sell', from: 262, to: 2620 });
// A write that changes no tracked field (a lock flag, stockSeq): no line.
assert.equal(editLogEntryFor({ path: 'users/u/usdt_txs/s1', kind: 'update', data: { stockSeq: 4 }, isMoney, now: NOW }), null);

// A delete keeps the « before ».
const deleted = editLogEntryFor({ path: 'users/u/usdt_txs/s1', kind: 'delete', isMoney, now: NOW });
assert.equal(deleted!.entry.kind, 'delete');
assert.equal(deleted!.entry.after, null);
assert.deepEqual(moneyChange(deleted!.entry), { field: 'sell', from: 262, to: null });

// The guard: a big edit and a big delete in the last 14 days are in the bell; small ones and old ones are not.
const DAY = 86_400_000;
const now = 100 * DAY;
const f = guardFindings({
    now, expenses: [], operations: [], sales: [], wallets: {}, feeHistory: [],
    edits: [
        { ...edit!.entry, id: 'l1', at: now - DAY },
        { id: 'l2', at: now - DAY, collection: 'usdt_txs', docId: 'x', kind: 'delete', before: { type: 'sell', quantity: 50, total: 13000 }, after: null },
        { id: 'l3', at: now - DAY, collection: 'treasury_txs', docId: 'y', kind: 'edit', before: { amount: 1000 }, after: { amount: 1100 } },
        { ...edit!.entry, id: 'l4', at: now - 20 * DAY },
        { id: 'l5', at: now - DAY, collection: 'investor_transactions', docId: 'z', kind: 'edit', before: { origin: 'personal_expense', amount: 39500 }, after: { origin: 'personal_expense', amount: 7700 } },
    ],
});
assert.deepEqual(f.map((x) => x.kind === 'big_edit' && [x.id, x.what, x.deleted, x.from, x.to]), [['edit-l1', 'personal_expense', false, 385, 39500], ['edit-l2', 'operation', true, 13000, null]]);

// Wired in every write path of the app (batch, transaction, single document), in the same write as the change,
// fed from memory by MainApp, and in the full backup.
const firebase = readFileSync(new URL('../firebase.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
assert.match(firebase, /if \(log\) this\.nativeBatch\.set\(log\.ref, log\.entry\);/);
assert.match(firebase, /this\.log\(editLogFor\(ref\.nativeRef, 'set', data, options\)\);/);
assert.match(firebase, /this\.log\(editLogFor\(ref\.nativeRef, 'update', data\)\);/);
assert.match(firebase, /this\.log\(editLogFor\(ref\.nativeRef, 'delete'\)\);/);
assert.equal((firebase.match(/pair\.set\(log\.ref, log\.entry\);/g) || []).length, 3, 'single-document set, update and delete');
const main = readFileSync(new URL('../MainApp.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
assert.match(main, /setEditLogSource\(\(collection, docId\) =>/);
assert.match(main, /edits: editLog,/);
assert.ok((BACKUP_COLLECTIONS as readonly string[]).includes('edit_log'));

setEditLogSource(null);
console.log('edit log tests passed');
