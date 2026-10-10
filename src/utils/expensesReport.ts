import type { TreasuryTx } from '../types';

// The personal-expenses report's numbers (V3-6). They are the numbers of the old printed report
// (buildPersonalExpensesPdfReport in pdfReports.ts) and the period and previous period the old
// export computed in useReportExports; the sheet writes them in the report's language.

export type ExpensesPeriodKey = 'day' | 'week' | 'month' | 'year';

export type ExpensesPeriod = {
    start: number;
    end: number;
    previousStart: number;
    previousEnd: number;
};

/** The period that holds `now` and the one before it, as the old export computed them (weeks start on Monday). */
export function expensesPeriods(periodKey: ExpensesPeriodKey, now: number): ExpensesPeriod {
    const d = new Date(now);
    let start: number;
    let end: number;
    if (periodKey === 'day') {
        const sd = new Date(d);
        sd.setHours(0, 0, 0, 0);
        start = sd.getTime();
        const ed = new Date(sd);
        ed.setHours(23, 59, 59, 999);
        end = ed.getTime();
    }
    else if (periodKey === 'week') {
        const sd = new Date(d);
        const dow = sd.getDay();
        const diff = dow === 0 ? -6 : 1 - dow;
        sd.setDate(sd.getDate() + diff);
        sd.setHours(0, 0, 0, 0);
        start = sd.getTime();
        const ed = new Date(sd);
        ed.setDate(ed.getDate() + 6);
        ed.setHours(23, 59, 59, 999);
        end = ed.getTime();
    }
    else if (periodKey === 'month') {
        start = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
        end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
    }
    else {
        start = new Date(d.getFullYear(), 0, 1).getTime();
        end = new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999).getTime();
    }
    const previousStart = (() => {
        const ps = new Date(start);
        if (periodKey === 'day') {
            ps.setDate(ps.getDate() - 1);
            ps.setHours(0, 0, 0, 0);
            return ps.getTime();
        }
        if (periodKey === 'week') {
            ps.setDate(ps.getDate() - 7);
            return ps.getTime();
        }
        if (periodKey === 'month')
            return new Date(ps.getFullYear(), ps.getMonth() - 1, 1).getTime();
        return new Date(ps.getFullYear() - 1, 0, 1).getTime();
    })();
    const previousEnd = (() => {
        if (periodKey === 'day') {
            const e = new Date(previousStart);
            e.setHours(23, 59, 59, 999);
            return e.getTime();
        }
        if (periodKey === 'week') {
            const e = new Date(previousStart);
            e.setDate(e.getDate() + 6);
            e.setHours(23, 59, 59, 999);
            return e.getTime();
        }
        if (periodKey === 'month') {
            const e = new Date(previousStart);
            return new Date(e.getFullYear(), e.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
        }
        return new Date(new Date(previousStart).getFullYear(), 11, 31, 23, 59, 59, 999).getTime();
    })();
    return { start, end, previousStart, previousEnd };
}

/** What one expense cost: a settled advance counts what was really spent, a return nothing. */
const netExpense = (tx: TreasuryTx): number => {
    if (tx.origin === 'personal_expense_return')
        return 0;
    if (tx.advanceState === 'settled')
        return Number(tx.settledAmount || 0);
    return Number(tx.amount || 0);
};

export type ExpensesReportRow = {
    id: string;
    date: string;
    time: string;
    /** Caisse, BaridiMob; empty when the expense was paid from another wallet */
    source: string;
    /** What the user wrote, empty when nothing */
    notes: string;
    amount: number;
    /** An advance that was reconciled afterwards */
    settled: boolean;
};

export type ExpensesReportInput = {
    /** The personal expenses of the whole history */
    expenses: ReadonlyArray<TreasuryTx>;
    periodKey: ExpensesPeriodKey;
    /** The time the report is made: the period is the one that holds it */
    now: number;
    /** What the manager can still withdraw as profit */
    managerProfitAvailable: number;
};

export type ExpensesReport = {
    periodKey: ExpensesPeriodKey;
    periodStart: number;
    periodEnd: number;
    reference: string;
    total: number;
    operationCount: number;
    dailyAverage: number;
    /** Share of the manager's profit these expenses consumed, in percent */
    profitPercent: number;
    managerProfitAvailable: number;
    previousPeriodTotal: number;
    /** Change against the previous period, in percent; null when the previous period spent nothing */
    versusPrevious: number | null;
    biggest: { date: string; notes: string; amount: number } | null;
    rows: ExpensesReportRow[];
};

const pad2 = (value: number) => String(value).padStart(2, '0');
const dayStamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}`;
};
const dayDashed = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
};

/** E-month-20261001: the kind of period, then its first day. */
export const expensesReportReference = (periodKey: ExpensesPeriodKey, periodStart: number) => `E-${periodKey}-${dayStamp(periodStart)}`;

/** ProDigital_Depenses_2026-10-01_2026-10-31.pdf */
export const expensesReportFileName = (periodStart: number, periodEnd: number) => `ProDigital_Depenses_${dayDashed(periodStart)}_${dayDashed(periodEnd)}.pdf`;

export function buildExpensesReport(input: ExpensesReportInput): ExpensesReport {
    const { expenses, periodKey, now, managerProfitAvailable } = input;
    const { start: periodStart, end: periodEnd, previousStart, previousEnd } = expensesPeriods(periodKey, now);
    const previousPeriodTotal = expenses
        .filter((tx) => tx.timestamp >= previousStart && tx.timestamp <= previousEnd && tx.advanceState !== 'pending' && tx.origin !== 'personal_expense_return')
        .reduce((sum, tx) => sum + netExpense(tx), 0);

    const periodExpenses = expenses
        .filter((tx) => tx.timestamp >= periodStart && tx.timestamp <= periodEnd)
        .filter((tx) => tx.advanceState !== 'pending')
        .filter((tx) => tx.origin !== 'personal_expense_return')
        .sort((a, b) => b.timestamp - a.timestamp);
    const total = periodExpenses.reduce((sum, tx) => sum + netExpense(tx), 0);
    const daysInPeriod = (() => {
        if (periodKey === 'day')
            return 1;
        if (periodKey === 'week')
            return 7;
        if (periodKey === 'month') {
            const d = new Date(periodStart);
            return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        }
        const y = new Date(periodStart).getFullYear();
        return ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0) ? 366 : 365;
    })();
    const profitDenominator = managerProfitAvailable + total;
    const biggest = periodExpenses.reduce<TreasuryTx | null>((max, tx) => {
        if (!max || netExpense(tx) > netExpense(max))
            return tx;
        return max;
    }, null);
    return {
        periodKey,
        periodStart,
        periodEnd,
        reference: expensesReportReference(periodKey, periodStart),
        total,
        operationCount: periodExpenses.length,
        dailyAverage: daysInPeriod > 0 ? total / daysInPeriod : 0,
        profitPercent: profitDenominator > 0 ? (total / profitDenominator) * 100 : 0,
        managerProfitAvailable,
        previousPeriodTotal,
        versusPrevious: previousPeriodTotal > 0 ? ((total - previousPeriodTotal) / previousPeriodTotal) * 100 : null,
        biggest: biggest ? { date: biggest.date || '', notes: biggest.notes || '', amount: netExpense(biggest) } : null,
        rows: periodExpenses.map((tx) => ({
            id: tx.id,
            date: tx.date || '',
            time: tx.time || '',
            source: tx.source || '',
            notes: tx.notes || '',
            amount: netExpense(tx),
            settled: tx.advanceState === 'settled',
        })),
    };
}
