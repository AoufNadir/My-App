import type { ReactNode } from 'react';
import { PencilIcon } from '../icons/PencilIcon';
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
    /** Le carré devient un bouton de modification (crayon), ex. corriger un solde */
    onEdit?: () => void;
    editLabel?: string;
    /** Valeur écrite autrement qu'en montant, ex. un pourcentage ou un jour */
    display?: ReactNode;
    /** Petite ligne sous la valeur, ex. l'évolution sur le mois précédent */
    hint?: ReactNode;
};
/** Petit carré : une étiquette et un montant (soldes, stocks). */
function StatTile({ label, value, currency = 'DZD', decimals = 0, semantic = 'plain', icon, tone = 'neutral', onEdit, editLabel, display, hint }: StatTileProps) {
    const content = (<>
      <span className="flex min-w-0 items-center gap-1.5">
        {icon && (<span aria-hidden="true" className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${CARD_TONE_CLASS[tone]}`}>
            {icon}
          </span>)}
        <span className="line-clamp-2 min-w-0 flex-1 break-words text-xs font-semibold text-neutral-500">{label}</span>
        {onEdit && <PencilIcon aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-neutral-400"/>}
      </span>
      <span className="mt-1.5 block">
        {display ?? <CurrencyAmount value={value} currency={currency} semantic={semantic} size="lg" decimals={decimals}/>}
      </span>
      {hint && <span className="mt-0.5 block text-xs text-neutral-500">{hint}</span>}
    </>);
    const tileClass = 'block w-full min-w-0 rounded-card border border-border bg-surface px-3 py-2.5 text-start';
    return onEdit
        ? (<button type="button" onClick={onEdit} aria-label={editLabel ? `${editLabel} : ${label}` : label} className={`${tileClass} min-h-touch transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary`}>
          {content}
        </button>)
        : <div className={tileClass}>{content}</div>;
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
