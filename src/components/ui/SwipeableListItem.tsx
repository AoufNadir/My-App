import React, { ReactNode, useEffect, useRef } from 'react';
import { PencilIcon } from '../icons/PencilIcon';
import { Trash2Icon } from '../icons/Trash2Icon';
import { useLanguage } from '../../contexts/LanguageContext';
const ACTION_BUTTON_WIDTH = 64;
const VELOCITY_TRIGGER = 0.4; // px/ms
const SNAP_TRANSITION = 'transform 220ms cubic-bezier(0.16, 1, 0.3, 1)';
type SwipeableListItemProps = {
    children?: ReactNode;
    onEdit?: () => void;
    onDelete?: () => void;
    disableSwipe?: boolean;
    className?: string;
};
/**
 * Pure-CSS swipe-to-reveal list item using native pointer events. Replaces the
 * framer-motion implementation to keep the 122 KB motion library out of the
 * initial bundle (the only remaining caller is the lazy dashboard charts).
 *
 * Behavior preserved:
 *  - Drag from leading edge (RTL) or trailing edge (LTR) reveals action buttons.
 *  - Snap to open/closed by distance threshold or fling velocity.
 *  - Action opacity fades in proportional to drag progress.
 *  - Tapping an action snaps closed before invoking the handler.
 */
export const SwipeableListItem: React.FC<SwipeableListItemProps> = ({ children, onEdit, onDelete, disableSwipe = false, className = '' }) => {
    const { dir } = useLanguage();
    const isRtl = dir === 'rtl';
    const sign = isRtl ? 1 : -1;
    const actionCount = (onEdit ? 1 : 0) + (onDelete ? 1 : 0);
    const actionsWidth = ACTION_BUTTON_WIDTH * actionCount;
    const swipeThreshold = actionsWidth / 2;
    const dragRef = useRef<HTMLDivElement | null>(null);
    const actionsRef = useRef<HTMLDivElement | null>(null);
    const stateRef = useRef<{
        startX: number;
        startTs: number;
        lastX: number;
        lastTs: number;
        openX: number;
        dragging: boolean;
        pointerId: number;
    } | null>(null);
    const setX = (x: number) => {
        if (dragRef.current)
            dragRef.current.style.transform = `translateX(${x}px)`;
        if (actionsRef.current) {
            const progress = Math.min(1, Math.max(0, Math.abs(x) / Math.max(1, actionsWidth)));
            actionsRef.current.style.opacity = String(progress);
        }
    };
    const snap = (toX: number, withTransition: boolean) => {
        if (!dragRef.current)
            return;
        dragRef.current.style.transition = withTransition ? SNAP_TRANSITION : 'none';
        dragRef.current.style.transform = `translateX(${toX}px)`;
        if (actionsRef.current) {
            actionsRef.current.style.transition = withTransition ? 'opacity 220ms ease-out' : 'none';
            const progress = Math.abs(toX) / Math.max(1, actionsWidth);
            actionsRef.current.style.opacity = String(Math.min(1, progress));
        }
        const state = stateRef.current;
        if (state)
            state.openX = toX;
    };
    useEffect(() => {
        const el = dragRef.current;
        if (!el || disableSwipe || actionCount === 0)
            return;
        const minX = isRtl ? 0 : -actionsWidth;
        const maxX = isRtl ? actionsWidth : 0;
        const onPointerDown = (e: PointerEvent) => {
            if (e.button !== 0 && e.pointerType === 'mouse')
                return;
            stateRef.current = {
                startX: e.clientX,
                startTs: e.timeStamp,
                lastX: e.clientX,
                lastTs: e.timeStamp,
                openX: stateRef.current?.openX ?? 0,
                dragging: false,
                pointerId: e.pointerId,
            };
        };
        const onPointerMove = (e: PointerEvent) => {
            const s = stateRef.current;
            if (!s)
                return;
            const dx = e.clientX - s.startX;
            if (!s.dragging) {
                // Ignore primarily-vertical motion so list scrolling still works.
                if (Math.abs(dx) < 8)
                    return;
                s.dragging = true;
                el.setPointerCapture?.(e.pointerId);
                el.style.transition = 'none';
                if (actionsRef.current)
                    actionsRef.current.style.transition = 'none';
            }
            let nextX = s.openX + dx;
            // Elastic clamp past the constraint edges.
            if (nextX < minX)
                nextX = minX + (nextX - minX) * 0.2;
            else if (nextX > maxX)
                nextX = maxX + (nextX - maxX) * 0.2;
            setX(nextX);
            s.lastX = e.clientX;
            s.lastTs = e.timeStamp;
        };
        const onPointerEnd = (e: PointerEvent) => {
            const s = stateRef.current;
            stateRef.current = { ...s!, openX: s?.openX ?? 0, dragging: false, startX: 0, startTs: 0, lastX: 0, lastTs: 0, pointerId: 0 };
            if (!s || !s.dragging) {
                stateRef.current = null;
                return;
            }
            el.releasePointerCapture?.(e.pointerId);
            const dx = s.lastX - s.startX;
            const dt = Math.max(1, s.lastTs - s.startTs);
            const velocity = dx / dt;
            const target = sign * actionsWidth;
            const triggered = isRtl
                ? (dx > swipeThreshold || velocity > VELOCITY_TRIGGER)
                : (dx < -swipeThreshold || velocity < -VELOCITY_TRIGGER);
            snap(triggered ? target : 0, true);
        };
        el.addEventListener('pointerdown', onPointerDown);
        el.addEventListener('pointermove', onPointerMove);
        el.addEventListener('pointerup', onPointerEnd);
        el.addEventListener('pointercancel', onPointerEnd);
        return () => {
            el.removeEventListener('pointerdown', onPointerDown);
            el.removeEventListener('pointermove', onPointerMove);
            el.removeEventListener('pointerup', onPointerEnd);
            el.removeEventListener('pointercancel', onPointerEnd);
        };
    }, [disableSwipe, actionCount, actionsWidth, swipeThreshold, isRtl, sign]);
    const handleActionClick = (action?: () => void) => {
        if (!action)
            return;
        snap(0, true);
        window.setTimeout(action, 220);
    };
    if (disableSwipe || actionCount === 0) {
        return <div className={`w-full ${className}`}>{children}</div>;
    }
    return (<div className={`relative w-full overflow-hidden ${className}`}>
      {/* Technical gesture dimensions: widths/opacity are driven by swipe physics, not visual design. */}
      <div ref={actionsRef} className={`absolute inset-y-0 ${isRtl ? 'left-0' : 'right-0'} flex items-stretch`} style={{ width: actionsWidth, opacity: 0 }}>
        {onEdit ? (<button onClick={() => handleActionClick(onEdit)} className="flex h-full items-center justify-center bg-primary text-white transition-colors hover:bg-primary-dark focus:outline-none" style={{ width: ACTION_BUTTON_WIDTH }} aria-label="Modifier">
            <PencilIcon className="w-5 h-5"/>
          </button>) : null}
        {onDelete ? (<button onClick={() => handleActionClick(onDelete)} className="flex h-full items-center justify-center bg-danger text-white transition-colors hover:bg-danger-light focus:outline-none" style={{ width: ACTION_BUTTON_WIDTH }} aria-label="Supprimer">
            <Trash2Icon className="w-5 h-5"/>
          </button>) : null}
      </div>

      {/* Technical touch-action override keeps vertical list scrolling responsive during horizontal swipe. */}
      <div ref={dragRef} className="relative w-full" style={{ touchAction: 'pan-y' }}>
        {children}
      </div>
    </div>);
};
