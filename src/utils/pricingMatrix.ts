/** Shared market-grid helpers used by the canonical smart-pricing engine. */

export type VolumeBracket = 'small' | 'medium' | 'large';

export const VOLUME_BRACKETS = {
    smallBelow: 100,
    mediumThrough: 500,
} as const;

export function getVolumeBracket(quantity: number): VolumeBracket {
    if (quantity < VOLUME_BRACKETS.smallBelow) return 'small';
    if (quantity <= VOLUME_BRACKETS.mediumThrough) return 'medium';
    return 'large';
}

/** Round upward to the market grid (whole or half DZD), never downward. */
export function ceilToMarketPrice(price: number): number {
    if (!Number.isFinite(price) || price <= 0) return 0;
    return Math.ceil((price - Number.EPSILON) * 2) / 2;
}
