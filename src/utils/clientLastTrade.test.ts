import assert from 'node:assert/strict';
import type { ClientTransactionDzd, Tx } from '../types';
import { clientOfEachTrade, daysAgo, lastTradeWithAnyone, lastTradeWithClient, recentClientIds } from './clientLastTrade';

// What the new-operation window says about a client (V11-1): last sale / purchase, the last one to anyone
// for a new client, the recent clients. Read-only.

const at = (m: number, d: number, h = 12) => new Date(2026, m - 1, d, h).getTime();
let n = 0;
const txs: Tx[] = [];
const rows: ClientTransactionDzd[] = [];
function trade(type: 'buy' | 'sell', currency: 'USDT' | 'EUR', clientId: string, timestamp: number, quantity: number, price: number, extra: Partial<Tx> = {}, rowExtra: Partial<ClientTransactionDzd> = {}) {
    const id = `t${++n}`;
    txs.push({ id, type, currency, quantity, ...(type === 'sell' ? { sell: price } : { price }), total: quantity * price, date: '', time: '', timestamp, ...extra } as Tx);
    rows.push({ id: `r${n}`, clientId, timestamp, date: '', time: '', montant: 0, type: 'Vente USDT', notes: '', linkedTxId: id, linkRole: 'primary', ...rowExtra } as ClientTransactionDzd);
    return id;
}
const profits: Record<string, { derivedProfit: number }> = {};
const a1 = trade('sell', 'USDT', 'A', at(10, 20), 2000, 248, {}, { paymentMethod: 'Espèces' });
const a2 = trade('sell', 'USDT', 'A', at(10, 30), 3000, 249.5, {}, { paymentMethod: 'Crédit' });
const b1 = trade('sell', 'USDT', 'B', at(11, 2), 1000, 251, {}, { paymentMethod: 'BaridiMob' });
trade('sell', 'EUR', 'A', at(11, 3), 500, 268);
trade('sell', 'USDT', 'A', at(11, 4), 800, 0, { settlementCurrency: 'EUR' } as Partial<Tx>); // settled in euros: no dinar price
trade('buy', 'USDT', 'C', at(10, 24), 5000, 246, {}, { paymentMethod: 'Espèces' });
trade('buy', 'USDT', 'C', at(11, 1), 1000, 0, { purchaseFundingCurrency: 'EUR' } as Partial<Tx>); // bought with euros: no dinar price
profits[a1] = { derivedProfit: 2000 * 3.0 };
profits[a2] = { derivedProfit: 3000 * 3.3 };
profits[b1] = { derivedProfit: 1000 * 4.0 };
const source = { transactions: txs, clientTransactions: rows, profitByTxId: profits };

// The last sale to a client: the latest one, with its quantity, margin per unit and how it was settled.
const last = lastTradeWithClient(source, { clientId: 'A', side: 'sell', currency: 'USDT' })!;
assert.equal(last.txId, a2, 'the 30/10 sale, not the 20/10 one, and not the euro-settled one of 4/11');
assert.equal(last.price, 249.5);
assert.equal(last.quantity, 3000);
assert.ok(Math.abs(last.marginPerUnit! - 3.3) < 1e-9, 'profit ÷ quantity');
assert.equal(last.payment, 'credit');
assert.equal(lastTradeWithClient(source, { clientId: 'A', side: 'sell', currency: 'EUR' })!.price, 268, 'each currency has its own last sale');
assert.equal(lastTradeWithClient(source, { clientId: 'B', side: 'sell', currency: 'EUR' }), null, 'no EUR sale to B');
assert.equal(lastTradeWithClient(source, { clientId: 'Z', side: 'sell', currency: 'USDT' }), null, 'a new client has none');

// A purchase: the last price paid, the one with euros is skipped, and there is no margin.
const bought = lastTradeWithClient(source, { clientId: 'C', side: 'buy', currency: 'USDT' })!;
assert.equal(bought.price, 246);
assert.equal(bought.marginPerUnit, null);
assert.equal(bought.payment, 'cash');

// For a new client: the last sale to anyone else.
const anyone = lastTradeWithAnyone(source, { side: 'sell', currency: 'USDT', exceptClientId: 'A' })!;
assert.equal(anyone.clientId, 'B');
assert.equal(anyone.price, 251);
assert.equal(lastTradeWithAnyone(source, { side: 'sell', currency: 'USDT' })!.txId, b1, 'without an exception, the latest of all');

// Recent clients: the latest operations' clients, most recent first, once each.
assert.deepEqual([...recentClientIds(rows, 3)].sort(), ['A', 'B', 'C'], 'the three clients, whatever the order');
assert.equal(recentClientIds(rows, 1)[0], 'A', 'A has the latest operation (the euro sale of 4/11)');
assert.equal(new Set(recentClientIds(rows, 10)).size, recentClientIds(rows, 10).length, 'each once');
assert.deepEqual(recentClientIds(rows, 2).length, 2);
// A receiver row loses to the main row of the same operation.
const twice = clientOfEachTrade([
    { id: 'x1', clientId: 'R', timestamp: 1, date: '', time: '', montant: 0, type: 'Transfert Entrant', notes: '', linkedTxId: 'tx', linkRole: 'dzd_receiver' } as ClientTransactionDzd,
    { id: 'x2', clientId: 'P', timestamp: 0, date: '', time: '', montant: 0, type: 'Vente USDT', notes: '', linkedTxId: 'tx', linkRole: 'primary' } as ClientTransactionDzd,
]);
assert.equal(twice.get('tx')!.clientId, 'P');

// Days ago, by calendar day.
assert.equal(daysAgo(at(11, 5, 1), at(11, 5, 23)), 0, 'today');
assert.equal(daysAgo(at(11, 4, 23), at(11, 5, 1)), 1, 'yesterday, though less than 24 hours ago');
assert.equal(daysAgo(at(10, 30), at(11, 5)), 6);
console.log('clientLastTrade tests passed');
