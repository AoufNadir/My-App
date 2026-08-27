import type { FinancialOperationKind, LedgerAccount, LedgerPostingSide } from './types';
import type {
    LegacyPortfolioShadowFacts,
    PortfolioEffects,
    PortfolioInventoryState,
    PortfolioShadowIntent,
} from './portfolioShadow';

export type ExpectedPortfolioPosting = {
    account: LedgerAccount;
    side: LedgerPostingSide;
    amountDzd: number;
};

export type PortfolioShadowFixture = {
    label: string;
    intent: PortfolioShadowIntent;
    legacyFacts: LegacyPortfolioShadowFacts;
    expectedKind: FinancialOperationKind;
    expectedPostings: readonly ExpectedPortfolioPosting[];
    expectedEffects: PortfolioEffects;
};

const EFFECTIVE_AT = Date.parse('2026-08-22T12:00:00.000Z');
const ACTOR_UID = 'portfolio-shadow-fixture-owner';
const USDT_STOCK: PortfolioInventoryState = { quantity: 10, costedQuantity: 10, costBasisDzd: 2_000 };
const EUR_STOCK: PortfolioInventoryState = { quantity: 8, costedQuantity: 8, costBasisDzd: 1_600 };

type EffectOverrides = Omit<Partial<PortfolioEffects>, 'quantityDeltas' | 'costBasisDeltasDzd' | 'cashDeltasDzd'> & {
    quantityDeltas?: Partial<PortfolioEffects['quantityDeltas']>;
    costBasisDeltasDzd?: Partial<PortfolioEffects['costBasisDeltasDzd']>;
    cashDeltasDzd?: Partial<PortfolioEffects['cashDeltasDzd']>;
};

/** Test data only; it does not call a Shadow builder or ledger-effect helper. */
function effects(overrides: EffectOverrides = {}): PortfolioEffects {
    return {
        quantityDeltas: { USDT: 0, EUR: 0, ...(overrides.quantityDeltas || {}) },
        costBasisDeltasDzd: { USDT: 0, EUR: 0, ...(overrides.costBasisDeltasDzd || {}) },
        cashDeltasDzd: { Caisse: 0, BaridiMob: 0, ...(overrides.cashDeltasDzd || {}) },
        clientReceivableDzd: overrides.clientReceivableDzd || 0,
        clientPayableDzd: overrides.clientPayableDzd || 0,
        realizedTradingProfitDzd: overrides.realizedTradingProfitDzd || 0,
        fxGainLossDzd: overrides.fxGainLossDzd || 0,
    };
}

/**
 * Independent accounting expectations. They intentionally spell out expected
 * postings/effects instead of reusing implementation mappings. This prevents
 * a Legacy-to-V2 comparison from being self-referential.
 */
export const PORTFOLIO_SHADOW_EXPECTED_FIXTURES: readonly PortfolioShadowFixture[] = [
    {
        label: 'USDT cash purchase preserves 8-decimal quantity',
        intent: { operationId: 'fixture:portfolio-purchase-cash', actorUid: ACTOR_UID, effectiveAt: EFFECTIVE_AT, kind: 'portfolio_purchase_cash', currency: 'USDT', quantity: 1.23456789, inventoryBefore: USDT_STOCK, wallet: 'Caisse', valueDzd: 247.9 },
        legacyFacts: effects({ quantityDeltas: { USDT: 1.23456789 }, costBasisDeltasDzd: { USDT: 247.9 }, cashDeltasDzd: { Caisse: -247.9 } }),
        expectedKind: 'portfolio_buy',
        expectedPostings: [{ account: 'asset.portfolio.usdt', side: 'debit', amountDzd: 247.9 }, { account: 'asset.cash.caisse', side: 'credit', amountDzd: 247.9 }],
        expectedEffects: effects({ quantityDeltas: { USDT: 1.23456789 }, costBasisDeltasDzd: { USDT: 247.9 }, cashDeltasDzd: { Caisse: -247.9 } }),
    },
    {
        label: 'EUR purchase on credit creates explicit payable',
        intent: { operationId: 'fixture:portfolio-purchase-credit', actorUid: ACTOR_UID, effectiveAt: EFFECTIVE_AT, kind: 'portfolio_purchase_credit', currency: 'EUR', quantity: 0.5, inventoryBefore: EUR_STOCK, clientId: 'client-payable', valueDzd: 150 },
        legacyFacts: effects({ quantityDeltas: { EUR: 0.5 }, costBasisDeltasDzd: { EUR: 150 }, clientPayableDzd: 150 }),
        expectedKind: 'portfolio_buy',
        expectedPostings: [{ account: 'asset.portfolio.eur', side: 'debit', amountDzd: 150 }, { account: 'liability.client_payable', side: 'credit', amountDzd: 150 }],
        expectedEffects: effects({ quantityDeltas: { EUR: 0.5 }, costBasisDeltasDzd: { EUR: 150 }, clientPayableDzd: 150 }),
    },
    {
        label: 'Partial USDT cash sale removes only its PAM cost',
        intent: { operationId: 'fixture:portfolio-sale-cash', actorUid: ACTOR_UID, effectiveAt: EFFECTIVE_AT, kind: 'portfolio_sale_cash', currency: 'USDT', quantity: 2.5, inventoryBefore: USDT_STOCK, wallet: 'BaridiMob', proceedsDzd: 550 },
        legacyFacts: effects({ quantityDeltas: { USDT: -2.5 }, costBasisDeltasDzd: { USDT: -500 }, cashDeltasDzd: { BaridiMob: 550 }, realizedTradingProfitDzd: 50 }),
        expectedKind: 'portfolio_sell',
        expectedPostings: [{ account: 'asset.cash.baridimob', side: 'debit', amountDzd: 550 }, { account: 'asset.portfolio.usdt', side: 'credit', amountDzd: 500 }, { account: 'income.portfolio_sale', side: 'credit', amountDzd: 50 }],
        expectedEffects: effects({ quantityDeltas: { USDT: -2.5 }, costBasisDeltasDzd: { USDT: -500 }, cashDeltasDzd: { BaridiMob: 550 }, realizedTradingProfitDzd: 50 }),
    },
    {
        label: 'EUR credit sale creates receivable without cash',
        intent: { operationId: 'fixture:portfolio-sale-credit', actorUid: ACTOR_UID, effectiveAt: EFFECTIVE_AT, kind: 'portfolio_sale_credit', currency: 'EUR', quantity: 2, inventoryBefore: EUR_STOCK, clientId: 'client-receivable', proceedsDzd: 560 },
        legacyFacts: effects({ quantityDeltas: { EUR: -2 }, costBasisDeltasDzd: { EUR: -400 }, clientReceivableDzd: 560, realizedTradingProfitDzd: 160 }),
        expectedKind: 'portfolio_sell',
        expectedPostings: [{ account: 'asset.receivable.client', side: 'debit', amountDzd: 560 }, { account: 'asset.portfolio.eur', side: 'credit', amountDzd: 400 }, { account: 'income.portfolio_sale', side: 'credit', amountDzd: 160 }],
        expectedEffects: effects({ quantityDeltas: { EUR: -2 }, costBasisDeltasDzd: { EUR: -400 }, clientReceivableDzd: 560, realizedTradingProfitDzd: 160 }),
    },
    {
        label: 'EUR to USDT exchange books FX gain, never trading profit',
        intent: { operationId: 'fixture:exchange-eur-to-usdt', actorUid: ACTOR_UID, effectiveAt: EFFECTIVE_AT, kind: 'portfolio_exchange_eur_to_usdt', fromCurrency: 'EUR', toCurrency: 'USDT', quantityOut: 1.5, quantityIn: 3, fromInventoryBefore: EUR_STOCK, exchangeValueDzd: 330, fromQuotedValueDzd: 330, toQuotedValueDzd: 330 },
        legacyFacts: effects({ quantityDeltas: { EUR: -1.5, USDT: 3 }, costBasisDeltasDzd: { EUR: -300, USDT: 330 }, fxGainLossDzd: 30 }),
        expectedKind: 'portfolio_exchange',
        expectedPostings: [{ account: 'asset.portfolio.usdt', side: 'debit', amountDzd: 330 }, { account: 'asset.portfolio.eur', side: 'credit', amountDzd: 300 }, { account: 'income.fx_gain', side: 'credit', amountDzd: 30 }],
        expectedEffects: effects({ quantityDeltas: { EUR: -1.5, USDT: 3 }, costBasisDeltasDzd: { EUR: -300, USDT: 330 }, fxGainLossDzd: 30 }),
    },
    {
        label: 'USDT to EUR exchange books FX loss, never trading profit',
        intent: { operationId: 'fixture:exchange-usdt-to-eur', actorUid: ACTOR_UID, effectiveAt: EFFECTIVE_AT, kind: 'portfolio_exchange_usdt_to_eur', fromCurrency: 'USDT', toCurrency: 'EUR', quantityOut: 2, quantityIn: 1.3, fromInventoryBefore: USDT_STOCK, exchangeValueDzd: 390, fromQuotedValueDzd: 390, toQuotedValueDzd: 390 },
        legacyFacts: effects({ quantityDeltas: { USDT: -2, EUR: 1.3 }, costBasisDeltasDzd: { USDT: -400, EUR: 390 }, fxGainLossDzd: -10 }),
        expectedKind: 'portfolio_exchange',
        expectedPostings: [{ account: 'asset.portfolio.eur', side: 'debit', amountDzd: 390 }, { account: 'asset.portfolio.usdt', side: 'credit', amountDzd: 400 }, { account: 'expense.fx_loss', side: 'debit', amountDzd: 10 }],
        expectedEffects: effects({ quantityDeltas: { USDT: -2, EUR: 1.3 }, costBasisDeltasDzd: { USDT: -400, EUR: 390 }, fxGainLossDzd: -10 }),
    },
    {
        label: 'Manual priced USDT addition',
        intent: { operationId: 'fixture:manual-add', actorUid: ACTOR_UID, effectiveAt: EFFECTIVE_AT, kind: 'portfolio_manual_add', currency: 'USDT', quantity: 0.12345678, inventoryBefore: USDT_STOCK, valueDzd: 30.86 },
        legacyFacts: effects({ quantityDeltas: { USDT: 0.12345678 }, costBasisDeltasDzd: { USDT: 30.86 } }),
        expectedKind: 'portfolio_adjustment',
        expectedPostings: [{ account: 'asset.portfolio.usdt', side: 'debit', amountDzd: 30.86 }, { account: 'equity.portfolio_adjustment', side: 'credit', amountDzd: 30.86 }],
        expectedEffects: effects({ quantityDeltas: { USDT: 0.12345678 }, costBasisDeltasDzd: { USDT: 30.86 } }),
    },
    {
        label: 'Manual USDT removal uses PAM and no trading profit',
        intent: { operationId: 'fixture:manual-remove', actorUid: ACTOR_UID, effectiveAt: EFFECTIVE_AT, kind: 'portfolio_manual_remove', currency: 'USDT', quantity: 1, inventoryBefore: USDT_STOCK },
        legacyFacts: effects({ quantityDeltas: { USDT: -1 }, costBasisDeltasDzd: { USDT: -200 } }),
        expectedKind: 'portfolio_adjustment',
        expectedPostings: [{ account: 'expense.portfolio_adjustment', side: 'debit', amountDzd: 200 }, { account: 'asset.portfolio.usdt', side: 'credit', amountDzd: 200 }],
        expectedEffects: effects({ quantityDeltas: { USDT: -1 }, costBasisDeltasDzd: { USDT: -200 } }),
    },
    {
        label: 'Project expense paid from EUR removes PAM only',
        intent: { operationId: 'fixture:project-expense-asset', actorUid: ACTOR_UID, effectiveAt: EFFECTIVE_AT, kind: 'portfolio_project_expense_asset', currency: 'EUR', quantity: 1.25, inventoryBefore: EUR_STOCK },
        legacyFacts: effects({ quantityDeltas: { EUR: -1.25 }, costBasisDeltasDzd: { EUR: -250 } }),
        expectedKind: 'portfolio_non_sale_removal',
        expectedPostings: [{ account: 'expense.project', side: 'debit', amountDzd: 250 }, { account: 'asset.portfolio.eur', side: 'credit', amountDzd: 250 }],
        expectedEffects: effects({ quantityDeltas: { EUR: -1.25 }, costBasisDeltasDzd: { EUR: -250 } }),
    },
    {
        label: 'Personal advance paid from USDT is an asset claim',
        intent: { operationId: 'fixture:personal-advance-asset', actorUid: ACTOR_UID, effectiveAt: EFFECTIVE_AT, kind: 'portfolio_personal_advance_asset', currency: 'USDT', quantity: 1, inventoryBefore: USDT_STOCK },
        legacyFacts: effects({ quantityDeltas: { USDT: -1 }, costBasisDeltasDzd: { USDT: -200 } }),
        expectedKind: 'portfolio_non_sale_removal',
        expectedPostings: [{ account: 'asset.manager_advance', side: 'debit', amountDzd: 200 }, { account: 'asset.portfolio.usdt', side: 'credit', amountDzd: 200 }],
        expectedEffects: effects({ quantityDeltas: { USDT: -1 }, costBasisDeltasDzd: { USDT: -200 } }),
    },
    {
        label: 'Personal EUR expense removes PAM only',
        intent: { operationId: 'fixture:personal-expense-asset', actorUid: ACTOR_UID, effectiveAt: EFFECTIVE_AT, kind: 'portfolio_personal_expense_asset', currency: 'EUR', quantity: 1, inventoryBefore: EUR_STOCK },
        legacyFacts: effects({ quantityDeltas: { EUR: -1 }, costBasisDeltasDzd: { EUR: -200 } }),
        expectedKind: 'portfolio_non_sale_removal',
        expectedPostings: [{ account: 'expense.personal', side: 'debit', amountDzd: 200 }, { account: 'asset.portfolio.eur', side: 'credit', amountDzd: 200 }],
        expectedEffects: effects({ quantityDeltas: { EUR: -1 }, costBasisDeltasDzd: { EUR: -200 } }),
    },
    {
        label: 'Personal advance return restores known USDT cost',
        intent: { operationId: 'fixture:personal-return-asset', actorUid: ACTOR_UID, effectiveAt: EFFECTIVE_AT, kind: 'portfolio_personal_advance_return_asset', currency: 'USDT', quantity: 0.75, inventoryBefore: USDT_STOCK, valueDzd: 150 },
        legacyFacts: effects({ quantityDeltas: { USDT: 0.75 }, costBasisDeltasDzd: { USDT: 150 } }),
        expectedKind: 'personal_expense',
        expectedPostings: [{ account: 'asset.portfolio.usdt', side: 'debit', amountDzd: 150 }, { account: 'asset.manager_advance', side: 'credit', amountDzd: 150 }],
        expectedEffects: effects({ quantityDeltas: { USDT: 0.75 }, costBasisDeltasDzd: { USDT: 150 } }),
    },
    {
        label: 'Digital-service purchase paid from USDT is not trading sale',
        intent: { operationId: 'fixture:digital-service-purchase', actorUid: ACTOR_UID, effectiveAt: EFFECTIVE_AT, kind: 'portfolio_digital_service_purchase_asset', currency: 'USDT', quantity: 0.5, inventoryBefore: USDT_STOCK },
        legacyFacts: effects({ quantityDeltas: { USDT: -0.5 }, costBasisDeltasDzd: { USDT: -100 } }),
        expectedKind: 'portfolio_non_sale_removal',
        expectedPostings: [{ account: 'asset.service_inventory', side: 'debit', amountDzd: 100 }, { account: 'asset.portfolio.usdt', side: 'credit', amountDzd: 100 }],
        expectedEffects: effects({ quantityDeltas: { USDT: -0.5 }, costBasisDeltasDzd: { USDT: -100 } }),
    },
    {
        label: 'Digital-service sale received in EUR is revenue, not trading sale',
        intent: { operationId: 'fixture:digital-service-sale', actorUid: ACTOR_UID, effectiveAt: EFFECTIVE_AT, kind: 'portfolio_digital_service_sale_asset', currency: 'EUR', quantity: 0.5, inventoryBefore: EUR_STOCK, valueDzd: 100 },
        legacyFacts: effects({ quantityDeltas: { EUR: 0.5 }, costBasisDeltasDzd: { EUR: 100 } }),
        expectedKind: 'digital_service_sale',
        expectedPostings: [{ account: 'asset.portfolio.eur', side: 'debit', amountDzd: 100 }, { account: 'income.digital_service_sale', side: 'credit', amountDzd: 100 }],
        expectedEffects: effects({ quantityDeltas: { EUR: 0.5 }, costBasisDeltasDzd: { EUR: 100 } }),
    },
    {
        label: 'Purchase-order prepaid USDT sale',
        intent: { operationId: 'fixture:order-sale-cash', actorUid: ACTOR_UID, effectiveAt: EFFECTIVE_AT, kind: 'portfolio_order_sale_cash', currency: 'USDT', quantity: 1, inventoryBefore: USDT_STOCK, wallet: 'Caisse', proceedsDzd: 250 },
        legacyFacts: effects({ quantityDeltas: { USDT: -1 }, costBasisDeltasDzd: { USDT: -200 }, cashDeltasDzd: { Caisse: 250 }, realizedTradingProfitDzd: 50 }),
        expectedKind: 'portfolio_sell',
        expectedPostings: [{ account: 'asset.cash.caisse', side: 'debit', amountDzd: 250 }, { account: 'asset.portfolio.usdt', side: 'credit', amountDzd: 200 }, { account: 'income.portfolio_sale', side: 'credit', amountDzd: 50 }],
        expectedEffects: effects({ quantityDeltas: { USDT: -1 }, costBasisDeltasDzd: { USDT: -200 }, cashDeltasDzd: { Caisse: 250 }, realizedTradingProfitDzd: 50 }),
    },
    {
        label: 'Purchase-order credit EUR sale',
        intent: { operationId: 'fixture:order-sale-credit', actorUid: ACTOR_UID, effectiveAt: EFFECTIVE_AT, kind: 'portfolio_order_sale_credit', currency: 'EUR', quantity: 1, inventoryBefore: EUR_STOCK, clientId: 'po-credit-client', proceedsDzd: 260 },
        legacyFacts: effects({ quantityDeltas: { EUR: -1 }, costBasisDeltasDzd: { EUR: -200 }, clientReceivableDzd: 260, realizedTradingProfitDzd: 60 }),
        expectedKind: 'portfolio_sell',
        expectedPostings: [{ account: 'asset.receivable.client', side: 'debit', amountDzd: 260 }, { account: 'asset.portfolio.eur', side: 'credit', amountDzd: 200 }, { account: 'income.portfolio_sale', side: 'credit', amountDzd: 60 }],
        expectedEffects: effects({ quantityDeltas: { EUR: -1 }, costBasisDeltasDzd: { EUR: -200 }, clientReceivableDzd: 260, realizedTradingProfitDzd: 60 }),
    },
    {
        label: 'Cash trading fee does not affect stock or trading profit',
        intent: { operationId: 'fixture:fee-cash', actorUid: ACTOR_UID, effectiveAt: EFFECTIVE_AT, kind: 'portfolio_fee_cash', wallet: 'Caisse', amountDzd: 12 },
        legacyFacts: effects({ cashDeltasDzd: { Caisse: -12 } }),
        expectedKind: 'portfolio_fee',
        expectedPostings: [{ account: 'expense.trading_fee', side: 'debit', amountDzd: 12 }, { account: 'asset.cash.caisse', side: 'credit', amountDzd: 12 }],
        expectedEffects: effects({ cashDeltasDzd: { Caisse: -12 } }),
    },
    {
        label: 'Asset trading fee removes PAM without trading profit',
        intent: { operationId: 'fixture:fee-asset', actorUid: ACTOR_UID, effectiveAt: EFFECTIVE_AT, kind: 'portfolio_fee_asset', currency: 'USDT', quantity: 0.1, inventoryBefore: USDT_STOCK },
        legacyFacts: effects({ quantityDeltas: { USDT: -0.1 }, costBasisDeltasDzd: { USDT: -20 } }),
        expectedKind: 'portfolio_fee',
        expectedPostings: [{ account: 'expense.trading_fee', side: 'debit', amountDzd: 20 }, { account: 'asset.portfolio.usdt', side: 'credit', amountDzd: 20 }],
        expectedEffects: effects({ quantityDeltas: { USDT: -0.1 }, costBasisDeltasDzd: { USDT: -20 } }),
    },
    {
        label: 'USDT internal location transfer carries cost without P&L',
        intent: { operationId: 'fixture:asset-transfer', actorUid: ACTOR_UID, effectiveAt: EFFECTIVE_AT, kind: 'portfolio_asset_transfer', currency: 'USDT', quantity: 1, inventoryBefore: USDT_STOCK, fromLocation: 'main', toLocation: 'locked' },
        legacyFacts: effects(),
        expectedKind: 'manual_asset_transaction',
        expectedPostings: [{ account: 'asset.portfolio.usdt.locked', side: 'debit', amountDzd: 200 }, { account: 'asset.portfolio.usdt', side: 'credit', amountDzd: 200 }],
        expectedEffects: effects(),
    },
];

export const PORTFOLIO_SHADOW_EXPECTED_KINDS = new Set(
    PORTFOLIO_SHADOW_EXPECTED_FIXTURES.map((fixture) => fixture.intent.kind),
);
