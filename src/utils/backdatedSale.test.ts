import assert from 'node:assert/strict';
import type { Tx } from '../types';
import { computePamLedger } from './pamLedger';
import { BACKDATED_SALE_DEFAULT_HOUR, PENDING_SALE_ID, planBackdatedSale, resolveSaleMoment, type SaleDraft } from './backdatedSale';
import { stampAt } from './editStamp';

// V5-3: « when did the sale really happen? ». A sale recorded days late and dated on its real day
// must give exactly what it would have given typed that day, and be refused where it cannot be.

const at = (day: number, hour = 10, minute = 0, month = 9) => new Date(2026, month, day, hour, minute, 0, 0).getTime();
const NOW = at(10, 15);

// 1. The moment typed in the window.
{
    assert.deepEqual(resolveSaleMoment('', '', NOW), { kind: 'now' }, 'nothing typed');
    assert.deepEqual(resolveSaleMoment('  ', ' ', NOW), { kind: 'now' }, 'blanks are nothing');
    assert.deepEqual(resolveSaleMoment('2026-10-10', '', NOW), { kind: 'now' }, 'today without a time keeps the normal path');
    const earlierToday = resolveSaleMoment('2026-10-10', '09:30', NOW);
    assert.equal(earlierToday.kind, 'at');
    if (earlierToday.kind === 'at') {
        assert.equal(earlierToday.timestamp, at(10, 9, 30));
        assert.equal(earlierToday.date, '10/10/2026');
        assert.equal(earlierToday.time, '09:30');
    }
    assert.deepEqual(resolveSaleMoment('2026-10-10', '16:00', NOW), { kind: 'future' }, 'later today is not allowed');
    assert.deepEqual(resolveSaleMoment('2026-10-11', '', NOW), { kind: 'future' });
    assert.deepEqual(resolveSaleMoment('2026-10-10', '15:01', NOW).kind, 'at', 'a clock a minute ahead is tolerated');
    const noon = resolveSaleMoment('2026-10-08', '', NOW);
    assert.equal(noon.kind, 'at');
    if (noon.kind === 'at') {
        assert.equal(noon.timestamp, at(8, BACKDATED_SALE_DEFAULT_HOUR));
        assert.equal(noon.time, '12:00', 'no time: noon');
        assert.equal(noon.date, '08/10/2026');
    }
    const timeOnly = resolveSaleMoment('', '09:30', NOW);
    assert.equal(timeOnly.kind === 'at' && timeOnly.timestamp, at(10, 9, 30), 'a time alone is today at that time');
    for (const bad of [['2026-02-30', ''], ['2026-13-01', ''], ['10/10/2026', ''], ['2026-10-08', '25:00'], ['2026-10-08', '12:60'], ['2026-10-08', '9:5'], ['abc', '']]) {
        assert.deepEqual(resolveSaleMoment(bad[0], bad[1], NOW), { kind: 'invalid' }, `${bad.join(' ')} is a typo`);
    }
}

const buy = (id: string, timestamp: number, quantity: number, price: number, currency: Tx['currency'] = 'USDT'): Tx =>
    ({ id, type: 'buy', currency, quantity, price, total: Math.round(quantity * price), ...stampAt(timestamp) }) as Tx;
const sell = (id: string, timestamp: number, quantity: number, price: number, currency: Tx['currency'] = 'USDT'): Tx =>
    ({ id, type: 'sell', currency, quantity, sell: price, total: Math.round(quantity * price), settlementCurrency: 'DZD', ...stampAt(timestamp) }) as Tx;
const draftOf = (quantity: number, sellPrice: number, currency: SaleDraft['currency'] = 'USDT', saleValueDzd = quantity * sellPrice): SaleDraft =>
    ({ currency, quantity, sellPrice, saleValueDzd, totalRevenue: Math.round(saleValueDzd) });

const history: Tx[] = [
    buy('b1', at(1), 1000, 240),
    sell('s1', at(2, 11), 200, 250),
    buy('b2', at(5), 500, 260),
    sell('s2', at(7, 11), 300, 270),
];

// 2. The result is what a sale typed that day gives: PAM of that day, same profit formula.
{
    const draft = draftOf(100, 255);
    const plan = planBackdatedSale({ transactions: history, draft, timestamp: at(3, 12), nowMs: NOW });
    assert.equal(plan.ok, true);
    if (plan.ok) {
        // Reference: the app's state the evening of the 3rd (only what was recorded before), the normal formula.
        const dayBefore = history.filter((tx) => tx.timestamp < at(3, 12));
        const stats = computePamLedger(dayBefore, { nowMs: at(3, 12) }).portfolioStats.usdt;
        assert.equal(stats.avgBuy, 240);
        assert.equal(plan.avgAtSale, stats.avgBuy, 'PAM of that day, not the PAM now');
        assert.equal(plan.profit, Number((draft.saleValueDzd - stats.avgBuy * draft.quantity).toFixed(2)), 'same formula as a sale typed that day');
        assert.equal(plan.profit, 1500);
        assert.equal(plan.soldCost, 24000);
        // The PAM today is not the one of the 3rd: using it would have given another profit.
        const pamNow = computePamLedger(history, { nowMs: NOW }).portfolioStats.usdt.avgBuy;
        assert.notEqual(pamNow, stats.avgBuy);
    }
}

// 3. Whatever the moment, the saved profit is the reference formula at that moment's stock.
{
    const odd: Tx[] = [
        buy('a', at(1), 333, 241.37),
        buy('b', at(2), 417, 249.11),
        sell('c', at(3, 11), 150, 255.5),
        buy('d', at(4), 90, 262.9),
        buy('e', at(8), 700, 271.33),
    ];
    for (const [moment, quantity, price] of [[at(2, 18), 100, 252.4], [at(3, 15), 250, 258], [at(5, 9), 77.5, 263.25], [at(9), 400, 275]] as const) {
        const draft = draftOf(quantity, price);
        const plan = planBackdatedSale({ transactions: odd, draft, timestamp: moment, nowMs: NOW });
        assert.equal(plan.ok, true, `ok at ${new Date(moment).toISOString()}`);
        if (!plan.ok)
            continue;
        const state = odd.filter((tx) => tx.timestamp < moment);
        const avg = computePamLedger(state, { nowMs: moment }).portfolioStats.usdt.avgBuy;
        assert.equal(plan.avgAtSale, avg);
        assert.equal(plan.profit, Number((draft.saleValueDzd - avg * quantity).toFixed(2)));
        // The ledger of the full history (which the app's reports use) agrees to the rounding of the PAM.
        const full = computePamLedger([...odd, { ...sell(PENDING_SALE_ID, moment, quantity, price), total: draft.totalRevenue }], { nowMs: NOW });
        assert.ok(Math.abs(full.profitByTxId[PENDING_SALE_ID].derivedProfit - plan.profit) <= quantity * 0.005 + 0.011, 'ledger and saved profit agree');
    }
}

// 4. Recording order does not matter to the ledger: typed the day it happened or days later, same figures.
{
    const sale = sell('s3', at(3, 12), 100, 255);
    const typedThatDay = computePamLedger([history[0], history[1], sale, history[2], history[3]], { nowMs: NOW });
    const typedLate = computePamLedger([...history, sale], { nowMs: NOW });
    assert.equal(typedLate.totals.derivedProfit, typedThatDay.totals.derivedProfit);
    assert.deepEqual(typedLate.portfolioStats, typedThatDay.portfolioStats);
    assert.equal(typedLate.profitByTxId.s3.derivedProfit, 1500);
}

// 5. Sales recorded after that day follow the new stock: the plan says how many and by how much.
{
    const plan = planBackdatedSale({ transactions: history, draft: draftOf(100, 255), timestamp: at(3, 12), nowMs: NOW });
    assert.equal(plan.ok, true);
    if (plan.ok) {
        const before = computePamLedger(history, { nowMs: NOW }).profitByTxId.s2.derivedProfit;
        const after = computePamLedger([...history, sell('x', at(3, 12), 100, 255)], { nowMs: NOW }).profitByTxId.s2.derivedProfit;
        assert.notEqual(before, after, 'the later sale is recalculated');
        assert.equal(plan.laterSales.count, 1);
        assert.equal(plan.laterSales.shift, Number((after - before).toFixed(2)));
        assert.ok(plan.laterSales.shift < 0);
    }
    // Before every other sale there is nothing later to shift when nothing was bought afterwards.
    const calm = planBackdatedSale({ transactions: [buy('b', at(1), 100, 240)], draft: draftOf(10, 250), timestamp: at(3), nowMs: NOW });
    assert.equal(calm.ok && calm.laterSales.count, 0);
    assert.equal(calm.ok && calm.laterSales.shift, 0);
    // A later sale only moves when the PAM after it moves: here nothing was bought after the 3rd.
    const noBuyAfter = planBackdatedSale({ transactions: [history[0], history[1], history[3]], draft: draftOf(100, 255), timestamp: at(3, 12), nowMs: NOW });
    assert.equal(noBuyAfter.ok && noBuyAfter.laterSales.shift, 0, 'a sale never changes the PAM of the stock that stays');
}

// 6. Refusals.
{
    // No stock yet on that day.
    assert.deepEqual(planBackdatedSale({ transactions: history, draft: draftOf(100, 255), timestamp: at(30, 12, 0, 8), nowMs: NOW }), { ok: false, reason: 'noStock' });
    // Enough stock that day, but the sale recorded the 7th would no longer find its 300.
    assert.deepEqual(planBackdatedSale({ transactions: history, draft: draftOf(1100, 255), timestamp: at(6, 12), nowMs: NOW }), { ok: false, reason: 'noStock' });
    // Still enough for the 7th.
    assert.equal(planBackdatedSale({ transactions: history, draft: draftOf(1000, 255), timestamp: at(6, 12), nowMs: NOW }).ok, true);
    // A closed month, however the stock looks.
    assert.deepEqual(planBackdatedSale({ transactions: history, draft: draftOf(10, 255), timestamp: at(3, 12), nowMs: NOW, lockedThrough: at(3, 23, 59) }), { ok: false, reason: 'closedMonth' });
    assert.equal(planBackdatedSale({ transactions: history, draft: draftOf(10, 255), timestamp: at(4, 12), nowMs: NOW, lockedThrough: at(3, 23, 59) }).ok, true);
    assert.equal(planBackdatedSale({ transactions: history, draft: draftOf(10, 255), timestamp: at(3, 12), nowMs: NOW, lockedThrough: null }).ok, true);
    // A mistake already in the books is not blamed on the new sale.
    const withOldOversell: Tx[] = [sell('old', at(1, 9), 5, 250), ...history];
    assert.equal(planBackdatedSale({ transactions: withOldOversell, draft: draftOf(100, 255), timestamp: at(3, 12), nowMs: NOW }).ok, true);
    // The input is left alone.
    assert.equal(history.length, 4);
}

// 7. EUR sales follow the same rules with their own stock.
{
    const eur: Tx[] = [buy('e1', at(1), 500, 250, 'EUR'), sell('e2', at(6, 11), 100, 270, 'EUR'), ...history];
    const plan = planBackdatedSale({ transactions: eur, draft: draftOf(50, 262, 'EUR'), timestamp: at(3, 12), nowMs: NOW });
    assert.equal(plan.ok && plan.avgAtSale, 250, 'EUR PAM, not the USDT one');
    assert.equal(plan.ok && plan.profit, 600);
    assert.deepEqual(planBackdatedSale({ transactions: eur, draft: draftOf(450, 262, 'EUR'), timestamp: at(3, 12), nowMs: NOW }), { ok: false, reason: 'noStock' }, 'the 100 EUR sold on the 6th would be short');
}

console.log('backdatedSale tests passed');
