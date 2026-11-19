import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { guardFindings, type GuardExpense, type GuardOperation } from './guardChecks';
import { GuardAlertCard } from '../components/dashboard/GuardAlertCard';

// V17-1: the guard on fake data. Each rule finds its case, and ordinary activity raises nothing.
const DAY = 86_400_000;
const NOW = new Date(2026, 10, 19, 12).getTime();
const at = (daysAgo: number, minutes = 0) => NOW - daysAgo * DAY + minutes * 60_000;
const base = { now: NOW, sales: [], wallets: { Caisse: 100_000, BaridiMob: 0 }, feeHistory: [] };

// Ordinary month: small expenses, steady prices, sales with profit. Nothing to say.
const usualExpenses: GuardExpense[] = Array.from({ length: 8 }, (_, i) => ({ id: `e${i}`, origin: 'personal_expense', amount: 300 + i * 20, timestamp: at(40 - i * 4) }));
const usualOps: GuardOperation[] = Array.from({ length: 12 }, (_, i) => ({ id: `s${i}`, type: 'sell', currency: 'USDT', quantity: 100 + i, sell: 260 + (i % 3), timestamp: at(30 - i * 2) }));
assert.deepEqual(guardFindings({ ...base, expenses: usualExpenses, operations: usualOps }), [], 'ordinary activity raises nothing');

// 1 + 2: the 385 that became 39 500 next to the 39 500 advance.
{
    const expenses = [...usualExpenses, { id: 'x1', origin: 'personal_expense', amount: 39_500, timestamp: at(12) }, { id: 'x2', origin: 'personal_expense', amount: 39_500, timestamp: at(1) }];
    const f = guardFindings({ ...base, expenses, operations: [] });
    assert.ok(f.some((x) => x.kind === 'duplicate_expense' && x.txId === 'x2' && x.otherAmount === 39_500), 'the same expense twice within 15 days');
    assert.ok(f.some((x) => x.kind === 'unusual_expense' && x.txId === 'x1' && x.usual < 500), 'ten times the usual');
    // A project expense of the same amount is another kind: not a duplicate of a personal one.
    const g = guardFindings({ ...base, expenses: [{ id: 'p', origin: 'delivery_expense', amount: 5_000, timestamp: at(3) }, { id: 'q', origin: 'personal_expense', amount: 5_000, timestamp: at(2) }], operations: [] });
    assert.equal(g.filter((x) => x.kind === 'duplicate_expense').length, 0);
}

// 3: a zero too many on a price; 5: the same sale twice in two minutes.
{
    const ops = [...usualOps, { id: 'typo', type: 'sell', currency: 'USDT', quantity: 50, sell: 2600, timestamp: at(1) }, { id: 'a', type: 'buy', currency: 'USDT', quantity: 500, price: 255, timestamp: at(0, -10) }, { id: 'b', type: 'buy', currency: 'USDT', quantity: 500, price: 255, timestamp: at(0, -8) }];
    const f = guardFindings({ ...base, expenses: [], operations: ops });
    const price = f.find((x) => x.kind === 'price_far');
    assert.ok(price && price.kind === 'price_far' && price.txId === 'typo' && price.usual === 261, 'a price ten times the recent median');
    assert.ok(f.some((x) => x.kind === 'twin_operation' && x.txId === 'b'), 'the same purchase twice within minutes');
    assert.ok(!f.some((x) => x.kind === 'price_far' && x.txId === 'a'), 'too few purchases to judge a purchase price');
}

// 4, 6, 7, 8: a sale at a loss, a wallet below zero, a new management rate, an advance open for 9 days.
{
    const f = guardFindings({
        ...base,
        expenses: [{ id: 'adv', origin: 'personal_expense', amount: 1_200, timestamp: at(9), advanceState: 'pending' }, { id: 'adv2', origin: 'personal_expense', amount: 800, timestamp: at(2), advanceState: 'pending' }],
        operations: [],
        sales: [{ txId: 'l', currency: 'USDT', quantity: 100, timestamp: at(3), derivedProfit: -1_500, sellPrice: 245, historicalAvgBuy: 260 }, { txId: 'w', currency: 'USDT', quantity: 100, timestamp: at(3), derivedProfit: 900, sellPrice: 269, historicalAvgBuy: 260 }],
        wallets: { Caisse: -2_000, BaridiMob: 50 },
        feeHistory: [{ percentage: 30, effectiveFrom: at(90) }, { percentage: 40, effectiveFrom: at(3) }, { percentage: 40, effectiveFrom: at(2) }],
    });
    assert.deepEqual(f.filter((x) => x.kind === 'sale_below_cost').map((x) => x.kind === 'sale_below_cost' && x.loss), [1_500]);
    assert.deepEqual(f.filter((x) => x.kind === 'negative_wallet').map((x) => x.kind === 'negative_wallet' && x.wallet), ['Caisse']);
    assert.deepEqual(f.filter((x) => x.kind === 'fee_change').map((x) => x.kind === 'fee_change' && [x.from, x.to]), [[30, 40]], 'one change, the same rate saved again is not a change');
    assert.deepEqual(f.filter((x) => x.kind === 'open_advance').map((x) => x.kind === 'open_advance' && x.days), [9], 'an advance of 2 days is not late yet');
}

// Older than 60 days: not checked any more.
assert.deepEqual(guardFindings({ ...base, expenses: [{ id: 'o1', origin: 'personal_expense', amount: 9_000, timestamp: at(80) }, { id: 'o2', origin: 'personal_expense', amount: 9_000, timestamp: at(75) }], operations: [] }), []);

// The card: numbers, both buttons, Arabic and French.
{
    const finding = guardFindings({ ...base, expenses: [{ id: 'x1', origin: 'personal_expense', amount: 39_500, timestamp: at(12) }, { id: 'x2', origin: 'personal_expense', amount: 39_500, timestamp: at(1) }], operations: [] })[0];
    const ar = renderToStaticMarkup(React.createElement(GuardAlertCard, { finding, lang: 'ar', onOpen: () => undefined, onOk: () => undefined }));
    assert.match(ar, /مصروف مكرّر؟/);
    assert.match(ar, /39 500/);
    assert.match(ar, /افتح/);
    assert.match(ar, /هذا صحيح/);
    const fr = renderToStaticMarkup(React.createElement(GuardAlertCard, { finding, lang: 'fr', onOk: () => undefined }));
    assert.match(fr, /Dépense en double \?/);
    assert.match(fr, /C’est juste/);
    assert.doesNotMatch(fr, />Ouvrir</, 'no open button without somewhere to go');
}

console.log('guard checks tests passed');
