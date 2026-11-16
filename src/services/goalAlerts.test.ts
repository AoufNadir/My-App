import assert from 'node:assert/strict';
import { absentClients, lastWeekSummary, stockForGoal } from './goalAlerts';

const NOW = new Date('2026-07-17T12:00:00').getTime();
const DAY = 86_400_000;
const sale = (client: string, daysAgo: number, qty: number) => ({ timestamp: NOW - daysAgo * DAY, quantity: qty, derivedProfit: qty * 10, currency: 'USDT', linkedClientId: client });

// 1. absent: a big regular who stopped 25 days ago; not a small one, not an active one
const rows = [sale('big', 25, 3000), sale('big', 60, 3000), sale('active', 2, 3000), sale('active', 40, 3000), sale('small', 30, 200)];
assert.deepEqual(absentClients(rows, NOW).map((c) => [c.clientId, c.monthlyQty, c.daysSince]), [['big', 2000, 25]]);
// a one-time buyer of 5 000 (P1: monthly volume) who has gone quiet is listed too
assert.equal(absentClients([sale('once', 30, 5000)], NOW)[0]?.clientId, 'once');

// 2. stock: 94 000 left at 15 DZD a USDT needs 6 300 USDT
assert.deepEqual(stockForGoal({ remainingProfit: 94_000, marginPerUnit: 15, stock: 2500 }), { needed: 6300, stock: 2500 });
assert.equal(stockForGoal({ remainingProfit: 94_000, marginPerUnit: 15, stock: 7000 }), null, 'enough stock: no alert');
assert.equal(stockForGoal({ remainingProfit: 0, marginPerUnit: 15, stock: 0 }), null, 'goal reached: no alert');

// 3. last week (July 17 = week 3, so week 2 = days 8 to 14)
const week2 = [8, 10, 14].map((d) => ({ timestamp: new Date(2026, 6, d, 12).getTime(), derivedProfit: 15_000 }));
const out = [{ timestamp: new Date(2026, 6, 15, 12).getTime(), derivedProfit: 99_999 }];
assert.deepEqual(lastWeekSummary({ rows: [...week2, ...out], target: 300_000, now: NOW }), { week: 2, earned: 45_000, expected: 75_000 });
assert.equal(lastWeekSummary({ rows: week2, target: 300_000, now: new Date('2026-07-03').getTime() }), null, 'no finished week yet');
// the ledger's own rows carry the client under `tx`
assert.equal(absentClients([{ timestamp: NOW - 30 * DAY, quantity: 5000, currency: 'USDT', tx: { linkedClientId: 'led' } }], NOW)[0]?.clientId, 'led');
console.log('goal alerts tests passed');
