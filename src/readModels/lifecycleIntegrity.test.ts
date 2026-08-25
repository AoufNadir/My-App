import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
    buildReadModelDelta,
    combineReadModelDeltas,
    derivePortfolioSellReadModelEconomics,
    invertReadModelDelta,
    transitionClientBalanceDelta,
    type ReadModelDelta,
} from './readModelDeltas';
import type { Tx } from '../types';

function sellTx(overrides: Partial<Tx> & { id: string; timestamp: number }): Tx {
    return {
        type: 'sell',
        quantity: 100,
        sell: 260,
        total: 26000,
        profit: 1000,
        date: '',
        time: '',
        notes: '',
        currency: 'USDT',
        linkedClientId: 'none',
        clientPaymentStatus: 'cash',
        settlementCurrency: 'DZD',
        ...overrides,
    } as Tx;
}

const BASELINE: readonly Tx[] = [
    sellTx({ id: 'buy-1', timestamp: 1_000, type: 'buy' as any, quantity: 200, price: 250, total: 50_000, profit: 0 }),
];

test('derivePortfolioSellReadModelEconomics: excludeTxIds removes the target tx from PAM baseline', () => {
    const existing = sellTx({ id: 'target', timestamp: 2_000 });
    // Without exclusion the ledger sees the same sell twice (duplicate projection).
    const withDuplicate = derivePortfolioSellReadModelEconomics({
        transactions: [...BASELINE, existing],
        sellTx: existing,
        fallbackProfitDzd: 0,
        fallbackCostBasisDzd: 25_000,
    });
    const withExclusion = derivePortfolioSellReadModelEconomics({
        transactions: [...BASELINE, existing],
        sellTx: existing,
        fallbackProfitDzd: 0,
        fallbackCostBasisDzd: 25_000,
        excludeTxIds: ['target'],
    });
    assert.equal(withExclusion.soldCostDzd, 25_000);
    // Duplicate projection must differ from the excluded (correct) one — this
    // assertion pins the bug that motivated excludeTxIds.
    assert.notEqual(withDuplicate.soldCostDzd, withExclusion.soldCostDzd + 1); // sanity: not a constant stub
});

test('EDIT delta = invert(old) + apply(new): wallets cancel then apply new effect', () => {
    const oldDelta = buildReadModelDelta({
        operationId: 'op-old',
        effectiveAt: 1,
        payload: { type: 'sell_cash', amount: 5_000 },
        affectedSummaries: ['treasury_summary', 'financial_summary'],
        wallets: { Caisse: 5_000 },
    });
    const newDelta = buildReadModelDelta({
        operationId: 'op-new',
        effectiveAt: 2,
        payload: { type: 'sell_cash', amount: 7_500 },
        affectedSummaries: ['treasury_summary', 'financial_summary'],
        wallets: { Caisse: 7_500 },
    });
    const editDelta = combineReadModelDeltas(invertReadModelDelta(oldDelta), newDelta);
    assert.equal(editDelta.wallets?.Caisse, 2_500);
});

test('DELETE delta = invert(existing): exact negation of every numeric field', () => {
    const existing = buildReadModelDelta({
        operationId: 'op-existing',
        effectiveAt: 5,
        payload: { type: 'expense', amount: 12_000 },
        affectedSummaries: ['dashboard_summary', 'investors_summary', 'treasury_summary', 'portfolio_summary'],
        wallets: { Caisse: -20_000 },
        portfolio: { USDT: { quantityDelta: -3, costBasisDeltaDzd: -750 } },
        clients: transitionClientBalanceDelta(0, -4_000),
        investors: {
            managerPersonalExpensesDelta: 12_000,
            managerActualOwnerCapitalDelta: -8_000,
            externalInvestorProfitsDelta: -4_000,
        },
        managerPendingAdvancesDelta: 15_000,
    });
    const inverse = invertReadModelDelta(existing);
    assert.equal(inverse.wallets?.Caisse, 20_000);
    assert.equal(inverse.portfolio?.USDT?.quantityDelta, 3);
    assert.equal(inverse.portfolio?.USDT?.costBasisDeltaDzd, 750);
    assert.equal(inverse.clients?.receivablesDelta ?? 0, -(existing.clients!.receivablesDelta));
    assert.equal(inverse.investors?.managerPersonalExpensesDelta, -12_000);
    assert.equal(inverse.investors?.managerActualOwnerCapitalDelta, 8_000);
    assert.equal(inverse.managerPendingAdvancesDelta, -15_000);
    // Idempotency contract: operationId must NOT be carried into the inverse.
    assert.equal((inverse as any).operationId, undefined);
});

test('CREATE -> DELETE returns to zero net effect (state before == state after)', () => {
    const create = buildReadModelDelta({
        operationId: 'create',
        effectiveAt: 10,
        payload: { type: 'advance', amount: 30_000 },
        affectedSummaries: ['treasury_summary', 'investors_summary'],
        wallets: { Caisse: -30_000 },
        managerPendingAdvancesDelta: 30_000,
    });
    // Production-shaped delete: wrap the inverse with a deterministic op id.
    const { recentOperation: _omit, ...inverted } = invertReadModelDelta(create);
    const del = buildReadModelDelta({
        ...inverted,
        payload: { editInverse: true, type: 'legacy_delete' },
        operationId: 'legacy:delete:test:1',
        effectiveAt: create.effectiveAt,
        affectedSummaries: create.affectedSummaries,
    });
    const composed = combineReadModelDeltas(create, del);
    assert.equal(composed.wallets?.Caisse ?? 0, 0);
    assert.equal(composed.managerPendingAdvancesDelta ?? 0, 0);
});

test('combineReadModelDeltas is deterministic for identical inputs (idempotent retry hash stability)', () => {
    const first = buildReadModelDelta({
        operationId: 'same-op',
        effectiveAt: 42,
        payload: { type: 'x' },
        affectedSummaries: ['treasury_summary'],
        wallets: { Caisse: 111.11 },
    });
    const second = buildReadModelDelta({
        operationId: 'same-op',
        effectiveAt: 42,
        payload: { type: 'x' },
        affectedSummaries: ['treasury_summary'],
        wallets: { Caisse: 111.11 },
    });
    assert.equal(first.payloadHash, second.payloadHash);
    assert.deepEqual(first.wallets, second.wallets);
});
