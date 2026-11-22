import React, { useDeferredValue, useMemo } from 'react';
import { Input } from './Input';
import { useLanguage } from '../../contexts/LanguageContext';
import { evaluateNumericExpression } from '../../utils';
import { amountInWords } from '../../utils/readableAmount';

export const NumberInput = ({ value, onChange, className, ...props }: {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
} & React.InputHTMLAttributes<HTMLInputElement>) => {
    const { t, lang } = useLanguage();
    const deferredValue = useDeferredValue(value);
    const result = useMemo(() => {
        if (!deferredValue) {
            return null;
        }
        const evalResult = evaluateNumericExpression(deferredValue);
        if (!evalResult.success) {
            return { error: evalResult.error };
        }
        if (evalResult.value !== undefined && evalResult.value.toString() !== deferredValue.replace(/,/g, '.') && /[^\d.,\s]/.test(deferredValue)) {
            return { value: evalResult.value };
        }
        // V23-1: a plain big number is shown back readable, so a zero too many or too few is seen.
        if (evalResult.value === undefined) return null;
        const words = amountInWords(evalResult.value, lang);
        const echo = evalResult.value.toString() !== deferredValue.replace(/,/g, '.');
        return words || echo ? { echo, plain: evalResult.value, words } : null;
    }, [deferredValue, lang]);
    return (<div className="relative">
            <Input inputMode="decimal" enterKeyHint="done" autoComplete="off" dir="ltr" value={value} onChange={onChange} {...props} className={[className, 'rtl:text-right'].filter(Boolean).join(' ')}/>
            {result && (<div className="absolute end-2 bottom-[-18px] text-xs">
                    {'error' in result && result.error && <span className="text-danger">{t(result.error as string)}</span>}
                    {'plain' in result && result.plain !== undefined && (<span className="text-neutral-400">{result.echo && <>= {result.plain.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</>}{result.words && <span data-readable-amount="" className="font-semibold text-primary">{result.echo ? ` · ${result.words}` : `${result.plain.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} · ${result.words}`}</span>}</span>)}
                    {'value' in result && result.value !== undefined && !('error' in result && result.error) && (<span className="text-neutral-400">= {result.value.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>)}
                </div>)}
        </div>);
};
