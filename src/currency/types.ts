declare const currencyCodeBrand: unique symbol;

/**
 * A normalized, registry-backed currency code. Values should only be obtained
 * through validateCurrencyCode() or a CurrencyRegistry lookup.
 */
export type CurrencyCode = string & { readonly [currencyCodeBrand]: true };

export type CurrencyType = 'fiat' | 'crypto' | 'stablecoin';

export interface CurrencyDefinition {
    readonly code: CurrencyCode;
    readonly name: string;
    readonly symbol: string;
    /** Money/display precision for values denominated in this currency. */
    readonly decimals: number;
    /** Inventory precision. The M1 implementation supports up to 1e-8. */
    readonly quantityDecimals: number;
    readonly type: CurrencyType;
    readonly activeByDefault: boolean;
}

export interface CurrencyLockedBatch {
    readonly operationId: string;
    readonly quantity: number;
    readonly lockedUntil: number;
}

export interface CurrencyPosition {
    readonly currencyCode: CurrencyCode;
    readonly baseCurrency: CurrencyCode;
    readonly quantity: number;
    readonly costedQuantity: number;
    readonly costBasisBase: number;
    readonly averageCostBase: number;
    readonly available: number;
    readonly locked: number;
    readonly lockedBatches?: readonly CurrencyLockedBatch[];
    readonly realizedTradingProfitBase: number;
    /** Recorded separately; M1 does not connect it to investor allocation. */
    readonly realizedFxGainLossBase: number;
}

export type FinancialAccountType = 'cash' | 'bank' | 'wallet' | 'portfolio' | 'clearing';

export interface FinancialAccount {
    readonly id: string;
    readonly name: string;
    readonly currencyCode: CurrencyCode;
    readonly type: FinancialAccountType;
    readonly active: boolean;
    readonly legacyReference?: {
        readonly system: 'legacy';
        readonly key: 'caisse' | 'baridimob';
    };
}

export interface CurrencyLeg {
    readonly currency: CurrencyCode;
    readonly amount: number;
    readonly accountId?: string;
}

export interface CurrencyRate {
    /** Canonical convention: 1 unit of FROM equals value units of TO. */
    readonly convention: 'to_per_from';
    readonly value: number;
}

export interface CurrencyValuation {
    readonly amountBase: number;
    readonly method: 'direct' | 'manual' | 'rate_snapshot';
    readonly sourceRateToBase?: number;
    readonly destinationRateToBase?: number;
}

export interface CurrencyOperationEconomics {
    readonly sourceHistoricalCostBase: number;
    readonly destinationCostBasisBase: number;
    readonly realizedTradingProfitBase: number;
    /** Kept distinct from trading profit; no investor rule is implied. */
    readonly realizedFxGainLossBase: number;
    readonly eligibleFeesBase: number;
}

interface CurrencyOperationBase {
    readonly operationId: string;
    readonly schemaVersion: 1;
    readonly status: 'posted' | 'reversal';
    readonly baseCurrency: CurrencyCode;
    readonly valuation: CurrencyValuation;
    readonly economics: CurrencyOperationEconomics;
    readonly effectiveAt: number;
    readonly notes?: string;
    readonly tags?: readonly string[];
    readonly reversalOf?: string;
    readonly corrects?: string;
}

export type CurrencyOperation =
    | (CurrencyOperationBase & {
        readonly kind: 'buy' | 'sell' | 'exchange';
        readonly from: CurrencyLeg;
        readonly to: CurrencyLeg;
        readonly rate: CurrencyRate;
    })
    | (CurrencyOperationBase & {
        readonly kind: 'manual_add';
        readonly from: null;
        readonly to: CurrencyLeg;
        readonly rate: null;
    })
    | (CurrencyOperationBase & {
        readonly kind: 'manual_remove';
        readonly from: CurrencyLeg;
        readonly to: null;
        readonly rate: null;
    });
