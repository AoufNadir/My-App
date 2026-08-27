import assert from 'node:assert/strict';

import { buildMonthlyPdfReport } from '../src/utils/pdfReports.js';
import { computePamLedger } from '../src/utils/pamLedger.js';
import type { ClientDzd, ClientTransactionDzd, Tx } from '../src/types';

function tx(input: Partial<Tx> & Pick<Tx, 'id' | 'type' | 'quantity' | 'timestamp'>): Tx {
  return {
    date: '01/01/2026',
    time: '10:00',
    currency: 'USDT',
    ...input,
  } as Tx;
}

function clientTx(input: Partial<ClientTransactionDzd> & Pick<ClientTransactionDzd, 'id' | 'clientId' | 'timestamp' | 'montant' | 'type'>): ClientTransactionDzd {
  return {
    date: '01/01/2026',
    time: '10:00',
    ...input,
  } as ClientTransactionDzd;
}

function formatNumber(value: number): string {
  return value.toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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

const clients: ClientDzd[] = [
  { id: 'client-a', fullName: 'Client A' },
];

test('monthly PDF uses derived PAM profit for realized profit, client ranking, and transaction table', () => {
  const targetTimestamp = new Date(2026, 0, 24, 20, 43).getTime();
  const transactions: Tx[] = [
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
      timestamp: targetTimestamp,
      date: '24/01/2026',
      time: '20:43',
      type: 'sell',
      quantity: 1000,
      sell: 249.5,
      profit: 2944.0575946601084,
      notes: 'target-jGd0-report-check',
    }),
  ];
  const clientTransactions: ClientTransactionDzd[] = [
    clientTx({
      id: 'client-link-jGd0',
      clientId: 'client-a',
      timestamp: targetTimestamp,
      date: '24/01/2026',
      time: '20:43',
      type: 'Vente USDT',
      montant: -249500,
      linkedTxId: 'jGd0Hug9GvHZ3pxrSrDR',
    }),
  ];
  const ledger = computePamLedger(transactions);
  const targetRow = ledger.profitByTxId.jGd0Hug9GvHZ3pxrSrDR;

  assert.equal(targetRow.storedProfit, 2944.06);
  assert.equal(targetRow.derivedProfit, 849);

  const report = buildMonthlyPdfReport({
    month: 0,
    year: 2026,
    monthLabel: 'Janvier',
    transactions,
    clientTransactions,
    clients,
    getClientName: (client) => client.fullName,
    portfolioStats: ledger.portfolioStats,
    pamLedger: ledger,
  });

  const derivedProfitText = formatNumber(849);
  const storedProfitText = formatNumber(2944.06);
  assert.ok(report.html.includes(`+${derivedProfitText} DZD`), 'monthly realized profit should use derived PAM profit');
  assert.ok(!report.html.includes(storedProfitText), 'stored tx.profit snapshot should not be rendered in the monthly PDF');

  const clientIndex = report.html.indexOf('Client A');
  assert.notEqual(clientIndex, -1);
  const clientSegment = report.html.slice(clientIndex, clientIndex + 700);
  assert.ok(clientSegment.includes(`+${derivedProfitText} DZD`), 'client ranking should use derived PAM profit');

  const txIndex = report.html.indexOf('target-jGd0-report-check');
  assert.notEqual(txIndex, -1);
  const txSegment = report.html.slice(Math.max(0, txIndex - 700), txIndex + 300);
  assert.ok(txSegment.includes(`+${derivedProfitText}`), 'transaction table should use derived PAM profit');
  assert.ok(!txSegment.includes(storedProfitText), 'transaction row should not show stored tx.profit snapshot');
});

test('monthly PDF renders uncostedQuantitySold warnings without subtracting them from profit', () => {
  const sellTimestamp = new Date(2026, 1, 3, 12, 0).getTime();
  const transactions: Tx[] = [
    tx({
      id: 'buy-costed-stock',
      timestamp: new Date(2026, 1, 1, 10, 0).getTime(),
      date: '01/02/2026',
      time: '10:00',
      type: 'buy',
      quantity: 100,
      price: 100,
      total: 10000,
    }),
    tx({
      id: 'qty-only-adjustment',
      timestamp: new Date(2026, 1, 2, 10, 0).getTime(),
      date: '02/02/2026',
      time: '10:00',
      type: 'Ajout Manuel',
      quantity: 10,
      price: 0,
    }),
    tx({
      id: 'sell-uncosted',
      timestamp: sellTimestamp,
      date: '03/02/2026',
      time: '12:00',
      type: 'sell',
      quantity: 105,
      sell: 110,
      profit: 1050,
      notes: 'uncosted-report-check',
    }),
  ];
  const ledger = computePamLedger(transactions);
  const sellRow = ledger.profitByTxId['sell-uncosted'];

  assert.equal(sellRow.derivedProfit, 1050);
  assert.equal(sellRow.quantityWithoutCostBasis, 5);
  assert.equal(sellRow.flags.uncostedQuantitySold, true);

  const report = buildMonthlyPdfReport({
    month: 1,
    year: 2026,
    monthLabel: 'Fevrier',
    transactions,
    clientTransactions: [],
    clients: [],
    getClientName: (client) => client.fullName,
    portfolioStats: ledger.portfolioStats,
    pamLedger: ledger,
  });

  assert.ok(report.html.includes('Alertes Comptables PAM'));
  assert.ok(report.html.includes('uncostedQuantitySold: 1'));
  assert.ok(report.html.includes('sell-uncosted'));
  assert.ok(report.html.includes(formatNumber(5)));
  assert.ok(report.html.includes(`+${formatNumber(1050)} DZD`), 'uncosted warning must not remove realized profit');
});
