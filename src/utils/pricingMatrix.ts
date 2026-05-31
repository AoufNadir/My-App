/**
 * Pricing matrix for USDT sell price suggestion.
 * Matrix = clientTier × volumeBracket → margin multiplier applied to historical avgMargin.
 *
 * Design principles:
 *  - Larger qty  → better price (lower margin per unit, more total profit)
 *  - VIP client  → reward loyalty with lower margin
 *  - New client  → higher margin (unknown risk, more friction)
 *  - "Regular"   → historical average (×1.0 = market price)
 */

export type ClientTierType = 'vip' | 'regular' | 'new' | 'none';
export type VolumeBracket  = 'small' | 'medium' | 'large';

const BRACKET_THRESHOLDS = { small: 100, medium: 500 } as const;

// Multipliers applied to base historical margin (avgMarginPerUsdt).
// regular × medium = 1.0 → PAM + avgMargin = market reference price.
const MARGIN_MULTIPLIERS: Record<ClientTierType, Record<VolumeBracket, number>> = {
    vip:     { small: 0.87,  medium: 0.72,  large: 0.58  },
    regular: { small: 1.45,  medium: 1.00,  large: 0.87  },
    new:     { small: 1.93,  medium: 1.45,  large: 1.21  },
    none:    { small: 1.45,  medium: 1.00,  large: 0.87  },
};

export function getVolumeBracket(qty: number): VolumeBracket {
    if (qty < BRACKET_THRESHOLDS.small)  return 'small';
    if (qty <= BRACKET_THRESHOLDS.medium) return 'medium';
    return 'large';
}

export function getVolumeBracketLabel(bracket: VolumeBracket): string {
    if (bracket === 'small')  return `< ${BRACKET_THRESHOLDS.small} USDT`;
    if (bracket === 'medium') return `${BRACKET_THRESHOLDS.small}–${BRACKET_THRESHOLDS.medium} USDT`;
    return `> ${BRACKET_THRESHOLDS.medium} USDT`;
}

/**
 * Compute the suggested sell price for a given client tier + quantity.
 * @param pam              Current average buy price (PAM)
 * @param qty              Quantity being sold
 * @param tier             Client loyalty tier
 * @param baseMargin       Historical weighted-average margin per USDT (last 90d)
 * @param fallbackMargin   Fallback if no historical data (from settings)
 */
export function computeSuggestedPrice(
    pam: number,
    qty: number,
    tier: ClientTierType,
    baseMargin: number,
    fallbackMargin = 2
): number {
    const margin = baseMargin > 0 ? baseMargin : fallbackMargin;
    const bracket = getVolumeBracket(qty);
    const mult    = MARGIN_MULTIPLIERS[tier][bracket];
    return pam + margin * mult;
}

/**
 * Return all 4 tier prices for a given quantity (for the table display).
 */
export function allTierPrices(
    pam: number,
    qty: number,
    baseMargin: number,
    fallbackMargin = 2
): Record<ClientTierType, { price: number; profitPerUnit: number; bracket: VolumeBracket }> {
    const tiers: ClientTierType[] = ['vip', 'regular', 'new', 'none'];
    const bracket = getVolumeBracket(qty);
    return Object.fromEntries(
        tiers.map(tier => {
            const price = computeSuggestedPrice(pam, qty, tier, baseMargin, fallbackMargin);
            return [tier, { price, profitPerUnit: price - pam, bracket }];
        })
    ) as Record<ClientTierType, { price: number; profitPerUnit: number; bracket: VolumeBracket }>;
}
