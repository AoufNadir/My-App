import assert from 'node:assert/strict';
import type { ClientTransactionDzd } from '../types';
import { computeClientDebtState, projectCreditExposure } from './clientDebt';

const DAY = 86_400_000;
const due = Date.parse('2026-06-01T23:59:59');
const debtRow: ClientTransactionDzd = {
    id: 'd1', clientId: 'c1', timestamp: Date.parse('2026-05-20T12:00:00'),
    date: '20/05/2026', time: '12:00', montant: -1000,
    type: 'Vente USDT', paymentMethod: 'Crédit', creditDueDate: '2026-06-01',
};

assert.equal(computeClientDebtState([debtRow], due + 29 * DAY).oldestOverdueDays, 29);
assert.equal(computeClientDebtState([debtRow], due + 30 * DAY).oldestOverdueDays, 30);

const payment: ClientTransactionDzd = {
    id: 'p1', clientId: 'c1', timestamp: Date.parse('2026-06-10T12:00:00'),
    date: '10/06/2026', time: '12:00', montant: 400,
    type: 'Règlement Reçu', paymentMethod: 'Espèces',
};
const partiallyPaid = computeClientDebtState([debtRow, payment], due + 30 * DAY);
assert.equal(partiallyPaid.debt, 600);
assert.equal(partiallyPaid.overdueAmount, 600);
// A partial settlement already yields a learned delay (amount-weighted).
assert.equal(partiallyPaid.avgSettleDays, 21); // 400 DZD settled 21 days after the sale
assert.equal(partiallyPaid.settledLotCount, 0); // lot not fully repaid yet

// Full settlement 12 days after the credit sale → avgSettleDays = 12.
const saleTs = Date.parse('2026-05-20T12:00:00');
const fullPayment: ClientTransactionDzd = {
    id: 'p2', clientId: 'c1', timestamp: saleTs + 12 * DAY,
    date: '01/06/2026', time: '12:00', montant: 1000,
    type: 'Règlement Reçu', paymentMethod: 'Espèces',
};
const settled = computeClientDebtState([debtRow, fullPayment], saleTs + 40 * DAY);
assert.equal(settled.avgSettleDays, 12);
assert.equal(settled.settledLotCount, 1);
assert.equal(settled.debt, 0);

// Split settlements weight by amount: (400×5 + 600×20) / 1000 = 14.
const pA: ClientTransactionDzd = { ...fullPayment, id: 'p3', montant: 400, timestamp: saleTs + 5 * DAY };
const pB: ClientTransactionDzd = { ...fullPayment, id: 'p4', montant: 600, timestamp: saleTs + 20 * DAY };
const weighted = computeClientDebtState([debtRow, pA, pB], saleTs + 40 * DAY);
assert.equal(weighted.avgSettleDays, 14);
assert.equal(weighted.settledLotCount, 1);

// Non-credit-sale debt rows (adjustments, transfers) never feed the metric.
const adjustmentDebt: ClientTransactionDzd = {
    id: 'a1', clientId: 'c1', timestamp: saleTs,
    date: '20/05/2026', time: '12:00', montant: -1000,
    type: 'Ajustement Solde', paymentMethod: 'Espèces',
};
const nonCredit = computeClientDebtState([adjustmentDebt, fullPayment], saleTs + 40 * DAY);
assert.equal(nonCredit.avgSettleDays, null);
assert.equal(nonCredit.settledLotCount, 0);
assert.equal(nonCredit.debt, 0); // balance math unchanged

assert.deepEqual(projectCreditExposure(200, 500), { projectedBalance: -300, projectedDebt: 300 });
console.log('clientDebt tests passed');

