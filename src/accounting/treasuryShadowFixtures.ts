import type { FinancialOperationKind, LedgerAccount, LedgerPostingSide } from './types';
import type { LegacyTreasuryShadowRow, TreasuryShadowIntent, TreasuryShadowKind } from './treasuryShadow';

export type ExpectedTreasuryPosting = {
    account: LedgerAccount;
    side: LedgerPostingSide;
    amountDzd: number;
};

export type TreasuryShadowFixture = {
    label: string;
    intent: TreasuryShadowIntent;
    legacyRows: readonly LegacyTreasuryShadowRow[];
    expectedKind: FinancialOperationKind;
    expectedPostings: readonly ExpectedTreasuryPosting[];
};

const EFFECTIVE_AT = Date.parse('2026-08-22T12:00:00.000Z');
const ACTOR_UID = 'treasury-shadow-fixture-owner';

/**
 * Independent accounting expectations for every Treasury movement.
 * They deliberately do not call a builder or reuse its mappings: the test
 * compares the V2 Draft against this accounting specification and Legacy cash.
 */
export const TREASURY_SHADOW_EXPECTED_FIXTURES: readonly TreasuryShadowFixture[] = [
    {
        label: 'Cash adjustment in',
        intent: { operationId: 'fixture:treasury_adjustment_in', actorUid: ACTOR_UID, effectiveAt: EFFECTIVE_AT, kind: 'treasury_adjustment_in', wallet: 'Caisse', amountDzd: 101 },
        legacyRows: [{ type: 'Ajout', source: 'Caisse', amount: 101 }],
        expectedKind: 'correction',
        expectedPostings: [{ account: 'asset.cash.caisse', side: 'debit', amountDzd: 101 }, { account: 'equity.cash_adjustment', side: 'credit', amountDzd: 101 }],
    },
    {
        label: 'Cash adjustment out',
        intent: { operationId: 'fixture:treasury_adjustment_out', actorUid: ACTOR_UID, effectiveAt: EFFECTIVE_AT, kind: 'treasury_adjustment_out', wallet: 'BaridiMob', amountDzd: 102 },
        legacyRows: [{ type: 'Retrait', source: 'BaridiMob', amount: 102 }],
        expectedKind: 'correction',
        expectedPostings: [{ account: 'asset.cash.baridimob', side: 'credit', amountDzd: 102 }, { account: 'equity.cash_adjustment', side: 'debit', amountDzd: 102 }],
    },
    {
        label: 'Cash transfer',
        intent: { operationId: 'fixture:treasury_transfer', actorUid: ACTOR_UID, effectiveAt: EFFECTIVE_AT, kind: 'treasury_transfer', from: 'Caisse', to: 'BaridiMob', amountDzd: 103 },
        legacyRows: [{ type: 'Transfer', source: 'Caisse', destination: 'BaridiMob', amount: 103 }],
        expectedKind: 'treasury_transfer',
        expectedPostings: [{ account: 'asset.cash.baridimob', side: 'debit', amountDzd: 103 }, { account: 'asset.cash.caisse', side: 'credit', amountDzd: 103 }],
    },
    {
        label: 'Project expense paid in cash',
        intent: { operationId: 'fixture:project_expense_cash', actorUid: ACTOR_UID, effectiveAt: EFFECTIVE_AT, kind: 'project_expense_cash', wallet: 'Caisse', amountDzd: 104 },
        legacyRows: [{ type: 'Retrait', source: 'Caisse', amount: 104 }],
        expectedKind: 'project_expense',
        expectedPostings: [{ account: 'asset.cash.caisse', side: 'credit', amountDzd: 104 }, { account: 'expense.project', side: 'debit', amountDzd: 104 }],
    },
    {
        label: 'USDT portfolio purchase paid in cash',
        intent: { operationId: 'fixture:portfolio_purchase_cash', actorUid: ACTOR_UID, effectiveAt: EFFECTIVE_AT, kind: 'portfolio_purchase_cash', wallet: 'Caisse', currency: 'USDT', amountDzd: 105 },
        legacyRows: [{ type: 'Retrait', source: 'Caisse', amount: 105 }],
        expectedKind: 'portfolio_buy',
        expectedPostings: [{ account: 'asset.cash.caisse', side: 'credit', amountDzd: 105 }, { account: 'asset.portfolio.usdt', side: 'debit', amountDzd: 105 }],
    },
    {
        label: 'EUR portfolio sale received in BaridiMob',
        intent: { operationId: 'fixture:portfolio_sale_cash', actorUid: ACTOR_UID, effectiveAt: EFFECTIVE_AT, kind: 'portfolio_sale_cash', wallet: 'BaridiMob', currency: 'EUR', amountDzd: 106 },
        legacyRows: [{ type: 'Ajout', source: 'BaridiMob', amount: 106 }],
        expectedKind: 'portfolio_sell',
        expectedPostings: [{ account: 'asset.cash.baridimob', side: 'debit', amountDzd: 106 }, { account: 'income.portfolio_sale', side: 'credit', amountDzd: 106 }],
    },
    {
        label: 'Client receipt',
        intent: { operationId: 'fixture:client_receipt_cash', actorUid: ACTOR_UID, effectiveAt: EFFECTIVE_AT, kind: 'client_receipt_cash', wallet: 'Caisse', clientId: 'client-1', amountDzd: 107 },
        legacyRows: [{ type: 'Ajout', source: 'Caisse', amount: 107 }],
        expectedKind: 'client_settlement',
        expectedPostings: [{ account: 'asset.cash.caisse', side: 'debit', amountDzd: 107 }, { account: 'asset.receivable.client', side: 'credit', amountDzd: 107 }],
    },
    {
        label: 'Client payout',
        intent: { operationId: 'fixture:client_payout_cash', actorUid: ACTOR_UID, effectiveAt: EFFECTIVE_AT, kind: 'client_payout_cash', wallet: 'BaridiMob', clientId: 'client-1', amountDzd: 108 },
        legacyRows: [{ type: 'Retrait', source: 'BaridiMob', amount: 108 }],
        expectedKind: 'client_settlement',
        expectedPostings: [{ account: 'asset.cash.baridimob', side: 'credit', amountDzd: 108 }, { account: 'liability.client_advance', side: 'debit', amountDzd: 108 }],
    },
    {
        label: 'Investor capital deposit',
        intent: { operationId: 'fixture:investor_capital_deposit_cash', actorUid: ACTOR_UID, effectiveAt: EFFECTIVE_AT, kind: 'investor_capital_deposit_cash', wallet: 'Caisse', investorId: 'investor-1', amountDzd: 109 },
        legacyRows: [{ type: 'Ajout', source: 'Caisse', amount: 109 }],
        expectedKind: 'investor_capital_deposit',
        expectedPostings: [{ account: 'asset.cash.caisse', side: 'debit', amountDzd: 109 }, { account: 'liability.investor_capital', side: 'credit', amountDzd: 109 }],
    },
    {
        label: 'Investor capital withdrawal',
        intent: { operationId: 'fixture:investor_capital_withdrawal_cash', actorUid: ACTOR_UID, effectiveAt: EFFECTIVE_AT, kind: 'investor_capital_withdrawal_cash', wallet: 'BaridiMob', investorId: 'investor-1', amountDzd: 110 },
        legacyRows: [{ type: 'Retrait', source: 'BaridiMob', amount: 110 }],
        expectedKind: 'investor_capital_withdrawal',
        expectedPostings: [{ account: 'asset.cash.baridimob', side: 'credit', amountDzd: 110 }, { account: 'liability.investor_capital', side: 'debit', amountDzd: 110 }],
    },
    {
        label: 'Investor profit withdrawal',
        intent: { operationId: 'fixture:investor_profit_withdrawal_cash', actorUid: ACTOR_UID, effectiveAt: EFFECTIVE_AT, kind: 'investor_profit_withdrawal_cash', wallet: 'Caisse', investorId: 'investor-1', amountDzd: 111 },
        legacyRows: [{ type: 'Retrait', source: 'Caisse', amount: 111 }],
        expectedKind: 'investor_profit_withdrawal',
        expectedPostings: [{ account: 'asset.cash.caisse', side: 'credit', amountDzd: 111 }, { account: 'liability.investor_profit_payable', side: 'debit', amountDzd: 111 }],
    },
    {
        label: 'Personal advance paid from cash',
        intent: { operationId: 'fixture:personal_advance_cash', actorUid: ACTOR_UID, effectiveAt: EFFECTIVE_AT, kind: 'personal_advance_cash', wallet: 'Caisse', investorId: 'manager', amountDzd: 112 },
        legacyRows: [{ type: 'Retrait', source: 'Caisse', amount: 112 }],
        expectedKind: 'personal_expense',
        expectedPostings: [{ account: 'asset.cash.caisse', side: 'credit', amountDzd: 112 }, { account: 'asset.manager_advance', side: 'debit', amountDzd: 112 }],
    },
    {
        label: 'Personal expense paid from BaridiMob',
        intent: { operationId: 'fixture:personal_expense_cash', actorUid: ACTOR_UID, effectiveAt: EFFECTIVE_AT, kind: 'personal_expense_cash', wallet: 'BaridiMob', investorId: 'manager', amountDzd: 113 },
        legacyRows: [{ type: 'Retrait', source: 'BaridiMob', amount: 113 }],
        expectedKind: 'personal_expense',
        expectedPostings: [{ account: 'asset.cash.baridimob', side: 'credit', amountDzd: 113 }, { account: 'expense.personal', side: 'debit', amountDzd: 113 }],
    },
    {
        label: 'Personal advance return to cash',
        intent: { operationId: 'fixture:personal_advance_return_cash', actorUid: ACTOR_UID, effectiveAt: EFFECTIVE_AT, kind: 'personal_advance_return_cash', wallet: 'Caisse', investorId: 'manager', amountDzd: 114 },
        legacyRows: [{ type: 'Ajout', source: 'Caisse', amount: 114 }],
        expectedKind: 'personal_expense',
        expectedPostings: [{ account: 'asset.cash.caisse', side: 'debit', amountDzd: 114 }, { account: 'asset.manager_advance', side: 'credit', amountDzd: 114 }],
    },
    {
        label: 'Digital-service purchase paid in cash',
        intent: { operationId: 'fixture:digital_service_purchase_cash', actorUid: ACTOR_UID, effectiveAt: EFFECTIVE_AT, kind: 'digital_service_purchase_cash', wallet: 'Caisse', amountDzd: 115 },
        legacyRows: [{ type: 'Retrait', source: 'Caisse', amount: 115 }],
        expectedKind: 'digital_service_sale',
        expectedPostings: [{ account: 'asset.cash.caisse', side: 'credit', amountDzd: 115 }, { account: 'asset.service_inventory', side: 'debit', amountDzd: 115 }],
    },
    {
        label: 'Digital-service sale received in BaridiMob',
        intent: { operationId: 'fixture:digital_service_sale_cash', actorUid: ACTOR_UID, effectiveAt: EFFECTIVE_AT, kind: 'digital_service_sale_cash', wallet: 'BaridiMob', amountDzd: 116 },
        legacyRows: [{ type: 'Ajout', source: 'BaridiMob', amount: 116 }],
        expectedKind: 'digital_service_sale',
        expectedPostings: [{ account: 'asset.cash.baridimob', side: 'debit', amountDzd: 116 }, { account: 'income.digital_service_sale', side: 'credit', amountDzd: 116 }],
    },
    {
        label: 'Manual-asset customer receipt',
        intent: { operationId: 'fixture:manual_asset_receipt_cash', actorUid: ACTOR_UID, effectiveAt: EFFECTIVE_AT, kind: 'manual_asset_receipt_cash', wallet: 'Caisse', clientId: 'asset-client-1', amountDzd: 117 },
        legacyRows: [{ type: 'Ajout', source: 'Caisse', amount: 117 }],
        expectedKind: 'manual_asset_transaction',
        expectedPostings: [{ account: 'asset.cash.caisse', side: 'debit', amountDzd: 117 }, { account: 'asset.receivable.manual_asset', side: 'credit', amountDzd: 117 }],
    },
    {
        label: 'Manual-asset payout',
        intent: { operationId: 'fixture:manual_asset_payout_cash', actorUid: ACTOR_UID, effectiveAt: EFFECTIVE_AT, kind: 'manual_asset_payout_cash', wallet: 'BaridiMob', clientId: 'asset-client-1', amountDzd: 118 },
        legacyRows: [{ type: 'Retrait', source: 'BaridiMob', amount: 118 }],
        expectedKind: 'manual_asset_transaction',
        expectedPostings: [{ account: 'asset.cash.baridimob', side: 'credit', amountDzd: 118 }, { account: 'asset.manual_asset', side: 'debit', amountDzd: 118 }],
    },
    {
        label: 'Prepaid purchase-order customer sale receipt',
        intent: { operationId: 'fixture:po_order_sale_receipt_cash', actorUid: ACTOR_UID, effectiveAt: EFFECTIVE_AT, kind: 'po_order_sale_receipt_cash', wallet: 'Caisse', clientId: 'client-po-1', amountDzd: 119 },
        legacyRows: [{ type: 'Ajout', source: 'Caisse', amount: 119 }],
        expectedKind: 'order_completion',
        expectedPostings: [{ account: 'asset.cash.caisse', side: 'debit', amountDzd: 119 }, { account: 'income.purchase_order_sale', side: 'credit', amountDzd: 119 }],
    },
];

export const TREASURY_SHADOW_EXPECTED_KINDS = new Set<TreasuryShadowKind>(
    TREASURY_SHADOW_EXPECTED_FIXTURES.map((fixture) => fixture.intent.kind),
);
