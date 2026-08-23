import {
    buildLifecycleArchiveDecision,
    buildLifecycleCorrectionDrafts,
    buildLifecycleReversalDraft,
} from './lifecycleV2';
import type { AccountingOperationDraft } from './types';

const ACTOR_UID = 'fixture-owner';
const ORIGINAL_EFFECTIVE_AT = Date.parse('2026-08-24T09:00:00.000Z');
const CORRECTION_EFFECTIVE_AT = Date.parse('2026-08-25T10:30:00.000Z');

export const LIFECYCLE_V2_ORIGINAL_CROSS_DOMAIN_OPERATION: AccountingOperationDraft = {
    operationId: 'op:cross-domain-sale',
    accountingVersion: 2,
    kind: 'portfolio_sell',
    status: 'posted',
    effectiveAt: ORIGINAL_EFFECTIVE_AT,
    actorUid: ACTOR_UID,
    reason: 'Original USDT sale collected through treasury and allocated to investors.',
    postings: [
        { id: 'cash', account: 'asset.cash.caisse', side: 'debit', amountDzd: 125_500, currency: 'DZD', linkedTransactionId: 'legacy-sale-1' },
        { id: 'portfolio-cost', account: 'asset.portfolio.usdt', side: 'credit', amountDzd: 100_000, currency: 'USDT', quantity: 500, unitRateDzd: 200, linkedTransactionId: 'legacy-sale-1' },
        { id: 'trading-profit', account: 'income.portfolio_sale', side: 'credit', amountDzd: 25_500 },
        { id: 'profit-allocation', account: 'equity.profit_allocation', side: 'debit', amountDzd: 10_000 },
        { id: 'external-investor-profit', account: 'liability.investor_profit', side: 'credit', amountDzd: 10_000, investorId: 'investor-a' },
    ],
    projections: [
        { collection: 'usdt_txs', id: 'op:cross-domain-sale:portfolio' },
        { collection: 'treasury_txs', id: 'op:cross-domain-sale:treasury' },
        { collection: 'dzd_client_txs', id: 'op:cross-domain-sale:client-context' },
        { collection: 'investor_transactions', id: 'op:cross-domain-sale:investor-profit' },
    ],
    profitAllocation: {
        projectProfitDzd: 25_500,
        managerFeeDzd: 5_100,
        managerCapitalDzd: 10_400,
        externalInvestorShares: [{ investorId: 'investor-a', amountDzd: 10_000 }],
        managerFeePercentage: 20,
        eligibleInvestorCapital: [
            { investorId: 'manager', capitalDzd: 1_040_000 },
            { investorId: 'investor-a', capitalDzd: 1_000_000 },
        ],
    },
    metadata: {
        mode: 'shadow',
        domain: 'portfolioV2',
        domains: ['treasuryV2', 'portfolioV2', 'clientsV2', 'investorsV2'],
    },
};

export const LIFECYCLE_V2_CORRECTED_CROSS_DOMAIN_OPERATION: AccountingOperationDraft = {
    operationId: 'op:cross-domain-sale:corrected',
    accountingVersion: 2,
    kind: 'portfolio_sell',
    status: 'posted',
    effectiveAt: ORIGINAL_EFFECTIVE_AT,
    actorUid: ACTOR_UID,
    postings: [
        { id: 'cash', account: 'asset.cash.caisse', side: 'debit', amountDzd: 126_000, currency: 'DZD', linkedTransactionId: 'legacy-sale-1-correction' },
        { id: 'portfolio-cost', account: 'asset.portfolio.usdt', side: 'credit', amountDzd: 100_000, currency: 'USDT', quantity: 500, unitRateDzd: 200, linkedTransactionId: 'legacy-sale-1-correction' },
        { id: 'trading-profit', account: 'income.portfolio_sale', side: 'credit', amountDzd: 26_000 },
        { id: 'profit-allocation', account: 'equity.profit_allocation', side: 'debit', amountDzd: 10_200 },
        { id: 'external-investor-profit', account: 'liability.investor_profit', side: 'credit', amountDzd: 10_200, investorId: 'investor-a' },
    ],
    projections: [
        { collection: 'usdt_txs', id: 'op:cross-domain-sale:corrected:portfolio' },
        { collection: 'treasury_txs', id: 'op:cross-domain-sale:corrected:treasury' },
        { collection: 'dzd_client_txs', id: 'op:cross-domain-sale:corrected:client-context' },
        { collection: 'investor_transactions', id: 'op:cross-domain-sale:corrected:investor-profit' },
    ],
    profitAllocation: {
        projectProfitDzd: 26_000,
        managerFeeDzd: 5_200,
        managerCapitalDzd: 10_600,
        externalInvestorShares: [{ investorId: 'investor-a', amountDzd: 10_200 }],
        managerFeePercentage: 20,
        eligibleInvestorCapital: [
            { investorId: 'manager', capitalDzd: 1_060_000 },
            { investorId: 'investor-a', capitalDzd: 1_020_000 },
        ],
    },
    metadata: {
        mode: 'shadow',
        domain: 'portfolioV2',
        domains: ['treasuryV2', 'portfolioV2', 'clientsV2', 'investorsV2'],
    },
};

export const LIFECYCLE_V2_FIXTURES = {
    actorUid: ACTOR_UID,
    originalEffectiveAt: ORIGINAL_EFFECTIVE_AT,
    correctionEffectiveAt: CORRECTION_EFFECTIVE_AT,
    cancellation: {
        original: LIFECYCLE_V2_ORIGINAL_CROSS_DOMAIN_OPERATION,
        reversal: buildLifecycleReversalDraft(LIFECYCLE_V2_ORIGINAL_CROSS_DOMAIN_OPERATION, {
            actorUid: ACTOR_UID,
            effectiveAt: CORRECTION_EFFECTIVE_AT,
            reason: 'Cancel duplicated sale entry.',
        }),
    },
    edit: {
        original: LIFECYCLE_V2_ORIGINAL_CROSS_DOMAIN_OPERATION,
        ...buildLifecycleCorrectionDrafts(
            LIFECYCLE_V2_ORIGINAL_CROSS_DOMAIN_OPERATION,
            LIFECYCLE_V2_CORRECTED_CROSS_DOMAIN_OPERATION,
            {
                actorUid: ACTOR_UID,
                effectiveAt: CORRECTION_EFFECTIVE_AT,
                reason: 'Correct collected DZD amount from 125500 to 126000.',
            },
        ),
    },
    archiveEntity: buildLifecycleArchiveDecision({
        entityKind: 'client',
        entityId: 'client-a',
        actorUid: ACTOR_UID,
        effectiveAt: CORRECTION_EFFECTIVE_AT,
        reason: 'Client is no longer active but has financial history.',
    }),
} as const;
