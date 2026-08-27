import type { Investor, InvestorTransaction, TreasuryTx, Tx } from '../types';
import { roundM } from './money';

const DAY_MS = 24 * 60 * 60 * 1000;

function toTimestamp(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (value && typeof (value as { toMillis?: () => number }).toMillis === 'function') {
        const ms = (value as { toMillis: () => number }).toMillis();
        return Number.isFinite(ms) ? ms : 0;
    }
    const parsed = new Date(String(value || '')).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
}

function startOfYear(timestamp: number): number {
    const date = new Date(timestamp);
    return new Date(date.getFullYear(), 0, 1).getTime();
}

/** The amount that was actually consumed by a settled personal expense. */
export function getNetPersonalExpenseAmount(tx: Pick<TreasuryTx, 'origin' | 'advanceState' | 'settledAmount' | 'amount'>): number {
    if (tx.origin !== 'personal_expense') return 0;
    if (tx.advanceState === 'pending') return 0;
    const amount = tx.advanceState === 'settled'
        ? Number(tx.settledAmount ?? tx.amount ?? 0)
        : Number(tx.amount ?? 0);
    return Number.isFinite(amount) ? Math.max(0, roundM(amount)) : 0;
}

export type PeriodAmountSummary = {
    today: number;
    week: number;
    month: number;
    year: number;
    sinceStart: number;
};

export type PersonalExpenseTotals = {
    historical: number;
    current: number;
    total: number;
};

export function summarizePersonalExpenseTotals(expenses: TreasuryTx[]): PersonalExpenseTotals {
    let historical = 0;
    let current = 0;
    for (const expense of expenses) {
        const amount = getNetPersonalExpenseAmount(expense);
        if (amount <= 0) continue;
        if (expense.trackingPhase === 'historical') historical += amount;
        else current += amount;
    }
    historical = roundM(historical);
    current = roundM(current);
    return {
        historical,
        current,
        total: roundM(historical + current),
    };
}

function startOfWeek(timestamp: number): number {
    const date = new Date(timestamp);
    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    date.setDate(date.getDate() + diff);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
}

export function summarizePersonalExpenses(expenses: TreasuryTx[], nowTimestamp = Date.now(), projectStartTimestamp = 0): PeriodAmountSummary {
    const todayStart = new Date(nowTimestamp);
    todayStart.setHours(0, 0, 0, 0);
    const today = todayStart.getTime();
    const week = startOfWeek(nowTimestamp);
    const monthDate = new Date(nowTimestamp);
    monthDate.setDate(1);
    monthDate.setHours(0, 0, 0, 0);
    const month = monthDate.getTime();
    const year = startOfYear(nowTimestamp);
    const sinceStart = projectStartTimestamp > 0 ? projectStartTimestamp : 0;
    const result: PeriodAmountSummary = { today: 0, week: 0, month: 0, year: 0, sinceStart: 0 };

    for (const expense of expenses) {
        const amount = getNetPersonalExpenseAmount(expense);
        const timestamp = toTimestamp(expense.timestamp);
        if (amount <= 0 || timestamp > nowTimestamp) continue;
        if (timestamp >= today) result.today += amount;
        if (timestamp >= week) result.week += amount;
        if (timestamp >= month) result.month += amount;
        if (timestamp >= year) result.year += amount;
        if (sinceStart === 0 || timestamp >= sinceStart) result.sinceStart += amount;
    }

    return {
        today: roundM(result.today),
        week: roundM(result.week),
        month: roundM(result.month),
        year: roundM(result.year),
        sinceStart: roundM(result.sinceStart),
    };
}

export function summarizeDeliveryExpenses(expenses: TreasuryTx[], nowTimestamp = Date.now(), projectStartTimestamp = 0): PeriodAmountSummary {
    const normalized = expenses
        .filter((tx) => tx.origin === 'delivery_expense')
        .map((tx) => ({ ...tx, amount: Math.max(0, Number(tx.amountDzd ?? tx.amount ?? 0)) }));
    return summarizeSimpleAmounts(normalized, nowTimestamp, projectStartTimestamp);
}

function summarizeSimpleAmounts(rows: Array<Pick<TreasuryTx, 'timestamp' | 'amount'>>, nowTimestamp: number, projectStartTimestamp: number): PeriodAmountSummary {
    const todayDate = new Date(nowTimestamp);
    todayDate.setHours(0, 0, 0, 0);
    const today = todayDate.getTime();
    const week = startOfWeek(nowTimestamp);
    const monthDate = new Date(nowTimestamp);
    monthDate.setDate(1);
    monthDate.setHours(0, 0, 0, 0);
    const month = monthDate.getTime();
    const year = startOfYear(nowTimestamp);
    const result: PeriodAmountSummary = { today: 0, week: 0, month: 0, year: 0, sinceStart: 0 };
    for (const row of rows) {
        const timestamp = toTimestamp(row.timestamp);
        const amount = Number(row.amount || 0);
        if (timestamp <= 0 || timestamp > nowTimestamp || !Number.isFinite(amount) || amount <= 0) continue;
        if (timestamp >= today) result.today += amount;
        if (timestamp >= week) result.week += amount;
        if (timestamp >= month) result.month += amount;
        if (timestamp >= year) result.year += amount;
        if (projectStartTimestamp <= 0 || timestamp >= projectStartTimestamp) result.sinceStart += amount;
    }
    return {
        today: roundM(result.today),
        week: roundM(result.week),
        month: roundM(result.month),
        year: roundM(result.year),
        sinceStart: roundM(result.sinceStart),
    };
}

export function findProjectStartTimestamp(input: {
    investors: Investor[];
    investorTransactions: InvestorTransaction[];
    treasuryTransactions: TreasuryTx[];
    transactions: Tx[];
}): number {
    const candidates = [
        ...input.investors.map((item) => toTimestamp(item.entryDate)),
        ...input.investorTransactions.map((item) => toTimestamp(item.timestamp)),
        ...input.treasuryTransactions.map((item) => toTimestamp(item.timestamp)),
        ...input.transactions.map((item) => toTimestamp(item.timestamp)),
    ].filter((timestamp) => timestamp > 0 && timestamp <= Date.now());
    return candidates.length > 0 ? Math.min(...candidates) : 0;
}

export type OwnerCapitalReconciliation = {
    openingCapital: number;
    expectedCapital: number;
    actualCapital: number;
    difference: number;
};

/**
 * Reconciles owner capital without treating reinvestment as a new profit or as a loss.
 * Reinvested profit stays in the project, so it is already included in owner capital.
 */
export function reconcileOwnerCapital(input: {
    openingCapital: number;
    ownerProfit: number;
    personalExpenses: number;
    capitalAdditions?: number;
    capitalWithdrawals?: number;
    personalExpensesChargedToCapital?: number;
    actualCapital: number;
}): OwnerCapitalReconciliation {
    const openingCapital = Number.isFinite(Number(input.openingCapital)) ? Math.max(0, Number(input.openingCapital)) : 0;
    const ownerProfit = roundM(Number(input.ownerProfit || 0));
    const personalExpenses = roundM(Number(input.personalExpenses || 0));
    const expensesChargedToProfit = Math.max(0, Math.min(personalExpenses, Math.max(0, ownerProfit)));
    const expensesChargedToCapital = input.personalExpensesChargedToCapital == null
        ? Math.max(0, roundM(personalExpenses - expensesChargedToProfit))
        : Math.max(0, roundM(Number(input.personalExpensesChargedToCapital || 0)));
    const retainedProfit = roundM(ownerProfit - expensesChargedToProfit);
    const expectedCapital = roundM(
        openingCapital
            + retainedProfit
            + Number(input.capitalAdditions || 0)
            - Number(input.capitalWithdrawals || 0)
            - expensesChargedToCapital
    );
    const actualCapital = roundM(Number(input.actualCapital || 0));
    return {
        openingCapital: roundM(openingCapital),
        expectedCapital,
        actualCapital,
        difference: roundM(actualCapital - expectedCapital),
    };
}

export function formatAuditDate(timestamp: number): string {
    if (!timestamp) return '—';
    return new Date(timestamp).toLocaleDateString('fr-FR');
}

export const FINANCIAL_AUDIT_DAY_MS = DAY_MS;
