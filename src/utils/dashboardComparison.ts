import { analyticsWindow, percentChange, type PeriodRange } from './analyticsPeriod';

// The Home page's profit against the period before (V11-2): each period (today, this week, this month,
// this year) is compared with the same elapsed part of the previous one, never with a whole one: at 9 a.m.
// a whole yesterday, or on the 4th a whole previous month, would always make today look worse.
// The sums are the ones the Home page already shows (the profit of the sales of the ledger).

export type ProfitPeriod = 'today' | 'week' | 'month' | 'year';
export type SoldProfitRow = { timestamp: number; derivedProfit?: number };

const endOfDay = (year: number, month: number, day: number) => new Date(year, month, day, 23, 59, 59, 999).getTime();

/** The part of the previous period that is comparable with the period so far. */
export function previousRanges(now: number): Record<ProfitPeriod, PeriodRange> {
    const d = new Date(now);
    const y = d.getFullYear();
    const m = d.getMonth();
    const day = d.getDate();
    // Yesterday, up to the same time of day.
    const yesterday: PeriodRange = {
        from: new Date(y, m, day - 1, 0, 0, 0, 0).getTime(),
        to: new Date(y, m, day - 1, d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds()).getTime(),
    };
    // Last week, Monday to the same weekday (the week starts on Monday, as the Home page counts it).
    const sinceMonday = d.getDay() === 0 ? 6 : d.getDay() - 1;
    const lastWeek: PeriodRange = {
        from: new Date(y, m, day - sinceMonday - 7, 0, 0, 0, 0).getTime(),
        to: endOfDay(y, m, day - 7),
    };
    const month = analyticsWindow('month', y, m, now).previous!;
    const year = analyticsWindow('year', y, 0, now).previous!;
    return { today: yesterday, week: lastWeek, month, year };
}

/** The profit of the sales in each previous range. */
export function previousProfits(rows: ReadonlyArray<SoldProfitRow>, now: number): Record<ProfitPeriod, number> {
    const ranges = previousRanges(now);
    const result: Record<ProfitPeriod, number> = { today: 0, week: 0, month: 0, year: 0 };
    for (const row of rows) {
        for (const period of ['today', 'week', 'month', 'year'] as const) {
            const range = ranges[period];
            if (row.timestamp >= range.from && row.timestamp <= range.to)
                result[period] += Number(row.derivedProfit || 0);
        }
    }
    return result;
}

export { percentChange };
