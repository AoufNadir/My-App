import { useCallback, useEffect, useState } from 'react';
import { readHiddenCurrencies, toggledHiddenCurrencies, type HideableCurrency } from '../utils/hiddenCurrencies';

type UserDocRefLike = {
    // The app's Firestore wrapper: (onNext, options, onError), as `usePeriodLock` uses it.
    onSnapshot: (onNext: (snapshot: { exists?: boolean; data: () => Record<string, unknown> | undefined }) => void, options?: { includeMetadataChanges?: boolean }, onError?: (error: Error) => void) => () => void;
    set: (data: Record<string, unknown>, options: { merge: boolean }) => Promise<unknown>;
};

// V13-2: the currencies hidden in the settings, followed live on the user document. No money, no balance.
export function useHiddenCurrencies(userDocRef: UserDocRefLike | null | undefined) {
    const [hidden, setHidden] = useState<HideableCurrency[]>([]);
    useEffect(() => {
        if (!userDocRef) return undefined;
        return userDocRef.onSnapshot((snapshot) => {
            const next = readHiddenCurrencies(snapshot.data()?.hiddenCurrencies);
            setHidden((current) => (current.join() === next.join() ? current : next));
        }, undefined, (error) => console.error('Error loading hidden currencies:', error));
    }, [userDocRef]);
    const setCurrencyHidden = useCallback(async (code: HideableCurrency, isHidden: boolean) => {
        if (!userDocRef) return;
        await userDocRef.set({ hiddenCurrencies: toggledHiddenCurrencies(hidden, code, isHidden) }, { merge: true });
    }, [userDocRef, hidden]);
    return { hidden, isHidden: (code: HideableCurrency) => hidden.includes(code), setCurrencyHidden };
}
