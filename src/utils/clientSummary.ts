import type { ClientTransactionDzd, Tx } from '../types';
import { buildClientActivityReport, rangePeriod, type ClientActivityReport, type ReportEntry } from './clientActivityReport';

/**
 * The client summary picture (V4-4): the client's balance and last operations, sent from the
 * phone. Built on the client activity report over the whole history, so it reads its operations
 * the same way and never shows what is ours (our buy price, profit, notes, our EUR cost).
 */

export const CLIENT_SUMMARY_OPERATION_COUNT = 5;

export type ClientSummary = {
    report: ClientActivityReport;
    /** The client page balance: + we owe the client, − the client owes us */
    balanceCents: number;
    /** Newest first */
    lastOperations: ReportEntry[];
    operationCount: number;
    showCents: boolean;
};

export function buildClientSummary(input: { clientId: string; clientRows: ReadonlyArray<ClientTransactionDzd>; transactions: ReadonlyArray<Tx>; now: number }): ClientSummary {
    const ownRows = input.clientRows.filter((row) => row.clientId === input.clientId);
    const first = ownRows.length ? Math.min(...ownRows.map((row) => row.timestamp)) : input.now;
    // From the first operation: the opening balance is 0 and the closing one is the client page balance.
    const period = rangePeriod(Math.min(first, input.now), input.now);
    const report = buildClientActivityReport({ clientId: input.clientId, clientRows: ownRows, transactions: input.transactions, period, now: input.now });
    return {
        report,
        balanceCents: report.balance.closingCents,
        lastOperations: report.operations.slice(-CLIENT_SUMMARY_OPERATION_COUNT).reverse().map((row) => row.entry),
        operationCount: report.operations.length,
        showCents: report.showCents,
    };
}

/** The amount of an operation as the client reads it: + what reaches the balance in their favour, − what they owe. */
export function summaryOperationAmountCents(entry: ReportEntry): { cents: number | null; sign: '+' | '−' | '' } {
    if (entry.dzdCents === null)
        return { cents: null, sign: '' };
    if (!entry.affectsBalance || entry.kind === 'buy' || entry.kind === 'service')
        return { cents: entry.dzdCents, sign: '' };
    return { cents: entry.dzdCents, sign: entry.balanceCents >= 0 ? '+' : '−' };
}
