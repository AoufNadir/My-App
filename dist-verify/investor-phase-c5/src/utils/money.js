/**
 * Integer-cent money helpers — avoids JavaScript float drift on aggregations.
 * All values are passed in/out as Number (whole units), but arithmetic happens
 * on integer cents internally. Use these in place of raw + - * / when summing
 * or distributing monetary amounts.
 */
export const toCents = (n) => Math.round((n || 0) * 100);
export const fromCents = (c) => c / 100;
export const addM = (a, b) => fromCents(toCents(a) + toCents(b));
export const subM = (a, b) => fromCents(toCents(a) - toCents(b));
/** Multiply a money amount by a quantity/ratio (qty stays a regular number). */
export const mulM = (a, qty) => fromCents(Math.round(toCents(a) * (qty || 0)));
/** Divide a money amount by a divisor; returns 0 if divisor is 0 to avoid Infinity. */
export const divM = (a, qty) => {
    if (!qty)
        return 0;
    return fromCents(Math.round(toCents(a) / qty));
};
/** Sum an array of money values without float drift. */
export const sumM = (values) => fromCents(values.reduce((acc, v) => acc + toCents(v), 0));
/** Round a money amount to 2 decimals through the cent bus. */
export const roundM = (n) => fromCents(toCents(n));
/**
 * Distribute a total proportionally across weights, with cent-level remainder
 * spread to the largest residuals first (largest-remainder method). Returned
 * shares always sum exactly to `total` (no rounding leakage).
 */
export const distributeProportionally = (total, weights) => {
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
