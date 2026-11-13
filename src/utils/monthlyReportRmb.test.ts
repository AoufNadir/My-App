import assert from 'node:assert/strict';
import { buildMonthlyReport } from './monthlyReport';
import type { Tx } from '../types';

// V14-2: the monthly report shows RMB bought / sold and the RMB wallet, only when there is some. Fake figures only.
const T = Date.UTC(2027, 2, 10, 10);
const stats = { usdt: { available: 0, avgBuy: 0 }, eur: { available: 0, avgBuy: 0 } };
const base = { month: 2, year: 2027, clientTransactions: [], clients: [], getClientName: () => '' };
const rmb = [
    { id: 'b', type: 'buy', currency: 'RMB', quantity: 1_000, price: 36, total: 36_000, timestamp: T },
    { id: 's', type: 'sell', currency: 'RMB', quantity: 400, sell: 38, total: 15_200, timestamp: T + 1000 },
] as unknown as Tx[];
const withRmb = buildMonthlyReport({ ...base, transactions: rmb, portfolioStats: { ...stats, rmb: { available: 600, avgBuy: 36 } } as never });
assert.deepEqual([withRmb.rmbBought, withRmb.rmbSold, withRmb.portfolio.rmbAvailable, withRmb.portfolio.rmbAvgBuy], [1_000, 400, 600, 36]);
const without = buildMonthlyReport({ ...base, transactions: [], portfolioStats: stats as never });
assert.equal(without.rmbBought, undefined, 'no RMB: nothing more in the report');
assert.equal(without.portfolio.rmbAvailable, undefined);
console.log('monthlyReportRmb.test: RMB in the monthly report only when there is some');
