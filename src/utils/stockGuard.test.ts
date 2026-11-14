import assert from 'node:assert/strict';
import { assertBatchKeepsStock, batchCreatesNegativeStock, changeCreatesNegativeStock, NegativeStockError, registerStockHistory, withoutOperation, withQuantity } from './stockGuard';
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
// V14-5 (accounting tour): the delete pressed on the client row of a purchase removes the purchase itself. The check
// follows what the batch really deletes, whatever the window.
{
    const op = (kind: 'set' | 'update' | 'delete', id: string, data?: object) => ({ kind, ref: { nativeRef: { path: `users/u/usdt_txs/${id}` } }, data });
    const client = (id: string) => ({ kind: 'delete' as const, ref: { nativeRef: { path: `users/u/dzd_client_txs/${id}` } } });
    assert.equal(batchCreatesNegativeStock(txs, [client('c'), op('delete', 'b')]), true, 'client row and its purchase deleted: refused');
    assert.equal(batchCreatesNegativeStock(txs, [op('delete', 's')]), false, 'deleting the sale is fine');
    assert.equal(batchCreatesNegativeStock(txs, [op('update', 'b', { quantity: 60 })]), true, 'an edit through any window too');
    assert.equal(batchCreatesNegativeStock(txs, [op('set', 'new', { type: 'sell', currency: 'USDT', quantity: 500, timestamp: T + 5 })]), false, 'a new row is checked by its own window');
    assert.equal(batchCreatesNegativeStock(txs, [client('c')]), false, 'no stock row: nothing to check');
    // A buy whose 24h lock is long over still funded the later sale: deleting it must be refused.
    const locked = [{ ...txs[0], lockedUntil: T + 86_400_000 }, txs[1]] as unknown as Tx[];
    assert.equal(changeCreatesNegativeStock(locked, withoutOperation(locked, 'b')), true, 'a past locked buy counts as held');
    const off = registerStockHistory(() => txs);
    assert.throws(() => assertBatchKeepsStock([op('delete', 'b')]), NegativeStockError);
    off();
    assertBatchKeepsStock([op('delete', 'b')]);
}
console.log('stockGuard.test: edits and deletes never leave the stock negative later');
