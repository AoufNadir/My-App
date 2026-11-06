// V12-13: habits that keep the books in step with reality. Nothing here writes money by itself: it reminds, opens the
// window that records, and counts.

// ---- Recurring subscriptions: one reminder on their day, never recorded without a tap ----
export type SubscriptionWallet = 'Caisse' | 'BaridiMob' | 'USDT' | 'EUR';
export type Subscription = { id: string; name: string; amount: number; wallet: SubscriptionWallet; day: number; active: boolean; handledMonth?: string };

export const monthKey = (ts: number) => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

export function parseSubscription(id: string, raw: unknown): Subscription | null {
    if (!raw || typeof raw !== 'object')
        return null;
    const data = raw as Record<string, unknown>;
    const name = typeof data.name === 'string' ? data.name.trim().slice(0, 40) : '';
    const amount = Number(data.amount);
    const day = Math.round(Number(data.day));
    const wallet = (['Caisse', 'BaridiMob', 'USDT', 'EUR'] as const).find((w) => w === data.wallet);
    if (!name || !(amount > 0) || !wallet || !(day >= 1 && day <= 28))
        return null;
    return { id, name, amount: Math.round(amount * 100) / 100, wallet, day, active: data.active !== false, ...(typeof data.handledMonth === 'string' ? { handledMonth: data.handledMonth } : {}) };
}

/** Due this month: its day has come and it was neither recorded nor skipped this month. */
export function dueSubscriptions(subscriptions: ReadonlyArray<Subscription>, now: number): Subscription[] {
    const today = new Date(now).getDate();
    const month = monthKey(now);
    return subscriptions.filter((sub) => sub.active && sub.day <= today && sub.handledMonth !== month);
}

// ---- Evening count of the cash box ----
export const EVENING_HOUR = 19;
/** After 19:00, once a day, when the cash box was not counted today. */
export function eveningCountDue(lastCountAt: number | null, now: number, hour = EVENING_HOUR): boolean {
    const d = new Date(now);
    if (d.getHours() < hour)
        return false;
    const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    return !(lastCountAt && lastCountAt >= startOfDay);
}

// ---- Small expenses of the month, against a budget ----
export const SMALL_EXPENSE_MAX = 5_000;
/** Personal expenses of the month up to 5 000 DZD each (the small daily spending), in dinars. */
export function smallExpensesThisMonth(expenses: ReadonlyArray<{ timestamp?: number; amount?: number }>, now: number, max = SMALL_EXPENSE_MAX): number {
    const month = monthKey(now);
    let total = 0;
    for (const expense of expenses) {
        const amount = Math.abs(Number(expense.amount) || 0);
        if (amount > 0 && amount <= max && monthKey(Number(expense.timestamp) || 0) === month)
            total += Math.round(amount * 100);
    }
    return total / 100;
}

// ---- Operations recorded late ----
export const LATE_RECORDING_MS = 48 * 3_600_000;
/** Recorded more than 48 hours after the day it happened (only rows that keep when they were typed). */
export function isRecordedLate(row: { timestamp?: number; recordedAt?: number }): boolean {
    const happened = Number(row.timestamp) || 0;
    const typed = Number(row.recordedAt) || 0;
    return happened > 0 && typed > 0 && typed - happened > LATE_RECORDING_MS;
}
export function lateRecordingsThisMonth(rows: ReadonlyArray<{ timestamp?: number; recordedAt?: number }>, now: number): number {
    const month = monthKey(now);
    return rows.filter((row) => isRecordedLate(row) && monthKey(Number(row.recordedAt)) === month).length;
}
