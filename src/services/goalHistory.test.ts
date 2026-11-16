import assert from 'node:assert/strict';
import { goalHistoryRows } from './goalHistory';

const NOW = new Date('2026-11-16T12:00:00').getTime();
const row = (y: number, m: number, d: number, p: number) => ({ timestamp: new Date(y, m - 1, d, 12).getTime(), derivedProfit: p });
const rows = [row(2026, 9, 3, 90_000), row(2026, 9, 20, 40_000), row(2026, 10, 5, 100_000), row(2026, 11, 2, 36_000)];
const goals = { '2026-09': 120_000, '2026-10': 130_000, '2026-11': 130_000, '2026-12': 140_000, 'bad': 5 };
const out = goalHistoryRows(goals, rows, NOW);
assert.deepEqual(out.map((r) => [r.key, r.goal, r.achieved, r.reached, r.inProgress]), [
    ['2026-11', 130_000, 36_000, false, true],
    ['2026-10', 130_000, 100_000, false, false],
    ['2026-09', 120_000, 130_000, true, false],
], 'newest first, future months left out, made = the month\'s sales profit');
assert.equal(goalHistoryRows({}, rows, NOW).length, 0, 'no goal saved: no history');
console.log('goal history tests passed');
