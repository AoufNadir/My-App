// P5 (owner, 2026-11-16): three short alerts in the bell that help reach the goal. Read only.
//  1. A client who usually buys a lot and has not bought for a while (one who comes back moves the goal).
//  2. The stock: how many USDT the rest of the goal needs against what is in stock.
//  3. The week that just ended: what it made against its share of the goal, and the advice for the next one.
import { weekOfMonth, type ProfitRow } from './flexibleGoal';

const DAY = 86_400_000;
export type AlertSale = ProfitRow & { quantity?: number | null; currency?: string | null; linkedClientId?: string | null; tx?: { linkedClientId?: string | null } };
export type AbsentClient = { clientId: string; monthlyQty: number; daysSince: number; usualGapDays: number };

// V16 (owner, 2026-11-16): « remind me of my good clients when they disappear ». A good client is one the pricing
// engine ranks VIP or good (monthly volume, regularity, payment), or one who buys a lot each month. Absent means
// unusual for that client: twice their usual gap between purchases, never less than 7 days.
export const ALERT_RULES = { lookbackDays: 180, minMonthlyQty: 1000, minAbsentDays: 7, gapFactor: 2, defaultGapDays: 30, maxAbsent: 3 } as const;

const usdt = (row: AlertSale) => (row.currency || 'USDT') === 'USDT';
const median = (values: number[]) => { const s = [...values].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/** Good clients whose silence is unusual for them; the biggest first, three at most. */
export function absentClients(rows: readonly AlertSale[], now: number, goodClientIds: ReadonlySet<string> = new Set()): AbsentClient[] {
    const since = now - ALERT_RULES.lookbackDays * DAY;
    const since90 = now - 90 * DAY;
    const byClient = new Map<string, { qty: number; qty90: number; days: Set<number> }>();
    for (const row of rows) {
        const id = row.linkedClientId ?? row.tx?.linkedClientId; // ledger rows keep the sale under `tx`
        if (!id || id === 'none' || !usdt(row) || row.timestamp < since || row.timestamp > now) continue;
        const entry = byClient.get(id) || { qty: 0, qty90: 0, days: new Set<number>() };
        const q = Math.max(0, Number(row.quantity) || 0);
        entry.qty += q;
        if (row.timestamp >= since90) entry.qty90 += q;
        entry.days.add(Math.floor(row.timestamp / DAY));
        byClient.set(id, entry);
    }
    const months = ALERT_RULES.lookbackDays / 30;
    const out: AbsentClient[] = [];
    for (const [clientId, e] of byClient) {
        // the larger of the 3-month and 6-month averages (a recent big buyer is not diluted)
        const monthlyQty = Math.round(Math.max(e.qty / months, e.qty90 / 3));
        if (!goodClientIds.has(clientId) && monthlyQty < ALERT_RULES.minMonthlyQty) continue;
        const days = [...e.days].sort((a, b) => a - b);
        const gaps = days.slice(1).map((d, i) => d - days[i]);
        const usualGapDays = gaps.length >= 2 ? Math.max(1, Math.round(median(gaps))) : ALERT_RULES.defaultGapDays;
        const daysSince = Math.floor(now / DAY) - days[days.length - 1];
        if (daysSince >= Math.max(ALERT_RULES.minAbsentDays, usualGapDays * ALERT_RULES.gapFactor))
            out.push({ clientId, monthlyQty, daysSince, usualGapDays });
    }
    return out.sort((a, b) => b.monthlyQty - a.monthlyQty).slice(0, ALERT_RULES.maxAbsent);
}

/** USDT the rest of the goal needs at the usual margin, when the stock does not cover it. */
export function stockForGoal(input: { remainingProfit: number; marginPerUnit: number; stock: number }): { needed: number; stock: number } | null {
    if (!(input.remainingProfit > 0) || !(input.marginPerUnit > 0)) return null;
    const needed = Math.ceil(input.remainingProfit / input.marginPerUnit / 100) * 100;
    return input.stock < needed ? { needed, stock: Math.floor(input.stock) } : null;
}

/** The last finished week of this month (from week 2 on): its profit against a quarter of the goal. */
export function lastWeekSummary(input: { rows: readonly ProfitRow[]; target: number; now: number }): { week: number; earned: number; expected: number } | null {
    const today = new Date(input.now);
    const week = weekOfMonth(today.getDate());
    if (week < 2 || !(input.target > 0)) return null;
    const last = week - 1;
    const start = new Date(today.getFullYear(), today.getMonth(), (last - 1) * 7 + 1).getTime();
    const end = new Date(today.getFullYear(), today.getMonth(), last * 7 + 1).getTime();
    const earned = input.rows.filter((r) => r.timestamp >= start && r.timestamp < end).reduce((s, r) => s + (Number(r.derivedProfit) || 0), 0);
    return { week: last, earned: Math.round(earned), expected: Math.round(input.target / 4) };
}
