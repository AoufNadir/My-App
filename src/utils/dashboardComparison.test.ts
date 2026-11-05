import assert from 'node:assert/strict';
import { previousProfits, previousRanges } from './dashboardComparison';

// The Home page compares each period with the same elapsed part of the previous one (V11-2).
const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min).getTime();
const now = at(2026, 11, 4, 12, 30); // Wednesday 4 November 2026, 12:30

const ranges = previousRanges(now);
// Today: yesterday up to the same time of day.
assert.equal(ranges.today.from, new Date(2026, 10, 3, 0, 0, 0, 0).getTime());
assert.equal(ranges.today.to, at(2026, 11, 3, 12, 30));
// This week (Monday 2nd to Wednesday 4th): last week, Monday 26th to Wednesday 28th, end of day.
assert.equal(ranges.week.from, new Date(2026, 9, 26, 0, 0, 0, 0).getTime());
assert.equal(ranges.week.to, new Date(2026, 9, 28, 23, 59, 59, 999).getTime());
// This month: October 1st to 4th.
assert.equal(ranges.month.from, new Date(2026, 9, 1).getTime());
assert.equal(ranges.month.to, new Date(2026, 9, 4, 23, 59, 59, 999).getTime());
// This year: 2025 until 4 November.
assert.equal(ranges.year.from, new Date(2025, 0, 1).getTime());
assert.equal(ranges.year.to, new Date(2025, 10, 4, 23, 59, 59, 999).getTime());
// A Sunday counts as the last day of its week (Monday 26th to Sunday 1st).
const sunday = previousRanges(at(2026, 11, 1, 10));
assert.equal(sunday.week.from, new Date(2026, 9, 19, 0, 0, 0, 0).getTime());
assert.equal(sunday.week.to, new Date(2026, 9, 25, 23, 59, 59, 999).getTime());
// January: the month before is December; the day before the 1st is the 31st.
const january = previousRanges(at(2027, 1, 1, 8));
assert.equal(january.today.from, new Date(2026, 11, 31, 0, 0, 0, 0).getTime());
assert.equal(january.month.from, new Date(2026, 11, 1).getTime());

const rows = [
    { timestamp: at(2026, 11, 3, 9), derivedProfit: 1000 },   // yesterday, before 12:30: counts for « today »
    { timestamp: at(2026, 11, 3, 18), derivedProfit: 5000 },  // yesterday evening: after the same time, does not count
    { timestamp: at(2026, 10, 27, 10), derivedProfit: 2000 }, // last week, Tuesday
    { timestamp: at(2026, 10, 30, 10), derivedProfit: 4000 }, // last week, Friday: after the same weekday
    { timestamp: at(2026, 10, 2, 10), derivedProfit: 3000 },  // October 2nd
    { timestamp: at(2026, 10, 20, 10), derivedProfit: 7000 }, // October 20th: after the 4th
    { timestamp: at(2025, 6, 1, 10), derivedProfit: 9000 },   // 2025
    { timestamp: at(2025, 12, 1, 10), derivedProfit: 8000 },  // December 2025: after 4 November
    { timestamp: at(2026, 11, 4, 9), derivedProfit: 100 },    // today: in no previous range
];
const sums = previousProfits(rows, now);
assert.equal(sums.today, 1000);
assert.equal(sums.week, 2000);
assert.equal(sums.month, 3000);
assert.equal(sums.year, 9000, 'the 2025 sale before 4 November: December 2025 and the 2026 sales are not in it');
console.log('dashboardComparison tests passed');
