import React from 'react';
import { CurrencyAmount } from './CurrencyAmount';
import type { CurrencyCode, AmountSize } from './CurrencyAmount';
export type ProfitLossDisplayProps = Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'> & {
    value: number;
    currency?: CurrencyCode | null;
    size?: AmountSize;
    /** إظهار السهم ↑↓ — افتراضي true */
    showArrow?: boolean;
    /** إظهار علامة + للأرباح */
    showSign?: boolean;
    /** وضع البطاقة: يضيف خلفية ملوّنة خفيفة */
    pill?: boolean;
};
const ArrowUp = () => (<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="inline-block h-[1em] w-[1em] align-middle">
    <path fillRule="evenodd" d="M10 17a.75.75 0 0 1-.75-.75V5.612L5.29 9.77a.75.75 0 0 1-1.08-1.04l5.25-5.5a.75.75 0 0 1 1.08 0l5.25 5.5a.75.75 0 1 1-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0 1 10 17Z" clipRule="evenodd"/>
  </svg>);
const ArrowDown = () => (<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="inline-block h-[1em] w-[1em] align-middle">
    <path fillRule="evenodd" d="M10 3a.75.75 0 0 1 .75.75v10.638l3.96-4.158a.75.75 0 1 1 1.08 1.04l-5.25 5.5a.75.75 0 0 1-1.08 0l-5.25-5.5a.75.75 0 1 1 1.08-1.04l3.96 4.158V3.75A.75.75 0 0 1 10 3Z" clipRule="evenodd"/>
  </svg>);
/**
 * عرض ربح أو خسارة مع سهم اتجاه ولون دلالي.
 *
 *  value > 0  → أخضر + سهم ↑
 *  value < 0  → أحمر  + سهم ↓
 *  value = 0  → رمادي + بدون سهم
 */
const ProfitLossDisplay: React.FC<ProfitLossDisplayProps> = ({ value, currency, size = 'md', showArrow = true, showSign = true, pill = false, className = '', ...rest }) => {
    const safe = Number.isFinite(value) ? value : 0;
    const isProfit = safe > 0;
    const isLoss = safe < 0;
    const isZero = safe === 0;
    const colorClass = isProfit
        ? 'text-financial-profit'
        : isLoss
            ? 'text-financial-loss'
            : 'text-neutral-400';
    const pillClass = pill
        ? isProfit
            ? 'bg-financial-profit-bg rounded-full px-2 py-0.5'
            : isLoss
                ? 'bg-financial-loss-bg rounded-full px-2 py-0.5'
                : 'bg-neutral-100 rounded-full px-2 py-0.5'
        : '';
    return (<span className={[
            'inline-flex items-center gap-0.5',
            colorClass,
            pillClass,
            className
        ]
            .filter(Boolean)
            .join(' ')} {...rest}>
      {showArrow && !isZero && (<span className="shrink-0">
          {isProfit ? <ArrowUp /> : <ArrowDown />}
        </span>)}
      <CurrencyAmount value={safe} currency={currency} semantic={isProfit ? 'profit' : isLoss ? 'loss' : 'plain'} size={size} showSign={showSign} className="text-inherit"/>
    </span>);
};
ProfitLossDisplay.displayName = 'ProfitLossDisplay';
export { ProfitLossDisplay };
