import type { TreasuryTx } from '../types';
import { LEGACY_ACCOUNTS, type BusinessAccount } from './businessSettings';

// M3: the balance of every account of the base currency, from the treasury movements. The cash box and BaridiMob
// are read exactly as the app always read them (the wallet name contains « caisse » or « baridi », the old
// « DZD-Caisse » assets, the « from X to Y » transfers). A created account is matched by its id or exact name.
// A movement on a wallet that matches no account is left out, as before.

export type AccountBalances = { caisse: number; baridi: number; byAccount: Record<string, number> };

const zero = (value: number) => (Object.is(value, -0) || Math.abs(value) < 0.005 ? 0 : Number(value.toFixed(2)));

export function computeAccountBalances(treasuryTransactions: ReadonlyArray<TreasuryTx>, accounts: ReadonlyArray<BusinessAccount> = LEGACY_ACCOUNTS): AccountBalances {
    const extra = accounts.filter((account) => account.id !== 'Caisse' && account.id !== 'BaridiMob');
    const resolve = (raw: unknown): string | null => {
        if (!raw)
            return null;
        const text = String(raw);
        const exact = extra.find((account) => account.id === text || account.name === text);
        if (exact)
            return exact.id;
        const lower = text.toLowerCase();
        if (lower.includes('caisse'))
            return 'Caisse';
        if (lower.includes('baridi'))
            return 'BaridiMob';
        return null;
    };
    const legacyTransfer = (asset?: string) => {
        const match = asset ? /from\s+(.+?)\s+to\s+(.+)/i.exec(asset) : null;
        return match ? { from: resolve(match[1]), to: resolve(match[2]) } : { from: null, to: null };
    };
    const totals: Record<string, number> = { Caisse: 0, BaridiMob: 0 };
    for (const account of extra)
        totals[account.id] = 0;
    for (const tx of treasuryTransactions) {
        const data = tx as unknown as Record<string, unknown>;
        const amount = Number(tx.amount || 0);
        if (!Number.isFinite(amount) || amount <= 0)
            continue;
        if (tx.type === 'Transfer') {
            const legacy = legacyTransfer(data.asset as string | undefined);
            const from = resolve(data.source) || legacy.from;
            const to = resolve(data.destination) || legacy.to;
            if (!from || !to || from === to)
                continue;
            totals[from] -= amount;
            totals[to] += amount;
            continue;
        }
        const factor = tx.type === 'Ajout' || tx.type === 'Adjustment (+)' ? 1 : tx.type === 'Retrait' || tx.type === 'Adjustment (-)' ? -1 : 0;
        const source = resolve(data.source) || (data.asset === 'DZD-Caisse' ? 'Caisse' : data.asset === 'DZD-Baridi' ? 'BaridiMob' : null);
        if (source)
            totals[source] += amount * factor;
    }
    const byAccount = Object.fromEntries(Object.entries(totals).map(([id, value]) => [id, zero(value)]));
    return { caisse: byAccount.Caisse, baridi: byAccount.BaridiMob, byAccount };
}

/** What the accounts other than the cash box and BaridiMob hold together (added to the cash of the capital). */
export function otherAccountsTotal(balances: AccountBalances): number {
    return zero(Object.entries(balances.byAccount).reduce((sum, [id, value]) => (id === 'Caisse' || id === 'BaridiMob' ? sum : sum + value), 0));
}
