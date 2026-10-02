import React, { useId, useRef } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { XIcon } from '../icons/XIcon';
import { inBody, useDialogLabel, useSheetDragDismiss } from './Dialog';
import { useOverlay } from './overlayStack';
export interface BottomSheetProps {
    isOpen: boolean;
    onClose: () => void;
    children?: React.ReactNode;
    className?: string;
    /** Title shown in the sticky header. Omit for header-less sheets. */
    title?: string;
    /** Disable drag-to-dismiss (default: enabled). */
    disableDrag?: boolean;
    /** Drag distance in px past which the sheet closes. */
    closeThreshold?: number;
}
/**
 * A bottom-anchored sheet meant for mobile contexts. Slides up from the
 * bottom edge, supports drag-to-dismiss via native pointer events (no
 * framer-motion dependency), and respects the safe-area inset.
 */
export const BottomSheet: React.FC<BottomSheetProps> = ({ isOpen, onClose, children, className = '', title, disableDrag = false, closeThreshold = 100 }) => {
    const { t } = useLanguage();
    const sheetRef = useRef<HTMLDivElement | null>(null);
    const handleRef = useRef<HTMLDivElement | null>(null);
    const titleId = useId();
    useOverlay(isOpen, onClose, sheetRef);
    useSheetDragDismiss(isOpen && !disableDrag, handleRef, sheetRef, onClose, closeThreshold);
    useDialogLabel(isOpen, sheetRef, titleId);
    if (!isOpen)
        return null;
    return inBody(<div onClick={onClose} className="anim-backdrop-in fixed inset-0 bg-overlay z-50 flex items-end justify-center">
      <div ref={sheetRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} onClick={(e: React.MouseEvent) => e.stopPropagation()} className={`anim-sheet-in relative max-h-[95dvh] w-full max-w-full overflow-hidden rounded-t-2xl bg-surface pb-[env(safe-area-inset-bottom)] text-neutral-900 shadow-dialog outline-none sm:max-w-md ${className}`}>
        <div ref={handleRef} className="flex cursor-grab touch-none items-center justify-center pb-1.5 pt-2 active:cursor-grabbing" aria-hidden="true">
          <span className="block h-1.5 w-10 rounded-full bg-neutral-300"/>
        </div>
        {title && (<div className="flex items-center justify-between gap-3 border-b border-border px-4 pb-2 sm:px-5">
            <h2 id={titleId} className="min-w-0 text-base font-bold leading-snug text-neutral-900">{title}</h2>
            <button type="button" onClick={onClose} aria-label={t('common.close')} className="-me-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-surface-muted hover:text-neutral-900 active:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              <XIcon className="h-5 w-5" aria-hidden="true"/>
            </button>
          </div>)}
        <div className="overflow-y-auto max-h-[calc(95dvh-56px)]">
          {children}
        </div>
      </div>
    </div>);
};
