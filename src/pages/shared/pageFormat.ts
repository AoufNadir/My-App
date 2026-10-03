export const FR_LOCALE = 'fr-FR';
type DecimalOptions = {
    min?: number;
    max?: number;
};
// `n.toLocaleString(FR_LOCALE, options)` builds a new Intl.NumberFormat on every call, which is
// the expensive part. Keep one formatter per (min, max) pair instead: format() on it returns the
// same string. The formatter is built before anything is stored, so a pair the constructor rejects
// (e.g. max < min) throws the same RangeError as toLocaleString on every call and is never cached.
const frNumberFormats = new Map<number, Map<number, Intl.NumberFormat>>();
function getFrNumberFormat(min: number, max: number): Intl.NumberFormat {
    let formatter = frNumberFormats.get(min)?.get(max);
    if (!formatter) {
        formatter = new Intl.NumberFormat(FR_LOCALE, {
            minimumFractionDigits: min,
            maximumFractionDigits: max
        });
        let byMax = frNumberFormats.get(min);
        if (!byMax) {
            byMax = new Map();
            frNumberFormats.set(min, byMax);
        }
        byMax.set(max, formatter);
    }
    return formatter;
}
export function formatNumber(value: number, options?: DecimalOptions): string {
    const min = options?.min ?? 2;
    const max = options?.max ?? min;
    const epsilon = 0.5 * Math.pow(10, -max);
    const safeValue = Number.isFinite(value) ? value : 0;
    const normalizedValue = (Object.is(safeValue, -0) || Math.abs(safeValue) < epsilon) ? 0 : safeValue;
    if (typeof min !== 'number' || typeof max !== 'number') {
        // Only reachable from untyped callers: keep the original uncached call.
        return normalizedValue.toLocaleString(FR_LOCALE, {
            minimumFractionDigits: min,
            maximumFractionDigits: max
        });
    }
    return getFrNumberFormat(min, max).format(normalizedValue);
}
export function formatDzd(value: number, options?: DecimalOptions): string {
    return `${formatNumber(value, options)} DZD`;
}
export type MoneyCurrency = 'DZD' | 'EUR' | 'USDT' | 'USD';
type MoneyOptions = DecimalOptions & {
    showSign?: boolean;
};
/**
 * Unified money formatter. Use this for any user-facing monetary display.
 * - Pass a currency to append its symbol (e.g. "1 234,56 DZD").
 * - Pass `showSign: true` to prefix positive values with "+".
 * - For currency-less raw numbers, prefer `formatNumber` instead.
 */
export function formatMoney(value: number, currency?: MoneyCurrency | null, options: MoneyOptions = {}): string {
    const { showSign = false, ...numberOptions } = options;
    const safe = Number.isFinite(value) ? value : 0;
    const sign = showSign && safe > 0 ? '+' : '';
    const formatted = formatNumber(safe, numberOptions);
    return currency ? `${sign}${formatted} ${currency}` : `${sign}${formatted}`;
}
/** « Aujourd'hui » / « Hier » for the last two days; with `t`, in the reader's language. */
export function getRelativeFrDateLabel(dateString: string, t?: (key: string) => unknown): string {
    const parts = dateString.split('/');
    if (parts.length !== 3)
        return dateString;
    const day = Number(parts[0]);
    const month = Number(parts[1]) - 1;
    const year = Number(parts[2]);
    if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) {
        return dateString;
    }
    const txDate = new Date(year, month, day);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const label = (key: string, fallback: string) => {
        const value = t ? t(key) : undefined;
        return typeof value === 'string' && value !== key ? value : fallback;
    };
    if (txDate.toDateString() === today.toDateString())
        return label('transactions.today', "Aujourd'hui");
    if (txDate.toDateString() === yesterday.toDateString())
        return label('transactions.yesterday', 'Hier');
    return dateString;
}
/** « 3 octobre 2026 » ; in Arabic the app's month names (جانفي…) with Latin digits. */
export function formatLongDate(date: Date, lang: 'fr' | 'ar', t: (key: string) => unknown): string {
    const months = t('common.months');
    if (lang === 'ar' && Array.isArray(months) && typeof months[date.getMonth()] === 'string')
        return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
    return date.toLocaleDateString(FR_LOCALE, { day: 'numeric', month: 'long', year: 'numeric' });
}
