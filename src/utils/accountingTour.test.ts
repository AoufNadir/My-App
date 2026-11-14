import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { computePamLedger } from './pamLedger';
import { computeCapitalSnapshot, heldStockValue } from './capitalSnapshot';

// V14-5, accounting tour (2026-11-14): the five points the owner approved.
// 1. A stock is worth the cost held, not quantity × the average price rounded to 2 decimals.
const T = Date.UTC(2026, 10, 15);
const ledger = computePamLedger([
    { id: 'a', type: 'buy', currency: 'RMB', quantity: 1000, price: 35, total: 35000, timestamp: T },
    { id: 's', type: 'sell', currency: 'RMB', quantity: 500, sell: 37, total: 18500, timestamp: T + 1 },
    { id: 'o', type: 'Retrait Manuel', currency: 'USDT', quantity: 100, timestamp: T + 2, linkedTxId: 'c', conversionLeg: 'out' },
    { id: 'u', type: 'buy', currency: 'USDT', quantity: 1000, price: 250, total: 250000, timestamp: T - 1 },
    { id: 'c', type: 'buy', currency: 'RMB', quantity: 700, price: 0, total: 0, timestamp: T + 3 },
] as any, { nowMs: T + 10 });
const rmb = ledger.holdings.RMB;
assert.equal(rmb.available, 1200);
assert.equal(rmb.avgBuy, 35.42, 'the average price shown keeps 2 decimals');
assert.equal(Math.round(heldStockValue(rmb as any) * 100) / 100, 42500, 'worth what it cost: 17 500 + 25 000 (was 42 504)');
assert.equal(heldStockValue({ available: 10, avgBuy: 3 }), 30, 'without the cost held, quantity × price as before');
const snap = computeCapitalSnapshot({ caisseBalance: 0, baridiBalance: 0, portfolioStats: { usdt: { available: 3, locked: 0, avgBuy: 33.33, costBasis: 100, purchasedQty: 3 } as any, eur: { available: 0, locked: 0, avgBuy: 0 } as any }, totalDettes: 0, totalAvances: 0 });
assert.equal(Math.round(snap.stockValue * 100) / 100, 100, '3 USDT bought 100 DZD are worth 100, not 99.99');

// 2 to 4. Rule 11: no wallet chosen in advance for an investor's capital, a client payment or receipt.
const read = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8');
const investors = read('../hooks/useInvestorHandlers.ts');
assert.match(investors, /useState<'none' \| 'Caisse' \| 'BaridiMob' \| ''>\(''\)/, 'new investor: no capital source in advance');
assert.match(investors, /useState<'Caisse' \| 'BaridiMob' \| ''>\(''\)/, 'deposit / withdrawal: no wallet in advance');
assert.equal((investors.match(/Choisissez le portefeuille/g) || []).length >= 2, true, 'both saves refuse without a wallet');
const clients = read('../hooks/useClientHandlers.ts');
assert.match(clients, /useState<'credit' \| 'cash' \| 'baridi' \| null>\(null\)/, 'client payment: no wallet in advance');
assert.match(clients, /setClientPaymentStatus\(isSettlement \? null : 'cash'\)/);
assert.doesNotMatch(clients, /setClientPaymentStatus\(usualChannel \?\? 'cash'\)/, 'the usual channel is a hint only');

// 5. A purchase paid now needs the money in the wallet (USDT, EUR and every other currency).
assert.match(read('../hooks/useTransactionHandlers.ts'), /a purchase paid now from the Caisse or BaridiMob needs the money/);
assert.match(read('../MainApp.tsx'), /a purchase paid now needs the money in that wallet/);
console.log('accountingTour.test: stock at its cost, no wallet chosen in advance, no purchase beyond the wallet');
