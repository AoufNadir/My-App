import assert from 'node:assert/strict';
import { changeCreatesNegativeStock, withoutOperation, withQuantity } from './stockGuard';
import type { Tx } from '../types';

// V13-6 (audit): buy 100, sell 80 later. Reducing the buy to 50, or deleting it, would make the later sale oversell.
const T = Date.UTC(2027, 0, 1);
const txs = [
    { id: 'b', type: 'buy', currency: 'USDT', quantity: 100, price: 250, total: 25_000, timestamp: T },
    { id: 's', type: 'sell', currency: 'USDT', quantity: 80, sell: 260, total: 20_800, timestamp: T + 1000 },
] as unknown as Tx[];
assert.equal(changeCreatesNegativeStock(txs, withQuantity(txs, 'b', 50)), true, 'buy cut below a later sale');
assert.equal(changeCreatesNegativeStock(txs, withQuantity(txs, 'b', 80)), false, 'exactly enough');
assert.equal(changeCreatesNegativeStock(txs, withoutOperation(txs, 'b')), true, 'buy deleted under a later sale');
assert.equal(changeCreatesNegativeStock(txs, withoutOperation(txs, 's')), false, 'deleting a sale is safe');
assert.equal(changeCreatesNegativeStock(txs, withQuantity(txs, 's', 120)), true, 'sale raised above the stock');
console.log('stockGuard.test: edits and deletes never leave the stock negative later');
