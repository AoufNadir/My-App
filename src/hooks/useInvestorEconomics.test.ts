import assert from 'node:assert/strict';
import type { Investor, TreasuryTx, Tx } from '../types';
import { deriveInvestorEconomics, getManagerProfitBreakdown, reconcileManagerProfitBreakdown } from './useInvestorEconomics';

const SALE_TS = new Date('2026-08-10T12:00:00').getTime();

function tx(overrides: Partial<Tx> & Pick<Tx, 'id' | 'type' | 'timestamp'>): Tx {
    const date = new Date(overrides.timestamp);
    return {
        quantity: 1000,
        currency: 'USDT',
        date: date.toLocaleDateString('fr-FR'),
        time: '12:00',
        ...overrides,
    } as Tx;
}

const investors: Investor[] = [
    {
        id: 'manager', name: 'Owner', entryDate: '2026-08-01',
        capitalInvested: 763100, initialCapital: 763100,
        sharePercentage: 0, totalProfit: 0, withdrawnProfit: 0, availableProfit: 0,
        isActive: true, isManager: true,
    },
    {
        id: 'external', name: 'External', entryDate: '2026-08-01',
        capitalInvested: 236900, initialCapital: 236900,
        sharePercentage: 0, totalProfit: 0, withdrawnProfit: 0, availableProfit: 0,
        isActive: true,
    },
];

const transactions = [
    tx({ id: 'buy-1', type: 'buy', timestamp: SALE_TS - 86_400_000, quantity: 1000, total: 100000, price: 100 }),
    tx({ id: 'sell-1', type: 'sell', timestamp: SALE_TS, quantity: 1000, sell: 200, total: 200000, profit: 100000 }),
];

const base = deriveInvestorEconomics({
    investors,
    investorTransactions: [],
    transactions,
    managerFeePercentage: '30',
});
const baseBreakdown = getManagerProfitBreakdown(base, '30');

assert.equal(base.totals.derivedProfit, 100000);
assert.equal(base.totals.managerShare, 30000);
assert.equal(base.totals.investorShare, 70000);
assert.equal(baseBreakdown.ideaShareProfit, 30000);
assert.equal(baseBreakdown.personalCapitalProfit, 53417);
assert.equal(baseBreakdown.ownerTotalProfit, 83417);
assert.equal(baseBreakdown.externalInvestorsProfit, 16583);

const personalExpenseTreasury: TreasuryTx = {
    id: 'personal-1', timestamp: SALE_TS + 1, date: '10/08/2026', time: '12:00',
    type: 'Retrait', source: 'Caisse', amount: 5000, origin: 'personal_expense',
};
const profitWithdrawalTreasury: TreasuryTx = {
    id: 'withdrawal-1', timestamp: SALE_TS + 2, date: '10/08/2026', time: '12:00',
    type: 'Retrait', source: 'Caisse', amount: 10000, origin: 'investor_profit_withdrawal',
};
const separatedMovements = deriveInvestorEconomics({
    investors,
    investorTransactions: [
        { id: 'personal-investor-1', investorId: 'manager', type: 'withdraw_profit', origin: 'personal_expense', amount: 5000, linkedTreasuryTxId: 'personal-1', date: '10/08/2026', time: '12:00', timestamp: SALE_TS + 1 },
        { id: 'withdrawal-investor-1', investorId: 'manager', type: 'withdraw_profit', origin: 'profit_withdrawal', amount: 10000, linkedTreasuryTxId: 'withdrawal-1', date: '10/08/2026', time: '12:00', timestamp: SALE_TS + 2 },
        { id: 'reinvest-1', investorId: 'manager', type: 'reinvest_profit', origin: 'reinvestment', amount: 2000, date: '10/08/2026', time: '12:00', timestamp: SALE_TS + 3 },
    ],
    transactions,
    managerFeePercentage: '30',
    treasuryTransactions: [personalExpenseTreasury, profitWithdrawalTreasury],
});
const separatedBreakdown = getManagerProfitBreakdown(separatedMovements, 30);
assert.equal(separatedBreakdown.personalExpenses, 0);
assert.equal(separatedBreakdown.currentPersonalExpenses, 5000);
assert.equal(separatedBreakdown.totalPersonalExpenses, 5000);
assert.equal(separatedBreakdown.profitWithdrawals, 10000);
assert.equal(separatedBreakdown.reinvestedProfit, 2000);
assert.equal(separatedBreakdown.withdrawnProfit, 15000);
assert.equal(separatedBreakdown.availableProfit, 66417);
assert.equal(separatedBreakdown.profitDeficit, 0);

const overdrawn = deriveInvestorEconomics({
    investors,
    investorTransactions: [{ id: 'overdrawn-1', investorId: 'manager', type: 'withdraw_profit', amount: 90000, date: '10/08/2026', time: '12:00', timestamp: SALE_TS + 4 }],
    transactions,
    managerFeePercentage: '30',
});
const overdrawnBreakdown = getManagerProfitBreakdown(overdrawn, 30);
assert.equal(overdrawnBreakdown.availableProfit, -6583);
assert.equal(overdrawnBreakdown.displayAvailableProfit, 0);
assert.equal(overdrawnBreakdown.profitDeficit, 6583);

const deliveryExpense: TreasuryTx = {
    id: 'delivery-1', timestamp: SALE_TS, date: '10/08/2026', time: '12:00',
    type: 'Retrait', source: 'Caisse', amount: 10000, origin: 'delivery_expense',
};
const afterDelivery = deriveInvestorEconomics({
    investors,
    investorTransactions: [],
    transactions,
    managerFeePercentage: '30',
    deliveryExpenses: [deliveryExpense],
});
const afterDeliveryBreakdown = getManagerProfitBreakdown(afterDelivery, 30);

assert.equal(afterDelivery.totals.netDistributableProfit, 90000);
assert.equal(afterDeliveryBreakdown.ideaShareProfit, 27000);
assert.equal(afterDeliveryBreakdown.personalCapitalProfit, 48075.3);
assert.equal(afterDeliveryBreakdown.ownerTotalProfit, 75075.3);
assert.equal(afterDeliveryBreakdown.externalInvestorsProfit, 14924.7);

const ownerReconciliation = reconcileManagerProfitBreakdown({
    breakdown: {
        managerFeePercentage: 30,
        projectNetProfit: 1358357,
        ideaShareProfit: 551235,
        personalCapitalProfit: 717457,
        ownerTotalProfit: 1268692,
        externalInvestorsProfit: 89665,
        totalDeliveryExpenses: 12300,
        profitWithdrawals: 0,
        personalExpenses: 0,
        currentPersonalExpenses: 178274,
        totalPersonalExpenses: 178274,
        withdrawnProfit: 178274,
        reinvestedProfit: 1091253,
        availableProfit: 0,
        profitDeficit: 0,
        displayAvailableProfit: 0,
    },
    openingCapital: 2000000,
    actualOwnerCapital: 2957009,
});
assert.equal(ownerReconciliation.personalExpenses, 133409);
assert.equal(ownerReconciliation.currentPersonalExpenses, 178274);
assert.equal(ownerReconciliation.totalPersonalExpenses, 311683);
assert.equal(ownerReconciliation.reinvestedProfit, 957009);
assert.equal(ownerReconciliation.availableProfit, 0);

console.log('investor economics unit tests passed');
