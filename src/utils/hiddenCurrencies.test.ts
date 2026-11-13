import assert from 'node:assert/strict';
import { HIDEABLE_CURRENCIES, canHideCurrency, readHiddenCurrencies, toggledHiddenCurrencies } from './hiddenCurrencies';

assert.deepEqual(readHiddenCurrencies(undefined), [], 'nothing saved: EUR shown, as always');
assert.deepEqual(readHiddenCurrencies('EUR'), [], 'a broken value hides nothing');
assert.deepEqual(readHiddenCurrencies(['EUR', 'USDT', 'XYZ']), ['USDT', 'EUR'], 'V14-2: USDT can be hidden too; unknown codes are ignored');
assert.deepEqual(readHiddenCurrencies([...HIDEABLE_CURRENCIES]), HIDEABLE_CURRENCIES.slice(1), 'all hidden: the first comes back, one always stays shown');
{
    const allButLast = HIDEABLE_CURRENCIES.slice(0, -1);
    const last = HIDEABLE_CURRENCIES[HIDEABLE_CURRENCIES.length - 1];
    assert.equal(canHideCurrency(allButLast, last), false, 'the last shown cannot be hidden');
    assert.deepEqual(toggledHiddenCurrencies(allButLast, last, true), allButLast, 'refused: nothing changes');
}
assert.equal(canHideCurrency([], 'USDT'), true);
assert.deepEqual(readHiddenCurrencies(['RMB', 'EUR']), ['EUR', 'RMB']);
assert.deepEqual(toggledHiddenCurrencies(['EUR'], 'RMB', true), ['EUR', 'RMB']);
assert.deepEqual(toggledHiddenCurrencies([], 'EUR', true), ['EUR']);
assert.deepEqual(toggledHiddenCurrencies(['EUR'], 'EUR', true), ['EUR'], 'no duplicate');
assert.deepEqual(toggledHiddenCurrencies(['EUR'], 'EUR', false), []);
console.log('hiddenCurrencies: ok');
