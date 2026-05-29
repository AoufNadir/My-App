import { useMemo } from 'react';
import type { Investor, InvestorTransaction, TreasuryTx, Tx } from '../types';
import { addM, distributeProportionally, roundM, subM, sumM } from '../utils/money';
import { computePamLedger, type PamLedgerResult, type PamLedgerSellProfitRow } from '../utils/pamLedger';
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
        unallocatedProfit: number;
        reconciliationDifference: number;
        totalDeliveryExpenses: number;
        netDistributableProfit: number;
    };
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
    pamLedger?: PamLedgerResult;
    periodStartTs?: number | null;
    periodEndTs?: number | null;
    deliveryExpenses?: TreasuryTx[];
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
function addWarning(allWarnings: InvestorAccountingWarning[], warningsByInvestor: Map<string, InvestorAccountingWarning[]>, warning: InvestorAccountingWarning): void {
    allWarnings.push(warning);
    if (!warning.investorId)
        return;
    const list = warningsByInvestor.get(warning.investorId) || [];
    list.push(warning);
    warningsByInvestor.set(warning.investorId, list);
}
function buildInvestorsBase(investors: Investor[], investorTransactions: InvestorTransaction[], periodStartTs?: number | null, periodEndTs?: number | null): InvestorBase[] {
    const txByInvestor = new Map<string, InvestorTransaction[]>();
    for (const tx of investorTransactions) {
        const list = txByInvestor.get(tx.investorId) || [];
        list.push(tx);
        txByInvestor.set(tx.investorId, list);
    }
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
        const withdrawnProfit = periodTxs
            .filter((tx) => tx.type === 'withdraw_profit')
            .reduce((sum, tx) => addM(sum, tx.amount), 0);
        const reinvestedProfit = periodTxs
            .filter((tx) => tx.type === 'reinvest_profit')
            .reduce((sum, tx) => addM(sum, tx.amount), 0);
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
    const feePercent = parseFloat(input.managerFeePercentage) || 0;
    const managerFeeRatio = Math.max(0, Math.min(1, feePercent / 100));
    const investorsBase = buildInvestorsBase(input.investors, input.investorTransactions, input.periodStartTs, input.periodEndTs);
    const distributedProfitByInvestor = new Map<string, number>();
    const warningsByInvestor = new Map<string, InvestorAccountingWarning[]>();
    const warnings: InvestorAccountingWarning[] = [];
    for (const inv of investorsBase) {
        distributedProfitByInvestor.set(inv.id, 0);
        warningsByInvestor.set(inv.id, []);
    }
    let totalDerivedProfit = 0;
    let managerShare = 0;
    let investorShare = 0;
    let unallocatedProfit = 0;
    for (const sellRow of chronologicalDerivedSells(pamLedger)) {
        const sellTs = toMs(sellRow.timestamp);
        if (!isInPeriod(sellTs, input.periodStartTs, input.periodEndTs))
            continue;
        const derivedProfit = roundM(sellRow.derivedProfit || 0);
        totalDerivedProfit = addM(totalDerivedProfit, derivedProfit);
        const eligible = investorsBase
            .filter((inv) => inv.entryTs <= sellTs)
            .map((inv) => ({ id: inv.id, cap: Math.max(0, capitalAtTs(inv, sellTs)) }))
            .filter((item) => item.cap > 0);
        const totalCapAtSell = eligible.reduce((sum, item) => sum + item.cap, 0);
        if (totalCapAtSell <= 0) {
            // Accounting rule: profit generated before any investor joined belongs
            // entirely to the manager (sole capital owner at that moment).
            // Previously suspended in unallocatedProfit — now correctly routed to managerShare.
            managerShare = addM(managerShare, derivedProfit);
            continue;
        }
        const investorPool = roundM(derivedProfit * (1 - managerFeeRatio));
        const shares = distributeProportionally(investorPool, eligible.map((item) => item.cap));
        const distributedToInvestors = sumM(shares);
        const rowManagerShare = subM(derivedProfit, distributedToInvestors);
        managerShare = addM(managerShare, rowManagerShare);
        investorShare = addM(investorShare, distributedToInvestors);
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
        const burdenShares = distributeProportionally(investorBurden, eligible.map((item) => item.cap));
        eligible.forEach((item, index) => {
            distributedProfitByInvestor.set(item.id, subM(distributedProfitByInvestor.get(item.id) || 0, burdenShares[index]));
        });
    }
    const totalCurrentCapital = investorsBase.reduce((sum, inv) => {
        if (!inv.isActive || inv.capitalInvested <= 0)
            return sum;
        return sum + inv.capitalInvested;
    }, 0);
    const derivedInvestors = investorsBase.map((inv): DerivedInvestor => {
        const currentShare = inv.isActive && totalCurrentCapital > 0
            ? Math.max(0, inv.capitalInvested) / totalCurrentCapital
            : 0;
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
        const roi = inv.capitalInvested > 0.005
            ? roundM((totalProfit / inv.capitalInvested) * 100)
            : null;
        return {
            ...inv,
            sharePercentage: currentShare,
            totalProfit,
            availableProfit,
            roi,
            accountingWarnings: warningsByInvestor.get(inv.id) || [],
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
            unallocatedProfit,
            reconciliationDifference: subM(netDistributableProfit, addM(addM(managerShare, investorShare), unallocatedProfit)),
            totalDeliveryExpenses,
            netDistributableProfit,
        },
    };
}
export function useInvestorEconomics(investors: Investor[], investorTransactions: InvestorTransaction[], transactions: Tx[], managerFeePercentage: string, deliveryExpenses?: TreasuryTx[]) {
    return useMemo(() => deriveInvestorEconomics({ investors, investorTransactions, transactions, managerFeePercentage, deliveryExpenses }), [investors, investorTransactions, transactions, managerFeePercentage, deliveryExpenses]);
}
