// The currencies offered when a wallet is added: the most used in Algeria first, then the others.
// Any other code (2 to 12 letters or digits) can still be typed.
export type CatalogCurrency = { code: string; ar: string; fr: string; aliases?: string[]; popular: boolean };

export const CURRENCY_CATALOG: CatalogCurrency[] = [
    { code: 'DZD', ar: 'الدينار الجزائري', fr: 'Dinar algérien', aliases: ['DA', 'دج', 'دينار'], popular: true },
    { code: 'EUR', ar: 'اليورو', fr: 'Euro', aliases: ['يورو', 'اورو'], popular: true },
    { code: 'USD', ar: 'الدولار الأمريكي', fr: 'Dollar américain', aliases: ['دولار'], popular: true },
    { code: 'USDT', ar: 'تيثر (دولار رقمي)', fr: 'Tether (dollar numérique)', aliases: ['تيثر'], popular: true },
    { code: 'GBP', ar: 'الجنيه الإسترليني', fr: 'Livre sterling', aliases: ['جنيه'], popular: true },
    { code: 'CNY', ar: 'اليوان الصيني (RMB)', fr: 'Yuan chinois (RMB)', aliases: ['RMB', 'يوان'], popular: true },
    { code: 'CAD', ar: 'الدولار الكندي', fr: 'Dollar canadien', popular: true },
    { code: 'TRY', ar: 'الليرة التركية', fr: 'Livre turque', aliases: ['ليرة'], popular: true },
    { code: 'AED', ar: 'الدرهم الإماراتي', fr: 'Dirham des Émirats', popular: true },
    { code: 'SAR', ar: 'الريال السعودي', fr: 'Riyal saoudien', aliases: ['ريال'], popular: true },
    { code: 'TND', ar: 'الدينار التونسي', fr: 'Dinar tunisien', popular: false },
    { code: 'MAD', ar: 'الدرهم المغربي', fr: 'Dirham marocain', popular: false },
    { code: 'CHF', ar: 'الفرنك السويسري', fr: 'Franc suisse', popular: false },
    { code: 'QAR', ar: 'الريال القطري', fr: 'Riyal qatari', popular: false },
    { code: 'USDC', ar: 'USDC (دولار رقمي)', fr: 'USDC (dollar numérique)', popular: false },
    { code: 'BTC', ar: 'بيتكوين', fr: 'Bitcoin', popular: false },
];

export function currencyLabel(code: string, lang: 'ar' | 'fr'): string {
    const entry = CURRENCY_CATALOG.find((c) => c.code === code);
    return entry ? `${code} · ${entry[lang]}` : code;
}

/** Matches a typed search on the code, the names and the aliases (RMB finds CNY). */
export function searchCurrencies(query: string): CatalogCurrency[] {
    const q = query.trim().toLowerCase();
    if (!q) return CURRENCY_CATALOG;
    return CURRENCY_CATALOG.filter((c) => [c.code, c.ar, c.fr, ...(c.aliases ?? [])].some((text) => text.toLowerCase().includes(q)));
}
