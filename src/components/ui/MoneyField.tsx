import React from 'react';
import { Label } from './Label';
import { NumberInput } from './NumberInput';
import type { MoneyCurrency } from '../../pages/shared/pageFormat';
type Props = {
    label: string;
    value: string;
    onChange: (val: string) => void;
    currency?: MoneyCurrency;
    hint?: React.ReactNode;
    error?: React.ReactNode;
    placeholder?: string;
    onMax?: () => void;
    maxLabel?: string;
    maxDisabled?: boolean;
    className?: string;
    autoFocus?: boolean;
    onBlur?: () => void;
};
/**
 * Unified money input field that wraps Label + NumberInput + Hint + Error.
 * Use for any monetary amount input across the app for consistent UX.
 *
 * Supports math expressions (via NumberInput), currency suffix in label,
 * inline error messages, and an optional MAX button.
 */
export function MoneyField({ label, value, onChange, currency, hint, error, placeholder = '0.00', onMax, maxLabel = 'MAX', maxDisabled = false, className = '', autoFocus, onBlur }: Props) {
    const subtleText = 'text-neutral-500';
    const fullLabel = currency ? `${label} (${currency})` : label;
    const hasError = Boolean(error);
    return (<div className={className}>
            <Label>{fullLabel}</Label>
            <div className="relative">
                <NumberInput value={value} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} autoFocus={autoFocus} placeholder={placeholder} className={`bg-surface text-neutral-900 border border-border-strong rounded-lg px-3 py-2 w-full ${hasError ? 'border-danger ring-1 ring-danger' : ''} ${onMax ? 'pr-20' : ''}`}/>
                {onMax && (<button type="button" onClick={onMax} disabled={maxDisabled} className={`absolute right-1 top-1/2 flex min-h-touch min-w-touch -translate-y-1/2 items-center justify-center rounded-md px-2 text-xs font-bold transition-colors ${maxDisabled
                ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                : 'bg-primary text-white hover:bg-primary-dark'}`}>
                        {maxLabel}
                    </button>)}
            </div>
            {error ? (<p className="mt-1 text-xs font-medium text-danger">{error}</p>) : hint ? (<p className={`mt-1 text-xs ${subtleText}`}>{hint}</p>) : null}
        </div>);
}
