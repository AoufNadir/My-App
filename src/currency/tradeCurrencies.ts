// V14-2 / V14-4: the currencies the app buys and sells, in one list. Every screen that offers a currency reads it from
// here, so a new currency is one line more here: it gets everything RMB has (its buy / sell window, its row in
// « New operation », its tiles, its wallet in the inventory and in the wallet pickers, its value in the capital, its
// lines in Analyse and the reports, and hiding from the settings). The dinar is the base: never hidden, never here.
// USDT and EUR keep their historical windows; every other currency is an « extra » currency, handled like RMB.
export const TRADE_CURRENCIES = [
    { code: 'USDT', symbol: '$', name: { fr: 'l’USDT', ar: 'الـ USDT' } },
    { code: 'EUR', symbol: '€', name: { fr: 'l’EUR', ar: 'اليورو' } },
    { code: 'RMB', symbol: '¥', name: { fr: 'le RMB (Alipay)', ar: 'الـ RMB (Alipay)' } },
] as const;
export type TradeCurrencyCode = typeof TRADE_CURRENCIES[number]['code'];
export type TradeCurrencyInfo = { code: TradeCurrencyCode; symbol: string; name: { fr: string; ar: string } };
export type TradeCurrencyKey = Lowercase<TradeCurrencyCode>;
export const TRADE_CURRENCY_CODES: TradeCurrencyCode[] = TRADE_CURRENCIES.map((c) => c.code);
export const tradeCurrency = (code: TradeCurrencyCode): TradeCurrencyInfo => TRADE_CURRENCIES.find((c) => c.code === code)!;
export const currencyKey = (code: TradeCurrencyCode): TradeCurrencyKey => code.toLowerCase() as TradeCurrencyKey;
/** The currencies handled like RMB (everything but the two historical ones). */
export const isExtraCurrency = (code: string): boolean => code !== 'USDT' && code !== 'EUR' && (TRADE_CURRENCY_CODES as string[]).includes(code);
export const EXTRA_TRADE_CURRENCIES: TradeCurrencyInfo[] = TRADE_CURRENCIES.filter((c) => isExtraCurrency(c.code));
export const EXTRA_CURRENCY_CODES: TradeCurrencyCode[] = EXTRA_TRADE_CURRENCIES.map((c) => c.code);
/** Shown on a screen: switched on, or some is still held (money never disappears from view). */
export const currencyVisible = (code: TradeCurrencyCode, hidden: ReadonlyArray<string>, held = 0): boolean => !hidden.includes(code) || held > 0;
/** Any currency of the list (not the dinar wallets). */
export const isTradeCurrency = (code: unknown): code is TradeCurrencyCode => typeof code === 'string' && (TRADE_CURRENCY_CODES as string[]).includes(code);
