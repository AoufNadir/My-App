import assert from 'node:assert/strict';
import { dueSubscriptions, eveningCountDue, isRecordedLate, lateRecordingsThisMonth, parseSubscription, smallExpensesThisMonth } from './habits';

const at = (d: number, h = 10, month = 10) => new Date(2026, month, d, h).getTime();
// Subscriptions
const sub = parseSubscription('s1', { name: ' ChatGPT ', amount: 20, wallet: 'USDT', day: 5 })!;
assert.deepEqual(sub, { id: 's1', name: 'ChatGPT', amount: 20, wallet: 'USDT', day: 5, active: true });
assert.equal(parseSubscription('x', { name: 'X', amount: 0, wallet: 'USDT', day: 5 }), null, 'no amount');
assert.equal(parseSubscription('x', { name: 'X', amount: 5, wallet: 'BTC', day: 5 }), null, 'unknown wallet');
assert.equal(parseSubscription('x', { name: 'X', amount: 5, wallet: 'USDT', day: 31 }), null, 'days 1 to 28 only');
assert.deepEqual(dueSubscriptions([sub], at(4)), [], 'before its day');
assert.equal(dueSubscriptions([sub], at(5)).length, 1, 'on its day');
assert.equal(dueSubscriptions([sub], at(20)).length, 1, 'still due later in the month');
assert.deepEqual(dueSubscriptions([{ ...sub, handledMonth: '2026-11' }], at(20)), [], 'handled this month');
assert.equal(dueSubscriptions([{ ...sub, handledMonth: '2026-10' }], at(6)).length, 1, 'handled last month: due again');
assert.deepEqual(dueSubscriptions([{ ...sub, active: false }], at(6)), [], 'paused');
// Evening count
assert.equal(eveningCountDue(null, at(6, 18)), false, 'before 19:00');
assert.equal(eveningCountDue(null, at(6, 19)), true);
assert.equal(eveningCountDue(at(6, 12), at(6, 20)), false, 'counted today');
assert.equal(eveningCountDue(at(5, 22), at(6, 20)), true, 'counted yesterday only');
// Small expenses
assert.equal(smallExpensesThisMonth([{ timestamp: at(2), amount: 1_500 }, { timestamp: at(3), amount: 5_000 }, { timestamp: at(3), amount: 5_001 }, { timestamp: at(3, 10, 9), amount: 100 }], at(6)), 6_500, 'up to 5 000 each, this month');
// Recorded late
assert.equal(isRecordedLate({ timestamp: at(1), recordedAt: at(3, 11) }), true);
assert.equal(isRecordedLate({ timestamp: at(1), recordedAt: at(2, 9) }), false, 'within 48 hours');
assert.equal(isRecordedLate({ timestamp: at(1) }), false, 'rows without the typing time are not judged');
assert.equal(lateRecordingsThisMonth([{ timestamp: at(1), recordedAt: at(5) }, { timestamp: at(4), recordedAt: at(4, 12) }], at(6)), 1);
console.log('habits tests passed');
