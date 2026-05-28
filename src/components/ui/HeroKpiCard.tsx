import React from 'react';
import { CurrencyAmount, type AmountSemantic, type CurrencyCode } from '../financial/CurrencyAmount';
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
}
const ACCENT_BG: Record<string, string> = {
    indigo: 'from-primary/15 via-transparent',
    teal: 'from-secondary/15 via-transparent',
    sky: 'from-primary/15 via-transparent',
    emerald: 'from-success/15 via-transparent',
    purple: 'from-secondary/15 via-transparent',
    amber: 'from-warning/15 via-transparent',
};
const ACCENT_RING: Record<string, string> = {
    indigo: 'ring-primary/15',
    teal: 'ring-secondary/15',
    sky: 'ring-primary/15',
    emerald: 'ring-success/15',
    purple: 'ring-secondary/15',
    amber: 'ring-warning/15',
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
export const HeroKpiCard: React.FC<HeroKpiCardProps> = ({ primaryLabel, primaryValue, primaryCurrency, primarySemantic, trendPct, secondary, className = '', icon, accent = 'indigo', }) => {
    const secondaryGridClass = secondary && secondary.length >= 4
        ? 'grid-cols-2 sm:grid-cols-4'
        : secondary && secondary.length >= 3
            ? 'grid-cols-3'
            : 'grid-cols-2';
    return (<section className={[
            'relative overflow-hidden rounded-2xl ring-1 ring-neutral-200 p-4 sm:p-5',
            'bg-surface text-neutral-900',
            ACCENT_RING[accent] ?? '',
            className
        ]
            .filter(Boolean)
            .join(' ')} aria-label={primaryLabel}>
      <div className={`absolute inset-0 -z-10 bg-gradient-to-br to-transparent ${ACCENT_BG[accent] ?? ''}`}/>

      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase font-semibold text-neutral-500">
            {primaryLabel}
          </p>
          <div className="mt-2 flex items-baseline gap-2 flex-wrap">
            <CurrencyAmount value={primaryValue} currency={primaryCurrency} semantic={primarySemantic ?? 'plain'} size="hero" decimals={0}/>
            {typeof trendPct === 'number' && Number.isFinite(trendPct) && (<TrendBadge pct={trendPct}/>)}
          </div>
        </div>
        {icon && (<div className="shrink-0 h-10 w-10 rounded-xl flex items-center justify-center bg-neutral-100 text-neutral-600">
            {icon}
          </div>)}
      </header>

      {secondary && secondary.length > 0 && (<dl className={`mt-4 grid gap-3 ${secondaryGridClass}`}>
          {secondary.map((item, idx) => (<div key={`${item.label}-${idx}`} className="min-w-0">
              <dt className="text-[11px] truncate text-neutral-500">{item.label}</dt>
              <dd className="mt-1 flex items-baseline gap-1.5 flex-wrap">
                {item.display ? (item.display) : (<CurrencyAmount value={item.value} currency={item.currency} semantic={item.semantic ?? 'plain'} size="lg" decimals={0}/>)}
                {typeof item.trendPct === 'number' && Number.isFinite(item.trendPct) && (<TrendBadge pct={item.trendPct}/>)}
              </dd>
            </div>))}
        </dl>)}
    </section>);
};
