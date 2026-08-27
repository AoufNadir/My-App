export const FR_LOCALE = 'fr-FR';
type DecimalOptions = {
    min?: number;
    max?: number;
};
export function formatNumber(value: number, options?: DecimalOptions): string {
    const min = options?.min ?? 2;
    const max = options?.max ?? min;
    const epsilon = 0.5 * Math.pow(10, -max);
    const safeValue = Number.isFinite(value) ? value : 0;
    const normalizedValue = (Object.is(safeValue, -0) || Math.abs(safeValue) < epsilon) ? 0 : safeValue;
    return normalizedValue.toLocaleString(FR_LOCALE, {
        minimumFractionDigits: min,
        maximumFractionDigits: max
    });
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
export function getRelativeFrDateLabel(dateString: string): string {
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
    if (txDate.toDateString() === today.toDateString())
        return "Aujourd'hui";
    if (txDate.toDateString() === yesterday.toDateString())
        return 'Hier';
    return dateString;
}
