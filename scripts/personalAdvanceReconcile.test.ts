import assert from 'node:assert/strict';

import { evaluatePersonalAdvanceReconciliation } from '../src/utils/personalExpenses.js';

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

test('zero actual spend is valid and returns the full advance', () => {
  const result = evaluatePersonalAdvanceReconciliation('0', 3000);
  assert.equal(result.isValid, true);
  assert.equal(result.actualSpent, 0);
  assert.equal(result.returnAmount, 3000);
});

test('empty input stays invalid so confirmation is deliberate', () => {
  const result = evaluatePersonalAdvanceReconciliation('', 3000);
  assert.equal(result.isValid, false);
  assert.equal(result.error, 'empty');
});

test('actual spend cannot exceed the advance', () => {
  const result = evaluatePersonalAdvanceReconciliation('3000.01', 3000);
  assert.equal(result.isValid, false);
  assert.equal(result.error, 'exceeds');
});

test('math expressions and comma decimals are accepted', () => {
  const result = evaluatePersonalAdvanceReconciliation('1 000,50 + 499.50', 3000);
  assert.equal(result.isValid, true);
  assert.equal(result.actualSpent, 1500);
  assert.equal(result.returnAmount, 1500);
});

test('negative actual spend is invalid', () => {
  const result = evaluatePersonalAdvanceReconciliation('-1', 3000);
  assert.equal(result.isValid, false);
  assert.equal(result.error, 'negative');
});
