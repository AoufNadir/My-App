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
// V13-7, the auditor's case: buy 100, an expense paid with 65 USDT, then a buy of 2. Today the stock is 37, and
// cutting the first buy to 64 still leaves today positive (1), but right after the expense it was 64 − 65 = −1: refused.
{
    const book = [
        { id: 'b1', type: 'buy', currency: 'USDT', quantity: 100, price: 240, total: 24_000, timestamp: T },
        { id: 'x', type: 'Retrait Manuel', currency: 'USDT', quantity: 65, timestamp: T + 1000 },
        { id: 'b2', type: 'buy', currency: 'USDT', quantity: 2, price: 240, total: 480, timestamp: T + 2000 },
    ] as unknown as Tx[];
    assert.equal(changeCreatesNegativeStock(book, withQuantity(book, 'b1', 64)), true, 'negative right after the expense: refused');
    assert.equal(changeCreatesNegativeStock(book, withQuantity(book, 'b1', 65)), false, 'exactly enough at every moment');
}
console.log('stockGuard.test: edits and deletes never leave the stock negative later');
