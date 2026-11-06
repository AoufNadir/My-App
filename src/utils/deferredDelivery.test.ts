import assert from 'node:assert/strict';
import { checkDelivery, deliveryStates, parseDelivery, reservedForClients, type DeliveryDoc } from './deferredDelivery';

// V12-2: a client buys 3 906,25 USDT today and asks for them in several times: 200, then 300.
const doc = (id: string, kind: DeliveryDoc['kind'], quantity: number, day: number, extra: Partial<DeliveryDoc> = {}): DeliveryDoc => ({ id, kind, clientId: 'c1', currency: 'USDT', quantity, timestamp: day * 86_400_000, ...extra });
const docs = [doc('a', 'commitment', 3_906.25, 1, { saleTxId: 's1' }), doc('b', 'delivery', 200, 8), doc('c', 'delivery', 300, 10)];
const [state] = deliveryStates(docs);
assert.deepEqual([state.committed, state.delivered, state.remaining], [3_906.25, 500, 3_406.25]);
assert.equal(state.deliveries.length, 2);
assert.deepEqual(reservedForClients([state]), { USDT: 3_406.25, EUR: 0 }, 'the inventory expects what is still owed');
// Never more than what is left, to the cent.
assert.deepEqual(checkDelivery(3_406.25, 3_406.25), { ok: true });
assert.deepEqual(checkDelivery(3_406.25, 3_406.26), { ok: false, reason: 'too_much', remaining: 3_406.25 });
assert.deepEqual(checkDelivery(500, 0), { ok: false, reason: 'empty', remaining: 500 });
// A commitment whose sale was deleted no longer counts.
assert.deepEqual(deliveryStates(docs, new Set(['other'])), [], 'sale deleted: nothing owed');
assert.equal(deliveryStates(docs, new Set(['s1'])).length, 1);
// Each client and currency apart; everything delivered stays listed at zero.
const two = deliveryStates([...docs, doc('d', 'commitment', 100, 2, { clientId: 'c2', currency: 'EUR' }), doc('e', 'delivery', 100, 3, { clientId: 'c2', currency: 'EUR' })]);
assert.equal(two.length, 2);
assert.equal(two.find((s) => s.clientId === 'c2')!.remaining, 0);
// Reading what is stored: anything broken is left out.
assert.equal(parseDelivery('x', { kind: 'delivery', clientId: 'c1', currency: 'USDT', quantity: 200, timestamp: 5 })!.quantity, 200);
for (const bad of [null, { kind: 'gift', clientId: 'c1', currency: 'USDT', quantity: 1, timestamp: 1 }, { kind: 'delivery', clientId: 'c1', currency: 'BTC', quantity: 1, timestamp: 1 }, { kind: 'delivery', clientId: 'c1', currency: 'USDT', quantity: -2, timestamp: 1 }])
    assert.equal(parseDelivery('x', bad), null);
// A line typed by mistake: a delivery can go; an amount to send only if what was sent still fits.
import { canRemove } from './deferredDelivery';
assert.equal(canRemove({ committed: 200, delivered: 0 }, { kind: 'commitment', quantity: 200 }), true, 'nothing sent yet: the 200 typed by mistake can go');
assert.equal(canRemove({ committed: 3_906.25, delivered: 500 }, { kind: 'commitment', quantity: 3_906.25 }), false, 'already sent 500: the amount cannot go below it');
assert.equal(canRemove({ committed: 4_106.25, delivered: 500 }, { kind: 'commitment', quantity: 200 }), true);
assert.equal(canRemove({ committed: 100, delivered: 100 }, { kind: 'delivery', quantity: 100 }), true);
assert.equal(state.commitments.length, 1, 'the amounts to send are listed too');
// A sale edited after the fact: what is owed follows the sale as it is now.
{
    const edited = deliveryStates(docs, new Map([['s1', 4_000]]));
    assert.deepEqual([edited[0].committed, edited[0].remaining], [4_000, 3_500], 'the edited quantity, minus what was sent');
    assert.deepEqual(deliveryStates(docs, new Map([['other', 10]])), [], 'sale deleted: nothing owed');
}
// Late: owed for more than 7 days, counted from the sale itself when the rest was added afterwards.
import { isLate } from './deferredDelivery';
{
    const day = 86_400_000;
    assert.equal(isLate({ remaining: 10, since: 0 }, 8 * day), true);
    assert.equal(isLate({ remaining: 10, since: 0 }, 6 * day), false);
    assert.equal(isLate({ remaining: 0, since: 0 }, 30 * day), false, 'all sent: never late');
    const [fromSale] = deliveryStates([doc('z', 'commitment', 100, 9, { saleTimestamp: 2 * day })]);
    assert.equal(fromSale.since, 2 * day, 'the day of the sale, not the day the rest was added');
}
// V12-8: a supplier paid and not delivered yet is followed apart, never mixed with what is owed to clients.
import { awaitedFromSuppliers } from './deferredDelivery';
{
    const both = deliveryStates([...docs, doc('f1', 'commitment', 1_000, 3, { clientId: 'sup', direction: 'from_supplier' }), doc('f2', 'delivery', 400, 5, { clientId: 'sup', direction: 'from_supplier' })]);
    assert.equal(both.length, 2);
    assert.deepEqual(awaitedFromSuppliers(both), { USDT: 600, EUR: 0 }, 'awaited from the supplier');
    assert.deepEqual(reservedForClients(both), { USDT: 3_406.25, EUR: 0 }, 'owed to clients unchanged');
    assert.equal(parseDelivery('x', { kind: 'delivery', clientId: 'c', currency: 'USDT', quantity: 1, timestamp: 1 })!.direction, 'to_client', 'old lines are client lines');
}
// Waiting time from the sale itself, also for a line written before the sale's date was kept with it.
{
    const [linked] = deliveryStates([doc('w', 'commitment', 100, 9, { saleTxId: 'sx' })], new Map([['sx', 100]]), new Map([['sx', 2 * 86_400_000]]));
    assert.equal(linked.since, 2 * 86_400_000);
}
console.log('deferredDelivery tests passed');
