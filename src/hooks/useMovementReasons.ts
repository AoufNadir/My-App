import { useCallback, useEffect, useState } from 'react';
import {
    buildMovementReasonData,
    movementReasonDocId,
    parseMovementReason,
    type MovementKind,
    type MovementReasonDoc,
} from '../utils/movementReason';

/** How many written reasons are kept in view; older ones stay stored but are not read. */
export const MOVEMENT_REASONS_LISTED = 500;

type UserDocRefLike = {
    collection: (name: string) => {
        doc: (id?: string) => { id: string; set: (data: Record<string, unknown>) => Promise<unknown> };
        orderBy: (field: string, direction?: 'asc' | 'desc') => {
            limit: (n: number) => {
                onSnapshot: (callback: (snapshot: { docs: Array<{ id: string; data: () => unknown }> }) => void) => () => void;
            };
        };
    };
};

/**
 * The reasons written for money movements (users/{uid}/movement_reasons), newest first. A separate
 * collection that holds no money: writing one never changes a balance or a movement, and it is not
 * one of the financial collections behind the write gate (so it also works on a closed month).
 *
 * Saving does not wait for the server (the local copy is updated at once); a refused write is
 * reported through onError.
 */
export function useMovementReasons(userDocRef: UserDocRefLike | null | undefined, enabled: boolean, onError?: (error: unknown) => void) {
    const [reasons, setReasons] = useState<MovementReasonDoc[]>([]);
    useEffect(() => {
        if (!enabled || !userDocRef) {
            setReasons([]);
            return;
        }
        return userDocRef.collection('movement_reasons')
            .orderBy('timestamp', 'desc')
            .limit(MOVEMENT_REASONS_LISTED)
            .onSnapshot((snapshot) => {
                const parsed: MovementReasonDoc[] = [];
                for (const doc of snapshot.docs) {
                    const reason = parseMovementReason(doc.id, doc.data());
                    if (reason)
                        parsed.push(reason);
                }
                setReasons(parsed);
            });
    }, [enabled, userDocRef]);
    /** Writes the reason for one movement; false when the text says nothing (nothing is written). */
    const saveReason = useCallback((kind: MovementKind, movementId: string, note: string): boolean => {
        if (!userDocRef)
            return false;
        const data = buildMovementReasonData(kind, movementId, note, Date.now(), 'review');
        if (!data)
            return false;
        userDocRef.collection('movement_reasons').doc(movementReasonDocId(kind, movementId))
            .set(data as unknown as Record<string, unknown>)
            .catch((error) => onError?.(error));
        return true;
    }, [userDocRef, onError]);
    return { reasons, saveReason };
}
