// V14-2 / V14-4: the currencies the app buys and sells, in one list. Every screen that offers a currency reads it from
// here, so a new currency gets everything RMB has (its buy / sell window, its row in « New operation », its tiles, its
// wallet in the inventory and in the wallet pickers, its value in the capital, its lines in Analyse and the reports,
// and hiding from the settings). The dinar is the base: never hidden, never here.
// USDT and EUR keep their historical windows; every other currency is an « extra » currency, handled like RMB.
//
// V15-1 (owner, 2026-11-15): the owner adds currencies from the settings. They are kept on the user document
// (`customCurrencies`) and added after the built-in ones by `setCustomCurrencies`, which updates these lists in place
// (same arrays, same objects), and every list or table derived from them (`liveList`, `liveRecord`, `liveSet`).
export type TradeCurrencyName = { fr: string; ar: string };
export type TradeCurrencyInfo = { code: TradeCurrencyCode; symbol: string; name: TradeCurrencyName; custom?: boolean };
/** A currency code: the built-in ones, or one the owner added (3 to 5 capital letters). */
export type TradeCurrencyCode = 'USDT' | 'EUR' | 'RMB' | (string & {});
export type TradeCurrencyKey = Lowercase<TradeCurrencyCode>;

export const BUILT_IN_CURRENCIES: readonly TradeCurrencyInfo[] = [
    { code: 'USDT', symbol: '$', name: { fr: 'l’USDT', ar: 'الـ USDT' } },
    { code: 'EUR', symbol: '€', name: { fr: 'l’EUR', ar: 'اليورو' } },
    { code: 'RMB', symbol: '¥', name: { fr: 'le RMB (Alipay)', ar: 'الـ RMB (Alipay)' } },
];
export const TRADE_CURRENCIES: TradeCurrencyInfo[] = [...BUILT_IN_CURRENCIES];
export const TRADE_CURRENCY_CODES: TradeCurrencyCode[] = TRADE_CURRENCIES.map((c) => c.code);
export const tradeCurrency = (code: TradeCurrencyCode): TradeCurrencyInfo => TRADE_CURRENCIES.find((c) => c.code === code) ?? { code, symbol: code, name: { fr: code, ar: code } };
export const currencyKey = (code: TradeCurrencyCode): TradeCurrencyKey => code.toLowerCase() as TradeCurrencyKey;
/** The currencies handled like RMB (everything but the two historical ones). */
export const isExtraCurrency = (code: string): boolean => code !== 'USDT' && code !== 'EUR' && (TRADE_CURRENCY_CODES as string[]).includes(code);
export const EXTRA_TRADE_CURRENCIES: TradeCurrencyInfo[] = TRADE_CURRENCIES.filter((c) => isExtraCurrency(c.code));
export const EXTRA_CURRENCY_CODES: TradeCurrencyCode[] = EXTRA_TRADE_CURRENCIES.map((c) => c.code);
/** Shown on a screen: switched on, or some is still held (money never disappears from view). */
export const currencyVisible = (code: TradeCurrencyCode, hidden: ReadonlyArray<string>, held = 0): boolean => !hidden.includes(code) || held > 0;
/** Any currency of the list (not the dinar wallets). */
export const isTradeCurrency = (code: unknown): code is TradeCurrencyCode => typeof code === 'string' && (TRADE_CURRENCY_CODES as string[]).includes(code);

// ---- Lists derived from the registry, kept up to date when the owner adds a currency ----
const refreshers: Array<() => void> = [];
/** An array built from the registry; the same array is refilled when the list of currencies changes. */
export function liveList<T>(build: () => T[]): T[] {
    const list: T[] = [];
    const refresh = () => { list.splice(0, list.length, ...build()); };
    refresh();
    refreshers.push(refresh);
    return list;
}
/** A table built from the registry, refilled in place. */
export function liveRecord<V>(build: () => Record<string, V>): Record<string, V> {
    const record: Record<string, V> = {};
    const refresh = () => { for (const key of Object.keys(record)) delete record[key]; Object.assign(record, build()); };
    refresh();
    refreshers.push(refresh);
    return record;
}
/** A set built from the registry, refilled in place. */
export function liveSet<T>(build: () => Iterable<T>): Set<T> {
    const set = new Set<T>();
    const refresh = () => { set.clear(); for (const value of build()) set.add(value); };
    refresh();
    refreshers.push(refresh);
    return set;
}

// ---- Currencies added by the owner ----
export const RESERVED_CODES = ['DZD', 'DA'];
export type CustomCurrencyCheck = { ok: true; currency: TradeCurrencyInfo } | { ok: false; reason: 'code' | 'taken' | 'symbol' | 'name' };
/** A currency the owner types in the settings: a code of 3 to 5 capital letters not used yet, a symbol, both names. */
export function checkCustomCurrency(input: { code: string; symbol: string; nameFr: string; nameAr: string }, existing: readonly TradeCurrencyInfo[] = TRADE_CURRENCIES): CustomCurrencyCheck {
    const code = input.code.trim().toUpperCase();
    if (!/^[A-Z]{3,5}$/.test(code)) return { ok: false, reason: 'code' };
    if (RESERVED_CODES.includes(code) || existing.some((c) => c.code === code)) return { ok: false, reason: 'taken' };
    const symbol = input.symbol.trim();
    if (symbol.length < 1 || symbol.length > 4) return { ok: false, reason: 'symbol' };
    const fr = input.nameFr.trim();
    const ar = input.nameAr.trim();
    if (fr.length < 2 || ar.length < 2) return { ok: false, reason: 'name' };
    return { ok: true, currency: { code, symbol, name: { fr, ar }, custom: true } };
}
/** What the user document holds, read safely: anything malformed is left out. */
export function readCustomCurrencies(raw: unknown): TradeCurrencyInfo[] {
    if (!Array.isArray(raw)) return [];
    const out: TradeCurrencyInfo[] = [];
    for (const item of raw) {
        const value = item as { code?: unknown; symbol?: unknown; name?: { fr?: unknown; ar?: unknown } };
        const check = checkCustomCurrency({ code: String(value?.code ?? ''), symbol: String(value?.symbol ?? ''), nameFr: String(value?.name?.fr ?? ''), nameAr: String(value?.name?.ar ?? '') }, [...BUILT_IN_CURRENCIES, ...out]);
        if (check.ok) out.push(check.currency);
    }
    return out;
}
let customSignature = '';
/** Puts the owner's currencies after the built-in ones, in every list. Returns true when something changed. */
export function setCustomCurrencies(custom: readonly TradeCurrencyInfo[]): boolean {
    const signature = JSON.stringify(custom.map((c) => [c.code, c.symbol, c.name.fr, c.name.ar]));
    if (signature === customSignature) return false;
    customSignature = signature;
    TRADE_CURRENCIES.splice(0, TRADE_CURRENCIES.length, ...BUILT_IN_CURRENCIES, ...custom.filter((c) => !BUILT_IN_CURRENCIES.some((b) => b.code === c.code)));
    TRADE_CURRENCY_CODES.splice(0, TRADE_CURRENCY_CODES.length, ...TRADE_CURRENCIES.map((c) => c.code));
    EXTRA_TRADE_CURRENCIES.splice(0, EXTRA_TRADE_CURRENCIES.length, ...TRADE_CURRENCIES.filter((c) => isExtraCurrency(c.code)));
    EXTRA_CURRENCY_CODES.splice(0, EXTRA_CURRENCY_CODES.length, ...EXTRA_TRADE_CURRENCIES.map((c) => c.code));
    refreshLiveLists();
    return true;
}
/** Refills every derived list (used by the dinar accounts' registry too). */
export function refreshLiveLists(): void {
    for (const refresh of refreshers) refresh();
}
