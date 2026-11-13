// V14-2: the currencies the app buys and sells, in one list. Every screen that offers a currency reads it from here,
// so a new currency is one line more, and hiding works the same way for each (settings > Devises). The dinar is the
// base: never hidden, never in this list.
export type TradeCurrencyCode = 'USDT' | 'EUR' | 'RMB';
export type TradeCurrencyInfo = {
    code: TradeCurrencyCode;
    /** Short sign on the buttons and tiles */
    symbol: string;
    name: { fr: string; ar: string };
};
export const TRADE_CURRENCIES: readonly TradeCurrencyInfo[] = [
    { code: 'USDT', symbol: '$', name: { fr: 'l’USDT', ar: 'الـ USDT' } },
    { code: 'EUR', symbol: '€', name: { fr: 'l’EUR', ar: 'اليورو' } },
    { code: 'RMB', symbol: '¥', name: { fr: 'le RMB (Alipay)', ar: 'الـ RMB (Alipay)' } },
];
export const TRADE_CURRENCY_CODES: TradeCurrencyCode[] = TRADE_CURRENCIES.map((c) => c.code);
export const tradeCurrency = (code: TradeCurrencyCode): TradeCurrencyInfo => TRADE_CURRENCIES.find((c) => c.code === code)!;
/** Shown on a screen: switched on, or some is still held (money never disappears from view). */
export const currencyVisible = (code: TradeCurrencyCode, hidden: ReadonlyArray<string>, held = 0): boolean => !hidden.includes(code) || held > 0;
