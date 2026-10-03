import type { ReactNode } from 'react';
import { ChevronRightIcon } from '../icons/ChevronRightIcon';
import { CARD_TONE_CLASS, type CardTone } from './tones';
export type ListRowProps = {
    title: ReactNode;
    subtitle?: ReactNode;
    /** Pastille d'icône en début de ligne */
    icon?: ReactNode;
    tone?: CardTone;
    /** Montant ou badge en fin de ligne */
    trailing?: ReactNode;
    onClick?: () => void;
    /** Action indisponible : bouton désactivé (grisé), annoncé comme tel aux lecteurs d'écran */
    disabled?: boolean;
    /** Sous-titre en entier sur plusieurs lignes (ex. notes), au lieu d'être coupé */
    wrapSubtitle?: boolean;
    /** Ligne seule avec bord et coins arrondis ; sinon ligne dans une carte */
    standalone?: boolean;
    className?: string;
};
/** Ligne de liste : icône, titre, sous-titre, fin de ligne, et flèche si elle ouvre quelque chose. */
function ListRow({ title, subtitle, icon, tone = 'neutral', trailing, onClick, disabled = false, wrapSubtitle = false, standalone = false, className = '' }: ListRowProps) {
    const content = (<>
      {icon && (<span aria-hidden="true" className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${CARD_TONE_CLASS[tone]}`}>
          {icon}
        </span>)}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-neutral-900">{title}</span>
        {subtitle && <span className={`mt-0.5 block text-xs text-neutral-500 ${wrapSubtitle ? 'whitespace-pre-line break-words' : 'truncate'}`}>{subtitle}</span>}
      </span>
      {trailing && <span className="shrink-0 text-end">{trailing}</span>}
      {onClick && !disabled && <ChevronRightIcon aria-hidden="true" className="h-5 w-5 shrink-0 text-neutral-400 rtl:-scale-x-100"/>}
    </>);
    const rowClass = [
        'flex min-h-14 w-full items-center gap-3 px-4 py-3 text-start',
        standalone ? 'rounded-card border border-border bg-surface' : 'border-t border-border first:border-t-0',
        disabled ? 'cursor-not-allowed opacity-60' : onClick ? 'transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary' : '',
        className
    ]
        .filter(Boolean)
        .join(' ');
    if (disabled)
        return <button type="button" disabled className={rowClass}>{content}</button>;
    return onClick
        ? <button type="button" onClick={onClick} className={rowClass}>{content}</button>
        : <div className={rowClass}>{content}</div>;
}
ListRow.displayName = 'ListRow';
export { ListRow };
