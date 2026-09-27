import { useId, type ReactNode } from 'react';
import { CurrencyAmount, type AmountSemantic, type CurrencyCode } from '../financial/CurrencyAmount';
export type HeroCardSecondary = {
    label: ReactNode;
    hint?: ReactNode;
    value: number;
    currency?: CurrencyCode | null;
    decimals?: number;
    semantic?: AmountSemantic;
};
export type HeroCardProps = {
    label: ReactNode;
    value: number;
    currency?: CurrencyCode | null;
    decimals?: number;
    semantic?: AmountSemantic;
    /** Au-dessus du chiffre, ex. le choix de période */
    top?: ReactNode;
    /** Une seule ligne sous le chiffre, séparée par un trait */
    secondary?: HeroCardSecondary;
    className?: string;
};
/**
 * Carte du chiffre principal d'une page : un grand montant, au plus une ligne secondaire.
 */
function HeroCard({ label, value, currency = 'DZD', decimals = 0, semantic = 'plain', top, secondary, className = '' }: HeroCardProps) {
    const labelId = useId();
    return (<section aria-labelledby={labelId} className={['flex flex-col gap-3 rounded-card border border-border bg-surface p-4', className]
            .filter(Boolean)
            .join(' ')}>
      {top}
      <div className="min-w-0">
        <p id={labelId} className="text-[13px] font-semibold text-neutral-500">{label}</p>
        <div className="mt-1">
          <CurrencyAmount value={value} currency={currency} semantic={semantic} size="hero" decimals={decimals}/>
        </div>
      </div>
      {secondary && (<div className="flex items-start justify-between gap-3 border-t border-border pt-3">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-neutral-700">{secondary.label}</p>
            {secondary.hint && <p className="mt-0.5 text-xs text-neutral-500">{secondary.hint}</p>}
          </div>
          <CurrencyAmount value={secondary.value} currency={secondary.currency === undefined ? currency : secondary.currency} semantic={secondary.semantic ?? 'auto'} size="lg" decimals={secondary.decimals ?? decimals} className="shrink-0"/>
        </div>)}
    </section>);
}
HeroCard.displayName = 'HeroCard';
export { HeroCard };
