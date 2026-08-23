import type { LegacyServiceShadowFacts, ServiceShadowIntent } from './serviceShadow';

const base = { actorUid: 'fixture-owner', effectiveAt: 1_760_000_000_000, kind: 'digital_service_sale' as const, clientId: 'client-a' };

export const SERVICE_SHADOW_EXPECTED_FIXTURES: Array<{
    label: string;
    intent: ServiceShadowIntent;
    legacyFacts: LegacyServiceShadowFacts;
    expectedPostings: Array<{ account: string; side: 'debit' | 'credit'; amountDzd: number }>;
}> = [
    {
        label: 'cash purchase and cash sale recognise only sale margin',
        intent: {
            ...base, operationId: 'fixture:service:cash',
            purchase: { wallet: 'Caisse', amountDzd: 100 },
            sale: { wallet: 'BaridiMob', amountDzd: 150 },
        },
        legacyFacts: {
            serviceRevenueDzd: 150, serviceCostDzd: 100, directFeesDzd: 0, serviceProfitDzd: 50, fxGainLossDzd: 0,
            cashDeltasDzd: { Caisse: -100, BaridiMob: 150 }, portfolioValueDeltasDzd: { USDT: 0, EUR: 0 }, clientReceivableDzd: 0, supplierPayableDzd: 0,
        },
        expectedPostings: [
            { account: 'asset.service_inventory', side: 'debit', amountDzd: 100 },
            { account: 'asset.cash.caisse', side: 'credit', amountDzd: 100 },
            { account: 'asset.cash.baridimob', side: 'debit', amountDzd: 150 },
            { account: 'asset.service_inventory', side: 'credit', amountDzd: 100 },
            { account: 'income.digital_service_sale', side: 'credit', amountDzd: 50 },
        ],
    },
    {
        label: 'USDT purchase keeps service margin separate from PAM FX gain',
        intent: {
            ...base, operationId: 'fixture:service:asset-purchase',
            purchase: { wallet: 'USDT', quantity: 1, amountDzd: 250, assetCostBasisDzd: 240 },
            sale: { wallet: 'Caisse', amountDzd: 300 },
        },
        legacyFacts: {
            serviceRevenueDzd: 300, serviceCostDzd: 250, directFeesDzd: 0, serviceProfitDzd: 50, fxGainLossDzd: 10,
            cashDeltasDzd: { Caisse: 300, BaridiMob: 0 }, portfolioValueDeltasDzd: { USDT: -240, EUR: 0 }, clientReceivableDzd: 0, supplierPayableDzd: 0,
        },
        expectedPostings: [
            { account: 'asset.service_inventory', side: 'debit', amountDzd: 250 },
            { account: 'asset.portfolio.usdt', side: 'credit', amountDzd: 240 },
            { account: 'income.fx_gain', side: 'credit', amountDzd: 10 },
            { account: 'asset.cash.caisse', side: 'debit', amountDzd: 300 },
            { account: 'asset.service_inventory', side: 'credit', amountDzd: 250 },
            { account: 'income.digital_service_sale', side: 'credit', amountDzd: 50 },
        ],
    },
    {
        label: 'credit purchase and credit sale keep payable and receivable distinct',
        intent: {
            ...base, operationId: 'fixture:service:credit',
            purchase: { wallet: 'Credit', amountDzd: 100, supplierId: 'supplier-a' },
            sale: { wallet: 'Credit', amountDzd: 150, clientId: 'client-a' },
        },
        legacyFacts: {
            serviceRevenueDzd: 150, serviceCostDzd: 100, directFeesDzd: 0, serviceProfitDzd: 50, fxGainLossDzd: 0,
            cashDeltasDzd: { Caisse: 0, BaridiMob: 0 }, portfolioValueDeltasDzd: { USDT: 0, EUR: 0 }, clientReceivableDzd: 150, supplierPayableDzd: 100,
        },
        expectedPostings: [
            { account: 'asset.service_inventory', side: 'debit', amountDzd: 100 },
            { account: 'liability.supplier_payable', side: 'credit', amountDzd: 100 },
            { account: 'asset.receivable.client', side: 'debit', amountDzd: 150 },
            { account: 'asset.service_inventory', side: 'credit', amountDzd: 100 },
            { account: 'income.digital_service_sale', side: 'credit', amountDzd: 50 },
        ],
    },
    {
        label: 'direct fee reduces service profit without becoming FX',
        intent: {
            ...base, operationId: 'fixture:service:fee',
            purchase: { wallet: 'Caisse', amountDzd: 100 },
            sale: { wallet: 'Caisse', amountDzd: 150 },
            directFees: [{ wallet: 'Caisse', amountDzd: 5 }],
        },
        legacyFacts: {
            serviceRevenueDzd: 150, serviceCostDzd: 100, directFeesDzd: 5, serviceProfitDzd: 45, fxGainLossDzd: 0,
            cashDeltasDzd: { Caisse: 45, BaridiMob: 0 }, portfolioValueDeltasDzd: { USDT: 0, EUR: 0 }, clientReceivableDzd: 0, supplierPayableDzd: 0,
        },
        expectedPostings: [
            { account: 'asset.service_inventory', side: 'debit', amountDzd: 100 },
            { account: 'asset.cash.caisse', side: 'credit', amountDzd: 100 },
            { account: 'asset.cash.caisse', side: 'debit', amountDzd: 150 },
            { account: 'asset.service_inventory', side: 'credit', amountDzd: 100 },
            { account: 'income.digital_service_sale', side: 'credit', amountDzd: 50 },
            { account: 'expense.service_direct_fee', side: 'debit', amountDzd: 5 },
            { account: 'asset.cash.caisse', side: 'credit', amountDzd: 5 },
        ],
    },
];
