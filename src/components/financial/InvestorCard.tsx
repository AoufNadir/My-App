import React from 'react';
import { CurrencyAmount } from './CurrencyAmount';
import { ProfitLossDisplay } from './ProfitLossDisplay';
import type { CurrencyCode } from './CurrencyAmount';
import { Badge } from '../ui/Badge';
export type InvestorCardProps = {
    name: string;
    /** نسبة الملكية من الصندوق */
    sharePercent?: number;
    /** رأس المال المُودَع */
    capital: number;
    capitalCurrency?: CurrencyCode;
    /** الربح / الخسارة الصافية */
    profit?: number;
    profitCurrency?: CurrencyCode;
    /** حالة المستثمر (نشط، منتهي…) */
    tag?: string;
    tagVariant?: 'success' | 'neutral' | 'danger' | 'warning' | 'primary';
    onClick?: () => void;
    className?: string;
};
const InvestorIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
    <path d="M11.25 4.533A9.707 9.707 0 0 0 6 3a9.735 9.735 0 0 0-3.25.555.75.75 0 0 0-.5.707v14.25a.75.75 0 0 0 1 .707A8.237 8.237 0 0 1 6 18.75c1.995 0 3.823.707 5.25 1.886V4.533ZM12.75 20.636A8.214 8.214 0 0 1 18 18.75c.966 0 1.89.166 2.75.47a.75.75 0 0 0 1-.707V4.262a.75.75 0 0 0-.5-.707A9.735 9.735 0 0 0 18 3a9.707 9.707 0 0 0-5.25 1.533v16.103Z"/>
  </svg>);
const InvestorCard: React.FC<InvestorCardProps> = ({ name, sharePercent, capital, capitalCurrency = 'DZD', profit, profitCurrency, tag, tagVariant = 'success', onClick, className = '', }) => (<div role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined} onClick={onClick} onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined} className={[
        'min-h-touch rounded-lg border border-border bg-surface px-4 py-3',
        onClick
            ? 'cursor-pointer hover:border-border-strong hover:shadow-card active:bg-neutral-50 transition-all'
            : '',
        className
    ]
        .filter(Boolean)
        .join(' ')}>
    {/* الصف الأول — أيقونة + اسم + شارة */}
    <div className="flex items-center gap-3 mb-3">
      <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-full bg-secondary/10 text-secondary">
        <InvestorIcon />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-neutral-900 truncate">
            {name}
          </span>
          {tag && <Badge variant={tagVariant} size="sm">{tag}</Badge>}
        </div>
        {sharePercent !== undefined && (<span className="text-xs text-neutral-400">
            حصة{' '}
            <span className="tabular-nums font-medium text-neutral-600" dir="ltr">
              {sharePercent.toFixed(1)}%
            </span>
          </span>)}
      </div>
    </div>

    {/* الصف الثاني — رأس المال + الربح */}
    <div className="grid grid-cols-2 gap-3 border-t border-neutral-100 pt-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">
          رأس المال
        </span>
        <CurrencyAmount value={capital} currency={capitalCurrency} size="md"/>
      </div>

      {profit !== undefined && (<div className="flex flex-col gap-0.5 items-end">
          <span className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">
            الربح / الخسارة
          </span>
          <ProfitLossDisplay value={profit} currency={profitCurrency ?? capitalCurrency} size="md" showSign/>
        </div>)}
    </div>
  </div>);
InvestorCard.displayName = 'InvestorCard';
export { InvestorCard };
