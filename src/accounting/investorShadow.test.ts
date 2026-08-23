import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import type { Investor, InvestorTransaction, Tx } from '../types';
import {
    INVESTORS_V2_READINESS,
    INVESTOR_SHADOW_WRITERS,
    areReversalPostingsExact,
    assertInvestorShadowFixtures,
    buildInvestorShadowDraft,
    buildInvestorShadowReversalDraft,
    clearInvestorShadowDiagnostics,
    compareInvestorShadow,
    createInvestorProfitAllocationSnapshot,
    getInvestorShadowDiagnostics,
    recordInvestorShadow,
    reconcileLegacyInvestorsToShadow,
    validateAccountingOperation,
} from './index';

assert.equal(INVESTORS_V2_READINESS, 'shadow', 'Investors Shadow must not activate a V2 writer or closure.');
assert.ok(INVESTOR_SHADOW_WRITERS.length >= 11, 'The Investor writer inventory must be explicit.');
for (const writer of INVESTOR_SHADOW_WRITERS.filter((writer) => writer.v2Policy === 'shadow_observed' && writer.file.endsWith('.ts'))) {
    const source = readFileSync(new URL(`../${writer.file.replace(/^src\//, '')}`, import.meta.url), 'utf8');
    if (writer.file.includes('useInvestorHandlers')) assert.match(source, /recordInvestorShadow/, `${writer.id} must observe Legacy without enabling V2.`);
    assert.doesNotMatch(source, /commitFinancialOperation|accounting_operations/, `${writer.id} must not create a V2 Firebase operation in Shadow.`);
}

const pureBuilderSource = readFileSync(new URL('./investorShadow.ts', import.meta.url), 'utf8');
assert.doesNotMatch(pureBuilderSource, /firebase|recordInvestorShadow|Date\.now|Math\.random/, 'Investor draft builders must be pure and Firestore-free.');
const diagnosticsSource = readFileSync(new URL('./investorShadowDiagnostics.ts', import.meta.url), 'utf8');
assert.doesNotMatch(diagnosticsSource, /firebase|collection\(|\.set\(|\.update\(|\.delete\(/, 'Investor diagnostics must never write Firebase.');

assert.doesNotThrow(assertInvestorShadowFixtures, 'Independent Investor accounting fixtures must balance.');

const allocationIntent = {
    operationId: 'fixture:investor:allocation',
    actorUid: 'owner',
    effectiveAt: 1_760_000_000_000,
    kind: 'profit_allocation' as const,
    projectProfitDzd: 100,
    managerId: 'manager',
    managerFeePercentage: 30,
    eligibleInvestorCapital: [
        { investorId: 'manager', capitalDzd: 100, isManager: true },
        { investorId: 'external', capitalDzd: 300, isManager: false },
    ],
};
const allocation = createInvestorProfitAllocationSnapshot(allocationIntent);
assert.deepEqual(allocation, {
    projectProfitDzd: 100,
    managerFeeDzd: 30,
    managerCapitalDzd: 17.5,
    externalInvestorShares: [{ investorId: 'external', amountDzd: 52.5 }],
    managerFeePercentage: 30,
    eligibleInvestorCapital: [
        { investorId: 'external', capitalDzd: 300 },
        { investorId: 'manager', capitalDzd: 100 },
    ],
}, 'Profit project = manager fee + manager capital + external investor shares.');
const allocationDraft = buildInvestorShadowDraft(allocationIntent);
assert.deepEqual(validateAccountingOperation(allocationDraft), []);
assert.deepEqual(allocationDraft.postings.map(({ account, side, amountDzd, investorId }) => ({ account, side, amountDzd, investorId })), [
    { account: 'equity.project_profit_allocation', side: 'debit', amountDzd: 100, investorId: undefined },
    { account: 'equity.manager_profit_due', side: 'credit', amountDzd: 30, investorId: 'manager' },
    { account: 'equity.manager_profit_due', side: 'credit', amountDzd: 17.5, investorId: 'manager' },
    { account: 'liability.investor_profit_due', side: 'credit', amountDzd: 52.5, investorId: 'external' },
]);

// Full required fixture: sale allocation -> entitlement -> partial payout -> reinvestment.
const payout = compareInvestorShadow({
    operationId: 'fixture:investor:payout', actorUid: 'owner', effectiveAt: 2, kind: 'profit_payout',
    investorId: 'external', isManager: false, amountDzd: 20, availableProfitBeforeDzd: 52.5, wallet: 'Caisse',
}, {
    profitDueDeltasDzd: { external: -20 }, profitPayoutsDzd: { external: 20 }, cashDeltasDzd: { Caisse: -20 },
});
assert.equal(payout.matches, true);
const reinvestment = compareInvestorShadow({
    operationId: 'fixture:investor:reinvestment', actorUid: 'owner', effectiveAt: 3, kind: 'profit_reinvestment',
    investorId: 'external', isManager: false, amountDzd: 32.5, availableProfitBeforeDzd: 32.5,
}, {
    capitalDeltasDzd: { external: 32.5 }, profitDueDeltasDzd: { external: -32.5 }, reinvestmentsDzd: { external: 32.5 },
});
assert.equal(reinvestment.matches, true);
assert.equal(reinvestment.ledgerEffects.cashDeltasDzd.Caisse, 0, 'Reinvestment transfers available profit to capital with no cash movement.');
assert.throws(() => buildInvestorShadowDraft({
    operationId: 'fixture:investor:reinvestment-over', actorUid: 'owner', effectiveAt: 3, kind: 'profit_reinvestment',
    investorId: 'external', isManager: false, amountDzd: 32.51, availableProfitBeforeDzd: 32.5,
}), /exceeds available profit/i, 'Reinvestment cannot exceed available profit.');

const advance = buildInvestorShadowDraft({
    operationId: 'fixture:manager:advance', actorUid: 'owner', effectiveAt: 4, kind: 'personal_advance',
    investorId: 'manager', isManager: true, amountDzd: 100, wallet: 'Caisse',
});
const settleAdvance = compareInvestorShadow({
    operationId: 'fixture:manager:advance-settle', actorUid: 'owner', effectiveAt: 5, kind: 'personal_advance_reconcile',
    investorId: 'manager', isManager: true, advanceAmountDzd: 100, returnedAmountDzd: 30,
    profitAmountDzd: 50, capitalAmountDzd: 20, wallet: 'Caisse',
}, {
    managerAdvanceDzd: -100, personalExpenseProfitDzd: 50, personalExpenseCapitalDzd: 20,
    profitDueDeltasDzd: { manager: -50 }, capitalDeltasDzd: { manager: -20 }, cashDeltasDzd: { Caisse: 30 },
});
assert.equal(settleAdvance.matches, true);
assert.equal(advance.postings.some((posting) => posting.account === 'equity.manager_capital'), false, 'An advance does not reduce capital before it is reconciled.');
assert.equal(settleAdvance.ledgerEffects.capitalDeltasDzd.manager, -20, 'Only the excess personal expense reduces manager capital once.');

const reversal = buildInvestorShadowReversalDraft(allocationDraft, {
    operationId: 'fixture:investor:allocation:reversal', actorUid: 'owner', effectiveAt: 6,
});
assert.equal(reversal.reversalOf, allocationDraft.operationId);
assert.equal(reversal.status, 'reversal');
assert.deepEqual(validateAccountingOperation(reversal), []);
assert.equal(areReversalPostingsExact({ ...allocationDraft, idempotencyPayload: 'fixture' }, reversal), true, 'A future reversal must be immutable and exact.');

const investors: Investor[] = [
    { id: 'manager', name: 'Manager', entryDate: new Date(0).toISOString(), initialCapital: 100, capitalInvested: 310, sharePercentage: 0, totalProfit: 210, withdrawnProfit: 0, availableProfit: 210, isActive: true, isManager: true },
    { id: 'external', name: 'External', entryDate: new Date(0).toISOString(), initialCapital: 100, capitalInvested: 200, sharePercentage: 0, totalProfit: 150, withdrawnProfit: 0, availableProfit: 150, isActive: true },
    { id: 'late', name: 'Late', entryDate: new Date(250).toISOString(), initialCapital: 100, capitalInvested: 100, sharePercentage: 0, totalProfit: 40, withdrawnProfit: 0, availableProfit: 40, isActive: true },
];
const investorTransactions: InvestorTransaction[] = [
    { id: 'manager-opening', investorId: 'manager', type: 'deposit_capital', amount: 100, origin: 'initial_capital', timestamp: 1, date: '', time: '', notes: 'Capital Initial' },
    { id: 'external-opening', investorId: 'external', type: 'deposit_capital', amount: 100, origin: 'initial_capital', timestamp: 1, date: '', time: '', notes: 'Capital Initial' },
    { id: 'late-opening', investorId: 'late', type: 'deposit_capital', amount: 100, origin: 'initial_capital', timestamp: 250, date: '', time: '', notes: 'Capital Initial' },
    { id: 'external-top-up', investorId: 'external', type: 'deposit_capital', amount: 100, origin: 'capital_movement', timestamp: 300, date: '', time: '', notes: 'Top up' },
];
const transactions: Tx[] = [
    { id: 'buy-one', type: 'buy', currency: 'USDT', quantity: 10, price: 100, total: 1_000, timestamp: 10, date: '', time: '', notes: '' },
    { id: 'sale-before-late', type: 'sell', currency: 'USDT', quantity: 10, price: 120, total: 1_200, timestamp: 200, date: '', time: '', notes: '' },
    { id: 'buy-two', type: 'buy', currency: 'USDT', quantity: 10, price: 100, total: 1_000, timestamp: 260, date: '', time: '', notes: '' },
    { id: 'sale-after-change', type: 'sell', currency: 'USDT', quantity: 10, price: 120, total: 1_200, timestamp: 400, date: '', time: '', notes: '' },
];
const historical = reconcileLegacyInvestorsToShadow({
    investors,
    investorTransactions,
    transactions,
    deliveryExpenses: [],
    treasuryTransactions: [],
    managerFeeHistory: [{ percentage: 20, effectiveFrom: 300 }],
    legacyDerivedInvestors: investors,
    legacyManagerShareDzd: 210,
});
assert.equal(historical.ok, true, `Historical read reconciliation failed: ${historical.errors.join(' | ')}`);
assert.equal(historical.snapshots.length, 2);
assert.equal(historical.snapshots[0].snapshot.managerFeePercentage, 30, 'Pre-change sale must retain the legacy 30% manager fee.');
assert.equal(historical.snapshots[0].snapshot.externalInvestorShares.some((share) => share.investorId === 'late'), false, 'Late investor has no right before entryDate.');
assert.equal(historical.snapshots[1].snapshot.managerFeePercentage, 20, 'New sale after the fee change must use 20%.');
assert.deepEqual(historical.rows.map((row) => [row.investorId, row.capitalDifferenceDzd, row.totalProfitDifferenceDzd]), [
    ['manager', 0, 0], ['external', 0, 0], ['late', 0, 0],
], 'Later capital and fee changes must not rewrite historical allocations.');
assert.deepEqual(historical.totals, {
    capital: { legacyDzd: 610, shadowDzd: 610, differenceDzd: 0 },
    totalProfit: { legacyDzd: 400, shadowDzd: 400, differenceDzd: 0 },
    availableProfit: { legacyDzd: 400, shadowDzd: 400, differenceDzd: 0 },
    reinvestedProfit: { legacyDzd: 0, shadowDzd: 0, differenceDzd: 0 },
    personalExpenses: { legacyDzd: 0, shadowDzd: 0, differenceDzd: 0 },
    managerShare: { legacyDzd: 210, shadowDzd: 210, differenceDzd: 0 },
}, 'All current Investor read-reconciliation metrics must use the same cent-level source of truth.');

clearInvestorShadowDiagnostics();
const originalWarn = console.warn;
const warnings: unknown[][] = [];
console.warn = (...args: unknown[]) => warnings.push(args);
try {
    const mismatch = recordInvestorShadow(payout.intent, { cashDeltasDzd: { Caisse: -99 } });
    assert.equal(mismatch?.matches, false, 'A Shadow mismatch must be retained for review only.');
    assert.equal(getInvestorShadowDiagnostics().length, 1);
    assert.doesNotThrow(() => recordInvestorShadow({
        operationId: 'fixture:investor:payout-invalid', actorUid: 'owner', effectiveAt: 7, kind: 'profit_payout',
        investorId: 'external', isManager: false, amountDzd: 0, availableProfitBeforeDzd: 52.5, wallet: 'Caisse',
    }), 'A Shadow failure must never block the Legacy writer.');
    assert.equal(getInvestorShadowDiagnostics().length, 1, 'Rejected drafts must not become V2 operations.');
}
finally {
    console.warn = originalWarn;
}
assert.equal(warnings.length, 2, 'Mismatch and rejected draft are diagnostics only.');

console.log(`Investors shadow tests passed (${INVESTOR_SHADOW_WRITERS.length} writer paths, historical snapshots, payout and reinvestment fixtures).`);
