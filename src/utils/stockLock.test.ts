import assert from 'node:assert/strict';
import { commitWithStockLock, commitWithStockLockOrBatch, requireStockLockSeq, stockLockSeqOf, StockChangedError } from './stockLock';

// V13-7 (audit retest): two tabs both read 40 RMB and sell 21 at the same moment. A fake Firestore runs the two
// transactions one after the other, as the server does: the second finds the lock moved and writes nothing.
const store = new Map<string, Record<string, unknown>>();
const ref = (path: string) => ({ nativeRef: { path }, collection: (c: string) => ({ doc: (d: string) => ref(`${path}/${c}/${d}`) }) }) as any;
const user = ref('users/u');
const db = {
    async runTransaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
        const writes: Array<() => void> = [];
        const tx = {
            get: async (r: any) => ({ exists: store.has(r.nativeRef.path), data: () => store.get(r.nativeRef.path) }),
            set: (r: any, data: any) => writes.push(() => store.set(r.nativeRef.path, data)),
            update: (r: any, data: any) => writes.push(() => store.set(r.nativeRef.path, { ...store.get(r.nativeRef.path), ...data })),
            delete: (r: any) => writes.push(() => store.delete(r.nativeRef.path)),
        };
        const out = await fn(tx);
        writes.forEach((w) => w());
        return out;
    },
};
const sale = (id: string) => ({ operations: [{ kind: 'set', ref: ref(`users/u/usdt_txs/${id}`), data: { type: 'sell', currency: 'RMB', quantity: 21 } }] }) as any;
(async () => {
    const seenByBoth = stockLockSeqOf(store.get('users/u/stock_lock/main')); // both tabs see the same lock: 0
    assert.equal(await commitWithStockLock(db, user, sale('a'), seenByBoth), 1, 'first tab: saved');
    await assert.rejects(commitWithStockLock(db, user, sale('b'), seenByBoth), StockChangedError, 'second tab: refused');
    assert.ok(store.has('users/u/usdt_txs/a') && !store.has('users/u/usdt_txs/b'), 'only one sale written: 40 − 21 = 19, never −2');
    assert.equal(store.get('users/u/usdt_txs/a')!.stockSeq, 1, 'the sale tells other tabs which lock number it made');
    // The second tab, once it has received sale a, knows the lock is at 1 and may sell the remaining 19.
    const afterUpdate = stockLockSeqOf(store.get('users/u/stock_lock/main'));
    assert.equal(await commitWithStockLock(db, user, sale('c'), afterUpdate), 2);
    // Retest 2 (auditor): the test sales were deleted, then an old sale was edited and refused again and again. The
    // number now comes from the lock itself, so a deletion does not leave the tab behind for ever.
    store.delete('users/u/usdt_txs/a');
    store.delete('users/u/usdt_txs/c');
    assert.equal(await commitWithStockLock(db, user, sale('edit-old-sale'), stockLockSeqOf(store.get('users/u/stock_lock/main'))), 3, 'saved after deletions');
    // Before the lock is read, nothing is written.
    assert.throws(() => requireStockLockSeq(null), StockChangedError);
    // V14-3 hotfix: the transaction fails (phone offline for a second): the sale is still saved with its batch.
    let committed = 0;
    const offlineDb = { runTransaction: async () => { throw new Error('Failed to get document because the client is offline.'); } };
    const batchOf = { operations: [], commit: async () => { committed += 1; } } as any;
    await commitWithStockLockOrBatch(offlineDb, user, batchOf, 3);
    assert.equal(committed, 1, 'saved with the batch');
    await commitWithStockLockOrBatch(offlineDb, user, batchOf, null);
    assert.equal(committed, 2, 'lock not read yet: the usual save');
    // « Another sale came first » is still refused, never saved behind the lock's back.
    await assert.rejects(commitWithStockLockOrBatch(db, user, sale('late'), 0), StockChangedError);
    assert.equal(committed, 2);
    console.log('stockLock.test: two tabs cannot sell the same stock, the second sale is refused whole');
})();
