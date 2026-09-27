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
