import type { ClientTransactionDzd, Tx } from '../types';
import { buildClientActivityReport, rangePeriod, type ClientActivityReport, type ReportEntry } from './clientActivityReport';

/**
 * The client summary picture (V4-4): the client's balance and last operations, sent from the
 * phone. Built on the client activity report over the whole history, so it reads its operations
 * the same way and never shows what is ours (our buy price, profit, notes, our EUR cost).
 *
 * V6-1: each operation also carries a small context read from its own ledger row (how it was paid,
 * whether another client's account was involved) so the picture can say what happened in plain
 * words. The context holds no name, note or price of ours.
 */

export const CLIENT_SUMMARY_OPERATION_COUNT = 5;

/** How the money moved, when the row says it: handed over in cash, or through BaridiMob. */
export type SummaryChannel = 'cash' | 'baridi';

export type SummaryRowContext = {
    /** This client's operation was paid or settled through another client's account (never named) */
    viaOtherClient: boolean;
    /** This row is the other client's side: the account that took or paid money for someone else's operation */
    onBehalf: boolean;
    channel?: SummaryChannel;
};

export type SummaryRow = {
    entry: ReportEntry;
    /** The client page balance after this operation, in cents */
    balanceAfterCents: number;
    context: SummaryRowContext;
};

export type ClientSummary = {
    report: ClientActivityReport;
    /** The client page balance: + we owe the client, − the client owes us */
    balanceCents: number;
    /** Newest first */
    lastOperations: ReportEntry[];
    /** The same operations with the balance after each and how it happened */
    lastRows: SummaryRow[];
    operationCount: number;
    showCents: boolean;
};

const channelOf = (paymentMethod: unknown): SummaryChannel | undefined => {
    if (paymentMethod === 'Espèces' || paymentMethod === 'EspÃ¨ces')
        return 'cash';
    if (paymentMethod === 'BaridiMob')
        return 'baridi';
    return undefined;
};

/** What the ledger row says about how the operation happened. `linked` is the portfolio operation it points to. */
export function summaryContextOf(row: ClientTransactionDzd, linked?: Tx): SummaryRowContext {
    const portfolio = linked && (linked.type === 'buy' || linked.type === 'sell') ? linked : undefined;
    const onBehalf = row.linkRole === 'dzd_receiver';
    const viaOtherClient = !onBehalf && Boolean(portfolio?.linkedClientDzdId) && portfolio?.linkedClientDzdId !== row.clientId;
    const channel = channelOf(row.paymentMethod);
    return { viaOtherClient, onBehalf, ...(channel ? { channel } : {}) };
}

export function buildClientSummary(input: { clientId: string; clientRows: ReadonlyArray<ClientTransactionDzd>; transactions: ReadonlyArray<Tx>; now: number }): ClientSummary {
    const ownRows = input.clientRows.filter((row) => row.clientId === input.clientId);
    const first = ownRows.length ? Math.min(...ownRows.map((row) => row.timestamp)) : input.now;
    // From the first operation: the opening balance is 0 and the closing one is the client page balance.
    const period = rangePeriod(Math.min(first, input.now), input.now);
    const report = buildClientActivityReport({ clientId: input.clientId, clientRows: ownRows, transactions: input.transactions, period, now: input.now });
    const rowById = new Map(ownRows.map((row) => [row.id, row] as const));
    const txById = new Map(input.transactions.map((tx) => [tx.id, tx] as const));
    const lastRows: SummaryRow[] = report.operations.slice(-CLIENT_SUMMARY_OPERATION_COUNT).reverse().map(({ entry, balanceAfterCents }) => {
        const row = rowById.get(entry.id);
        const linked = row?.linkedTxId ? txById.get(row.linkedTxId) : undefined;
        return { entry, balanceAfterCents, context: row ? summaryContextOf(row, linked) : { viaOtherClient: false, onBehalf: false } };
    });
    return {
        report,
        balanceCents: report.balance.closingCents,
        lastOperations: lastRows.map((row) => row.entry),
        lastRows,
        operationCount: report.operations.length,
        showCents: report.showCents,
    };
}

export type SummaryAmount = {
    /** Null when the only value is in euros (the euro amount is shown instead) */
    cents: number | null;
    /** + puts it in the client's favour, − puts it against them, none: settled on the spot, the balance does not move */
    sign: '+' | '−' | '';
};

/** The amount of an operation as the client reads it. */
export function summaryAmountOf(entry: ReportEntry): SummaryAmount {
    if (entry.dzdCents === null)
        return { cents: null, sign: '' };
    if (!entry.affectsBalance || entry.balanceCents === 0)
        return { cents: entry.dzdCents, sign: '' };
    return { cents: entry.dzdCents, sign: entry.balanceCents > 0 ? '+' : '−' };
}
