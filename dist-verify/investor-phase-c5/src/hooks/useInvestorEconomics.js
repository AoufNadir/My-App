import { useMemo } from 'react';
import { addM, distributeProportionally, roundM, subM, sumM } from '../utils/money';
import { computePamLedger } from '../utils/pamLedger';
function toMs(value) {
    if (typeof value === 'number')
        return value;
    if (value && typeof value.toMillis === 'function') {
        return value.toMillis();
    }
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
}
function addWarning(allWarnings, warningsByInvestor, warning) {
    allWarnings.push(warning);
    if (!warning.investorId)
        return;
    const list = warningsByInvestor.get(warning.investorId) || [];
    list.push(warning);
    warningsByInvestor.set(warning.investorId, list);
}
function buildInvestorsBase(investors, investorTransactions) {
    const txByInvestor = new Map();
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
        const withdrawnProfit = myTxs
            .filter((tx) => tx.type === 'withdraw_profit')
            .reduce((sum, tx) => addM(sum, tx.amount), 0);
        const reinvestedProfit = myTxs
            .filter((tx) => tx.type === 'reinvest_profit')
            .reduce((sum, tx) => addM(sum, tx.amount), 0);
        return {
            ...inv,
            entryTs: toMs(inv.entryDate),
            txs: myTxs,
            hasCapitalMovements: movementTxs.length > 0,
            capitalInvested: movementTxs.length > 0 ? currentCapitalFromMovements : inv.initialCapital,
            withdrawnProfit,
            reinvestedProfit,
        };
    });
}
function capitalAtTs(inv, ts) {
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
function chronologicalDerivedSells(pamLedger) {
    return [...pamLedger.sellProfitRows]
        .filter((row) => Number.isFinite(Number(row.derivedProfit)) && Number(row.derivedProfit || 0) !== 0)
        .sort((a, b) => toMs(a.timestamp) - toMs(b.timestamp));
}
export function deriveInvestorEconomics(input) {
    const pamLedger = input.pamLedger || computePamLedger(input.transactions);
    const feePercent = parseFloat(input.managerFeePercentage) || 0;
    const managerFeeRatio = Math.max(0, Math.min(1, feePercent / 100));
    const investorsBase = buildInvestorsBase(input.investors, input.investorTransactions);
    const distributedProfitByInvestor = new Map();
    const warningsByInvestor = new Map();
    const warnings = [];
    for (const inv of investorsBase) {
        distributedProfitByInvestor.set(inv.id, 0);
        warningsByInvestor.set(inv.id, []);
    }
    let distributedDerivedProfit = 0;
    let managerShare = 0;
    let investorShare = 0;
    let unallocatedProfit = 0;
    for (const sellRow of chronologicalDerivedSells(pamLedger)) {
        const sellTs = toMs(sellRow.timestamp);
        const derivedProfit = roundM(sellRow.derivedProfit || 0);
        const eligible = investorsBase
            .filter((inv) => inv.entryTs <= sellTs)
            .map((inv) => ({ id: inv.id, cap: Math.max(0, capitalAtTs(inv, sellTs)) }))
            .filter((item) => item.cap > 0);
        const totalCapAtSell = eligible.reduce((sum, item) => sum + item.cap, 0);
        if (totalCapAtSell <= 0) {
            unallocatedProfit = addM(unallocatedProfit, derivedProfit);
            continue;
        }
        const investorPool = roundM(derivedProfit * (1 - managerFeeRatio));
        const shares = distributeProportionally(investorPool, eligible.map((item) => item.cap));
        const distributedToInvestors = sumM(shares);
        const rowManagerShare = subM(derivedProfit, distributedToInvestors);
        distributedDerivedProfit = addM(distributedDerivedProfit, derivedProfit);
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
    const totalCurrentCapital = investorsBase.reduce((sum, inv) => {
        if (!inv.isActive || inv.capitalInvested <= 0)
            return sum;
        return sum + inv.capitalInvested;
    }, 0);
    const derivedInvestors = investorsBase.map((inv) => {
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
        return {
            ...inv,
            sharePercentage: currentShare,
            totalProfit,
            availableProfit,
            accountingWarnings: warningsByInvestor.get(inv.id) || [],
        };
    });
    return {
        derivedInvestors,
        warnings,
        totals: {
            derivedProfit: distributedDerivedProfit,
            managerShare,
            investorShare,
            unallocatedProfit,
            reconciliationDifference: subM(distributedDerivedProfit, addM(managerShare, investorShare)),
        },
    };
}
export function useInvestorEconomics(investors, investorTransactions, transactions, managerFeePercentage) {
    return useMemo(() => deriveInvestorEconomics({ investors, investorTransactions, transactions, managerFeePercentage }), [investors, investorTransactions, transactions, managerFeePercentage]);
}
