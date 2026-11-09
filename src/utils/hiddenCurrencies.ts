// V13-2: a currency hidden in the settings (EUR for now) leaves the buy / sell windows and the portfolio page.
// Nothing is deleted: its past operations, profits and any stock left still count everywhere they did.
// Kept on the user document (`hiddenCurrencies`), so the phone and both computers agree.
export type HideableCurrency = 'EUR';
export const HIDEABLE_CURRENCIES: HideableCurrency[] = ['EUR'];

export function readHiddenCurrencies(raw: unknown): HideableCurrency[] {
    if (!Array.isArray(raw)) return [];
    return HIDEABLE_CURRENCIES.filter((code) => raw.includes(code));
}

export function toggledHiddenCurrencies(current: ReadonlyArray<HideableCurrency>, code: HideableCurrency, hidden: boolean): HideableCurrency[] {
    const next = new Set(current);
    if (hidden) next.add(code);
    else next.delete(code);
    return HIDEABLE_CURRENCIES.filter((c) => next.has(c));
}
