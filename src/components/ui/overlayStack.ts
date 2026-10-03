import { useEffect, useRef, type RefObject } from 'react';
/**
 * One stack for every open window (Dialog, Modal, ConfirmDialog, BottomSheet).
 * Only the window on top reacts to Escape, Tab and the phone's back button, and
 * the page behind stays locked until the last window closes.
 */
type OverlayEntry = {
    id: number;
    close: () => void;
    panel: () => HTMLElement | null;
};
const stack: OverlayEntry[] = [];
let nextId = 1;
let savedBodyOverflow: string | null = null;
const FOCUSABLE = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(', ');
function focusableIn(panel: HTMLElement): HTMLElement[] {
    return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter((el) => el.getClientRects().length > 0);
}
function onKeyDown(e: KeyboardEvent) {
    const top = stack[stack.length - 1];
    if (!top || e.defaultPrevented)
        return;
    if (e.key === 'Escape') {
        // An open list inside the window (search field, select) closes first.
        const target = e.target as HTMLElement | null;
        if (target?.getAttribute?.('aria-expanded') === 'true')
            return;
        top.close();
        return;
    }
    if (e.key !== 'Tab')
        return;
    const panel = top.panel();
    if (!panel)
        return;
    const items = focusableIn(panel);
    const active = document.activeElement;
    if (items.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    if (!panel.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
    }
    else if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
    }
    else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
    }
}
export function registerOverlay(close: () => void, panel: () => HTMLElement | null): number {
    const id = nextId++;
    stack.push({ id, close, panel });
    if (stack.length === 1 && typeof document !== 'undefined') {
        // Technical exception: lock page scrolling while a window is open.
        savedBodyOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', onKeyDown);
    }
    return id;
}
export function unregisterOverlay(id: number): void {
    const index = stack.findIndex((entry) => entry.id === id);
    if (index === -1)
        return;
    stack.splice(index, 1);
    if (stack.length === 0 && typeof document !== 'undefined') {
        // Technical exception: give the page its scrolling back after the last window.
        document.body.style.overflow = savedBodyOverflow ?? '';
        savedBodyOverflow = null;
        document.removeEventListener('keydown', onKeyDown);
    }
}
/** Closes the window on top, for the phone's back button. False when none is open. */
export function closeTopOverlay(): boolean {
    const top = stack[stack.length - 1];
    if (!top)
        return false;
    top.close();
    return true;
}
export function openOverlayCount(): number {
    return stack.length;
}
function restoreFocus(previous: HTMLElement | null, panel: HTMLElement | null) {
    if (!previous || !previous.isConnected || typeof previous.focus !== 'function')
        return;
    const active = document.activeElement;
    // Do not pull focus back if the person already moved it somewhere else.
    if (active && active !== document.body && !(panel && panel.contains(active)))
        return;
    // On a phone, jumping back into a text field would open the keyboard.
    const coarse = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
    if (coarse && previous.matches('input, textarea, select, [contenteditable="true"]'))
        return;
    previous.focus({ preventScroll: true });
}
/**
 * Registers an open window: Escape and back close the top one only, Tab stays
 * inside it, focus moves into it on open and goes back to the button after.
 */
export function useOverlay(isOpen: boolean, onClose: () => void, panelRef: RefObject<HTMLElement | null>) {
    const closeRef = useRef(onClose);
    closeRef.current = onClose;
    useEffect(() => {
        if (!isOpen || typeof document === 'undefined')
            return;
        const previous = document.activeElement as HTMLElement | null;
        const id = registerOverlay(() => closeRef.current(), () => panelRef.current);
        const frame = window.requestAnimationFrame(() => {
            const panel = panelRef.current;
            // A field with autoFocus keeps its focus.
            if (panel && !panel.contains(document.activeElement))
                panel.focus({ preventScroll: true });
        });
        return () => {
            window.cancelAnimationFrame(frame);
            const panel = panelRef.current;
            unregisterOverlay(id);
            restoreFocus(previous, panel);
        };
    }, [isOpen, panelRef]);
}
