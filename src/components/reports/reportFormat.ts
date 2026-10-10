// Numbers and dates on every report sheet. The report has its own language, but numbers are
// always written the French way (1 030 000,50) and read left to right, in Arabic too.

const numberFormats = new Map<string, Intl.NumberFormat>();
function numberFormat(min: number, max: number) {
    const key = `${min}-${max}`;
    if (!numberFormats.has(key))
        numberFormats.set(key, new Intl.NumberFormat('fr-FR', { minimumFractionDigits: min, maximumFractionDigits: max }));
    return numberFormats.get(key)!;
}
const compactFormat = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumSignificantDigits: 3 });
// French groups thousands with a narrow space, too thin to see in small print: a normal no-break
// space keeps 1 030 000 readable on paper and on a phone.
const wideSpaces = (text: string) => text.replace(/\u202F/g, '\u00A0');

/** DZD in cents, whole dinars unless the report shows cents. */
export const formatDzdCents = (cents: number, showCents: boolean) => wideSpaces(numberFormat(showCents ? 2 : 0, showCents ? 2 : 0).format(Math.abs(cents) / 100));
export const formatQuantity = (quantity: number) => wideSpaces(numberFormat(0, 2).format(quantity));
export const formatPrice = (price: number) => wideSpaces(numberFormat(2, 2).format(price));
export const formatEurPrice = (price: number) => wideSpaces(numberFormat(2, 4).format(price));
export const formatEur = (amount: number) => wideSpaces(numberFormat(2, 2).format(amount));
/** An amount with exactly two decimals (12 345,60), what a non-finite value shows as 0,00. */
export const formatAmount = (amount: number) => wideSpaces(numberFormat(2, 2).format(Number.isFinite(amount) ? amount : 0));
/** A whole number of dinars (the treasury report), the old report's formatNumber(value, 0) */
export const formatWholeDzd = (amount: number) => wideSpaces(numberFormat(0, 0).format(Number.isFinite(amount) ? amount : 0));
/** One decimal (12,3), for percentages */
export const formatOneDecimal = (value: number) => wideSpaces(numberFormat(1, 1).format(Number.isFinite(value) ? value : 0));
export const formatCompactDzd = (cents: number) => wideSpaces(compactFormat.format(cents / 100));
export const formatPercent = (pct: number) => `${pct > 0 ? '+' : pct < 0 ? '−' : ''}${Math.abs(pct)}%`;
const pad2 = (value: number) => String(value).padStart(2, '0');
export const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
};
export const formatDayMonth = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}`;
};
/** 24-hour clock: 09:05 */
export const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
};
