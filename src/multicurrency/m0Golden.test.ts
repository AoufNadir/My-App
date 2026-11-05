import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

import { computePamLedger, EUR_FUNDED_COST_RULE_FROM_TS } from '../utils/pamLedger';
import { computeCapitalSnapshot } from '../utils/capitalSnapshot';
import type { Tx } from '../types';

// M0 of the multi-currency work: today's numbers, pinned. A made-up history that goes through every case the
// ledger knows (buys, sales, manual adds and withdrawals, quantity-only adds, an oversell, a 24h lock, a USDT
// sale settled in EUR, a USDT purchase paid with EUR) is run through the ledger and the capital, and the result
// must stay equal, to the cent, to the copy saved in m0Golden.json. The generic multi-currency ledger (M1) has
// to give this same file. To write it again on purpose: UPDATE_GOLDEN=1 node --import tsx <this file>.

const DAY = 86_400_000;
const T0 = EUR_FUNDED_COST_RULE_FROM_TS + 2 * DAY; // after the EUR-funded cost rule
const NOW = T0 + 40 * DAY;
let n = 0;
const tx = (input: Partial<Tx> & Pick<Tx, 'type' | 'currency' | 'quantity'>, day: number): Tx => {
    n += 1;
    const ts = T0 + day * DAY + n * 1000;
    const d = new Date(ts);
    return { id: `m0-${String(n).padStart(2, '0')}`, timestamp: ts, date: `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`, time: '10:00', ...input } as Tx;
};

const history: Tx[] = [
    tx({ type: 'Ajout Manuel', currency: 'USDT', quantity: 1_000, price: 240, total: 240_000 }, 0),
    tx({ type: 'Ajout Manuel', currency: 'EUR', quantity: 500, price: 250, total: 125_000 }, 0),
    tx({ type: 'buy', currency: 'USDT', quantity: 2_000, price: 245, total: 490_000 }, 1),
    tx({ type: 'sell', currency: 'USDT', quantity: 1_200, sell: 250, total: 300_000, profit: 0 }, 2),
    tx({ type: 'buy', currency: 'EUR', quantity: 1_000, price: 252.5, total: 252_500 }, 3),
    tx({ type: 'sell', currency: 'EUR', quantity: 300, sell: 258, total: 77_400, profit: 0 }, 4),
    tx({ type: 'Ajout Manuel', currency: 'USDT', quantity: 15.5 }, 5), // quantity only, no cost
    tx({ type: 'Retrait Manuel', currency: 'USDT', quantity: 100 }, 6),
    tx({ type: 'buy', currency: 'USDT', quantity: 500, price: 247.75, total: 123_875, lockedUntil: NOW + DAY }, 7),
    // USDT sold, paid in EUR: 400 USDT for 370 EUR, recorded with its DZD equivalent.
    tx({ type: 'sell', currency: 'USDT', quantity: 400, sell: 251.2, total: 100_480, profit: 0, settlementCurrency: 'EUR', sellPriceEur: 0.925, saleValueEur: 370, eurToDzdRateAtSale: 271.57 }, 8),
    tx({ type: 'Ajout Manuel', currency: 'EUR', quantity: 370, price: 271.57, total: 100_480.9 }, 8),
];
// A USDT purchase paid with 270 EUR (the linked EUR withdrawal carries the buy id).
const eurFundedBuy = tx({ type: 'buy', currency: 'USDT', quantity: 300, price: 240, total: 72_000 }, 10);
history.push(eurFundedBuy, tx({ type: 'Retrait Manuel', currency: 'EUR', quantity: 270, linkedTxId: eurFundedBuy.id, notes: 'Achat de 300 USDT' }, 10));
history.push(
    tx({ type: 'sell', currency: 'USDT', quantity: 1_500, sell: 252, total: 378_000, profit: 0 }, 12),
    tx({ type: 'sell', currency: 'EUR', quantity: 900, sell: 260.4, total: 234_360, profit: 0 }, 14),
    tx({ type: 'sell', currency: 'USDT', quantity: 900, sell: 249, total: 224_100, profit: 0 }, 20), // more than the free stock
);

const r2 = (value: number) => Math.round(value * 100) / 100;
const ledger = computePamLedger(history, { nowMs: NOW });
const capital = computeCapitalSnapshot({
    caisseBalance: 812_345.67, baridiBalance: 156_000.5, portfolioStats: ledger.portfolioStats,
    totalDettes: -95_000, totalAvances: 12_500.25, investorLiability: 400_000, managerPendingAdvances: 3_000,
});
const pinned = {
    portfolio: ledger.portfolioStats,
    totals: ledger.totals,
    rows: ledger.operationRows.map((row) => ({ id: row.txId, currency: row.currency, type: row.type, after: row.statsAfter, costBasisChange: r2(row.costBasisChange), warnings: row.warnings.map((w) => w.code) })),
    profits: Object.fromEntries(Object.entries(ledger.profitByTxId).map(([id, row]) => [id, r2(Number(row.derivedProfit))])),
    eurFundedBuys: ledger.eurFundedBuys,
    capital,
};

// A few figures worked out by hand, so the saved file cannot pin a wrong ledger by accident.
// Opening 1 000 at 240, then 2 000 at 245: PAM 243.333…, and 1 200 sold at 250 earn 1 200 × 6.666… = 8 000.
assert.equal(pinned.profits['m0-04'], 8_000, 'first USDT sale by hand');
// EUR: 500 at 250, then 1 000 at 252.5 → PAM 251.666…; 300 sold at 258 earn 300 × 6.333… = 1 900.
assert.equal(pinned.profits['m0-06'], 1_900, 'first EUR sale by hand');
assert.equal(ledger.eurFundedBuys.length, 1, 'the EUR-paid purchase is recognised');

const file = new URL('./m0Golden.json', import.meta.url);
const text = `${JSON.stringify(pinned, null, 1)}\n`;
if (process.env.UPDATE_GOLDEN === '1' || !existsSync(file)) {
    writeFileSync(file, text);
    console.log('m0Golden: reference written');
}
assert.deepEqual(JSON.parse(text), JSON.parse(readFileSync(file, 'utf8')), 'the ledger and the capital give the pinned numbers');
console.log('m0Golden tests passed: ledger and capital equal to the pinned reference');
