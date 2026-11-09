import assert from 'node:assert/strict';
import { computePamLedger } from './pamLedger';
import { checkRmbTrade, rmbConversionPreview, rmbTradeRows, type RmbTradeInput } from './rmbTrade';
import type { Tx } from '../types';

// V13-3: RMB bought with dinars, with USDT, with EUR, and sold for dinars or for USDT; every figure worked out by hand.
// Fake figures only. The ledger is built WITHOUT options, as most of the app builds it: RMB must never be read as USDT.

const T0 = Date.UTC(2027, 2, 1, 9);
const txs: Tx[] = [];
const clientRows: Array<Record<string, unknown>> = [];
const treasuryRows: Array<Record<string, unknown>> = [];
let n = 0;
const write = (input: RmbTradeInput, profit = 0) => {
    n += 1;
    const id = `r-${n}`;
    const rows = rmbTradeRows(input, T0 + n * 60_000, id, profit);
    txs.push({ id, ...rows.main } as unknown as Tx);
    rows.linked.forEach((row, i) => {
        if (row.collection === 'usdt_txs') txs.push({ id: `${id}-${i}`, ...row.data } as unknown as Tx);
        else if (row.collection === 'dzd_client_txs') clientRows.push(row.data);
        else treasuryRows.push(row.data);
    });
};
const ledger = () => computePamLedger(txs, { nowMs: T0 + 1e10 });
const holding = (code: string) => ledger().holdings[code];

// 0. USDT already in stock: 1 000 at 255 (an ordinary purchase).
txs.push({ id: 'u-1', type: 'buy', currency: 'USDT', quantity: 1_000, price: 255, total: 255_000, timestamp: T0 } as unknown as Tx);
const usdtBefore = { ...ledger().portfolioStats.usdt };

// 1. The owner's example: 7 000 RMB paid with 1 000 USDT. The RMB cost 255 000, 36.43 DZD each. No profit.
assert.deepEqual(rmbConversionPreview({ kind: 'buy', source: 'USDT', quantity: 7_000, otherAmount: 1_000 }, { RMB: 0, EUR: 0, USDT: 255 }), { incoming: 'RMB', avgPrice: 36.43, rate: 7 });
write({ kind: 'buy', source: 'USDT', quantity: 7_000, otherAmount: 1_000, clientId: 'supplier' });
assert.equal(holding('RMB').costBasis, 255_000, 'the RMB carry what the USDT cost');
assert.equal(holding('RMB').available, 7_000);
assert.equal(Math.round(holding('RMB').avgBuy * 100) / 100, 36.43);
assert.equal(ledger().portfolioStats.usdt.available, 0, 'the USDT left the stock');
assert.equal(ledger().totals.derivedProfit, 0, 'a conversion is no profit');
assert.equal(clientRows.length + treasuryRows.length, 0, 'no dinar moved: no client or treasury row');

// 2. 3 000 RMB bought with dinars at 37, paid in cash: 111 000 out of the cash box; the supplier's row is not on his balance.
write({ kind: 'buy', source: 'DZD', quantity: 3_000, price: 37, clientId: 'supplier', paymentStatus: 'cash' });
assert.equal(holding('RMB').costBasis, 366_000);
assert.equal(holding('RMB').available, 10_000);
assert.equal(holding('RMB').avgBuy, 36.6);
assert.deepEqual(treasuryRows.at(-1), { ...treasuryRows.at(-1), type: 'Retrait', source: 'Caisse', amount: 111_000 });
assert.equal(clientRows.at(-1)!.affectsBalance, false);

// 3. 2 000 RMB sold for dinars at 40 on credit: 80 000 on the client's account; profit 2 000 × (40 − 36.6) = 6 800.
write({ kind: 'sell', source: 'DZD', quantity: 2_000, price: 40, clientId: 'client', paymentStatus: 'credit' }, 6_800);
assert.equal(ledger().totals.derivedProfit, 6_800);
assert.equal(ledger().totals.byCurrency.RMB.derivedProfit, 6_800);
assert.deepEqual(clientRows.at(-1), { ...clientRows.at(-1), montant: -80_000, type: 'Vente RMB', affectsBalance: true, paymentMethod: 'Crédit' });
assert.equal(treasuryRows.length, 1, 'on credit: no treasury row');

// 4. 1 400 RMB sold for 200 USDT (option a): the USDT cost 1 400 × 36.6 = 51 240, no profit now.
write({ kind: 'sell', source: 'USDT', quantity: 1_400, otherAmount: 200, clientId: 'client' });
assert.equal(ledger().portfolioStats.usdt.costBasis, 51_240);
assert.equal(ledger().portfolioStats.usdt.available, 200);
assert.equal(ledger().totals.derivedProfit, 6_800, 'unchanged by the conversion');
assert.equal(holding('RMB').available, 6_600);

// 5. RMB never turns into USDT, and the USDT history before RMB is untouched.
assert.equal(usdtBefore.avgBuy, 255);
assert.ok(!ledger().sellProfitRows.some((row) => row.currency === 'USDT'), 'no USDT sale was invented');

// 6. The checks.
const stock = { RMB: 6_600, EUR: 0, USDT: 200 };
assert.deepEqual(checkRmbTrade({ kind: 'sell', source: 'DZD', quantity: 1, price: 40, clientId: 'none', paymentStatus: 'cash' }, stock), { ok: false, reason: 'client' });
assert.deepEqual(checkRmbTrade({ kind: 'sell', source: 'DZD', quantity: 1, price: 40, clientId: 'c', paymentStatus: null }, stock), { ok: false, reason: 'payment' }, 'payment never chosen for the user');
assert.deepEqual(checkRmbTrade({ kind: 'sell', source: 'DZD', quantity: 7_000, price: 40, clientId: 'c', paymentStatus: 'cash' }, stock), { ok: false, reason: 'stock' });
assert.deepEqual(checkRmbTrade({ kind: 'buy', source: 'USDT', quantity: 1_000, otherAmount: 201, clientId: 'c' }, stock), { ok: false, reason: 'source_stock' });
assert.deepEqual(checkRmbTrade({ kind: 'buy', source: 'EUR', quantity: 1_000, otherAmount: 0, clientId: 'c' }, stock), { ok: false, reason: 'amount' });
assert.deepEqual(checkRmbTrade({ kind: 'buy', source: 'DZD', quantity: 1_000, price: 0, clientId: 'c', paymentStatus: 'cash' }, stock), { ok: false, reason: 'price' });
assert.deepEqual(checkRmbTrade({ kind: 'buy', source: 'USDT', quantity: 1_000, otherAmount: 150, clientId: 'c' }, stock), { ok: true });
// 7. With EUR: 500 EUR at 280 (140 000) spent on 3 500 RMB: the RMB cost 140 000, 40 DZD each.
{
    const rows = rmbTradeRows({ kind: 'buy', source: 'EUR', quantity: 3_500, otherAmount: 500, clientId: 's' }, T0 + 1e6, 'e-1');
    const book: Tx[] = [
        { id: 'e-0', type: 'buy', currency: 'EUR', quantity: 500, price: 280, total: 140_000, timestamp: T0 } as unknown as Tx,
        { id: 'e-1', ...rows.main } as unknown as Tx,
        { id: 'e-2', ...rows.linked[0].data } as unknown as Tx,
    ];
    const result = computePamLedger(book, { nowMs: T0 + 1e10 });
    assert.equal(result.holdings.RMB.costBasis, 140_000);
    assert.equal(result.holdings.RMB.avgBuy, 40);
    assert.equal(result.portfolioStats.eur.available, 0);
    assert.equal(result.eurFundedBuys.length, 0, 'not mistaken for the old EUR → USDT purchase');
}
console.log('rmbTrade.test: RMB with dinars, USDT and EUR, profits and costs worked out by hand');
