import { useCallback, useEffect, useRef, useState } from 'react';
import type { FirestoreDocumentReference } from '../firebase';
import {
    periodLockFields,
    periodLockHistoryEntry,
    readPeriodLockedThrough,
    type PeriodLockReason,
} from '../utils/periodLock';

export type PeriodLockState = {
    /** Every operation dated at or before this is closed; null when no month is closed. */
    lockedThrough: number | null;
    reason: PeriodLockReason | null;
    updatedAt: number | null;
    isLoaded: boolean;
};

const PERIOD_LOCK_REASONS: readonly PeriodLockReason[] = ['profit_distribution', 'manual_lock', 'manual_reopen'];

function readPeriodLockState(data: Record<string, unknown> | null | undefined): PeriodLockState {
    const reason = data?.periodLockReason as PeriodLockReason | undefined;
    const updatedAt = Number(data?.periodLockUpdatedAt);
    return {
        lockedThrough: readPeriodLockedThrough(data?.periodLockedThrough),
        reason: reason && PERIOD_LOCK_REASONS.includes(reason) ? reason : null,
        updatedAt: Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : null,
        isLoaded: true,
    };
}

// The closed months live on the user document and are followed live, so a month closed
// on the phone is closed on the computer too.
export function usePeriodLock(userDocRef: FirestoreDocumentReference) {
    const [state, setState] = useState<PeriodLockState>({ lockedThrough: null, reason: null, updatedAt: null, isLoaded: false });
    const lockedThroughRef = useRef<number | null>(null);
    lockedThroughRef.current = state.lockedThrough;

    useEffect(() => {
        const unsubscribe = userDocRef.onSnapshot((snapshot) => {
            const next = readPeriodLockState(snapshot.exists ? snapshot.data() : null);
            // The user document also changes for unrelated settings: keep the same state then.
            setState((current) => (current.isLoaded
                && current.lockedThrough === next.lockedThrough
                && current.reason === next.reason
                && current.updatedAt === next.updatedAt
                ? current
                : next));
        }, undefined, (error) => {
            console.error('Error loading closed months:', error);
            setState((current) => (current.isLoaded ? current : { ...current, isLoaded: true }));
        });
        return unsubscribe;
    }, [userDocRef]);

    const saveLockedThrough = useCallback(async (lockedThrough: number | null, reason: Exclude<PeriodLockReason, 'profit_distribution'>) => {
        const at = Date.now();
        const batch = userDocRef.firestore.batch();
        batch.set(userDocRef, periodLockFields(lockedThrough, reason, at), { merge: true });
        batch.set(userDocRef.collection('period_lock_history').doc(), periodLockHistoryEntry(lockedThroughRef.current, lockedThrough, reason, at));
        await batch.commit();
    }, [userDocRef]);

    return { ...state, saveLockedThrough };
}
