import assert from 'node:assert/strict';

import { computePamLedger } from '../src/utils/pamLedger.js';
import type { Tx } from '../src/types';

function tx(input: Partial<Tx> & Pick<Tx, 'id' | 'type' | 'quantity' | 'timestamp'>): Tx {
  return {
    date: '01/01/2026',
    time: '10:00',
    currency: 'USDT',
    ...input,
  } as Tx;
}

function assertMoney(actual: number | null, expected: number, message?: string): void {
  assert.equal(actual, expected, message);
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

function buildJGd0Fixture(): Tx[] {
  return [
    tx({
      id: 'audit-opening-usdt-costed-before-jGd0',
      timestamp: 1769100000000,
      date: '22/01/2026',
      time: '17:40',
      type: 'Ajout Manuel',
      currency: 'USDT',
      quantity: 2093.99,
      price: 248.26,
      total: 519847.75,
      notes: 'Regression fixture opening costed USDT state before target window',
    }),
    tx({
      id: 'audit-opening-usdt-qty-only-before-jGd0',
      timestamp: 1769100000001,
      date: '22/01/2026',
      time: '17:40',
      type: 'Ajout Manuel',
      currency: 'USDT',
      quantity: 6.2,
      price: 0,
      notes: 'Regression fixture carries prior quantity-only manual adjustment',
    }),
    tx({
      id: 'audit-opening-eur-before-jGd0',
      timestamp: 1769100000002,
      date: '22/01/2026',
      time: '17:40',
      type: 'Ajout Manuel',
      currency: 'EUR',
      quantity: 539.29,
      price: 287,
      total: 154776.23,
      notes: 'Regression fixture opening EUR state before target window',
    }),
    tx({
      id: 'fGOuhIcU9AZtxN5EW4Uy',
      timestamp: 1769100424142,
      date: '22/01/2026',
      time: '17:47',
      type: 'buy',
      currency: 'EUR',
      quantity: 1000,
      price: 287,
      total: 287000,
    }),
    tx({
      id: '74gSmy27yPIAwqcNjprp',
      timestamp: 1769181602921,
      date: '23/01/2026',
      time: '16:20',
      type: 'sell',
      currency: 'USDT',
      quantity: 200,
      sell: 253,
      profit: 891.8682983450026,
    }),
    tx({
      id: 'vwWimTZvyNv2mFFxmaTB',
      timestamp: 1769185356232,
      date: '23/01/2026',
      time: '17:22',
      type: 'sell',
      currency: 'USDT',
      quantity: 1200,
      sell: 249.75,
      profit: 2200.5109279064413,
    }),
    tx({
      id: 'd4agW4sUxar2R45FvIQc',
      timestamp: 1769190031811,
      date: '23/01/2026',
      time: '18:40',
      type: 'Retrait Manuel',
      currency: 'EUR',
      quantity: 1530,
      notes: 'Achat de 1760.64 USDT',
    }),
    tx({
      id: 'laRqwheTl8XGAjkgzGUu',
      timestamp: 1769190031824,
      date: '23/01/2026',
      time: '18:40',
      type: 'buy',
      currency: 'USDT',
      quantity: 1760.644418872267,
      price: 249.44645,
      total: 439186.5,
    }),
    tx({
      id: 'zQDN7XZ62ZFXx01Muc8T',
      timestamp: 1769190091985,
      date: '23/01/2026',
      time: '18:41',
      type: 'sell',
      currency: 'USDT',
      quantity: 1000,
      sell: 249.5,
      profit: 897.8115919630341,
    }),
    tx({
      id: 'o5rBPvnZCKhyLyMzM0R8',
      timestamp: 1769195206694,
      date: '23/01/2026',
      time: '20:06',
      type: 'buy',
      currency: 'USDT',
      quantity: 4426.56,
      price: 248.5,
      total: 1100000,
    }),
    tx({
      id: 'ViHDLQfiTv7soFQ7SLYk',
      timestamp: 1769197257271,
      date: '23/01/2026',
      time: '20:40',
      type: 'sell',
      currency: 'USDT',
      quantity: 400,
      sell: 252,
      profit: 1383.7365966900052,
    }),
    tx({
      id: 'P7vdQuq8gEDVL1IFvHW3',
      timestamp: 1769282381596,
      date: '24/01/2026',
      time: '20:19',
      type: 'sell',
      currency: 'USDT',
      quantity: 1000,
      sell: 251,
      profit: 2459.341491725013,
    }),
    tx({
      id: '5r1g3NpOXD1JGzJcbiZB',
      timestamp: 1769282933847,
      date: '24/01/2026',
      time: '20:28',
      type: 'sell',
      currency: 'USDT',
      quantity: 300,
      sell: 252,
      profit: 1934.8529547883118,
    }),
    tx({
      id: 'jGd0Hug9GvHZ3pxrSrDR',
      timestamp: 1769283803850,
      date: '24/01/2026',
      time: '20:43',
      type: 'sell',
      currency: 'USDT',
      quantity: 1000,
      sell: 249.5,
      profit: 2944.0575946601084,
    }),
  ];
}

test('jGd0Hug9GvHZ3pxrSrDR keeps stored snapshot separate from derived PAM profit', () => {
  const ledger = computePamLedger(buildJGd0Fixture());
  const row = ledger.profitByTxId.jGd0Hug9GvHZ3pxrSrDR;

  assert.ok(row);
  assertMoney(row.storedProfit, 2944.06);
  assertMoney(row.derivedProfit, 849);
  assertMoney(row.difference, 2095.06);
  assertMoney(row.historicalAvgBuy, 248.65);
  assert.equal(row.flags.storedMismatch, true);
  assert.equal(row.flags.manualTotalPresent, false);
  assert.equal(row.flags.oversell, false);
  assert.equal(row.flags.uncostedQuantitySold, false);
  assert.equal(row.flags.eurConversionRelated, true);
});

test('editing an old purchase changes derived profit for later sells without changing stored profit', () => {
  const sale = tx({
    id: 'sale-after-old-buy',
    timestamp: 2000,
    type: 'sell',
    quantity: 50,
    sell: 150,
    profit: 2500,
  });
  const original = computePamLedger([
    tx({ id: 'old-buy', timestamp: 1000, type: 'buy', quantity: 100, price: 100, total: 10000 }),
    sale,
  ]);
  const edited = computePamLedger([
    tx({ id: 'old-buy', timestamp: 1000, type: 'buy', quantity: 100, price: 60, total: 6000 }),
    sale,
  ]);

  assertMoney(original.profitByTxId['sale-after-old-buy'].derivedProfit, 2500);
  assertMoney(edited.profitByTxId['sale-after-old-buy'].derivedProfit, 4500);
  assertMoney(edited.profitByTxId['sale-after-old-buy'].storedProfit, 2500);
  assert.equal(edited.profitByTxId['sale-after-old-buy'].flags.storedMismatch, true);
});

test('deleting an old purchase rebuilds PAM and flags oversell when stock is no longer enough', () => {
  const sale = tx({
    id: 'sale-after-deleted-buy',
    timestamp: 3000,
    type: 'sell',
    quantity: 150,
    sell: 250,
    profit: 15000,
  });
  const beforeDelete = computePamLedger([
    tx({ id: 'buy-1', timestamp: 1000, type: 'buy', quantity: 100, price: 100, total: 10000 }),
    tx({ id: 'buy-2', timestamp: 2000, type: 'buy', quantity: 100, price: 200, total: 20000 }),
    sale,
  ]);
  const afterDelete = computePamLedger([
    tx({ id: 'buy-2', timestamp: 2000, type: 'buy', quantity: 100, price: 200, total: 20000 }),
    sale,
  ]);

  assertMoney(beforeDelete.profitByTxId['sale-after-deleted-buy'].derivedProfit, 15000);
  assertMoney(afterDelete.profitByTxId['sale-after-deleted-buy'].derivedProfit, 7500);
  assert.equal(afterDelete.profitByTxId['sale-after-deleted-buy'].flags.oversell, true);
  assert.equal(afterDelete.profitByTxId['sale-after-deleted-buy'].flags.uncostedQuantitySold, true);
  assert.equal(afterDelete.profitByTxId['sale-after-deleted-buy'].flags.storedMismatch, true);
});

test('EUR to USDT conversion updates both ledgers and keeps USDT PAM coherent', () => {
  const ledger = computePamLedger([
    tx({ id: 'eur-buy', timestamp: 1000, type: 'buy', currency: 'EUR', quantity: 1000, price: 287, total: 287000 }),
    tx({ id: 'eur-retrait', timestamp: 2000, type: 'Retrait Manuel', currency: 'EUR', quantity: 500, notes: 'Achat de 580 USDT' }),
    tx({ id: 'usdt-buy-from-eur', timestamp: 2001, type: 'buy', currency: 'USDT', quantity: 580, price: 247.41, total: 143500 }),
    tx({ id: 'usdt-sell-after-eur', timestamp: 3000, type: 'sell', currency: 'USDT', quantity: 100, sell: 250, profit: 259 }),
  ]);

  const buyRow = ledger.operationRows.find((row) => row.txId === 'usdt-buy-from-eur');
  const sellRow = ledger.profitByTxId['usdt-sell-after-eur'];
  assert.ok(buyRow);
  assert.equal(buyRow.flags.eurConversionRelated, true);
  assert.equal(sellRow.flags.eurConversionRelated, true);
  assertMoney(sellRow.historicalAvgBuy, 247.41);
  assertMoney(sellRow.derivedProfit, 258.62);
  assertMoney(ledger.portfolioStats.eur.available, 500);
  assertMoney(ledger.portfolioStats.usdt.available, 480);
});

test('manual stock adjustment without total changes quantity only', () => {
  const ledger = computePamLedger([
    tx({ id: 'buy', timestamp: 1000, type: 'buy', quantity: 100, price: 100, total: 10000 }),
    tx({ id: 'qty-only', timestamp: 2000, type: 'Ajout Manuel', quantity: 10, price: 0 }),
  ]);
  const row = ledger.operationRows.find((candidate) => candidate.txId === 'qty-only');

  assert.ok(row);
  assert.equal(row.flags.quantityOnlyAdjustment, true);
  assertMoney(ledger.portfolioStats.usdt.available, 110);
  assertMoney(ledger.portfolioStats.usdt.purchasedQty, 100);
  assertMoney(ledger.portfolioStats.usdt.costBasis, 10000);
  assertMoney(ledger.portfolioStats.usdt.avgBuy, 100);
});

test('sell after quantity-only adjustment is flagged as uncosted quantity sold', () => {
  const ledger = computePamLedger([
    tx({ id: 'buy', timestamp: 1000, type: 'buy', quantity: 100, price: 100, total: 10000 }),
    tx({ id: 'qty-only', timestamp: 2000, type: 'Ajout Manuel', quantity: 10, price: 0 }),
    tx({ id: 'sell-uncosted', timestamp: 3000, type: 'sell', quantity: 105, sell: 110, profit: 1050 }),
  ]);
  const row = ledger.profitByTxId['sell-uncosted'];

  assert.ok(row);
  assert.equal(row.flags.oversell, false);
  assert.equal(row.flags.uncostedQuantitySold, true);
  assertMoney(row.quantityWithoutCostBasis, 5);
  assertMoney(row.derivedProfit, 1050);
  assert.ok(row.warnings.some((warning) => warning.code === 'uncosted_quantity_sold'));
});

test('manual stock adjustment with total changes quantity and cost basis', () => {
  const ledger = computePamLedger([
    tx({ id: 'manual-costed', timestamp: 1000, type: 'Ajout Manuel', quantity: 10, price: 150, total: 1500 }),
  ]);
  const row = ledger.operationRows.find((candidate) => candidate.txId === 'manual-costed');

  assert.ok(row);
  assert.equal(row.flags.quantityOnlyAdjustment, false);
  assertMoney(ledger.portfolioStats.usdt.available, 10);
  assertMoney(ledger.portfolioStats.usdt.purchasedQty, 10);
  assertMoney(ledger.portfolioStats.usdt.costBasis, 1500);
  assertMoney(ledger.portfolioStats.usdt.avgBuy, 150);
});

test('sellProfitRows expose stable derived rows for later investor distribution consumers', () => {
  const ledger = computePamLedger([
    tx({ id: 'buy', timestamp: 1000, type: 'buy', quantity: 100, price: 100, total: 10000 }),
    tx({ id: 'sell-1', timestamp: 2000, type: 'sell', quantity: 40, sell: 120, profit: 800 }),
    tx({ id: 'sell-2', timestamp: 3000, type: 'sell', quantity: 10, sell: 130, profit: 300 }),
  ]);

  assert.deepEqual(ledger.sellProfitRows.map((row) => row.txId), ['sell-1', 'sell-2']);
  assertMoney(ledger.profitByTxId['sell-1'].derivedProfit, 800);
  assertMoney(ledger.profitByTxId['sell-2'].derivedProfit, 300);
  assertMoney(ledger.totals.derivedProfit, 1100);
});

test('USDT sale settled in EUR realizes profit in DZD and adds EUR proceeds', () => {
  const ledger = computePamLedger([
    tx({
      id: 'buy-usdt-eur-1',
      timestamp: 1000,
      type: 'buy',
      quantity: 1000,
      price: 214.5,
      total: 214500,
      purchaseFundingCurrency: 'EUR',
      purchaseAmountEur: 858,
      eurToDzdRateAtPurchase: 250,
      eurPerUsdtAtPurchase: 0.858,
    }),
    tx({
      id: 'buy-usdt-eur-2',
      timestamp: 2000,
      type: 'buy',
      quantity: 1000,
      price: 215,
      total: 215000,
      purchaseFundingCurrency: 'EUR',
      purchaseAmountEur: 860,
      eurToDzdRateAtPurchase: 250,
      eurPerUsdtAtPurchase: 0.86,
    }),
    tx({ id: 'buy-usdt-dzd', timestamp: 3000, type: 'buy', quantity: 1000, price: 247, total: 247000 }),
    tx({
      id: 'sell-usdt-for-eur',
      timestamp: 4000,
      type: 'sell',
      quantity: 2000,
      sell: 233.55,
      total: 467100,
      settlementCurrency: 'EUR',
      sellPriceEur: 0.865,
      saleValueEur: 1730,
      eurToDzdRateAtSale: 270,
      profit: 16100,
    }),
    tx({
      id: 'linked-eur-proceeds',
      timestamp: 4001,
      type: 'buy',
      currency: 'EUR',
      quantity: 1730,
      price: 270,
      total: 467100,
      linkedTxId: 'sell-usdt-for-eur',
      notes: 'Encaissement EUR - Vente de 2000 USDT',
    }),
  ]);

  const sellRow = ledger.profitByTxId['sell-usdt-for-eur'];

  assert.ok(sellRow);
  assert.equal(sellRow.settlementCurrency, 'EUR');
  assertMoney(sellRow.sellPriceEur, 0.865);
  assertMoney(sellRow.saleValueEur, 1730);
  assertMoney(sellRow.saleValueDzd, 467100);
  assertMoney(sellRow.historicalAvgBuy, 225.5);
  assertMoney(sellRow.soldCostDzd, 451000);
  assertMoney(sellRow.derivedProfit, 16100);
  assertMoney(sellRow.profitMarginPercent, 3.57);
  assertMoney(ledger.portfolioStats.usdt.available, 1000);
  assertMoney(ledger.portfolioStats.eur.available, 1730);
  assertMoney(ledger.portfolioStats.eur.avgBuy, 270);
});
