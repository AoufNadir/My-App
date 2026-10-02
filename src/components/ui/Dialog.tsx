import React, { createContext, useContext, useEffect, useId, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { XIcon } from '../icons/XIcon';
import { useOverlay } from './overlayStack';
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
 * Drag-to-dismiss with native pointer events: the drag starts on the handle and
 * moves the whole sheet. Shared by Dialog (phone layout) and BottomSheet.
 */
export function useSheetDragDismiss(enabled: boolean, handleRef: RefObject<HTMLElement | null>, panelRef: RefObject<HTMLElement | null>, onDismiss: () => void, closeThreshold = DRAG_DISMISS_PX) {
    const dismissRef = useRef(onDismiss);
    dismissRef.current = onDismiss;
    useEffect(() => {
        const handle = handleRef.current;
        const panel = panelRef.current;
        if (!enabled || !handle || !panel)
            return;
        let state: {
            startY: number;
            startTs: number;
            lastY: number;
            dragging: boolean;
        } | null = null;
        const onPointerDown = (e: PointerEvent) => {
            if (e.button !== 0 && e.pointerType === 'mouse')
                return;
            state = { startY: e.clientY, startTs: e.timeStamp, lastY: e.clientY, dragging: false };
        };
        const onPointerMove = (e: PointerEvent) => {
            if (!state)
                return;
            const delta = e.clientY - state.startY;
            if (!state.dragging) {
                if (Math.abs(delta) < 8)
                    return;
                state.dragging = true;
                // Technical exception: disabling transition while tracking the pointer prevents lag.
                panel.style.transition = 'none';
                handle.setPointerCapture?.(e.pointerId);
            }
            // Technical exception: transform is calculated per pointer event for sheet dragging.
            panel.style.transform = `translateY(${Math.max(0, delta)}px)`;
            state.lastY = e.clientY;
        };
        const onPointerEnd = (e: PointerEvent) => {
            const s = state;
            state = null;
            if (!s || !s.dragging)
                return;
            const dy = s.lastY - s.startY;
            const dt = Math.max(1, e.timeStamp - s.startTs);
            handle.releasePointerCapture?.(e.pointerId);
            if (dy > closeThreshold || dy / dt > DRAG_DISMISS_VELOCITY) {
                // Technical exception: animate to the final drag destination before unmounting.
                panel.style.transition = 'transform 200ms ease-out';
                panel.style.transform = 'translateY(100%)';
                window.setTimeout(() => dismissRef.current(), 200);
            }
            else {
                // Technical exception: restoring drag state needs an imperative transform reset.
                panel.style.transition = 'transform 180ms cubic-bezier(0.16, 1, 0.3, 1)';
                panel.style.transform = '';
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
            // Technical exception: a reopened sheet must start from its resting position.
            panel.style.transform = '';
            panel.style.transition = '';
        };
    }, [enabled, handleRef, panelRef, closeThreshold]);
}
/**
 * Names the window for screen readers: DialogTitle takes the id; without one,
 * the first heading inside the window is used.
 */
export function useDialogLabel(isOpen: boolean, panelRef: RefObject<HTMLElement | null>, titleId: string) {
    useEffect(() => {
        const panel = panelRef.current;
        if (!isOpen || !panel || document.getElementById(titleId))
            return;
        const heading = panel.querySelector<HTMLElement>('h1, h2, h3');
        if (!heading)
            return;
        if (!heading.id)
            heading.id = `${titleId}-heading`;
        panel.setAttribute('aria-labelledby', heading.id);
    });
}
/** Renders into <body> in the browser so a window is never trapped under a sticky or moved parent. */
export function inBody(node: React.ReactElement) {
    return typeof document === 'undefined' ? node : createPortal(node, document.body);
}
const DialogTitleContext = createContext<string | null>(null);
export type DialogLayout = 'auto' | 'centered' | 'sheet';
type DialogProps = {
    isOpen: boolean;
    onClose: () => void;
    children?: React.ReactNode;
    className?: string;
    /** Force a specific layout regardless of viewport. */
    layout?: DialogLayout;
};
const Dialog = ({ isOpen, onClose, children, className, layout = 'auto' }: DialogProps) => {
    const isMobile = useIsMobile();
    const renderAsSheet = layout === 'sheet' || (layout === 'auto' && isMobile);
    const panelRef = useRef<HTMLDivElement | null>(null);
    const handleRef = useRef<HTMLDivElement | null>(null);
    const titleId = useId();
    useOverlay(isOpen, onClose, panelRef);
    useSheetDragDismiss(isOpen && renderAsSheet, handleRef, panelRef, onClose);
    useDialogLabel(isOpen, panelRef, titleId);
    if (!isOpen)
        return null;
    const panelProps = {
        ref: panelRef,
        role: 'dialog',
        'aria-modal': true,
        'aria-labelledby': titleId,
        tabIndex: -1,
        onClick: (e: React.MouseEvent) => e.stopPropagation(),
    } as const;
    return inBody(<div onClick={() => onClose()} className={`anim-backdrop-in fixed inset-0 bg-overlay z-50 ${renderAsSheet ? 'flex items-end justify-center' : 'grid place-items-center p-2 sm:p-4'}`}>
      <DialogTitleContext.Provider value={titleId}>
        {renderAsSheet ? (<div {...panelProps} className={`anim-sheet-in relative flex max-h-[95dvh] w-full max-w-full flex-col overflow-hidden rounded-t-2xl bg-surface pb-[env(safe-area-inset-bottom)] text-neutral-900 shadow-dialog outline-none touch-pan-y ${className || ''}`}>
            <div ref={handleRef} className="flex shrink-0 cursor-grab touch-none items-center justify-center pb-1.5 pt-2 active:cursor-grabbing" aria-hidden="true">
              <span className="block h-1.5 w-10 rounded-full bg-neutral-300"/>
            </div>
            <div className="flex-1 overflow-y-auto">{children}</div>
          </div>) : (<div {...panelProps} className={`anim-dialog-center-in relative max-h-[95dvh] w-full max-w-full overflow-y-auto rounded-2xl bg-surface text-neutral-900 shadow-dialog outline-none ${className || ''}`}>
            {children}
          </div>)}
      </DialogTitleContext.Provider>
    </div>);
};
Dialog.displayName = 'Dialog';
const DialogContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (<div ref={ref} className={className} {...props}/>));
DialogContent.displayName = 'DialogContent';
type DialogHeaderProps = React.HTMLAttributes<HTMLDivElement> & {
    onClose?: () => void;
};
/** Same header in every window: title (and subtitle) on one side, close button on the other; stays visible while scrolling. */
const DialogHeader = React.forwardRef<HTMLDivElement, DialogHeaderProps>(({ className, children, onClose, ...props }, ref) => {
    const { t } = useLanguage();
    return (<div ref={ref} className={`sticky top-0 z-20 flex items-start justify-between gap-3 border-b border-border bg-surface/95 px-4 py-3 backdrop-blur sm:px-5 ${className ?? ''}`} {...props}>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">{children}</div>
      {onClose && (<button type="button" onClick={onClose} aria-label={t('common.close')} className="-my-1.5 -me-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-surface-muted hover:text-neutral-900 active:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <XIcon className="h-5 w-5" aria-hidden="true"/>
        </button>)}
    </div>);
});
DialogHeader.displayName = 'DialogHeader';
const DialogTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(({ className, id, ...props }, ref) => {
    const titleId = useContext(DialogTitleContext);
    return (<h2 ref={ref} id={id ?? titleId ?? undefined} className={`text-base font-bold leading-snug text-neutral-900 ${className ?? ''}`} {...props}/>);
});
DialogTitle.displayName = 'DialogTitle';
/** Same actions row in every window: Cancel first, main action last, side by side; stays visible while scrolling. */
const DialogFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (<div ref={ref} className={`sticky bottom-0 z-20 flex items-center gap-2 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur sm:px-5 [&>*]:flex-1 ${className ?? ''}`} {...props}/>));
DialogFooter.displayName = 'DialogFooter';
const DialogDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(({ className, ...props }, ref) => (<p ref={ref} className={`text-[13px] text-neutral-500 ${className ?? ''}`} {...props}/>));
DialogDescription.displayName = 'DialogDescription';
export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription };
