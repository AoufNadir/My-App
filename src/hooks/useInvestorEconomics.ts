import { useMemo } from 'react';
import type { Investor, InvestorTransaction, TreasuryTx, Tx } from '../types';
import { addM, distributeProportionally, roundM, subM, sumM } from '../utils/money';
import { calculateManagerOwnerCapital, calculateTotalPersonalExpenses } from '../utils/managerCapital';
import { computePamLedger, type PamLedgerResult, type PamLedgerSellProfitRow } from '../utils/pamLedger';
export const LEGACY_MANAGER_FEE_PERCENTAGE = 30;
export type InvestorAccountingWarningCode = 'available_profit_negative' | 'withdrawals_exceed_derived_profit' | 'uncosted_quantity_sold' | 'negative_derived_profit';
export type InvestorAccountingWarningSeverity = 'info' | 'warning' | 'high';
export interface InvestorAccountingWarning {
    code: InvestorAccountingWarningCode;
    severity: InvestorAccountingWarningSeverity;
    message: string;
    investorId?: string;
    txId?: string;
    amount?: number;
}
export type DerivedInvestor = Investor & {
    entryTs: number;
    txs: InvestorTransaction[];
    hasCapitalMovements: boolean;
    reinvestedProfit: number;
    accountingWarnings: InvestorAccountingWarning[];
    /** ROI = totalProfit / capitalInvested × 100 (percentage). Null when capitalInvested = 0. */
    roi: number | null;
};
export interface InvestorEconomicsResult {
    derivedInvestors: DerivedInvestor[];
    warnings: InvestorAccountingWarning[];
    totals: {
        derivedProfit: number;
        managerShare: number;
        investorShare: number;
        reconciliationDifference: number;
        totalDeliveryExpenses: number;
        netDistributableProfit: number;
    };
}
export interface ManagerFeeHistoryEntry {
    id?: string;
    percentage: number;
    effectiveFrom: number;
    createdAt?: number;
}
type InvestorBase = Investor & {
    entryTs: number;
    txs: InvestorTransaction[];
    hasCapitalMovements: boolean;
    capitalInvested: number;
    withdrawnProfit: number;
    reinvestedProfit: number;
};
type InvestorEconomicsInput = {
    investors: Investor[];
    investorTransactions: InvestorTransaction[];
    transactions: Tx[];
    managerFeePercentage: string;
    managerFeeHistory?: ManagerFeeHistoryEntry[];
    pamLedger?: PamLedgerResult;
    periodStartTs?: number | null;
    periodEndTs?: number | null;
    deliveryExpenses?: TreasuryTx[];
    personalExpenses?: TreasuryTx[];
};
function toMs(value: unknown, fallback = 0): number {
    if (typeof value === 'number')
        return value;
    if (value && typeof (value as {
        toMillis?: () => number;
    }).toMillis === 'function') {
        return (value as {
            toMillis: () => number;
        }).toMillis();
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
function normalizeFeePercentage(value: unknown, fallback = 0): number {
    const parsed = typeof value === 'string' ? parseFloat(value) : Number(value);
    if (!Number.isFinite(parsed))
        return fallback;
    return Math.max(0, Math.min(100, parsed));
}
function normalizeManagerFeeHistory(history: ManagerFeeHistoryEntry[] | undefined): ManagerFeeHistoryEntry[] {
    return (history || [])
        .map((entry) => ({
        ...entry,
        percentage: normalizeFeePercentage(entry.percentage, Number.NaN),
        effectiveFrom: toMs(entry.effectiveFrom, Number.NaN),
    }))
        .filter((entry) => Number.isFinite(entry.percentage) && Number.isFinite(entry.effectiveFrom))
        .sort((a, b) => a.effectiveFrom - b.effectiveFrom);
}
export function getManagerFeeAt(timestamp: unknown, managerFeeHistory: ManagerFeeHistoryEntry[] = [], legacyPercentage = LEGACY_MANAGER_FEE_PERCENTAGE): number {
    const ts = toMs(timestamp);
    const sortedHistory = normalizeManagerFeeHistory(managerFeeHistory);
    let activePercentage = normalizeFeePercentage(legacyPercentage, LEGACY_MANAGER_FEE_PERCENTAGE);
    for (const entry of sortedHistory) {
        if (entry.effectiveFrom > ts)
            break;
        activePercentage = entry.percentage;
    }
    return activePercentage;
}
function createManagerFeeRatioResolver(input: InvestorEconomicsInput): (timestamp: unknown) => number {
    if (input.managerFeeHistory === undefined) {
        const staticRatio = normalizeFeePercentage(input.managerFeePercentage, 0) / 100;
        return () => staticRatio;
    }
    const sortedHistory = normalizeManagerFeeHistory(input.managerFeeHistory);
    const legacyPercentage = normalizeFeePercentage(LEGACY_MANAGER_FEE_PERCENTAGE, LEGACY_MANAGER_FEE_PERCENTAGE);
    return (timestamp: unknown) => {
        const ts = toMs(timestamp);
        let activePercentage = legacyPercentage;
        for (const entry of sortedHistory) {
            if (entry.effectiveFrom > ts)
                break;
            activePercentage = entry.percentage;
        }
        return activePercentage / 100;
    };
}
function addWarning(allWarnings: InvestorAccountingWarning[], warningsByInvestor: Map<string, InvestorAccountingWarning[]>, warning: InvestorAccountingWarning): void {
    allWarnings.push(warning);
    if (!warning.investorId)
        return;
    const list = warningsByInvestor.get(warning.investorId) || [];
    list.push(warning);
    warningsByInvestor.set(warning.investorId, list);
}
function buildInvestorsBase(investors: Investor[], investorTransactions: InvestorTransaction[], periodStartTs?: number | null, periodEndTs?: number | null, personalExpenses?: TreasuryTx[]): InvestorBase[] {
    const txByInvestor = new Map<string, InvestorTransaction[]>();
    for (const tx of investorTransactions) {
        const list = txByInvestor.get(tx.investorId) || [];
        list.push(tx);
        txByInvestor.set(tx.investorId, list);
    }
    const managerPersonalExpenses = calculateTotalPersonalExpenses(personalExpenses || [], periodStartTs, periodEndTs);
    return investors.map((inv) => {
        const myTxs = txByInvestor.get(inv.id) || [];
        const movementTxs = myTxs.filter((tx) => tx.type === 'deposit_capital'
            || tx.type === 'reinvest_profit'
            || tx.type === 'withdraw_capital');
        const currentCapitalFromMovements = movementTxs.reduce((sum, tx) => {
            if (tx.type === 'withdraw_capital')
                return subM(sum, tx.amount);
            return addM(sum, tx.amount);
        }, 0);
        const periodTxs = myTxs.filter((tx) => isInPeriod(toMs(tx.timestamp), periodStartTs, periodEndTs));
        const transactionWithdrawnProfit = periodTxs
            .filter((tx) => tx.type === 'withdraw_profit')
            .reduce((sum, tx) => addM(sum, tx.amount), 0);
        const transactionReinvestedProfit = periodTxs
            .filter((tx) => tx.type === 'reinvest_profit')
            .reduce((sum, tx) => addM(sum, tx.amount), 0);
        const withdrawnProfit = inv.isManager ? managerPersonalExpenses : transactionWithdrawnProfit;
        const reinvestedProfit = inv.isManager ? 0 : transactionReinvestedProfit;
        return {
            ...inv,
            entryTs: toMs(inv.entryDate, Number.MAX_SAFE_INTEGER),
            txs: myTxs,
            hasCapitalMovements: movementTxs.length > 0,
            capitalInvested: movementTxs.length > 0 ? currentCapitalFromMovements : inv.initialCapital,
            withdrawnProfit,
            reinvestedProfit,
        };
    });
}
function capitalAtTs(inv: InvestorBase, ts: number): number {
    const movementsUntilTs = inv.txs.filter((tx) => toMs(tx.timestamp) <= ts
        && (tx.type === 'deposit_capital'
            || tx.type === 'reinvest_profit'
            || tx.type === 'withdraw_capital'));
    if (movementsUntilTs.length === 0) {
        return inv.hasCapitalMovements ? 0 : inv.initialCapital;
    }
    return movementsUntilTs.reduce((sum, tx) => {
        if (tx.type === 'withdraw_capital')
            return subM(sum, tx.amount);
        return addM(sum, tx.amount);
    }, 0);
}
function chronologicalDerivedSells(pamLedger: PamLedgerResult): PamLedgerSellProfitRow[] {
    return [...pamLedger.sellProfitRows]
        .filter((row) => {
        if (!Number.isFinite(Number(row.derivedProfit)))
            return false;
        // FIX-3 (Q10): include zero-profit sells if they carry warning flags so investors
        // are notified about uncosted/oversell/legacy_fallback even when no profit is distributed.
        if (Number(row.derivedProfit || 0) !== 0)
            return true;
        return row.flags.uncostedQuantitySold || row.flags.oversell || row.flags.legacyFallback;
    })
        .sort((a, b) => toMs(a.timestamp) - toMs(b.timestamp));
}
export function deriveInvestorEconomics(input: InvestorEconomicsInput): InvestorEconomicsResult {
    const pamLedger = input.pamLedger || computePamLedger(input.transactions);
    const getManagerFeeRatioAt = createManagerFeeRatioResolver(input);
    const investorsBase = buildInvestorsBase(input.investors, input.investorTransactions, input.periodStartTs, input.periodEndTs, input.personalExpenses);
    const distributedProfitByInvestor = new Map<string, number>();
    const warningsByInvestor = new Map<string, InvestorAccountingWarning[]>();
    const warnings: InvestorAccountingWarning[] = [];
    for (const inv of investorsBase) {
        distributedProfitByInvestor.set(inv.id, 0);
        warningsByInvestor.set(inv.id, []);
    }
    const managerInvestor = investorsBase.find((inv) => inv.isManager === true) || null;
    const creditManager = (amount: number) => {
        if (!managerInvestor || amount === 0) return;
        distributedProfitByInvestor.set(
            managerInvestor.id,
            addM(distributedProfitByInvestor.get(managerInvestor.id) || 0, amount)
        );
    };
    let totalDerivedProfit = 0;
    let managerShare = 0;
    let investorShare = 0;
    for (const sellRow of chronologicalDerivedSells(pamLedger)) {
        const sellTs = toMs(sellRow.timestamp);
        if (!isInPeriod(sellTs, input.periodStartTs, input.periodEndTs))
            continue;
        const derivedProfit = roundM(sellRow.derivedProfit || 0);
        const managerFeeRatio = getManagerFeeRatioAt(sellTs);
        totalDerivedProfit = addM(totalDerivedProfit, derivedProfit);
        const eligible = investorsBase
            .filter((inv) => inv.entryTs <= sellTs)
            .map((inv) => ({ id: inv.id, cap: Math.max(0, capitalAtTs(inv, sellTs)) }))
            .filter((item) => item.cap > 0);
        const totalCapAtSell = eligible.reduce((sum, item) => sum + item.cap, 0);
        if (totalCapAtSell <= 0) {
            // Accounting rule: profit generated before any investor joined belongs
            // entirely to the manager (sole capital owner at that moment).
            managerShare = addM(managerShare, derivedProfit);
            creditManager(derivedProfit);
            continue;
        }
        const investorPool = roundM(derivedProfit * (1 - managerFeeRatio));
        const shares = distributeProportionally(investorPool, eligible.map((item) => item.cap));
        const distributedToInvestors = sumM(shares);
        const rowManagerShare = subM(derivedProfit, distributedToInvestors);
        managerShare = addM(managerShare, rowManagerShare);
        investorShare = addM(investorShare, distributedToInvestors);
        // H1 fix: manager's fee share is part of the manager's withdrawable profit.
        // Previously it accumulated in managerShare totals only and could never be
        // spent via withdraw_profit/personal_expense (which validate against availableProfit).
        creditManager(rowManagerShare);
        if (derivedProfit < 0) {
            for (const item of eligible) {
                addWarning(warnings, warningsByInvestor, {
                    code: 'negative_derived_profit',
                    severity: 'warning',
                    investorId: item.id,
                    txId: sellRow.txId,
                    amount: derivedProfit,
                    message: 'Derived PAM profit is negative; current behavior distributes the loss proportionally.',
                });
            }
        }
        if (sellRow.flags.uncostedQuantitySold) {
            for (const item of eligible) {
                addWarning(warnings, warningsByInvestor, {
                    code: 'uncosted_quantity_sold',
                    severity: sellRow.flags.oversell ? 'high' : 'warning',
                    investorId: item.id,
                    txId: sellRow.txId,
                    amount: sellRow.quantityWithoutCostBasis,
                    message: 'Investor profit includes a sell row with uncostedQuantitySold.',
                });
            }
        }
        eligible.forEach((item, index) => {
            distributedProfitByInvestor.set(item.id, addM(distributedProfitByInvestor.get(item.id) || 0, shares[index]));
        });
    }
    // Delivery expenses: shared operating cost. Subtract from gross profit BEFORE
    // manager fee, so manager bears their proportional share via the fee ratio,
    // and investors absorb the remainder allocated by capital-at-time-of-expense.
    let totalDeliveryExpenses = 0;
    const sortedDeliveryExpenses = (input.deliveryExpenses || [])
        .filter((tx) => Number.isFinite(Number(tx.amount)) && Number(tx.amount) > 0)
        .map((tx) => ({ tx, ts: toMs(tx.timestamp) }))
        .filter((row) => isInPeriod(row.ts, input.periodStartTs, input.periodEndTs))
        .sort((a, b) => a.ts - b.ts);
    for (const { tx, ts: expenseTs } of sortedDeliveryExpenses) {
        const amount = roundM(Number(tx.amount));
        if (amount <= 0)
            continue;
        const managerFeeRatio = getManagerFeeRatioAt(expenseTs);
        totalDeliveryExpenses = addM(totalDeliveryExpenses, amount);
        const eligible = investorsBase
            .filter((inv) => inv.entryTs <= expenseTs)
            .map((inv) => ({ id: inv.id, cap: Math.max(0, capitalAtTs(inv, expenseTs)) }))
            .filter((item) => item.cap > 0);
        const totalCapAtExpense = eligible.reduce((sum, item) => sum + item.cap, 0);
        if (totalCapAtExpense <= 0)
            continue; // no eligible investors → expense remains unallocated
        const investorBurden = roundM(amount * (1 - managerFeeRatio));
        const managerBurden = subM(amount, investorBurden);
        managerShare = subM(managerShare, managerBurden);
        investorShare = subM(investorShare, investorBurden);
        // H1 fix: mirror the manager fee accounting from sells — delivery expenses
        // reduce manager's distributable profit proportionally so personal expenses
        // / withdraw_profit validation reflects the true post-expense entitlement.
        creditManager(-managerBurden);
        const burdenShares = distributeProportionally(investorBurden, eligible.map((item) => item.cap));
        eligible.forEach((item, index) => {
            distributedProfitByInvestor.set(item.id, subM(distributedProfitByInvestor.get(item.id) || 0, burdenShares[index]));
        });
    }
    const investorDrafts = investorsBase.map((inv) => {
        const totalProfit = distributedProfitByInvestor.get(inv.id) || 0;
        const withdrawnAndReinvested = addM(inv.withdrawnProfit, inv.reinvestedProfit);
        const availableProfit = subM(totalProfit, withdrawnAndReinvested);
        if (availableProfit < -0.01) {
            addWarning(warnings, warningsByInvestor, {
                code: 'available_profit_negative',
                severity: 'high',
                investorId: inv.id,
                amount: availableProfit,
                message: 'Investor availableProfit is negative after derived PAM profit recalculation.',
            });
        }
        if (withdrawnAndReinvested > 0 && withdrawnAndReinvested > totalProfit + 0.01) {
            addWarning(warnings, warningsByInvestor, {
                code: 'withdrawals_exceed_derived_profit',
                severity: 'high',
                investorId: inv.id,
                amount: subM(withdrawnAndReinvested, totalProfit),
                message: 'Investor withdrawals plus reinvested profit exceed derived totalProfit.',
            });
        }
        const managerCapital = inv.isManager
            ? calculateManagerOwnerCapital({
                investor: { ...inv, totalProfit },
                investorTransactions: inv.txs,
                personalExpenses: input.personalExpenses || [],
                periodStartTs: input.periodStartTs,
                periodEndTs: input.periodEndTs,
            })
            : null;
        const capitalInvested = managerCapital ? managerCapital.ownerCapital : inv.capitalInvested;
        const roi = capitalInvested > 0.005
            ? roundM((totalProfit / capitalInvested) * 100)
            : null;
        return { inv, totalProfit, availableProfit, capitalInvested, roi };
    });
    const totalCurrentCapital = investorDrafts.reduce((sum, draft) => {
        if (!draft.inv.isActive || draft.capitalInvested <= 0)
            return sum;
        return sum + draft.capitalInvested;
    }, 0);
    const derivedInvestors = investorDrafts.map((draft): DerivedInvestor => {
        const currentShare = draft.inv.isActive && totalCurrentCapital > 0
            ? Math.max(0, draft.capitalInvested) / totalCurrentCapital
            : 0;
        return {
            ...draft.inv,
            capitalInvested: draft.capitalInvested,
            sharePercentage: currentShare,
            totalProfit: draft.totalProfit,
            availableProfit: draft.availableProfit,
            roi: draft.roi,
            accountingWarnings: warningsByInvestor.get(draft.inv.id) || [],
        };
    });
    const netDistributableProfit = subM(totalDerivedProfit, totalDeliveryExpenses);
    return {
        derivedInvestors,
        warnings,
        totals: {
            derivedProfit: totalDerivedProfit,
            managerShare,
            investorShare,
            reconciliationDifference: subM(netDistributableProfit, addM(managerShare, investorShare)),
            totalDeliveryExpenses,
            netDistributableProfit,
        },
    };
}
export function useInvestorEconomics(investors: Investor[], investorTransactions: InvestorTransaction[], transactions: Tx[], managerFeePercentage: string, managerFeeHistory?: ManagerFeeHistoryEntry[], deliveryExpenses?: TreasuryTx[], personalExpenses?: TreasuryTx[]) {
    return useMemo(() => deriveInvestorEconomics({ investors, investorTransactions, transactions, managerFeePercentage, managerFeeHistory, deliveryExpenses, personalExpenses }), [investors, investorTransactions, transactions, managerFeePercentage, managerFeeHistory, deliveryExpenses, personalExpenses]);
}
