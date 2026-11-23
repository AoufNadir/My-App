import assert from 'node:assert/strict';
import { deliveryStates } from './deferredDelivery';
import { orderPrice, statementMessage, deliveryMessage } from '../components/clients/ClientDeliveries';

// V25-4 (fake figures): an old order (500 USDT) was fully sent. Then 200 USDT were sent ahead, the client bought
// 1 000 USDT at 260 and 300 more were sent: the open order is 1 000, 500 received, 500 left (not 1 500 / 1 000).
const d = (id: string, kind: 'commitment' | 'delivery', quantity: number, timestamp: number, saleTxId?: string) => ({ id, kind, quantity, timestamp, clientId: 'c', currency: 'USDT', direction: 'to_client', ...(saleTxId ? { saleTxId } : {}) }) as never;
const docs = [d('o1', 'commitment', 500, 1, 'old'), d('o2', 'delivery', 500, 2), d('a', 'delivery', 200, 3), d('c', 'commitment', 1000, 4, 'new'), d('b', 'delivery', 300, 5)];
const [state] = deliveryStates(docs, new Map([['old', 500], ['new', 1000]]));
assert.equal(state.committed, 1000);
assert.equal(state.delivered, 500);
assert.equal(state.remaining, 500);
assert.equal(orderPrice(state, [{ id: 'new', price: 260 }, { id: 'old', price: 250 }]), 260);

const clean = (s: string) => s.replace(/[⁦⁩]/g, '').replace(/ | /g, ' ');
const ar = clean(statementMessage('ar', 'Client Test', state, { price: 260, date: '01/01/2026' }));
assert.ok(ar.includes('الكمية المتفق عليها: *1 000,00 USDT*'), ar);
assert.ok(ar.includes('السعر الثابت: *260,00 DZD* للوحدة'));
assert.ok(ar.includes('ما استلمتموه حتى الآن: *500,00 USDT*'));
assert.ok(ar.includes('*الباقي المحفوظ لكم: 500,00 USDT*'));
assert.ok(!ar.includes('1 500'), 'no old order in the total');
const fr = clean(deliveryMessage('fr', 'Client Test', state, 300, { price: 260, date: '01/01/2026' }));
assert.ok(fr.includes('*300,00 USDT envoyés* aujourd’hui, le 01/01/2026.'), fr);
assert.ok(fr.includes('Reste réservé pour vous : 500,00 USDT'));
assert.ok(!clean(statementMessage('fr', 'X', state, { price: null, date: '1' })).includes('Prix fixé'));
console.log('deliveryOpenOrder: ok');
