import type { CurrencyCode, CurrencyDefinition, CurrencyType } from './types';
import { MAX_MONEY_DECIMALS, MAX_QUANTITY_DECIMALS } from './precision';

export type CurrencyDefinitionInput = Omit<CurrencyDefinition, 'code'> & {
    readonly code: string;
};

export type CurrencyValidationErrorReason = 'invalid_format' | 'unknown_code';

export class CurrencyValidationError extends Error {
    constructor(
        readonly reason: CurrencyValidationErrorReason,
        readonly input: unknown,
        message: string,
    ) {
        super(message);
        this.name = 'CurrencyValidationError';
    }
}

export interface CurrencyRegistry {
    readonly definitions: readonly CurrencyDefinition[];
    has(value: unknown): boolean;
    get(value: unknown): CurrencyDefinition | undefined;
    require(value: unknown): CurrencyDefinition;
    activeByDefault(): readonly CurrencyDefinition[];
}

const CURRENCY_CODE_PATTERN = /^[A-Z][A-Z0-9]{1,11}$/;
const CURRENCY_TYPES: readonly CurrencyType[] = ['fiat', 'crypto', 'stablecoin'];

/** Normalize and syntax-check a code. Registry membership is checked separately. */
export function normalizeCurrencyCode(value: unknown): string {
    if (typeof value !== 'string') {
        throw new CurrencyValidationError('invalid_format', value, 'Currency code must be a string.');
    }
    const normalized = value.normalize('NFKC').trim().toUpperCase();
    if (!CURRENCY_CODE_PATTERN.test(normalized)) {
        throw new CurrencyValidationError(
            'invalid_format',
            value,
            `Invalid currency code "${normalized || String(value)}". Expected 2-12 uppercase ASCII letters or digits, starting with a letter.`,
        );
    }
    return normalized;
}

function validatePrecision(label: string, value: number, maxDecimals: number): void {
    if (!Number.isInteger(value) || value < 0 || value > maxDecimals) {
        throw new Error(`${label} must be an integer between 0 and ${maxDecimals}.`);
    }
}

export function createCurrencyRegistry(inputs: readonly CurrencyDefinitionInput[]): CurrencyRegistry {
    const definitions: CurrencyDefinition[] = [];
    const byCode = new Map<string, CurrencyDefinition>();

    for (const input of inputs) {
        const normalized = normalizeCurrencyCode(input.code);
        if (byCode.has(normalized)) {
            throw new Error(`Duplicate currency code "${normalized}" in registry.`);
        }
        if (!input.name.trim() || !input.symbol.trim()) {
            throw new Error(`Currency "${normalized}" requires a non-empty name and symbol.`);
        }
        if (!CURRENCY_TYPES.includes(input.type)) {
            throw new Error(`Currency "${normalized}" has an invalid type.`);
        }
        validatePrecision(`${normalized} money decimals`, input.decimals, MAX_MONEY_DECIMALS);
        validatePrecision(
            `${normalized} quantity decimals`,
            input.quantityDecimals,
            MAX_QUANTITY_DECIMALS,
        );

        const definition = Object.freeze({
            ...input,
            code: normalized as CurrencyCode,
        });
        definitions.push(definition);
        byCode.set(normalized, definition);
    }

    const frozenDefinitions = Object.freeze([...definitions]);
    const get = (value: unknown): CurrencyDefinition | undefined => {
        try {
            return byCode.get(normalizeCurrencyCode(value));
        }
        catch (error) {
            if (error instanceof CurrencyValidationError) return undefined;
            throw error;
        }
    };

    return Object.freeze({
        definitions: frozenDefinitions,
        has: (value: unknown) => get(value) !== undefined,
        get,
        require: (value: unknown) => {
            const normalized = normalizeCurrencyCode(value);
            const definition = byCode.get(normalized);
            if (!definition) {
                throw new CurrencyValidationError(
                    'unknown_code',
                    value,
                    `Unknown currency code "${normalized}". Add it to the currency registry before use.`,
                );
            }
            return definition;
        },
        activeByDefault: () => frozenDefinitions.filter((definition) => definition.activeByDefault),
    });
}

export const DEFAULT_CURRENCY_REGISTRY = createCurrencyRegistry([
    {
        code: 'DZD',
        name: 'Algerian Dinar',
        symbol: 'دج',
        decimals: 2,
        quantityDecimals: 2,
        type: 'fiat',
        activeByDefault: true,
    },
    {
        code: 'USDT',
        name: 'Tether USD',
        symbol: 'USDT',
        decimals: 6,
        quantityDecimals: 8,
        type: 'stablecoin',
        activeByDefault: true,
    },
    {
        code: 'EUR',
        name: 'Euro',
        symbol: '€',
        decimals: 2,
        quantityDecimals: 2,
        type: 'fiat',
        activeByDefault: true,
    },
    {
        code: 'USD',
        name: 'United States Dollar',
        symbol: '$',
        decimals: 2,
        quantityDecimals: 2,
        type: 'fiat',
        activeByDefault: false,
    },
    {
        code: 'GBP',
        name: 'British Pound Sterling',
        symbol: '£',
        decimals: 2,
        quantityDecimals: 2,
        type: 'fiat',
        activeByDefault: false,
    },
    {
        code: 'CNY',
        name: 'Chinese Yuan / Renminbi (RMB)',
        symbol: '¥',
        decimals: 2,
        quantityDecimals: 2,
        type: 'fiat',
        activeByDefault: false,
    },
] as const);

/** Return a branded code only after successful registry membership validation. */
export function validateCurrencyCode(
    value: unknown,
    registry: CurrencyRegistry = DEFAULT_CURRENCY_REGISTRY,
): CurrencyCode {
    return registry.require(value).code;
}

export function getCurrencyDefinition(
    value: unknown,
    registry: CurrencyRegistry = DEFAULT_CURRENCY_REGISTRY,
): CurrencyDefinition {
    return registry.require(value);
}
