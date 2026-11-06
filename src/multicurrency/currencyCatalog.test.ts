import assert from 'node:assert/strict';
import { CURRENCY_CATALOG, currencyLabel, searchCurrencies } from './currencyCatalog';

assert.deepEqual(searchCurrencies('rmb').map((c) => c.code), ['CNY'], 'RMB finds the yuan');
assert.ok(searchCurrencies('يورو').some((c) => c.code === 'EUR'));
assert.ok(searchCurrencies('usd').some((c) => c.code === 'USDT') && searchCurrencies('usd').some((c) => c.code === 'USD'));
assert.equal(currencyLabel('CNY', 'ar'), 'CNY · اليوان الصيني (RMB)');
assert.equal(currencyLabel('XYZ', 'fr'), 'XYZ', 'a typed code shows as is');
assert.equal(new Set(CURRENCY_CATALOG.map((c) => c.code)).size, CURRENCY_CATALOG.length, 'no duplicate');
assert.deepEqual(CURRENCY_CATALOG.filter((c) => c.popular).map((c) => c.code), ['DZD', 'EUR', 'USD', 'USDT', 'GBP', 'CNY', 'CAD', 'TRY', 'AED', 'SAR']);
console.log('currencyCatalog: ok');
