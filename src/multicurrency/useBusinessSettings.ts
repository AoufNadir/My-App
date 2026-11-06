import { useCallback, useEffect, useMemo, useState } from 'react';
import { effectiveAccounts, tradedCurrencies, LEGACY_ACCOUNTS, readAccounts, readBusinessSettings, setupDocuments, type AccountKind, type BusinessAccount, type BusinessSettings, type SetupDraft } from './businessSettings';

// M2: reads and saves the business settings (user document field `business`) and its accounts (`accounts`).
// Like the inventory checks, these hold no money: no balance changes when they are saved.

type DocLike = { id: string; set: (data: Record<string, unknown>, options?: { merge: boolean }) => Promise<unknown> };
type UserDocRefLike = {
    set: (data: Record<string, unknown>, options?: { merge: boolean }) => Promise<unknown>;
    onSnapshot: (callback: (snapshot: { data: () => Record<string, unknown> | undefined }) => void) => () => void;
    collection: (name: string) => {
        doc: (id?: string) => DocLike;
        onSnapshot: (callback: (snapshot: { docs: Array<{ id: string; data: () => unknown }> }) => void) => () => void;
    };
};

export type BusinessSettingsState = {
    loaded: boolean;
    /** The raw `business` field: undefined for a business made before M2 */
    raw: unknown;
    settings: BusinessSettings;
    /** Accounts created (empty before any is created) */
    created: BusinessAccount[];
    /** The accounts to use: the created ones, or the cash box and BaridiMob */
    accounts: BusinessAccount[];
    saveSetup: (draft: SetupDraft) => Promise<void>;
    saveBusiness: (patch: Partial<Pick<BusinessSettings, 'currencies' | 'businessName' | 'logo'>>) => Promise<void>;
    /** Adds a wallet; returns its id. `currency` missing = the base currency. */
    addAccount: (name: string, kind: AccountKind, currency?: string) => Promise<string | null>;
    /** The currencies bought and sold (from the settings and the wallets) */
    traded: string[];
    /** Set up with the one-question setup: wallets only, no cash box or BaridiMob by default */
    walletsModel: boolean;
};

export function useBusinessSettings(userDocRef: UserDocRefLike | null | undefined): BusinessSettingsState {
    const [raw, setRaw] = useState<unknown>(undefined);
    const [created, setCreated] = useState<BusinessAccount[]>([]);
    const [loaded, setLoaded] = useState({ doc: false, accounts: false });
    useEffect(() => {
        if (!userDocRef)
            return;
        const stopDoc = userDocRef.onSnapshot((snapshot) => {
            setRaw(snapshot.data()?.business);
            setLoaded((value) => ({ ...value, doc: true }));
        });
        const stopAccounts = userDocRef.collection('accounts').onSnapshot((snapshot) => {
            setCreated(readAccounts(snapshot.docs.map((doc) => ({ id: doc.id, data: (doc.data() || {}) as Record<string, unknown> }))));
            setLoaded((value) => ({ ...value, accounts: true }));
        });
        return () => {
            stopDoc();
            stopAccounts();
        };
    }, [userDocRef]);
    const settings = readBusinessSettings(raw);
    const saveSetup = useCallback(async (draft: SetupDraft) => {
        if (!userDocRef)
            return;
        const docs = setupDocuments(draft);
        await Promise.all(docs.accounts.map((account) => userDocRef.collection('accounts').doc().set(account)));
        await userDocRef.set({ business: docs.business }, { merge: true });
    }, [userDocRef]);
    const saveBusiness = useCallback(async (patch: Partial<Pick<BusinessSettings, 'currencies' | 'businessName' | 'logo'>>) => {
        if (!userDocRef)
            return;
        await userDocRef.set({ business: { ...settings, ...patch, setupDone: true } }, { merge: true });
    }, [userDocRef, settings]);
    const addAccount = useCallback(async (name: string, kind: AccountKind, currency?: string) => {
        if (!userDocRef || !name.trim())
            return null;
        const accounts = userDocRef.collection('accounts');
        // The first account created next to the old two: the cash box and BaridiMob are written too, under the
        // names their treasury movements already carry, so they stay in the list with the same balances.
        if (created.length === 0 && settings.model !== 'wallets')
            await Promise.all(LEGACY_ACCOUNTS.map((account) => accounts.doc(account.id).set({ name: account.name, kind: account.kind, archived: false })));
        const ref = accounts.doc();
        await ref.set({ name: name.trim().slice(0, 40), kind, archived: false, currency: currency ?? settings.baseCurrency });
        return ref.id;
    }, [userDocRef, created.length, settings.model, settings.baseCurrency]);
    const accounts = useMemo(() => effectiveAccounts(created, settings.model), [created, settings.model]);
    const tradedKey = tradedCurrencies(settings, accounts).join(',');
    const traded = useMemo(() => (tradedKey ? tradedKey.split(',') : []), [tradedKey]);
    return { loaded: loaded.doc && loaded.accounts, raw, settings, created, accounts, saveSetup, saveBusiness, addAccount, traded, walletsModel: settings.model === 'wallets' };
}
