import React from 'react';
export type CurrencyCode = 'DZD' | 'EUR' | 'USDT' | 'USD';
export interface CurrencyBadgeProps {
    currency: CurrencyCode;
    className?: string;
}
const TONE: Record<CurrencyCode, string> = {
    DZD: 'bg-secondary/10 text-financial-dzd ring-secondary/20',
    EUR: 'bg-financial-asset-bg text-financial-eur ring-primary/20',
    USDT: 'bg-financial-profit-bg text-financial-usd ring-success/20',
    USD: 'bg-warning-bg text-warning ring-warning/20',
};
export const CurrencyBadge: React.FC<CurrencyBadgeProps> = ({ currency, className = '' }) => (<span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 ring-inset ${TONE[currency]} ${className}`}>
    {currency}
  </span>);
