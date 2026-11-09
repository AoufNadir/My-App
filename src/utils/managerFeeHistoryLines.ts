import { LEGACY_MANAGER_FEE_PERCENTAGE } from '../hooks/useInvestorEconomics';

/**
 * V13-6 (audit): the manager's rate, period by period, as the calculation applies it. Each change counts from its
 * date onward, the past keeps its rate; before the first recorded change the old default (30%) applies.
 * Newest first. Display only: nothing is computed differently.
 */
export type FeeHistoryLine = { from: number | null; percentage: number };
export function managerFeeHistoryLines(history: ReadonlyArray<{ percentage: unknown; effectiveFrom: unknown }> | undefined): FeeHistoryLine[] {
    const entries = (history || [])
        .map((entry) => ({ percentage: Number(entry.percentage), from: Number(entry.effectiveFrom) }))
        .filter((entry) => Number.isFinite(entry.percentage) && Number.isFinite(entry.from))
        .sort((a, b) => a.from - b.from);
    if (entries.length === 0) return [];
    const lines: FeeHistoryLine[] = [{ from: null, percentage: LEGACY_MANAGER_FEE_PERCENTAGE }];
    for (const entry of entries)
        if (entry.percentage !== lines[lines.length - 1].percentage) lines.push(entry);
        else if (lines.length === 1 && lines[0].from === null) lines[0] = { from: null, percentage: entry.percentage };
    return lines.reverse();
}
