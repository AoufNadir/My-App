import type { ClientTransactionDzd } from '../../types';

/**
 * Lookup tables for findClientTransferCounterpart, built once per client transactions array so
 * each lookup no longer scans every row.
 * - byId: the FIRST row for each id, i.e. what `rows.find((row) => row.id === id)` returns.
 * - transfersByType: rows of type 'Transfert Entrant' / 'Transfert Sortant', grouped by
 *   type, then date, then time. Each group keeps the original array order.
 */
export type ClientTransferIndex = {
    byId: Map<string, ClientTransactionDzd>;
    transfersByType: Map<string, Map<string, Map<string, ClientTransactionDzd[]>>>;
};

export function buildClientTransferIndex(clientTransactionsDzd: ClientTransactionDzd[]): ClientTransferIndex {
    const byId = new Map<string, ClientTransactionDzd>();
    const transfersByType = new Map<string, Map<string, Map<string, ClientTransactionDzd[]>>>();
    for (const row of clientTransactionsDzd) {
        if (!byId.has(row.id))
            byId.set(row.id, row);
        if (row.type !== 'Transfert Entrant' && row.type !== 'Transfert Sortant')
            continue;
        let byDate = transfersByType.get(row.type);
        if (!byDate) {
            byDate = new Map();
            transfersByType.set(row.type, byDate);
        }
        let byTime = byDate.get(row.date);
        if (!byTime) {
            byTime = new Map();
            byDate.set(row.date, byTime);
        }
        const group = byTime.get(row.time);
        if (group)
            group.push(row);
        else
            byTime.set(row.time, [row]);
    }
    return { byId, transfersByType };
}

/**
 * Same result as the previous linear version for every row:
 * - a linkedTxId that matches a row returns the first row with that id;
 * - otherwise, among rows passing the same filter, the one closest in timestamp wins and, on equal
 *   distance, the earliest in the original array (the old code used a stable sort and took [0]).
 * The group lookup only narrows the scan; the filter below still checks every original condition.
 */
export function findClientTransferCounterpart(tx: ClientTransactionDzd, index: ClientTransferIndex): ClientTransactionDzd | null {
    if (tx.type !== 'Transfert Sortant' && tx.type !== 'Transfert Entrant')
        return null;
    if (tx.linkedTxId) {
        const linked = index.byId.get(tx.linkedTxId);
        if (linked)
            return linked;
    }
    const counterpartType = tx.type === 'Transfert Sortant' ? 'Transfert Entrant' : 'Transfert Sortant';
    const counterpartAmount = -Number(tx.montant || 0);
    const candidates = index.transfersByType.get(counterpartType)?.get(tx.date)?.get(tx.time);
    if (!candidates)
        return null;
    const txTimestamp = Number(tx.timestamp || 0);
    let best: ClientTransactionDzd | null = null;
    let bestDistance = 0;
    for (const candidate of candidates) {
        if (candidate.id !== tx.id
            && candidate.clientId !== tx.clientId
            && candidate.type === counterpartType
            && candidate.date === tx.date
            && candidate.time === tx.time
            && Math.abs(Number(candidate.montant || 0) - counterpartAmount) <= 0.01
            && Math.abs(Number(candidate.timestamp || 0) - txTimestamp) <= 2000) {
            const distance = Math.abs(Number(candidate.timestamp || 0) - txTimestamp);
            // Strictly closer only, so the earliest row keeps a tie.
            if (best === null || distance < bestDistance) {
                best = candidate;
                bestDistance = distance;
            }
        }
    }
    return best;
}
