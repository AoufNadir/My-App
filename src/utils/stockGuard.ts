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
    const ledger = computePamLedger(txs, { nowMs: 0 });
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
