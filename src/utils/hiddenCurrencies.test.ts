import assert from 'node:assert/strict';
import { readHiddenCurrencies, toggledHiddenCurrencies } from './hiddenCurrencies';

assert.deepEqual(readHiddenCurrencies(undefined), [], 'nothing saved: EUR shown, as always');
assert.deepEqual(readHiddenCurrencies('EUR'), [], 'a broken value hides nothing');
assert.deepEqual(readHiddenCurrencies(['EUR', 'USDT', 'XYZ']), ['EUR'], 'only EUR can be hidden: USDT never');
assert.deepEqual(toggledHiddenCurrencies([], 'EUR', true), ['EUR']);
assert.deepEqual(toggledHiddenCurrencies(['EUR'], 'EUR', true), ['EUR'], 'no duplicate');
assert.deepEqual(toggledHiddenCurrencies(['EUR'], 'EUR', false), []);
console.log('hiddenCurrencies: ok');
