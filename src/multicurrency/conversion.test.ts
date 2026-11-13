import assert from 'node:assert/strict';

import { computePamLedger } from '../utils/pamLedger';
import type { Tx } from '../types';

// M1: the ledger keeps any currency, and a conversion (a marked withdrawal of one currency linked to the
// purchase of another) moves the cost without profit or loss. Every figure below is worked out by hand.

const DAY = 86_400_000;
const T0 = Date.UTC(2027, 0, 10, 9);
let n = 0;
const tx = (input: Partial<Tx> & Pick<Tx, 'type' | 'currency' | 'quantity'>, day = 0): Tx => {
    n += 1;
    return { id: `c-${n}`, timestamp: T0 + day * DAY + n * 1000, date: '10/1/2027', time: '10:00', ...input } as unknown as Tx;
};
const convert = (from: string, fromQty: number, to: string, toQty: number, day: number): Tx[] => {
    const buy = tx({ type: 'buy', currency: to as Tx['currency'], quantity: toQty, total: 0 }, day);
    return [buy, tx({ type: 'Retrait Manuel', currency: from as Tx['currency'], quantity: fromQty, linkedTxId: buy.id, conversionLeg: 'out' }, day)];
};
const opts = { currencies: ['GBP', 'CNY'], nowMs: T0 + 100 * DAY };
const holding = (rows: Tx[], code: string) => computePamLedger(rows, opts).holdings[code];

// 1. 1 000 GBP bought at 280 = 280 000; converted to 1 250 USDT: the USDT cost 280 000 (PAM 224), no profit.
//    Selling the 1 250 USDT at 250 earns 1 250 × (250 − 224) = 32 500.
{
    const rows = [tx({ type: 'buy', currency: 'GBP' as Tx['currency'], quantity: 1_000, price: 280, total: 280_000 }), ...convert('GBP', 1_000, 'USDT', 1_250, 1)];
    const after = computePamLedger(rows, opts);
    assert.equal(after.holdings.USDT.costBasis, 280_000, 'the USDT cost what the GBP cost');
    assert.equal(after.holdings.USDT.avgBuy, 224, 'USDT PAM 224');
    assert.equal(after.holdings.GBP.available, 0, 'the GBP left the stock');
    assert.equal(after.totals.derivedProfit, 0, 'a conversion makes no profit');
    assert.equal(after.conversions.length, 1);
    assert.equal(after.conversions[0].fromCurrency, 'GBP');
    const sold = computePamLedger([...rows, tx({ type: 'sell', currency: 'USDT', quantity: 1_250, sell: 250, total: 312_500 }, 2)], opts);
    assert.equal(sold.totals.derivedProfit, 32_500, 'the profit comes at the sale');
    assert.equal(sold.totals.byCurrency.USDT.derivedProfit, 32_500);
}

// 2. Part of the stock: 1 000 GBP at 270 and 1 000 at 290 (PAM 280); 500 converted carry 500 × 280 = 140 000.
{
    const rows = [
        tx({ type: 'buy', currency: 'GBP' as Tx['currency'], quantity: 1_000, total: 270_000 }),
        tx({ type: 'buy', currency: 'GBP' as Tx['currency'], quantity: 1_000, total: 290_000 }),
        ...convert('GBP', 500, 'CNY', 4_600, 1),
    ];
    assert.equal(holding(rows, 'CNY').costBasis, 140_000, 'CNY cost = 500 GBP at their PAM');
    assert.equal(holding(rows, 'GBP').costBasis, 420_000, '1 500 GBP left at 280');
    assert.equal(holding(rows, 'GBP').avgBuy, 280);
}

// 3. A chain: GBP to EUR to USDT carries the same 280 000 all along.
{
    const rows = [
        tx({ type: 'buy', currency: 'GBP' as Tx['currency'], quantity: 2_000, total: 560_000 }),
        ...convert('GBP', 1_000, 'EUR', 1_150, 1),
        ...convert('EUR', 1_150, 'USDT', 1_300, 2),
    ];
    const result = computePamLedger(rows, opts);
    assert.equal(result.holdings.EUR.available, 0);
    assert.equal(result.holdings.USDT.costBasis, 280_000, 'the cost went through EUR unchanged');
    assert.equal(result.holdings.GBP.costBasis, 280_000, 'the other 1 000 GBP keep theirs');
    assert.equal(result.totals.derivedProfit, 0);
}

// 4. The total cost of all the stock never moves in a conversion, even with a rate that looks like a loss.
{
    const rows = [
        tx({ type: 'buy', currency: 'CNY' as Tx['currency'], quantity: 10_000, total: 190_000 }),
        ...convert('CNY', 10_000, 'USDT', 600, 1), // fewer USDT than the CNY would buy: still no loss booked
    ];
    const result = computePamLedger(rows, opts);
    const total = Object.values(result.holdings).reduce((sum, h) => sum + h.costBasis, 0);
    assert.equal(total, 190_000, 'the cost is kept');
    assert.equal(result.totals.derivedProfit, 0, 'no loss at conversion');
}

// 5. Without the mark, a withdrawal linked to another purchase is not a conversion (old data stays as it was).
{
    const buy = tx({ type: 'buy', currency: 'USDT', quantity: 100, total: 25_000 }, 1);
    const rows = [tx({ type: 'buy', currency: 'GBP' as Tx['currency'], quantity: 100, total: 28_000 }), buy, tx({ type: 'Retrait Manuel', currency: 'GBP' as Tx['currency'], quantity: 100, linkedTxId: buy.id }, 1)];
    assert.equal(holding(rows, 'USDT').costBasis, 25_000, 'the saved total is kept');
}

// 6. By default nothing changes: only USDT and EUR, an unknown code is read as USDT as before, base DZD.
{
    const rows = [tx({ type: 'buy', currency: 'XYZ' as Tx['currency'], quantity: 10, total: 2_800 })];
    const plain = computePamLedger(rows, { nowMs: T0 + DAY });
    assert.deepEqual(Object.keys(plain.holdings), ['USDT', 'EUR']);
    assert.equal(plain.holdings.USDT.available, 10, 'old reading: not EUR means USDT');
    assert.equal(plain.baseCurrency, 'DZD');
}

console.log('multi-currency conversion tests passed: cost carried without profit, chains, part of a stock, legacy reading kept');
