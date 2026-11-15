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
