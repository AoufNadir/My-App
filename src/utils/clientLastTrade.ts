import type { ClientTransactionDzd, Tx } from '../types';

// What the new-operation window tells you about a client before the quantity (V11-1): the last price you
// sold to him (or bought from him), when, how much, what you earned on it and how it was settled; the last
// price to anyone when he is new; and the clients you dealt with most recently. Read-only: nothing here
// writes, and no number of the operation depends on it (the price field stays yours to type).

export type TradeSide = 'sell' | 'buy';
export type TradePayment = 'cash' | 'baridi' | 'credit' | null;
export type ClientTrade = {
    txId: string;
    clientId: string;
    /** DZD per unit */
    price: number;
    quantity: number;
    timestamp: number;
    /** Profit ÷ quantity of that sale; null for a purchase, or when the ledger has no profit for it */
    marginPerUnit: number | null;
    payment: TradePayment;
};

type ProfitLookup = Record<string, { derivedProfit: number } | undefined>;
type Linked = { clientId: string; payment: TradePayment; timestamp: number };

const paymentOf = (row: ClientTransactionDzd): TradePayment => (row.paymentMethod === 'Crédit' ? 'credit' : row.paymentMethod === 'Espèces' ? 'cash' : row.paymentMethod === 'BaridiMob' ? 'baridi' : null);

/** The client of each operation: its main linked row (the receiver of a transfer only when nobody else is linked). */
export function clientOfEachTrade(clientTransactions: ReadonlyArray<ClientTransactionDzd>): Map<string, Linked> {
    const linked = new Map<string, Linked & { secondary: boolean }>();
    for (const row of clientTransactions) {
        if (!row.linkedTxId || !row.clientId)
            continue;
        const secondary = row.linkRole === 'dzd_receiver';
        const existing = linked.get(row.linkedTxId);
        if (!existing || (existing.secondary && !secondary) || (existing.secondary === secondary && row.timestamp > existing.timestamp))
            linked.set(row.linkedTxId, { clientId: row.clientId, payment: paymentOf(row), timestamp: row.timestamp, secondary });
    }
    return linked;
}

/** A price in dinars the operation really had: sales and purchases settled in euros have none. */
function dinarPrice(tx: Tx, side: TradeSide): number | null {
    if (side === 'sell') {
        if (tx.settlementCurrency === 'EUR')
            return null;
        return tx.sell && tx.sell > 0 ? tx.sell : null;
    }
    if (tx.purchaseFundingCurrency === 'EUR')
        return null;
    return tx.price && tx.price > 0 ? tx.price : null;
}

type Source = {
    transactions: ReadonlyArray<Tx>;
    clientTransactions: ReadonlyArray<ClientTransactionDzd>;
    profitByTxId: ProfitLookup;
};

function trades(source: Source, side: TradeSide, currency: 'USDT' | 'EUR'): ClientTrade[] {
    const clients = clientOfEachTrade(source.clientTransactions);
    const result: ClientTrade[] = [];
    for (const tx of source.transactions) {
        if (tx.type !== side || tx.currency !== currency || !tx.id)
            continue;
        const client = clients.get(tx.id);
        const price = dinarPrice(tx, side);
        if (!client || price === null)
            continue;
        const profit = side === 'sell' ? source.profitByTxId[tx.id]?.derivedProfit : undefined;
        result.push({
            txId: tx.id,
            clientId: client.clientId,
            price,
            quantity: Number(tx.quantity || 0),
            timestamp: tx.timestamp,
            marginPerUnit: profit !== undefined && tx.quantity > 0 ? profit / tx.quantity : null,
            payment: client.payment,
        });
    }
    return result.sort((a, b) => b.timestamp - a.timestamp);
}

/** The last sale to (or purchase from) this client, in this currency. */
export function lastTradeWithClient(source: Source, input: { clientId: string; side: TradeSide; currency: 'USDT' | 'EUR' }): ClientTrade | null {
    return trades(source, input.side, input.currency).find((trade) => trade.clientId === input.clientId) ?? null;
}

/** The last sale (or purchase) to anyone else: the reference for a client with no history. */
export function lastTradeWithAnyone(source: Source, input: { side: TradeSide; currency: 'USDT' | 'EUR'; exceptClientId?: string }): ClientTrade | null {
    return trades(source, input.side, input.currency).find((trade) => trade.clientId !== input.exceptClientId) ?? null;
}

/** The clients of the latest operations, most recent first, each once. */
export function recentClientIds(clientTransactions: ReadonlyArray<ClientTransactionDzd>, limit = 3): string[] {
    const clients = clientOfEachTrade(clientTransactions);
    const latest = new Map<string, number>();
    for (const { clientId, timestamp } of clients.values())
        latest.set(clientId, Math.max(latest.get(clientId) ?? 0, timestamp));
    return [...latest.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([clientId]) => clientId);
}

/** Calendar days between a date and now: 0 today, 1 yesterday… */
export function daysAgo(timestamp: number, now: number): number {
    const day = (value: number) => { const d = new Date(value); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
    return Math.max(0, Math.round((day(now) - day(timestamp)) / 86_400_000));
}
