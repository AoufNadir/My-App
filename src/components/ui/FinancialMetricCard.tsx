import React from 'react';
import { PencilIcon } from '../icons/PencilIcon';
import { CurrencyAmount, type CurrencyCode, type AmountSemantic } from '../financial/CurrencyAmount';
type FinancialMetricCardProps = {
    label: string;
    value: number;
    currency?: CurrencyCode | null;
    semantic?: AmountSemantic;
    icon?: React.ReactNode;
    hint?: string;
    meta?: React.ReactNode;
    valueDisplay?: React.ReactNode;
    tone?: 'neutral' | 'stock' | 'cash' | 'debt' | 'profit' | 'investor' | 'report';
    onEdit?: () => void;
    onClick?: () => void;
    className?: string;
    key?: React.Key | null;
};
const toneClasses = {
    neutral: { icon: 'text-neutral-500', bg: 'bg-neutral-100', ring: 'ring-neutral-200' },
    stock:   { icon: 'text-financial-asset', bg: 'bg-financial-asset-bg', ring: 'ring-primary/15' },
    cash:    { icon: 'text-financial-profit', bg: 'bg-financial-profit-bg', ring: 'ring-success/15' },
    debt:    { icon: 'text-financial-loss', bg: 'bg-financial-loss-bg', ring: 'ring-danger/15' },
    profit:  { icon: 'text-financial-profit', bg: 'bg-financial-profit-bg', ring: 'ring-success/15' },
    investor:{ icon: 'text-secondary', bg: 'bg-secondary/10', ring: 'ring-secondary/15' },
    report:  { icon: 'text-warning', bg: 'bg-warning-bg', ring: 'ring-warning/15' }
};
export function FinancialMetricCard({ label, value, currency = 'DZD', semantic = 'plain', icon, hint, meta, valueDisplay, tone = 'neutral', onEdit, onClick, className = '' }: FinancialMetricCardProps) {
    const toneClass = toneClasses[tone];
    return (<div role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined} onClick={onClick} onKeyDown={(event) => {
            if (!onClick) return;
            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onClick(); }
        }} className={`group relative min-h-touch rounded-xl border p-3 shadow-card ring-1 transition-all border-border bg-surface text-neutral-900 ${toneClass.ring} ${onClick ? 'cursor-pointer hover:-translate-y-0.5' : ''} ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-bold uppercase text-neutral-500">{label}</p>
          <div className="mt-1">
            {valueDisplay ?? <CurrencyAmount value={value} currency={currency ?? undefined} semantic={semantic} size="lg"/>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {onEdit && (<button type="button" onClick={(event) => { event.stopPropagation(); onEdit(); }} className="flex h-touch w-touch items-center justify-center rounded-lg bg-neutral-100 text-neutral-600 transition-colors hover:bg-neutral-200" aria-label={`Modifier ${label}`}>
              <PencilIcon className="h-4 w-4"/>
            </button>)}
          {icon && (<div className={`flex h-9 w-9 items-center justify-center rounded-lg ${toneClass.bg} ${toneClass.icon}`}>{icon}</div>)}
        </div>
      </div>
      {hint && <p className="mt-2 text-xs text-neutral-500">{hint}</p>}
      {meta && <div className="mt-3">{meta}</div>}
    </div>);
}
