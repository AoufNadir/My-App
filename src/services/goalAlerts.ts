// P5 (owner, 2026-11-16): three short alerts in the bell that help reach the goal. Read only.
//  1. A client who usually buys a lot and has not bought for a while (one who comes back moves the goal).
//  2. The stock: how many USDT the rest of the goal needs against what is in stock.
//  3. The week that just ended: what it made against its share of the goal, and the advice for the next one.
import { weekOfMonth, type ProfitRow } from './flexibleGoal';

const DAY = 86_400_000;
export type AlertSale = ProfitRow & { quantity?: number | null; currency?: string | null; linkedClientId?: string | null; tx?: { linkedClientId?: string | null } };
export type AbsentClient = { clientId: string; monthlyQty: number; daysSince: number };

export const ALERT_RULES = { absentDays: 21, minMonthlyQty: 1000, maxAbsent: 3 } as const;

const usdt = (row: AlertSale) => (row.currency || 'USDT') === 'USDT';

/** Regular clients (≥ 1 000 USDT a month over 90 days) with no purchase for 21 days or more; the biggest first. */
export function absentClients(rows: readonly AlertSale[], now: number): AbsentClient[] {
    const since = now - 90 * DAY;
    const byClient = new Map<string, { qty: number; last: number }>();
    for (const row of rows) {
        const id = row.linkedClientId ?? row.tx?.linkedClientId; // ledger rows keep the sale under `tx`
        if (!id || id === 'none' || !usdt(row) || row.timestamp < since || row.timestamp > now) continue;
        const entry = byClient.get(id) || { qty: 0, last: 0 };
        entry.qty += Math.max(0, Number(row.quantity) || 0);
        entry.last = Math.max(entry.last, row.timestamp);
        byClient.set(id, entry);
    }
    return [...byClient.entries()]
        .map(([clientId, e]) => ({ clientId, monthlyQty: Math.round(e.qty / 3), daysSince: Math.floor((now - e.last) / DAY) }))
        .filter((c) => c.monthlyQty >= ALERT_RULES.minMonthlyQty && c.daysSince >= ALERT_RULES.absentDays)
        .sort((a, b) => b.monthlyQty - a.monthlyQty)
        .slice(0, ALERT_RULES.maxAbsent);
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
