import React from 'react';
import { CheckIcon } from '../icons/CheckIcon';
import { AlertTriangleIcon } from '../icons/AlertTriangleIcon';
import { AlertCircleIcon } from '../icons/AlertCircleIcon';
import { InfoIcon } from '../icons/InfoIcon';
import { XIcon } from '../icons/XIcon';
import { RotateCcwIcon } from '../icons/RotateCcwIcon';
import { stripAlertEmoji, type AlertTone } from '../../utils/alertTone';
type AppToastProps = {
    message: string;
    tone: AlertTone;
    closeLabel: string;
    onClose: () => void;
    actionLabel?: string;
    onAction?: () => void;
};
// The toast is inverted against the page: dark in light mode, light in dark mode
// (the neutral scale flips in `.dark`), so the icon colors flip with it.
const ICONS: Record<AlertTone, React.ReactNode> = {
    success: <CheckIcon className="h-5 w-5 text-success-light dark:text-success"/>,
    error: <AlertCircleIcon className="h-5 w-5 text-danger-light dark:text-danger"/>,
    warning: <AlertTriangleIcon className="h-5 w-5 text-warning-light dark:text-warning"/>,
    info: <InfoIcon className="h-5 w-5 text-primary-light dark:text-primary-dark"/>,
};
/**
 * The app's one message line, shown above the bottom bar. It replaces the banner that
 * stayed at the top of every page: confirmations leave by themselves, errors wait for ✕.
 */
export function AppToast({ message, tone, closeLabel, onClose, actionLabel, onAction }: AppToastProps) {
    const needsAttention = tone === 'error' || tone === 'warning';
    const hasAction = Boolean(actionLabel && onAction);
    return (<div className="pointer-events-none fixed inset-x-0 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-[60] flex justify-center px-3 sm:bottom-6">
        <div role={needsAttention ? 'alert' : 'status'} className={`anim-toast-in pointer-events-auto flex w-full max-w-md items-center gap-2.5 rounded-2xl bg-neutral-900 py-1 ps-3.5 text-neutral-50 shadow-dialog dark:bg-neutral-700 ${needsAttention || hasAction ? 'pe-1' : 'pe-3.5'}`}>
          <span className="flex shrink-0">{ICONS[tone]}</span>
          <p className="min-w-0 flex-1 py-2.5 text-sm font-semibold leading-snug">{stripAlertEmoji(message)}</p>
          {hasAction && (<button type="button" onClick={onAction} className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-bold text-primary-light transition-colors hover:bg-white/10 dark:text-primary-dark dark:hover:bg-black/5">
              <RotateCcwIcon className="h-4 w-4 rtl:-scale-x-100"/>
              {actionLabel}
            </button>)}
          {needsAttention && (<button type="button" onClick={onClose} aria-label={closeLabel} title={closeLabel} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-neutral-300 transition-colors hover:bg-white/10 dark:text-neutral-100 dark:hover:bg-black/5">
              <XIcon className="h-4 w-4"/>
            </button>)}
        </div>
      </div>);
}
