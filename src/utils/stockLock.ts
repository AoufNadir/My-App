import type { FirestoreDocumentReference, FirestoreTransaction, FirestoreWriteBatch } from '../firebase';

/**
 * V13-7 (audit, retest 2026-11-13): two tabs or two phones must never sell the same stock. Every sale (any currency,
 * any window) is written inside one Firestore transaction with a lock document `stock_lock/main` holding a sequence
 * number, which every tab follows with a listener (hooks/useStockLockSeq; a deleted sale does not move it back).
 * Each stock row also keeps the number it made (`stockSeq`, for reading the history). If the lock moved on meanwhile (another tab sold first), the
 * whole sale is refused and nothing is written; the screen updates and the owner confirms again on the fresh stock.
 */
export const STOCK_CHANGED_MESSAGE = 'Une autre opération vient d’être enregistrée : vérifiez le stock et confirmez à nouveau.';
export class StockChangedError extends Error {
    constructor() { super(STOCK_CHANGED_MESSAGE); this.name = 'StockChangedError'; }
}

/** The number held by the lock document (0 before the first sale). Read by each tab with a listener. */
export function stockLockSeqOf(data: { seq?: unknown } | null | undefined): number {
    return Number(data?.seq) || 0;
}
/** Not loaded yet: nothing is written until the tab knows the lock (the same message asks to confirm again). */
export function requireStockLockSeq(seq: number | null | undefined): number {
    if (seq === null || seq === undefined) throw new StockChangedError();
    return seq;
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

/**
 * V14-3 (owner, 2026-11-13: « Erreur lors de la vente » on the live site): a transaction needs the server at that very
 * moment (a phone that drops the connection for a second fails it), while a batch waits and retries. So: the lock
 * first; if the transaction fails for any other reason than « another sale came first » or the write gate, the sale is
 * still saved with the batch it was built in, as before V13-7. The real error is logged for diagnosis.
 */
export async function commitWithStockLockOrBatch(db: DbLike, userDocRef: FirestoreDocumentReference, batch: Pick<FirestoreWriteBatch, 'operations' | 'commit'>, expected: number | null | undefined): Promise<void> {
    if (expected === null || expected === undefined) {
        // The lock was not read yet (no connection when the window opened): the usual save.
        await batch.commit();
        return;
    }
    try {
        await commitWithStockLock(db, userDocRef, batch, expected);
    }
    catch (error) {
        if (error instanceof StockChangedError || (error instanceof Error && error.name === 'FinancialWriteBlockedError'))
            throw error;
        console.warn('[stock lock] transaction failed, saving with the batch:', error);
        await batch.commit();
    }
}

/**
 * V14-5 (owner, 2026-11-13): not only sales take stock out. A project expense, a personal withdrawal, an investor
 * paid in a currency, a digital service, an adjustment, an edit or a delete all write stock rows (`usdt_txs`). The app
 * registers the lock once (MainApp), and every save whose batch touches a stock row goes through it automatically
 * (readModels/productionSummaryWriter), so two windows can never take the same stock whatever they record.
 */
export type AmbientStockLock = { db: DbLike; expected: () => number | null | undefined };
let ambientLock: AmbientStockLock | null = null;
export function registerStockLock(lock: AmbientStockLock): () => void {
    ambientLock = lock;
    return () => { if (ambientLock === lock) ambientLock = null; };
}
export function batchTouchesStock(batch: Pick<FirestoreWriteBatch, 'operations'>): boolean {
    return (batch.operations || []).some((op) => op.ref.nativeRef.path.includes('/usdt_txs/'));
}
/** The lock to use for this batch, or none (no stock row, or the app did not register it, as in tests). */
export function stockLockFor(batch: Pick<FirestoreWriteBatch, 'operations'>): { db: DbLike; expected: number | null } | undefined {
    if (!ambientLock || !batchTouchesStock(batch)) return undefined;
    return { db: ambientLock.db, expected: ambientLock.expected() ?? null };
}
/** The alert for a failed save: the clear « confirm again » message when another operation came first. */
export function saveErrorAlert(error: unknown, fallback: string): string {
    if (error instanceof StockChangedError) return `⚠️ ${STOCK_CHANGED_MESSAGE}`;
    if (error instanceof Error && error.name === 'NegativeStockError') return `❌ ${error.message}`;
    return fallback;
}
