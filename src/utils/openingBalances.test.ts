import assert from 'node:assert/strict';
import { checkOpening, openingWrites } from './openingBalances';
import { computePamLedger } from './pamLedger';

const at = { date: '2026-11-22', time: '10:00', timestamp: Date.UTC(2026, 10, 22, 10) };
let n = 0; const id = () => `id${++n}`;
const input = { managerName: 'Gérant', cash: [{ accountId: 'Caisse', amount: 500_000 }, { accountId: 'BaridiMob', amount: 120_000 }, { accountId: 'acc_bna', amount: 0 }], stocks: [{ currency: 'USDT', quantity: 2_000, avgPrice: 250 }, { currency: 'RMB', quantity: 1_000, avgPrice: 32.5 }] };

// 1. Total and checks.
assert.deepEqual(checkOpening(input), { ok: true, total: 500_000 + 120_000 + 500_000 + 32_500 });
assert.deepEqual(checkOpening({ ...input, managerName: ' ' }), { ok: false, reason: 'name' });
assert.deepEqual(checkOpening({ managerName: '', cash: [], stocks: [] }), { ok: true, total: 0 });
assert.deepEqual(checkOpening({ ...input, stocks: [{ currency: 'USDT', quantity: 10, avgPrice: 0 }] }), { ok: false, reason: 'stock' });
assert.deepEqual(checkOpening({ ...input, cash: [{ accountId: 'Caisse', amount: -1 }] }), { ok: false, reason: 'amount' });
assert.deepEqual(openingWrites({ managerName: '', cash: [], stocks: [] }, at, id), []);

const writes = openingWrites(input, at, id);
const of = (c: string) => writes.filter((w) => w.collection === c).map((w) => w.data as any);
// 2. One manager whose capital is the total, and every deposit is his.
const [manager] = of('investors');
assert.equal(of('investors').length, 1);
assert.equal(manager.isManager, true);
assert.equal(manager.initialCapital, 1_152_500);
const deposits = of('investor_transactions');
assert.equal(deposits.length, 4); // Caisse, BaridiMob, USDT, RMB (the empty BNA writes nothing)
assert.ok(deposits.every((d) => d.investorId === manager.id && d.type === 'deposit_capital'));
assert.equal(deposits.reduce((s, d) => s + d.amount, 0), manager.initialCapital);

// 3. Treasury: each account holds what was typed; the Caisse gets the stock value in and out.
const balance = (source: string) => of('treasury_txs').filter((t) => t.source === source).reduce((s, t) => s + (t.type === 'Ajout' ? t.amount : -t.amount), 0);
assert.equal(balance('Caisse'), 500_000);
assert.equal(balance('BaridiMob'), 120_000);
assert.equal(balance('acc_bna'), 0);
assert.ok(of('treasury_txs').every((t) => t.linkedInvestorTxId || t.linkedTxId));

// 4. Stock and average price as typed, and the first sale's profit is counted from it.
const sale = { id: 'sale', type: 'sell', currency: 'USDT', quantity: 100, price: 255, total: 25_500, timestamp: at.timestamp + 60_000, date: at.date, time: '10:01' };
const ledger = computePamLedger([...writes.filter((w) => w.collection === 'usdt_txs').map((w) => ({ id: w.id, ...w.data })), sale] as never, { nowMs: Infinity });
assert.equal(ledger.portfolioStats.usdt.available, 1_900);
assert.equal(ledger.portfolioStats.usdt.avgBuy, 250);
assert.equal(ledger.portfolioStats.usdt.costBasis, 475_000);
assert.equal(ledger.profitByTxId.sale.derivedProfit, 500);
console.log('openingBalances: ok');
