// Buying and selling any currency from its wallet, paid with (or paid into) any other wallet.
// - Paid with a wallet of the base currency: a purchase (or a sale) with its price, and its treasury movement.
// - Paid with a wallet of another currency: a conversion, as the owner always did (EUR bought at 280, spent on USD):
//   the purchase of the new currency carries what the spent currency cost (its PAM), no profit, no loss. Written as a
//   purchase at no price linked to a withdrawal of the spent currency marked `conversionLeg: 'out'`; the ledger moves
//   the cost across. A sale paid in another currency is the same conversion seen from the other side.

export type Leg = { walletId: string; currency: string; amount: number };
export type CurrencyOperation = {
    kind: 'buy' | 'sell';
    /** The currency bought or sold, its quantity, and the wallet it enters (buy) or leaves (sell) */
    currency: string;
    quantity: number;
    walletId: string;
    /** What was paid (buy) or received (sell), and in which wallet */
    other: Leg;
    notes?: string;
};

export type CurrencyOperationCheck = { ok: true } | { ok: false; reason: 'quantity' | 'amount' | 'same_currency' | 'stock' | 'account' };

const positive = (value: number) => Number.isFinite(value) && value > 0;
const round2 = (value: number) => Math.round(value * 100) / 100;
const EPS = 1e-9;

/** `walletBalances`: what each wallet holds (in its own currency). */
export function checkCurrencyOperation(op: CurrencyOperation, walletBalances: Record<string, number>): CurrencyOperationCheck {
    if (!positive(op.quantity)) return { ok: false, reason: 'quantity' };
    if (!positive(op.other.amount)) return { ok: false, reason: 'amount' };
    if (op.currency === op.other.currency) return { ok: false, reason: 'same_currency' };
    if (op.kind === 'sell' && op.quantity > (walletBalances[op.walletId] ?? 0) + EPS) return { ok: false, reason: 'stock' };
    if (op.kind === 'buy' && op.other.amount > (walletBalances[op.other.walletId] ?? 0) + EPS) return { ok: false, reason: 'account' };
    return { ok: true };
}

export const stampOf = (now: number) => {
    const d = new Date(now);
    return { timestamp: now, date: d.toLocaleDateString('fr-FR'), time: d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) };
};
const qty = (value: number) => value.toLocaleString('fr-FR', { maximumFractionDigits: 2 });

export type Row = { collection: 'usdt_txs' | 'treasury_txs'; data: Record<string, unknown> };
export type OperationRows = { main: Record<string, unknown>; linked: Row };

/** The two rows to write in one batch; `mainId` is the id of the first one. */
export function currencyOperationRows(op: CurrencyOperation, base: string, now: number, mainId: string): OperationRows {
    const stamp = stampOf(now);
    const notes = (op.notes ?? '').trim();
    const viaBase = op.other.currency === base;
    if (!viaBase) {
        // A conversion: `to` comes in at no price, `from` leaves; the ledger gives `to` the cost of `from`.
        const to = op.kind === 'buy' ? { currency: op.currency, quantity: op.quantity, walletId: op.walletId } : { currency: op.other.currency, quantity: op.other.amount, walletId: op.other.walletId };
        const from = op.kind === 'buy' ? { currency: op.other.currency, quantity: op.other.amount, walletId: op.other.walletId } : { currency: op.currency, quantity: op.quantity, walletId: op.walletId };
        return {
            main: { ...stamp, type: 'buy', currency: to.currency, quantity: to.quantity, price: 0, total: 0, notes, walletId: to.walletId, purchaseFundingCurrency: from.currency, conversionFrom: from.currency, conversionFromQuantity: from.quantity },
            linked: { collection: 'usdt_txs', data: { ...stamp, timestamp: now - 1, type: 'Retrait Manuel', currency: from.currency, quantity: from.quantity, walletId: from.walletId, notes: `Conversion en ${qty(to.quantity)} ${to.currency}`, linkedTxId: mainId, conversionLeg: 'out' } },
        };
    }
    const total = round2(op.other.amount);
    const price = round2(total / op.quantity);
    const source = op.other.walletId;
    const status = source === 'BaridiMob' ? 'baridi' : 'cash';
    if (op.kind === 'buy') {
        return {
            main: { ...stamp, type: 'buy', currency: op.currency, quantity: op.quantity, price, total, notes, clientPaymentStatus: status, walletId: op.walletId, paidFromAccount: source },
            linked: { collection: 'treasury_txs', data: { ...stamp, type: 'Retrait', source, amount: total, notes: `Achat ${qty(op.quantity)} ${op.currency}`, linkedTxId: mainId } },
        };
    }
    return {
        main: { ...stamp, type: 'sell', currency: op.currency, quantity: op.quantity, sell: price, total, notes, clientPaymentStatus: status, walletId: op.walletId, paidToAccount: source },
        linked: { collection: 'treasury_txs', data: { ...stamp, type: 'Ajout', source, amount: total, notes: `Vente ${qty(op.quantity)} ${op.currency}`, linkedTxId: mainId } },
    };
}

/** The opening of a wallet: what it holds already, at what it cost. A base-currency wallet gets a treasury movement,
 *  any other an « Ajout Manuel » at its average price (it enters the stock at that cost, without profit). */
export function walletOpeningRow(input: { walletId: string; currency: string; quantity: number; avgPrice: number }, base: string, now: number): Row {
    const stamp = stampOf(now);
    if (input.currency === base)
        return { collection: 'treasury_txs', data: { ...stamp, type: 'Ajout', source: input.walletId, amount: round2(input.quantity), origin: 'account_opening', notes: 'Solde d’ouverture', recordedAt: now } };
    return { collection: 'usdt_txs', data: { ...stamp, type: 'Ajout Manuel', currency: input.currency, quantity: input.quantity, price: input.avgPrice, total: round2(input.quantity * input.avgPrice), walletId: input.walletId, origin: 'wallet_opening', notes: 'Solde d’ouverture', recordedAt: now } };
}

/** The cost per unit the bought currency will carry, before saving: what was spent × its PAM ÷ what came in. */
export function conversionPam(spent: number, spentPam: number, received: number): number {
    return received > 0 ? round2((spent * spentPam) / received) : 0;
}
