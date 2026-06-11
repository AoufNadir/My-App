import assert from 'node:assert/strict';
import {
    calculateInvestorBreakdown,
    calculateStockValue,
    computeCapitalSnapshot
} from './capitalSnapshot';
import type { Investor } from '../types';

const exampleInvestors = [
    {
        id: 'manager',
        name: 'Gerant',
        entryDate: '2026-01-01',
        capitalInvested: 1000000,
        initialCapital: 1000000,
        sharePercentage: 0,
        totalProfit: 0,
        withdrawnProfit: 0,
        availableProfit: 999999,
        isActive: true,
        isManager: true
    },
    {
        id: 'investor-1',
        name: 'Investor 1',
        entryDate: '2026-01-01',
        capitalInvested: 360526,
        initialCapital: 360526,
        sharePercentage: 0,
        totalProfit: 47608,
        withdrawnProfit: 0,
        availableProfit: 47608,
        isActive: true
    }
] satisfies Investor[];

const investorBreakdown = calculateInvestorBreakdown(exampleInvestors);

assert.equal(investorBreakdown.capital, 360526);
assert.equal(investorBreakdown.profits, 47608);
assert.equal(investorBreakdown.total, 408134);

const stockValue = Math.round(calculateStockValue({
    usdt: {
        available: 3046.79,
        avgBuy: 246.20,
        purchasedQty: 0,
        costBasis: 0,
        totalProfit: 0,
        locked: 0,
        lockedBatches: []
    },
    eur: {
        available: 2712,
        avgBuy: 283.91,
        purchasedQty: 0,
        costBasis: 0,
        totalProfit: 0,
        locked: 0,
        lockedBatches: []
    }
}));

assert.equal(stockValue, 1520084);

const snapshot = computeCapitalSnapshot({
    caisseBalance: 786200,
    baridiBalance: 9650,
    portfolioValue: 1520084,
    totalDettes: -939658,
    totalAvances: 9880,
    treasuryCards: [],
    investorLiability: investorBreakdown.total,
    services: {
        amountToReceive: 79100,
        clientAdvances: 0
    }
});

assert.equal(snapshot.stockValue, 1520084);
assert.equal(snapshot.receivables, 939658);
assert.equal(snapshot.clientAdvances, 9880);
assert.equal(snapshot.netClientPosition, 929778);
assert.equal(snapshot.servicesCapitalImpact, 79100);
assert.equal(snapshot.totalCapital, 3324812);
assert.equal(snapshot.netOwnedCapital, 2916678);

const signSafeSnapshot = computeCapitalSnapshot({
    caisseBalance: 786200,
    baridiBalance: 9650,
    portfolioValue: 1520084,
    totalDettes: 939658,
    totalAvances: -9880,
    treasuryCards: [],
    investorLiability: investorBreakdown.total,
    services: {
        amountToReceive: 79100,
        clientAdvances: 0
    }
});

assert.equal(signSafeSnapshot.netClientPosition, 929778);
assert.equal(signSafeSnapshot.totalCapital, 3324812);

const paidServiceSnapshot = computeCapitalSnapshot({
    caisseBalance: 786200 + 79100,
    baridiBalance: 9650,
    portfolioValue: 1520084,
    totalDettes: -939658,
    totalAvances: 9880,
    treasuryCards: [],
    investorLiability: investorBreakdown.total,
    services: {
        serviceRevenue: 79100,
        cashReceived: 79100,
        amountToReceive: 0,
        clientAdvances: 0
    }
});

assert.equal(paidServiceSnapshot.servicesCapitalImpact, 0);
assert.equal(paidServiceSnapshot.totalCapital, 3324812);

const serviceAlreadyInReceivablesSnapshot = computeCapitalSnapshot({
    caisseBalance: 786200,
    baridiBalance: 9650,
    portfolioValue: 1520084,
    totalDettes: -(939658 + 79100),
    totalAvances: 9880,
    treasuryCards: [],
    investorLiability: investorBreakdown.total,
    services: {
        amountToReceive: 79100,
        clientAdvances: 0,
        receivablesAlreadyIncluded: true
    }
});

assert.equal(serviceAlreadyInReceivablesSnapshot.servicesCapitalImpact, 0);
assert.equal(serviceAlreadyInReceivablesSnapshot.totalCapital, 3324812);

console.log('capitalSnapshot unit tests passed');
