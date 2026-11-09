/**
 * V13-6 (audit): two tabs could sell the same stock at the same moment. Just before a sale is written, the server is
 * asked for stock operations newer than the newest this tab knows. One it does not know means another tab (or phone)
 * wrote meanwhile: the sale is refused, the screen updates, and the owner confirms again on the fresh stock.
 * Only the few newer documents are read, never the whole history (free daily quota).
 */
export const CONCURRENT_SALE_MESSAGE = 'Une autre opération vient d’être enregistrée : vérifiez le stock et confirmez à nouveau.';

export function newestKnownTimestamp(txs: ReadonlyArray<{ timestamp?: unknown }>): number {
    return txs.reduce((max, tx) => Math.max(max, Number(tx.timestamp) || 0), 0);
}

export function hasUnknownOperations(serverIds: ReadonlyArray<string>, knownIds: ReadonlySet<string>): boolean {
    return serverIds.some((id) => !knownIds.has(id));
}

type QueryLike = { where: (field: string, op: string, value: unknown) => { get: (options?: unknown) => Promise<{ docs: Array<{ id: string }> }> } };
export async function stockChangedOnServer(collection: QueryLike, txs: ReadonlyArray<{ id?: string; timestamp?: unknown }>): Promise<boolean> {
    const snap = await collection.where('timestamp', '>', newestKnownTimestamp(txs)).get({ source: 'server' });
    return hasUnknownOperations(snap.docs.map((doc) => doc.id), new Set(txs.map((tx) => String(tx.id))));
}
