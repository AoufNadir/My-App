import { Fragment, useState, type ReactNode } from 'react';
import { AlertTriangleIcon } from '../icons/AlertTriangleIcon';
import { CheckIcon } from '../icons/CheckIcon';
import { ChevronRightIcon } from '../icons/ChevronRightIcon';
import { InfoIcon } from '../icons/InfoIcon';
import { XIcon } from '../icons/XIcon';
export type AlertTone = 'danger' | 'warning' | 'info' | 'success';
const ALERT_TONE_CLASS: Record<AlertTone, {
    box: string;
    icon: string;
}> = {
    danger: { box: 'border-danger/25 bg-financial-loss-bg', icon: 'text-financial-loss' },
    warning: { box: 'border-warning/30 bg-financial-debt-bg', icon: 'text-financial-debt' },
    info: { box: 'border-info/25 bg-financial-asset-bg', icon: 'text-financial-asset' },
    success: { box: 'border-success/25 bg-financial-profit-bg', icon: 'text-financial-profit' },
};
function defaultAlertIcon(tone: AlertTone) {
    if (tone === 'info')
        return <InfoIcon className="h-5 w-5"/>;
    if (tone === 'success')
        return <CheckIcon className="h-5 w-5"/>;
    return <AlertTriangleIcon className="h-5 w-5"/>;
}
export type AlertCardProps = {
    tone: AlertTone;
    title: ReactNode;
    detail?: ReactNode;
    /** Icône de 20px ; par défaut selon le ton */
    icon?: ReactNode;
    /** Toute la carte devient un bouton */
    onAction?: () => void;
    actionLabel?: string;
    onDismiss?: () => void;
    dismissLabel?: string;
    /** Boutons sous le texte */
    footer?: ReactNode;
};
/**
 * Alerte unique : icône, titre, détail, une action. Le titre reste en couleur de texte
 * pour un contraste suffisant ; seule l'icône et le fond portent la couleur du ton.
 */
function AlertCard({ tone, title, detail, icon, onAction, actionLabel, onDismiss, dismissLabel, footer }: AlertCardProps) {
    const toneClass = ALERT_TONE_CLASS[tone];
    const content = (<>
      <span aria-hidden="true" className={`mt-px shrink-0 ${toneClass.icon}`}>{icon ?? defaultAlertIcon(tone)}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-bold leading-snug text-neutral-900">{title}</span>
        {detail && <span className="mt-0.5 block text-xs leading-relaxed text-neutral-700">{detail}</span>}
      </span>
      {onAction && actionLabel && (<span className="inline-flex min-h-7 shrink-0 items-center gap-0.5 rounded-full border border-border bg-surface pe-1.5 ps-2.5 text-xs font-bold text-neutral-800">
          {actionLabel}
          <ChevronRightIcon aria-hidden="true" className="h-3.5 w-3.5 rtl:-scale-x-100"/>
        </span>)}
    </>);
    const mainClass = 'flex min-w-0 flex-1 items-start gap-3 p-3 text-start';
    return (<div className={`rounded-card border ${toneClass.box}`}>
      <div className="flex items-start">
        {onAction
            ? (<button type="button" onClick={onAction} className={`${mainClass} min-h-touch rounded-card transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary`}>
              {content}
            </button>)
            : <div className={mainClass}>{content}</div>}
        {onDismiss && (<button type="button" onClick={onDismiss} aria-label={dismissLabel} className="me-1 mt-1 flex h-touch w-touch shrink-0 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-surface/70 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <XIcon aria-hidden="true" className="h-4 w-4"/>
          </button>)}
      </div>
      {footer && <div className="flex flex-wrap items-center gap-2 px-3 pb-3 ps-11">{footer}</div>}
    </div>);
}
AlertCard.displayName = 'AlertCard';
export type AlertStackItem = {
    id: string;
    element: ReactNode;
};
export type AlertStackProps = {
    items: ReadonlyArray<AlertStackItem>;
    /** Alertes visibles avant « voir les autres » */
    maxVisible?: number;
    moreLabel: (hiddenCount: number) => string;
    lessLabel: string;
    className?: string;
};
/** Pile d'alertes en haut d'une page : les plus importantes d'abord, les autres repliées. */
function AlertStack({ items, maxVisible = 2, moreLabel, lessLabel, className = '' }: AlertStackProps) {
    const [expanded, setExpanded] = useState(false);
    if (items.length === 0)
        return null;
    const canCollapse = items.length > maxVisible;
    const visible = expanded || !canCollapse ? items : items.slice(0, maxVisible);
    return (<div className={['flex flex-col gap-2', className].filter(Boolean).join(' ')}>
      {visible.map((item) => <Fragment key={item.id}>{item.element}</Fragment>)}
      {canCollapse && (<button type="button" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)} className="inline-flex min-h-9 items-center self-start rounded-button px-3 text-xs font-bold text-neutral-600 transition-colors hover:bg-surface-muted hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          {expanded ? lessLabel : moreLabel(items.length - maxVisible)}
        </button>)}
    </div>);
}
AlertStack.displayName = 'AlertStack';
export { AlertCard, AlertStack };
