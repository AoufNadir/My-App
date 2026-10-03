import assert from 'node:assert/strict';

import { formatDzd, formatLongDate, formatMoney, formatNumber, getRelativeFrDateLabel } from './pageFormat';
import { translations } from '../../translations';
import type { MoneyCurrency } from './pageFormat';

type Options = { min?: number; max?: number };

// Reference: formatNumber before the formatter cache (a new toLocaleString formatter per call).
function referenceFormatNumber(value: number, options?: Options): string {
    const min = options?.min ?? 2;
    const max = options?.max ?? min;
    const epsilon = 0.5 * Math.pow(10, -max);
    const safeValue = Number.isFinite(value) ? value : 0;
    const normalizedValue = (Object.is(safeValue, -0) || Math.abs(safeValue) < epsilon) ? 0 : safeValue;
    return normalizedValue.toLocaleString('fr-FR', {
        minimumFractionDigits: min,
        maximumFractionDigits: max
    });
}

function referenceFormatMoney(value: number, currency?: MoneyCurrency | null, options: Options & { showSign?: boolean } = {}): string {
    const { showSign = false, ...numberOptions } = options;
    const safe = Number.isFinite(value) ? value : 0;
    const sign = showSign && safe > 0 ? '+' : '';
    const formatted = referenceFormatNumber(safe, numberOptions);
    return currency ? `${sign}${formatted} ${currency}` : `${sign}${formatted}`;
}

type Outcome = { value: string } | { errorType: unknown; message: string };

function outcome(run: () => string): Outcome {
    try {
        return { value: run() };
    }
    catch (error) {
        return { errorType: (error as Error).constructor, message: (error as Error).message };
    }
}

function mulberry32(seed: number) {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// The next representable double above (+1) or below (-1) a positive finite number.
function adjacentDouble(value: number, direction: 1 | -1): number {
    const view = new DataView(new ArrayBuffer(8));
    view.setFloat64(0, value);
    view.setBigUint64(0, view.getBigUint64(0) + BigInt(direction));
    return view.getFloat64(0);
}

const values: number[] = [
    0, -0, NaN, Infinity, -Infinity,
    Number.MIN_VALUE, -Number.MIN_VALUE, Number.EPSILON, -Number.EPSILON,
    Number.MAX_VALUE, -Number.MAX_VALUE, Number.MAX_SAFE_INTEGER, -Number.MAX_SAFE_INTEGER,
    1e21, -1e21, 1e300, -1e300, 1e-7, -1e-7, 1e-300,
    0.5, 1.5, 2.5, -0.5, -2.5, 10.5, 11.5, 0.125, 0.375,
    0.005, 0.015, 0.025, 0.035, 0.045, 0.055, 1.005, 1.015, 1.255, 2.675, 1234.565,
    -0.005, -0.015, -1.005, -2.675, -1234.565,
    0.1 + 0.2, 100.01 - 100, 99.995, 999.999, 1234.5, 38832.6, 1234567.891, 250000.75, -250000.75,
    1000000, -1000000, 12345678.9, 0.00049, 0.0005, 0.00051, 0.4999, 0.5001,
];
// Values on and around the "tiny value" cut-off 0.5 * 10^-max for every max used below.
for (const max of [0, 1, 2, 3, 4, 6, 8, 20]) {
    const epsilon = 0.5 * Math.pow(10, -max);
    for (const value of [epsilon, adjacentDouble(epsilon, 1), adjacentDouble(epsilon, -1), epsilon * 0.99, epsilon * 1.01]) {
        values.push(value, -value);
    }
}
const random = mulberry32(0x5eed2026);
for (let index = 0; index < 500; index += 1) {
    const sign = random() < 0.5 ? -1 : 1;
    const magnitude = Math.pow(10, -9 + random() * 25);
    const value = sign * magnitude;
    values.push(value, Math.round(value * 100) / 100, Math.round(value));
}

const validOptions: (Options | undefined)[] = [
    undefined,
    {},
    // Pairs used by the app.
    { min: 2, max: 2 }, { min: 0, max: 2 }, { min: 0, max: 0 }, { min: 1, max: 1 }, { min: 2, max: 4 },
    // Defaults and other valid pairs.
    { min: 0 }, { min: 1 }, { min: 3 }, { max: 2 }, { max: 3 }, { max: 6 },
    { min: 0, max: 1 }, { min: 0, max: 3 }, { min: 0, max: 4 }, { min: 0, max: 8 }, { min: 1, max: 2 },
    { min: 3, max: 3 }, { min: 4, max: 4 }, { min: 2, max: 20 }, { min: 0, max: 100 }, { min: 100, max: 100 },
    { min: 2.5, max: 2.5 }, { min: 0.9, max: 2.1 }, { min: -0, max: -0 }, { min: -0, max: 0 }, { min: 0, max: -0 },
    { min: undefined, max: undefined }, { min: 0, max: undefined },
    // Untyped callers.
    { min: null as unknown as number, max: null as unknown as number },
    { min: '2' as unknown as number },
    { min: 0, max: '4' as unknown as number },
];

let compared = 0;
for (const value of values) {
    for (const options of validOptions) {
        const expected = referenceFormatNumber(value, options);
        assert.equal(formatNumber(value, options), expected, `formatNumber(${value}, ${JSON.stringify(options)})`);
        compared += 1;
    }
}

// A pair the Intl constructor rejects throws the same error as before, on every call, and does not
// affect valid pairs afterwards.
const invalidOptions: Options[] = [
    { max: 0 }, { max: 1 }, { min: 3, max: 1 }, { min: 2, max: 0 }, { min: 100, max: 99 },
    { min: -1 }, { min: -1, max: 2 }, { min: 0, max: 101 }, { min: 101 },
    { min: NaN }, { min: 0, max: NaN }, { min: NaN, max: 2 }, { min: Infinity }, { min: 0, max: Infinity },
    { min: 'x' as unknown as number },
];
for (const options of invalidOptions) {
    for (const value of [0, 1.23456, -1234.5, NaN]) {
        const expected = outcome(() => referenceFormatNumber(value, options));
        assert.ok('errorType' in expected, `reference should throw for ${JSON.stringify(options)}`);
        assert.deepEqual(outcome(() => formatNumber(value, options)), expected);
        assert.deepEqual(outcome(() => formatNumber(value, options)), expected, 'a failed pair must not be cached');
    }
}
assert.throws(() => formatNumber(1, { min: 3, max: 1 }), RangeError);
assert.equal(formatNumber(1, { min: 3, max: 3 }), referenceFormatNumber(1, { min: 3, max: 3 }));
assert.equal(formatNumber(1, { min: 1, max: 1 }), referenceFormatNumber(1, { min: 1, max: 1 }));

// Fixed expectations (whitespace normalized so they do not depend on the ICU group separator).
const spaced = (text: string) => text.replace(/\s/g, ' ');
assert.equal(formatNumber(-0), '0,00');
assert.equal(formatNumber(NaN), '0,00');
assert.equal(formatNumber(-0.004, { min: 0, max: 2 }), '0');
assert.equal(formatNumber(-0.005, { min: 0, max: 2 }), '-0,01');
assert.equal(spaced(formatNumber(1234567.891, { min: 0, max: 2 })), '1 234 567,89');
assert.equal(spaced(formatNumber(1.23456, { min: 2, max: 4 })), '1,2346');
assert.equal(spaced(formatDzd(1234.5)), '1 234,50 DZD');
assert.equal(spaced(formatDzd(-1234567.891, { min: 0, max: 2 })), '-1 234 567,89 DZD');
assert.equal(spaced(formatDzd(-0.004)), '0,00 DZD');
assert.equal(spaced(formatDzd(Infinity)), '0,00 DZD');
assert.equal(spaced(formatMoney(1234.5, 'EUR', { showSign: true })), '+1 234,50 EUR');
assert.equal(spaced(formatMoney(-1234.5, 'USDT', { showSign: true })), '-1 234,50 USDT');
assert.equal(spaced(formatMoney(5, null, { min: 0, max: 2 })), '5');
assert.equal(spaced(formatMoney(NaN, 'DZD', { showSign: true })), '0,00 DZD');

// formatDzd / formatMoney against the same compositions built on the reference formatter.
const currencies: (MoneyCurrency | null | undefined)[] = ['DZD', 'EUR', 'USDT', 'USD', null, undefined];
for (const value of values.slice(0, 400)) {
    for (const options of [undefined, { min: 2, max: 2 }, { min: 0, max: 2 }, { min: 0, max: 0 }]) {
        assert.equal(formatDzd(value, options), `${referenceFormatNumber(value, options)} DZD`);
    }
    for (const currency of currencies) {
        for (const options of [undefined, { showSign: true }, { showSign: true, min: 0, max: 2 }, { min: 1, max: 1 }]) {
            assert.equal(formatMoney(value, currency, options), referenceFormatMoney(value, currency, options));
        }
    }
}

// A date written out: French as before; Arabic with the app's month names and Latin digits.
const tIn = (lang: 'fr' | 'ar') => (key: string): unknown => key.split('.').reduce<any>((node, part) => node?.[part], translations[lang]) ?? key;
assert.equal(formatLongDate(new Date(2026, 9, 3), 'fr', tIn('fr')), new Date(2026, 9, 3).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }));
assert.equal(formatLongDate(new Date(2026, 9, 3), 'ar', tIn('ar')), '3 أكتوبر 2026');
assert.equal(formatLongDate(new Date(2026, 0, 15), 'ar', tIn('ar')), '15 جانفي 2026');
assert.equal(formatLongDate(new Date(2026, 6, 5), 'ar', tIn('ar')), '5 جويلية 2026');
// « Aujourd'hui » / « Hier » in the reader's language; other days keep their date.
{
    const day = (offset: number) => { const d = new Date(); d.setDate(d.getDate() - offset); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`; };
    assert.equal(getRelativeFrDateLabel(day(0)), "Aujourd'hui");
    assert.equal(getRelativeFrDateLabel(day(1), tIn('ar')), translations.ar.transactions.yesterday);
    assert.equal(getRelativeFrDateLabel(day(0), tIn('ar')), translations.ar.transactions.today);
    assert.equal(getRelativeFrDateLabel(day(5), tIn('ar')), day(5));
}

console.log(`pageFormat tests passed (${compared} formatNumber comparisons)`);
