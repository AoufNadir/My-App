// P2 (owner, 2026-11-16): the flexible monthly goal. The app proposes a goal that is hard but possible, from what
// the owner usually earns, and reviews it once a week. It only reads profits; nothing here writes or changes a
// figure, and the owner always decides (a proposal is accepted or the goal is kept).

const DAY = 86_400_000;

export type ProfitRow = { timestamp: number; derivedProfit?: number | null };
export type MonthProfit = { key: string; year: number; month: number; profit: number };
export type GoalLevels = { minimum: number; target: number; stretch: number };
export type GoalSuggestion = GoalLevels & { median: number; months: number; seasonFactor: number };

/** Rules the owner agreed on. */
export const GOAL_RULES = {
    months: 6, // the goal is built on the last six months with sales
    minMonths: 2, // fewer than two months: no proposal
    growth: 0.05, // +5 % on the usual month
    minimumShare: 0.85, // the floor: 85 % of the usual month
    stretchShare: 1.15, // the stretch: +15 % above the goal
    seasonClamp: [0.9, 1.1] as const, // a strong or weak month of the year moves the goal by 10 % at most
    weeklyRaiseCap: 0.15, // a raise is +15 % at most
    aheadMargin: 0.05, // a raise only when heading 5 % above the goal
    roundTo: 1000,
} as const;

const round = (value: number) => Math.round(value / GOAL_RULES.roundTo) * GOAL_RULES.roundTo;
const monthKey = (year: number, month: number) => `${year}-${String(month + 1).padStart(2, '0')}`;

export function median(values: readonly number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** The profit of each finished month (the current month is left out), oldest first. */
export function monthlyProfitSeries(rows: readonly ProfitRow[], now: number): MonthProfit[] {
    const today = new Date(now);
    const current = monthKey(today.getFullYear(), today.getMonth());
    const byMonth = new Map<string, MonthProfit>();
    for (const row of rows) {
        const ts = Number(row.timestamp);
        if (!Number.isFinite(ts) || ts > now) continue;
        const d = new Date(ts);
        const key = monthKey(d.getFullYear(), d.getMonth());
        if (key === current) continue;
        const entry = byMonth.get(key) || { key, year: d.getFullYear(), month: d.getMonth(), profit: 0 };
        entry.profit += Number(row.derivedProfit) || 0;
        byMonth.set(key, entry);
    }
    return [...byMonth.values()].sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * The usual strength of this month of the year: the same month last year against the median of that year's
 * months. Without a full year behind, no effect (1).
 */
export function seasonFactor(series: readonly MonthProfit[], now: number): number {
    const today = new Date(now);
    const lastYear = series.filter((m) => m.year === today.getFullYear() - 1);
    const same = lastYear.find((m) => m.month === today.getMonth());
    if (!same || lastYear.length < 10) return 1;
    const base = median(lastYear.map((m) => m.profit));
    if (base <= 0) return 1;
    const [low, high] = GOAL_RULES.seasonClamp;
    return Math.min(high, Math.max(low, same.profit / base));
}

/**
 * The proposed goal of the month: the MEDIAN of the last six months (one exceptional month does not lift it),
 * +5 %, times the season; with its floor and its stretch.
 */
export function suggestGoal(series: readonly MonthProfit[], now: number): GoalSuggestion | null {
    const recent = series.slice(-GOAL_RULES.months).filter((m) => m.profit > 0);
    if (recent.length < GOAL_RULES.minMonths) return null;
    const usual = median(recent.map((m) => m.profit));
    const season = seasonFactor(series, now);
    const target = round(usual * (1 + GOAL_RULES.growth) * season);
    return {
        minimum: round(Math.min(target, usual * GOAL_RULES.minimumShare * season)),
        target,
        stretch: round(target * GOAL_RULES.stretchShare),
        median: usual,
        months: recent.length,
        seasonFactor: season,
    };
}

export type GoalStatus = 'ahead' | 'on_track' | 'behind' | 'out_of_reach';
export type GoalReview = {
    week: 1 | 2 | 3 | 4;
    daysLeft: number;
    profitSoFar: number;
    /** where the month ends at this pace (one exceptional deal counted only at the size of a usual one) */
    projection: number;
    /** where the owner should be today to reach the goal at an even pace */
    expectedSoFar: number;
    gap: number;
    status: GoalStatus;
    /** a raised goal to propose (once a week, +15 % at most, never in the last week), or null */
    proposedTarget: number | null;
    /** propose falling back to the minimum: the goal is no longer possible */
    proposeMinimum: boolean;
    /** profit needed per remaining day */
    neededPerDay: number;
};

export function weekOfMonth(day: number): 1 | 2 | 3 | 4 {
    return Math.min(4, Math.ceil(day / 7)) as 1 | 2 | 3 | 4;
}

/**
 * The weekly review. `monthDeals` are this month's sales profits; `raisedInWeek` is the week a raise was last
 * accepted or refused (no second proposal in the same week).
 */
export function reviewGoal(input: {
    goal: GoalLevels;
    monthDeals: readonly ProfitRow[];
    now: number;
    raisedInWeek?: number | null;
}): GoalReview {
    const today = new Date(input.now);
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const day = today.getDate();
    const week = weekOfMonth(day);
    const daysLeft = Math.max(0, daysInMonth - day);
    const profits = input.monthDeals.map((row) => Number(row.derivedProfit) || 0);
    const profitSoFar = profits.reduce((sum, p) => sum + p, 0);
    // One huge deal does not mean every week will be like it: above three usual deals, it counts as usual.
    const usualDeal = median(profits.filter((p) => p > 0));
    const largest = Math.max(0, ...profits);
    const excess = usualDeal > 0 && largest > usualDeal * 3 ? largest - usualDeal : 0;
    const steady = Math.max(0, profitSoFar - excess);
    const elapsed = Math.max(1, day);
    const projection = round(profitSoFar + (steady / elapsed) * daysLeft);
    const target = input.goal.target;
    const expectedSoFar = round(target * elapsed / daysInMonth);
    const neededPerDay = daysLeft > 0 ? Math.max(0, Math.round((target - profitSoFar) / daysLeft)) : 0;
    const status: GoalStatus = projection >= target * (1 + GOAL_RULES.aheadMargin)
        ? 'ahead'
        : projection >= target ? 'on_track'
            : projection >= input.goal.minimum ? 'behind' : 'out_of_reach';
    // A raise needs a steady trend: the exceptional part of a huge deal is left out entirely here.
    const trend = round(steady + (steady / elapsed) * daysLeft);
    const canRaise = week < 4 && input.raisedInWeek !== week && status === 'ahead' && trend >= target * (1 + GOAL_RULES.aheadMargin);
    const proposedTarget = canRaise
        ? round(Math.min(trend, target * (1 + GOAL_RULES.weeklyRaiseCap)))
        : null;
    return {
        week,
        daysLeft,
        profitSoFar: Math.round(profitSoFar),
        projection,
        expectedSoFar,
        gap: Math.round(profitSoFar - expectedSoFar),
        status,
        proposedTarget: proposedTarget !== null && proposedTarget > target ? proposedTarget : null,
        proposeMinimum: status === 'out_of_reach' && week >= 2,
        neededPerDay,
    };
}

/** This month's sales rows. */
export function rowsOfMonth<T extends ProfitRow>(rows: readonly T[], now: number): T[] {
    const today = new Date(now);
    const start = new Date(today.getFullYear(), today.getMonth(), 1).getTime();
    return rows.filter((row) => row.timestamp >= start && row.timestamp <= now + DAY);
}
