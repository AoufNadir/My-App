import type { TreasuryTx, Tx } from '../types';
import { walletCurrency, type BusinessAccount } from './businessSettings';
import { computeAccountBalances } from './accountBalances';

// What each wallet holds, in its own currency.
// - A wallet of the base currency: from the treasury movements (as the cash box and BaridiMob always were).
// - A wallet of another currency: the stock of that currency is one figure (the ledger's). The rows written from a
//   wallet carry its `walletId`; the first wallet of the currency holds the rest (all the rows made before wallets).
//   So the wallets of a currency always add up to its stock.

export type WalletView = { id: string; name: string; currency: string; kind: BusinessAccount['kind']; balance: number; virtual?: boolean };

const zero = (value: number) => (Math.abs(value) < 0.005 ? 0 : Number(value.toFixed(8)));
const signed = (tx: Tx): number => {
    const q = Number(tx.quantity) || 0;
    if (tx.type === 'buy' || tx.type === 'Ajout Manuel') return q;
    if (tx.type === 'sell' || tx.type === 'Retrait Manuel') return -q;
    return 0;
};

export function computeWalletViews(input: { accounts: ReadonlyArray<BusinessAccount>; base: string; traded: ReadonlyArray<string>; transactions: ReadonlyArray<Tx>; treasuryTransactions: ReadonlyArray<TreasuryTx>; stock: Record<string, number> }): WalletView[] {
    const { accounts, base } = input;
    const baseBalances = computeAccountBalances(input.treasuryTransactions, accounts.filter((a) => walletCurrency(a, base) === base)).byAccount;
    const views: WalletView[] = accounts.filter((a) => walletCurrency(a, base) === base).map((a) => ({ id: a.id, name: a.name, currency: base, kind: a.kind, balance: zero(baseBalances[a.id] ?? 0) }));
    for (const code of input.traded) {
        const wallets = accounts.filter((a) => walletCurrency(a, base) === code);
        const stock = input.stock[code] ?? 0;
        if (!wallets.length) {
            views.push({ id: `stock:${code}`, name: code, currency: code, kind: 'online', balance: zero(stock), virtual: true });
            continue;
        }
        const ids = new Set(wallets.map((w) => w.id));
        const own: Record<string, number> = {};
        for (const tx of input.transactions) {
            const walletId = (tx as unknown as { walletId?: string }).walletId;
            if (walletId && ids.has(walletId) && String(tx.currency).toUpperCase() === code)
                own[walletId] = (own[walletId] ?? 0) + signed(tx);
        }
        const others = wallets.slice(1).reduce((sum, w) => sum + (own[w.id] ?? 0), 0);
        wallets.forEach((w, index) => views.push({ id: w.id, name: w.name, currency: code, kind: w.kind, balance: zero(index === 0 ? stock - others : own[w.id] ?? 0) }));
    }
    return views;
}
