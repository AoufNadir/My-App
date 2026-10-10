import assert from 'node:assert/strict';

import { computeCapitalSnapshot, calculateInvestorLiability } from './capitalSnapshot';
import { computePamLedger } from './pamLedger';
import type { Investor, Tx } from '../types';

// V5-2: a gap found by the inventory is absorbed by the existing « edit balance » windows
// (origin balance_edit). Decision: such a correction only fixes the balance. It must not change the
// profit of any sale already recorded, the average buy price, or what any outside investor is owed.
// These tests write the rows exactly as handleSavePortfolioBalanceEdit does (MainApp.tsx).

const tx = (fields: Record<string, unknown>) => ({ currency: 'USDT', date: '01/10/2026', time: '10:00', ...fields }) as unknown as Tx;
const day = (n: number) => Date.UTC(2026, 9, n, 10);

const history: Tx[] = [
    tx({ id: 'b1', type: 'buy', quantity: 1_000, price: 241.4567, total: 241_456.7, timestamp: day(1) }),
    tx({ id: 's1', type: 'sell', quantity: 400, sell: 252, total: 100_800, timestamp: day(2) }),
    tx({ id: 'b2', type: 'buy', quantity: 500, price: 243.1, total: 121_550, timestamp: day(3) }),
    tx({ id: 's2', type: 'sell', quantity: 300, sell: 253.5, total: 76_050, timestamp: day(4) }),
];

/** The row the USDT/EUR « edit balance » window saves, priced at the current average buy price. */
const correction = (id: string, diff: number, avgBuy: number, timestamp: number): Tx => {
    const quantity = Math.abs(diff);
    const row: Record<string, unknown> = {
        id, timestamp, date: '08/10/2026', time: '09:00', currency: 'USDT',
        type: diff > 0 ? 'Ajout Manuel' : 'Retrait Manuel', quantity, origin: 'balance_edit',
        notes: `Écart d'inventaire 08/10/2026`,
    };
    if (diff > 0 && avgBuy > 0) {
        row.price = Number(avgBuy.toFixed(2));
        row.total = Number((quantity * avgBuy).toFixed(2));
    }
    return tx(row);
};

const before = computePamLedger(history);
const avgBefore = before.portfolioStats.usdt.avgBuy;
const stockBefore = before.portfolioStats.usdt.available + before.portfolioStats.usdt.locked;
assert.ok(avgBefore > 240 && avgBefore < 245, 'the fixture has a real average buy price');

// 1. Wallet SHORT of the books by 50 USDT, then OVER by 80 USDT: the sales already recorded keep
//    their exact profit, the totals do not move, and the average price barely does.
for (const diff of [-50, 80]) {
    const after = computePamLedger([...history, correction('fix', diff, avgBefore, day(8))]);
    for (const id of ['s1', 's2']) {
        assert.equal(after.profitByTxId[id].derivedProfit, before.profitByTxId[id].derivedProfit, `${id} profit unchanged (${diff})`);
        assert.equal(after.profitByTxId[id].soldCostDzd, before.profitByTxId[id].soldCostDzd, `${id} cost unchanged (${diff})`);
    }
    assert.equal(after.totals.derivedProfit, before.totals.derivedProfit, `total profit unchanged (${diff})`);
    assert.equal(
        after.portfolioStats.usdt.available + after.portfolioStats.usdt.locked,
        Math.round((stockBefore + diff) * 100) / 100,
        `stock moves by exactly the correction (${diff})`,
    );
    // The window rounds the price to the cent; that is the only thing that can move the average.
    assert.ok(Math.abs(after.portfolioStats.usdt.avgBuy - avgBefore) <= 0.005, `average buy price moves by under half a cent (${diff})`);
}

// 2. A sale AFTER the correction earns the same per USDT, give or take that half cent.
{
    const laterSell = tx({ id: 's3', type: 'sell', quantity: 100, sell: 255, total: 25_500, timestamp: day(9) });
    const plain = computePamLedger([...history, laterSell]).profitByTxId.s3.derivedProfit;
    for (const diff of [-50, 80]) {
        const withFix = computePamLedger([...history, correction('fix', diff, avgBefore, day(8)), laterSell]).profitByTxId.s3.derivedProfit;
        assert.ok(Math.abs(withFix - plain) <= 100 * 0.005 + 0.01, `later sale profit within half a cent per USDT (${diff}): ${plain} vs ${withFix}`);
    }
}

// 3. A cash gap (Caisse or BaridiMob) is borne by the owner's capital, never by an outside investor.
{
    const investors = [
        { id: 'i1', name: 'Outside investor', isManager: false, capitalInvested: 800_000, availableProfit: 45_250.75 },
        { id: 'm', name: 'Manager', isManager: true, capitalInvested: 300_000, availableProfit: 80_000 },
    ] as unknown as Investor[];
    const liability = calculateInvestorLiability(investors);
    const base = { baridiBalance: 120_000, totalDettes: 0, totalAvances: 0, investorLiability: liability };
    const books = computeCapitalSnapshot({ ...base, caisseBalance: 482_500 });
    const afterShortfall = computeCapitalSnapshot({ ...base, caisseBalance: 482_500 - 2_500 });
    assert.equal(afterShortfall.investorLiability, books.investorLiability, 'the investors are owed the same');
    assert.equal(books.netOwnedCapital - afterShortfall.netOwnedCapital, 2_500, 'the shortfall lowers the owner capital by exactly its amount');
}

console.log('inventory correction neutrality tests passed');
