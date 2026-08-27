import type { Investor, InvestorTransaction, TreasuryTx } from '../types';
import { addM, subM } from './money';

const EPSILON = 0.005;
const INITIAL_CAPITAL_WINDOW_MS = 10 * 60 * 1000;

export type CapitalDepositClassification = 'initial' | 'real_top_up';
export type CapitalOpeningSource = 'initial_transaction' | 'declared_initial_capital';

export type CapitalDepositAuditRow = {
    id: string;
    amount: number;
    origin?: InvestorTransaction['origin'];
    timestamp: number;
    notes: string;
    classification: CapitalDepositClassification;
};

export type InvestorCapitalReconciliation = {
    declaredInitialCapital: number;
    openingCapital: number;
    openingSource: CapitalOpeningSource;
    deposits: CapitalDepositAuditRow[];
    realCapitalAdditions: number;
    reinvestments: number;
    realCapitalWithdrawals: number;
    currentCapital: number;
    /**
     * Diagnostic only: the balance produced by the old amount-matching rule.
     * It lets the UI explain exactly why a historic document changed.
     */
    legacyCurrentCapital: number;
    differenceFromLegacy: number;
};

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

function normalizeLegacyNote(value: unknown): string {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase();
}

function isLegacyOpeningCapitalDeposit(tx: InvestorTransaction, investor: Investor): boolean {
    if (tx.type !== 'deposit_capital')
        return false;
    // Historical versions created this exact row in the same batch as the
    // investor document, before `origin: initial_capital` existed. The amount
    // is deliberately NOT part of the signature: `initialCapital` was once
    // overwritten by reinvestment code, so matching amounts was unsafe.
    if (tx.origin !== undefined)
        return false;
    if (normalizeLegacyNote(tx.notes) !== 'capital initial')
        return false;
    const entryTs = toMs(investor.entryDate, Number.NaN);
    const txTs = toMs(tx.timestamp, Number.NaN);
    const nearEntry = Number.isFinite(entryTs) && Number.isFinite(txTs) && Math.abs(txTs - entryTs) <= INITIAL_CAPITAL_WINDOW_MS;
    return nearEntry;
}

function isOpeningCapitalDeposit(tx: InvestorTransaction, investor: Investor): boolean {
    return tx.type === 'deposit_capital'
        && (tx.origin === 'initial_capital' || isLegacyOpeningCapitalDeposit(tx, investor));
}

/**
 * An opening-capital row is the physical counterpart of `initialCapital`.
 * It must not be added a second time. Legacy rows are accepted only when they
 * match the exact historic creation signature, never because their amount
 * happens to match the profile field.
 */
export function isSyntheticInitialCapitalDeposit(tx: InvestorTransaction, investor: Investor): boolean {
    return isOpeningCapitalDeposit(tx, investor);
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

function calculateLegacyCapital(investor: Investor, investorTransactions: InvestorTransaction[], personalExpenses: TreasuryTx[]): number {
    let legacyOpeningHandled = false;
    let capital = Number(investor.initialCapital || 0);
    const orderedTransactions = [...investorTransactions].sort((a, b) => toMs(a.timestamp) - toMs(b.timestamp));
    for (const tx of orderedTransactions) {
        if (tx.origin === 'initial_capital') {
            continue;
        }
        if (tx.type === 'deposit_capital'
            && !legacyOpeningHandled
            && isLegacyOpeningCapitalDeposit(tx, investor)
            && Math.abs(Number(tx.amount || 0) - Number(investor.initialCapital || 0)) <= EPSILON) {
            legacyOpeningHandled = true;
            continue;
        }
        if (tx.type === 'deposit_capital' || tx.type === 'reinvest_profit') {
            capital = addM(capital, Number(tx.amount || 0));
        }
        if (tx.type === 'withdraw_capital' && !isPersonalExpenseCapitalWithdrawal(tx, personalExpenses)) {
            capital = subM(capital, Number(tx.amount || 0));
        }
    }
    return capital;
}

export function buildInvestorCapitalReconciliation(investor: Investor, investorTransactions: InvestorTransaction[], personalExpenses: TreasuryTx[] = []): InvestorCapitalReconciliation {
    const orderedTransactions = [...investorTransactions].sort((a, b) => toMs(a.timestamp) - toMs(b.timestamp));
    const openingDeposits = orderedTransactions.filter((tx) => isOpeningCapitalDeposit(tx, investor));
    const openingDeposit = openingDeposits[0];
    const declaredInitialCapital = Number(investor.initialCapital || 0);
    const openingCapital = openingDeposit ? Number(openingDeposit.amount || 0) : declaredInitialCapital;
    const openingSource: CapitalOpeningSource = openingDeposit ? 'initial_transaction' : 'declared_initial_capital';
    let realCapitalAdditions = 0;
    let reinvestments = 0;
    let realCapitalWithdrawals = 0;
    const deposits = orderedTransactions
        .filter((tx) => tx.type === 'deposit_capital')
        .map((tx): CapitalDepositAuditRow => {
            const classification: CapitalDepositClassification = isOpeningCapitalDeposit(tx, investor) ? 'initial' : 'real_top_up';
            if (classification === 'real_top_up') {
                realCapitalAdditions = addM(realCapitalAdditions, Number(tx.amount || 0));
            }
            return {
                id: tx.id,
                amount: Number(tx.amount || 0),
                origin: tx.origin,
                timestamp: toMs(tx.timestamp),
                notes: String(tx.notes || ''),
                classification,
            };
        });

    for (const tx of orderedTransactions) {
        if (tx.type === 'reinvest_profit') {
            reinvestments = addM(reinvestments, Number(tx.amount || 0));
        }
        if (tx.type === 'withdraw_capital' && !isPersonalExpenseCapitalWithdrawal(tx, personalExpenses)) {
            realCapitalWithdrawals = addM(realCapitalWithdrawals, Number(tx.amount || 0));
        }
    }

    const currentCapital = subM(
        addM(addM(openingCapital, realCapitalAdditions), reinvestments),
        realCapitalWithdrawals
    );
    const legacyCurrentCapital = calculateLegacyCapital(investor, orderedTransactions, personalExpenses);
    return {
        declaredInitialCapital,
        openingCapital,
        openingSource,
        deposits,
        realCapitalAdditions,
        reinvestments,
        realCapitalWithdrawals,
        currentCapital,
        legacyCurrentCapital,
        differenceFromLegacy: subM(currentCapital, legacyCurrentCapital),
    };
}

export function calculateCapitalMovements(investor: Investor, investorTransactions: InvestorTransaction[], personalExpenses: TreasuryTx[] = []) {
    const reconciliation = buildInvestorCapitalReconciliation(investor, investorTransactions, personalExpenses);
    return {
        capitalAdditions: reconciliation.realCapitalAdditions,
        capitalWithdrawals: reconciliation.realCapitalWithdrawals,
    };
}

export function calculateManagerOwnerCapital(input: {
    investor: Investor;
    investorTransactions: InvestorTransaction[];
    personalExpenses?: TreasuryTx[];
    periodStartTs?: number | null;
    periodEndTs?: number | null;
}): ManagerOwnerCapitalBreakdown {
    const capitalReconciliation = buildInvestorCapitalReconciliation(input.investor, input.investorTransactions, input.personalExpenses || []);
    const initialCapital = capitalReconciliation.openingCapital;
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
