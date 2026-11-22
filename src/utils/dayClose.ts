// V23-1 (owner): « Clôture du jour », the evening in one screen: what was sold today and its profit, what was bought,
// the money that moved in each dinar account, then what each wallet should hold now (to count it). Read only.
type TxLike = { id: string; type?: string; currency?: string; quantity?: number; total?: number; timestamp?: number };
type TreasuryLike = { type?: string; source?: string; amount?: number; timestamp?: number };

export type DayClose = {
    sales: number;
    buys: number;
    soldByCurrency: Record<string, number>;
    boughtByCurrency: Record<string, number>;
    salesTotal: number;
    profit: number;
    moves: Record<string, { in: number; out: number }>;
};

export function dayStartMs(now: number): number {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
}

const r2 = (v: number) => Math.round(v * 100) / 100;

export function buildDayClose(input: { transactions: readonly TxLike[]; profitByTxId: Record<string, { derivedProfit?: number | null } | undefined>; treasury: readonly TreasuryLike[]; now: number }): DayClose {
    const from = dayStartMs(input.now);
    const today = (ts: unknown) => Number(ts) >= from && Number(ts) <= input.now + 60_000;
    const out: DayClose = { sales: 0, buys: 0, soldByCurrency: {}, boughtByCurrency: {}, salesTotal: 0, profit: 0, moves: {} };
    for (const tx of input.transactions) {
        if (!today(tx.timestamp)) continue;
        const currency = tx.currency || 'USDT';
        const qty = Number(tx.quantity) || 0;
        if (tx.type === 'sell') {
            out.sales += 1;
            out.soldByCurrency[currency] = r2((out.soldByCurrency[currency] || 0) + qty);
            out.salesTotal = r2(out.salesTotal + (Number(tx.total) || 0));
            out.profit = r2(out.profit + (Number(input.profitByTxId[tx.id]?.derivedProfit) || 0));
        }
        else if (tx.type === 'buy') {
            out.buys += 1;
            out.boughtByCurrency[currency] = r2((out.boughtByCurrency[currency] || 0) + qty);
        }
    }
    for (const t of input.treasury) {
        if (!today(t.timestamp) || !t.source) continue;
        const amount = Math.abs(Number(t.amount) || 0);
        const move = out.moves[t.source] ?? (out.moves[t.source] = { in: 0, out: 0 });
        if (t.type === 'Ajout') move.in = r2(move.in + amount);
        else if (t.type === 'Retrait') move.out = r2(move.out + amount);
    }
    return out;
}
