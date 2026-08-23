import type { DigitalServiceTransaction } from '../types';
import { fromCents, toCents } from '../utils/money';
import { compareServiceShadow, type LegacyServiceShadowFacts, type ServiceShadowIntent } from './serviceShadow';

export type ServiceReadReconciliationTotals = {
    serviceRevenueDzd: number;
    serviceCostDzd: number;
    directFeesDzd: number;
    serviceProfitDzd: number;
    fxGainLossDzd: number;
    clientReceivableDzd: number;
    supplierPayableDzd: number;
};

export type ServiceReadReconciliation = {
    transactionCount: number;
    legacy: ServiceReadReconciliationTotals;
    shadow: ServiceReadReconciliationTotals;
    differences: ServiceReadReconciliationTotals;
    mismatches: Array<{ serviceId: string; mismatches: string[] }>;
    ok: boolean;
};

const money = (value: number) => fromCents(toCents(value));
const emptyTotals = (): ServiceReadReconciliationTotals => ({
    serviceRevenueDzd: 0, serviceCostDzd: 0, directFeesDzd: 0, serviceProfitDzd: 0,
    fxGainLossDzd: 0, clientReceivableDzd: 0, supplierPayableDzd: 0,
});

function addTotals(target: ServiceReadReconciliationTotals, source: Partial<ServiceReadReconciliationTotals>): void {
    (Object.keys(target) as Array<keyof ServiceReadReconciliationTotals>).forEach((key) => {
        target[key] = money(target[key] + Number(source[key] || 0));
    });
}

function subtractTotals(left: ServiceReadReconciliationTotals, right: ServiceReadReconciliationTotals): ServiceReadReconciliationTotals {
    const result = emptyTotals();
    (Object.keys(result) as Array<keyof ServiceReadReconciliationTotals>).forEach((key) => { result[key] = money(left[key] - right[key]); });
    return result;
}

function intentFromLegacy(tx: DigitalServiceTransaction): ServiceShadowIntent {
    const purchase = tx.purchaseWallet === 'USDT' || tx.purchaseWallet === 'EUR'
        ? { wallet: tx.purchaseWallet, quantity: Number(tx.purchaseAmount || 0), amountDzd: Number(tx.purchaseAmountDzd || 0), assetCostBasisDzd: Number(tx.purchaseAmountDzd || 0) }
        : { wallet: tx.purchaseWallet, amountDzd: Number(tx.purchaseAmountDzd || 0) };
    const sale = tx.saleWallet === 'Credit'
        ? { wallet: 'Credit' as const, amountDzd: Number(tx.saleAmountDzd || 0), clientId: tx.clientId }
        : tx.saleWallet === 'USDT' || tx.saleWallet === 'EUR'
            ? { wallet: tx.saleWallet, quantity: Number(tx.saleAmount || 0), amountDzd: Number(tx.saleAmountDzd || 0) }
            : { wallet: tx.saleWallet, amountDzd: Number(tx.saleAmountDzd || 0) };
    return {
        operationId: `shadow:service-read:${tx.id}`,
        actorUid: 'shadow-read',
        effectiveAt: Number(tx.timestamp || 0),
        kind: 'digital_service_sale',
        clientId: tx.clientId,
        serviceName: tx.serviceName,
        purchase,
        sale,
    } as ServiceShadowIntent;
}

/** Read-only comparison over already-loaded service documents. No Firebase import or query. */
export function reconcileLegacyServicesToShadow(rows: readonly DigitalServiceTransaction[]): ServiceReadReconciliation {
    const legacy = emptyTotals();
    const shadow = emptyTotals();
    const mismatches: Array<{ serviceId: string; mismatches: string[] }> = [];
    rows.forEach((tx) => {
        const legacyFacts: LegacyServiceShadowFacts = {
            serviceRevenueDzd: Number(tx.saleAmountDzd || 0),
            serviceCostDzd: Number(tx.purchaseAmountDzd || 0),
            directFeesDzd: 0,
            serviceProfitDzd: Number(tx.profitDzd || 0),
            fxGainLossDzd: 0,
            clientReceivableDzd: tx.saleWallet === 'Credit' ? Number(tx.saleAmountDzd || 0) : 0,
            supplierPayableDzd: 0,
        };
        addTotals(legacy, legacyFacts);
        try {
            const result = compareServiceShadow(intentFromLegacy(tx), legacyFacts);
            addTotals(shadow, result.ledgerEffects);
            if (!result.matches) mismatches.push({ serviceId: tx.id, mismatches: result.mismatches });
        }
        catch (error) {
            mismatches.push({ serviceId: tx.id, mismatches: [error instanceof Error ? error.message : String(error)] });
        }
    });
    const differences = subtractTotals(legacy, shadow);
    const ok = mismatches.length === 0 && Object.values(differences).every((value) => Math.abs(toCents(value)) <= 1);
    return { transactionCount: rows.length, legacy, shadow, differences, mismatches, ok };
}
