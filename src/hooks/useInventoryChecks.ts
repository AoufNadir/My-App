import { useCallback, useEffect, useState } from 'react';
import { parseInventoryCheck, type InventoryCheck } from '../utils/inventoryCheck';

/** How many saved inventories are kept in view; older ones stay stored but are not listed. */
export const INVENTORY_CHECKS_LISTED = 120;

type UserDocRefLike = {
    collection: (name: string) => {
        doc: (id?: string) => { id: string; set: (data: Record<string, unknown>) => Promise<unknown>; delete: () => Promise<unknown> };
        orderBy: (field: string, direction?: 'asc' | 'desc') => {
            limit: (n: number) => {
                onSnapshot: (callback: (snapshot: { docs: Array<{ id: string; data: () => unknown }> }) => void) => () => void;
            };
        };
    };
};

/**
 * The saved inventories (users/{uid}/inventory_checks), newest first. A separate collection that
 * holds no money: saving or deleting a check never changes a balance, and it is not one of the
 * financial collections behind the write gate.
 *
 * Saving does not wait for the server: Firestore applies the write to the local copy at once and
 * sends it when the phone is online, so the screen never hangs on a bad connection. A refused write
 * is reported through onError.
 */
export function useInventoryChecks(userDocRef: UserDocRefLike | null | undefined, enabled: boolean, onError?: (error: unknown) => void) {
    const [checks, setChecks] = useState<InventoryCheck[]>([]);
    useEffect(() => {
        if (!enabled || !userDocRef) {
            setChecks([]);
            return;
        }
        return userDocRef.collection('inventory_checks')
            .orderBy('timestamp', 'desc')
            .limit(INVENTORY_CHECKS_LISTED)
            .onSnapshot((snapshot) => {
                const parsed: InventoryCheck[] = [];
                for (const doc of snapshot.docs) {
                    const check = parseInventoryCheck(doc.id, doc.data());
                    if (check)
                        parsed.push(check);
                }
                setChecks(parsed);
            });
    }, [enabled, userDocRef]);
    const saveCheck = useCallback((data: Omit<InventoryCheck, 'id'>): string | null => {
        if (!userDocRef)
            return null;
        const ref = userDocRef.collection('inventory_checks').doc();
        ref.set(data as unknown as Record<string, unknown>).catch((error) => onError?.(error));
        return ref.id;
    }, [userDocRef, onError]);
    const deleteCheck = useCallback((id: string) => {
        if (!userDocRef)
            return;
        userDocRef.collection('inventory_checks').doc(id).delete().catch((error) => onError?.(error));
    }, [userDocRef, onError]);
    return { checks, saveCheck, deleteCheck };
}
