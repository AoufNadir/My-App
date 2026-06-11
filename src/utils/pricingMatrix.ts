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

export function getMarginMultiplier(tier: ClientTierType, bracket: VolumeBracket): number {
    return MARGIN_MULTIPLIERS[tier][bracket];
}

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
 * VIP multipliers per bracket (minimum multiplier = VIP discount).
 * Used to calibrate the base margin so that even VIP achieves the goal.
 */
export const VIP_MULTIPLIERS: Record<VolumeBracket, number> = {
    small:  MARGIN_MULTIPLIERS.vip.small,   // 0.87
    medium: MARGIN_MULTIPLIERS.vip.medium,  // 0.72
    large:  MARGIN_MULTIPLIERS.vip.large,   // 0.58
};

/**
 * Compute the adjusted base margin so that even the most discounted tier (VIP)
 * achieves the monthly goal when selling the full historical volume.
 *
 * Formula: adjustedBase = neededMargin / VIP_multiplier[bracket]
 * → VIP × VIP_mult × adjustedBase × volume = neededMargin × volume = goal ✓
 * → All other tiers (higher mult) will exceed the goal ✓
 */
export function computeGoalAdjustedBase(
    neededMargin: number,
    bracket: VolumeBracket
): number {
    const vipMult = VIP_MULTIPLIERS[bracket];
    return vipMult > 0 ? neededMargin / vipMult : neededMargin;
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

/** Volume thresholds for client classification (previous month USDT sold).
 *  These are DEFAULT values — runtime reads from localStorage (app_tier_vip / app_tier_regular / app_tier_petit).
 */
export const VOLUME_THRESHOLDS = {
    vip:        5000,  // > 5000 USDT/month → VIP
    regular:    1000,  // 1000–5000 → Regular
    petit:      150,   // 150–1000  → Petit
    // < 150 or no history → Nouveau
    inactifDays: 45,   // No sell activity in 45 days → treated as Nouveau
} as const;

export const TIER_STORAGE_KEYS = {
    vip:     'app_tier_vip',
    regular: 'app_tier_regular',
    petit:   'app_tier_petit',
    minGoal: 'app_min_monthly_goal',
} as const;

// ════════════════════════════════════════════════════════════════════════
//  MARKET-ANCHORED PRICING MODEL (v2)
//  Direction: market price ↓ discounts = final price.
//  Max discount from market = 3 DZD, in 0.5 DZD steps.
//  Final price is always: plancher ≤ finalPrice ≤ marketPrice.
// ════════════════════════════════════════════════════════════════════════

/** Discount each tier gets vs the current market price (DZD/USDT). */
export const TIER_MARKET_DISCOUNT: Record<ClientTierType, number> = {
    vip:     -2.00,
    regular: -1.00,
    petit:   -0.50,
    new:      0,
    none:    -1.00,
};

/** Volume modifier on top of tier discount. */
export const VOLUME_MARKET_MODIFIER: Record<VolumeBracket, number> = {
    large:  -0.50,   // bulk order → extra discount
    medium:  0,
    small:  +0.50,   // small order → less discount (more friction)
};

/** Payment modifier: cash rewards immediate liquidity. */
export const PAYMENT_MARKET_MODIFIER: Record<PaymentMethod, number> = {
    cash:          -0.50,
    credit_short:   0,
    credit_long:   +0.50,
};

export const MAX_DISCOUNT_FROM_MARKET = -3.00;  // hard floor
export const MARKET_PRICE_STORAGE_KEYS = {
    usdt: 'app_market_price_usdt',
    eur:  'app_market_price_eur',
} as const;

/** Round DOWN to nearest 0.5 — ensures final price never exceeds market. */
export function floorToMarketStep(price: number): number {
    const whole = Math.floor(price);
    const frac  = price - whole;
    return frac >= 0.5 ? whole + 0.5 : whole;
}

export type MarketAnchoredBreakdown = {
    marketPrice: number;
    tierDiscount: number;
    volumeModifier: number;
    paymentModifier: number;
    totalDiscount: number;    // effective (≤ 0, capped at -3)
    rawPrice: number;
    floorPrice: number;
    finalPrice: number;
    clampedToFloor: boolean;
    discountFromMarket: number;   // finalPrice - marketPrice (≤ 0 normally)
    bracket: VolumeBracket;
};

export function computeMarketAnchoredPrice(params: {
    marketPrice: number;
    pam: number;
    tier: ClientTierType;
    qty: number;
    method: PaymentMethod;
    floorMargin?: number;
}): MarketAnchoredBreakdown {
    const { marketPrice, pam, tier, qty, method, floorMargin = 0 } = params;
    const bracket        = getVolumeBracket(qty);
    const tierDiscount   = TIER_MARKET_DISCOUNT[tier];
    const volumeModifier = VOLUME_MARKET_MODIFIER[bracket];
    const paymentModifier = PAYMENT_MARKET_MODIFIER[method];

    const rawDiscount    = tierDiscount + volumeModifier + paymentModifier;
    // Cap: never more than 3 DZD below market, never above market
    const totalDiscount  = Math.min(0, Math.max(MAX_DISCOUNT_FROM_MARKET, rawDiscount));

    const rawPrice   = marketPrice + totalDiscount;
    const floorPrice = pam + Math.max(0, floorMargin);

    // Round DOWN (don't exceed market), then clamp UP to floor if needed
    const rounded  = floorToMarketStep(rawPrice);
    const clamped  = Math.max(rounded, floorPrice);
    const finalPrice = clamped > rounded + 0.001
        ? ceilToMarketPrice(clamped)   // clamped to floor → round UP to meet it
        : rounded;

    return {
        marketPrice, tierDiscount, volumeModifier, paymentModifier,
        totalDiscount, rawPrice, floorPrice, finalPrice,
        clampedToFloor: finalPrice > rounded + 0.001,
        discountFromMarket: finalPrice - marketPrice,
        bracket,
    };
}

// ════════════════════════════════════════════════════════════════════════
//  VIP-ANCHORED PRICING MODEL (v3)
//  The entered price = VIP + Gros + Cash (best client, best conditions).
//  All other clients pay premiums ON TOP of that base price.
//  Max premium = 4 DZD. Final price always ≥ plancher.
// ════════════════════════════════════════════════════════════════════════

/** Premium each non-VIP tier pays above the VIP price. */
export const TIER_PREMIUM: Record<ClientTierType, number> = {
    vip:     0,
    regular: +1.00,
    petit:   +1.50,
    new:     +2.00,
    none:    +1.00,
};

/** Volume premium — large bulk = 0 (baseline, already in VIP price). */
export const VOLUME_PREMIUM: Record<VolumeBracket, number> = {
    large:   0,
    medium: +0.50,
    small:  +1.00,
};

/** Payment premium — cash = 0 (baseline). */
export const PAYMENT_PREMIUM: Record<PaymentMethod, number> = {
    cash:          0,
    credit_short: +0.50,
    credit_long:  +1.00,
};

export const MAX_PREMIUM_ABOVE_VIP = 4.00;

export const PREMIUM_STORAGE_KEYS = {
    regular:       'app_premium_regular',
    petit:         'app_premium_petit',
    new_client:    'app_premium_new',
    vol_medium:    'app_premium_vol_medium',
    vol_small:     'app_premium_vol_small',
    pay_short:     'app_premium_pay_short',
    pay_long:      'app_premium_pay_long',
} as const;

export type EditablePremiums = {
    tierRegular: number; tierPetit: number; tierNew: number;
    volMedium: number;   volSmall: number;
    payShort: number;    payLong: number;
};

export function readEditablePremiums(): EditablePremiums {
    const n = (key: string, def: number) => { const v = Number(localStorage.getItem(key)); return Number.isFinite(v) ? v : def; };
    return {
        tierRegular: n(PREMIUM_STORAGE_KEYS.regular,    1.00),
        tierPetit:   n(PREMIUM_STORAGE_KEYS.petit,      1.50),
        tierNew:     n(PREMIUM_STORAGE_KEYS.new_client, 2.00),
        volMedium:   n(PREMIUM_STORAGE_KEYS.vol_medium, 0.50),
        volSmall:    n(PREMIUM_STORAGE_KEYS.vol_small,  1.00),
        payShort:    n(PREMIUM_STORAGE_KEYS.pay_short,  0.50),
        payLong:     n(PREMIUM_STORAGE_KEYS.pay_long,   1.00),
    };
}

export function saveEditablePremiums(p: EditablePremiums) {
    localStorage.setItem(PREMIUM_STORAGE_KEYS.regular,    String(p.tierRegular));
    localStorage.setItem(PREMIUM_STORAGE_KEYS.petit,      String(p.tierPetit));
    localStorage.setItem(PREMIUM_STORAGE_KEYS.new_client, String(p.tierNew));
    localStorage.setItem(PREMIUM_STORAGE_KEYS.vol_medium, String(p.volMedium));
    localStorage.setItem(PREMIUM_STORAGE_KEYS.vol_small,  String(p.volSmall));
    localStorage.setItem(PREMIUM_STORAGE_KEYS.pay_short,  String(p.payShort));
    localStorage.setItem(PREMIUM_STORAGE_KEYS.pay_long,   String(p.payLong));
}

export type VIPAnchoredBreakdown = {
    vipPrice: number;
    tierPremium: number;
    volumePremium: number;
    paymentPremium: number;
    totalPremium: number;
    rawPrice: number;
    floorPrice: number;
    finalPrice: number;
    clampedToFloor: boolean;
    premiumAboveVip: number;
    bracket: VolumeBracket;
};

export function computeVIPAnchoredPrice(params: {
    vipPrice: number;
    pam: number;
    tier: ClientTierType;
    qty: number;
    method: PaymentMethod;
    floorMargin?: number;
    maxPremium?: number;
    customPremiums?: EditablePremiums;
}): VIPAnchoredBreakdown {
    const { vipPrice, pam, tier, qty, method, floorMargin = 0, maxPremium = MAX_PREMIUM_ABOVE_VIP, customPremiums } = params;
    const bracket = getVolumeBracket(qty);

    // Use custom premiums if provided, else static defaults
    const tierPremium = tier === 'vip' ? 0 : tier === 'regular'
        ? (customPremiums?.tierRegular ?? TIER_PREMIUM.regular)
        : tier === 'petit'
        ? (customPremiums?.tierPetit ?? TIER_PREMIUM.petit)
        : (customPremiums?.tierNew ?? TIER_PREMIUM.new);
    const volumePremium = bracket === 'large' ? 0
        : bracket === 'medium' ? (customPremiums?.volMedium ?? VOLUME_PREMIUM.medium)
        : (customPremiums?.volSmall ?? VOLUME_PREMIUM.small);
    const paymentPremium = method === 'cash' ? 0
        : method === 'credit_short' ? (customPremiums?.payShort ?? PAYMENT_PREMIUM.credit_short)
        : (customPremiums?.payLong ?? PAYMENT_PREMIUM.credit_long);
    const rawPremium     = tierPremium + volumePremium + paymentPremium;
    const totalPremium   = Math.min(maxPremium, rawPremium);
    const rawPrice       = vipPrice + totalPremium;
    const floorPrice     = pam + Math.max(0, floorMargin);
    const clamped        = Math.max(rawPrice, floorPrice);
    const finalPrice     = ceilToMarketPrice(clamped);
    return {
        vipPrice, tierPremium, volumePremium, paymentPremium,
        totalPremium, rawPrice, floorPrice, finalPrice,
        clampedToFloor: clamped > rawPrice + 0.001,
        premiumAboveVip: finalPrice - vipPrice,
        bracket,
    };
}

// ════════════════════════════════════════════════════════════════════════
//  LAYERED ("transparent") PRICING MODEL (v1 — kept for FAB Assisté)
//  Additive deltas (DZD/USDT) stacked on a reference price = PAM + baseMargin.
//  Each lever is a visible +/- so the user sees exactly WHY a price differs.
//  Levers: 1) Client tier  2) Volume bracket  3) Payment method (NEW).
// ════════════════════════════════════════════════════════════════════════

export type PaymentMethod = 'cash' | 'credit_short' | 'credit_long';

/** Client lever — DZD/USDT delta vs the "Régulier" baseline (0). */
export const CLIENT_LAYER_DELTA: Record<ClientTierType, number> = {
    vip:     -1.50,
    regular:  0,
    petit:   +0.75,
    new:     +1.50,
    none:     0,
};

/** Volume lever — DZD/USDT delta vs the "medium" baseline (0). */
export const VOLUME_LAYER_DELTA: Record<VolumeBracket, number> = {
    large:  -0.80,
    medium:  0,
    small:  +1.20,
};

/** Representative days per credit bucket — drives the financing-cost premium. */
export const PAYMENT_DAYS: Record<PaymentMethod, number> = {
    cash:          0,
    credit_short:  10,
    credit_long:   30,
};

/** Default monthly cost of capital (%) — tunable in settings (app_capital_cost_pct). */
export const DEFAULT_CAPITAL_COST_PCT = 2;
/** Small cash reward (DZD/USDT) for immediate liquidity. */
export const CASH_DISCOUNT = 0.50;

export const CAPITAL_COST_STORAGE_KEY = 'app_capital_cost_pct';

export function readCapitalCostPct(): number {
    const v = Number(localStorage.getItem(CAPITAL_COST_STORAGE_KEY));
    return Number.isFinite(v) && v > 0 ? v : DEFAULT_CAPITAL_COST_PCT;
}

/**
 * Payment lever delta (DZD/USDT).
 *  - Cash  → small discount (reward immediate liquidity / capital velocity).
 *  - Credit → financing cost = PAM × monthlyRate × (days ÷ 30) — real interest
 *    on the capital you freeze while waiting for payment.
 */
export function computePaymentDelta(pam: number, method: PaymentMethod, monthlyCostPct: number): number {
    if (method === 'cash') return -CASH_DISCOUNT;
    const days = PAYMENT_DAYS[method];
    return pam * (monthlyCostPct / 100) * (days / 30);
}

export type LayeredBreakdown = {
    referencePrice: number;
    clientDelta: number;
    volumeDelta: number;
    paymentDelta: number;
    rawPrice: number;
    floorPrice: number;
    finalPrice: number;   // clamped to floor, then market-rounded UP
    clampedToFloor: boolean;
    bracket: VolumeBracket;
};

/**
 * Compute the layered sell price with a fully transparent breakdown.
 * referencePrice = PAM + baseMargin (the "fair" price for a typical Régulier/medium sale).
 * Then client + volume + payment deltas move it. Never drops below the floor (plancher).
 */
export function computeLayeredPrice(params: {
    pam: number;
    baseMargin: number;        // goal ÷ avgVol (reference margin per USDT)
    tier: ClientTierType;
    qty: number;
    method: PaymentMethod;
    monthlyCostPct: number;
    floorMargin?: number;      // minimum margin (plancher) over PAM
}): LayeredBreakdown {
    const { pam, baseMargin, tier, qty, method, monthlyCostPct, floorMargin = 0 } = params;
    const bracket = getVolumeBracket(qty);
    const referencePrice = pam + baseMargin;
    const clientDelta  = CLIENT_LAYER_DELTA[tier];
    const volumeDelta  = VOLUME_LAYER_DELTA[bracket];
    const paymentDelta = computePaymentDelta(pam, method, monthlyCostPct);
    const rawPrice  = referencePrice + clientDelta + volumeDelta + paymentDelta;
    const floorPrice = pam + Math.max(0, floorMargin);
    const clamped = Math.max(rawPrice, floorPrice);
    return {
        referencePrice, clientDelta, volumeDelta, paymentDelta,
        rawPrice, floorPrice,
        finalPrice: ceilToMarketPrice(clamped),
        clampedToFloor: clamped > rawPrice + 0.001,
        bracket,
    };
}

export type TierThresholds = { vip: number; regular: number; petit: number };

export function readTierThresholds(): TierThresholds {
    return {
        vip:     Number(localStorage.getItem(TIER_STORAGE_KEYS.vip)     || VOLUME_THRESHOLDS.vip),
        regular: Number(localStorage.getItem(TIER_STORAGE_KEYS.regular) || VOLUME_THRESHOLDS.regular),
        petit:   Number(localStorage.getItem(TIER_STORAGE_KEYS.petit)   || VOLUME_THRESHOLDS.petit),
    };
}
