import { stampAt } from './editStamp';

// V13-3: buying and selling RMB (the yuan, Alipay), stored as currency « RMB » in the same collections as USDT and EUR.
// - With dinars: like a USDT purchase or sale: the operation, its client row, and its treasury row when paid now.
// - With EUR or USDT (option (a) chosen by the owner): a conversion, no profit. The currency that comes in costs what
//   left the stock (quantity × its average price at that moment); the profit shows when it is sold for dinars.
//   Written as a purchase at no price of the incoming currency, linked to a withdrawal of the outgoing one marked
//   `conversionLeg: 'out'` (the ledger moves the cost across).
// Nothing here writes: it builds the rows a batch writes, so the numbers can be checked without Firestore.

export type TradeCurrency = 'USDT' | 'EUR' | 'RMB';
export type RmbSource = 'DZD' | TradeCurrency;
export type PaymentStatus = 'credit' | 'baridi' | 'cash';
export type RmbTradeInput = {
    kind: 'buy' | 'sell';
    /** V13-4: the currency bought or sold (RMB when left out). With dinars only RMB goes through here. */
    currency?: TradeCurrency;
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
    /**
     * V13-6, a sale for another currency: the average purchase price (DZD) of the currency received. The sale is
     * valued with it, like a sale in dinars: sold above the average price of what leaves = profit, below = loss.
     */
    receivedAvgPrice?: number;
    notes?: string;
};
export type RmbStock = { RMB: number; EUR: number; USDT: number };
export type RmbCheck = { ok: true } | { ok: false; reason: 'client' | 'quantity' | 'price' | 'amount' | 'payment' | 'stock' | 'source_stock' | 'same_currency' | 'no_received_price' };
const currencyOf = (input: Pick<RmbTradeInput, 'currency'>): TradeCurrency => input.currency ?? 'RMB';

const positive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;
const round2 = (value: number) => Math.round(value * 100) / 100;
const EPS = 1e-9;
const qty = (value: number) => value.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export function checkRmbTrade(input: RmbTradeInput, stock: RmbStock): RmbCheck {
    if (!input.clientId || input.clientId === 'none') return { ok: false, reason: 'client' };
    if (!positive(input.quantity)) return { ok: false, reason: 'quantity' };
    const currency = currencyOf(input);
    if (input.source === currency) return { ok: false, reason: 'same_currency' };
    if (input.source === 'DZD') {
        if (!positive(input.price)) return { ok: false, reason: 'price' };
        if (!input.paymentStatus) return { ok: false, reason: 'payment' };
    }
    else if (!positive(input.otherAmount)) return { ok: false, reason: 'amount' };
    if (input.kind === 'sell' && input.quantity > stock[currency] + EPS) return { ok: false, reason: 'stock' };
    if (input.kind === 'buy' && input.source !== 'DZD' && (input.otherAmount ?? 0) > stock[input.source] + EPS) return { ok: false, reason: 'source_stock' };
    // No average price, no value: a currency never bought cannot value a sale (owner's rule, V13-6).
    if (input.kind === 'sell' && input.source !== 'DZD' && !positive(input.receivedAvgPrice)) return { ok: false, reason: 'no_received_price' };
    return { ok: true };
}

export type RmbRow = { collection: 'usdt_txs' | 'dzd_client_txs' | 'treasury_txs'; data: Record<string, unknown> };
export type RmbRows = { main: Record<string, unknown>; linked: RmbRow[] };

const PAYMENT_METHOD: Record<PaymentStatus, 'Crédit' | 'BaridiMob' | 'Espèces'> = { credit: 'Crédit', baridi: 'BaridiMob', cash: 'Espèces' };

/** The rows of one RMB operation; `mainId` is the id the first row (the operation) will get. */
export function rmbTradeRows(input: RmbTradeInput, nowMs: number, mainId: string, profitDzd = 0): RmbRows {
    const stamp = stampAt(nowMs);
    const notes = (input.notes ?? '').trim();
    const currency = currencyOf(input);
    if (input.source !== 'DZD' && input.kind === 'sell') {
        // V13-6: a sale for another currency is a sale, as in dinars. What comes in is worth its quantity times its
        // average purchase price; the sale's price per unit is that value over the quantity sold; the ledger gives
        // the profit (above the average price of what leaves) or the loss (below). What comes in enters the stock
        // at that same value, so its own average price does not move.
        const other = input.source;
        const otherAmount = input.otherAmount as number;
        const valueDzd = round2(otherAmount * (input.receivedAvgPrice as number));
        const label = `Vente de ${qty(input.quantity)} ${currency} contre ${qty(otherAmount)} ${other}`;
        return {
            main: { ...stamp, type: 'sell', currency, quantity: input.quantity, sell: round2(valueDzd / input.quantity), total: valueDzd, profit: round2(profitDzd), notes: notes || label, linkedClientId: input.clientId, receivedCurrency: other, receivedQuantity: otherAmount, receivedAvgPrice: input.receivedAvgPrice, crossTrade: true },
            linked: [{ collection: 'usdt_txs', data: { ...stamp, timestamp: nowMs + 1, type: 'buy', currency: other, quantity: otherAmount, price: input.receivedAvgPrice, total: valueDzd, notes: label, linkedTxId: mainId, linkedClientId: input.clientId, crossTradeFrom: currency, crossTrade: true } }],
        };
    }
    if (input.source !== 'DZD') {
        const other = input.source;
        const otherAmount = input.otherAmount as number;
        // What comes in, and what leaves.
        const incoming = input.kind === 'buy' ? { currency, quantity: input.quantity } : { currency: other, quantity: otherAmount };
        const outgoing = input.kind === 'buy' ? { currency: other, quantity: otherAmount } : { currency, quantity: input.quantity };
        const label = input.kind === 'buy'
            ? `Achat de ${qty(input.quantity)} ${currency} payé en ${qty(otherAmount)} ${other}`
            : `Vente de ${qty(input.quantity)} ${currency} contre ${qty(otherAmount)} ${other}`;
        return {
            main: { ...stamp, type: 'buy', currency: incoming.currency, quantity: incoming.quantity, price: 0, total: 0, notes: notes || label, linkedClientId: input.clientId, purchaseFundingCurrency: outgoing.currency, conversionFrom: outgoing.currency, conversionFromQuantity: outgoing.quantity },
            linked: [{ collection: 'usdt_txs', data: { ...stamp, timestamp: nowMs - 1, type: 'Retrait Manuel', currency: outgoing.currency, quantity: outgoing.quantity, notes: label, linkedTxId: mainId, conversionLeg: 'out' } }],
        };
    }
    if (currency !== 'RMB')
        throw new Error('USDT and EUR with dinars go through the usual window');
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
export function rmbConversionPreview(input: Pick<RmbTradeInput, 'kind' | 'source' | 'quantity' | 'otherAmount' | 'currency'>, avgPrice: { RMB: number; EUR: number; USDT: number }): { incoming: string; avgPrice: number; rate: number; costDzd: number } | null {
    if (input.source === 'DZD' || !positive(input.quantity) || !positive(input.otherAmount)) return null;
    const currency = currencyOf(input);
    const other = input.source;
    const cost = input.kind === 'buy' ? input.otherAmount * avgPrice[other] : input.quantity * avgPrice[currency];
    const incomingQty = input.kind === 'buy' ? input.quantity : input.otherAmount;
    return { incoming: input.kind === 'buy' ? currency : other, avgPrice: round2(cost / incomingQty), rate: input.quantity / input.otherAmount, costDzd: round2(cost) };
}

/**
 * V13-4: the three linked fields of a conversion: quantity of the currency, rate (1 other = rate × currency) and amount
 * of the other currency. The field just typed is kept; the third is worked out from the two others.
 */
export type ThreeFields = { quantity: string; rate: string; amount: string };
export function linkThreeFields(fields: ThreeFields, edited: keyof ThreeFields, parse: (value: string) => number): ThreeFields {
    const q = parse(fields.quantity);
    const r = parse(fields.rate);
    const a = parse(fields.amount);
    const ok = (value: number) => Number.isFinite(value) && value > 0;
    const fmt = (value: number, digits: number) => String(Math.round(value * 10 ** digits) / 10 ** digits);
    if (edited === 'quantity') {
        if (ok(q) && ok(r)) return { ...fields, amount: fmt(q / r, 2) };
        if (ok(q) && ok(a)) return { ...fields, rate: fmt(q / a, 4) };
    }
    if (edited === 'rate') {
        if (ok(r) && ok(a)) return { ...fields, quantity: fmt(a * r, 2) };
        if (ok(r) && ok(q)) return { ...fields, amount: fmt(q / r, 2) };
    }
    if (edited === 'amount') {
        if (ok(a) && ok(r)) return { ...fields, quantity: fmt(a * r, 2) };
        if (ok(a) && ok(q)) return { ...fields, rate: fmt(q / a, 4) };
    }
    return fields;
}

/** An operation of the RMB window: in RMB, or one leg of a conversion made there. Not editable in the USDT / EUR window. */
export function isRmbOperation(tx: { currency?: unknown; conversionFrom?: unknown; conversionLeg?: unknown; crossTrade?: unknown }): boolean {
    return tx.currency === 'RMB' || Boolean(tx.conversionFrom) || tx.conversionLeg === 'out' || tx.crossTrade === true;
}
