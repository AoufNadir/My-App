import { useId, type ReactNode } from 'react';
export type FormCardProps = {
    title?: ReactNode;
    description?: ReactNode;
    /** Petit texte en face du titre, ex. « Optionnel » */
    aside?: ReactNode;
    children: ReactNode;
    className?: string;
};
/**
 * Groupe de champs d'une fenêtre de saisie : la même carte blanche que sur les pages, posée sur le
 * fond gris de la fenêtre. Pas d'overflow caché, pour que la liste d'un sélecteur de client déborde.
 */
function FormCard({ title, description, aside, children, className = '' }: FormCardProps) {
    const titleId = useId();
    return (<section aria-labelledby={title ? titleId : undefined} className={['rounded-card border border-border bg-surface', className].filter(Boolean).join(' ')}>
      {title && (<div className="flex items-start justify-between gap-3 px-4 pt-3.5">
          <div className="min-w-0">
            <h3 id={titleId} className="text-sm font-bold leading-snug text-neutral-900">{title}</h3>
            {description && <p className="mt-0.5 text-xs leading-relaxed text-neutral-500">{description}</p>}
          </div>
          {aside && <span className="shrink-0 pt-0.5 text-xs font-semibold text-neutral-500">{aside}</span>}
        </div>)}
      <div className={`space-y-3 px-4 pb-4 ${title ? 'pt-3' : 'pt-4'}`}>{children}</div>
    </section>);
}
FormCard.displayName = 'FormCard';
export { FormCard };
