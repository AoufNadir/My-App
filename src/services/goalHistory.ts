import type { ProfitRow } from './flexibleGoal';

export type GoalHistoryRow = { key: string; goal: number; achieved: number; reached: boolean; inProgress: boolean };

/** P6: one line per month that had a goal (the last six, newest first): the goal and what the month made. */
export function goalHistoryRows(goals: Record<string, number>, rows: readonly ProfitRow[], now: number, limit = 6): GoalHistoryRow[] {
    const today = new Date(now);
    const current = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const made = new Map<string, number>();
    for (const row of rows) {
        const d = new Date(Number(row.timestamp));
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        made.set(key, (made.get(key) || 0) + (Number(row.derivedProfit) || 0));
    }
    return Object.entries(goals)
        .filter(([key]) => key <= current)
        .sort(([a], [b]) => b.localeCompare(a))
        .slice(0, limit)
        .map(([key, goal]) => {
            const achieved = Math.round(made.get(key) || 0);
            return { key, goal, achieved, reached: achieved >= goal, inProgress: key === current };
        });
}
