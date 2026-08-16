import assert from 'node:assert/strict';
import type { Investor, TreasuryTx, Tx } from '../types';
import { deriveInvestorEconomics, getManagerProfitBreakdown } from './useInvestorEconomics';

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

console.log('investor economics unit tests passed');
