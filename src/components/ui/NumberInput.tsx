import React, { useDeferredValue, useMemo } from 'react';
import { Input } from './Input';
/**
 * Safely evaluates a mathematical expression string without using `eval()`.
 * Supports +, -, *, /, and parentheses.
 * @param {string} expr The expression to evaluate.
 * @returns An object with success status, the resulting value, or an error message.
 */
const evaluateExpression = (expr: string): {
    success: boolean;
    value?: number;
    error?: string;
} => {
    if (!expr) {
        return { success: true, value: 0 };
    }
    try {
        const sanitizedExpr = expr.replace(/,/g, '.').replace(/\s+/g, '');
        if (!sanitizedExpr) {
            return { success: true, value: 0 };
        }
        if (/[^0-9.+\-*/().]/.test(sanitizedExpr)) {
            return { success: false, error: "Caractères non valides" };
        }
        // This is a safer alternative to eval
        const result = new Function(`return ${sanitizedExpr}`)();
        if (typeof result !== 'number' || !isFinite(result)) {
            return { success: false, error: "Expression invalide" };
        }
        return { success: true, value: result };
    }
    catch (e) {
        // We catch syntax errors from the Function constructor
        return { success: false, error: "Syntaxe invalide" };
    }
};
export const NumberInput = ({ value, onChange, className, ...props }: {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
} & React.InputHTMLAttributes<HTMLInputElement>) => {
    const deferredValue = useDeferredValue(value);
    const result = useMemo(() => {
        if (!deferredValue) {
            return null;
        }
        const evalResult = evaluateExpression(deferredValue);
        if (!evalResult.success) {
            return { error: evalResult.error };
        }
        if (evalResult.value !== undefined && evalResult.value.toString() !== deferredValue.replace(/,/g, '.')) {
            return { value: evalResult.value };
        }
        return null;
    }, [deferredValue]);
    return (<div className="relative">
            <Input inputMode="decimal" enterKeyHint="done" autoComplete="off" value={value} onChange={onChange} {...props} className={className}/>
            {result && (<div className="absolute end-2 bottom-[-18px] text-xs">
                    {result.error && <span className="text-danger">{result.error}</span>}
                    {result.value !== undefined && !result.error && (<span className="text-neutral-400">= {result.value.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>)}
                </div>)}
        </div>);
};
