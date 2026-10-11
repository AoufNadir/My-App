import { useCallback, useEffect, useMemo, useState } from 'react';
import { parseInventoryCheck } from '../utils/inventoryCheck';
import { inventoryReminder, readInventorySnooze, snoozeInventoryReminder, type InventoryReminder } from '../utils/inventoryReminder';

type UserDocRefLike = {
    collection: (name: string) => {
        orderBy: (field: string, direction?: 'asc' | 'desc') => {
            limit: (n: number) => {
                onSnapshot: (callback: (snapshot: { docs: Array<{ id: string; data: () => unknown }>; metadata?: { fromCache?: boolean } }) => void) => () => void;
            };
        };
    };
};

/** The reminder is re-worked out this often so the 17:00 rule opens while the app stays open. */
const RECHECK_MS = 5 * 60 * 1000;

/**
 * V5-4: the reminder to count the cash. It only reads the time of the latest saved inventory
 * (users/{uid}/inventory_checks, one document) and never a balance. Nothing is shown until the server
 * has answered: an empty local copy would read as « never counted » and raise a false reminder.
 */
export function useInventoryReminder(userDocRef: UserDocRefLike | null | undefined, enabled: boolean): {
    reminder: InventoryReminder | null;
    /** Hides the reminder for the rest of today. */
    snooze: () => void;
} {
    const [last, setLast] = useState<{ timestamp: number | null; ready: boolean }>({ timestamp: null, ready: false });
    const [snoozedDay, setSnoozedDay] = useState<string | null>(() => readInventorySnooze());
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        if (!enabled || !userDocRef) {
            setLast({ timestamp: null, ready: false });
            return;
        }
        return userDocRef.collection('inventory_checks')
            .orderBy('timestamp', 'desc')
            .limit(1)
            .onSnapshot((snapshot) => {
                if (snapshot.metadata?.fromCache)
                    return;
                const check = snapshot.docs.map((doc) => parseInventoryCheck(doc.id, doc.data())).find(Boolean);
                setLast({ timestamp: check ? check.timestamp : null, ready: true });
            });
    }, [enabled, userDocRef]);
    useEffect(() => {
        const refresh = () => setNow(Date.now());
        const timer = setInterval(refresh, RECHECK_MS);
        document.addEventListener('visibilitychange', refresh);
        return () => {
            clearInterval(timer);
            document.removeEventListener('visibilitychange', refresh);
        };
    }, []);
    const snooze = useCallback(() => setSnoozedDay(snoozeInventoryReminder(Date.now())), []);
    // The same object until the saved count, the snooze or the 5-minute clock changes, so the home page and the phone notification do not redo their work on every render.
    const reminder = useMemo(() => inventoryReminder({ lastTimestamp: last.timestamp, now, snoozedDay, ready: last.ready }), [last, now, snoozedDay]);
    return { reminder, snooze };
}
