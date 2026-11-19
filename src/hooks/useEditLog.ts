import { useEffect, useState } from 'react';
import { EDIT_LOG_COLLECTION, type EditLogEntry } from '../utils/editLog';

/** How many log lines are read: the newest ones, enough for the guard (14 days) and the list. */
export const EDIT_LOG_LISTED = 150;

type UserDocRefLike = {
    collection: (name: string) => {
        orderBy: (field: string, direction?: 'asc' | 'desc') => {
            limit: (n: number) => {
                onSnapshot: (callback: (snapshot: { docs: Array<{ id: string; data: () => unknown }> }) => void, options?: unknown, onError?: (error: Error) => void) => () => void;
            };
        };
    };
};

/** V17-3: the newest lines of users/{uid}/edit_log (read only). */
export function useEditLog(userDocRef: UserDocRefLike | null | undefined, enabled: boolean) {
    const [entries, setEntries] = useState<Array<EditLogEntry & { id: string }>>([]);
    useEffect(() => {
        if (!enabled || !userDocRef) {
            setEntries([]);
            return;
        }
        return userDocRef.collection(EDIT_LOG_COLLECTION).orderBy('at', 'desc').limit(EDIT_LOG_LISTED).onSnapshot((snapshot) => {
            setEntries(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as EditLogEntry) })));
        }, {}, () => setEntries([]));
    }, [userDocRef, enabled]);
    return entries;
}
