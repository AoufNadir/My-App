import assert from 'node:assert/strict';

import { computePamLedger, EUR_FUNDED_COST_RULE_FROM_TS, summarizeEurFundedCostImpact } from './pamLedger';
import type { Tx } from '../types';

const tx = (fields: Record<string, unknown>) => ({ date: '01/09/2026', time: '10:00', ...fields }) as unknown as Tx;
const T = (day: number) => new Date(2026, 8, day, 10).getTime();
// The purchases below are dated in September 2026, before the rule's start date: most cases
// apply the rule to the whole history to test how it values them.
const ALL_HISTORY = { eurFundedCostFromTs: 0 };

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
    const ledger = computePamLedger(rows, ALL_HISTORY);
    assert.equal(usdtAdded(ledger), 250_000);
    assert.equal(ledger.profitByTxId.sell.derivedProfit, 5_000);
    assert.deepEqual(ledger.eurFundedBuys.map((buy) => [buy.buyTxId, buy.withdrawalTxId, buy.ledgerCost, buy.applied]), [['usdt-buy', 'eur-out', 250_000, true]]);
    assert.equal(summarizeEurFundedCostImpact(rows, ALL_HISTORY), null);
}

// The old EUR purchase is corrected to 252 000 DZD, so the EUR PAM that day is 252. The EUR
// stock loses 252 000 DZD: the USDT now cost the same 252 000, instead of the 250 000 saved,
// which left a phantom profit.
{
    const rows = [eurBuy(252_000), ...conversion, sell];
    const ledger = computePamLedger(rows, ALL_HISTORY);
    assert.equal(eurRemoved(ledger), 252_000);
    assert.equal(usdtAdded(ledger), 252_000);
    assert.equal(ledger.profitByTxId.sell.derivedProfit, 4_000);
    assert.equal(ledger.portfolioStats.usdt.avgBuy, 252);

    const withSavedTotals = computePamLedger(rows, { eurFundedCostFromTs: Number.POSITIVE_INFINITY });
    assert.equal(eurRemoved(withSavedTotals), 252_000);
    assert.equal(usdtAdded(withSavedTotals), 250_000);
    assert.equal(withSavedTotals.profitByTxId.sell.derivedProfit, 5_000);

    assert.deepEqual(summarizeEurFundedCostImpact(rows, ALL_HISTORY), {
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
    const ledger = computePamLedger(rows, ALL_HISTORY);
    assert.equal(eurRemoved(ledger), 256_000);
    assert.equal(usdtAdded(ledger), 256_000);
}

// No usable EUR PAM, an EUR row without link (older data) or two EUR rows for one purchase:
// the saved total is kept.
{
    const noEurCost = computePamLedger([tx({ id: 'eur-add', type: 'Ajout Manuel', currency: 'EUR', quantity: 1_000, timestamp: T(1) }), ...conversion], ALL_HISTORY);
    assert.equal(usdtAdded(noEurCost), 250_000);
    assert.equal(noEurCost.eurFundedBuys[0].applied, false);

    const unlinked = computePamLedger([eurBuy(252_000), { ...conversion[0], linkedTxId: undefined } as Tx, conversion[1]], ALL_HISTORY);
    assert.equal(usdtAdded(unlinked), 250_000);
    assert.deepEqual(unlinked.eurFundedBuys, []);

    const twoRows = computePamLedger([eurBuy(252_000), conversion[0], { ...conversion[0], id: 'eur-out-2', quantity: 10 } as Tx, conversion[1]], ALL_HISTORY);
    assert.equal(usdtAdded(twoRows), 250_000);
}

// The owner's choice: the rule starts on the deploy day (27/09/2026). The same corrected
// history keeps its saved total and its profit, so nothing already distributed moves, and
// the Stock page card stays hidden. A purchase from that day on follows the EUR PAM.
{
    assert.equal(EUR_FUNDED_COST_RULE_FROM_TS, new Date('2026-09-27T00:00:00+01:00').getTime());
    const rows = [eurBuy(252_000), ...conversion, sell];
    const ledger = computePamLedger(rows);
    assert.equal(usdtAdded(ledger), 250_000);
    assert.equal(ledger.profitByTxId.sell.derivedProfit, 5_000);
    assert.equal(ledger.eurFundedBuys[0].applied, false);
    assert.equal(summarizeEurFundedCostImpact(rows), null);

    const later = (fields: Record<string, unknown>) => tx({ ...fields, timestamp: EUR_FUNDED_COST_RULE_FROM_TS + Number(fields.timestamp) });
    const afterStart = computePamLedger([
        later({ id: 'eur-buy', type: 'buy', currency: 'EUR', quantity: 1_000, total: 252_000, timestamp: 1_000 }),
        later({ id: 'eur-out', type: 'Retrait Manuel', currency: 'EUR', quantity: 1_000, linkedTxId: 'usdt-buy', timestamp: 2_000 }),
        later({ id: 'usdt-buy', type: 'buy', currency: 'USDT', quantity: 1_000, price: 250, total: 250_000, purchaseFundingCurrency: 'EUR', timestamp: 2_001 }),
    ]);
    assert.equal(usdtAdded(afterStart), 252_000);
    assert.equal(afterStart.eurFundedBuys[0].applied, true);
}

console.log('eurFundedCost tests passed');
