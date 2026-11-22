import assert from 'node:assert/strict';
import { buildDayClose, dayStartMs } from './dayClose';
const now = new Date(2026, 10, 22, 19, 30).getTime();
const start = dayStartMs(now);
const yesterday = start - 3600_000;
const res = buildDayClose({
    now,
    transactions: [
        { id: 's1', type: 'sell', currency: 'USDT', quantity: 100, total: 25_500, timestamp: start + 3600_000 },
        { id: 's2', type: 'sell', currency: 'USDT', quantity: 50, total: 12_800, timestamp: start + 7200_000 },
        { id: 's3', type: 'sell', currency: 'EUR', quantity: 10, total: 2_600, timestamp: start + 7300_000 },
        { id: 'b1', type: 'buy', currency: 'USDT', quantity: 300, total: 75_000, timestamp: start + 600_000 },
        { id: 'old', type: 'sell', currency: 'USDT', quantity: 999, total: 1, timestamp: yesterday },
    ],
    profitByTxId: { s1: { derivedProfit: 500 }, s2: { derivedProfit: 300 }, s3: { derivedProfit: 40 }, old: { derivedProfit: 9_999 } },
    treasury: [
        { type: 'Ajout', source: 'Caisse', amount: 25_500, timestamp: start + 3600_000 },
        { type: 'Retrait', source: 'Caisse', amount: 75_000, timestamp: start + 600_000 },
        { type: 'Ajout', source: 'BaridiMob', amount: 12_800, timestamp: start + 7200_000 },
        { type: 'Ajout', source: 'Caisse', amount: 1, timestamp: yesterday },
    ],
});
assert.equal(res.sales, 3);
assert.equal(res.buys, 1);
assert.deepEqual(res.soldByCurrency, { USDT: 150, EUR: 10 });
assert.deepEqual(res.boughtByCurrency, { USDT: 300 });
assert.equal(res.salesTotal, 40_900);
assert.equal(res.profit, 840);
assert.deepEqual(res.moves, { Caisse: { in: 25_500, out: 75_000 }, BaridiMob: { in: 12_800, out: 0 } });
console.log('dayClose: ok');
