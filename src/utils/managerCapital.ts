import type { Investor, InvestorTransaction, TreasuryTx } from '../types';
import { addM, subM } from './money';

const EPSILON = 0.005;
const INITIAL_CAPITAL_WINDOW_MS = 10 * 60 * 1000;

export type ManagerOwnerCapitalBreakdown = {
    initialCapital: number;
    personalProfitTotal: number;
    personalExpensesTotal: number;
    personalExpensesChargedToProfit: number;
    personalExpensesChargedToCapital: number;
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

export function isSyntheticInitialCapitalDeposit(tx: InvestorTransaction, investor: Investor, initialAlreadyHandled = false): boolean {
    if (tx.type !== 'deposit_capital')
        return false;
    if (tx.origin === 'initial_capital')
        return true;
    if (initialAlreadyHandled)
        return false;
    const initialCapital = Number(investor.initialCapital || 0);
    if (initialCapital <= EPSILON)
        return false;
    const amountMatches = Math.abs(Number(tx.amount || 0) - initialCapital) <= EPSILON;
    if (!amountMatches)
        return false;
    const note = String(tx.notes || '').toLowerCase();
    const entryTs = toMs(investor.entryDate, Number.NaN);
    const txTs = toMs(tx.timestamp, Number.NaN);
    const nearEntry = Number.isFinite(entryTs) && Number.isFinite(txTs) && Math.abs(txTs - entryTs) <= INITIAL_CAPITAL_WINDOW_MS;
    return nearEntry && (note.includes('capital initial') || note.includes('initial capital'));
}

export function isPersonalExpenseCapitalWithdrawal(tx: InvestorTransaction, personalExpenses: TreasuryTx[] = []): boolean {
    if (tx.type !== 'withdraw_capital')
        return false;
    if (tx.origin === 'personal_expense')
        return true;
    if (!tx.linkedTreasuryTxId)
        return false;
    return personalExpenses.some((expense) => expense.id === tx.linkedTreasuryTxId && expense.origin === 'personal_expense');
}

export function calculateCapitalMovements(investor: Investor, investorTransactions: InvestorTransaction[], personalExpenses: TreasuryTx[] = []) {
    let capitalAdditions = 0;
    let capitalWithdrawals = 0;
    let initialDepositHandled = false;
    const orderedTransactions = [...investorTransactions].sort((a, b) => toMs(a.timestamp) - toMs(b.timestamp));
    for (const tx of orderedTransactions) {
        if (isSyntheticInitialCapitalDeposit(tx, investor, initialDepositHandled)) {
            initialDepositHandled = true;
            continue;
        }
        if (tx.type === 'deposit_capital') {
            capitalAdditions = addM(capitalAdditions, Number(tx.amount || 0));
        }
        if (tx.type === 'withdraw_capital' && !isPersonalExpenseCapitalWithdrawal(tx, personalExpenses)) {
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
    const personalExpensesChargedToProfit = Math.max(0, Math.min(personalExpensesTotal, Math.max(0, personalProfitTotal)));
    const personalExpensesChargedToCapital = Math.max(0, subM(personalExpensesTotal, personalExpensesChargedToProfit));
    const retainedProfit = subM(personalProfitTotal, personalExpensesChargedToProfit);
    const { capitalAdditions, capitalWithdrawals } = calculateCapitalMovements(input.investor, input.investorTransactions, input.personalExpenses || []);
    const ownerCapital = subM(subM(addM(addM(initialCapital, retainedProfit), capitalAdditions), capitalWithdrawals), personalExpensesChargedToCapital);
    return {
        initialCapital,
        personalProfitTotal,
        personalExpensesTotal,
        personalExpensesChargedToProfit,
        personalExpensesChargedToCapital,
        retainedProfit,
        capitalAdditions,
        capitalWithdrawals,
        ownerCapital,
    };
}
