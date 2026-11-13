import assert from 'node:assert/strict';
import type { ClientTransactionDzd, Tx } from '../types';
import { analyticsWindow, computePeriodStats, hasActivity, percentChange, profitEffects, profitSeries, rankClients, type PeriodStats } from './analyticsPeriod';
import { computePamLedger } from './pamLedger';

// The Analyse page's numbers (V10-1): the windows, the same sums as the old page, why the profit moved,
// the series behind the calendar, and the best clients.

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();
const close = (actual: number, expected: number, message: string) => assert.ok(Math.abs(actual - expected) < 1e-6, `${message}: ${actual} ≠ ${expected}`);

// ---- 1. Windows ----
{
    const now = at(2026, 11, 4, 12);
    // A month that is running is compared with the same days of the one before, not with a whole month.
    const nov = analyticsWindow('month', 2026, 10, now);
    assert.equal(nov.inProgress, true);
    assert.equal(nov.current.from, new Date(2026, 10, 1, 0, 0, 0, 0).getTime());
    assert.equal(nov.current.to, new Date(2026, 10, 4, 23, 59, 59, 999).getTime(), 'until the end of today');
    assert.deepEqual(nov.previous, { from: new Date(2026, 9, 1).getTime(), to: new Date(2026, 9, 4, 23, 59, 59, 999).getTime() }, 'October 1st to 4th');
    // A finished month against the whole month before.
    const oct = analyticsWindow('month', 2026, 9, now);
    assert.equal(oct.inProgress, false);
    assert.equal(oct.current.to, new Date(2026, 9, 31, 23, 59, 59, 999).getTime());
    assert.equal(oct.previous?.to, new Date(2026, 8, 30, 23, 59, 59, 999).getTime(), 'September has 30 days');
    // March 31st against a shorter February (leap year or not).
    assert.equal(analyticsWindow('month', 2028, 2, at(2028, 3, 31)).previous?.to, new Date(2028, 1, 29, 23, 59, 59, 999).getTime());
    assert.equal(analyticsWindow('month', 2027, 2, at(2027, 3, 31)).previous?.to, new Date(2027, 1, 28, 23, 59, 59, 999).getTime());
    // January: the month before is December of the year before.
    assert.equal(analyticsWindow('month', 2027, 0, at(2027, 1, 10)).previous?.from, new Date(2026, 11, 1).getTime());
    // A year: running (same days of last year) and finished (whole).
    const y2026 = analyticsWindow('year', 2026, 0, now);
    assert.equal(y2026.inProgress, true);
    assert.equal(y2026.previous?.to, new Date(2025, 10, 4, 23, 59, 59, 999).getTime(), 'until 4 November of last year');
    const y2025 = analyticsWindow('year', 2025, 0, now);
    assert.equal(y2025.inProgress, false);
    assert.equal(y2025.previous?.to, new Date(2024, 11, 31, 23, 59, 59, 999).getTime());
    assert.equal(analyticsWindow('year', 2028, 0, at(2028, 2, 29)).previous?.to, new Date(2027, 1, 28, 23, 59, 59, 999).getTime(), 'Feb 29 against Feb 28');
    // Everything: from the first operation, nothing to compare with.
    const all = analyticsWindow('all', 2026, 0, now, at(2025, 3, 2));
    assert.equal(all.previous, null);
    assert.equal(all.current.from, new Date(2025, 2, 2, 0, 0, 0, 0).getTime());
}

// ---- 2. A made-up book: buys then sales in USDT and EUR, in 2025 and 2026 ----
let seq = 0;
const txs: Tx[] = [];
const buy = (timestamp: number, currency: 'USDT' | 'EUR', quantity: number, price: number) => { txs.push({ id: `b${++seq}`, type: 'buy', currency, quantity, price, total: quantity * price, date: '', time: '', timestamp } as Tx); };
const sell = (timestamp: number, currency: 'USDT' | 'EUR', quantity: number, price: number) => { txs.push({ id: `s${++seq}`, type: 'sell', currency, quantity, sell: price, total: quantity * price, date: '', time: '', timestamp } as Tx); return `s${seq}`; };
buy(at(2025, 9, 1), 'USDT', 20000, 240);
buy(at(2025, 9, 2), 'EUR', 5000, 262);
sell(at(2025, 9, 10), 'USDT', 4000, 244);
sell(at(2025, 10, 3), 'USDT', 3000, 246);
sell(at(2025, 10, 5), 'EUR', 800, 266);
buy(at(2025, 10, 6), 'USDT', 20000, 243);
sell(at(2025, 10, 20), 'USDT', 2500, 247);
sell(at(2025, 11, 2), 'USDT', 5000, 245);
buy(at(2026, 9, 1), 'USDT', 30000, 246);
buy(at(2026, 9, 2), 'EUR', 4000, 265);
const septIds = [sell(at(2026, 9, 5), 'USDT', 5000, 250), sell(at(2026, 9, 12), 'USDT', 4000, 251), sell(at(2026, 9, 20), 'EUR', 1500, 270)];
const octIds = [sell(at(2026, 10, 3), 'USDT', 6000, 249), sell(at(2026, 10, 12), 'USDT', 3500, 252), sell(at(2026, 10, 12, 15), 'USDT', 1000, 247), sell(at(2026, 10, 28), 'EUR', 900, 271)];
const novIds = [sell(at(2026, 11, 2), 'USDT', 2000, 251), sell(at(2026, 11, 3), 'USDT', 1500, 250)];
const ledger = computePamLedger(txs);
void septIds; void novIds;
const now = at(2026, 11, 4);

// ---- 3. The same sums as the old page (its calculatedStats, copied here) ----
function oldStats(from: number, to: number) {
    let volUsdtBought = 0, volUsdtSold = 0, volEurBought = 0, volEurSold = 0, realizedProfit = 0;
    for (const tx of txs) {
        if (tx.timestamp < from || tx.timestamp > to)
            continue;
        if (tx.currency === 'USDT') {
            if (tx.type === 'buy') volUsdtBought += tx.quantity;
            else if (tx.type === 'sell') volUsdtSold += tx.quantity;
        }
        else if (tx.currency === 'EUR') {
            if (tx.type === 'buy') volEurBought += tx.quantity;
            else if (tx.type === 'sell') volEurSold += tx.quantity;
        }
        if (tx.type === 'sell') realizedProfit += ledger.profitByTxId[tx.id]?.derivedProfit || 0;
    }
    let sellCount = 0, winCount = 0, bestSellProfit = 0;
    for (const row of ledger.sellProfitRows) {
        if (row.timestamp < from || row.timestamp > to) continue;
        sellCount++;
        const p = row.derivedProfit || 0;
        if (p > 0) winCount++;
        if (p > bestSellProfit) bestSellProfit = p;
    }
    return { volUsdtBought, volUsdtSold, volEurBought, volEurSold, realizedProfit, sellCount, winRate: sellCount > 0 ? (winCount / sellCount) * 100 : null, avgProfitPerSell: sellCount > 0 ? realizedProfit / sellCount : null, bestSellProfit };
}
for (const [kind, year, month] of [['month', 2026, 9], ['month', 2026, 8], ['month', 2025, 9], ['month', 2026, 10], ['year', 2026, 0], ['year', 2025, 0], ['all', 2026, 0]] as const) {
    const window = analyticsWindow(kind, year, month, now, at(2025, 9, 1));
    const stats = computePeriodStats(txs, ledger, window.current);
    const old = oldStats(window.current.from, window.current.to);
    const label = `${kind} ${year}-${month}`;
    close(stats.usdt.sold, old.volUsdtSold, `${label}: USDT sold`);
    close(stats.usdt.bought, old.volUsdtBought, `${label}: USDT bought`);
    close(stats.eur.sold, old.volEurSold, `${label}: EUR sold`);
    close(stats.eur.bought, old.volEurBought, `${label}: EUR bought`);
    close(stats.profit, old.realizedProfit, `${label}: profit`);
    assert.equal(stats.sellCount, old.sellCount, `${label}: number of sales`);
    assert.equal(stats.winRate, old.winRate, `${label}: win rate`);
    assert.equal(stats.avgProfitPerSell, old.avgProfitPerSell, `${label}: average profit per sale`);
    close(stats.bestSellProfit, old.bestSellProfit, `${label}: best sale`);
    close(stats.usdt.profit + stats.eur.profit, stats.profit, `${label}: the two currencies make the whole profit`);
}

// ---- 4. Margin per 100 ----
{
    const oct = computePeriodStats(txs, ledger, analyticsWindow('month', 2026, 9, now).current);
    close(oct.usdt.marginPer100!, (oct.usdt.profit / oct.usdt.sold) * 100, 'margin per 100 USDT = profit ÷ sold × 100');
    assert.equal(computePeriodStats(txs, ledger, { from: at(2024, 1, 1), to: at(2024, 1, 31) }).usdt.marginPer100, null, 'nothing sold: no margin');
    assert.equal(hasActivity(computePeriodStats(txs, ledger, { from: at(2024, 1, 1), to: at(2024, 1, 31) })), false);
    assert.equal(hasActivity(oct), true);
}

// ---- 5. Why the profit moved ----
{
    const cur = { usdt: { sold: 120, bought: 0, profit: 360, sellCount: 3, marginPer100: 300 }, eur: { sold: 0, bought: 0, profit: 0, sellCount: 0, marginPer100: null }, profit: 360 } as unknown as PeriodStats;
    const prev = { usdt: { sold: 100, bought: 0, profit: 400, sellCount: 2, marginPer100: 400 }, eur: { sold: 0, bought: 0, profit: 0, sellCount: 0, marginPer100: null }, profit: 400 } as unknown as PeriodStats;
    const e = profitEffects(cur, prev);
    close(e.volume, 80, 'more quantity at the old margin');
    close(e.margin, -120, 'a lower margin on the quantity of now');
    close(e.other, 0, 'nothing else');
    close(e.total, -40, 'the profit went down by 40');
    // For every pair of the book, the three effects add up to the change, exactly.
    const windows = [['month', 2026, 9], ['month', 2026, 8], ['month', 2026, 10], ['month', 2025, 9], ['year', 2026, 0], ['year', 2025, 0]] as const;
    for (const [kind, year, month] of windows) {
        const w = analyticsWindow(kind, year, month, now);
        if (!w.previous) continue;
        const a = computePeriodStats(txs, ledger, w.current);
        const b = computePeriodStats(txs, ledger, w.previous);
        const effects = profitEffects(a, b);
        close(effects.volume + effects.margin + effects.other, effects.total, `${kind} ${year}-${month}: the effects add up`);
        close(effects.total, a.profit - b.profit, `${kind} ${year}-${month}: the total is the change`);
    }
    // A currency that was not sold before goes to « other », and still adds up.
    const sept = computePeriodStats(txs, ledger, analyticsWindow('month', 2026, 8, now).current);
    const aug = computePeriodStats(txs, ledger, analyticsWindow('month', 2026, 7, now).current);
    const fromNothing = profitEffects(sept, aug);
    close(fromNothing.volume + fromNothing.margin + fromNothing.other, sept.profit - aug.profit, 'from an empty month');
    assert.equal(percentChange(120, 100), 20);
    assert.equal(percentChange(80, 100), -20);
    assert.equal(percentChange(5, 0), null, 'nothing before: no percent');
    assert.equal(percentChange(null, 4), null);
}

// ---- 6. Series ----
{
    const oct = profitSeries('month', 2026, 9, now, txs, ledger);
    assert.equal(oct.buckets.length, 31, 'October has 31 days');
    assert.equal(oct.current, null, 'October is over: no current day');
    assert.equal(oct.activeCount, 3, 'three days with sales: the 3rd, the 12th and the 28th');
    const day12 = oct.buckets.find((bucket) => bucket.index === 12)!;
    close(day12.profit, (ledger.profitByTxId[octIds[1]]?.derivedProfit || 0) + (ledger.profitByTxId[octIds[2]]?.derivedProfit || 0), 'the two sales of the 12th add up');
    assert.ok(oct.best && oct.worst && oct.best.profit >= oct.worst.profit);
    close(oct.buckets.reduce((sum, bucket) => sum + bucket.profit, 0), computePeriodStats(txs, ledger, analyticsWindow('month', 2026, 9, now).current).profit, 'the days add up to the month');
    const nov = profitSeries('month', 2026, 10, now, txs, ledger);
    assert.equal(nov.current?.index, 4, 'we are on the 4th');
    const year = profitSeries('year', 2026, 0, now, txs, ledger);
    assert.equal(year.buckets.length, 12);
    assert.equal(year.current?.index, 10, 'November, month index 10');
    close(year.buckets.reduce((sum, bucket) => sum + bucket.profit, 0), computePeriodStats(txs, ledger, analyticsWindow('year', 2026, 0, now).current).profit, 'the months add up to the year');
    const all = profitSeries('all', 2026, 0, now, txs, ledger);
    assert.deepEqual(all.buckets.map((bucket) => bucket.index), [2025, 2026], 'the years of the book');
    assert.equal(all.current?.index, 2026);
    close(all.buckets.reduce((sum, bucket) => sum + bucket.profit, 0), computePeriodStats(txs, ledger, analyticsWindow('all', 2026, 0, now, at(2025, 9, 1)).current).profit, 'the years add up to everything');
}

// ---- 7. Best clients and concentration ----
{
    const row = (clientId: string, linkedTxId: string, extra: Partial<ClientTransactionDzd> = {}): ClientTransactionDzd => ({ id: `r${linkedTxId}`, clientId, timestamp: 0, date: '', time: '', montant: 0, type: 'Vente USDT', notes: '', linkedTxId, ...extra } as ClientTransactionDzd);
    const clientRows = [row('A', octIds[0]), row('B', octIds[1]), row('A', octIds[2]), row('C', octIds[3])];
    const names = new Map([['A', 'Client A'], ['B', 'Client B'], ['C', 'Client C']]);
    const window = analyticsWindow('month', 2026, 9, now).current;
    const ranking = rankClients({ transactions: txs, clientTransactions: clientRows, ledger, clientNameById: names, unknownName: '?', range: window });
    assert.deepEqual(ranking.byVolume.map((client) => [client.clientName, client.sellVolumeUsdt]), [['Client A', 7000], ['Client B', 3500]], 'by USDT sold (Client C only bought EUR)');
    assert.deepEqual(ranking.byProfit.map((client) => client.clientId).sort(), ['A', 'B', 'C']);
    assert.ok(ranking.byProfit[0].realizedProfit >= ranking.byProfit[1].realizedProfit, 'by profit, highest first');
    close(ranking.topThreeShare!, 100, 'every USDT sold of October went to the clients above');
    // A sale with no linked client counts in the total, not in a client: the share goes down.
    const partial = rankClients({ transactions: txs, clientTransactions: [row('A', octIds[0])], ledger, clientNameById: names, unknownName: '?', range: window });
    close(partial.topThreeShare!, (6000 / 10500) * 100, 'a sale without a client lowers the share of the top clients');
    assert.equal(rankClients({ transactions: txs, clientTransactions: [], ledger, clientNameById: names, unknownName: '?', range: { from: at(2024, 1, 1), to: at(2024, 1, 31) } }).topThreeShare, null, 'nothing sold: no share');
    // The same linked row twice for one sale (sender and receiver of a transfer): the main one wins.
    const twice = rankClients({ transactions: txs, clientTransactions: [row('B', octIds[0], { linkRole: 'dzd_receiver' }), row('A', octIds[0])], ledger, clientNameById: names, unknownName: '?', range: window });
    assert.equal(twice.byVolume[0].clientId, 'A', 'the primary row beats the receiver row');
}
// V14-2: RMB volumes and margin are counted like EUR (fake figures: 1 000 RMB at 36, 600 sold at 38 → profit 1 200).
{
    const T = Date.UTC(2027, 1, 10);
    const book = [
        { id: 'rb', type: 'buy', currency: 'RMB', quantity: 1_000, price: 36, total: 36_000, timestamp: T },
        { id: 'rs', type: 'sell', currency: 'RMB', quantity: 600, sell: 38, total: 22_800, timestamp: T + 1000 },
    ] as unknown as Tx[];
    const stats = computePeriodStats(book, computePamLedger(book, { nowMs: T + 1e9 }), { from: T - 1, to: T + 1e6 });
    assert.deepEqual([stats.rmb.bought, stats.rmb.sold, stats.rmb.profit, stats.rmb.marginPer100], [1_000, 600, 1_200, 200]);
    assert.equal(hasActivity(stats), true);
}
console.log('analyticsPeriod tests passed');
