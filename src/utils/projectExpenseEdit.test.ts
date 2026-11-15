import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { batchCreatesNegativeStock } from './stockGuard';
import type { Tx } from '../types';

// V14-6 (owner): a project expense opens its own window to be edited, instead of « delete it and enter it again ».
const read = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8');
const handlers = read('../hooks/useTransactionHandlers.ts');
assert.match(handlers, /const openEditDeliveryExpense = \(tx: TreasuryTx\)/, 'the window opens on the saved expense');
assert.match(handlers, /setDeliveryExpenseWalletChosen\(true\)/, 'its wallet stays the one chosen then');
assert.match(handlers, /userDocRef\.collection\('treasury_txs'\)\.doc\(editedExpense\.id\)/, 'the same expense is rewritten, not a second one');
assert.match(handlers, /tx\.linkedTxId === editedExpense\.id && tx\.origin === 'delivery_expense'/, 'its old wallet leg goes');
assert.match(handlers, /recordedAt: editedExpense\?\.recordedAt \?\? Date\.now\(\)/, 'the moment it was first recorded is kept');
assert.match(handlers, /amountNum > availableBalance \+ givenBack \+ epsilon/, 'what it already took from that wallet comes back first');
const app = read('../MainApp.tsx');
assert.match(app, /if \(tx\.origin === 'delivery_expense'\) \{\s*\/\/[^\n]*\n\s*openEditDeliveryExpense\(tx\);/, 'editing it from the treasury opens that window');
assert.doesNotMatch(app, /supprimez-le puis enregistrez-le/);

// An expense of 10 USDT raised to 60 USDT, before a sale of 50 that only had 50 left after the 10: refused.
const T = Date.UTC(2026, 10, 15);
const txs = [
    { id: 'b', type: 'buy', currency: 'USDT', quantity: 100, price: 250, total: 25000, timestamp: T },
    { id: 'leg', type: 'Retrait Manuel', currency: 'USDT', quantity: 10, timestamp: T + 1, linkedTxId: 'exp', origin: 'delivery_expense' },
    { id: 's', type: 'sell', currency: 'USDT', quantity: 90, sell: 260, total: 23400, timestamp: T + 2 },
] as unknown as Tx[];
const op = (kind: 'set' | 'delete', id: string, data?: object) => ({ kind, ref: { nativeRef: { path: `users/u/usdt_txs/${id}` } }, data });
assert.equal(batchCreatesNegativeStock(txs, [op('delete', 'leg'), op('set', 'leg2', { type: 'Retrait Manuel', currency: 'USDT', quantity: 60, timestamp: T + 1 })]), true, 'the later sale would oversell');
assert.equal(batchCreatesNegativeStock(txs, [op('delete', 'leg'), op('set', 'leg2', { type: 'Retrait Manuel', currency: 'USDT', quantity: 5, timestamp: T + 1 })]), false, 'a smaller expense is fine');
console.log('projectExpenseEdit.test: a project expense is edited in its own window, the stock stays checked');
