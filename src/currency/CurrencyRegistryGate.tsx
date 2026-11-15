import { useEffect, useState, type ReactNode } from 'react';
import { db } from '../firebase';
import { readCustomCurrencies, setCustomCurrencies } from './tradeCurrencies';
import { readCustomAccounts, setCustomAccounts } from '../accounts/cashAccounts';

/**
 * V15-1: the currencies the owner added in the settings live on his user document (`customCurrencies`). They are put
 * in the list before the app shows any figure, so an operation in such a currency is never read as another one. When
 * the list changes (a currency added), the app below is drawn again from scratch with the new list.
 */
export function CurrencyRegistryGate({ uid, loading, children }: { uid: string; loading: ReactNode; children: ReactNode }) {
    const [version, setVersion] = useState<number | null>(null);
    useEffect(() => {
        const ref = db.collection('users').doc(uid);
        return ref.onSnapshot((snapshot) => {
            const data = snapshot.data();
            const accountsChanged = setCustomAccounts(readCustomAccounts(data?.customAccounts)); // V15-2: the owner's dinar accounts
            const changed = setCustomCurrencies(readCustomCurrencies(data?.customCurrencies)) || accountsChanged;
            setVersion((current) => (current === null ? 0 : changed ? current + 1 : current));
        }, undefined, (error) => {
            console.error('Error loading the currencies:', error);
            setVersion((current) => current ?? 0); // the built-in currencies still work
        });
    }, [uid]);
    if (version === null) return <>{loading}</>;
    return <div key={version} className="contents">{children}</div>;
}
