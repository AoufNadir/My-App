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
    /** Profit withdrawals sent directly to the owner's account, excluding personal expenses. */
    profitWithdrawals: number;
    /** Settled personal expenses charged against the owner's profit. */
    personalExpenses: number;
    /** Personal expenses created after the expense-tracking flow was enabled. */
    currentPersonalExpenses: number;
    /** Historical plus current personal expenses. */
    totalPersonalExpenses: number;
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
export interface ManagerProfitBreakdown {
    managerFeePercentage: number;
    projectNetProfit: number;
    openingCapital: number;
    actualOwnerCapital: number;
    tradingOwnerProfit: number;
    serviceProfit: number;
    ideaShareProfit: number;
    personalCapitalProfit: number;
    ownerTotalProfit: number;
    externalInvestorsProfit: number;
    totalDeliveryExpenses: number;
    profitWithdrawals: number;
    personalExpenses: number;
    currentPersonalExpenses: number;
    totalPersonalExpenses: number;
    withdrawnProfit: number;
    reinvestedProfit: number;
    availableProfit: number;
    /** Positive amount when withdrawals/reinvestment exceed the derived profit. */
    profitDeficit: number;
    /** Never negative; suitable for the primary UI balance. */
    displayAvailableProfit: number;
}
export type ManagerProfitReconciliationInput = {
    breakdown: ManagerProfitBreakdown;
    openingCapital: number;
    actualOwnerCapital: number;
    serviceProfit?: number;
    preTrackingPersonalExpenses?: number;
};
type InvestorBase = Investor & {
    entryTs: number;
    txs: InvestorTransaction[];
    hasCapitalMovements: boolean;
    capitalBaseline: number;
    capitalInvested: number;
    withdrawnProfit: number;
    reinvestedProfit: number;
    profitWithdrawals: number;
    personalExpenses: number;
    currentPersonalExpenses: number;
    totalPersonalExpenses: number;
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
    treasuryTransactions?: TreasuryTx[];
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
type ProfitMovementKind = 'personal_expense' | 'profit_withdrawal';

function classifyProfitMovement(tx: InvestorTransaction, treasuryById: Map<string, TreasuryTx>): ProfitMovementKind {
    if (tx.origin === 'personal_expense') return 'personal_expense';
    if (tx.origin === 'profit_withdrawal') return 'profit_withdrawal';
    const linkedTreasury = tx.linkedTreasuryTxId ? treasuryById.get(tx.linkedTreasuryTxId) : undefined;
    if (linkedTreasury?.origin === 'personal_expense') return 'personal_expense';
    if (linkedTreasury?.origin === 'investor_profit_withdrawal') return 'profit_withdrawal';
    const notes = String(tx.notes || '').toLocaleLowerCase();
    if (notes.includes('dépense perso') || notes.includes('depense perso') || notes.includes('avance perso') || notes.includes('dépense personnelle') || notes.includes('depense personnelle')) {
        return 'personal_expense';
    }
    // Legacy withdraw_profit rows without a link are direct profit withdrawals.
    return 'profit_withdrawal';
}

function buildInvestorsBase(investors: Investor[], investorTransactions: InvestorTransaction[], treasuryTransactions: TreasuryTx[] = [], periodStartTs?: number | null, periodEndTs?: number | null): InvestorBase[] {
    const txByInvestor = new Map<string, InvestorTransaction[]>();
    const treasuryById = new Map(treasuryTransactions.map((tx) => [tx.id, tx]));
    for (const tx of investorTransactions) {
        const list = txByInvestor.get(tx.investorId) || [];
        list.push(tx);
        txByInvestor.set(tx.investorId, list);
    }
    return investors.map((inv) => {
        const myTxs = txByInvestor.get(inv.id) || [];
        const capitalMovementTxs = myTxs.filter((tx) => tx.type === 'deposit_capital' || tx.type === 'withdraw_capital');
        const movementTxs = myTxs.filter((tx) => tx.type === 'deposit_capital'
            || tx.type === 'reinvest_profit'
            || tx.type === 'withdraw_capital');
        // A reinvestment is an addition to the opening capital, not proof that
        // the opening capital was zero. The baseline is zero only when explicit
        // deposit/withdrawal history already represents the opening capital.
        const capitalBaseline = capitalMovementTxs.length > 0 ? 0 : Number(inv.initialCapital || 0);
        const currentCapitalFromMovements = movementTxs.reduce((sum, tx) => {
            if (tx.type === 'withdraw_capital')
                return subM(sum, tx.amount);
            return addM(sum, tx.amount);
        }, capitalBaseline);
        const periodTxs = myTxs.filter((tx) => isInPeriod(toMs(tx.timestamp), periodStartTs, periodEndTs));
        const withdrawnProfit = periodTxs
            .filter((tx) => tx.type === 'withdraw_profit')
            .reduce((sum, tx) => addM(sum, tx.amount), 0);
        const profitWithdrawals = periodTxs
            .filter((tx) => tx.type === 'withdraw_profit' && classifyProfitMovement(tx, treasuryById) === 'profit_withdrawal')
            .reduce((sum, tx) => addM(sum, tx.amount), 0);
        const personalExpenseTxs = periodTxs
            .filter((tx) => tx.type === 'withdraw_profit' && classifyProfitMovement(tx, treasuryById) === 'personal_expense');
        const historicalPersonalExpenseTxs = personalExpenseTxs
            .filter((tx) => treasuryById.get(tx.linkedTreasuryTxId || '')?.trackingPhase === 'historical');
        const currentPersonalExpenseTxs = personalExpenseTxs
            .filter((tx) => treasuryById.get(tx.linkedTreasuryTxId || '')?.trackingPhase !== 'historical');
        const personalExpenses = historicalPersonalExpenseTxs
            .reduce((sum, tx) => addM(sum, tx.amount), 0);
        const currentPersonalExpenses = currentPersonalExpenseTxs
            .reduce((sum, tx) => addM(sum, tx.amount), 0);
        const totalPersonalExpenses = addM(personalExpenses, currentPersonalExpenses);
        const reinvestedProfit = periodTxs
            .filter((tx) => tx.type === 'reinvest_profit')
            .reduce((sum, tx) => addM(sum, tx.amount), 0);
        return {
            ...inv,
            entryTs: toMs(inv.entryDate, Number.MAX_SAFE_INTEGER),
            txs: myTxs,
            hasCapitalMovements: movementTxs.length > 0,
            capitalBaseline,
            capitalInvested: currentCapitalFromMovements,
            withdrawnProfit,
            reinvestedProfit,
            profitWithdrawals,
            personalExpenses,
            currentPersonalExpenses,
            totalPersonalExpenses,
        };
    });
}
function capitalAtTs(inv: InvestorBase, ts: number): number {
    const movementsUntilTs = inv.txs.filter((tx) => toMs(tx.timestamp) <= ts
        && (tx.type === 'deposit_capital'
            || tx.type === 'reinvest_profit'
            || tx.type === 'withdraw_capital'));
    if (movementsUntilTs.length === 0) {
        return inv.capitalBaseline;
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
    const investorsBase = buildInvestorsBase(input.investors, input.investorTransactions, input.treasuryTransactions, input.periodStartTs, input.periodEndTs);
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
            profitWithdrawals: inv.profitWithdrawals,
            personalExpenses: inv.personalExpenses,
            currentPersonalExpenses: inv.currentPersonalExpenses,
            totalPersonalExpenses: inv.totalPersonalExpenses,
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
            reconciliationDifference: subM(netDistributableProfit, addM(managerShare, investorShare)),
            totalDeliveryExpenses,
            netDistributableProfit,
        },
    };
}
/**
 * Splits the manager's combined investor row into the two economic sources
 * that belong to the project owner: the manager fee and the owner's capital
 * share inside the investor pool.
 */
export function getManagerProfitBreakdown(result: InvestorEconomicsResult, managerFeePercentage: string | number): ManagerProfitBreakdown {
    const manager = result.derivedInvestors.find((investor) => investor.isManager === true);
    const ideaShareProfit = roundM(result.totals.managerShare);
    const tradingOwnerProfit = roundM(manager?.totalProfit ?? ideaShareProfit);
    const personalCapitalProfit = roundM(tradingOwnerProfit - ideaShareProfit);
    const externalInvestorsProfit = roundM(result.totals.investorShare - personalCapitalProfit);
    return {
        managerFeePercentage: Math.max(0, Math.min(100, Number(managerFeePercentage) || 0)),
        projectNetProfit: roundM(result.totals.netDistributableProfit),
        openingCapital: 0,
        actualOwnerCapital: 0,
        tradingOwnerProfit,
        serviceProfit: 0,
        ideaShareProfit,
        personalCapitalProfit,
        ownerTotalProfit: tradingOwnerProfit,
        externalInvestorsProfit,
        totalDeliveryExpenses: roundM(result.totals.totalDeliveryExpenses),
        profitWithdrawals: roundM(manager?.profitWithdrawals || 0),
        personalExpenses: roundM(manager?.personalExpenses || 0),
        currentPersonalExpenses: roundM(manager?.currentPersonalExpenses || 0),
        totalPersonalExpenses: roundM(manager?.totalPersonalExpenses || 0),
        withdrawnProfit: roundM(manager?.withdrawnProfit || 0),
        reinvestedProfit: roundM(manager?.reinvestedProfit || 0),
        availableProfit: roundM(manager?.availableProfit ?? tradingOwnerProfit),
        profitDeficit: roundM(Math.max(0, -(manager?.availableProfit ?? tradingOwnerProfit))),
        displayAvailableProfit: roundM(Math.max(0, manager?.availableProfit ?? tradingOwnerProfit)),
    };
}

export function reconcileManagerProfitBreakdown(input: ManagerProfitReconciliationInput): ManagerProfitBreakdown {
    const breakdown = input.breakdown;
    const openingCapital = Math.max(0, roundM(Number(input.openingCapital || 0)));
    const actualOwnerCapital = Math.max(0, roundM(Number(input.actualOwnerCapital || 0)));
    if (openingCapital <= 0 || actualOwnerCapital <= 0) return breakdown;

    const serviceProfit = Math.max(0, roundM(Number(input.serviceProfit ?? breakdown.serviceProfit ?? 0)));
    const tradingOwnerProfit = roundM(breakdown.tradingOwnerProfit || breakdown.ownerTotalProfit);
    const ownerTotalProfit = roundM(tradingOwnerProfit + serviceProfit);
    const retainedProfit = roundM(actualOwnerCapital - openingCapital);
    const recordedPersonalExpenses = roundM(breakdown.currentPersonalExpenses);
    const explicitHistoricalExpenses = roundM(breakdown.personalExpenses);
    const inferredHistoricalExpenses = input.preTrackingPersonalExpenses == null
        ? roundM(Math.max(
            0,
            ownerTotalProfit
                - breakdown.profitWithdrawals
                - recordedPersonalExpenses
                - explicitHistoricalExpenses
                - retainedProfit
        ))
        : Math.max(0, roundM(Number(input.preTrackingPersonalExpenses || 0)));
    const historicalPersonalExpenses = roundM(explicitHistoricalExpenses + inferredHistoricalExpenses);
    const totalPersonalExpenses = roundM(historicalPersonalExpenses + recordedPersonalExpenses);
    const availableProfit = roundM(Math.max(
        0,
        ownerTotalProfit
            - breakdown.profitWithdrawals
            - totalPersonalExpenses
            - Math.max(0, retainedProfit)
    ));

    return {
        ...breakdown,
        openingCapital,
        actualOwnerCapital,
        tradingOwnerProfit,
        serviceProfit,
        ownerTotalProfit,
        personalExpenses: historicalPersonalExpenses,
        currentPersonalExpenses: recordedPersonalExpenses,
        totalPersonalExpenses,
        reinvestedProfit: Math.max(0, retainedProfit),
        availableProfit,
        profitDeficit: 0,
        displayAvailableProfit: availableProfit,
    };
}
export function useInvestorEconomics(investors: Investor[], investorTransactions: InvestorTransaction[], transactions: Tx[], managerFeePercentage: string, deliveryExpenses?: TreasuryTx[], treasuryTransactions?: TreasuryTx[]) {
    return useMemo(() => deriveInvestorEconomics({ investors, investorTransactions, transactions, managerFeePercentage, deliveryExpenses, treasuryTransactions }), [investors, investorTransactions, transactions, managerFeePercentage, deliveryExpenses, treasuryTransactions]);
}
