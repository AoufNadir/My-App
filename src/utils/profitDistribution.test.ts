import assert from 'node:assert/strict';

import { buildProfitDistributionPlan, calculateWithdrawableProfit } from './profitDistribution';
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

console.log('profitDistribution tests passed');
