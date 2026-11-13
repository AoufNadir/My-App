import assert from 'node:assert/strict';
import { canHideCurrency, readHiddenCurrencies, toggledHiddenCurrencies } from './hiddenCurrencies';

assert.deepEqual(readHiddenCurrencies(undefined), [], 'nothing saved: EUR shown, as always');
assert.deepEqual(readHiddenCurrencies('EUR'), [], 'a broken value hides nothing');
assert.deepEqual(readHiddenCurrencies(['EUR', 'USDT', 'XYZ']), ['USDT', 'EUR'], 'V14-2: USDT can be hidden too; unknown codes are ignored');
assert.deepEqual(readHiddenCurrencies(['USDT', 'EUR', 'RMB']), ['EUR', 'RMB'], 'all hidden: the first comes back, one always stays shown');
assert.equal(canHideCurrency(['USDT', 'EUR'], 'RMB'), false, 'the last shown cannot be hidden');
assert.deepEqual(toggledHiddenCurrencies(['USDT', 'EUR'], 'RMB', true), ['USDT', 'EUR'], 'refused: nothing changes');
assert.equal(canHideCurrency([], 'USDT'), true);
assert.deepEqual(readHiddenCurrencies(['RMB', 'EUR']), ['EUR', 'RMB']);
assert.deepEqual(toggledHiddenCurrencies(['EUR'], 'RMB', true), ['EUR', 'RMB']);
assert.deepEqual(toggledHiddenCurrencies([], 'EUR', true), ['EUR']);
assert.deepEqual(toggledHiddenCurrencies(['EUR'], 'EUR', true), ['EUR'], 'no duplicate');
assert.deepEqual(toggledHiddenCurrencies(['EUR'], 'EUR', false), []);
console.log('hiddenCurrencies: ok');
