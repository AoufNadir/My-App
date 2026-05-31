/**
 * Pricing matrix for USDT sell price suggestion.
 * Matrix = clientTier × volumeBracket → margin multiplier applied to historical avgMargin.
 *
 * Design principles:
 *  - Larger qty  → better price (lower margin per unit, more total profit)
 *  - VIP client  → reward loyalty with lower margin
 *  - New client  → higher margin (unknown risk, more friction)
 *  - "Regular"   → historical average (×1.0 = market reference price)
 *
 * Client classification is based on PREVIOUS MONTH USDT volume:
 *   VIP      > 1,000 USDT/month
 *   Regular  200–1,000 USDT/month
 *   Petit    1–200 USDT/month
 *   Nouveau  No previous month history
 *   Inactif  No sell activity in 45 days → treated as Nouveau
 */

export type ClientTierType = 'vip' | 'regular' | 'petit' | 'new' | 'none';
export type VolumeBracket  = 'small' | 'medium' | 'large';

const BRACKET_THRESHOLDS = { small: 100, medium: 500 } as const;

/**
 * Multipliers applied to base historical margin (avgMarginPerUsdt).
 * regular × medium = 1.0 → PAM + avgMargin = market reference price.
 * petit sits between regular and new.
 */
const MARGIN_MULTIPLIERS: Record<ClientTierType, Record<VolumeBracket, number>> = {
    vip:     { small: 0.87,  medium: 0.72,  large: 0.58  },
    regular: { small: 1.45,  medium: 1.00,  large: 0.87  },
    petit:   { small: 1.70,  medium: 1.25,  large: 1.00  },
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
 * Round a price to the nearest whole number or .50.
 * frac < 0.25  → floor (whole number)
 * frac < 0.75  → .50
 * frac ≥ 0.75  → ceil (next whole number)
 *
 * Example: 247.26 → 247.50 | 249.18 → 249 | 250.80 → 251
 */
/**
 * Round to nearest xxx or xxx.50 (for daily sell price display).
 */
export function roundToMarketPrice(price: number): number {
    const whole = Math.floor(price);
    const frac  = price - whole;
    if (frac < 0.25) return whole;
    if (frac < 0.75) return whole + 0.5;
    return whole + 1;
}

/**
 * Round UP to xxx or xxx.50 — used for projection target prices
 * to guarantee the goal is met (never round down).
 * frac = 0     → whole (already exact)
 * frac > 0     → if frac ≤ 0.5 → whole + 0.5, else → whole + 1
 */
export function ceilToMarketPrice(price: number): number {
    const whole = Math.floor(price);
    const frac  = price - whole;
    if (frac === 0) return whole;
    if (frac <= 0.5) return whole + 0.5;
    return whole + 1;
}

/**
 * Compute the suggested sell price for a given client tier + quantity,
 * rounded to xxx or xxx.50.
 */
export function computeSuggestedPrice(
    pam: number,
    qty: number,
    tier: ClientTierType,
    baseMargin: number,
    fallbackMargin = 2
): number {
    const margin  = baseMargin > 0 ? baseMargin : fallbackMargin;
    const bracket = getVolumeBracket(qty);
    const mult    = MARGIN_MULTIPLIERS[tier][bracket];
    return roundToMarketPrice(pam + margin * mult);
}

/**
 * Return all tier prices for a given quantity (for the pricing table).
 */
export function allTierPrices(
    pam: number,
    qty: number,
    baseMargin: number,
    fallbackMargin = 2
): Record<ClientTierType, { price: number; profitPerUnit: number; bracket: VolumeBracket }> {
    const tiers: ClientTierType[] = ['vip', 'regular', 'petit', 'new', 'none'];
    const bracket = getVolumeBracket(qty);
    return Object.fromEntries(
        tiers.map(tier => {
            const price = computeSuggestedPrice(pam, qty, tier, baseMargin, fallbackMargin);
            return [tier, { price, profitPerUnit: price - pam, bracket }];
        })
    ) as Record<ClientTierType, { price: number; profitPerUnit: number; bracket: VolumeBracket }>;
}

/** Volume thresholds for client classification (previous month USDT sold) */
export const VOLUME_THRESHOLDS = {
    vip:        5500,  // > 5500 USDT/month → VIP
    regular:    1000,  // 1000–5500 → Regular
    petit:      50,    // 50–1000   → Petit
    // < 50 or no history → Nouveau
    inactifDays: 45,   // No sell activity in 45 days → treated as Nouveau
} as const;
