import React, { useDeferredValue, useMemo } from 'react';
import { Input } from './Input';
import { useLanguage } from '../../contexts/LanguageContext';
import { evaluateNumericExpression } from '../../utils';

export const NumberInput = ({ value, onChange, className, ...props }: {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
} & React.InputHTMLAttributes<HTMLInputElement>) => {
    const { t } = useLanguage();
    const deferredValue = useDeferredValue(value);
    const result = useMemo(() => {
        if (!deferredValue) {
            return null;
        }
        const evalResult = evaluateNumericExpression(deferredValue);
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
                    {result.error && <span className="text-danger">{t(result.error)}</span>}
                    {result.value !== undefined && !result.error && (<span className="text-neutral-400">= {result.value.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>)}
                </div>)}
        </div>);
};
