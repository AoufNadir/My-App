// V15-2 (owner, 2026-11-15): the places that hold dinars. The Caisse and BaridiMob stay as they always were (their
// saved rows say `source: 'Caisse' | 'BaridiMob'`, nothing is rewritten); the owner adds others from the settings: a
// bank account, CCP, another e-wallet, a second cash box. An added account is saved on the user document
// (`customAccounts`) with an id that never changes, and its movements carry that id as their `source`.
import { liveList, refreshLiveLists } from '../currency/tradeCurrencies';

export type CashAccountKind = 'cash' | 'bank' | 'mobile';
export type CashAccount = { id: string; name: string; kind: CashAccountKind; custom?: boolean };
export const BUILT_IN_ACCOUNTS: readonly CashAccount[] = [
    { id: 'Caisse', name: 'Caisse', kind: 'cash' },
    { id: 'BaridiMob', name: 'BaridiMob', kind: 'mobile' },
];
/** Every dinar account: the two built-in ones, then the owner's, in the order added. Refilled in place. */
export const CASH_ACCOUNTS: CashAccount[] = [...BUILT_IN_ACCOUNTS];
export const CASH_ACCOUNT_IDS: string[] = liveList(() => CASH_ACCOUNTS.map((a) => a.id));
export const CUSTOM_CASH_ACCOUNTS: CashAccount[] = liveList(() => CASH_ACCOUNTS.filter((a) => a.custom));
// V15-4 (owner): an account the owner does not use is hidden from the choices (payment cards, wallet lists,
// transfers, home tiles, inventory). It stays in CASH_ACCOUNTS so every balance and the capital still count it; the
// settings only allow hiding an account whose balance is 0. Saved on the user document (`hiddenAccounts`).
const HIDDEN_ACCOUNTS = new Set<string>();
export const isAccountShown = (id: string): boolean => !HIDDEN_ACCOUNTS.has(id);
export const SHOWN_CASH_ACCOUNTS: CashAccount[] = liveList(() => CASH_ACCOUNTS.filter((a) => !HIDDEN_ACCOUNTS.has(a.id)));
export const SHOWN_CASH_ACCOUNT_IDS: string[] = liveList(() => SHOWN_CASH_ACCOUNTS.map((a) => a.id));
export const SHOWN_CUSTOM_CASH_ACCOUNTS: CashAccount[] = liveList(() => SHOWN_CASH_ACCOUNTS.filter((a) => a.custom));
export function readHiddenAccounts(raw: unknown): string[] {
    return Array.isArray(raw) ? [...new Set(raw.filter((v): v is string => typeof v === 'string' && (v === 'Caisse' || v === 'BaridiMob' || /^acc_[a-z0-9]+$/.test(v))))].sort() : [];
}
let hiddenSignature = '';
/** True when the hidden list changed. Never hides every account: with all hidden, all are shown. */
export function setHiddenAccounts(ids: readonly string[]): boolean {
    const next = ids.join();
    if (next === hiddenSignature) return false;
    hiddenSignature = next;
    HIDDEN_ACCOUNTS.clear();
    ids.forEach((id) => HIDDEN_ACCOUNTS.add(id));
    if (CASH_ACCOUNTS.every((a) => HIDDEN_ACCOUNTS.has(a.id))) HIDDEN_ACCOUNTS.clear();
    refreshLiveLists();
    return true;
}
/** What the settings allow for one account: hide only with a 0 balance and another account shown; delete only an
 * added account that no movement ever used. */
export function accountActions(id: string, usage: { balance: number; used: boolean }, hidden: readonly string[]): { canHide: boolean; canDelete: boolean } {
    const shownOthers = CASH_ACCOUNTS.filter((a) => a.id !== id && !hidden.includes(a.id)).length;
    return {
        canHide: Math.abs(usage.balance) < 0.005 && shownOthers > 0,
        canDelete: id.startsWith('acc_') && !usage.used && Math.abs(usage.balance) < 0.005,
    };
}
export const isCashAccountId = (value: unknown): value is string => typeof value === 'string' && CASH_ACCOUNT_IDS.includes(value);
export const cashAccount = (id: string): CashAccount => CASH_ACCOUNTS.find((a) => a.id === id) ?? { id, name: id, kind: 'cash' };

export type CashAccountCheck = { ok: true; account: CashAccount } | { ok: false; reason: 'name' | 'taken' | 'kind' };
/** What the owner types: a name (2 to 30 characters) not used yet, and its kind. The id is made once, here. */
export function checkCashAccount(input: { name: string; kind: string }, existing: readonly CashAccount[] = CASH_ACCOUNTS, makeId: () => string = () => `acc_${Date.now().toString(36)}`): CashAccountCheck {
    const name = input.name.trim().replace(/\s+/g, ' ');
    if (name.length < 2 || name.length > 30) return { ok: false, reason: 'name' };
    if (existing.some((a) => a.name.toLowerCase() === name.toLowerCase() || a.id.toLowerCase() === name.toLowerCase())) return { ok: false, reason: 'taken' };
    if (input.kind !== 'cash' && input.kind !== 'bank' && input.kind !== 'mobile') return { ok: false, reason: 'kind' };
    return { ok: true, account: { id: makeId(), name, kind: input.kind, custom: true } };
}
/** The user document, read safely: anything malformed or doubled is left out. */
export function readCustomAccounts(raw: unknown): CashAccount[] {
    if (!Array.isArray(raw)) return [];
    const out: CashAccount[] = [];
    for (const item of raw) {
        const value = item as { id?: unknown; name?: unknown; kind?: unknown };
        const id = typeof value?.id === 'string' ? value.id : '';
        if (!/^acc_[a-z0-9]+$/.test(id) || out.some((a) => a.id === id)) continue;
        const check = checkCashAccount({ name: String(value?.name ?? ''), kind: String(value?.kind ?? '') }, [...BUILT_IN_ACCOUNTS, ...out], () => id);
        if (check.ok) out.push(check.account);
    }
    return out;
}
let signature = '';
/** Puts the owner's accounts after the Caisse and BaridiMob, in every list. True when something changed. */
export function setCustomAccounts(custom: readonly CashAccount[]): boolean {
    const next = JSON.stringify(custom.map((a) => [a.id, a.name, a.kind]));
    if (next === signature) return false;
    signature = next;
    CASH_ACCOUNTS.splice(0, CASH_ACCOUNTS.length, ...BUILT_IN_ACCOUNTS, ...custom.map((a) => ({ ...a, custom: true })));
    if (CASH_ACCOUNTS.every((a) => HIDDEN_ACCOUNTS.has(a.id))) HIDDEN_ACCOUNTS.clear();
    refreshLiveLists();
    return true;
}

// ---- V15-2b: the payment choice of a sale or a purchase ----
/** « credit » (on the client's account), « cash » (Caisse), « baridi » (BaridiMob), or the id of another dinar account. */
export type PaymentChoice = 'credit' | 'cash' | 'baridi' | (string & {});
/** The dinar account a payment made now goes to (or comes from). */
export const walletOfStatus = (status: PaymentChoice | null | undefined): string => (status === 'baridi' ? 'BaridiMob' : status === 'cash' || !status || status === 'credit' ? 'Caisse' : status);
/** The words kept on the client's row, as before for the three old choices; the account's name for the others. */
export const paymentMethodOfStatus = (status: PaymentChoice | null | undefined): string => (status === 'credit' ? 'Crédit' : status === 'baridi' ? 'BaridiMob' : status === 'cash' || !status ? 'Espèces' : cashAccount(status).name);
/** A payment made now (not on the client's account). */
export const isPaidNow = (status: PaymentChoice | null | undefined): boolean => Boolean(status) && status !== 'credit';
/** V15-2c: what a dinar account holds, from the treasury figures (the Caisse and BaridiMob as before). */
export const cashBalanceOf = (stats: { caisse?: number; baridi?: number; accounts?: Record<string, number> } | null | undefined, id: string): number => (id === 'Caisse' ? Number(stats?.caisse || 0) : id === 'BaridiMob' ? Number(stats?.baridi || 0) : Number(stats?.accounts?.[id] || 0));
/** V15-2c: one of the accounts the owner added (a plain check, not a type guard). */
export const isCustomCashAccount = (id: string): boolean => CUSTOM_CASH_ACCOUNTS.some((a) => a.id === id);
/** V15-2c: the « asset » of the treasury adjustment window for a dinar account: DZD-Caisse, DZD-Baridi, DZD-<id>. */
export const adjustmentAssetForWallet = (id: string): string => (id === 'Caisse' ? 'DZD-Caisse' : id === 'BaridiMob' ? 'DZD-Baridi' : `DZD-${id}`);
/** And back: the dinar account of an adjustment asset, or null for a currency. */
export const cashWalletOfAsset = (asset: string): string | null => (asset === 'DZD-Caisse' ? 'Caisse' : asset === 'DZD-Baridi' ? 'BaridiMob' : asset.startsWith('DZD-') && isCustomCashAccount(asset.slice(4)) ? asset.slice(4) : null);
