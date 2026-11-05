import { useEffect, useState } from 'react';

/** Where a page puts its own buttons in the phone header, next to the search button. */
export const HEADER_ACTIONS_SLOT_ID = 'app-header-actions';

/** The header's action slot, once it is on the page, for `createPortal`. */
export function useHeaderActionsSlot(): HTMLElement | null {
    const [slot, setSlot] = useState<HTMLElement | null>(null);
    useEffect(() => {
        setSlot(document.getElementById(HEADER_ACTIONS_SLOT_ID));
    }, []);
    return slot;
}

/** The same place in the desktop header (the phone and desktop headers are both in the page, one hidden by CSS). */
export const HEADER_ACTIONS_DESKTOP_SLOT_ID = 'app-header-actions-desktop';

/** Both header slots, for a button that belongs in either header; the hidden one is not seen. */
export function useHeaderActionSlots(): HTMLElement[] {
    const [slots, setSlots] = useState<HTMLElement[]>([]);
    useEffect(() => {
        setSlots([HEADER_ACTIONS_SLOT_ID, HEADER_ACTIONS_DESKTOP_SLOT_ID]
            .map((id) => document.getElementById(id))
            .filter((slot): slot is HTMLElement => !!slot));
    }, []);
    return slots;
}
