import type { FinancialOperationKind, LedgerAccount, LedgerPostingSide } from './types';
import type {
    ClientPositionSnapshot,
    ClientShadowEffects,
    ClientShadowIntent,
    ClientShadowKind,
    LegacyClientShadowFacts,
} from './clientShadow';

export type ExpectedClientPosting = {
    account: LedgerAccount;
    side: LedgerPostingSide;
    amountDzd: number;
    clientId?: string;
};

export type ClientShadowFixture = {
    label: string;
    intent: ClientShadowIntent;
    legacyFacts: LegacyClientShadowFacts;
    expectedKind: FinancialOperationKind;
    expectedPostings: readonly ExpectedClientPosting[];
    expectedEffects: ClientShadowEffects;
};

const EFFECTIVE_AT = Date.parse('2026-08-22T12:00:00.000Z');
const ACTOR_UID = 'clients-shadow-fixture-owner';

const position = (clientId: string, overrides: Partial<ClientPositionSnapshot> = {}): ClientPositionSnapshot => ({
    clientId,
    effectiveAt: EFFECTIVE_AT,
    balanceDzd: 0,
    receivableDzd: 0,
    advanceDzd: 0,
    receivableLots: [],
    advanceLots: [],
    ...overrides,
});

const effects = (overrides: Partial<ClientShadowEffects> = {}): ClientShadowEffects => ({
    clientDeltas: {},
    cashDeltasDzd: { Caisse: 0, BaridiMob: 0 },
    receivableDzd: 0,
    clientAdvanceDzd: 0,
    clientPayableDzd: 0,
    supplierPayableDzd: 0,
    ...overrides,
});

const debtA = position('client-a', {
    balanceDzd: -100,
    receivableDzd: 100,
    receivableLots: [{
        sourceTxId: 'debt-a', originClientId: 'client-a', timestamp: EFFECTIVE_AT - 10_000,
        dueTimestamp: EFFECTIVE_AT + 10_000, dueDate: '2026-08-23', remainingDzd: 100,
    }],
});
const advanceA = position('client-a', {
    balanceDzd: 80,
    advanceDzd: 80,
    advanceLots: [{
        sourceTxId: 'advance-a', originClientId: 'client-a', timestamp: EFFECTIVE_AT - 10_000,
        dueTimestamp: EFFECTIVE_AT - 10_000, remainingDzd: 80,
    }],
});
const splitDebtA = position('client-a', {
    balanceDzd: -100,
    receivableDzd: 100,
    receivableLots: [
        { sourceTxId: 'debt-a-old', originClientId: 'client-a', timestamp: EFFECTIVE_AT - 20_000, dueTimestamp: EFFECTIVE_AT + 1_000, dueDate: '2026-08-22', remainingDzd: 40 },
        { sourceTxId: 'debt-a-new', originClientId: 'client-a', timestamp: EFFECTIVE_AT - 10_000, dueTimestamp: EFFECTIVE_AT + 2_000, dueDate: '2026-08-23', remainingDzd: 60 },
    ],
});
const splitAdvanceA = position('client-a', {
    balanceDzd: 100,
    advanceDzd: 100,
    advanceLots: [
        { sourceTxId: 'advance-a-old', originClientId: 'client-a', timestamp: EFFECTIVE_AT - 20_000, dueTimestamp: EFFECTIVE_AT - 20_000, remainingDzd: 40 },
        { sourceTxId: 'advance-a-new', originClientId: 'client-a', timestamp: EFFECTIVE_AT - 10_000, dueTimestamp: EFFECTIVE_AT - 10_000, remainingDzd: 60 },
    ],
});

/** Independent expected accounting for every Clients Shadow movement. */
export const CLIENT_SHADOW_EXPECTED_FIXTURES: readonly ClientShadowFixture[] = [
    {
        label: 'Positive initial balance is an explicit client advance opening',
        intent: { operationId: 'fixture:client-initial-positive', actorUid: ACTOR_UID, effectiveAt: EFFECTIVE_AT, kind: 'client_initial_balance', clientId: 'client-a', amountDzd: 100, positionBefore: position('client-a'), reason: 'Imported opening balance', counterpartAccount: 'equity.client_opening_balance' },
        legacyFacts: { clientDeltas: { 'client-a': 100 }, clientAdvanceDzd: 100 },
        expectedKind: 'correction',
        expectedPostings: [{ account: 'liability.client_advance', side: 'credit', amountDzd: 100, clientId: 'client-a' }, { account: 'equity.client_opening_balance', side: 'debit', amountDzd: 100 }],
        expectedEffects: effects({ clientDeltas: { 'client-a': 100 }, clientAdvanceDzd: 100 }),
    },
    {
        label: 'Negative adjustment is an explicit receivable correction',
        intent: { operationId: 'fixture:client-adjustment-negative', actorUid: ACTOR_UID, effectiveAt: EFFECTIVE_AT, kind: 'client_balance_adjustment', clientId: 'client-a', amountDzd: -30, positionBefore: position('client-a'), reason: 'Approved correction', counterpartAccount: 'equity.client_balance_correction' },
        legacyFacts: { clientDeltas: { 'client-a': -30 }, receivableDzd: 30 },
        expectedKind: 'correction',
        expectedPostings: [{ account: 'asset.receivable.client', side: 'debit', amountDzd: 30, clientId: 'client-a' }, { account: 'equity.client_balance_correction', side: 'credit', amountDzd: 30 }],
        expectedEffects: effects({ clientDeltas: { 'client-a': -30 }, receivableDzd: 30 }),
    },
    {
        label: 'Cash receipt settles receivable then creates advance',
        intent: { operationId: 'fixture:client-cash-receipt', actorUid: ACTOR_UID, effectiveAt: EFFECTIVE_AT, kind: 'client_cash_receipt', clientId: 'client-a', amountDzd: 100, positionBefore: position('client-a', { ...debtA, balanceDzd: -80, receivableDzd: 80, receivableLots: [{ ...debtA.receivableLots[0], remainingDzd: 80 }] }), wallet: 'Caisse' },
        legacyFacts: { clientDeltas: { 'client-a': 100 }, cashDeltasDzd: { Caisse: 100 }, receivableDzd: -80, clientAdvanceDzd: 20 },
        expectedKind: 'client_settlement',
        expectedPostings: [{ account: 'asset.cash.caisse', side: 'debit', amountDzd: 100 }, { account: 'asset.receivable.client', side: 'credit', amountDzd: 80, clientId: 'client-a' }, { account: 'liability.client_advance', side: 'credit', amountDzd: 20, clientId: 'client-a' }],
        expectedEffects: effects({ clientDeltas: { 'client-a': 100 }, cashDeltasDzd: { Caisse: 100, BaridiMob: 0 }, receivableDzd: -80, clientAdvanceDzd: 20 }),
    },
    {
        label: 'Cash payout settles advance then creates receivable',
        intent: { operationId: 'fixture:client-cash-payout', actorUid: ACTOR_UID, effectiveAt: EFFECTIVE_AT, kind: 'client_cash_payout', clientId: 'client-a', amountDzd: 100, positionBefore: position('client-a', { ...advanceA }), wallet: 'BaridiMob' },
        legacyFacts: { clientDeltas: { 'client-a': -100 }, cashDeltasDzd: { BaridiMob: -100 }, receivableDzd: 20, clientAdvanceDzd: -80 },
        expectedKind: 'client_settlement',
        expectedPostings: [{ account: 'asset.cash.baridimob', side: 'credit', amountDzd: 100 }, { account: 'liability.client_advance', side: 'debit', amountDzd: 80, clientId: 'client-a' }, { account: 'asset.receivable.client', side: 'debit', amountDzd: 20, clientId: 'client-a' }],
        expectedEffects: effects({ clientDeltas: { 'client-a': -100 }, cashDeltasDzd: { Caisse: 0, BaridiMob: -100 }, receivableDzd: 20, clientAdvanceDzd: -80 }),
    },
    {
        label: 'Receivable transfer moves the oldest lots without changing project receivables',
        intent: { operationId: 'fixture:client-receivable-transfer', actorUid: ACTOR_UID, effectiveAt: EFFECTIVE_AT, kind: 'client_receivable_transfer', fromClientId: 'client-a', toClientId: 'client-b', amountDzd: 50, fromPositionBefore: splitDebtA, toPositionBefore: position('client-b') },
        legacyFacts: { clientDeltas: { 'client-a': 50, 'client-b': -50 }, receivableDzd: 0 },
        expectedKind: 'client_transfer',
        expectedPostings: [{ account: 'asset.receivable.client', side: 'debit', amountDzd: 50, clientId: 'client-b' }, { account: 'asset.receivable.client', side: 'credit', amountDzd: 50, clientId: 'client-a' }],
        expectedEffects: effects({ clientDeltas: { 'client-a': 50, 'client-b': -50 } }),
    },
    {
        label: 'Advance transfer moves FIFO provenance without changing project advances',
        intent: { operationId: 'fixture:client-advance-transfer', actorUid: ACTOR_UID, effectiveAt: EFFECTIVE_AT, kind: 'client_advance_transfer', fromClientId: 'client-a', toClientId: 'client-b', amountDzd: 50, fromPositionBefore: splitAdvanceA, toPositionBefore: position('client-b') },
        legacyFacts: { clientDeltas: { 'client-a': -50, 'client-b': 50 }, clientAdvanceDzd: 0 },
        expectedKind: 'client_transfer',
        expectedPostings: [{ account: 'liability.client_advance', side: 'debit', amountDzd: 50, clientId: 'client-a' }, { account: 'liability.client_advance', side: 'credit', amountDzd: 50, clientId: 'client-b' }],
        expectedEffects: effects({ clientDeltas: { 'client-a': -50, 'client-b': 50 } }),
    },
    {
        label: 'Portfolio credit sale consumes advance before creating receivable',
        intent: { operationId: 'fixture:client-credit-sale', actorUid: ACTOR_UID, effectiveAt: EFFECTIVE_AT, kind: 'client_credit_sale', clientId: 'client-a', amountDzd: 100, positionBefore: position('client-a', { ...advanceA, advanceDzd: 30, balanceDzd: 30, advanceLots: [{ ...advanceA.advanceLots[0], remainingDzd: 30 }] }), revenueAccount: 'income.portfolio_sale' },
        legacyFacts: { clientDeltas: { 'client-a': -100 }, receivableDzd: 70, clientAdvanceDzd: -30 },
        expectedKind: 'portfolio_sell',
        expectedPostings: [{ account: 'liability.client_advance', side: 'debit', amountDzd: 30, clientId: 'client-a' }, { account: 'asset.receivable.client', side: 'debit', amountDzd: 70, clientId: 'client-a' }, { account: 'income.portfolio_sale', side: 'credit', amountDzd: 100, clientId: 'client-a' }],
        expectedEffects: effects({ clientDeltas: { 'client-a': -100 }, receivableDzd: 70, clientAdvanceDzd: -30 }),
    },
    {
        label: 'Credit purchase from an actual client creates client payable only',
        intent: { operationId: 'fixture:client-credit-purchase', actorUid: ACTOR_UID, effectiveAt: EFFECTIVE_AT, kind: 'client_credit_purchase', amountDzd: 120, counterparty: { kind: 'client', id: 'client-a' } },
        legacyFacts: { clientDeltas: { 'client-a': 120 }, clientPayableDzd: 120 },
        expectedKind: 'portfolio_buy',
        expectedPostings: [{ account: 'asset.clearing.credit_purchase', side: 'debit', amountDzd: 120 }, { account: 'liability.client_payable', side: 'credit', amountDzd: 120, clientId: 'client-a' }],
        expectedEffects: effects({ clientDeltas: { 'client-a': 120 }, clientPayableDzd: 120 }),
    },
    {
        label: 'Credit purchase from a supplier never uses client payable',
        intent: { operationId: 'fixture:supplier-credit-purchase', actorUid: ACTOR_UID, effectiveAt: EFFECTIVE_AT, kind: 'client_credit_purchase', amountDzd: 121, counterparty: { kind: 'supplier', id: 'supplier-a' } },
        legacyFacts: { supplierPayableDzd: 121 },
        expectedKind: 'portfolio_buy',
        expectedPostings: [{ account: 'asset.clearing.credit_purchase', side: 'debit', amountDzd: 121 }, { account: 'liability.supplier_payable', side: 'credit', amountDzd: 121 }],
        expectedEffects: effects({ supplierPayableDzd: 121 }),
    },
    {
        label: 'Credit digital service sale creates a client receivable',
        intent: { operationId: 'fixture:client-service-credit-sale', actorUid: ACTOR_UID, effectiveAt: EFFECTIVE_AT, kind: 'client_service_credit_sale', clientId: 'client-a', amountDzd: 122, positionBefore: position('client-a'), revenueAccount: 'income.digital_service_sale' },
        legacyFacts: { clientDeltas: { 'client-a': -122 }, receivableDzd: 122 },
        expectedKind: 'digital_service_sale',
        expectedPostings: [{ account: 'asset.receivable.client', side: 'debit', amountDzd: 122, clientId: 'client-a' }, { account: 'income.digital_service_sale', side: 'credit', amountDzd: 122, clientId: 'client-a' }],
        expectedEffects: effects({ clientDeltas: { 'client-a': -122 }, receivableDzd: 122 }),
    },
    {
        label: 'Credit purchase-order sale creates a client receivable',
        intent: { operationId: 'fixture:client-order-credit-sale', actorUid: ACTOR_UID, effectiveAt: EFFECTIVE_AT, kind: 'client_order_credit_sale', clientId: 'client-a', amountDzd: 123, positionBefore: position('client-a'), revenueAccount: 'income.purchase_order_sale' },
        legacyFacts: { clientDeltas: { 'client-a': -123 }, receivableDzd: 123 },
        expectedKind: 'order_completion',
        expectedPostings: [{ account: 'asset.receivable.client', side: 'debit', amountDzd: 123, clientId: 'client-a' }, { account: 'income.purchase_order_sale', side: 'credit', amountDzd: 123, clientId: 'client-a' }],
        expectedEffects: effects({ clientDeltas: { 'client-a': -123 }, receivableDzd: 123 }),
    },
    {
        label: 'Receivable write-off uses expense, not advance cancellation',
        intent: { operationId: 'fixture:client-receivable-write-off', actorUid: ACTOR_UID, effectiveAt: EFFECTIVE_AT, kind: 'client_write_off_receivable', clientId: 'client-a', amountDzd: 25, positionBefore: debtA, reason: 'Approved debt waiver' },
        legacyFacts: { clientDeltas: { 'client-a': 25 }, receivableDzd: -25 },
        expectedKind: 'client_write_off',
        expectedPostings: [{ account: 'expense.client_receivable_write_off', side: 'debit', amountDzd: 25 }, { account: 'asset.receivable.client', side: 'credit', amountDzd: 25, clientId: 'client-a' }],
        expectedEffects: effects({ clientDeltas: { 'client-a': 25 }, receivableDzd: -25 }),
    },
    {
        label: 'Advance cancellation releases an actual client advance explicitly',
        intent: { operationId: 'fixture:client-advance-cancellation', actorUid: ACTOR_UID, effectiveAt: EFFECTIVE_AT, kind: 'client_advance_cancellation', clientId: 'client-a', amountDzd: 25, positionBefore: advanceA, reason: 'Approved unused advance cancellation' },
        legacyFacts: { clientDeltas: { 'client-a': -25 }, clientAdvanceDzd: -25 },
        expectedKind: 'client_write_off',
        expectedPostings: [{ account: 'liability.client_advance', side: 'debit', amountDzd: 25, clientId: 'client-a' }, { account: 'income.client_advance_release', side: 'credit', amountDzd: 25 }],
        expectedEffects: effects({ clientDeltas: { 'client-a': -25 }, clientAdvanceDzd: -25 }),
    },
];

export const CLIENT_SHADOW_EXPECTED_KINDS = new Set<ClientShadowKind>(CLIENT_SHADOW_EXPECTED_FIXTURES.map((fixture) => fixture.intent.kind));
