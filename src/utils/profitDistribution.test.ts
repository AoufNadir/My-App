import assert from 'node:assert/strict';

import { buildProfitDistributionPlan, calculateWithdrawableProfit, wholeDzdDown } from './profitDistribution';
import type { Investor } from '../types';

function investor(input: Partial<Investor> & Pick<Investor, 'id' | 'name'>): Investor {
    return {
        entryDate: new Date(0).toISOString(),
        capitalInvested: 0,
        initialCapital: 0,
        sharePercentage: 0,
        totalProfit: 0,
        withdrawnProfit: 0,
        availableProfit: 0,
        isActive: true,
        ...input,
    } as Investor;
}

const investors = [
    investor({ id: 'manager', name: 'Manager', isManager: true, availableProfit: 5000 }),
    investor({ id: 'rostom', name: 'Rostom', availableProfit: 3000 }),
    investor({ id: 'karim', name: 'Karim', availableProfit: 2000 }),
];

assert.equal(calculateWithdrawableProfit(investors), 5000);

const plan = buildProfitDistributionPlan(investors, 5000);
assert.deepEqual(plan.map((row) => row.inv.id), ['rostom', 'karim']);
assert.equal(plan.reduce((sum, row) => sum + row.amount, 0), 5000);

// Whole-DZD payouts round down: a plan never pays more than an investor is owed, so the
// suggested total never blocks its own confirmation.
{
    assert.equal(wholeDzdDown(1234.56), 1234);
    const single = buildProfitDistributionPlan([investor({ id: 'a', name: 'A', availableProfit: 1234.56 })], 1234.56);
    assert.deepEqual(single.map((row) => [row.amount, row.exceedsAvailable]), [[1234, false]]);

    const pair = [investor({ id: 'a', name: 'A', availableProfit: 100.40 }), investor({ id: 'b', name: 'B', availableProfit: 100.40 })];
    assert.deepEqual(buildProfitDistributionPlan(pair, 200.80).map((row) => [row.amount, row.exceedsAvailable]), [[100, false], [100, false]]);

    // A leftover unit is dropped rather than lifting a row above its balance.
    const close = [investor({ id: 'a', name: 'A', availableProfit: 100.60 }), investor({ id: 'b', name: 'B', availableProfit: 100.60 })];
    assert.deepEqual(buildProfitDistributionPlan(close, 201.20).map((row) => [row.amount, row.exceedsAvailable]), [[100, false], [100, false]]);
}

// Asking for more than is owed is still flagged.
{
    const plan = buildProfitDistributionPlan([investor({ id: 'a', name: 'A', availableProfit: 50000 })], 60000);
    assert.deepEqual(plan.map((row) => [row.amount, row.exceedsAvailable]), [[60000, true]]);
}

// The suggested total is what the plan can pay: archived investors and negative balances
// are left out, so the plan pays each active investor exactly what they are owed.
{
    const mixed = [
        investor({ id: 'a', name: 'A', availableProfit: 30000 }),
        investor({ id: 'z', name: 'Z', availableProfit: 20000, isActive: false }),
        investor({ id: 'n', name: 'N', availableProfit: -10000 }),
    ];
    const payable = calculateWithdrawableProfit(mixed);
    assert.equal(payable, 30000);
    assert.deepEqual(buildProfitDistributionPlan(mixed, payable).map((row) => [row.inv.id, row.amount, row.exceedsAvailable]), [['a', 30000, false]]);
}

console.log('profitDistribution tests passed');
