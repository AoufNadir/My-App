import type { PortfolioStats } from '../types';
import type { PortfolioCurrency, PortfolioEffects, PortfolioInventoryState, PortfolioWallet } from './portfolioShadow';

/**
 * Pure adapter from the Legacy PAM read model. It is deliberately an adapter,
 * not a V2 source of truth. Once V2 is live, projections will be rebuilt from
 * the immutable ledger instead.
 */
export function inventoryFromLegacyPortfolioStats(stats: PortfolioStats, currency: PortfolioCurrency): PortfolioInventoryState {
    const source = currency === 'USDT' ? stats.usdt : stats.eur;
    return {
        quantity: Number(source.available || 0) + Number(source.locked || 0),
        costedQuantity: Number(source.purchasedQty || 0),
        costBasisDzd: Number(source.costBasis || 0),
    };
}

export function emptyLegacyPortfolioEffects(): PortfolioEffects {
    return {
        quantityDeltas: { USDT: 0, EUR: 0 },
        costBasisDeltasDzd: { USDT: 0, EUR: 0 },
        cashDeltasDzd: { Caisse: 0, BaridiMob: 0 },
        clientReceivableDzd: 0,
        clientPayableDzd: 0,
        realizedTradingProfitDzd: 0,
        fxGainLossDzd: 0,
    };
}

export function legacyPortfolioInventoryEffect(
    currency: PortfolioCurrency,
    quantityDelta: number,
    costBasisDeltaDzd: number,
): Pick<PortfolioEffects, 'quantityDeltas' | 'costBasisDeltasDzd'> {
    const base = emptyLegacyPortfolioEffects();
    base.quantityDeltas[currency] = quantityDelta;
    base.costBasisDeltasDzd[currency] = costBasisDeltaDzd;
    return base;
}

export function legacyPortfolioCashEffect(wallet: PortfolioWallet, amountDzd: number): Pick<PortfolioEffects, 'cashDeltasDzd'> {
    const base = emptyLegacyPortfolioEffects();
    base.cashDeltasDzd[wallet] = amountDzd;
    return base;
}
