import assert from 'node:assert/strict';

import {
    AccountingV2PreparedError,
    areReversalPostingsExact,
    assertAccountingV2WriteEnabled,
    buildLegacyLedgerIndex,
    commitFinancialOperation,
    createIdempotencyPayload,
    getAccountingV2Status,
    HISTORICAL_CLOSING_ADJUSTMENT_DZD,
    HISTORICAL_CLOSING_BASELINE_DZD,
    HISTORICAL_CLOSING_PREVIOUS_BASELINE_DZD,
    reconcileAccountingOperations,
    validateAccountingOperation,
    type AccountingOperation,
    type AccountingOperationDraft,
} from './index';

const allocation = {
    projectProfitDzd: 170,
    managerFeeDzd: 20,
    managerCapitalDzd: 100,
    externalInvestorShares: [{ investorId: 'investor-a', amountDzd: 50 }],
    managerFeePercentage: 20,
    eligibleInvestorCapital: [{ investorId: 'investor-a', capitalDzd: 1_000 }],
};

const profitOperation: AccountingOperationDraft = {
    operationId: 'op:profit:1',
    accountingVersion: 2,
    kind: 'portfolio_sell',
    status: 'posted',
    effectiveAt: Date.parse('2026-08-23T10:00:00.000Z'),
    actorUid: 'owner',
    postings: [
        { id: 'cash', account: 'asset.cash.caisse', side: 'debit', amountDzd: 170 },
        { id: 'income', account: 'income.trading', side: 'credit', amountDzd: 170 },
        { id: 'allocation', account: 'equity.profit_allocation', side: 'debit', amountDzd: 50 },
        { id: 'investor-profit', account: 'liability.investor_profit', side: 'credit', amountDzd: 50, investorId: 'investor-a' },
    ],
    projections: [{ collection: 'usdt_txs', id: 'op:profit:1:portfolio' }],
    profitAllocation: allocation,
};

function posted(draft: AccountingOperationDraft): AccountingOperation {
    return { ...draft, idempotencyPayload: createIdempotencyPayload(draft) };
}

assert.equal(HISTORICAL_CLOSING_BASELINE_DZD, 362_288);
assert.equal(HISTORICAL_CLOSING_PREVIOUS_BASELINE_DZD + HISTORICAL_CLOSING_ADJUSTMENT_DZD, HISTORICAL_CLOSING_BASELINE_DZD);
assert.deepEqual(getAccountingV2Status(undefined), { mode: 'prepared', closureAt: null, reason: 'missing_closure_at' });
assert.equal(getAccountingV2Status('2026-08-23T00:00:00.000Z').mode, 'active');
assert.throws(() => assertAccountingV2WriteEnabled(getAccountingV2Status(undefined)), AccountingV2PreparedError);
await assert.rejects(
    () => commitFinancialOperation(null as never, profitOperation, getAccountingV2Status(undefined)),
    (error: unknown) => error instanceof AccountingV2PreparedError,
    'Prepared mode must reject before a Firestore reference can be used.',
);

assert.deepEqual(validateAccountingOperation(profitOperation), []);
assert.equal(createIdempotencyPayload(profitOperation), createIdempotencyPayload({ ...profitOperation }));
assert.notEqual(createIdempotencyPayload(profitOperation), createIdempotencyPayload({
    ...profitOperation,
    postings: profitOperation.postings.map((posting) => posting.id === 'cash' ? { ...posting, amountDzd: 171 } : posting),
}));

const liabilityOperations: AccountingOperation[] = [
    posted(profitOperation),
    posted({
        operationId: 'op:client-advance:1', accountingVersion: 2, kind: 'client_settlement', status: 'posted',
        effectiveAt: profitOperation.effectiveAt + 1, actorUid: 'owner', projections: [],
        postings: [
            { id: 'cash', account: 'asset.cash.caisse', side: 'debit', amountDzd: 20 },
            { id: 'advance', account: 'liability.client_advance', side: 'credit', amountDzd: 20 },
        ],
    }),
    posted({
        operationId: 'op:service-advance:1', accountingVersion: 2, kind: 'digital_service_sale', status: 'posted',
        effectiveAt: profitOperation.effectiveAt + 2, actorUid: 'owner', projections: [],
        postings: [
            { id: 'cash', account: 'asset.cash.baridimob', side: 'debit', amountDzd: 10 },
            { id: 'advance', account: 'liability.service_advance', side: 'credit', amountDzd: 10 },
        ],
    }),
    posted({
        operationId: 'op:payable:1', accountingVersion: 2, kind: 'project_expense', status: 'posted',
        effectiveAt: profitOperation.effectiveAt + 3, actorUid: 'owner', projections: [],
        postings: [
            { id: 'stock', account: 'asset.inventory.usdt', side: 'debit', amountDzd: 30 },
            { id: 'payable', account: 'liability.payable_supplier', side: 'credit', amountDzd: 30 },
        ],
    }),
    posted({
        operationId: 'op:custody:1', accountingVersion: 2, kind: 'treasury_transfer', status: 'posted',
        effectiveAt: profitOperation.effectiveAt + 4, actorUid: 'owner', projections: [],
        postings: [
            { id: 'cash', account: 'asset.cash.caisse', side: 'debit', amountDzd: 15 },
            { id: 'custody', account: 'liability.custody_agent', side: 'credit', amountDzd: 15 },
        ],
    }),
];

const report = reconcileAccountingOperations(liabilityOperations);
assert.equal(report.ok, true);
assert.equal(report.assetsDzd, 245);
assert.equal(report.liabilitiesDzd, 125, 'All liability.* accounts must be included, including future payable/custody accounts.');
assert.equal(report.ownerEquityDzd, 120);
assert.equal(report.projectProfitDzd, 170);
assert.equal(report.managerFeeDzd + report.managerCapitalDzd + report.externalInvestorProfitDzd, report.projectProfitDzd);

assert.ok(validateAccountingOperation({
    ...profitOperation,
    operationId: 'op:reversal:1',
    kind: 'reversal',
    status: 'reversal',
    reversalOf: profitOperation.operationId,
    projections: [{ collection: 'usdt_txs', id: 'op:reversal:1:portfolio' },],
}).length === 0);
assert.ok(validateAccountingOperation({ ...profitOperation, kind: 'reversal', status: 'reversal' }).some((error) => error.includes('reversalOf')));
const exactReversal: AccountingOperationDraft = {
    ...profitOperation,
    operationId: 'op:reversal:exact',
    kind: 'reversal',
    status: 'reversal',
    reversalOf: profitOperation.operationId,
    projections: [{ collection: 'usdt_txs', id: 'op:reversal:exact:portfolio' }],
    postings: profitOperation.postings.map((posting) => ({
        ...posting,
        id: `reverse-${posting.id}`,
        side: posting.side === 'debit' ? 'credit' : 'debit',
    })),
};
assert.equal(areReversalPostingsExact(posted(profitOperation), exactReversal), true);
assert.equal(areReversalPostingsExact(posted(profitOperation), { ...exactReversal, postings: exactReversal.postings.slice(1) }), false);

const legacy = buildLegacyLedgerIndex({
    transactions: [{ id: 'sale-1', type: 'sell', quantity: 1, sell: 250, date: '23/08/2026', time: '10:00', timestamp: 10, currency: 'USDT' }],
    treasuryTransactions: [{ id: 'cash-1', linkedTxId: 'sale-1', type: 'Ajout', source: 'Caisse', amount: 250, date: '23/08/2026', time: '10:00', timestamp: 10 }],
    clientTransactions: [{ id: 'client-1', clientId: 'client', linkedTxId: 'sale-1', montant: -250, type: 'Vente USDT', date: '23/08/2026', time: '10:00', timestamp: 10 }],
});
assert.equal(legacy.length, 1);
assert.equal(legacy[0].records.length, 3);

console.log('Core Ledger tests passed');
