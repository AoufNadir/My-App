import React from 'react';
import { formatNumber } from '../../pages/shared/pageFormat';
export type CurrencyCode = 'DZD' | 'EUR' | 'USDT' | 'USD';
export type AmountSemantic = 'profit' | 'loss' | 'neutral' | 'auto' | 'plain';
export type AmountSize = 'sm' | 'md' | 'lg' | 'xl' | 'hero';
export type CurrencyAmountProps = Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'> & {
    value: number;
    currency?: CurrencyCode | null;
    semantic?: AmountSemantic;
    size?: AmountSize;
    showSign?: boolean;
    /** Decimal places — default 2 */
    decimals?: number;
    minDecimals?: number;
    maxDecimals?: number;
};
const SIZE_CLASS: Record<AmountSize, string> = {
    sm: 'text-xs',
    md: 'text-sm  font-medium',
    lg: 'text-base font-semibold',
    xl: 'text-lg  font-bold',
    hero: 'text-3xl font-bold',
};
function getSemanticClass(semantic: string, value: number): string {
    switch (semantic) {
        case 'profit': return 'text-financial-profit';
        case 'loss': return 'text-financial-loss';
        case 'neutral': return 'text-secondary';
        case 'auto':
            if (value > 0)
                return 'text-financial-profit';
            if (value < 0)
                return 'text-financial-loss';
            return 'text-neutral-400';
        case 'plain':
        default:
            return '';
    }
}
/**
 * مكوّن عرض المبالغ المالية الموحّد.
 *
 * قواعد ثابتة:
 *  - الأرقام دائماً dir="ltr" حتى في الصفحات العربية
 *  - tabular-nums لاستقرار العرض عند التحديث
 *  - الألوان من financial tokens فقط
 */
const CurrencyAmount: React.FC<CurrencyAmountProps> = ({ value, currency, semantic = 'plain', size = 'md', showSign = false, decimals = 2, minDecimals, maxDecimals, className = '', ...rest }) => {
    const safe = Number.isFinite(value) ? value : 0;
    const sign = showSign && safe > 0 ? '+' : '';
    const formatted = formatNumber(safe, { min: minDecimals ?? decimals, max: maxDecimals ?? decimals });
    const colorClass = getSemanticClass(semantic, safe);
    return (<span className={[SIZE_CLASS[size], colorClass, 'tabular-nums', className]
            .filter(Boolean)
            .join(' ')} {...rest} dir="ltr">
      {/* dir="ltr" على المبلغ دائماً — حتى في الصفحات RTL */}
      <bdi dir="ltr">
        {sign}{formatted}
        {currency && (<span className="ms-1 text-[0.82em] opacity-65 font-normal">
            {currency}
          </span>)}
      </bdi>
    </span>);
};
CurrencyAmount.displayName = 'CurrencyAmount';
export { CurrencyAmount };
