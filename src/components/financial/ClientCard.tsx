import React from 'react';
import { CurrencyAmount } from './CurrencyAmount';
import type { CurrencyCode } from './CurrencyAmount';
import { Badge } from '../ui/Badge';
export type ClientCardProps = {
    name: string;
    phone?: string;
    /** رصيد إيجابي أو مديونية */
    balanceAmount?: number;
    balanceCurrency?: CurrencyCode;
    /** عدد العمليات */
    transactionCount?: number;
    /** شارة اختيارية (مثل: VIP، عميل جديد…) */
    tag?: string;
    onClick?: () => void;
    className?: string;
};
// أيقونة المستخدم
const UserIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
    <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clipRule="evenodd"/>
  </svg>);
const ClientCard: React.FC<ClientCardProps> = ({ name, phone, balanceAmount, balanceCurrency, transactionCount, tag, onClick, className = '', }) => {
    const hasDebt = balanceAmount !== undefined && balanceAmount < 0;
    const hasCredit = balanceAmount !== undefined && balanceAmount > 0;
    const zeroBalance = balanceAmount !== undefined && balanceAmount === 0;
    return (<div role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined} onClick={onClick} onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined} className={[
            'flex min-h-touch items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3',
            onClick
                ? 'cursor-pointer hover:border-border-strong hover:shadow-card active:bg-neutral-50 transition-all'
                : '',
            className
        ]
            .filter(Boolean)
            .join(' ')}>
      {/* أيقونة */}
      <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
        <UserIcon />
      </div>

      {/* الاسم والهاتف */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-neutral-900">
            {name}
          </span>
          {tag && <Badge variant="primary" size="sm">{tag}</Badge>}
        </div>
        {phone && (<span className="text-xs text-neutral-400 tabular-nums" dir="ltr">
            {phone}
          </span>)}
      </div>

      {/* الرصيد + العمليات */}
      <div className="shrink-0 flex flex-col items-end gap-1">
        {balanceAmount !== undefined && (<CurrencyAmount value={Math.abs(balanceAmount)} currency={balanceCurrency} size="md" className={hasDebt
                ? 'text-financial-debt'
                : hasCredit
                    ? 'text-financial-profit'
                    : zeroBalance
                        ? 'text-neutral-400'
                        : ''}/>)}
        {balanceAmount !== undefined && (<span className={[
                'text-[10px] font-medium',
                hasDebt ? 'text-financial-debt' : '',
                hasCredit ? 'text-financial-profit' : '',
                zeroBalance ? 'text-neutral-400' : ''
            ].filter(Boolean).join(' ')}>
            {hasDebt ? 'دين' : hasCredit ? 'رصيد' : 'متعادل'}
          </span>)}
        {transactionCount !== undefined && (<span className="text-[10px] text-neutral-400">
            {transactionCount} عملية
          </span>)}
      </div>
    </div>);
};
ClientCard.displayName = 'ClientCard';
export { ClientCard };
