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
export function evaluatePersonalAdvanceReconciliation(returnedAmountInput: string, advanceAmountInput: number): PersonalAdvanceReconcileResult {
    const advanceAmount = Math.max(0, roundM(Number(advanceAmountInput) || 0));
    const hasInput = returnedAmountInput.trim().length > 0;
    if (!hasInput) {
        return { isValid: false, error: 'empty', actualSpent: 0, returnAmount: 0 };
    }
    const parsedReturned = parseAndEvaluate(returnedAmountInput);
    if (!Number.isFinite(parsedReturned)) {
        return { isValid: false, error: 'invalid', actualSpent: 0, returnAmount: 0 };
    }
    if (parsedReturned < -EPSILON) {
        return { isValid: false, error: 'negative', actualSpent: 0, returnAmount: 0 };
    }
    const returnAmount = Math.max(0, roundM(parsedReturned));
    if (returnAmount > advanceAmount + EPSILON) {
        return { isValid: false, error: 'exceeds', actualSpent: 0, returnAmount };
    }
    return {
        isValid: true,
        actualSpent: roundM(Math.max(0, advanceAmount - returnAmount)),
        returnAmount,
    };
}
