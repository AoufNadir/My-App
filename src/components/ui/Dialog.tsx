import React, { useEffect, useRef, useState } from 'react';
const MOBILE_BREAKPOINT_PX = 640;
const DRAG_DISMISS_PX = 100;
const DRAG_DISMISS_VELOCITY = 0.6; // px/ms
function useIsMobile(breakpoint = MOBILE_BREAKPOINT_PX): boolean {
    const [isMobile, setIsMobile] = useState<boolean>(() => {
        if (typeof window === 'undefined')
            return false;
        return window.matchMedia(`(max-width: ${breakpoint - 1}px)`).matches;
    });
    useEffect(() => {
        if (typeof window === 'undefined')
            return;
        const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
        const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
        setIsMobile(mq.matches);
        if (mq.addEventListener)
            mq.addEventListener('change', onChange);
        else
            mq.addListener(onChange);
        return () => {
            if (mq.removeEventListener)
                mq.removeEventListener('change', onChange);
            else
                mq.removeListener(onChange);
        };
    }, [breakpoint]);
    return isMobile;
}
/**
 * Lightweight drag-to-dismiss using native pointer events. Replaces the
 * framer-motion `drag="y"` API with a ~30-line handler.
 */
function useSheetDragDismiss(onDismiss: () => void) {
    const ref = useRef<HTMLDivElement | null>(null);
    const state = useRef<{
        startY: number;
        startTs: number;
        lastY: number;
        dragging: boolean;
    } | null>(null);
    useEffect(() => {
        const el = ref.current;
        if (!el)
            return;
        const reset = () => {
            // Technical exception: drag dismissal needs live transform updates from pointer movement.
            el.style.transform = '';
            el.style.transition = '';
        };
        const onPointerDown = (e: PointerEvent) => {
            // Only act on direct pointer interaction with the sheet (not its scrollable children scrolling).
            if (e.button !== 0 && e.pointerType === 'mouse')
                return;
            state.current = { startY: e.clientY, startTs: e.timeStamp, lastY: e.clientY, dragging: false };
        };
        const onPointerMove = (e: PointerEvent) => {
            if (!state.current)
                return;
            const delta = e.clientY - state.current.startY;
            if (!state.current.dragging) {
                if (Math.abs(delta) < 8)
                    return;
                state.current.dragging = true;
                // Technical exception: disabling transition while tracking the pointer prevents lag.
                el.style.transition = 'none';
                el.setPointerCapture?.(e.pointerId);
            }
            const y = Math.max(0, delta);
            // Technical exception: transform is calculated per pointer event for sheet dragging.
            el.style.transform = `translateY(${y}px)`;
            state.current.lastY = e.clientY;
        };
        const onPointerEnd = (e: PointerEvent) => {
            const s = state.current;
            state.current = null;
            if (!s || !s.dragging)
                return;
            const dy = s.lastY - s.startY;
            const dt = Math.max(1, e.timeStamp - s.startTs);
            const velocity = dy / dt;
            el.releasePointerCapture?.(e.pointerId);
            if (dy > DRAG_DISMISS_PX || velocity > DRAG_DISMISS_VELOCITY) {
                // Technical exception: animate to the final drag destination before unmounting.
                el.style.transition = 'transform 200ms ease-out';
                el.style.transform = `translateY(100%)`;
                window.setTimeout(onDismiss, 200);
            }
            else {
                // Technical exception: restoring drag state needs an imperative transform reset.
                el.style.transition = 'transform 180ms cubic-bezier(0.16, 1, 0.3, 1)';
                el.style.transform = '';
            }
        };
        el.addEventListener('pointerdown', onPointerDown);
        el.addEventListener('pointermove', onPointerMove);
        el.addEventListener('pointerup', onPointerEnd);
        el.addEventListener('pointercancel', onPointerEnd);
        return () => {
            reset();
            el.removeEventListener('pointerdown', onPointerDown);
            el.removeEventListener('pointermove', onPointerMove);
            el.removeEventListener('pointerup', onPointerEnd);
            el.removeEventListener('pointercancel', onPointerEnd);
        };
    }, [onDismiss]);
    return ref;
}
type DialogProps = {
    isOpen: boolean;
    onClose: () => void;
    children?: React.ReactNode;
    className?: string;
    /** Force a specific layout regardless of viewport. */
    layout?: 'auto' | 'centered' | 'sheet';
};
const Dialog = ({ isOpen, onClose, children, className, layout = 'auto' }: DialogProps) => {
    const isMobile = useIsMobile();
    const renderAsSheet = layout === 'sheet' || (layout === 'auto' && isMobile);
    const sheetHandleRef = useSheetDragDismiss(onClose);
    useEffect(() => {
        if (!isOpen)
            return;
        // Technical exception: lock document scrolling while modal content is active.
        document.body.style.overflow = 'hidden';
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape')
                onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            // Technical exception: restore document scrolling after modal unmount.
            document.body.style.overflow = 'unset';
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose]);
    if (!isOpen)
        return null;
    return (<div onClick={() => onClose()} className={`anim-backdrop-in fixed inset-0 bg-overlay z-50 ${renderAsSheet ? 'flex items-end justify-center' : 'grid place-items-center p-2 sm:p-4'}`}>
      {renderAsSheet ? (<div onClick={(e: React.MouseEvent) => e.stopPropagation()} className={`anim-sheet-in relative w-full max-h-[95dvh] rounded-t-2xl overflow-hidden flex flex-col bg-surface text-neutral-900 pb-[env(safe-area-inset-bottom)] touch-pan-y shadow-dialog ${className || ''}`}>
          <div ref={sheetHandleRef} className="pt-2 pb-1 flex items-center justify-center cursor-grab active:cursor-grabbing shrink-0" aria-hidden="true">
            <span className="block h-1.5 w-10 rounded-full bg-neutral-300"/>
          </div>
          <div className="overflow-y-auto flex-1">{children}</div>
        </div>) : (<div onClick={(e: React.MouseEvent) => e.stopPropagation()} className={`anim-dialog-center-in relative w-full rounded-2xl overflow-y-auto max-h-[95dvh] bg-surface text-neutral-900 shadow-dialog ${className || ''}`}>
          {children}
        </div>)}
    </div>);
};
Dialog.displayName = 'Dialog';
const DialogContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (<div ref={ref} className={className} {...props}/>));
DialogContent.displayName = 'DialogContent';
type DialogHeaderProps = React.HTMLAttributes<HTMLDivElement> & {
    onClose?: () => void;
};
const DialogHeader = React.forwardRef<HTMLDivElement, DialogHeaderProps>(({ className, children, onClose, ...props }, ref) => (<div ref={ref} className={`flex items-start justify-between p-6 ${className ?? ''}`} {...props}>
      <div className="flex flex-col space-y-1.5">{children}</div>
      {onClose && (<button type="button" className="inline-flex h-touch w-touch -m-2 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 active:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface" onClick={onClose} aria-label="Close">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>)}
    </div>));
DialogHeader.displayName = 'DialogHeader';
const DialogTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(({ className, ...props }, ref) => (<h2 ref={ref} className={`text-lg font-semibold leading-none text-neutral-900 ${className ?? ''}`} {...props}/>));
DialogTitle.displayName = 'DialogTitle';
const DialogFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (<div ref={ref} className={`flex flex-col-reverse sm:flex-row sm:justify-end sm:gap-2 p-6 ${className ?? ''}`} {...props}/>));
DialogFooter.displayName = 'DialogFooter';
const DialogDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(({ className, ...props }, ref) => (<p ref={ref} className={`text-sm text-neutral-500 ${className ?? ''}`} {...props}/>));
DialogDescription.displayName = 'DialogDescription';
export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription };
