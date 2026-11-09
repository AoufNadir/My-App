import { computePamLedger } from './pamLedger';
import type { Tx } from '../types';

/**
 * V13-6 (audit): an edit or a delete of a past operation must never leave the stock negative at any later moment.
 * The whole history is replayed with the change; a sale that becomes larger than the stock held at its moment, and
 * was not already so before, means the change is refused before anything is written.
 */
const oversellIds = (txs: Tx[]): Set<string> => new Set(computePamLedger(txs, { nowMs: Date.now() }).warnings
    .filter((warning) => warning.code === 'oversell')
    .map((warning) => String(warning.txId)));

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
