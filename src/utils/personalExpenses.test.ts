import assert from 'node:assert/strict';
import { evaluatePersonalAdvanceReconciliation } from './personalExpenses';

const partialReturn = evaluatePersonalAdvanceReconciliation('300', 1000);
assert.equal(partialReturn.isValid, true);
assert.equal(partialReturn.returnAmount, 300);
assert.equal(partialReturn.actualSpent, 700);

const fullReturn = evaluatePersonalAdvanceReconciliation('1000', 1000);
assert.equal(fullReturn.isValid, true);
assert.equal(fullReturn.returnAmount, 1000);
assert.equal(fullReturn.actualSpent, 0);

const fullSpend = evaluatePersonalAdvanceReconciliation('0', 1000);
assert.equal(fullSpend.isValid, true);
assert.equal(fullSpend.returnAmount, 0);
assert.equal(fullSpend.actualSpent, 1000);

const exceedsAdvance = evaluatePersonalAdvanceReconciliation('1000.01', 1000);
assert.equal(exceedsAdvance.isValid, false);
assert.equal(exceedsAdvance.error, 'exceeds');

const negativeReturn = evaluatePersonalAdvanceReconciliation('-1', 1000);
assert.equal(negativeReturn.isValid, false);
assert.equal(negativeReturn.error, 'negative');

console.log('personalExpenses tests passed');
