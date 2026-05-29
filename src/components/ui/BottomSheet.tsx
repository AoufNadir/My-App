import React, { useEffect, useRef } from 'react';
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
    const sheetRef = useRef<HTMLDivElement | null>(null);
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
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape')
            onClose(); };
        document.addEventListener('keydown', onKey);
        return () => {
            // Technical exception: restore document scrolling after bottom-sheet unmount.
            document.body.style.overflow = 'unset';
            document.removeEventListener('keydown', onKey);
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
      <div ref={sheetRef} onClick={(e: React.MouseEvent) => e.stopPropagation()} className={`anim-sheet-in relative w-full sm:max-w-md max-h-[95dvh] rounded-t-2xl overflow-hidden bg-surface text-neutral-900 pb-[env(safe-area-inset-bottom)] shadow-dialog ${className}`}>
        <div data-drag-handle="true" className="pt-2 pb-1 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none" aria-hidden="true">
          <span className="block h-1.5 w-10 rounded-full bg-neutral-300"/>
        </div>
        {title && (<div className="px-5 pt-1 pb-3 border-b border-border">
            <h2 className="text-base font-semibold">{title}</h2>
          </div>)}
        <div className="overflow-y-auto max-h-[calc(95dvh-56px)]">
          {children}
        </div>
      </div>
    </div>);
};
