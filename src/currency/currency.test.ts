import assert from 'node:assert/strict';

import {
    CurrencyValidationError,
    DEFAULT_CURRENCY_REGISTRY,
    createCurrencyRegistry,
    fromQuantityAtoms,
    getCurrencyDefinition,
    normalizeCurrencyCode,
    resolveBaseCurrency,
    toQuantityAtoms,
    validateCurrencyCode,
} from './index';

assert.equal(normalizeCurrencyCode(' usd '), 'USD');
assert.equal(normalizeCurrencyCode('gbp'), 'GBP');
assert.equal(validateCurrencyCode('CNY'), 'CNY');

assert.throws(
    () => validateCurrencyCode('XYZ'),
    (error: unknown) => error instanceof CurrencyValidationError
        && error.reason === 'unknown_code'
        && /Unknown currency code "XYZ"/.test(error.message),
    'A syntactically valid but unregistered code must be rejected clearly.',
);
assert.throws(
    () => validateCurrencyCode('usd!'),
    (error: unknown) => error instanceof CurrencyValidationError && error.reason === 'invalid_format',
    'An invalid code must be rejected before registry lookup.',
);

assert.equal(resolveBaseCurrency(), 'DZD');
assert.equal(resolveBaseCurrency(undefined), 'DZD');
assert.equal(resolveBaseCurrency('GBP'), 'GBP');

const dzd = getCurrencyDefinition('DZD');
assert.deepEqual(
    {
        code: dzd.code,
        name: dzd.name,
        symbol: dzd.symbol,
        decimals: dzd.decimals,
        quantityDecimals: dzd.quantityDecimals,
        type: dzd.type,
        activeByDefault: dzd.activeByDefault,
    },
    {
        code: 'DZD',
        name: 'Algerian Dinar',
        symbol: 'دج',
        decimals: 2,
        quantityDecimals: 2,
        type: 'fiat',
        activeByDefault: true,
    },
);

const usdt = getCurrencyDefinition('USDT');
assert.equal(usdt.quantityDecimals, 8, 'USDT inventory precision must preserve 1e-8 quantities.');
const usdtAtoms = toQuantityAtoms(1.23456789, usdt);
assert.equal(usdtAtoms, 123_456_789);
assert.equal(fromQuantityAtoms(usdtAtoms, usdt), 1.23456789);

assert.throws(
    () => createCurrencyRegistry([
        { code: 'USD', name: 'Dollar', symbol: '$', decimals: 2, quantityDecimals: 2, type: 'fiat', activeByDefault: false },
        { code: ' usd ', name: 'Duplicate Dollar', symbol: '$', decimals: 2, quantityDecimals: 2, type: 'fiat', activeByDefault: false },
    ]),
    /Duplicate currency code "USD"/,
    'Registry duplicate detection must happen after normalization.',
);

const codes = DEFAULT_CURRENCY_REGISTRY.definitions.map((definition) => definition.code);
assert.equal(new Set(codes).size, codes.length, 'Default registry must not contain duplicate codes.');
assert.deepEqual(
    DEFAULT_CURRENCY_REGISTRY.activeByDefault().map((definition) => definition.code),
    ['DZD', 'USDT', 'EUR'],
    'Default active currencies must match the current Legacy workspace.',
);

console.log('currency registry and domain foundation tests passed');
