
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from './Input';

// Using a const for motion.div to resolve TypeScript type inference issues.
const MotionDiv = motion.div;

/**
 * Safely evaluates a mathematical expression string without using `eval()`.
 * Supports +, -, *, /, and parentheses.
 * @param {string} expr The expression to evaluate.
 * @returns An object with success status, the resulting value, or an error message.
 */
const evaluateExpression = (expr: string): { success: boolean; value?: number; error?: string } => {
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

    } catch (e) {
        // We catch syntax errors from the Function constructor
        return { success: false, error: "Syntaxe invalide" };
    }
};


export const NumberInput = ({ value, onChange, className, ...props }: { value: string, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void } & React.InputHTMLAttributes<HTMLInputElement>) => {
    const [result, setResult] = useState<{ value?: number; error?: string } | null>(null);

    useEffect(() => {
      if (value) {
        const evalResult = evaluateExpression(value);
        if (evalResult.success && evalResult.value !== undefined) {
           // Avoid showing result if it's the same as the input
           if (evalResult.value.toString() !== value.replace(/,/g, '.')) {
               setResult({ value: evalResult.value });
           } else {
               setResult(null);
           }
        } else {
          setResult({ error: evalResult.error });
        }
      } else {
        setResult(null);
      }
    }, [value]);

    return (
        <div className="relative">
            <Input value={value} onChange={onChange} {...props} className={className} />
            <AnimatePresence>
                {result && (
                    <MotionDiv 
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="absolute right-2 bottom-[-18px] text-xs"
                    >
                        {result.error && <span className="text-red-500">{result.error}</span>}
                        {result.value !== undefined && !result.error && (
                            <span className="text-gray-400">= {result.value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</span>
                        )}
                    </MotionDiv>
                )}
            </AnimatePresence>
        </div>
    );
};
