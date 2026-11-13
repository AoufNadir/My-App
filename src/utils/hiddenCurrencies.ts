import { TRADE_CURRENCY_CODES, type TradeCurrencyCode } from '../currency/tradeCurrencies';

// V13-2 / V14-2: a currency hidden in the settings leaves the buy / sell windows, the menus and the portfolio page.
// Nothing is deleted: its past operations, profits and any stock left still count everywhere they did.
// Kept on the user document (`hiddenCurrencies`), so the phone and both computers agree. At least one stays shown.
export type HideableCurrency = TradeCurrencyCode;
export const HIDEABLE_CURRENCIES: HideableCurrency[] = TRADE_CURRENCY_CODES;

export function readHiddenCurrencies(raw: unknown): HideableCurrency[] {
    if (!Array.isArray(raw)) return [];
    const hidden = HIDEABLE_CURRENCIES.filter((code) => raw.includes(code));
    // A document that hides them all (written by hand, or an old bug) shows the first one again.
    return hidden.length === HIDEABLE_CURRENCIES.length ? hidden.slice(1) : hidden;
}

/** False when hiding this one would leave no currency shown. */
export function canHideCurrency(current: ReadonlyArray<HideableCurrency>, code: HideableCurrency): boolean {
    return HIDEABLE_CURRENCIES.some((c) => c !== code && !current.includes(c));
}

export function toggledHiddenCurrencies(current: ReadonlyArray<HideableCurrency>, code: HideableCurrency, hidden: boolean): HideableCurrency[] {
    if (hidden && !canHideCurrency(current, code)) return [...current];
    const next = new Set(current);
    if (hidden) next.add(code);
    else next.delete(code);
    return HIDEABLE_CURRENCIES.filter((c) => next.has(c));
}
