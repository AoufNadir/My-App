// V18 (owner, 2026-11-19): the new Analyse page answers four questions: how am I doing, what should I do, where did
// the profit come from, does my money work well. This file holds the new figures. Read only: every number comes from
// the operations and the ledger the app already computes; nothing is written and no stored figure changes.
import type { Tx } from '../types';
import type { PeriodRange } from './analyticsPeriod';

const DAY = 86_400_000;
export const INSIGHT_RULES = {
    minQtyPerSide: 200, // credit vs paid now: at least 200 USDT on each side to compare margins
    minGapPerUnit: 0.2, // a margin gap under 0.2 DZD per USDT is noise
    clientMinUsual: 500, // a client counts in the trends from 500 USDT in the previous period
    fallingShare: 0.6, // « falling »: 60 % or less of the previous period
    risingShare: 1.4, // « rising »: 140 % or more
    clientMinDiff: 300, // and at least 300 USDT of difference
    debtShareFloor: 0.15, // the money in debts is worth pointing at from 15 % of the capital
    stockDaysFloor: 10, // stock that waits more than 10 days
} as const;

/** A sale row as the ledger gives it (computePamLedger().sellProfitRows). */
export type SaleRow = { txId: string; tx?: Partial<Tx> & { linkedClientId?: string }; currency: string; quantity: number; timestamp: number; derivedProfit: number; soldCostDzd?: number };

const inRange = (ts: number, r: PeriodRange) => ts >= r.from && ts <= r.to;
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Paid later (credit), paid now, or not known (old rows without the choice). */
export function paymentKind(tx: Partial<Tx> | undefined): 'credit' | 'now' | 'unknown' {
    const status = String(tx?.clientPaymentStatus ?? '');
    if (status === 'credit' || tx?.paymentMethod === 'Crédit') return 'credit';
    if (status || tx?.paymentMethod === 'Espèces' || tx?.paymentMethod === 'BaridiMob') return 'now';
    return 'unknown';
}

export type CreditVsNow = { creditQty: number; nowQty: number; creditMargin: number; nowMargin: number; gap: number; impact: number } | null;
/** USDT margin per unit, sold on credit against sold paid now, in the period. Null when one side is too small. */
export function creditVsNow(sales: readonly SaleRow[], range: PeriodRange): CreditVsNow {
    const side = { credit: { qty: 0, profit: 0 }, now: { qty: 0, profit: 0 } };
    for (const s of sales) {
        if (s.currency !== 'USDT' || !inRange(s.timestamp, range)) continue;
        const kind = paymentKind(s.tx);
        if (kind === 'unknown') continue;
        side[kind].qty += num(s.quantity);
        side[kind].profit += num(s.derivedProfit);
    }
    if (side.credit.qty < INSIGHT_RULES.minQtyPerSide || side.now.qty < INSIGHT_RULES.minQtyPerSide) return null;
    const creditMargin = side.credit.profit / side.credit.qty;
    const nowMargin = side.now.profit / side.now.qty;
    const gap = nowMargin - creditMargin;
    return { creditQty: side.credit.qty, nowQty: side.now.qty, creditMargin, nowMargin, gap, impact: gap > 0 ? gap * side.credit.qty : 0 };
}

export type CapitalUse = { profitPerMillion: number | null; stockDays: number | null; debtShare: number | null; debts: number; capital: number };
/**
 * Does the money work? Profit per million of capital over 30 days (at the period's pace), the days the stock waits
 * (its value ÷ the cost sold per day over the last 30 days), and the part of the capital held in client debts.
 */
export function capitalUse(input: { profit: number; range: PeriodRange; now: number; sales: readonly SaleRow[]; capital: number; debts: number; stockValue: number }): CapitalUse {
    const end = Math.min(input.range.to, input.now);
    const days = Math.max(1, (end - input.range.from) / DAY);
    const capital = Math.max(0, input.capital);
    const profitPerMillion = capital > 0 ? (input.profit / days) * 30 / (capital / 1_000_000) : null;
    const from30 = input.now - 30 * DAY;
    const cost30 = input.sales.filter((s) => s.timestamp >= from30 && s.timestamp <= input.now).reduce((sum, s) => sum + num(s.soldCostDzd), 0);
    const stockDays = cost30 > 0 ? input.stockValue / (cost30 / 30) : null;
    return { profitPerMillion, stockDays, debtShare: capital > 0 ? Math.max(0, input.debts) / capital : null, debts: Math.max(0, input.debts), capital };
}

export type ClientTrend = { clientId: string; now: number; before: number; change: number; impact: number };
/** USDT bought by each client now and in the period before (the same elapsed days): who rises, who falls. */
export function clientTrends(sales: readonly SaleRow[], current: PeriodRange, previous: PeriodRange | null): { rising: ClientTrend[]; falling: ClientTrend[] } {
    if (!previous) return { rising: [], falling: [] };
    const acc = new Map<string, { now: number; before: number; beforeProfit: number }>();
    for (const s of sales) {
        if (s.currency !== 'USDT') continue;
        const id = s.tx?.linkedClientId;
        if (!id || id === 'none') continue;
        const row = acc.get(id) ?? { now: 0, before: 0, beforeProfit: 0 };
        if (inRange(s.timestamp, current)) row.now += num(s.quantity);
        else if (inRange(s.timestamp, previous)) { row.before += num(s.quantity); row.beforeProfit += num(s.derivedProfit); }
        acc.set(id, row);
    }
    const rising: ClientTrend[] = [];
    const falling: ClientTrend[] = [];
    for (const [clientId, r] of acc) {
        if (r.before < INSIGHT_RULES.clientMinUsual) {
            if (r.before === 0 && r.now >= INSIGHT_RULES.clientMinUsual) rising.push({ clientId, now: r.now, before: 0, change: 1, impact: 0 });
            continue;
        }
        const ratio = r.now / r.before;
        const diff = r.now - r.before;
        const margin = r.beforeProfit / r.before;
        if (ratio <= INSIGHT_RULES.fallingShare && -diff >= INSIGHT_RULES.clientMinDiff) falling.push({ clientId, now: r.now, before: r.before, change: ratio - 1, impact: Math.max(0, -diff * margin) });
        else if (ratio >= INSIGHT_RULES.risingShare && diff >= INSIGHT_RULES.clientMinDiff) rising.push({ clientId, now: r.now, before: r.before, change: ratio - 1, impact: Math.max(0, diff * margin) });
    }
    return { rising: rising.sort((a, b) => (b.now - b.before) - (a.now - a.before)).slice(0, 5), falling: falling.sort((a, b) => b.impact - a.impact).slice(0, 5) };
}

/** Profit by day of the week (Monday first) in the period. */
export function profitByWeekday(sales: readonly SaleRow[], range: PeriodRange): number[] {
    const out = [0, 0, 0, 0, 0, 0, 0];
    for (const s of sales) if (inRange(s.timestamp, range)) out[(new Date(s.timestamp).getDay() + 6) % 7] += num(s.derivedProfit);
    return out;
}

/** Where the month ends at this pace (a month in progress only). */
export function monthForecast(profit: number, range: PeriodRange, now: number): number | null {
    const start = new Date(range.from);
    const monthEnd = new Date(start.getFullYear(), start.getMonth() + 1, 1).getTime();
    if (now < range.from || now >= monthEnd) return null;
    const elapsed = Math.max(1, (now - range.from) / DAY);
    const total = (monthEnd - range.from) / DAY;
    return elapsed >= 3 ? (profit / elapsed) * total : null;
}

export type Insight =
    | { kind: 'credit_margin'; impact: number; creditMargin: number; nowMargin: number }
    | { kind: 'client_falling'; impact: number; clientId: string; now: number; before: number; change: number }
    | { kind: 'debts'; impact: number; debts: number; share: number }
    | { kind: 'stock_days'; impact: number; days: number };

/** The three things worth a look, the biggest effect in dinars first. Nothing to say gives an empty list. */
export function buildInsights(input: { credit: CreditVsNow; trends: { falling: ClientTrend[] }; use: CapitalUse; periodDays: number }): Insight[] {
    const list: Insight[] = [];
    if (input.credit && input.credit.gap >= INSIGHT_RULES.minGapPerUnit && input.credit.impact > 0)
        list.push({ kind: 'credit_margin', impact: input.credit.impact, creditMargin: input.credit.creditMargin, nowMargin: input.credit.nowMargin });
    const worst = input.trends.falling[0];
    if (worst && worst.impact > 0) list.push({ kind: 'client_falling', impact: worst.impact, clientId: worst.clientId, now: worst.now, before: worst.before, change: worst.change });
    // The money in debts earns nothing: what it would have made at the capital's pace over the period.
    const perDinar = input.use.profitPerMillion !== null ? input.use.profitPerMillion / 1_000_000 * (input.periodDays / 30) : 0;
    if (input.use.debtShare !== null && input.use.debtShare >= INSIGHT_RULES.debtShareFloor && perDinar > 0)
        list.push({ kind: 'debts', impact: input.use.debts * perDinar, debts: input.use.debts, share: input.use.debtShare });
    if (input.use.stockDays !== null && input.use.stockDays > INSIGHT_RULES.stockDaysFloor && perDinar > 0)
        list.push({ kind: 'stock_days', impact: 0, days: input.use.stockDays });
    return list.sort((a, b) => b.impact - a.impact).slice(0, 3);
}
