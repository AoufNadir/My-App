import React from 'react';
import { CurrencyAmount } from '../financial/CurrencyAmount';
export type MoneySemantic = 'profit' | 'loss' | 'neutral' | 'auto' | 'plain';
export type MoneyCurrency = 'DZD' | 'EUR' | 'USDT' | 'USD';
export type MoneySize = 'sm' | 'md' | 'lg' | 'xl' | 'hero';
export interface MoneyTextProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'> {
    value: number;
    currency?: MoneyCurrency | null;
    semantic?: MoneySemantic;
    size?: MoneySize;
    showSign?: boolean;
    min?: number;
    max?: number;
}
export const MoneyText: React.FC<MoneyTextProps> = ({ value, currency, semantic = 'plain', size = 'md', showSign = false, min = 2, max = 2, className = '', ...rest }) => {
    return (<CurrencyAmount value={value} currency={currency} semantic={semantic} size={size} showSign={showSign} minDecimals={min} maxDecimals={max} className={className} {...rest}/>);
};
