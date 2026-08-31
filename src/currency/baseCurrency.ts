import { DEFAULT_CURRENCY_REGISTRY, validateCurrencyCode, type CurrencyRegistry } from './registry';
import type { CurrencyCode } from './types';

export const LEGACY_DEFAULT_BASE_CURRENCY: CurrencyCode = validateCurrencyCode('DZD');

/**
 * Resolve a workspace base currency without persistence. Missing legacy
 * settings intentionally resolve to DZD; explicit values must be registered.
 */
export function resolveBaseCurrency(
    configuredValue?: unknown,
    registry: CurrencyRegistry = DEFAULT_CURRENCY_REGISTRY,
): CurrencyCode {
    const isMissing = configuredValue === undefined
        || configuredValue === null
        || (typeof configuredValue === 'string' && configuredValue.trim() === '');
    return validateCurrencyCode(isMissing ? 'DZD' : configuredValue, registry);
}
