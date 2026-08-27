/**
 * Integer-cent money helpers — avoids JavaScript float drift on aggregations.
 * All values are passed in/out as Number (whole units), but arithmetic happens
 * on integer cents internally. Use these in place of raw + - * / when summing
 * or distributing monetary amounts.
 */
export const toCents = (n: number): number => Math.round((n || 0) * 100);
export const fromCents = (c: number): number => c / 100;
export const addM = (a: number, b: number): number => fromCents(toCents(a) + toCents(b));
export const subM = (a: number, b: number): number => fromCents(toCents(a) - toCents(b));
/** Multiply a money amount by a quantity/ratio (qty stays a regular number). */
export const mulM = (a: number, qty: number): number => fromCents(Math.round(toCents(a) * (qty || 0)));
/** Divide a money amount by a divisor; returns 0 if divisor is 0 to avoid Infinity. */
export const divM = (a: number, qty: number): number => {
    if (!qty)
        return 0;
    return fromCents(Math.round(toCents(a) / qty));
};
/** Sum an array of money values without float drift. */
export const sumM = (values: ReadonlyArray<number>): number => fromCents(values.reduce((acc, v) => acc + toCents(v), 0));
/** Round a money amount to 2 decimals through the cent bus. */
export const roundM = (n: number): number => fromCents(toCents(n));
/**
 * Distribute a total proportionally across weights, with cent-level remainder
 * spread to the largest residuals first (largest-remainder method). Returned
 * shares always sum exactly to `total` (no rounding leakage).
 */
export const distributeProportionally = (total: number, weights: ReadonlyArray<number>): number[] => {
    const totalCents = toCents(total);
    const weightSum = weights.reduce((acc, w) => acc + (w || 0), 0);
    if (weightSum <= 0)
        return weights.map(() => 0);
    const raw = weights.map((w) => (totalCents * (w || 0)) / weightSum);
    const floored = raw.map((r) => Math.floor(r));
    const remainder = totalCents - floored.reduce((a, b) => a + b, 0);
    const order = raw
        .map((r, i) => ({ i, frac: r - Math.floor(r) }))
        .sort((a, b) => b.frac - a.frac);
    for (let k = 0; k < remainder; k++)
        floored[order[k % order.length].i] += 1;
    return floored.map(fromCents);
};

/**
 * Presentation-only DZD rounding. The stored/accounting values stay in cents;
 * this allocates whole-DZD display values so their visible sum equals the
 * visible total instead of leaking a dinar through independent rounding.
 */
export const allocateRoundedDzd = <T extends string>(values: ReadonlyArray<{ id: T; value: number }>): Map<T, number> => {
    const normalized = values.map((item, index) => {
        const cents = toCents(Number.isFinite(item.value) ? item.value : 0);
        const base = cents >= 0 ? Math.floor(cents / 100) : Math.ceil(cents / 100);
        return { ...item, index, cents, base, remainder: cents / 100 - base };
    });
    const totalCents = normalized.reduce((sum, item) => sum + item.cents, 0);
    const totalRounded = totalCents >= 0
        ? Math.floor((totalCents + 50) / 100)
        : Math.ceil((totalCents - 50) / 100);
    const baseTotal = normalized.reduce((sum, item) => sum + item.base, 0);
    const adjustment = totalRounded - baseTotal;
    const ordered = [...normalized].sort((a, b) => {
        const remainderDifference = adjustment >= 0
            ? b.remainder - a.remainder
            : a.remainder - b.remainder;
        return remainderDifference || a.index - b.index;
    });
    const result = new Map<T, number>(normalized.map((item) => [item.id, item.base]));
    for (let index = 0; index < Math.abs(adjustment); index += 1) {
        const item = ordered[index % ordered.length];
        result.set(item.id, (result.get(item.id) || 0) + Math.sign(adjustment));
    }
    return result;
};
