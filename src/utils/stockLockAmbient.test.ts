import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { commitLegacyWithReadModelDeltas } from '../readModels/productionSummaryWriter';
import { registerStockLock, saveErrorAlert, StockChangedError, STOCK_CHANGED_MESSAGE } from './stockLock';

// V14-5: a project expense paid in USDT (a stock row) in one window, a sale in another, at the same moment. The expense
// now takes the same lock as sales: the second save is refused whole. A batch without a stock row is saved as before.
const store = new Map<string, Record<string, unknown>>();
const ref = (path: string) => ({ nativeRef: { path }, collection: (c: string) => ({ doc: (d: string) => ref(`${path}/${c}/${d}`) }) }) as any;
const user = ref('users/u');
let transactions = 0;
const db = {
    async runTransaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
        transactions += 1;
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
const batchOf = (path: string) => {
    const b = { committed: 0, operations: [{ kind: 'set', ref: ref(path), data: { quantity: 30 } }], commit: async () => { b.committed += 1; } };
    return b as any;
};
(async () => {
    // Without registration (tests, other tools): nothing changes, the batch is committed.
    const plain = batchOf('users/u/usdt_txs/x');
    await commitLegacyWithReadModelDeltas({ userDocRef: user, batch: plain, deltas: [] });
    assert.equal(plain.committed, 1);
    assert.equal(transactions, 0);

    let seen: number | null = 0; // both windows saw lock 0
    const unregister = registerStockLock({ db, expected: () => seen });
    const expense = batchOf('users/u/usdt_txs/expense');
    await commitLegacyWithReadModelDeltas({ userDocRef: user, batch: expense, deltas: [] });
    assert.equal(transactions, 1, 'the expense in USDT went through the lock');
    assert.ok(store.has('users/u/usdt_txs/expense'));
    assert.equal(store.get('users/u/stock_lock/main')!.seq, 1);
    // The other window still believes the lock is at 0: its withdrawal in USDT is refused, nothing written.
    await assert.rejects(commitLegacyWithReadModelDeltas({ userDocRef: user, batch: batchOf('users/u/usdt_txs/withdrawal'), deltas: [] }), StockChangedError);
    assert.ok(!store.has('users/u/usdt_txs/withdrawal'));
    // A save without any stock row (a DZD expense in the Caisse) never takes the lock.
    const caisse = batchOf('users/u/treasury_txs/t1');
    await commitLegacyWithReadModelDeltas({ userDocRef: user, batch: caisse, deltas: [] });
    assert.equal(caisse.committed, 1);
    assert.equal(transactions, 2);
    // The window shows the clear message, not « Erreur lors de l’enregistrement ».
    assert.equal(saveErrorAlert(new StockChangedError(), '❌ Erreur'), `⚠️ ${STOCK_CHANGED_MESSAGE}`);
    assert.equal(saveErrorAlert(new Error('x'), '❌ Erreur'), '❌ Erreur');
    unregister();
    seen = null;

    // The app registers the lock, and the save windows use the clear message.
    const main = readFileSync(new URL('../MainApp.tsx', import.meta.url), 'utf8');
    assert.match(main, /registerStockLock\(/);
    for (const file of ['../hooks/useTransactionHandlers.ts', '../hooks/useInvestorHandlers.ts', '../hooks/useDigitalServiceHandlers.ts']) {
        const src = readFileSync(new URL(file, import.meta.url), 'utf8');
        assert.match(src, /saveErrorAlert\(e, /, file);
    }
    console.log('stockLockAmbient.test: expenses, withdrawals and services take the same stock lock as sales');
})();
