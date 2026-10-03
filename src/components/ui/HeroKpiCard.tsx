import React from 'react';
import { CurrencyAmount, type AmountSemantic, type CurrencyCode } from '../financial/CurrencyAmount';
import { CARD_TONE_CLASS, type CardTone } from '../cards/tones';
export interface HeroKpiSecondary {
    label: string;
    value: number;
    currency?: CurrencyCode | null;
    semantic?: AmountSemantic;
    trendPct?: number;
    display?: React.ReactNode;
}
export interface HeroKpiCardProps {
    primaryLabel: string;
    primaryValue: number;
    primaryCurrency?: CurrencyCode | null;
    primarySemantic?: AmountSemantic;
    trendPct?: number;
    secondary?: HeroKpiSecondary[];
    className?: string;
    icon?: React.ReactNode;
    accent?: 'indigo' | 'teal' | 'sky' | 'emerald' | 'purple' | 'amber';
    /** Under the figures, e.g. how the main figure is calculated */
    footer?: React.ReactNode;
}
/** Colour of the icon disc, same family as the Accueil cards. */
const ACCENT_TONE: Record<NonNullable<HeroKpiCardProps['accent']>, CardTone> = {
    indigo: 'primary',
    teal: 'dzd',
    sky: 'primary',
    emerald: 'profit',
    purple: 'dzd',
    amber: 'debt',
};
const TrendBadge: React.FC<{
    pct: number;
}> = ({ pct }) => {
    const isPositive = pct >= 0;
    return (<span className={[
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold',
            isPositive ? 'bg-success-bg text-financial-profit' : 'bg-danger-bg text-financial-loss'
        ].join(' ')}>
      <span>{isPositive ? '▲' : '▼'}</span>
      <span>{Math.abs(pct).toFixed(2)}%</span>
    </span>);
};
/**
 * Main figure of a page, drawn like the Accueil hero: flat card, label, big amount,
 * then the secondary figures under a thin line. Same props and same amounts as before.
 */
export const HeroKpiCard: React.FC<HeroKpiCardProps> = ({ primaryLabel, primaryValue, primaryCurrency, primarySemantic, trendPct, secondary, className = '', icon, accent = 'indigo', footer, }) => {
    const secondaryGridClass = secondary && secondary.length >= 4
        ? 'grid-cols-2 sm:grid-cols-4'
        : secondary && secondary.length >= 3
            ? 'grid-cols-3'
            : 'grid-cols-2';
    return (<section className={[
            'flex flex-col gap-3 rounded-card border border-border bg-surface p-4 text-neutral-900',
            className
        ]
            .filter(Boolean)
            .join(' ')} aria-label={primaryLabel}>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-neutral-500">
            {primaryLabel}
          </p>
          <div className="mt-1 flex items-baseline gap-2 flex-wrap">
            <CurrencyAmount value={primaryValue} currency={primaryCurrency} semantic={primarySemantic ?? 'plain'} size="hero" decimals={0}/>
            {typeof trendPct === 'number' && Number.isFinite(trendPct) && (<TrendBadge pct={trendPct}/>)}
          </div>
        </div>
        {icon && (<div aria-hidden="true" className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${CARD_TONE_CLASS[ACCENT_TONE[accent] ?? 'primary']}`}>
            {icon}
          </div>)}
      </header>

      {secondary && secondary.length > 0 && (<dl className={`grid gap-3 border-t border-border pt-3 ${secondaryGridClass}`}>
          {secondary.map((item, idx) => (<div key={`${item.label}-${idx}`} className="min-w-0">
              <dt className="line-clamp-2 break-words text-xs font-semibold leading-snug text-neutral-500">{item.label}</dt>
              <dd className="mt-1 flex items-baseline gap-1.5 flex-wrap">
                {item.display ? (item.display) : (<CurrencyAmount value={item.value} currency={item.currency} semantic={item.semantic ?? 'plain'} size="lg" decimals={0}/>)}
                {typeof item.trendPct === 'number' && Number.isFinite(item.trendPct) && (<TrendBadge pct={item.trendPct}/>)}
              </dd>
            </div>))}
        </dl>)}
      {footer}
    </section>);
};
