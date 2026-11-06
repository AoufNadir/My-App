// V12-2: sold today at today's price, delivered later, in one or several times. The sale is an ordinary sale
// (price, profit and stock out on the day of the sale); what is still owed to the client is followed apart, in the
// `deliveries` collection, which holds no money and changes no balance:
// - a `commitment`: the quantity owed (written with the sale, or once for a sale recorded before this existed);
// - a `delivery`: what was sent, never more than what is left.
// The inventory adds what is still owed to the stock the books expect, because it is still in the wallet.

export type DeliveryCurrency = 'USDT' | 'EUR';
export type DeliveryDoc = {
    id: string;
    kind: 'commitment' | 'delivery';
    clientId: string;
    currency: DeliveryCurrency;
    quantity: number;
    timestamp: number;
    saleTxId?: string;
    note?: string;
};
export type ClientDeliveryState = { clientId: string; currency: DeliveryCurrency; committed: number; delivered: number; remaining: number; since: number; deliveries: DeliveryDoc[] };

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
        ...(typeof data.saleTxId === 'string' ? { saleTxId: data.saleTxId } : {}),
        ...(typeof data.note === 'string' && data.note.trim() ? { note: data.note.trim() } : {}),
    };
}

/** What each client is still owed, per currency; only the ones with something promised. */
export function deliveryStates(docs: ReadonlyArray<DeliveryDoc>, saleIds?: ReadonlySet<string>): ClientDeliveryState[] {
    const byKey = new Map<string, ClientDeliveryState>();
    for (const doc of [...docs].sort((a, b) => a.timestamp - b.timestamp)) {
        // A commitment written with a sale that was deleted afterwards no longer counts.
        if (doc.kind === 'commitment' && doc.saleTxId && saleIds && !saleIds.has(doc.saleTxId))
            continue;
        const key = `${doc.clientId}|${doc.currency}`;
        const state = byKey.get(key) ?? { clientId: doc.clientId, currency: doc.currency, committed: 0, delivered: 0, remaining: 0, since: doc.timestamp, deliveries: [] };
        if (doc.kind === 'commitment')
            state.committed = fromCents(cents(state.committed) + cents(doc.quantity));
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
    const total = { USDT: 0, EUR: 0 };
    for (const state of states)
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
