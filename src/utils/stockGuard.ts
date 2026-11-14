import { computePamLedger } from './pamLedger';
import type { Tx } from '../types';

/**
 * V13-6 (audit): an edit or a delete of a past operation must never leave the stock negative at any later moment.
 * The whole history is replayed with the change; a sale that becomes larger than the stock held at its moment, and
 * was not already so before, means the change is refused before anything is written.
 */
// V13-7 (audit retest): any moment of the history, whatever took the stock out (a sale, an expense or a withdrawal
// paid in a currency, a service, a conversion): the balance after each operation must not go below zero.
const oversellIds = (txs: Tx[]): Set<string> => {
    // Every buy counts as held, its 24h lock ended or not: a lock limits selling, the stock is there all the same.
    // (With the clock at 0 every past buy carrying a lock read as never released, so the sales after it looked
    // oversold before the change too and a delete of that buy was not refused.)
    const ledger = computePamLedger(txs, { nowMs: Number.POSITIVE_INFINITY });
    const ids = new Set(ledger.warnings.filter((warning) => warning.code === 'oversell').map((warning) => String(warning.txId)));
    for (const row of ledger.operationRows)
        if (row.statsAfter.available < -0.005) ids.add(String(row.txId));
    return ids;
};

export function changeCreatesNegativeStock(before: Tx[], after: Tx[]): boolean {
    const was = oversellIds(before);
    for (const id of oversellIds(after))
        if (!was.has(id)) return true;
    return false;
}

/** The history with one operation's quantity changed (its date is kept: an edit keeps the original moment). */
export function withQuantity(txs: Tx[], txId: string, quantity: number): Tx[] {
    return txs.map((tx) => (tx.id === txId ? { ...tx, quantity } as Tx : tx));
}

/** The history without an operation and the stock rows linked to it (deleted with it). */
export function withoutOperation(txs: Tx[], txId: string): Tx[] {
    return txs.filter((tx) => tx.id !== txId && tx.linkedTxId !== txId);
}

export const NEGATIVE_STOCK_MESSAGE = 'Refusé : le stock deviendrait négatif à une date plus tard.';

export class NegativeStockError extends Error {
    constructor() { super(NEGATIVE_STOCK_MESSAGE); this.name = 'NegativeStockError'; }
}
type StockOp = { kind: 'set' | 'update' | 'delete'; ref: { nativeRef: { path: string } }; data?: unknown; options?: unknown };
const stockIdOf = (op: StockOp): string | null => {
    const match = /\/usdt_txs\/([^/]+)$/.exec(op.ref.nativeRef.path);
    return match ? match[1] : null;
};
/**
 * V14-5 (accounting tour): every delete and every edit, whichever window it comes from (the client page, the treasury,
 * an expense, a service, an investor), is checked on the stock rows it really writes, not on the row the owner pressed.
 * Before, only a delete pressed on a stock row was checked, and on that row alone: deleting the client row of a
 * purchase removed the purchase unchecked. Only deletes and edits of existing rows are looked at; a new row (a sale, an
 * expense) is checked against the balance by its own window.
 */
export function batchCreatesNegativeStock(txs: Tx[], operations: readonly StockOp[]): boolean {
    const known = new Map(txs.map((tx) => [String(tx.id), tx]));
    const changed = operations.filter((op) => { const id = stockIdOf(op); return id !== null && known.has(id) && op.kind !== 'set'; });
    if (changed.length === 0) return false;
    const after = new Map(known);
    for (const op of operations) {
        const id = stockIdOf(op);
        if (id === null) continue;
        if (op.kind === 'delete') after.delete(id);
        else if (op.kind === 'update') { const old = after.get(id); if (old) after.set(id, { ...old, ...(op.data as object) } as Tx); }
        else if (known.has(id)) after.set(id, { ...((op.options as { merge?: boolean } | undefined)?.merge ? after.get(id) : {}), ...(op.data as object), id } as Tx);
    }
    const was = oversellIds(txs);
    for (const id of oversellIds([...after.values()]))
        if (!was.has(id) && known.has(id)) return true;
    return false;
}
let currentHistory: (() => Tx[]) | null = null;
/** The app hands over its stock history once (MainApp); the batch writer checks deletes and edits against it. */
export function registerStockHistory(read: () => Tx[]): () => void {
    currentHistory = read;
    return () => { if (currentHistory === read) currentHistory = null; };
}
export function assertBatchKeepsStock(operations: readonly StockOp[]): void {
    if (currentHistory && batchCreatesNegativeStock(currentHistory(), operations)) throw new NegativeStockError();
}
