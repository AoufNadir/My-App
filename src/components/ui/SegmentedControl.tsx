import type { ReactNode } from 'react';
export type SegmentedOption<T extends string> = {
    id: T;
    label: ReactNode;
};
export type SegmentedControlProps<T extends string> = {
    options: ReadonlyArray<SegmentedOption<T>>;
    value: T;
    onChange: (id: T) => void;
    /** Nom lu par les lecteurs d'écran, ex. « Période » */
    ariaLabel: string;
    className?: string;
};
/**
 * Choix exclusif compact (ex. Jour / Semaine / Mois / Année).
 * Toutes les options restent sur une seule ligne, même à 360px.
 */
function SegmentedControl<T extends string>({ options, value, onChange, ariaLabel, className = '' }: SegmentedControlProps<T>) {
    return (<div role="group" aria-label={ariaLabel} className={[
            'grid auto-cols-fr grid-flow-col gap-0.5 rounded-button bg-surface-muted p-0.5',
            className
        ]
            .filter(Boolean)
            .join(' ')}>
      {options.map((option) => {
            const isActive = option.id === value;
            return (<button key={option.id} type="button" aria-pressed={isActive} onClick={() => onChange(option.id)} className={[
                    'min-h-9 min-w-0 truncate rounded-[10px] px-2 text-xs font-bold transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    isActive
                        ? 'bg-surface text-neutral-900 shadow-sm'
                        : 'text-neutral-600 hover:text-neutral-900'
                ].join(' ')}>
              {option.label}
            </button>);
        })}
    </div>);
}
SegmentedControl.displayName = 'SegmentedControl';
export { SegmentedControl };
