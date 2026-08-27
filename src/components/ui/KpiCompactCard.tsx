import React from 'react';
import { CurrencyAmount, type CurrencyCode, type AmountSemantic } from '../financial/CurrencyAmount';
type KpiCompactCardProps = {
    label: string;
    value: number;
    currency?: CurrencyCode | null;
    semantic?: AmountSemantic;
    icon?: React.ReactNode;
    hint?: string;
    className?: string;
};
export function KpiCompactCard({ label, value, currency = 'DZD', semantic = 'plain', icon, hint, className = '' }: KpiCompactCardProps) {
    return (<div className={`rounded-xl border border-border bg-surface p-3 shadow-card ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold uppercase text-neutral-500">{label}</p>
          <div className="mt-1">
            <CurrencyAmount value={value} currency={currency ?? undefined} semantic={semantic} size="lg"/>
          </div>
        </div>
        {icon && (<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600">{icon}</div>)}
      </div>
      {hint && <p className="mt-2 text-xs text-neutral-500">{hint}</p>}
    </div>);
}
