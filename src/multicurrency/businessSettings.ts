import { normalizeCurrencyCode } from '../currency/registry';

// M2: the settings of a business (base currency, currencies traded, accounts of the base currency, report identity).
// Stored on the user document under `business` and in the `accounts` sub-collection. A user without them is read
// as the app has always worked: base DZD, USDT and EUR, the cash box and BaridiMob. Nothing here touches a balance:
// an account's opening balance is a treasury movement (M3), so it leaves a trace that can be reviewed.

export type AccountKind = 'cash' | 'bank' | 'online';
export type BusinessAccount = { id: string; name: string; kind: AccountKind; archived?: boolean };
export type BusinessSettings = {
    baseCurrency: string;
    /** Currencies bought and sold (never the base one) */
    currencies: string[];
    businessName: string;
    /** Small image as a data URL (under LOGO_MAX_BYTES), shown on reports */
    logo: string | null;
    setupDone: boolean;
};

export const LOGO_MAX_BYTES = 100_000;
export const BASE_CURRENCY_CHOICES = ['DZD', 'EUR', 'USD'] as const;
export const TRADED_CURRENCY_CHOICES = ['USDT', 'EUR', 'USD', 'GBP', 'CNY'] as const;
/** The two accounts the app has always had: their balances come from the treasury movements already written. */
export const LEGACY_ACCOUNTS: BusinessAccount[] = [
    { id: 'Caisse', name: 'Caisse', kind: 'cash' },
    { id: 'BaridiMob', name: 'BaridiMob', kind: 'bank' },
];
export const LEGACY_SETTINGS: BusinessSettings = { baseCurrency: 'DZD', currencies: ['USDT', 'EUR'], businessName: '', logo: null, setupDone: true };

const safeCode = (value: unknown): string | null => {
    try {
        return normalizeCurrencyCode(value);
    }
    catch {
        return null;
    }
};

/** Reads `business` from the user document; anything missing or broken falls back to the legacy settings. */
export function readBusinessSettings(raw: unknown): BusinessSettings {
    if (!raw || typeof raw !== 'object')
        return LEGACY_SETTINGS;
    const data = raw as Record<string, unknown>;
    const baseCurrency = safeCode(data.baseCurrency) ?? LEGACY_SETTINGS.baseCurrency;
    const listed = Array.isArray(data.currencies) ? data.currencies.map(safeCode).filter((code): code is string => !!code) : [];
    const currencies = [...new Set(listed)].filter((code) => code !== baseCurrency);
    const logo = typeof data.logo === 'string' && data.logo.startsWith('data:image/') && data.logo.length <= LOGO_MAX_BYTES * 1.4 ? data.logo : null;
    return {
        baseCurrency,
        currencies: currencies.length ? currencies : LEGACY_SETTINGS.currencies.filter((code) => code !== baseCurrency),
        businessName: typeof data.businessName === 'string' ? data.businessName.trim().slice(0, 60) : '',
        logo,
        setupDone: data.setupDone !== false,
    };
}

export function readAccounts(docs: ReadonlyArray<{ id: string; data: Record<string, unknown> }>): BusinessAccount[] {
    return docs
        .map(({ id, data }) => ({
            id,
            name: typeof data.name === 'string' ? data.name.trim().slice(0, 40) : '',
            kind: (['cash', 'bank', 'online'] as const).find((kind) => kind === data.kind) ?? 'cash',
            archived: data.archived === true,
        }))
        .filter((account) => account.name);
}

/** The accounts to use: the ones created, or the cash box and BaridiMob for a business made before M2. */
export function effectiveAccounts(created: BusinessAccount[]): BusinessAccount[] {
    return created.length ? created.filter((account) => !account.archived) : LEGACY_ACCOUNTS;
}

/** The first-time setup is offered only to a business with nothing recorded and no settings saved yet. */
export function needsSetup(input: { businessRaw: unknown; hasAnyData: boolean }): boolean {
    if (input.hasAnyData)
        return false;
    return !input.businessRaw || (input.businessRaw as Record<string, unknown>).setupDone !== true;
}

export type SetupDraft = { baseCurrency: string; currencies: string[]; accounts: Array<{ name: string; kind: AccountKind }>; businessName: string; logo: string | null };
export type SetupCheck = { ok: true } | { ok: false; reason: 'no_currency' | 'no_account' | 'logo_too_big' | 'bad_currency' };

export function checkSetup(draft: SetupDraft): SetupCheck {
    if (!safeCode(draft.baseCurrency) || draft.currencies.some((code) => !safeCode(code)))
        return { ok: false, reason: 'bad_currency' };
    if (!draft.currencies.filter((code) => code !== draft.baseCurrency).length)
        return { ok: false, reason: 'no_currency' };
    if (!draft.accounts.some((account) => account.name.trim()))
        return { ok: false, reason: 'no_account' };
    if (draft.logo && draft.logo.length > LOGO_MAX_BYTES * 1.4)
        return { ok: false, reason: 'logo_too_big' };
    return { ok: true };
}

/** The documents the setup writes: the `business` field of the user document and one document per account. */
export function setupDocuments(draft: SetupDraft): { business: BusinessSettings; accounts: Array<{ name: string; kind: AccountKind; archived: false }> } {
    const baseCurrency = normalizeCurrencyCode(draft.baseCurrency);
    return {
        business: {
            baseCurrency,
            currencies: [...new Set(draft.currencies.map((code) => normalizeCurrencyCode(code)))].filter((code) => code !== baseCurrency),
            businessName: draft.businessName.trim().slice(0, 60),
            logo: draft.logo,
            setupDone: true,
        },
        accounts: draft.accounts.filter((account) => account.name.trim()).map((account) => ({ name: account.name.trim().slice(0, 40), kind: account.kind, archived: false as const })),
    };
}
