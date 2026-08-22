import type { Investor, InvestorTransaction, TreasuryTx } from '../types';
import { addM, subM } from './money';

const EPSILON = 0.005;
const INITIAL_CAPITAL_WINDOW_MS = 10 * 60 * 1000;

export type ManagerOwnerCapitalBreakdown = {
    initialCapital: number;
    personalProfitTotal: number;
    personalExpensesTotal: number;
    retainedProfit: number;
    capitalAdditions: number;
    capitalWithdrawals: number;
    ownerCapital: number;
};

function toMs(value: unknown, fallback = 0): number {
    if (typeof value === 'number')
        return value;
    if (value && typeof (value as { toMillis?: () => number }).toMillis === 'function') {
        return (value as { toMillis: () => number }).toMillis();
    }
    const parsed = new Date(value as string).getTime();
    return Number.isFinite(parsed) ? parsed : fallback;
}

function isInPeriod(ts: number, startTs?: number | null, endTs?: number | null): boolean {
    if (startTs != null && ts < startTs)
        return false;
    if (endTs != null && ts > endTs)
        return false;
    return true;
}

export function netPersonalExpenseAmount(tx: TreasuryTx): number {
    if (tx.origin === 'personal_expense_return')
        return 0;
    if (tx.advanceState === 'settled')
        return Number(tx.settledAmount || 0);
    return Number(tx.amount || 0);
}

export function calculateTotalPersonalExpenses(personalExpenses: TreasuryTx[] = [], periodStartTs?: number | null, periodEndTs?: number | null): number {
    return personalExpenses
        .filter((tx) => tx.origin === 'personal_expense' && tx.advanceState !== 'pending')
        .filter((tx) => isInPeriod(toMs(tx.timestamp), periodStartTs, periodEndTs))
        .reduce((sum, tx) => addM(sum, netPersonalExpenseAmount(tx)), 0);
}

function isInitialCapitalDeposit(tx: InvestorTransaction, investor: Investor, initialAlreadyHandled: boolean): boolean {
    if (initialAlreadyHandled || tx.type !== 'deposit_capital')
        return false;
    const initialCapital = Number(investor.initialCapital || 0);
    if (initialCapital <= EPSILON)
        return false;
    const amountMatches = Math.abs(Number(tx.amount || 0) - initialCapital) <= EPSILON;
    if (!amountMatches)
        return false;
    const note = String(tx.notes || '').toLowerCase();
    if (note.includes('capital initial'))
        return true;
    const entryTs = toMs(investor.entryDate, Number.NaN);
    const txTs = toMs(tx.timestamp, Number.NaN);
    return Number.isFinite(entryTs) && Number.isFinite(txTs) && Math.abs(txTs - entryTs) <= INITIAL_CAPITAL_WINDOW_MS;
}

export function calculateCapitalMovements(investor: Investor, investorTransactions: InvestorTransaction[]) {
    let capitalAdditions = 0;
    let capitalWithdrawals = 0;
    let initialDepositHandled = false;
    const orderedTransactions = [...investorTransactions].sort((a, b) => toMs(a.timestamp) - toMs(b.timestamp));
    for (const tx of orderedTransactions) {
        if (isInitialCapitalDeposit(tx, investor, initialDepositHandled)) {
            initialDepositHandled = true;
            continue;
        }
        if (tx.type === 'deposit_capital') {
            capitalAdditions = addM(capitalAdditions, Number(tx.amount || 0));
        }
        if (tx.type === 'withdraw_capital') {
            capitalWithdrawals = addM(capitalWithdrawals, Number(tx.amount || 0));
        }
    }
    return { capitalAdditions, capitalWithdrawals };
}

export function calculateManagerOwnerCapital(input: {
    investor: Investor;
    investorTransactions: InvestorTransaction[];
    personalExpenses?: TreasuryTx[];
    periodStartTs?: number | null;
    periodEndTs?: number | null;
}): ManagerOwnerCapitalBreakdown {
    const initialCapital = Number(input.investor.initialCapital || 0);
    const personalProfitTotal = Number(input.investor.totalProfit || 0);
    const personalExpensesTotal = calculateTotalPersonalExpenses(input.personalExpenses || [], input.periodStartTs, input.periodEndTs);
    const retainedProfit = subM(personalProfitTotal, personalExpensesTotal);
    const { capitalAdditions, capitalWithdrawals } = calculateCapitalMovements(input.investor, input.investorTransactions);
    const ownerCapital = subM(addM(addM(initialCapital, retainedProfit), capitalAdditions), capitalWithdrawals);
    return {
        initialCapital,
        personalProfitTotal,
        personalExpensesTotal,
        retainedProfit,
        capitalAdditions,
        capitalWithdrawals,
        ownerCapital,
    };
}
