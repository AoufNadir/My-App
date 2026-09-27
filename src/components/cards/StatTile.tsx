import type { ReactNode } from 'react';
import { CurrencyAmount, type AmountSemantic, type CurrencyCode } from '../financial/CurrencyAmount';
import { CARD_TONE_CLASS, type CardTone } from './tones';
export type StatTileProps = {
    label: string;
    value: number;
    currency?: CurrencyCode | null;
    decimals?: number;
    semantic?: AmountSemantic;
    icon?: ReactNode;
    tone?: CardTone;
};
/** Petit carré : une étiquette et un montant (soldes, stocks). */
function StatTile({ label, value, currency = 'DZD', decimals = 0, semantic = 'plain', icon, tone = 'neutral' }: StatTileProps) {
    return (<div className="min-w-0 rounded-card border border-border bg-surface px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-1.5">
        {icon && (<span aria-hidden="true" className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${CARD_TONE_CLASS[tone]}`}>
            {icon}
          </span>)}
        <span className="min-w-0 truncate text-xs font-semibold text-neutral-500">{label}</span>
      </div>
      <div className="mt-1.5">
        <CurrencyAmount value={value} currency={currency} semantic={semantic} size="lg" decimals={decimals}/>
      </div>
    </div>);
}
StatTile.displayName = 'StatTile';
/** 2 colonnes sur mobile, 4 à partir de 640px. */
function StatTileGrid({ children, className = '' }: {
    children: ReactNode;
    className?: string;
}) {
    return <div className={['grid grid-cols-2 gap-2 sm:grid-cols-4', className].filter(Boolean).join(' ')}>{children}</div>;
}
StatTileGrid.displayName = 'StatTileGrid';
export { StatTile, StatTileGrid };
