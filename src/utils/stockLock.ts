import type { FirestoreDocumentReference, FirestoreTransaction, FirestoreWriteBatch } from '../firebase';

/**
 * V13-7 (audit, retest 2026-11-13): two tabs or two phones must never sell the same stock. Every sale (any currency,
 * any window) is written inside one Firestore transaction with a lock document `stock_lock/main` holding a sequence
 * number. Each sale saves the number it moved the lock to (`stockSeq`), so a tab knows which number its stock is up
 * to: the highest `stockSeq` among the operations it has. If the lock moved on meanwhile (another tab sold first), the
 * whole sale is refused and nothing is written; the screen updates and the owner confirms again on the fresh stock.
 */
export const STOCK_CHANGED_MESSAGE = 'Une autre opération vient d’être enregistrée : vérifiez le stock et confirmez à nouveau.';
export class StockChangedError extends Error {
    constructor() { super(STOCK_CHANGED_MESSAGE); this.name = 'StockChangedError'; }
}

export function expectedStockSeq(txs: ReadonlyArray<{ stockSeq?: unknown }>): number {
    return txs.reduce((max, tx) => Math.max(max, Number(tx.stockSeq) || 0), 0);
}

type TxLike = Pick<FirestoreTransaction, 'get' | 'set' | 'update' | 'delete'>;
type DbLike = { runTransaction: <T>(fn: (tx: FirestoreTransaction) => Promise<T>) => Promise<T> };

/** Writes the batch's operations and moves the lock, all or nothing. Stock rows get the new `stockSeq`. */
export async function commitWithStockLock(db: DbLike, userDocRef: FirestoreDocumentReference, batch: Pick<FirestoreWriteBatch, 'operations'>, expected: number): Promise<number> {
    const lockRef = userDocRef.collection('stock_lock').doc('main');
    return db.runTransaction(async (raw) => {
        const tx = raw as unknown as TxLike;
        const lock = await tx.get(lockRef);
        const current = lock.exists ? Number(lock.data()?.seq) || 0 : 0;
        if (current !== expected) throw new StockChangedError();
        const next = current + 1;
        for (const op of batch.operations) {
            const isStockRow = op.ref.nativeRef.path.includes('/usdt_txs/');
            if (op.kind === 'delete') tx.delete(op.ref);
            else if (op.kind === 'update') tx.update(op.ref, isStockRow ? { ...op.data, stockSeq: next } : op.data);
            else if (op.options) tx.set(op.ref, isStockRow ? { ...op.data, stockSeq: next } : op.data, op.options);
            else tx.set(op.ref, isStockRow ? { ...op.data, stockSeq: next } : op.data);
        }
        tx.set(lockRef, { seq: next, at: Date.now() });
        return next;
    });
}
