import assert from 'node:assert/strict';

import { deriveInvestorEconomics } from '../src/hooks/useInvestorEconomics.js';
import type { Investor, InvestorTransaction, Tx } from '../src/types';

function tx(input: Partial<Tx> & Pick<Tx, 'id' | 'type' | 'quantity' | 'timestamp'>): Tx {
  return {
    date: '01/01/2026',
    time: '10:00',
    currency: 'USDT',
    ...input,
  } as Tx;
}

function investor(input: Partial<Investor> & Pick<Investor, 'id'>): Investor {
  const capital = input.initialCapital ?? input.capitalInvested ?? 0;
  return {
    name: input.id,
    entryDate: new Date(0).toISOString(),
    capitalInvested: capital,
    initialCapital: capital,
    sharePercentage: 0,
    totalProfit: 0,
    withdrawnProfit: 0,
    availableProfit: 0,
    isActive: true,
    ...input,
  } as Investor;
}

function investorTx(input: Partial<InvestorTransaction> & Pick<InvestorTransaction, 'id' | 'investorId' | 'type' | 'amount' | 'timestamp'>): InvestorTransaction {
  return {
    date: '01/01/2026',
    time: '10:00',
    notes: '',
    ...input,
  } as InvestorTransaction;
}

function assertMoney(actual: number, expected: number, message?: string): void {
  assert.equal(Number(actual.toFixed(2)), expected, message);
}

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

function jGd0Transactions(): Tx[] {
  return [
    tx({
      id: 'jGd0-opening-cost',
      timestamp: new Date(2026, 0, 24, 19, 0).getTime(),
      date: '24/01/2026',
      time: '19:00',
      type: 'buy',
      quantity: 1000,
      price: 248.651,
      total: 248651,
    }),
    tx({
      id: 'jGd0Hug9GvHZ3pxrSrDR',
      timestamp: new Date(2026, 0, 24, 20, 43).getTime(),
      date: '24/01/2026',
      time: '20:43',
      type: 'sell',
      quantity: 1000,
      sell: 249.5,
      profit: 2944.0575946601084,
    }),
  ];
}

test('investor distribution uses derived PAM profit instead of stored tx.profit', () => {
  const result = deriveInvestorEconomics({
    investors: [investor({ id: 'inv-a', initialCapital: 100000 })],
    investorTransactions: [],
    transactions: jGd0Transactions(),
    managerFeePercentage: '0',
  });

  assertMoney(result.derivedInvestors[0].totalProfit, 849);
  assertMoney(result.totals.investorShare, 849);
  assertMoney(result.totals.managerShare, 0);
  assertMoney(result.totals.reconciliationDifference, 0);

  const oldStoredDistribution = 2944.06;
  assertMoney(oldStoredDistribution - result.derivedInvestors[0].totalProfit, 2095.06);
});

test('jGd0Hug9GvHZ3pxrSrDR distributes 849.00, not the old 2944.06 snapshot', () => {
  const result = deriveInvestorEconomics({
    investors: [investor({ id: 'inv-jgd0', initialCapital: 1 })],
    investorTransactions: [],
    transactions: jGd0Transactions(),
    managerFeePercentage: '0',
  });

  assertMoney(result.derivedInvestors[0].totalProfit, 849);
  assert.notEqual(result.derivedInvestors[0].totalProfit, 2944.06);
});

test('capital deposited before a sell participates, capital deposited after the sell does not', () => {
  const sellTs = new Date(2026, 2, 10, 12, 0).getTime();
  const result = deriveInvestorEconomics({
    investors: [
      investor({ id: 'before', initialCapital: 0 }),
      investor({ id: 'after', initialCapital: 0 }),
    ],
    investorTransactions: [
      investorTx({ id: 'before-deposit', investorId: 'before', type: 'deposit_capital', amount: 1000, timestamp: sellTs - 1000 }),
      investorTx({ id: 'after-deposit', investorId: 'after', type: 'deposit_capital', amount: 1000, timestamp: sellTs + 1000 }),
    ],
    transactions: [
      tx({ id: 'buy', timestamp: sellTs - 2000, type: 'buy', quantity: 100, price: 100, total: 10000 }),
      tx({ id: 'sell', timestamp: sellTs, type: 'sell', quantity: 100, sell: 120, profit: 2000 }),
    ],
    managerFeePercentage: '20',
  });

  const before = result.derivedInvestors.find((inv) => inv.id === 'before')!;
  const after = result.derivedInvestors.find((inv) => inv.id === 'after')!;
  assertMoney(before.totalProfit, 1600);
  assertMoney(after.totalProfit, 0);
  assertMoney(result.totals.managerShare, 400);
  assertMoney(result.totals.investorShare + result.totals.managerShare, 2000);
  assertMoney(result.totals.reconciliationDifference, 0);
});

test('withdrawn and reinvested profit leave no unpaid investor profit', () => {
  const result = deriveInvestorEconomics({
    investors: [investor({ id: 'inv-reinvest', initialCapital: 0 })],
    investorTransactions: [
      investorTx({ id: 'deposit', investorId: 'inv-reinvest', type: 'deposit_capital', amount: 100000, timestamp: 500 }),
      investorTx({ id: 'withdraw', investorId: 'inv-reinvest', type: 'withdraw_profit', amount: 50000, timestamp: 3000 }),
      investorTx({ id: 'reinvest', investorId: 'inv-reinvest', type: 'reinvest_profit', amount: 50000, timestamp: 4000 }),
    ],
    transactions: [
      tx({ id: 'buy', timestamp: 1000, type: 'buy', quantity: 100, price: 1000, total: 100000 }),
      tx({ id: 'sell', timestamp: 2000, type: 'sell', quantity: 100, sell: 2000, profit: 100000 }),
    ],
    managerFeePercentage: '0',
  });

  const row = result.derivedInvestors[0];
  assertMoney(row.totalProfit, 100000);
  assertMoney(row.withdrawnProfit, 50000);
  assertMoney(row.reinvestedProfit, 50000);
  assertMoney(row.availableProfit, 0);
  assertMoney(row.capitalInvested, 150000, 'reinvested profit becomes investor capital');
});

test('manager fee plus investor shares reconciles exactly to derived profit', () => {
  const result = deriveInvestorEconomics({
    investors: [
      investor({ id: 'a', initialCapital: 1 }),
      investor({ id: 'b', initialCapital: 1 }),
      investor({ id: 'c', initialCapital: 1 }),
    ],
    investorTransactions: [],
    transactions: [
      tx({ id: 'buy', timestamp: 1000, type: 'buy', quantity: 100, price: 100, total: 10000 }),
      tx({ id: 'sell', timestamp: 2000, type: 'sell', quantity: 100, sell: 101, profit: 100 }),
    ],
    managerFeePercentage: '0',
  });

  const totalInvestorProfit = result.derivedInvestors.reduce((sum, inv) => sum + inv.totalProfit, 0);
  assertMoney(totalInvestorProfit, 100);
  assertMoney(result.totals.reconciliationDifference, 0);
  assert.deepEqual(result.derivedInvestors.map((inv) => Number(inv.totalProfit.toFixed(2))), [33.34, 33.33, 33.33]);
});

test('negative derived profit keeps current behavior and emits a warning', () => {
  const result = deriveInvestorEconomics({
    investors: [investor({ id: 'loss-investor', initialCapital: 1000 })],
    investorTransactions: [],
    transactions: [
      tx({ id: 'buy', timestamp: 1000, type: 'buy', quantity: 100, price: 100, total: 10000 }),
      tx({ id: 'loss-sell', timestamp: 2000, type: 'sell', quantity: 100, sell: 90, profit: -1000 }),
    ],
    managerFeePercentage: '20',
  });

  const lossInvestor = result.derivedInvestors[0];
  assertMoney(lossInvestor.totalProfit, -800);
  assertMoney(result.totals.managerShare, -200);
  assert.ok(result.warnings.some((warning) => warning.code === 'negative_derived_profit' && warning.txId === 'loss-sell'));
});

test('negative availableProfit is warning-only when withdrawals exceed derived totalProfit', () => {
  const result = deriveInvestorEconomics({
    investors: [investor({ id: 'over-withdraw', initialCapital: 100000 })],
    investorTransactions: [
      investorTx({
        id: 'withdraw-too-much',
        investorId: 'over-withdraw',
        type: 'withdraw_profit',
        amount: 900,
        timestamp: new Date(2026, 0, 25).getTime(),
      }),
    ],
    transactions: jGd0Transactions(),
    managerFeePercentage: '0',
  });

  const row = result.derivedInvestors[0];
  assertMoney(row.totalProfit, 849);
  assertMoney(row.availableProfit, -51);
  assert.ok(row.accountingWarnings.some((warning) => warning.code === 'available_profit_negative'));
  assert.ok(row.accountingWarnings.some((warning) => warning.code === 'withdrawals_exceed_derived_profit'));
});

test('uncostedQuantitySold creates investor accounting warning without blocking distribution', () => {
  const result = deriveInvestorEconomics({
    investors: [investor({ id: 'uncosted-investor', initialCapital: 1000 })],
    investorTransactions: [],
    transactions: [
      tx({ id: 'buy', timestamp: 1000, type: 'buy', quantity: 100, price: 100, total: 10000 }),
      tx({ id: 'qty-only', timestamp: 2000, type: 'Ajout Manuel', quantity: 10, price: 0 }),
      tx({ id: 'sell-uncosted', timestamp: 3000, type: 'sell', quantity: 105, sell: 110, profit: 1050 }),
    ],
    managerFeePercentage: '0',
  });

  const row = result.derivedInvestors[0];
  assertMoney(row.totalProfit, 1050);
  assert.ok(row.accountingWarnings.some((warning) => warning.code === 'uncosted_quantity_sold' && warning.txId === 'sell-uncosted'));
});
