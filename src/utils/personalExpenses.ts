import { parseAndEvaluate } from '../utils';
import { roundM } from './money';
export type PersonalAdvanceReconcileError = 'empty' | 'invalid' | 'negative' | 'exceeds';
export type PersonalAdvanceReconcileResult = {
    isValid: boolean;
    error?: PersonalAdvanceReconcileError;
    actualSpent: number;
    returnAmount: number;
};
const EPSILON = 0.005;
export function evaluatePersonalAdvanceReconciliation(actualAmountInput: string, advanceAmountInput: number): PersonalAdvanceReconcileResult {
    const advanceAmount = Math.max(0, roundM(Number(advanceAmountInput) || 0));
    const hasInput = actualAmountInput.trim().length > 0;
    if (!hasInput) {
        return { isValid: false, error: 'empty', actualSpent: 0, returnAmount: 0 };
    }
    const parsedActual = parseAndEvaluate(actualAmountInput);
    if (!Number.isFinite(parsedActual)) {
        return { isValid: false, error: 'invalid', actualSpent: 0, returnAmount: 0 };
    }
    if (parsedActual < -EPSILON) {
        return { isValid: false, error: 'negative', actualSpent: 0, returnAmount: 0 };
    }
    const actualSpent = Math.max(0, roundM(parsedActual));
    if (actualSpent > advanceAmount + EPSILON) {
        return { isValid: false, error: 'exceeds', actualSpent, returnAmount: 0 };
    }
    return {
        isValid: true,
        actualSpent,
        returnAmount: roundM(Math.max(0, advanceAmount - actualSpent)),
    };
}
