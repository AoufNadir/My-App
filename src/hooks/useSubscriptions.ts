import { useCallback, useEffect, useState } from 'react';
import { parseSubscription, type Subscription, type SubscriptionWallet } from '../utils/habits';

// V12-13: the recurring subscriptions (users/{uid}/subscriptions). No money here: a subscription reminds on its day
// and opens the personal expense window; only that window records anything.

type DocRef = { set: (data: Record<string, unknown>, options?: { merge: boolean }) => Promise<unknown>; delete: () => Promise<unknown> };
type UserDocRefLike = {
    collection: (name: string) => {
        doc: (id?: string) => DocRef;
        onSnapshot: (callback: (snapshot: { docs: Array<{ id: string; data: () => unknown }> }) => void) => () => void;
    };
};

export function useSubscriptions(userDocRef: UserDocRefLike | null | undefined, enabled: boolean, onError?: (error: unknown) => void) {
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    useEffect(() => {
        if (!enabled || !userDocRef) {
            setSubscriptions([]);
            return;
        }
        return userDocRef.collection('subscriptions').onSnapshot((snapshot) => {
            setSubscriptions(snapshot.docs.map((doc) => parseSubscription(doc.id, doc.data())).filter((sub): sub is Subscription => !!sub).sort((a, b) => a.day - b.day));
        });
    }, [userDocRef, enabled]);
    const add = useCallback((input: { name: string; amount: number; wallet: SubscriptionWallet; day: number }) => {
        userDocRef?.collection('subscriptions').doc().set({ ...input, name: input.name.trim().slice(0, 40), active: true }).catch((error) => onError?.(error));
    }, [userDocRef, onError]);
    const markHandled = useCallback((id: string, month: string) => {
        userDocRef?.collection('subscriptions').doc(id).set({ handledMonth: month }, { merge: true }).catch((error) => onError?.(error));
    }, [userDocRef, onError]);
    const remove = useCallback((id: string) => {
        userDocRef?.collection('subscriptions').doc(id).delete().catch((error) => onError?.(error));
    }, [userDocRef, onError]);
    return { subscriptions, add, markHandled, remove };
}
