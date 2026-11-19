import assert from 'node:assert/strict';
import { buildInsights, capitalUse, clientTrends, creditVsNow, monthForecast, paymentKind, profitByWeekday, type SaleRow } from './analyticsInsights';

// V18: the new Analyse figures, on fake data.
const DAY = 86_400_000;
const nov = (d: number, h = 12) => new Date(2026, 10, d, h).getTime();
const oct = (d: number, h = 12) => new Date(2026, 9, d, h).getTime();
const sale = (id: string, ts: number, qty: number, profit: number, extra: Record<string, unknown> = {}, cost = qty * 250): SaleRow => ({ txId: id, currency: 'USDT', quantity: qty, timestamp: ts, derivedProfit: profit, soldCostDzd: cost, tx: { ...extra } as never });
const novRange = { from: nov(1, 0), to: nov(19, 23) };
const octRange = { from: oct(1, 0), to: oct(19, 23) };

assert.equal(paymentKind({ clientPaymentStatus: 'credit' } as never), 'credit');
assert.equal(paymentKind({ paymentMethod: 'Crédit' } as never), 'credit');
assert.equal(paymentKind({ clientPaymentStatus: 'cash' } as never), 'now');
assert.equal(paymentKind({ clientPaymentStatus: 'acc_bna' } as never), 'now');
assert.equal(paymentKind({} as never), 'unknown');

// Credit at 7.2 DZD/USDT, paid now at 8.0: −0.8 × 1 000 credit USDT = 800 DZD.
const sales: SaleRow[] = [
    sale('c1', nov(3), 1000, 7200, { clientPaymentStatus: 'credit', linkedClientId: 'a' }),
    sale('n1', nov(4), 500, 4000, { clientPaymentStatus: 'cash', linkedClientId: 'b' }),
    sale('n2', nov(5), 500, 4000, { clientPaymentStatus: 'baridi', linkedClientId: 'b' }),
    sale('u1', nov(6), 300, 2500, {}),
    sale('o1', oct(3), 2500, 20000, { clientPaymentStatus: 'cash', linkedClientId: 'a' }),
    sale('o2', oct(4), 400, 3200, { clientPaymentStatus: 'cash', linkedClientId: 'b' }),
];
const cvn = creditVsNow(sales, novRange)!;
assert.deepEqual([cvn.creditQty, cvn.nowQty, Number(cvn.creditMargin.toFixed(2)), Number(cvn.nowMargin.toFixed(2)), Number(cvn.impact.toFixed(2))], [1000, 1000, 7.2, 8, 800]);
assert.equal(creditVsNow([sales[0], sales[1]].map((s) => ({ ...s, quantity: 100 })), novRange), null, 'too small to compare');

// Client a: 2 500 USDT in October, 1 000 now: falling, impact 1 500 × 8 = 12 000. Client b: 400 → 1 000 (under 500 before: not counted unless new).
const trends = clientTrends(sales, novRange, octRange);
assert.deepEqual(trends.falling.map((t) => [t.clientId, t.now, t.before, Math.round(t.impact)]), [['a', 1000, 2500, 12000]]);
assert.deepEqual(trends.rising, []);
assert.deepEqual(clientTrends(sales, novRange, null), { rising: [], falling: [] });

// 19 days, 17 700 profit, capital 3 000 000: (17 700 / 19) × 30 / 3 ≈ 9 316 per million; debts 750 000 = 25 %.
const now = nov(19, 23);
const use = capitalUse({ profit: 17700, range: novRange, now, sales, capital: 3_000_000, debts: 750_000, stockValue: 1_000_000 });
assert.equal(Math.round(use.profitPerMillion!), Math.round((17700 / ((now - novRange.from) / DAY)) * 30 / 3));
assert.equal(use.debtShare, 0.25);
assert.ok(use.stockDays !== null && use.stockDays > 0);
assert.equal(capitalUse({ profit: 1, range: novRange, now, sales: [], capital: 0, debts: 0, stockValue: 0 }).profitPerMillion, null);

// Ranked by dinars: the falling client (12 000) before the credit margin (800); the debts line when ≥ 15 %.
const insights = buildInsights({ credit: cvn, trends, use, periodDays: 19 });
assert.deepEqual(insights.map((i) => i.kind), ['client_falling', 'debts', 'credit_margin'].filter((k) => insights.some((i) => i.kind === k)).sort((a, b) => insights.findIndex((i) => i.kind === a) - insights.findIndex((i) => i.kind === b)));
assert.equal(insights[0].kind, 'client_falling');
assert.ok(insights.length <= 3);
for (let i = 1; i < insights.length; i++) assert.ok(insights[i - 1].impact >= insights[i].impact, 'biggest first');
assert.deepEqual(buildInsights({ credit: null, trends: { falling: [] }, use: { profitPerMillion: null, stockDays: null, debtShare: null, debts: 0, capital: 0 }, periodDays: 19 }), [], 'nothing to say');

// Weekdays (Monday first) and the forecast of a month in progress.
const week = profitByWeekday(sales, novRange);
assert.equal(week.reduce((a, b) => a + b, 0), 7200 + 4000 + 4000 + 2500);
assert.equal(week[(new Date(nov(3)).getDay() + 6) % 7] >= 7200, true);
const fc = monthForecast(17700, novRange, nov(10, 12));
assert.ok(fc !== null && Math.abs(fc - 17700 / ((nov(10, 12) - novRange.from) / DAY) * 30) < 1);
assert.equal(monthForecast(100, { from: oct(1, 0), to: oct(31, 23) }, nov(10)), null, 'a finished month has no forecast');
assert.equal(monthForecast(100, novRange, nov(2, 0)), null, 'too early to say');
console.log('analytics insights tests passed');
