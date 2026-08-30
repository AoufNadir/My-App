import assert from 'node:assert/strict';

import { computePamLedger } from './pamLedger';
import { buildInvestorPdfReport } from './pdfReports';
import { deriveInvestorEconomics } from '../hooks/useInvestorEconomics';
import type { Investor, InvestorTransaction, Tx } from '../types';

function tx(input: Partial<Tx> & Pick<Tx, 'id' | 'type' | 'quantity' | 'timestamp'>): Tx {
    return {
        date: '01/08/2026',
        time: '12:00',
        currency: 'USDT',
        ...input,
    } as Tx;
}

function investorTx(input: Partial<InvestorTransaction> & Pick<InvestorTransaction, 'id' | 'type' | 'amount' | 'timestamp'>): InvestorTransaction {
    return {
        investorId: 'rostom',
        date: '01/08/2026',
        time: '12:00',
        ...input,
    } as InvestorTransaction;
}

const investor: Investor = {
    id: 'rostom',
    name: 'Rostom El Hakim',
    entryDate: new Date(0).toISOString(),
    capitalInvested: 100000,
    initialCapital: 100000,
    sharePercentage: 0,
    totalProfit: 0,
    withdrawnProfit: 0,
    availableProfit: 0,
    isActive: true,
};
const allTransactions = [
    tx({ id: 'buy', type: 'buy', quantity: 200, price: 200, total: 40000, timestamp: 1000 }),
    tx({ id: 'historic-sale', type: 'sell', quantity: 100, sell: 389.9088, timestamp: 2000 }),
    tx({ id: 'august-sale', type: 'sell', quantity: 100, sell: 224.3484, timestamp: 4000 }),
];
const allInvestorTransactions = [
    investorTx({ id: 'reinvestment-august', type: 'reinvest_profit', amount: 19164.92, timestamp: 5000 }),
];
const startTs = 3000;
const endTs = 6000;
const common = {
    investors: [investor],
    investorTransactions: allInvestorTransactions,
    managerFeePercentage: '0',
    managerFeeHistory: undefined,
    deliveryExpenses: [],
    personalExpenses: [],
};
const period = deriveInvestorEconomics({
    ...common,
    transactions: allTransactions,
    pamLedger: computePamLedger(allTransactions),
    periodStartTs: startTs,
    periodEndTs: endTs,
}).derivedInvestors[0];
const closingTransactions = allTransactions.filter((item) => item.timestamp <= endTs);
const closingInvestor = deriveInvestorEconomics({
    ...common,
    investorTransactions: allInvestorTransactions.filter((item) => item.timestamp <= endTs),
    transactions: closingTransactions,
    pamLedger: computePamLedger(closingTransactions),
    periodEndTs: endTs,
}).derivedInvestors[0];

assert.equal(Number(period.totalProfit.toFixed(2)), 2434.84);
assert.equal(Number(closingInvestor.totalProfit.toFixed(2)), 21425.72);
assert.equal(Number(closingInvestor.capitalInvested.toFixed(2)), 119164.92);
assert.equal(Number(closingInvestor.availableProfit.toFixed(2)), 2260.80);

const report = buildInvestorPdfReport({
    investor: {
        ...period,
        capitalInvested: closingInvestor.capitalInvested,
        availableProfit: closingInvestor.availableProfit,
        sharePercentage: closingInvestor.sharePercentage,
    },
    investorTransactions: allInvestorTransactions,
    reportStartTs: startTs,
    reportEndTs: endTs,
});
const html = report.html.replace(/\s+/g, ' ');
assert.match(html, /2 434,84 DZD/);
assert.match(html, /2 260,80 DZD/);
assert.match(html, /121 425,72 DZD/);
assert.match(html, /19 164,92 DZD/);
assert.match(html, /Rendement de la p&eacute;riode/);
assert.match(html, /Situation &agrave; la date de fin/);
assert.match(html, /Performance et mouvements/);
assert.match(html, /Profit net de la p&eacute;riode/);
assert.doesNotMatch(html, /&Eacute;volution du capital/);
assert.match(html, /class="investor-operations-table"/);
assert.match(html, /thead\s*\{\s*display: table-header-group/);
assert.match(html, /page-break-inside: avoid/);

console.log('investor PDF partial-period tests passed');
