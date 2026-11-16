import assert from 'node:assert/strict';
import { median, monthlyProfitSeries, reviewGoal, seasonFactor, suggestGoal, weekOfMonth, type MonthProfit } from './flexibleGoal';

const NOW = new Date('2026-07-10T12:00:00').getTime();
const months = (profits: number[], startYear = 2026, startMonth = 0): MonthProfit[] => profits.map((profit, i) => {
    const d = new Date(startYear, startMonth + i, 1);
    return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, year: d.getFullYear(), month: d.getMonth(), profit };
});

// 1. The median, not the average: one exceptional month does not lift the goal (the owner's example).
const series = months([7e6, 8e6, 8e6, 9e6, 25e6, 8e6]);
const goal = suggestGoal(series, NOW)!;
assert.equal(median([7, 8, 8, 9, 25, 8]), 8);
assert.equal(goal.median, 8e6, 'usual month = 8 millions, not 10.8');
assert.equal(goal.target, 8_400_000, '+5 %');
assert.equal(goal.minimum, 6_800_000, 'floor 85 %');
assert.equal(goal.stretch, 9_660_000, 'stretch +15 %');
assert.ok(goal.minimum <= goal.target && goal.target <= goal.stretch);
assert.equal(suggestGoal(months([5e6]), NOW), null, 'one month is not enough');

// 2. Finished months only, current month left out.
const rows = [
    { timestamp: new Date('2026-05-03').getTime(), derivedProfit: 1000 },
    { timestamp: new Date('2026-05-20').getTime(), derivedProfit: 500 },
    { timestamp: new Date('2026-06-02').getTime(), derivedProfit: 700 },
    { timestamp: new Date('2026-07-02').getTime(), derivedProfit: 999 },
];
assert.deepEqual(monthlyProfitSeries(rows, NOW).map((m) => [m.key, m.profit]), [['2026-05', 1500], ['2026-06', 700]]);

// 3. Season: a strong July last year moves the goal by 10 % at most; no full year, no effect.
const lastYear = months([5e6, 5e6, 5e6, 5e6, 5e6, 5e6, 9e6, 5e6, 5e6, 5e6, 5e6, 5e6], 2025, 0);
assert.equal(seasonFactor(lastYear, NOW), 1.1);
assert.equal(seasonFactor(series, NOW), 1);

// 4. Weekly review.
const levels = { minimum: 6_800_000, target: 8_400_000, stretch: 9_660_000 };
const day = (d: number, profit: number) => ({ timestamp: new Date(2026, 6, d, 12).getTime(), derivedProfit: profit });
const pace = (perDay: number, upTo: number) => Array.from({ length: upTo }, (_, i) => day(i + 1, perDay));
// ahead: 400 000 a day in July (31 days) heads to 12.4 M → raise capped at +15 %
const ahead = reviewGoal({ goal: levels, monthDeals: pace(400_000, 10), now: NOW });
assert.equal(ahead.week, 2);
assert.equal(ahead.status, 'ahead');
assert.equal(ahead.proposedTarget, 9_660_000, 'a raise is +15 % at most');
assert.equal(reviewGoal({ goal: levels, monthDeals: pace(400_000, 10), now: NOW, raisedInWeek: 2 }).proposedTarget, null, 'once a week');
// last week: never changed
const late = new Date('2026-07-25T12:00:00').getTime();
assert.equal(reviewGoal({ goal: levels, monthDeals: pace(400_000, 25), now: late }).proposedTarget, null, 'no change in the last week');
// behind: never lowered automatically, but tells what is needed per day
const behind = reviewGoal({ goal: levels, monthDeals: pace(240_000, 10), now: NOW });
assert.equal(behind.status, 'behind');
assert.equal(behind.proposedTarget, null);
assert.equal(behind.neededPerDay, Math.round((8_400_000 - 2_400_000) / 21));
// out of reach from week 2: propose the minimum (the owner decides)
const weak = reviewGoal({ goal: levels, monthDeals: pace(100_000, 10), now: NOW });
assert.equal(weak.status, 'out_of_reach');
assert.equal(weak.proposeMinimum, true);
assert.equal(reviewGoal({ goal: levels, monthDeals: pace(100_000, 10), now: NOW, raisedInWeek: 2 }).proposeMinimum, false, '« keep my goal » closes it for the week');
// one huge deal does not trigger a raise
const oneBig = reviewGoal({ goal: levels, monthDeals: [...pace(250_000, 10), day(9, 4_000_000)], now: NOW });
assert.equal(oneBig.proposedTarget, null, 'a single exceptional deal is not a trend: no raise');
assert.equal(weekOfMonth(29), 4);
console.log('flexible goal tests passed');
