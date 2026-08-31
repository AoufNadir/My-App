import type { CurrencyDefinition } from './types';

export const MAX_MONEY_DECIMALS = 8;
export const MAX_QUANTITY_DECIMALS = 8;

function scaleFor(decimals: number, label: string, maxDecimals: number): number {
    if (!Number.isInteger(decimals) || decimals < 0 || decimals > maxDecimals) {
        throw new Error(`${label} precision must be an integer between 0 and ${maxDecimals}.`);
    }
    return 10 ** decimals;
}

function scaledInteger(value: number, scale: number, label: string): number {
    if (!Number.isFinite(value)) {
        throw new Error(`${label} must be finite.`);
    }
    const result = Math.round(value * scale);
    if (!Number.isSafeInteger(result)) {
        throw new Error(`${label} exceeds safe integer precision.`);
    }
    return result;
}

/** Convert money to integer minor units using currency money precision. */
export function toMoneyMinorUnits(value: number, currency: CurrencyDefinition): number {
    const scale = scaleFor(currency.decimals, `${currency.code} money`, MAX_MONEY_DECIMALS);
    return scaledInteger(value, scale, `${currency.code} money amount`);
}

export function fromMoneyMinorUnits(units: number, currency: CurrencyDefinition): number {
    if (!Number.isSafeInteger(units)) throw new Error(`${currency.code} money units must be a safe integer.`);
    return units / scaleFor(currency.decimals, `${currency.code} money`, MAX_MONEY_DECIMALS);
}

export function roundMoneyAmount(value: number, currency: CurrencyDefinition): number {
    return fromMoneyMinorUnits(toMoneyMinorUnits(value, currency), currency);
}

/** Convert inventory quantity to integer atoms using quantity precision. */
export function toQuantityAtoms(value: number, currency: CurrencyDefinition): number {
    const scale = scaleFor(currency.quantityDecimals, `${currency.code} quantity`, MAX_QUANTITY_DECIMALS);
    return scaledInteger(value, scale, `${currency.code} quantity`);
}

export function fromQuantityAtoms(atoms: number, currency: CurrencyDefinition): number {
    if (!Number.isSafeInteger(atoms)) throw new Error(`${currency.code} quantity atoms must be a safe integer.`);
    return atoms / scaleFor(currency.quantityDecimals, `${currency.code} quantity`, MAX_QUANTITY_DECIMALS);
}

export function roundCurrencyQuantity(value: number, currency: CurrencyDefinition): number {
    return fromQuantityAtoms(toQuantityAtoms(value, currency), currency);
}
