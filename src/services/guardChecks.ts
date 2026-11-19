// V17-1 (owner, 2026-11-19): the guard. It reads what is recorded and points at what may be a mistake: a repeated
// expense, an amount far above the usual, a price far from the recent ones, a sale below cost, the same operation twice,
// a wallet below zero, a change of the management rate, an advance left open. Read only: nothing is written, nothing
// is corrected, nothing is blocked; the owner opens the line or says it is right.

const DAY = 86_400_000;

export const GUARD_RULES = {
    windowDays: 60, // only what happened in the last 60 days is checked
    duplicateDays: 15, // two expenses of about the same amount within 15 days
    duplicateShare: 0.05, // "about the same": within 5 %
    duplicateMin: 1000, // small amounts repeat naturally
    unusualFactor: 10, // ten times the usual amount of that kind of expense
    unusualMin: 5000,
    unusualHistoryDays: 180,
    unusualMinSamples: 5,
    priceShare: 0.1, // a price 10 % away from the median of the recent ones
    priceSamples: 10,
    priceMinSamples: 5,
    twinMinutes: 10, // the same operation twice within 10 minutes
    feeChangeDays: 30,
    advanceDays: 7,
} as const;

export type GuardExpense = { id: string; origin?: string; amount: number; timestamp: number; advanceState?: string | null; notes?: string };
export type GuardOperation = { id: string; type: string; currency?: string; quantity: number; price?: number; sell?: number; timestamp: number; linkedClientId?: string };
export type GuardSale = { txId: string; currency: string; quantity: number; timestamp: number; derivedProfit: number; sellPrice: number; historicalAvgBuy: number };

export type GuardFinding =
    | { kind: 'duplicate_expense'; id: string; origin: string; amount: number; otherAmount: number; timestamp: number; otherTimestamp: number; txId: string }
    | { kind: 'unusual_expense'; id: string; origin: string; amount: number; usual: number; timestamp: number; txId: string }
    | { kind: 'price_far'; id: string; side: 'buy' | 'sell'; currency: string; price: number; usual: number; timestamp: number; txId: string }
    | { kind: 'sale_below_cost'; id: string; currency: string; price: number; average: number; loss: number; timestamp: number; txId: string }
    | { kind: 'twin_operation'; id: string; side: 'buy' | 'sell'; currency: string; quantity: number; price: number; timestamp: number; txId: string }
    | { kind: 'negative_wallet'; id: string; wallet: string; balance: number }
    | { kind: 'fee_change'; id: string; from: number | null; to: number; timestamp: number }
    | { kind: 'open_advance'; id: string; amount: number; days: number; timestamp: number; txId: string };

const median = (values: number[]) => {
    if (!values.length) return 0;
    const s = [...values].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const isExpense = (origin: unknown) => origin === 'personal_expense' || origin === 'delivery_expense';

export function guardFindings(input: {
    now: number;
    expenses: readonly GuardExpense[];
    operations: readonly GuardOperation[];
    sales: readonly GuardSale[];
    wallets: Record<string, number>;
    feeHistory: ReadonlyArray<{ percentage: number; effectiveFrom: number }>;
}): GuardFinding[] {
    const { now } = input;
    const since = now - GUARD_RULES.windowDays * DAY;
    const out: GuardFinding[] = [];
    const expenses = input.expenses.filter((e) => isExpense(e.origin) && num(e.amount) > 0).sort((a, b) => a.timestamp - b.timestamp);

    // 1. The same expense twice: same kind, about the same amount, within 15 days.
    for (let i = 0; i < expenses.length; i += 1) {
        const b = expenses[i];
        if (b.timestamp < since || b.amount < GUARD_RULES.duplicateMin) continue;
        for (let j = i - 1; j >= 0; j -= 1) {
            const a = expenses[j];
            if (b.timestamp - a.timestamp > GUARD_RULES.duplicateDays * DAY) break;
            if (a.origin !== b.origin || a.amount < GUARD_RULES.duplicateMin) continue;
            if (Math.abs(a.amount - b.amount) <= Math.max(a.amount, b.amount) * GUARD_RULES.duplicateShare) {
                out.push({ kind: 'duplicate_expense', id: `dup-${a.id}-${b.id}`, origin: String(b.origin), amount: b.amount, otherAmount: a.amount, timestamp: b.timestamp, otherTimestamp: a.timestamp, txId: b.id });
                break;
            }
        }
    }

    // 2. An expense ten times the usual of its kind (the usual: median of the 180 days before it, at least 5 of them).
    const flaggedTwice = new Set(out.map((f) => ('txId' in f ? f.txId : '')));
    for (const e of expenses) {
        // Already shown as a repeat: one line is enough.
        if (e.timestamp < since || e.amount < GUARD_RULES.unusualMin || flaggedTwice.has(e.id)) continue;
        const before = expenses.filter((x) => x.origin === e.origin && x.id !== e.id && x.timestamp < e.timestamp && x.timestamp >= e.timestamp - GUARD_RULES.unusualHistoryDays * DAY).map((x) => x.amount);
        if (before.length < GUARD_RULES.unusualMinSamples) continue;
        const usual = median(before);
        if (usual > 0 && e.amount >= usual * GUARD_RULES.unusualFactor)
            out.push({ kind: 'unusual_expense', id: `big-${e.id}`, origin: String(e.origin), amount: e.amount, usual, timestamp: e.timestamp, txId: e.id });
    }

    // 3. A price far from the recent ones of the same side and currency (a zero too many, a wrong digit).
    const ops = input.operations.filter((o) => (o.type === 'buy' || o.type === 'sell') && num(o.quantity) > 0).sort((a, b) => a.timestamp - b.timestamp);
    const priceOf = (o: GuardOperation) => num(o.type === 'sell' ? o.sell : o.price);
    for (let i = 0; i < ops.length; i += 1) {
        const o = ops[i];
        const price = priceOf(o);
        if (o.timestamp < since || price <= 0) continue;
        const previous: number[] = [];
        for (let j = i - 1; j >= 0 && previous.length < GUARD_RULES.priceSamples; j -= 1) {
            const p = ops[j];
            if (p.type === o.type && (p.currency || 'USDT') === (o.currency || 'USDT') && priceOf(p) > 0) previous.push(priceOf(p));
        }
        if (previous.length < GUARD_RULES.priceMinSamples) continue;
        const usual = median(previous);
        if (usual > 0 && Math.abs(price - usual) > usual * GUARD_RULES.priceShare)
            out.push({ kind: 'price_far', id: `price-${o.id}`, side: o.type as 'buy' | 'sell', currency: o.currency || 'USDT', price, usual, timestamp: o.timestamp, txId: o.id });
    }

    // 4. A sale below the average purchase price (a loss).
    for (const s of input.sales) {
        if (s.timestamp < since || !(s.derivedProfit < -0.5)) continue;
        out.push({ kind: 'sale_below_cost', id: `loss-${s.txId}`, currency: s.currency, price: s.sellPrice, average: s.historicalAvgBuy, loss: -s.derivedProfit, timestamp: s.timestamp, txId: s.txId });
    }

    // 5. The same operation twice: same side, currency, quantity, price and client within 10 minutes.
    for (let i = 1; i < ops.length; i += 1) {
        const b = ops[i];
        if (b.timestamp < since) continue;
        for (let j = i - 1; j >= 0 && b.timestamp - ops[j].timestamp <= GUARD_RULES.twinMinutes * 60_000; j -= 1) {
            const a = ops[j];
            if (a.type === b.type && (a.currency || 'USDT') === (b.currency || 'USDT') && num(a.quantity) === num(b.quantity) && priceOf(a) === priceOf(b) && (a.linkedClientId || '') === (b.linkedClientId || '')) {
                out.push({ kind: 'twin_operation', id: `twin-${a.id}-${b.id}`, side: b.type as 'buy' | 'sell', currency: b.currency || 'USDT', quantity: num(b.quantity), price: priceOf(b), timestamp: b.timestamp, txId: b.id });
                break;
            }
        }
    }

    // 6. A wallet below zero now.
    for (const [wallet, balance] of Object.entries(input.wallets))
        if (balance < -0.5) out.push({ kind: 'negative_wallet', id: `neg-${wallet}`, wallet, balance });

    // 7. A change of the management rate in the last 30 days.
    const fees = [...input.feeHistory].filter((f) => num(f.effectiveFrom) > 0).sort((a, b) => a.effectiveFrom - b.effectiveFrom);
    fees.forEach((f, i) => {
        if (f.effectiveFrom < now - GUARD_RULES.feeChangeDays * DAY || f.effectiveFrom > now) return;
        const before = i > 0 ? num(fees[i - 1].percentage) : null;
        if (before !== null && before === num(f.percentage)) return;
        out.push({ kind: 'fee_change', id: `fee-${f.effectiveFrom}-${f.percentage}`, from: before, to: num(f.percentage), timestamp: f.effectiveFrom });
    });

    // 8. A personal advance still open after 7 days.
    for (const e of input.expenses) {
        if (e.origin !== 'personal_expense' || e.advanceState !== 'pending') continue;
        const days = Math.floor((now - e.timestamp) / DAY);
        if (days >= GUARD_RULES.advanceDays) out.push({ kind: 'open_advance', id: `adv-${e.id}`, amount: num(e.amount), days, timestamp: e.timestamp, txId: e.id });
    }

    return out.sort((a, b) => ('timestamp' in b ? b.timestamp : now) - ('timestamp' in a ? a.timestamp : now));
}

/** What the owner said is right, kept on this phone: those lines never come back. */
export const GUARD_OK_STORAGE_KEY = 'app_guard_ok';

export function readGuardOk(): Set<string> {
    try {
        const raw = JSON.parse(window.localStorage.getItem(GUARD_OK_STORAGE_KEY) || '[]');
        return new Set(Array.isArray(raw) ? raw.filter((v): v is string => typeof v === 'string') : []);
    } catch {
        return new Set();
    }
}

export function storeGuardOk(ids: Set<string>) {
    try {
        window.localStorage.setItem(GUARD_OK_STORAGE_KEY, JSON.stringify([...ids].slice(-500)));
    } catch {
        // Storage unavailable: the choice lasts for this visit only.
    }
}
