// M4: buying, selling and converting a currency added in the settings (GBP, CNY…), from any account of the base
// currency. A purchase and a sale are written like the USDT and EUR ones (a row in `usdt_txs` and its treasury row),
// so the ledger gives their PAM and profit. A conversion is a purchase of the new currency at no price, linked to a
// withdrawal of the old one marked `conversionLeg: 'out'`: the ledger moves the cost across and makes no profit.

export type CurrencyOperation =
    | { kind: 'buy' | 'sell'; currency: string; quantity: number; price: number; accountId: string; notes?: string }
    | { kind: 'convert'; from: string; fromQuantity: number; to: string; toQuantity: number; notes?: string };

export type CurrencyOperationCheck = { ok: true } | { ok: false; reason: 'quantity' | 'price' | 'same_currency' | 'stock' | 'account' };

const positive = (value: number) => Number.isFinite(value) && value > 0;
const round2 = (value: number) => Math.round(value * 100) / 100;

/** `stock` is the quantity held of each currency, `balances` the balance of each account. */
export function checkCurrencyOperation(op: CurrencyOperation, stock: Record<string, number>, balances: Record<string, number>): CurrencyOperationCheck {
    if (op.kind === 'convert') {
        if (!positive(op.fromQuantity) || !positive(op.toQuantity)) return { ok: false, reason: 'quantity' };
        if (op.from === op.to) return { ok: false, reason: 'same_currency' };
        if (op.fromQuantity > (stock[op.from] ?? 0) + 1e-9) return { ok: false, reason: 'stock' };
        return { ok: true };
    }
    if (!positive(op.quantity)) return { ok: false, reason: 'quantity' };
    if (!positive(op.price)) return { ok: false, reason: 'price' };
    if (!(op.accountId in balances)) return { ok: false, reason: 'account' };
    if (op.kind === 'sell' && op.quantity > (stock[op.currency] ?? 0) + 1e-9) return { ok: false, reason: 'stock' };
    if (op.kind === 'buy' && round2(op.quantity * op.price) > (balances[op.accountId] ?? 0) + 1e-9) return { ok: false, reason: 'account' };
    return { ok: true };
}

const stampOf = (now: number) => {
    const d = new Date(now);
    return { timestamp: now, date: d.toLocaleDateString('fr-FR'), time: d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) };
};
const qty = (value: number) => value.toLocaleString('fr-FR', { maximumFractionDigits: 2 });

export type OperationRows = { main: Record<string, unknown>; linked: { collection: 'usdt_txs' | 'treasury_txs'; data: Record<string, unknown> } };

/** The two rows to write in one batch; `mainId` is the id of the first one (the purchase or the sale). */
export function currencyOperationRows(op: CurrencyOperation, now: number, mainId: string): OperationRows {
    const stamp = stampOf(now);
    const notes = (op.notes ?? '').trim();
    if (op.kind === 'convert') {
        return {
            main: { ...stamp, type: 'buy', currency: op.to, quantity: op.toQuantity, price: 0, total: 0, notes, purchaseFundingCurrency: op.from, conversionFrom: op.from, conversionFromQuantity: op.fromQuantity },
            linked: { collection: 'usdt_txs', data: { ...stamp, timestamp: now - 1, type: 'Retrait Manuel', currency: op.from, quantity: op.fromQuantity, notes: `Conversion en ${qty(op.toQuantity)} ${op.to}`, linkedTxId: mainId, conversionLeg: 'out' } },
        };
    }
    const total = Math.round(op.quantity * op.price * 100) / 100;
    const source = op.accountId;
    if (op.kind === 'buy') {
        return {
            main: { ...stamp, type: 'buy', currency: op.currency, quantity: op.quantity, price: op.price, total, notes, clientPaymentStatus: source === 'BaridiMob' ? 'baridi' : 'cash', paidFromAccount: source },
            linked: { collection: 'treasury_txs', data: { ...stamp, type: 'Retrait', source, amount: total, notes: `Achat ${qty(op.quantity)} ${op.currency}`, linkedTxId: mainId } },
        };
    }
    return {
        main: { ...stamp, type: 'sell', currency: op.currency, quantity: op.quantity, sell: op.price, total, notes, clientPaymentStatus: source === 'BaridiMob' ? 'baridi' : 'cash', paidToAccount: source },
        linked: { collection: 'treasury_txs', data: { ...stamp, type: 'Ajout', source, amount: total, notes: `Vente ${qty(op.quantity)} ${op.currency}`, linkedTxId: mainId } },
    };
}
