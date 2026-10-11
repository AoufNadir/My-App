import { Fragment, type ReactNode } from 'react';
import { ChevronRightIcon } from '../icons/ChevronRightIcon';
import {
    adjustmentReasonsFor,
    isRedirectReason,
    type AdjustmentAssetValue,
    type AdjustmentDirection,
    type AdjustmentReason,
} from '../../utils/movementReason';

type TranslateFn = (key: string) => unknown;

type AdjustmentReasonPickerProps = {
    t: TranslateFn;
    asset: AdjustmentAssetValue;
    direction: AdjustmentDirection;
    value: AdjustmentReason | '';
    onChange: (reason: AdjustmentReason) => void;
    /** A reason that already has a window of its own: the adjustment window gives way to it */
    onRedirect: (reason: AdjustmentReason) => void;
    /** False when an existing movement is being edited: it stays an adjustment, so only the reasons that keep it one are offered */
    allowRedirects?: boolean;
    /** The fields of the chosen reason (the client, or the reason in words), shown right under it */
    children?: ReactNode;
};

const text = (t: TranslateFn, key: string) => String(t(key));

/**
 * V7-2: the first question of the treasury adjustment window, « why this movement? ».
 * One card per reason offered for this wallet and direction; choosing a reason that has its own
 * window (a purchase, a transfer, an expense...) leaves this window for that one, so the movement
 * is recorded where it shows its effect. Nothing is saved here.
 */
export function AdjustmentReasonPicker({ t, asset, direction, value, onChange, onRedirect, allowRedirects = true, children }: AdjustmentReasonPickerProps) {
    const reasons = adjustmentReasonsFor(asset, direction).filter((reason) => allowRedirects || !isRedirectReason(reason));
    const title = text(t, 'movementReason.title');
    return (<div>
        <p className="text-sm font-bold leading-snug text-neutral-900">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-neutral-500">{text(t, 'movementReason.intro')}</p>
        <div role="radiogroup" aria-label={title} className="mt-3 space-y-2">
            {reasons.map((reason) => {
                const selected = value === reason;
                const redirect = isRedirectReason(reason);
                const key = reason === 'client' ? (direction === 'add' ? 'clientAdd' : 'clientSubtract') : reason;
                return (<Fragment key={reason}>
                    <button type="button" role="radio" aria-checked={selected} onClick={() => (redirect ? onRedirect(reason) : onChange(reason))} className={`flex min-h-touch w-full items-center gap-3 rounded-button border px-3 py-2.5 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${selected
                        ? 'border-primary bg-primary/10 text-neutral-900'
                        : 'border-border bg-surface text-neutral-700 hover:border-border-strong'}`}>
                        <span aria-hidden="true" className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${selected ? 'border-primary' : 'border-border-strong'}`}>
                            {selected && <span className="h-2 w-2 rounded-full bg-primary"/>}
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold leading-snug">{text(t, `movementReason.${key}.title`)}</span>
                            <span className="mt-0.5 block text-xs leading-snug text-neutral-500">{text(t, `movementReason.${key}.sub`)}</span>
                        </span>
                        {redirect && <ChevronRightIcon aria-hidden="true" className="h-4 w-4 shrink-0 text-neutral-400 rtl:-scale-x-100"/>}
                    </button>
                    {selected && children && <div className="space-y-3 px-1 pb-1 pt-1">{children}</div>}
                </Fragment>);
            })}
        </div>
    </div>);
}
