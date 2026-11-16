import assert from 'node:assert/strict';
import { absentClients, lastWeekSummary, stockForGoal } from './goalAlerts';

const NOW = new Date('2026-07-17T12:00:00').getTime();
const DAY = 86_400_000;
const sale = (client: string, daysAgo: number, qty: number) => ({ timestamp: NOW - daysAgo * DAY, quantity: qty, derivedProfit: qty * 10, currency: 'USDT', linkedClientId: client });

// 1. absent good clients, each by their own habit (V16)
const every = (client: string, gap: number, lastDaysAgo: number, n: number, qty: number) => Array.from({ length: n }, (_, i) => sale(client, lastDaysAgo + i * gap, qty));
// buys every 3 days, silent for 8 days (≥ 7 = 2 × 3, floor 7): flagged; silent for 5 days: not yet
const fast = [...every('fast', 3, 8, 20, 300)];
assert.deepEqual(absentClients(fast, NOW).map((c) => [c.clientId, c.usualGapDays, c.daysSince]), [['fast', 3, 8]]);
assert.equal(absentClients(every('fast2', 3, 5, 20, 300), NOW).length, 0, 'five days for a client who comes every three: not unusual yet');
// buys once a month: flagged after 60 days only
assert.equal(absentClients(every('monthly', 30, 40, 5, 2000), NOW).length, 0, 'a monthly buyer 40 days on: still his habit');
assert.equal(absentClients(every('monthly', 30, 61, 4, 2000), NOW)[0]?.clientId, 'monthly');
// a small but good client (ranked VIP/good by the engine) is reminded too; a small unranked one is not
const small = every('loyal', 4, 12, 15, 100);
assert.equal(absentClients(small, NOW).length, 0, 'small and not ranked good: no reminder');
assert.equal(absentClients(small, NOW, new Set(['loyal']))[0]?.clientId, 'loyal', 'small but good: reminded');
// a one-time big buyer (P1): default monthly habit, reminded after 60 days
assert.equal(absentClients([sale('once', 30, 7000)], NOW).length, 0);
assert.equal(absentClients([sale('once', 65, 7000)], NOW)[0]?.clientId, 'once');
// at most three, the biggest first
const many = ['a', 'b', 'c', 'd'].flatMap((c, i) => every(c, 3, 10, 10, 1000 * (i + 1)));
assert.deepEqual(absentClients(many, NOW).map((c) => c.clientId), ['d', 'c', 'b']);

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
assert.equal(absentClients([{ timestamp: NOW - 65 * DAY, quantity: 5000, currency: 'USDT', tx: { linkedClientId: 'led' } }], NOW)[0]?.clientId, 'led');
console.log('goal alerts tests passed');
