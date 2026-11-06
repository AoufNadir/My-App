import assert from 'node:assert/strict';

import { computePamLedger } from '../utils/pamLedger';
import { computeAccountBalances } from './accountBalances';
import { checkCurrencyOperation, currencyOperationRows, type CurrencyOperation } from './currencyOperations';
import type { Tx, TreasuryTx } from '../types';

// M4: the rows written for a purchase, a sale and a conversion of GBP / CNY give, through the same ledger as
// USDT and EUR, the PAM and the profit worked out by hand. Fake figures only.

const T0 = Date.UTC(2027, 1, 1, 9);
const accounts = [{ id: 'Caisse', name: 'Caisse', kind: 'cash' as const }, { id: 'BaridiMob', name: 'BaridiMob', kind: 'bank' as const }, { id: 'acc-1', name: 'Banque', kind: 'bank' as const }];
const txs: Tx[] = [];
const treasury: TreasuryTx[] = [{ id: 'open', type: 'Ajout', source: 'acc-1', amount: 1_000_000, timestamp: T0 - 10 } as unknown as TreasuryTx];
let n = 0;
const write = (op: CurrencyOperation, at: number) => {
    n += 1;
    const id = `m-${n}`;
    const rows = currencyOperationRows(op, at, id);
    txs.push({ id, ...rows.main } as unknown as Tx);
    if (rows.linked.collection === 'usdt_txs') txs.push({ id: `l-${n}`, ...rows.linked.data } as unknown as Tx);
    else treasury.push({ id: `l-${n}`, ...rows.linked.data } as unknown as TreasuryTx);
};
const ledger = () => computePamLedger(txs, { currencies: ['GBP', 'CNY'], nowMs: T0 + 1e9 });
const balances = () => computeAccountBalances(treasury, accounts).byAccount;

// 1. 1 000 GBP at 280 from the bank account: PAM 280, the account down 280 000.
write({ kind: 'buy', currency: 'GBP', quantity: 1_000, price: 280, accountId: 'acc-1' }, T0);
assert.equal(ledger().holdings.GBP.avgBuy, 280);
assert.equal(balances()['acc-1'], 720_000);

// 2. 400 GBP converted to 3 600 CNY: the CNY cost 400 × 280 = 112 000, no profit.
write({ kind: 'convert', from: 'GBP', fromQuantity: 400, to: 'CNY', toQuantity: 3_600 }, T0 + 1000);
assert.equal(ledger().holdings.CNY.costBasis, 112_000);
assert.equal(ledger().holdings.GBP.available, 600);
assert.equal(ledger().totals.derivedProfit, 0, 'a conversion makes no profit');

// 3. 600 GBP sold at 300 into the cash box: profit 600 × 20 = 12 000.
write({ kind: 'sell', currency: 'GBP', quantity: 600, price: 300, accountId: 'Caisse' }, T0 + 2000);
assert.equal(ledger().totals.derivedProfit, 12_000);
assert.equal(balances().Caisse, 180_000);

// 4. The checks.
const stock = { GBP: 0, CNY: 3_600 };
assert.deepEqual(checkCurrencyOperation({ kind: 'sell', currency: 'GBP', quantity: 1, price: 300, accountId: 'Caisse' }, stock, balances()), { ok: false, reason: 'stock' });
assert.deepEqual(checkCurrencyOperation({ kind: 'buy', currency: 'GBP', quantity: 10_000, price: 280, accountId: 'acc-1' }, stock, balances()), { ok: false, reason: 'account' });
assert.deepEqual(checkCurrencyOperation({ kind: 'convert', from: 'CNY', fromQuantity: 10, to: 'CNY', toQuantity: 10 }, stock, balances()), { ok: false, reason: 'same_currency' });
assert.deepEqual(checkCurrencyOperation({ kind: 'buy', currency: 'GBP', quantity: 1, price: 0, accountId: 'acc-1' }, stock, balances()), { ok: false, reason: 'price' });
assert.deepEqual(checkCurrencyOperation({ kind: 'convert', from: 'CNY', fromQuantity: 3_600, to: 'USDT', toQuantity: 500 }, stock, balances()), { ok: true });

console.log('currencyOperations: ok');
