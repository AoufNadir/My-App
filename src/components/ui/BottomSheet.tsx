import React, { useEffect, useId, useRef } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
const DRAG_DISMISS_VELOCITY = 0.6; // px/ms
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
    const { lang } = useLanguage();
    const sheetRef = useRef<HTMLDivElement | null>(null);
    const closeRef = useRef<HTMLButtonElement | null>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);
    const titleId = useId();
    const dragState = useRef<{
        startY: number;
        startTs: number;
        lastY: number;
        dragging: boolean;
    } | null>(null);
    useEffect(() => {
        if (!isOpen)
            return;
        // Technical exception: lock document scrolling while bottom-sheet content is active.
        document.body.style.overflow = 'hidden';
        previousFocusRef.current = document.activeElement as HTMLElement | null;
        requestAnimationFrame(() => (closeRef.current || sheetRef.current)?.focus());
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { onClose(); return; }
            if (e.key !== 'Tab' || !sheetRef.current) return;
            const focusable = [...sheetRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')];
            if (focusable.length === 0) { e.preventDefault(); sheetRef.current.focus(); return; }
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        };
        document.addEventListener('keydown', onKey);
        return () => {
            // Technical exception: restore document scrolling after bottom-sheet unmount.
            document.body.style.overflow = 'unset';
            document.removeEventListener('keydown', onKey);
            previousFocusRef.current?.focus?.();
        };
    }, [isOpen, onClose]);
    useEffect(() => {
        if (disableDrag || !isOpen)
            return;
        const el = sheetRef.current;
        if (!el)
            return;
        const handle = el.querySelector<HTMLElement>('[data-drag-handle="true"]');
        if (!handle)
            return;
        const onPointerDown = (e: PointerEvent) => {
            if (e.button !== 0 && e.pointerType === 'mouse')
                return;
            dragState.current = { startY: e.clientY, startTs: e.timeStamp, lastY: e.clientY, dragging: false };
        };
        const onPointerMove = (e: PointerEvent) => {
            if (!dragState.current)
                return;
            const dy = e.clientY - dragState.current.startY;
            if (!dragState.current.dragging) {
                if (Math.abs(dy) < 8)
                    return;
                dragState.current.dragging = true;
                // Technical exception: disabling transition while tracking the pointer prevents lag.
                el.style.transition = 'none';
                handle.setPointerCapture?.(e.pointerId);
            }
            // Technical exception: transform is calculated per pointer event for sheet dragging.
            el.style.transform = `translateY(${Math.max(0, dy)}px)`;
            dragState.current.lastY = e.clientY;
        };
        const onPointerEnd = (e: PointerEvent) => {
            const s = dragState.current;
            dragState.current = null;
            if (!s || !s.dragging)
                return;
            const dy = s.lastY - s.startY;
            const dt = Math.max(1, e.timeStamp - s.startTs);
            const velocity = dy / dt;
            handle.releasePointerCapture?.(e.pointerId);
            if (dy > closeThreshold || velocity > DRAG_DISMISS_VELOCITY) {
                // Technical exception: animate to the final drag destination before unmounting.
                el.style.transition = 'transform 200ms ease-out';
                el.style.transform = 'translateY(100%)';
                window.setTimeout(onClose, 200);
            }
            else {
                // Technical exception: restoring drag state needs an imperative transform reset.
                el.style.transition = 'transform 180ms cubic-bezier(0.16, 1, 0.3, 1)';
                el.style.transform = '';
            }
        };
        handle.addEventListener('pointerdown', onPointerDown);
        handle.addEventListener('pointermove', onPointerMove);
        handle.addEventListener('pointerup', onPointerEnd);
        handle.addEventListener('pointercancel', onPointerEnd);
        return () => {
            handle.removeEventListener('pointerdown', onPointerDown);
            handle.removeEventListener('pointermove', onPointerMove);
            handle.removeEventListener('pointerup', onPointerEnd);
            handle.removeEventListener('pointercancel', onPointerEnd);
        };
    }, [isOpen, disableDrag, closeThreshold, onClose]);
    if (!isOpen)
        return null;
    return (<div onClick={onClose} className="anim-backdrop-in fixed inset-0 bg-overlay z-50 flex items-end justify-center">
      <div ref={sheetRef} role="dialog" aria-modal="true" aria-labelledby={title ? titleId : undefined} tabIndex={-1} onClick={(e: React.MouseEvent) => e.stopPropagation()} className={`anim-sheet-in relative max-h-[95dvh] w-full max-w-full overflow-hidden rounded-t-2xl bg-surface pb-[env(safe-area-inset-bottom)] text-neutral-900 shadow-dialog sm:max-w-md ${className}`}>
        <div data-drag-handle="true" className="pt-2 pb-1 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none" aria-hidden="true">
          <span className="block h-1.5 w-10 rounded-full bg-neutral-300"/>
        </div>
        {title && (<div className="flex items-center justify-between gap-3 border-b border-border px-5 pb-3 pt-1">
            <h2 id={titleId} className="text-base font-semibold">{title}</h2>
            <button ref={closeRef} type="button" onClick={onClose} aria-label={lang === 'ar' ? 'إغلاق' : 'Fermer'} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl text-neutral-500 hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary/40">×</button>
          </div>)}
        <div className="overflow-y-auto max-h-[calc(95dvh-56px)]">
          {children}
        </div>
      </div>
    </div>);
};
