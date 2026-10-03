import type { ReactNode } from 'react';
/** Couleur du texte de l'option choisie, ex. vert pour Achat et rouge pour Vente. */
export type SegmentedTone = 'profit' | 'loss' | 'debt' | 'primary';
const TONE_TEXT: Record<SegmentedTone, string> = {
    profit: 'text-financial-profit',
    loss: 'text-financial-loss',
    debt: 'text-financial-debt',
    primary: 'text-primary dark:text-primary-light',
};
export type SegmentedOption<T extends string> = {
    id: T;
    label: ReactNode;
    tone?: SegmentedTone;
};
export type SegmentedControlProps<T extends string> = {
    options: ReadonlyArray<SegmentedOption<T>>;
    value: T;
    onChange: (id: T) => void;
    /** Nom lu par les lecteurs d'écran, ex. « Période » */
    ariaLabel: string;
    className?: string;
    /** « md » : options de 44px pour les fenêtres de saisie ; le texte passe à la ligne au lieu d'être coupé */
    size?: 'sm' | 'md';
    disabled?: boolean;
    /** Options sur plusieurs lignes (ex. 4 portefeuilles en 2 × 2) au lieu d'une seule ligne */
    columns?: 2 | 3;
};
const COLUMNS_CLASS = { 2: 'grid-cols-2', 3: 'grid-cols-3' } as const;
/**
 * Choix exclusif compact (ex. Jour / Semaine / Mois / Année).
 * Toutes les options restent sur une seule ligne, même à 360px.
 */
function SegmentedControl<T extends string>({ options, value, onChange, ariaLabel, className = '', size = 'sm', disabled = false, columns }: SegmentedControlProps<T>) {
    return (<div role="group" aria-label={ariaLabel} className={[
            columns ? `grid ${COLUMNS_CLASS[columns]} gap-0.5 rounded-button bg-surface-muted p-0.5` : 'grid auto-cols-fr grid-flow-col gap-0.5 rounded-button bg-surface-muted p-0.5',
            disabled ? 'cursor-not-allowed opacity-70' : '',
            className
        ]
            .filter(Boolean)
            .join(' ')}>
      {options.map((option) => {
            const isActive = option.id === value;
            return (<button key={option.id} type="button" aria-pressed={isActive} disabled={disabled} onClick={() => onChange(option.id)} className={[
                    size === 'md'
                        ? 'inline-flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-[10px] px-2 py-1 text-center text-sm font-bold leading-tight transition-colors disabled:cursor-not-allowed'
                        : 'min-h-9 min-w-0 truncate rounded-[10px] px-2 text-xs font-bold transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    isActive
                        ? `bg-surface shadow-sm ${option.tone ? TONE_TEXT[option.tone] : 'text-neutral-900'}`
                        : 'text-neutral-600 hover:text-neutral-900'
                ].join(' ')}>
              {option.label}
            </button>);
        })}
    </div>);
}
SegmentedControl.displayName = 'SegmentedControl';
export { SegmentedControl };
