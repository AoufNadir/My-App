// V12-2: sold today at today's price, delivered later, in one or several times. The sale is an ordinary sale
// (price, profit and stock out on the day of the sale); what is still owed to the client is followed apart, in the
// `deliveries` collection, which holds no money and changes no balance:
// - a `commitment`: the quantity owed (written with the sale, or once for a sale recorded before this existed);
// - a `delivery`: what was sent, never more than what is left.
// The inventory adds what is still owed to the stock the books expect, because it is still in the wallet.

export type DeliveryCurrency = 'USDT' | 'EUR';
/** to_client: sold, not sent yet (V12-2). from_supplier: bought and paid, not received yet (V12-8). */
export type DeliveryDirection = 'to_client' | 'from_supplier';
export type DeliveryDoc = {
    id: string;
    direction?: DeliveryDirection;
    kind: 'commitment' | 'delivery';
    clientId: string;
    currency: DeliveryCurrency;
    quantity: number;
    timestamp: number;
    saleTxId?: string;
    /** When the sale itself happened (a rest added later for an older sale) */
    saleTimestamp?: number;
    note?: string;
};
export type ClientDeliveryState = { clientId: string; direction: DeliveryDirection; currency: DeliveryCurrency; committed: number; delivered: number; remaining: number; since: number; deliveries: DeliveryDoc[]; commitments: DeliveryDoc[] };

const cents = (value: number) => Math.round(value * 100);
const fromCents = (value: number) => value / 100;

export function parseDelivery(id: string, raw: unknown): DeliveryDoc | null {
    if (!raw || typeof raw !== 'object')
        return null;
    const data = raw as Record<string, unknown>;
    const kind = data.kind === 'commitment' || data.kind === 'delivery' ? data.kind : null;
    const currency = data.currency === 'USDT' || data.currency === 'EUR' ? data.currency : null;
    const quantity = Number(data.quantity);
    const timestamp = Number(data.timestamp);
    if (!kind || !currency || typeof data.clientId !== 'string' || !data.clientId || !(quantity > 0) || !Number.isFinite(timestamp))
        return null;
    return {
        id, kind, currency, quantity: fromCents(cents(quantity)), timestamp, clientId: data.clientId,
        direction: data.direction === 'from_supplier' ? 'from_supplier' : 'to_client',
        ...(typeof data.saleTxId === 'string' ? { saleTxId: data.saleTxId } : {}),
        ...(Number.isFinite(Number(data.saleTimestamp)) && Number(data.saleTimestamp) > 0 ? { saleTimestamp: Number(data.saleTimestamp) } : {}),
        ...(typeof data.note === 'string' && data.note.trim() ? { note: data.note.trim() } : {}),
    };
}

/** What each client is still owed, per currency; only the ones with something promised. */
/**
 * The sales still in the books: their ids, or their ids and quantities. With the quantities, a sale edited after the
 * fact (another quantity) sets what is owed; a sale deleted is no longer owed.
 */
export type SaleLookup = ReadonlySet<string> | ReadonlyMap<string, number>;

export function deliveryStates(docs: ReadonlyArray<DeliveryDoc>, sales?: SaleLookup): ClientDeliveryState[] {
    const byKey = new Map<string, ClientDeliveryState>();
    for (let doc of [...docs].sort((a, b) => a.timestamp - b.timestamp)) {
        // A commitment written with a sale that was deleted afterwards no longer counts.
        if (doc.kind === 'commitment' && doc.saleTxId && sales && !sales.has(doc.saleTxId))
            continue;
        // Linked to a sale that is still there: the quantity of the sale as it is now.
        const saleQuantity = doc.kind === 'commitment' && doc.saleTxId && sales instanceof Map ? Number(sales.get(doc.saleTxId)) : NaN;
        if (Number.isFinite(saleQuantity) && saleQuantity > 0)
            doc = { ...doc, quantity: fromCents(cents(saleQuantity)) };
        const direction: DeliveryDirection = doc.direction === 'from_supplier' ? 'from_supplier' : 'to_client';
        const key = `${direction}|${doc.clientId}|${doc.currency}`;
        const state = byKey.get(key) ?? { clientId: doc.clientId, direction, currency: doc.currency, committed: 0, delivered: 0, remaining: 0, since: doc.saleTimestamp ?? doc.timestamp, deliveries: [], commitments: [] };
        if (doc.kind === 'commitment') {
            state.committed = fromCents(cents(state.committed) + cents(doc.quantity));
            state.commitments.push(doc);
        }
        else {
            state.delivered = fromCents(cents(state.delivered) + cents(doc.quantity));
            state.deliveries.push(doc);
        }
        state.remaining = fromCents(cents(state.committed) - cents(state.delivered));
        byKey.set(key, state);
    }
    return [...byKey.values()].filter((state) => state.committed > 0);
}

/** USDT and EUR sold but not sent yet: still in the wallet, so the inventory expects them. */
export function reservedForClients(states: ReadonlyArray<ClientDeliveryState>): Record<DeliveryCurrency, number> {
    return pendingTotals(states, 'to_client');
}

/** USDT and EUR bought and paid but not received yet: in the stock of the books, not in the wallet yet. */
export function awaitedFromSuppliers(states: ReadonlyArray<ClientDeliveryState>): Record<DeliveryCurrency, number> {
    return pendingTotals(states, 'from_supplier');
}

function pendingTotals(states: ReadonlyArray<ClientDeliveryState>, direction: DeliveryDirection): Record<DeliveryCurrency, number> {
    const total = { USDT: 0, EUR: 0 };
    for (const state of states.filter((item) => item.direction === direction))
        total[state.currency] += cents(Math.max(0, state.remaining));
    return { USDT: fromCents(total.USDT), EUR: fromCents(total.EUR) };
}

export type DeliveryCheck = { ok: true } | { ok: false; reason: 'empty' | 'too_much'; remaining: number };
/** A delivery is a positive quantity and never more than what is left. */
export function checkDelivery(remaining: number, quantity: number): DeliveryCheck {
    if (!(quantity > 0))
        return { ok: false, reason: 'empty', remaining };
    if (cents(quantity) > cents(remaining))
        return { ok: false, reason: 'too_much', remaining };
    return { ok: true };
}

/**
 * A line typed by mistake can be removed: a delivery always; an amount to send only if what was already sent still
 * fits in what is left, so the rest never goes below zero.
 */
export function canRemove(state: Pick<ClientDeliveryState, 'committed' | 'delivered'>, doc: Pick<DeliveryDoc, 'kind' | 'quantity'>): boolean {
    if (doc.kind === 'delivery')
        return true;
    return cents(state.committed) - cents(doc.quantity) >= cents(state.delivered);
}

/** Days a client has been waiting, from the oldest sale still owed; the ones waiting longer than `days` are late. */
export const DELIVERY_LATE_DAYS = 7;
export function isLate(state: Pick<ClientDeliveryState, 'remaining' | 'since'>, now: number, days = DELIVERY_LATE_DAYS): boolean {
    return state.remaining > 0 && now - state.since > days * 86_400_000;
}

/** The sales and purchases still in the books, with their quantity: what a line linked to one of them follows. */
export function operationQuantities(transactions: ReadonlyArray<{ id?: string; type?: string; quantity?: number }>): Map<string, number> {
    return new Map(transactions
        .filter((tx) => (tx.type === 'sell' || tx.type === 'buy') && tx.id)
        .map((tx) => [tx.id as string, Number(tx.quantity) || 0] as const));
}
