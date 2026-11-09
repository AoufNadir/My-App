import { stampAt } from './editStamp';

// V13-3: buying and selling RMB (the yuan, Alipay), stored as currency « RMB » in the same collections as USDT and EUR.
// - With dinars: like a USDT purchase or sale: the operation, its client row, and its treasury row when paid now.
// - With EUR or USDT (option (a) chosen by the owner): a conversion, no profit. The currency that comes in costs what
//   left the stock (quantity × its average price at that moment); the profit shows when it is sold for dinars.
//   Written as a purchase at no price of the incoming currency, linked to a withdrawal of the outgoing one marked
//   `conversionLeg: 'out'` (the ledger moves the cost across).
// Nothing here writes: it builds the rows a batch writes, so the numbers can be checked without Firestore.

export type RmbSource = 'DZD' | 'EUR' | 'USDT';
export type PaymentStatus = 'credit' | 'baridi' | 'cash';
export type RmbTradeInput = {
    kind: 'buy' | 'sell';
    source: RmbSource;
    /** RMB bought or sold */
    quantity: number;
    /** With dinars: price of 1 RMB in DZD */
    price?: number;
    /** With EUR or USDT: how many of them were paid (buy) or received (sell) */
    otherAmount?: number;
    clientId: string;
    /** With dinars only */
    paymentStatus?: PaymentStatus | null;
    notes?: string;
};
export type RmbStock = { RMB: number; EUR: number; USDT: number };
export type RmbCheck = { ok: true } | { ok: false; reason: 'client' | 'quantity' | 'price' | 'amount' | 'payment' | 'stock' | 'source_stock' };

const positive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;
const round2 = (value: number) => Math.round(value * 100) / 100;
const EPS = 1e-9;
const qty = (value: number) => value.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export function checkRmbTrade(input: RmbTradeInput, stock: RmbStock): RmbCheck {
    if (!input.clientId || input.clientId === 'none') return { ok: false, reason: 'client' };
    if (!positive(input.quantity)) return { ok: false, reason: 'quantity' };
    if (input.source === 'DZD') {
        if (!positive(input.price)) return { ok: false, reason: 'price' };
        if (!input.paymentStatus) return { ok: false, reason: 'payment' };
    }
    else if (!positive(input.otherAmount)) return { ok: false, reason: 'amount' };
    if (input.kind === 'sell' && input.quantity > stock.RMB + EPS) return { ok: false, reason: 'stock' };
    if (input.kind === 'buy' && input.source !== 'DZD' && (input.otherAmount ?? 0) > stock[input.source] + EPS) return { ok: false, reason: 'source_stock' };
    return { ok: true };
}

export type RmbRow = { collection: 'usdt_txs' | 'dzd_client_txs' | 'treasury_txs'; data: Record<string, unknown> };
export type RmbRows = { main: Record<string, unknown>; linked: RmbRow[] };

const PAYMENT_METHOD: Record<PaymentStatus, 'Crédit' | 'BaridiMob' | 'Espèces'> = { credit: 'Crédit', baridi: 'BaridiMob', cash: 'Espèces' };

/** The rows of one RMB operation; `mainId` is the id the first row (the operation) will get. */
export function rmbTradeRows(input: RmbTradeInput, nowMs: number, mainId: string, profitDzd = 0): RmbRows {
    const stamp = stampAt(nowMs);
    const notes = (input.notes ?? '').trim();
    if (input.source !== 'DZD') {
        const other = input.source;
        const otherAmount = input.otherAmount as number;
        // What comes in, and what leaves.
        const incoming = input.kind === 'buy' ? { currency: 'RMB', quantity: input.quantity } : { currency: other, quantity: otherAmount };
        const outgoing = input.kind === 'buy' ? { currency: other, quantity: otherAmount } : { currency: 'RMB', quantity: input.quantity };
        const label = input.kind === 'buy'
            ? `Achat de ${qty(input.quantity)} RMB payé en ${qty(otherAmount)} ${other}`
            : `Vente de ${qty(input.quantity)} RMB contre ${qty(otherAmount)} ${other}`;
        return {
            main: { ...stamp, type: 'buy', currency: incoming.currency, quantity: incoming.quantity, price: 0, total: 0, notes: notes || label, linkedClientId: input.clientId, purchaseFundingCurrency: outgoing.currency, conversionFrom: outgoing.currency, conversionFromQuantity: outgoing.quantity },
            linked: [{ collection: 'usdt_txs', data: { ...stamp, timestamp: nowMs - 1, type: 'Retrait Manuel', currency: outgoing.currency, quantity: outgoing.quantity, notes: label, linkedTxId: mainId, conversionLeg: 'out' } }],
        };
    }
    const status = input.paymentStatus as PaymentStatus;
    const price = input.price as number;
    const total = Math.round(input.quantity * price);
    const paidNow = status !== 'credit';
    const wallet = status === 'baridi' ? 'BaridiMob' : 'Caisse';
    const linked: RmbRow[] = [];
    if (input.kind === 'buy') {
        if (paidNow)
            linked.push({ collection: 'treasury_txs', data: { ...stamp, type: 'Retrait', source: wallet, amount: total, notes: `Achat ${qty(input.quantity)} RMB`, linkedTxId: mainId } });
        linked.push({ collection: 'dzd_client_txs', data: { ...stamp, clientId: input.clientId, montant: total, type: 'Règlement Reçu', notes: `Financement achat de ${qty(input.quantity)} RMB`, linkedTxId: mainId, linkRole: 'primary', paymentMethod: PAYMENT_METHOD[status], affectsBalance: status === 'credit' } });
        return { main: { ...stamp, type: 'buy', currency: 'RMB', quantity: input.quantity, price, total, notes, clientPaymentStatus: status, purchaseFundingCurrency: 'DZD' }, linked };
    }
    if (paidNow)
        linked.push({ collection: 'treasury_txs', data: { ...stamp, type: 'Ajout', source: wallet, amount: total, notes: `Vente ${qty(input.quantity)} RMB`, linkedTxId: mainId } });
    linked.push({ collection: 'dzd_client_txs', data: { ...stamp, clientId: input.clientId, montant: -total, type: 'Vente RMB', notes: `Vente de ${qty(input.quantity)} RMB`, linkedTxId: mainId, linkRole: 'primary', paymentMethod: PAYMENT_METHOD[status], affectsBalance: status === 'credit' } });
    return { main: { ...stamp, type: 'sell', currency: 'RMB', quantity: input.quantity, sell: price, total, profit: round2(profitDzd), notes, linkedClientId: input.clientId, clientPaymentStatus: status, settlementCurrency: 'DZD' }, linked };
}

/** Before saving a conversion: the average price in DZD of what comes in (what left × its average price ÷ what came in). */
export function rmbConversionPreview(input: Pick<RmbTradeInput, 'kind' | 'source' | 'quantity' | 'otherAmount'>, avgPrice: { RMB: number; EUR: number; USDT: number }): { incoming: string; avgPrice: number; rate: number } | null {
    if (input.source === 'DZD' || !positive(input.quantity) || !positive(input.otherAmount)) return null;
    const other = input.source;
    const cost = input.kind === 'buy' ? input.otherAmount * avgPrice[other] : input.quantity * avgPrice.RMB;
    const incomingQty = input.kind === 'buy' ? input.quantity : input.otherAmount;
    return { incoming: input.kind === 'buy' ? 'RMB' : other, avgPrice: round2(cost / incomingQty), rate: input.quantity / input.otherAmount };
}
