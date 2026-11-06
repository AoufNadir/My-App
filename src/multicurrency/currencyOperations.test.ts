import assert from 'node:assert/strict';

import { computePamLedger } from '../utils/pamLedger';
import { checkCurrencyOperation, conversionPam, currencyOperationRows, walletOpeningRow, type CurrencyOperation } from './currencyOperations';
import { computeWalletViews } from './walletBalances';
import type { BusinessAccount } from './businessSettings';
import type { Tx, TreasuryTx } from '../types';

// Wallets with their currency, purchases and sales paid from any wallet, and the conversion worked out by hand.
// Fake figures only. Base currency DZD.

const T0 = Date.UTC(2027, 1, 1, 9);
const accounts: BusinessAccount[] = [
    { id: 'cash', name: 'Caisse', kind: 'cash', currency: 'DZD' },
    { id: 'wise', name: 'Wise', kind: 'online', currency: 'EUR' },
    { id: 'usd', name: 'Compte USD', kind: 'online', currency: 'USD' },
    { id: 'bin1', name: 'Binance', kind: 'online', currency: 'USDT' },
    { id: 'bin2', name: 'OKX', kind: 'online', currency: 'USDT' },
];
const traded = ['EUR', 'USD', 'USDT'];
const txs: Tx[] = [];
const treasury: TreasuryTx[] = [];
let n = 0;
let clock = T0;
const push = (row: { collection: string; data: Record<string, unknown> }, id: string) => {
    if (row.collection === 'usdt_txs') txs.push({ id, ...row.data } as unknown as Tx);
    else treasury.push({ id, ...row.data } as unknown as TreasuryTx);
};
const write = (op: CurrencyOperation) => {
    n += 1;
    clock += 60_000;
    const rows = currencyOperationRows(op, 'DZD', clock, `m-${n}`);
    txs.push({ id: `m-${n}`, ...rows.main } as unknown as Tx);
    push(rows.linked, `l-${n}`);
};
const ledger = () => computePamLedger(txs, { currencies: ['USD'], nowMs: T0 + 1e10 });
const views = () => {
    const l = ledger();
    const stock = Object.fromEntries(Object.keys(l.holdings).map((c) => [c, l.holdings[c].available]));
    return Object.fromEntries(computeWalletViews({ accounts, base: 'DZD', traded, transactions: txs, treasuryTransactions: treasury, stock }).map((v) => [v.id, v.balance]));
};

// 1. Openings: 1 000 000 DZD in the cash box; 500 USDT in OKX bought at 250 on average.
push(walletOpeningRow({ walletId: 'cash', currency: 'DZD', quantity: 1_000_000, avgPrice: 0 }, 'DZD', T0), 'o-1');
push(walletOpeningRow({ walletId: 'bin2', currency: 'USDT', quantity: 500, avgPrice: 250 }, 'DZD', T0), 'o-2');
assert.equal(views().cash, 1_000_000);
assert.equal(views().bin2, 500);
assert.equal(ledger().holdings.USDT.avgBuy, 250);
assert.equal(ledger().totals.derivedProfit, 0, 'an opening is no profit');

// 2. The owner's example: 1 000 EUR at 280 (280 000 DZD from the cash box)…
write({ kind: 'buy', currency: 'EUR', quantity: 1_000, walletId: 'wise', other: { walletId: 'cash', currency: 'DZD', amount: 280_000 } });
assert.equal(ledger().holdings.EUR.avgBuy, 280);
assert.equal(views().cash, 720_000);
assert.equal(views().wise, 1_000);
// …the 1 000 EUR spent on 1 111.11 USD (1 USD = 0.90 EUR): the USD cost 280 000, so 252 DZD each.
assert.equal(conversionPam(1_000, 280, 1_111.11), 252);
write({ kind: 'buy', currency: 'USD', quantity: 1_111.11, walletId: 'usd', other: { walletId: 'wise', currency: 'EUR', amount: 1_000 } });
assert.equal(ledger().holdings.USD.costBasis, 280_000, 'the USD carry what the EUR cost');
assert.equal(Math.round(ledger().holdings.USD.avgBuy * 100) / 100, 252);
assert.equal(views().wise, 0);
assert.equal(views().usd, 1_111.11);
assert.equal(ledger().totals.derivedProfit, 0, 'a conversion is no profit');
// The profit comes at the sale: 1 111.11 USD at 260 into the cash box = 8 888.88 (to the cent).
write({ kind: 'sell', currency: 'USD', quantity: 1_111.11, walletId: 'usd', other: { walletId: 'cash', currency: 'DZD', amount: 288_888.6 } });
assert.equal(Math.round(ledger().totals.derivedProfit * 100) / 100, 8_888.6);
assert.equal(views().cash, 1_008_888.6);

// 3. Selling USDT for EUR (the other way round): 200 USDT from OKX for 180 EUR into Wise. The EUR cost 200 × 250.
write({ kind: 'sell', currency: 'USDT', quantity: 200, walletId: 'bin2', other: { walletId: 'wise', currency: 'EUR', amount: 180 } });
assert.equal(ledger().holdings.EUR.costBasis, 50_000);
assert.equal(views().bin2, 300);
assert.equal(views().bin1, 0, 'the first USDT wallet holds the rest: nothing');
assert.equal(views().wise, 180);

// 4. The checks.
const b = views();
assert.deepEqual(checkCurrencyOperation({ kind: 'sell', currency: 'USDT', quantity: 301, walletId: 'bin2', other: { walletId: 'cash', currency: 'DZD', amount: 1 } }, b), { ok: false, reason: 'stock' });
assert.deepEqual(checkCurrencyOperation({ kind: 'buy', currency: 'USDT', quantity: 1, walletId: 'bin1', other: { walletId: 'wise', currency: 'EUR', amount: 181 } }, b), { ok: false, reason: 'account' });
assert.deepEqual(checkCurrencyOperation({ kind: 'buy', currency: 'EUR', quantity: 1, walletId: 'wise', other: { walletId: 'wise', currency: 'EUR', amount: 1 } }, b), { ok: false, reason: 'same_currency' });
assert.deepEqual(checkCurrencyOperation({ kind: 'buy', currency: 'USDT', quantity: 1, walletId: 'bin1', other: { walletId: 'cash', currency: 'DZD', amount: 0 } }, b), { ok: false, reason: 'amount' });
assert.deepEqual(checkCurrencyOperation({ kind: 'buy', currency: 'USDT', quantity: 100, walletId: 'bin1', other: { walletId: 'cash', currency: 'DZD', amount: 25_000 } }, b), { ok: true });

console.log('currencyOperations: ok');
