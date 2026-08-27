import React from 'react';
import { CurrencyAmount } from './CurrencyAmount';
import type { CurrencyCode } from './CurrencyAmount';
import { StatusBadge } from '../ui/StatusBadge';
import type { TransactionStatus } from '../ui/StatusBadge';
export type TransactionType = 'buy' | 'sell';
export type TransactionRowProps = {
    date: string;
    type: TransactionType;
    /** المبلغ الرئيسي */
    amount: number;
    amountCurrency: CurrencyCode;
    /** المبلغ المقابل (الطرف الثاني من الصرف) */
    counterAmount?: number;
    counterCurrency?: CurrencyCode;
    /** اسم العميل أو وصف إضافي */
    label?: string;
    status?: TransactionStatus;
    statusLang?: 'ar' | 'fr';
    onClick?: () => void;
    className?: string;
};
const TYPE_CONFIG: Record<TransactionType, {
    label: string;
    bg: string;
    text: string;
}> = {
    buy: { label: 'شراء', bg: 'bg-primary/10', text: 'text-primary' },
    sell: { label: 'بيع', bg: 'bg-success-bg', text: 'text-financial-profit' },
};
const TransactionRow: React.FC<TransactionRowProps> = ({ date, type, amount, amountCurrency, counterAmount, counterCurrency, label, status, statusLang = 'ar', onClick, className = '', }) => {
    const typeConfig = TYPE_CONFIG[type];
    return (<div role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined} onClick={onClick} onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined} className={[
            'flex min-h-touch items-center gap-3 px-4 py-3 bg-surface',
            'border-b border-neutral-100 last:border-0',
            onClick ? 'cursor-pointer hover:bg-neutral-50 active:bg-neutral-100 transition-colors' : '',
            className
        ]
            .filter(Boolean)
            .join(' ')}>
      {/* نوع العملية */}
      <span className={[
            'shrink-0 inline-flex items-center justify-center',
            'rounded-full px-2.5 py-1 text-xs font-semibold',
            typeConfig.bg,
            typeConfig.text
        ].join(' ')}>
        {typeConfig.label}
      </span>

      {/* التفاصيل — منتصف */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {label && (<span className="truncate text-sm font-medium text-neutral-800">
            {label}
          </span>)}
        <span className="text-xs text-neutral-400">{date}</span>
      </div>

      {/* المبالغ + الحالة — جهة اليسار في RTL */}
      <div className="flex shrink-0 flex-col items-end gap-1">
        <CurrencyAmount value={amount} currency={amountCurrency} size="md"/>
        {counterAmount !== undefined && counterCurrency && (<CurrencyAmount value={counterAmount} currency={counterCurrency} size="sm" className="text-neutral-400"/>)}
        {status && (<StatusBadge status={status} lang={statusLang} size="sm"/>)}
      </div>
    </div>);
};
TransactionRow.displayName = 'TransactionRow';
export { TransactionRow };
