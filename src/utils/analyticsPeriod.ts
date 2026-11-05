import type { ClientTransactionDzd, Tx } from '../types';
import type { PamLedgerResult } from './pamLedger';

// The numbers of the Analyse page (V10-1): one template for a month, a year or everything, so the same
// figures answer every period. Pure: nothing here reads or writes the database.
//   · windows: the period and the one it is compared with (the same elapsed days while it is still running)
//   · stats: volumes, profit and margin per currency, the way the old page counted them
//   · effects: how much of the profit change comes from the volume sold and how much from the margin
//   · series: the profit of each day of a month, month of a year, or year
//   · ranking: the best clients of a window, and how concentrated the sales are

export type AnalyticsPeriodKind = 'month' | 'year' | 'all';
export type PeriodRange = { from: number; to: number };
export type PeriodWindow = {
    kind: AnalyticsPeriodKind;
    current: PeriodRange;
    /** null for « all », or when there is nothing before */
    previous: PeriodRange | null;
    /** The period has not ended: its figures are compared with the same elapsed days of the one before */
    inProgress: boolean;
};

const startOfDay = (year: number, month: number, day: number) => new Date(year, month, day, 0, 0, 0, 0).getTime();
const endOfDay = (year: number, month: number, day: number) => new Date(year, month, day, 23, 59, 59, 999).getTime();
const daysIn = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

/**
 * The period to show and the one to compare it with. A month or a year that is still running is compared
 * with the same elapsed days of the one before (« until the 4th » against « until the 4th »), never with a
 * whole one: on the 4th of the month a whole previous month would always look 85 % better.
 */
export function analyticsWindow(kind: AnalyticsPeriodKind, year: number, month: number, now: number, firstTimestamp: number | null = null): PeriodWindow {
    const today = new Date(now);
    if (kind === 'all') {
        const from = firstTimestamp !== null ? startOfDay(new Date(firstTimestamp).getFullYear(), new Date(firstTimestamp).getMonth(), new Date(firstTimestamp).getDate()) : startOfDay(today.getFullYear(), 0, 1);
        return { kind, current: { from, to: endOfDay(today.getFullYear(), today.getMonth(), today.getDate()) }, previous: null, inProgress: true };
    }
    if (kind === 'month') {
        const from = startOfDay(year, month, 1);
        const fullEnd = endOfDay(year, month, daysIn(year, month));
        const inProgress = now >= from && now <= fullEnd;
        const cutDay = inProgress ? today.getDate() : daysIn(year, month);
        const previousMonth = new Date(year, month - 1, 1);
        const py = previousMonth.getFullYear();
        const pm = previousMonth.getMonth();
        return {
            kind,
            current: { from, to: inProgress ? endOfDay(year, month, cutDay) : fullEnd },
            previous: { from: startOfDay(py, pm, 1), to: endOfDay(py, pm, Math.min(cutDay, daysIn(py, pm))) },
            inProgress,
        };
    }
    const from = startOfDay(year, 0, 1);
    const fullEnd = endOfDay(year, 11, 31);
    const inProgress = now >= from && now <= fullEnd;
    const cutMonth = inProgress ? today.getMonth() : 11;
    const cutDay = inProgress ? today.getDate() : 31;
    return {
        kind,
        current: { from, to: inProgress ? endOfDay(year, cutMonth, cutDay) : fullEnd },
        previous: { from: startOfDay(year - 1, 0, 1), to: endOfDay(year - 1, cutMonth, Math.min(cutDay, daysIn(year - 1, cutMonth))) },
        inProgress,
    };
}

export type CurrencyPeriodStats = {
    sold: number;
    bought: number;
    /** Realized profit of the sales of this currency */
    profit: number;
    sellCount: number;
    /** Profit ÷ quantity sold × 100: what 100 units sold earned. Null when nothing was sold. */
    marginPer100: number | null;
};
export type PeriodStats = {
    usdt: CurrencyPeriodStats;
    eur: CurrencyPeriodStats;
    /** All the sales, as the old page counted them */
    profit: number;
    sellCount: number;
    winCount: number;
    winRate: number | null;
    avgProfitPerSell: number | null;
    bestSellProfit: number;
    /** USDT sales: price weighted by quantity */
    avgSellPriceUsdt: number | null;
};

type LedgerForStats = Pick<PamLedgerResult, 'profitByTxId' | 'sellProfitRows'>;

const emptyCurrency = (): CurrencyPeriodStats => ({ sold: 0, bought: 0, profit: 0, sellCount: 0, marginPer100: null });
const inRange = (timestamp: number, range: PeriodRange) => timestamp >= range.from && timestamp <= range.to;

/** The same sums as the old page (volumes by currency, profit of the sales), for any window. */
export function computePeriodStats(transactions: ReadonlyArray<Tx>, ledger: LedgerForStats, range: PeriodRange): PeriodStats {
    const usdt = emptyCurrency();
    const eur = emptyCurrency();
    let profit = 0;
    for (const tx of transactions) {
        if (!inRange(tx.timestamp, range))
            continue;
        const bucket = tx.currency === 'USDT' ? usdt : tx.currency === 'EUR' ? eur : null;
        if (tx.type === 'buy' && bucket)
            bucket.bought += tx.quantity;
        else if (tx.type === 'sell') {
            const sellProfit = ledger.profitByTxId[tx.id]?.derivedProfit || 0;
            profit += sellProfit;
            if (bucket) {
                bucket.sold += tx.quantity;
                bucket.profit += sellProfit;
                bucket.sellCount += 1;
            }
        }
    }
    for (const bucket of [usdt, eur])
        bucket.marginPer100 = bucket.sold > 0 ? (bucket.profit / bucket.sold) * 100 : null;
    let sellCount = 0;
    let winCount = 0;
    let bestSellProfit = 0;
    let priceQuantity = 0;
    let priceTotal = 0;
    for (const row of ledger.sellProfitRows) {
        if (!inRange(row.timestamp, range))
            continue;
        sellCount += 1;
        const rowProfit = row.derivedProfit || 0;
        if (rowProfit > 0)
            winCount += 1;
        if (rowProfit > bestSellProfit)
            bestSellProfit = rowProfit;
        if (row.currency === 'USDT' && row.sellPrice > 0 && row.quantity > 0) {
            priceQuantity += row.quantity;
            priceTotal += row.quantity * row.sellPrice;
        }
    }
    return {
        usdt,
        eur,
        profit,
        sellCount,
        winCount,
        winRate: sellCount > 0 ? (winCount / sellCount) * 100 : null,
        avgProfitPerSell: sellCount > 0 ? profit / sellCount : null,
        bestSellProfit,
        avgSellPriceUsdt: priceQuantity > 0 ? priceTotal / priceQuantity : null,
    };
}

/** Is there anything to compare with: a sale or a volume in the window before. */
export const hasActivity = (stats: PeriodStats): boolean => stats.sellCount > 0 || stats.usdt.sold > 0 || stats.eur.sold > 0 || stats.usdt.bought > 0 || stats.eur.bought > 0;

export type ProfitEffects = {
    /** Profit now minus profit before */
    total: number;
    /** What the change in quantity sold alone would have added (at the margin of before) */
    volume: number;
    /** What the change in margin alone added (on the quantity sold now) */
    margin: number;
    /** A currency sold now and not before, or the other way round: the whole change is its own */
    other: number;
};

/**
 * Why the profit moved. For each currency, with m = profit ÷ quantity sold:
 *   change = (V₁ − V₀) × m₀  +  V₁ × (m₁ − m₀)
 * is exact (not an approximation): the first term is the volume, the second the margin. A currency with no
 * sales on one side has no margin to compare, so its change goes to « other ». The three always add up to
 * `total`, whatever the sales were.
 */
export function profitEffects(current: PeriodStats, previous: PeriodStats): ProfitEffects {
    let volume = 0;
    let margin = 0;
    let other = 0;
    for (const key of ['usdt', 'eur'] as const) {
        const now = current[key];
        const before = previous[key];
        if (now.sold > 0 && before.sold > 0) {
            const marginBefore = before.profit / before.sold;
            volume += (now.sold - before.sold) * marginBefore;
            margin += now.profit - now.sold * marginBefore;
        }
        else
            other += now.profit - before.profit;
    }
    const total = current.profit - previous.profit;
    // Sales of anything else (or rounding) still make the three add up.
    other += total - (volume + margin + other);
    return { total, volume, margin, other };
}

/** Percent change, null when there is nothing before to compare with. */
export function percentChange(current: number | null, previous: number | null): number | null {
    if (current === null || previous === null || previous === 0)
        return null;
    return ((current - previous) / Math.abs(previous)) * 100;
}

export type SeriesBucket = {
    /** Day of the month (1…), month of the year (0…11) or the year itself */
    index: number;
    profit: number;
    /** Something was sold (or lost) in it */
    active: boolean;
    /** The day, month or year we are in now */
    isCurrent: boolean;
};
export type ProfitSeries = {
    buckets: SeriesBucket[];
    activeCount: number;
    positiveCount: number;
    best: SeriesBucket | null;
    worst: SeriesBucket | null;
    /** The bucket we are in now, when the period is running */
    current: SeriesBucket | null;
};

/** The profit of each day of a month, month of a year, or year (all), from the sales of the ledger. */
export function profitSeries(kind: AnalyticsPeriodKind, year: number, month: number, now: number, transactions: ReadonlyArray<Tx>, ledger: Pick<PamLedgerResult, 'profitByTxId'>, firstYear?: number): ProfitSeries {
    const today = new Date(now);
    const profitOf = new Map<number, number>();
    const indexOf = (timestamp: number): number | null => {
        const date = new Date(timestamp);
        if (kind === 'month')
            return date.getFullYear() === year && date.getMonth() === month ? date.getDate() : null;
        if (kind === 'year')
            return date.getFullYear() === year ? date.getMonth() : null;
        return date.getFullYear();
    };
    for (const tx of transactions) {
        if (tx.type !== 'sell')
            continue;
        const index = indexOf(tx.timestamp);
        if (index === null)
            continue;
        profitOf.set(index, (profitOf.get(index) || 0) + (ledger.profitByTxId[tx.id]?.derivedProfit || 0));
    }
    const indexes: number[] = [];
    if (kind === 'month')
        for (let day = 1; day <= daysIn(year, month); day++)
            indexes.push(day);
    else if (kind === 'year')
        for (let m = 0; m < 12; m++)
            indexes.push(m);
    else {
        const years = [...profitOf.keys()];
        const first = firstYear ?? (years.length ? Math.min(...years) : today.getFullYear());
        for (let y = Math.min(first, today.getFullYear()); y <= today.getFullYear(); y++)
            indexes.push(y);
    }
    const currentIndex = kind === 'month' ? (today.getFullYear() === year && today.getMonth() === month ? today.getDate() : null)
        : kind === 'year' ? (today.getFullYear() === year ? today.getMonth() : null)
            : today.getFullYear();
    const buckets = indexes.map((index): SeriesBucket => {
        const profit = profitOf.get(index) || 0;
        return { index, profit, active: profitOf.has(index) && profit !== 0, isCurrent: index === currentIndex };
    });
    const active = buckets.filter((bucket) => bucket.active);
    const best = active.length ? active.reduce((a, b) => (b.profit > a.profit ? b : a)) : null;
    const worst = active.length ? active.reduce((a, b) => (b.profit < a.profit ? b : a)) : null;
    return {
        buckets,
        activeCount: active.length,
        positiveCount: active.filter((bucket) => bucket.profit > 0).length,
        best,
        worst,
        current: buckets.find((bucket) => bucket.isCurrent) ?? null,
    };
}

export type ClientRank = {
    clientId: string;
    clientName: string;
    sellVolumeUsdt: number;
    realizedProfit: number;
    sellCount: number;
};
export type ClientRanking = {
    byVolume: ClientRank[];
    byProfit: ClientRank[];
    /** The three clients that bought the most USDT: their share of all the USDT sold in the window (0…100), null when none was sold */
    topThreeShare: number | null;
};

/**
 * The clients of the sales of a window: for each sale the client of its linked row (the sender of a transfer
 * only if nobody else is linked), as the old page did. Ranked by USDT sold or by profit.
 */
export function rankClients(input: {
    transactions: ReadonlyArray<Tx>;
    clientTransactions: ReadonlyArray<ClientTransactionDzd>;
    ledger: Pick<PamLedgerResult, 'profitByTxId'>;
    clientNameById: ReadonlyMap<string, string>;
    unknownName: string;
    range: PeriodRange;
    limit?: number;
}): ClientRanking {
    const { transactions, clientTransactions, ledger, clientNameById, unknownName, range } = input;
    const limit = input.limit ?? 5;
    const linked = new Map<string, { clientId: string; timestamp: number; isSecondary: boolean }>();
    for (const row of clientTransactions) {
        if (!row.linkedTxId || !row.clientId)
            continue;
        const isSecondary = row.linkRole === 'dzd_receiver';
        const existing = linked.get(row.linkedTxId);
        if (!existing || (existing.isSecondary && !isSecondary) || (existing.isSecondary === isSecondary && row.timestamp > existing.timestamp))
            linked.set(row.linkedTxId, { clientId: row.clientId, timestamp: row.timestamp, isSecondary });
    }
    const ranks = new Map<string, ClientRank>();
    let totalUsdtSold = 0;
    for (const tx of transactions) {
        if (tx.type !== 'sell' || !tx.id || !inRange(tx.timestamp, range))
            continue;
        if (tx.currency === 'USDT')
            totalUsdtSold += Number(tx.quantity || 0);
        const client = linked.get(tx.id);
        if (!client)
            continue;
        let rank = ranks.get(client.clientId);
        if (!rank) {
            rank = { clientId: client.clientId, clientName: clientNameById.get(client.clientId) || unknownName, sellVolumeUsdt: 0, realizedProfit: 0, sellCount: 0 };
            ranks.set(client.clientId, rank);
        }
        if (tx.currency === 'USDT')
            rank.sellVolumeUsdt += Number(tx.quantity || 0);
        rank.realizedProfit += ledger.profitByTxId[tx.id]?.derivedProfit || 0;
        rank.sellCount += 1;
    }
    const rows = [...ranks.values()];
    const byVolume = rows.filter((row) => row.sellVolumeUsdt > 0)
        .sort((a, b) => b.sellVolumeUsdt - a.sellVolumeUsdt || b.realizedProfit - a.realizedProfit || a.clientName.localeCompare(b.clientName, 'fr'));
    const byProfit = rows.filter((row) => row.sellCount > 0)
        .sort((a, b) => b.realizedProfit - a.realizedProfit || b.sellVolumeUsdt - a.sellVolumeUsdt || a.clientName.localeCompare(b.clientName, 'fr'));
    const topThree = byVolume.slice(0, 3).reduce((sum, row) => sum + row.sellVolumeUsdt, 0);
    return {
        byVolume: byVolume.slice(0, limit),
        byProfit: byProfit.slice(0, limit),
        topThreeShare: totalUsdtSold > 0 ? (topThree / totalUsdtSold) * 100 : null,
    };
}
