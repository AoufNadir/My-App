import type { ClientTransactionDzd } from '../types';

export type ClientStatementTransactionsInput = {
    clientId: string;
    clientTransactions: ClientTransactionDzd[];
    startTs?: number;
    endTs?: number;
};

/**
 * Canonical client-statement dataset used by both Client Historique and PDF.
 * Linked portfolio operations remain represented by their client DZD row;
 * the linked Tx is resolved by the renderer for the row details.
 */
export function buildClientStatementTransactions(input: ClientStatementTransactionsInput): ClientTransactionDzd[] {
    return input.clientTransactions
        .filter((tx) => tx.clientId === input.clientId)
        .filter((tx) => input.startTs == null || tx.timestamp >= input.startTs)
        .filter((tx) => input.endTs == null || tx.timestamp <= input.endTs)
        .sort((left, right) => right.timestamp - left.timestamp || right.id.localeCompare(left.id));
}
