import assert from 'node:assert/strict';
import { computePamLedger } from './pamLedger';
import { rmbTradeRows, type RmbTradeInput } from './rmbTrade';
import type { Tx } from '../types';

// V13-6 (audit, scenario 8): the old "buy USDT with EUR" after EUR that came from USDT. Fake figures only.
const T = Date.UTC(2027, 4, 1, 9);
const book: Tx[] = [];
let k = 0;
const at = () => T + (++k) * 60_000;
const push = (tx: Record<string, unknown>) => book.push({ id: `t${book.length}`, ...tx } as unknown as Tx);
const trade = (input: RmbTradeInput, profit = 0) => {
    const id = `x${book.length}`;
    const rows = rmbTradeRows(input, at(), id, profit);
    book.push({ id, ...rows.main } as unknown as Tx, ...rows.linked.filter((r) => r.collection === 'usdt_txs').map((r, j) => ({ id: `${id}-${j}`, ...r.data } as unknown as Tx)));
};
push({ type: 'buy', currency: 'USDT', quantity: 100, price: 240, total: 24_000, timestamp: at() });                        // 1
trade({ kind: 'buy', currency: 'EUR', source: 'USDT', quantity: 20, otherAmount: 20, clientId: 'c' });                     // 2 (conversion)
push({ type: 'sell', currency: 'USDT', quantity: 40, sell: 250, total: 10_000, timestamp: at() });                         // 3
trade({ kind: 'buy', currency: 'RMB', source: 'USDT', quantity: 70, otherAmount: 10, clientId: 'c' });                     // 4
trade({ kind: 'sell', currency: 'RMB', source: 'DZD', quantity: 35, price: 40, clientId: 'c', paymentStatus: 'cash' });   // 5
push({ type: 'buy', currency: 'EUR', quantity: 20, price: 260, total: 5_200, timestamp: at() });                           // 6
push({ type: 'sell', currency: 'EUR', quantity: 10, sell: 270, total: 2_700, timestamp: at() });                           // 7
const ts8 = at();                                                                                                           // 8: as handleBuy writes it
push({ id: 'b8', type: 'buy', currency: 'USDT', quantity: 2, price: 250, total: 500, timestamp: ts8, purchaseFundingCurrency: 'EUR', purchaseAmountEur: 2, eurToDzdRateAtPurchase: 250, eurPerUsdtAtPurchase: 1 });
push({ type: 'Retrait Manuel', currency: 'EUR', quantity: 2, timestamp: ts8 - 1, linkedTxId: 'b8' });
const l = computePamLedger(book, { nowMs: T + 1e10 });
assert.equal(l.portfolioStats.usdt.available, 32);
assert.equal(Math.round(l.portfolioStats.usdt.costBasis), 7_700, 'the 2 USDT carry the 500 the EUR cost');
assert.equal(Math.round(l.portfolioStats.eur.costBasis), 7_000);
console.log('eurUsdtAudit.test: USDT bought with EUR keeps the EUR cost');
