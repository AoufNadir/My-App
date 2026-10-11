import { useCallback, useEffect, useState } from 'react';
import { CLIENT_CONFIRMATIONS_LISTED, parseClientConfirmation, type ClientConfirmation } from '../utils/clientConfirmation';

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
 * What clients said their balance was (users/{uid}/client_confirmations), newest first. A separate
 * collection that holds no money: saving or deleting one never changes a balance, and it is not one
 * of the financial collections behind the write gate. Same pattern as the saved inventories: the
 * write is applied to the local copy at once, a refused write is reported through onError.
 */
export function useClientConfirmations(userDocRef: UserDocRefLike | null | undefined, enabled: boolean, onError?: (error: unknown) => void) {
    const [confirmations, setConfirmations] = useState<ClientConfirmation[]>([]);
    useEffect(() => {
        if (!enabled || !userDocRef) {
            setConfirmations([]);
            return;
        }
        return userDocRef.collection('client_confirmations')
            .orderBy('timestamp', 'desc')
            .limit(CLIENT_CONFIRMATIONS_LISTED)
            .onSnapshot((snapshot) => {
                const parsed: ClientConfirmation[] = [];
                for (const doc of snapshot.docs) {
                    const confirmation = parseClientConfirmation(doc.id, doc.data());
                    if (confirmation)
                        parsed.push(confirmation);
                }
                setConfirmations(parsed);
            });
    }, [enabled, userDocRef]);
    const saveConfirmation = useCallback((data: Omit<ClientConfirmation, 'id'>): string | null => {
        if (!userDocRef)
            return null;
        const ref = userDocRef.collection('client_confirmations').doc();
        ref.set(data as unknown as Record<string, unknown>).catch((error) => onError?.(error));
        return ref.id;
    }, [userDocRef, onError]);
    return { confirmations, saveConfirmation };
}
