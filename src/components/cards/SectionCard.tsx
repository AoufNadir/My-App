import { useId, type ReactNode } from 'react';
import { ChevronRightIcon } from '../icons/ChevronRightIcon';
export type SectionCardProps = {
    title: ReactNode;
    /** Un seul lien dans l'en-tête, ex. « Voir tout » */
    actionLabel?: string;
    onAction?: () => void;
    /** Corps sans marge intérieure, pour une liste qui touche les bords */
    flush?: boolean;
    children: ReactNode;
    className?: string;
};
/** Carte de section : un titre, au plus une action, puis le contenu. */
function SectionCard({ title, actionLabel, onAction, flush = false, children, className = '' }: SectionCardProps) {
    const titleId = useId();
    return (<section aria-labelledby={titleId} className={['overflow-hidden rounded-card border border-border bg-surface', className]
            .filter(Boolean)
            .join(' ')}>
      <div className="flex min-h-12 items-center justify-between gap-2 pe-2 ps-4 pt-1">
        <h2 id={titleId} className="min-w-0 truncate text-sm font-bold text-neutral-900">{title}</h2>
        {actionLabel && onAction && (<button type="button" onClick={onAction} className="inline-flex min-h-9 shrink-0 items-center gap-0.5 rounded-button px-2 text-xs font-bold text-primary transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-primary-light">
            {actionLabel}
            <ChevronRightIcon aria-hidden="true" className="h-4 w-4 rtl:-scale-x-100"/>
          </button>)}
      </div>
      <div className={flush ? '' : 'px-4 pb-4'}>{children}</div>
    </section>);
}
SectionCard.displayName = 'SectionCard';
export { SectionCard };
