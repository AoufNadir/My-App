import assert from 'node:assert/strict';
import { translations } from './index';

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function flattenKeys(value: Record<string, unknown>, prefix = ''): string[] {
    return Object.entries(value).flatMap(([key, child]) => {
        const path = prefix ? `${prefix}.${key}` : key;
        return isPlainObject(child) ? flattenKeys(child, path) : [path];
    });
}

const frKeys = new Set(flattenKeys(translations.fr));
const arKeys = new Set(flattenKeys(translations.ar));

const missingInArabic = [...frKeys].filter((key) => !arKeys.has(key)).sort();
const missingInFrench = [...arKeys].filter((key) => !frKeys.has(key)).sort();

assert.deepEqual(missingInArabic, [], `Missing Arabic translation keys:\n${missingInArabic.join('\n')}`);
assert.deepEqual(missingInFrench, [], `Missing French translation keys:\n${missingInFrench.join('\n')}`);

console.log('translations tests passed');
