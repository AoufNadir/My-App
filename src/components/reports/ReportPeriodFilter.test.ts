import assert from 'node:assert/strict';
import { rowsInPeriod } from './ReportPeriodFilter';

// A list report keeps the rows of the dates asked for; a row without a date is always kept.
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();
const rows = [{ id: 'a', timestamp: at(2026, 10, 31, 23) }, { id: 'b', timestamp: at(2026, 11, 1, 0) }, { id: 'c', timestamp: at(2026, 11, 4) }, { id: 'd' }];
const ids = (list: ReadonlyArray<{ id: string }> | null) => list?.map((row) => row.id).join('');

assert.equal(ids(rowsInPeriod(rows, '2026-11-01', '2026-11-04')), 'bcd');
assert.equal(ids(rowsInPeriod(rows, '', '')), 'abcd');
assert.equal(ids(rowsInPeriod(rows, '2026-11-02', '')), 'cd');
assert.equal(rowsInPeriod(rows, '2026-11-05', '2026-11-01'), null);
assert.equal(rowsInPeriod(rows, '2026-13-01', ''), null);
console.log('report period filter tests passed');
