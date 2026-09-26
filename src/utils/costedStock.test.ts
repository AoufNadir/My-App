import assert from 'node:assert/strict';

import { computePamLedger } from './pamLedger';
import { sellHasNoPurchaseCost } from './costedStock';
import type { Tx } from '../types';

const tx = (fields: Record<string, unknown>) => ({ currency: 'USDT', date: '01/09/2026', time: '10:00', ...fields }) as unknown as Tx;
const sell100At250 = (timestamp: number) => tx({ id: 'sell', type: 'sell', quantity: 100, sell: 250, total: 25_000, timestamp });

// Audit bug 7: 100 USDT added by hand without a price, then sold at 250 DZD, booked
// the whole 25 000 DZD sale as profit. That sell is now refused.
{
    const manualAdd = tx({ id: 'add', type: 'Ajout Manuel', quantity: 100, timestamp: 1 });
    const stats = computePamLedger([manualAdd]).portfolioStats.usdt;
    assert.equal(stats.available, 100);
    assert.equal(stats.purchasedQty, 0);
    assert.equal(sellHasNoPurchaseCost({ quantity: 100, costedQuantity: stats.purchasedQty }), true);
    assert.equal(computePamLedger([manualAdd, sell100At250(2)]).profitByTxId.sell.derivedProfit, 25_000);
}

// The fix the message asks for: a Retrait Manuel of that stock, then an Ajout Manuel with its
// price. The sell is then allowed and books only the margin.
{
    const rows = [
        tx({ id: 'add', type: 'Ajout Manuel', quantity: 100, timestamp: 1 }),
        tx({ id: 'out', type: 'Retrait Manuel', quantity: 100, timestamp: 2 }),
        tx({ id: 'add-priced', type: 'Ajout Manuel', quantity: 100, price: 240, total: 24_000, timestamp: 3 }),
    ];
    const stats = computePamLedger(rows).portfolioStats.usdt;
    assert.equal(stats.available, 100);
    assert.equal(stats.purchasedQty, 100);
    assert.equal(sellHasNoPurchaseCost({ quantity: 100, costedQuantity: stats.purchasedQty }), false);
    assert.equal(computePamLedger([...rows, sell100At250(4)]).profitByTxId.sell.derivedProfit, 1_000);
}

// When part of the stock has a cost, every sold unit is priced at that PAM: allowed, no free profit.
{
    const rows = [
        tx({ id: 'buy', type: 'buy', quantity: 60, total: 14_400, timestamp: 1 }),
        tx({ id: 'add', type: 'Ajout Manuel', quantity: 40, timestamp: 2 }),
    ];
    const stats = computePamLedger(rows).portfolioStats.usdt;
    assert.equal(stats.purchasedQty, 60);
    assert.equal(sellHasNoPurchaseCost({ quantity: 100, costedQuantity: stats.purchasedQty }), false);
    assert.equal(computePamLedger([...rows, sell100At250(3)]).profitByTxId.sell.derivedProfit, 1_000);
}

// Recorded sells stay editable, and empty quantities are left to the other checks.
{
    assert.equal(sellHasNoPurchaseCost({ quantity: 100, costedQuantity: 0, isEdit: true }), false);
    assert.equal(sellHasNoPurchaseCost({ quantity: 0, costedQuantity: 0 }), false);
    assert.equal(sellHasNoPurchaseCost({ quantity: 1, costedQuantity: 0.004 }), true);
    assert.equal(sellHasNoPurchaseCost({ quantity: 1, costedQuantity: 0.01 }), false);
}

console.log('costedStock tests passed');
