import assert from 'node:assert/strict';

import { compareInventory, inventoryExpected, type InventoryCheck } from './inventoryCheck';
import {
    investigateInventory,
    type InvestigatorPortfolioTx,
    type InvestigatorTreasuryTx,
    type TradeSuggestion,
    type UnexplainedSuggestion,
    type WrongChannelSuggestion,
} from './inventoryInvestigator';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 10, 18, 0, 0);

const treasury = (id: string, daysAgo: number, type: string, source: string, amount: number, extra: Partial<InvestigatorTreasuryTx> = {}): InvestigatorTreasuryTx => ({
    id, timestamp: NOW - daysAgo * DAY, date: `d-${daysAgo}`, time: '12:00', type, source, amount, origin: 'usdt_tx', ...extra,
});
const portfolio = (id: string, daysAgo: number, type: string, currency: string, quantity: number, extra: Partial<InvestigatorPortfolioTx> = {}): InvestigatorPortfolioTx => ({
    id, timestamp: NOW - daysAgo * DAY, date: `d-${daysAgo}`, time: '12:00', type, currency, quantity, ...extra,
});
const check = (id: string, daysAgo: number, rows: InventoryCheck['rows']): InventoryCheck => ({ id, timestamp: NOW - daysAgo * DAY, date: `c-${daysAgo}`, time: '20:00', rows });
const row = (account: InventoryCheck['rows'][number]['account'], status: InventoryCheck['rows'][number]['status']): InventoryCheck['rows'][number] => ({ account, expected: 0, counted: 0, gap: 0, status });

const books = inventoryExpected({ caisse: 480_000, baridi: 310_000, usdtAvailable: 1_700, eurAvailable: 0 });
const investigate = (counted: Parameters<typeof compareInventory>[1], over: { checks?: InventoryCheck[]; treasury?: InvestigatorTreasuryTx[]; portfolio?: InvestigatorPortfolioTx[] } = {}) =>
    investigateInventory({
        rows: compareInventory(books, counted),
        checks: over.checks ?? [],
        treasuryTransactions: over.treasury ?? [],
        portfolioTransactions: over.portfolio ?? [],
        now: NOW,
    });

// Nothing to explain when every counted account matches, or nothing was counted.
assert.deepEqual(investigate({ caisse: 480_000, baridi: 310_000, usdt: 1_700 }), []);
assert.deepEqual(investigate({}), []);

// ── A sale never recorded: USDT is short, the cash is over, at a normal price ──────────────────
{
    const recentSells = [262, 264, 266, 268].map((price, i) => portfolio(`s${i}`, i + 1, 'sell', 'USDT', 200, { sell: price }));
    const [found, ...rest] = investigate({ caisse: 612_500, baridi: 310_000, usdt: 1_200 }, { portfolio: recentSells });
    assert.equal(rest.length, 0, 'the cash gap is explained by the sale, not listed again');
    const sale = found as TradeSuggestion;
    assert.equal(sale.kind, 'unrecordedSale');
    assert.equal(sale.currency, 'USDT');
    assert.equal(sale.quantity, 500);
    assert.equal(sale.dzdAmount, 132_500);
    assert.equal(sale.unitPrice, 265);
    assert.equal(sale.channel, 'caisse');
    assert.equal(sale.splitChannels, false);
    assert.deepEqual(sale.recent, { count: 4, min: 262, max: 268 });
    assert.equal(sale.plausible, true);
}

// The same gap at a price far from the recent sales is still shown, but not called plausible.
{
    const recentSells = [262, 264, 266, 268].map((price, i) => portfolio(`s${i}`, i + 1, 'sell', 'USDT', 200, { sell: price }));
    const sale = investigate({ caisse: 480_000, baridi: 310_000 + 150_000, usdt: 1_200 }, { portfolio: recentSells })[0] as TradeSuggestion;
    assert.equal(sale.kind, 'unrecordedSale');
    assert.equal(sale.unitPrice, 300);
    assert.equal(sale.channel, 'baridi', 'the box that received the money');
    assert.equal(sale.plausible, false);
    // Just outside the range but inside the margin is normal; fewer than three trades cannot tell.
    const near = investigate({ caisse: 480_000 + 134_000, baridi: 310_000, usdt: 1_200 }, { portfolio: recentSells })[0] as TradeSuggestion;
    assert.equal(near.unitPrice, 268);
    assert.equal(near.plausible, true);
    const few = investigate({ caisse: 612_500, baridi: 310_000, usdt: 1_200 }, { portfolio: recentSells.slice(0, 2) })[0] as TradeSuggestion;
    assert.equal(few.recent, null);
    assert.equal(few.plausible, null);
}

// Old trades, EUR-settled trades and digital-service sales do not set the price reference.
{
    const noise = [
        portfolio('old1', 90, 'sell', 'USDT', 100, { sell: 100 }),
        portfolio('old2', 80, 'sell', 'USDT', 100, { sell: 100 }),
        portfolio('eur1', 2, 'sell', 'USDT', 100, { sell: 1, settlementCurrency: 'EUR' }),
        portfolio('svc1', 2, 'sell', 'USDT', 100, { sell: 5, origin: 'digital_service_sale' }),
        portfolio('buy1', 2, 'buy', 'USDT', 100, { price: 999 }),
    ];
    const sale = investigate({ caisse: 612_500, baridi: 310_000, usdt: 1_200 }, { portfolio: noise })[0] as TradeSuggestion;
    assert.equal(sale.recent, null);
}

// ── A purchase never recorded: USDT is over, the cash is short ───────────────────────────────────
{
    const recentBuys = [259, 260, 261].map((price, i) => portfolio(`b${i}`, i + 1, 'buy', 'USDT', 300, { price }));
    const buy = investigate({ caisse: 480_000 - 130_000, baridi: 310_000, usdt: 2_200 }, { portfolio: recentBuys })[0] as TradeSuggestion;
    assert.equal(buy.kind, 'unrecordedPurchase');
    assert.equal(buy.quantity, 500);
    assert.equal(buy.dzdAmount, 130_000);
    assert.equal(buy.unitPrice, 260);
    assert.equal(buy.channel, 'caisse');
    assert.equal(buy.plausible, true);
}

// A USDT gap whose cash gap points the other way is not a trade: it stays unexplained.
{
    const found = investigate({ caisse: 400_000, baridi: 310_000, usdt: 1_200 });
    assert.deepEqual(found.map((s) => s.kind), ['unexplained', 'unexplained']);
    assert.deepEqual(found.map((s) => (s as UnexplainedSuggestion).account).sort(), ['caisse', 'usdt']);
}

// Two assets off at once cannot be matched with the cash boxes.
{
    const two = inventoryExpected({ caisse: 480_000, baridi: 310_000, usdtAvailable: 1_700, eurAvailable: 100 });
    const found = investigateInventory({ rows: compareInventory(two, { caisse: 612_500, usdt: 1_200, eur: 50 }), checks: [], treasuryTransactions: [], portfolioTransactions: [], now: NOW });
    assert.deepEqual(found.map((s) => s.kind), ['unexplained', 'unexplained', 'unexplained']);
}

// ── A wrong box: the two cash gaps cancel ────────────────────────────────────────────────────────
{
    const ops = [
        treasury('t1', 1, 'Ajout', 'Caisse', 50_000, { linkedTxId: 'p1' }),
        treasury('t2', 2, 'Ajout', 'BaridiMob', 50_000),
        treasury('t3', 2, 'Retrait', 'Caisse', 50_000),
        treasury('t4', 3, 'Ajout', 'Caisse', 51_500),
        treasury('t5', 4, 'Ajout', 'Caisse', 50_000, { origin: 'balance_edit' }),
        treasury('t6', 5, 'Retrait', 'BaridiMob', 50_000, { linkedTxId: 'p9' }),
    ];
    const sells = [portfolio('p1', 1, 'sell', 'USDT', 190, { sell: 263 })];
    const [found, ...rest] = investigate({ caisse: 430_000, baridi: 360_000 }, { treasury: ops, portfolio: sells });
    assert.equal(rest.length, 0);
    const wrong = found as WrongChannelSuggestion;
    assert.equal(wrong.kind, 'wrongChannel');
    assert.equal(wrong.amount, 50_000);
    assert.equal(wrong.booksAbove, 'caisse');
    assert.equal(wrong.booksBelow, 'baridi');
    // Money in recorded in the box that is too high (t1), money out recorded in the box that is too low (t6).
    // A same-box money in of the wrong direction (t2, t3), another amount (t4) and a past correction (t5) are out.
    assert.deepEqual(wrong.candidates.map((c) => [c.tx.id, c.shouldBe]), [['t1', 'baridi'], ['t6', 'caisse']]);
    assert.deepEqual(wrong.candidates[0].linked, { type: 'sell', currency: 'USDT', quantity: 190 });
    assert.equal(wrong.candidates[1].linked, undefined, 'a link to an unknown operation is ignored');
    // The same gap is also what a transfer from the box that is too high to the other, never recorded, would leave.
    assert.deepEqual(wrong.transfer, { amount: 50_000, from: 'caisse', to: 'baridi' });
    assert.equal(wrong.since, null);
}

// The other direction: the box that is too high is BaridiMob.
{
    const ops = [treasury('t1', 1, 'Ajout', 'BaridiMob', 20_000), treasury('t2', 1, 'Retrait', 'Caisse', 20_000), treasury('t3', 1, 'Ajout', 'Caisse', 20_000)];
    const wrong = investigate({ caisse: 500_000, baridi: 290_000 }, { treasury: ops })[0] as WrongChannelSuggestion;
    assert.equal(wrong.booksAbove, 'baridi');
    assert.deepEqual(wrong.candidates.map((c) => [c.tx.id, c.shouldBe]), [['t1', 'caisse'], ['t2', 'baridi']]);
    assert.deepEqual(wrong.transfer, { amount: 20_000, from: 'baridi', to: 'caisse' });
}

// Only operations after the last inventory at which one of the boxes matched are candidates.
{
    const checks = [check('c1', 2, [row('caisse', 'match'), row('baridi', 'short')]), check('c0', 9, [row('baridi', 'match')])];
    const ops = [treasury('before', 3, 'Ajout', 'Caisse', 50_000), treasury('after', 1, 'Ajout', 'Caisse', 50_000)];
    const wrong = investigate({ caisse: 430_000, baridi: 360_000 }, { treasury: ops, checks })[0] as WrongChannelSuggestion;
    assert.equal(wrong.since, NOW - 2 * DAY);
    assert.equal(wrong.sinceDate, 'c-2');
    assert.deepEqual(wrong.candidates.map((c) => c.tx.id), ['after']);
}

// Gaps that do not cancel, or point the same way, are not a wrong box.
{
    assert.deepEqual(investigate({ caisse: 430_000, baridi: 355_000 }).map((s) => s.kind), ['unexplained', 'unexplained']);
    assert.deepEqual(investigate({ caisse: 430_000, baridi: 260_000 }).map((s) => s.kind), ['unexplained', 'unexplained']);
    // Only one box counted: nothing to cancel against.
    assert.deepEqual(investigate({ caisse: 430_000 }).map((s) => s.kind), ['unexplained']);
    // Within one dinar of cancelling still counts.
    assert.equal(investigate({ caisse: 430_000, baridi: 360_000.5 })[0].kind, 'wrongChannel');
}

// ── Unexplained gaps: the operations since the account last matched ───────────────────────────────
{
    const checks = [check('c1', 4, [row('baridi', 'match')]), check('c2', 1, [row('baridi', 'short')])];
    const ops = [
        treasury('t-old', 6, 'Ajout', 'BaridiMob', 10_000),
        treasury('t-1', 3, 'Ajout', 'BaridiMob', 20_000),
        treasury('t-2', 2, 'Retrait', 'BaridiMob', 5_000),
        treasury('t-case', 2, 'Ajout', 'Caisse', 7_000),
        treasury('t-fix', 2, 'Retrait', 'BaridiMob', 999, { origin: 'balance_edit' }),
        treasury('t-tr', 1, 'Transfer', 'Caisse', 8_000, { destination: 'BaridiMob' }),
    ];
    const found = investigate({ baridi: 300_000 }, { treasury: ops, checks });
    assert.equal(found.length, 1);
    const open = found[0] as UnexplainedSuggestion;
    assert.equal(open.account, 'baridi');
    assert.equal(open.gap, -10_000);
    assert.equal(open.since, NOW - 4 * DAY);
    assert.equal(open.sinceDate, 'c-4');
    assert.equal(open.count, 3);
    assert.deepEqual(open.operations.map((o) => [o.id, o.direction, o.amount]), [['t-tr', 1, 8_000], ['t-2', -1, 5_000], ['t-1', 1, 20_000]]);
}

// A box that never matched an inventory searches all its history; a long list is cut but counted.
{
    const many = Array.from({ length: 12 }, (_, i) => treasury(`m${i}`, i + 1, 'Ajout', 'Caisse', 1_000 + i));
    const open = investigate({ caisse: 479_000 }, { treasury: many })[0] as UnexplainedSuggestion;
    assert.equal(open.since, null);
    assert.equal(open.count, 12);
    assert.equal(open.operations.length, 8);
    assert.equal(open.operations[0].id, 'm0', 'newest first');
}

// USDT: the operations of that currency, buys and sells and manual adds, never past corrections.
{
    const ops = [
        portfolio('u1', 3, 'buy', 'USDT', 100),
        portfolio('u2', 2, 'sell', 'USDT', 40),
        portfolio('u3', 2, 'Ajout Manuel', 'USDT', 5, { origin: 'balance_edit' }),
        portfolio('u4', 2, 'sell', 'EUR', 30),
        portfolio('u5', 1, 'Retrait Manuel', 'USDT', 2),
    ];
    const open = investigate({ usdt: 1_650 }, { portfolio: ops })[0] as UnexplainedSuggestion;
    assert.equal(open.account, 'usdt');
    assert.deepEqual(open.operations.map((o) => [o.id, o.direction, o.source]), [['u5', -1, 'portfolio'], ['u2', -1, 'portfolio'], ['u1', 1, 'portfolio']]);
}

// The investigator reads; it never changes what it was given.
{
    const ops = [treasury('t1', 1, 'Ajout', 'Caisse', 50_000)];
    const frozen = JSON.stringify(ops);
    investigate({ caisse: 430_000, baridi: 360_000 }, { treasury: ops });
    assert.equal(JSON.stringify(ops), frozen);
}

console.log('inventoryInvestigator tests passed');
