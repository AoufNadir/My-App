import assert from 'node:assert/strict';

import { computePamLedger, summarizeEurFundedCostImpact } from './pamLedger';
import type { Tx } from '../types';

const tx = (fields: Record<string, unknown>) => ({ date: '01/09/2026', time: '10:00', ...fields }) as unknown as Tx;
const T = (day: number) => new Date(2026, 8, day, 10).getTime();

// 1 000 EUR bought, then turned into 1 000 USDT (1 EUR = 1 USDT). The form saved the USDT at
// the EUR PAM of that moment, 250 DZD: 250 000 DZD. Then 500 USDT are sold at 260 DZD.
const eurBuy = (total: number) => tx({ id: 'eur-buy', type: 'buy', currency: 'EUR', quantity: 1_000, total, timestamp: T(1) });
const conversion = [
    tx({ id: 'eur-out', type: 'Retrait Manuel', currency: 'EUR', quantity: 1_000, linkedTxId: 'usdt-buy', notes: 'Achat de 1 000 USDT', timestamp: T(3) - 1 }),
    tx({ id: 'usdt-buy', type: 'buy', currency: 'USDT', quantity: 1_000, price: 250, total: 250_000, purchaseFundingCurrency: 'EUR', purchaseAmountEur: 1_000, eurToDzdRateAtPurchase: 250, timestamp: T(3) }),
];
const sell = tx({ id: 'sell', type: 'sell', currency: 'USDT', quantity: 500, sell: 260, total: 130_000, timestamp: T(4) });
const eurRemoved = (ledger: ReturnType<typeof computePamLedger>) => -ledger.operationRows.find((row) => row.txId === 'eur-out')!.costBasisChange;
const usdtAdded = (ledger: ReturnType<typeof computePamLedger>) => ledger.operationRows.find((row) => row.txId === 'usdt-buy')!.costBasisChange;

// Nothing changed since the entry: the ledger gives the saved total, and the card stays hidden.
{
    const rows = [eurBuy(250_000), ...conversion, sell];
    const ledger = computePamLedger(rows);
    assert.equal(usdtAdded(ledger), 250_000);
    assert.equal(ledger.profitByTxId.sell.derivedProfit, 5_000);
    assert.deepEqual(ledger.eurFundedBuys.map((buy) => [buy.buyTxId, buy.withdrawalTxId, buy.ledgerCost, buy.applied]), [['usdt-buy', 'eur-out', 250_000, true]]);
    assert.equal(summarizeEurFundedCostImpact(rows), null);
}

// The old EUR purchase is corrected to 252 000 DZD, so the EUR PAM that day is 252. The EUR
// stock loses 252 000 DZD: the USDT now cost the same 252 000, instead of the 250 000 saved,
// which left a phantom profit.
{
    const rows = [eurBuy(252_000), ...conversion, sell];
    const ledger = computePamLedger(rows);
    assert.equal(eurRemoved(ledger), 252_000);
    assert.equal(usdtAdded(ledger), 252_000);
    assert.equal(ledger.profitByTxId.sell.derivedProfit, 4_000);
    assert.equal(ledger.portfolioStats.usdt.avgBuy, 252);

    const withSavedTotals = computePamLedger(rows, { eurFundedCostFromTs: Number.POSITIVE_INFINITY });
    assert.equal(eurRemoved(withSavedTotals), 252_000);
    assert.equal(usdtAdded(withSavedTotals), 250_000);
    assert.equal(withSavedTotals.profitByTxId.sell.derivedProfit, 5_000);

    assert.deepEqual(summarizeEurFundedCostImpact(rows), {
        buyCount: 1,
        changedBuyCount: 1,
        costChangeDzd: 2_000,
        profitChangeDzd: -1_000,
        usdtAvgBuyWithSavedTotals: 250,
        usdtAvgBuy: 252,
    });
}

// Purchases before the rule's start date keep their saved total.
{
    const ledger = computePamLedger([eurBuy(252_000), ...conversion, sell], { eurFundedCostFromTs: T(4) });
    assert.equal(usdtAdded(ledger), 250_000);
    assert.equal(ledger.eurFundedBuys[0].applied, false);
}

// An EUR row moved after the purchase by an old edit: the USDT cost is still what that EUR
// row removes from the EUR stock (here after a second EUR purchase, PAM 256).
{
    const rows = [
        eurBuy(252_000),
        tx({ id: 'usdt-buy', type: 'buy', currency: 'USDT', quantity: 1_000, price: 250, total: 250_000, purchaseFundingCurrency: 'EUR', timestamp: T(3) }),
        tx({ id: 'eur-buy-2', type: 'buy', currency: 'EUR', quantity: 1_000, total: 260_000, timestamp: T(5) }),
        tx({ id: 'eur-out', type: 'Retrait Manuel', currency: 'EUR', quantity: 1_000, linkedTxId: 'usdt-buy', timestamp: T(6) }),
    ];
    const ledger = computePamLedger(rows);
    assert.equal(eurRemoved(ledger), 256_000);
    assert.equal(usdtAdded(ledger), 256_000);
}

// No usable EUR PAM, an EUR row without link (older data) or two EUR rows for one purchase:
// the saved total is kept.
{
    const noEurCost = computePamLedger([tx({ id: 'eur-add', type: 'Ajout Manuel', currency: 'EUR', quantity: 1_000, timestamp: T(1) }), ...conversion]);
    assert.equal(usdtAdded(noEurCost), 250_000);
    assert.equal(noEurCost.eurFundedBuys[0].applied, false);

    const unlinked = computePamLedger([eurBuy(252_000), { ...conversion[0], linkedTxId: undefined } as Tx, conversion[1]]);
    assert.equal(usdtAdded(unlinked), 250_000);
    assert.deepEqual(unlinked.eurFundedBuys, []);

    const twoRows = computePamLedger([eurBuy(252_000), conversion[0], { ...conversion[0], id: 'eur-out-2', quantity: 10 } as Tx, conversion[1]]);
    assert.equal(usdtAdded(twoRows), 250_000);
}

console.log('eurFundedCost tests passed');
