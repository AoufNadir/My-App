import { useCallback, useEffect, useState } from 'react';

type UserDocRefLike = {
    onSnapshot: (onNext: (snapshot: { metadata?: { fromCache?: boolean }; data: () => Record<string, unknown> | undefined }) => void, options?: { includeMetadataChanges?: boolean }, onError?: (error: Error) => void) => () => void;
    set: (data: Record<string, unknown>, options: { merge: boolean }) => Promise<unknown>;
};

// V15-3: `setupDone` on the user document, read only once the server answered (a cached empty document
// would show the setup to an account that already finished it).
export function useSetupDone(userDocRef: UserDocRefLike | null | undefined) {
    const [setupDone, setSetupDone] = useState<boolean | undefined>(undefined);
    useEffect(() => {
        if (!userDocRef) return undefined;
        return userDocRef.onSnapshot((snapshot) => {
            const value = snapshot.data()?.setupDone === true;
            if (value || snapshot.metadata?.fromCache === false) setSetupDone(value);
        }, { includeMetadataChanges: true }, (error) => console.error('Error loading setup state:', error));
    }, [userDocRef]);
    const finishSetup = useCallback(async () => {
        if (!userDocRef) return;
        await userDocRef.set({ setupDone: true }, { merge: true });
        setSetupDone(true);
    }, [userDocRef]);
    return { setupDone, finishSetup };
}
