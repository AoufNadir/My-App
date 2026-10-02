import React from 'react';
import { PencilIcon } from '../icons/PencilIcon';
import { CurrencyAmount, type CurrencyCode, type AmountSemantic } from '../financial/CurrencyAmount';
import { CARD_TONE_CLASS, type CardTone } from '../cards/tones';
import { useLanguage } from '../../contexts/LanguageContext';
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
/** Icon disc colour, same family as the Accueil tiles. */
const TONE: Record<NonNullable<FinancialMetricCardProps['tone']>, CardTone> = {
    neutral: 'neutral',
    stock: 'asset',
    cash: 'profit',
    debt: 'loss',
    profit: 'profit',
    investor: 'dzd',
    report: 'debt',
};
/** A figure tile drawn like the Accueil tiles (flat, label then amount). Same props and amounts as before. */
export function FinancialMetricCard({ label, value, currency = 'DZD', semantic = 'plain', icon, hint, meta, valueDisplay, tone = 'neutral', onEdit, onClick, className = '' }: FinancialMetricCardProps) {
    const { t } = useLanguage();
    return (<div role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined} onClick={onClick} onKeyDown={(event) => {
            if (!onClick) return;
            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onClick(); }
        }} className={`relative min-w-0 rounded-card border border-border bg-surface px-3 py-2.5 text-neutral-900 transition-colors ${onClick ? 'cursor-pointer hover:border-border-strong' : ''} ${className}`}>
      <div className="flex min-h-touch items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1.5">
            {icon && (<span aria-hidden="true" className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${CARD_TONE_CLASS[TONE[tone]]}`}>{icon}</span>)}
            <p className="min-w-0 truncate text-xs font-semibold text-neutral-500">{label}</p>
          </div>
          <div className="mt-1.5">
            {valueDisplay ?? <CurrencyAmount value={value} currency={currency ?? undefined} semantic={semantic} size="lg"/>}
          </div>
        </div>
        {onEdit && (<button type="button" onClick={(event) => { event.stopPropagation(); onEdit(); }} className="-me-1.5 -mt-1 flex h-touch w-touch shrink-0 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-surface-muted hover:text-neutral-900" aria-label={`${t('common.edit')} ${label}`}>
            <PencilIcon className="h-4 w-4"/>
          </button>)}
      </div>
      {hint && <p className="mt-1 text-xs text-neutral-500">{hint}</p>}
      {meta && <div className="mt-3">{meta}</div>}
    </div>);
}
