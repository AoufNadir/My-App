import { Fragment, type ReactNode } from 'react';
import { AlertCircleIcon } from '../icons/AlertCircleIcon';
import { InfoIcon } from '../icons/InfoIcon';
export type OperationFooterStat = {
    label: ReactNode;
    /** Montant déjà formaté, lu de gauche à droite même en arabe */
    value: ReactNode;
    tone?: 'plain' | 'profit' | 'loss';
};
export type OperationFooterProps = {
    /** Le total (et le profit d'une vente), toujours visibles pendant le défilement */
    stats?: ReadonlyArray<OperationFooterStat>;
    /** Pourquoi le bouton principal est désactivé : ce qui manque, ou ce qu'il faut corriger */
    reason?: ReactNode;
    /** « fix » : une valeur saisie est à corriger ; « missing » : un champ reste à remplir */
    reasonTone?: 'missing' | 'fix';
    /** Les boutons : Annuler d'abord, l'action principale en dernier */
    children: ReactNode;
};
const STAT_TONE: Record<NonNullable<OperationFooterStat['tone']>, string> = {
    plain: 'text-neutral-900',
    profit: 'text-financial-profit',
    loss: 'text-financial-loss',
};
/**
 * Bas des grandes fenêtres de saisie (achat, vente, transferts…) : le même rang de boutons que
 * DialogFooter, avec au-dessus le total de l'opération et la raison pour laquelle on ne peut pas
 * encore confirmer. Reste visible pendant le défilement.
 */
function OperationFooter({ stats = [], reason, reasonTone = 'missing', children }: OperationFooterProps) {
    const single = stats.length === 1;
    return (<div className="sticky bottom-0 z-20 space-y-2.5 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur sm:px-5">
      {stats.length > 0 && (<dl className={single ? '' : 'grid grid-cols-2 gap-3'}>
          {stats.map((stat, index) => (<Fragment key={index}>
              <div className={single ? 'flex items-baseline justify-between gap-3' : 'min-w-0'}>
                <dt className="truncate text-xs font-semibold text-neutral-500">{stat.label}</dt>
                <dd className={`text-base font-extrabold tabular-nums ${STAT_TONE[stat.tone ?? 'plain']}`}><span dir="ltr">{stat.value}</span></dd>
              </div>
            </Fragment>))}
        </dl>)}
      {reason && (<p role="status" className={`flex items-start gap-1.5 text-xs font-semibold leading-snug ${reasonTone === 'fix' ? 'text-financial-loss' : 'text-neutral-600'}`}>
          {reasonTone === 'fix'
                ? <AlertCircleIcon aria-hidden="true" className="mt-px h-4 w-4 shrink-0"/>
                : <InfoIcon aria-hidden="true" className="mt-px h-4 w-4 shrink-0 text-financial-debt"/>}
          <span className="min-w-0">{reason}</span>
        </p>)}
      <div className="flex items-center gap-2 [&>*]:flex-1">{children}</div>
    </div>);
}
OperationFooter.displayName = 'OperationFooter';
export { OperationFooter };
