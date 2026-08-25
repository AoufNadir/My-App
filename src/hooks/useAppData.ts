import { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '../firebase';
import type { AppUser } from '../firebaseAuth';
import { Tx, ClientDzd, ClientTransactionDzd, TreasuryTx, TreasuryCard, ManualAsset, ManualAssetClient, ManualAssetTransaction, Investor, InvestorTransaction, DigitalServiceTransaction } from '../types';
type UseAppDataOptions = {
    /** The active surface determines the actual Firestore subscription plan. */
    view?: string;
    /** Number of newest rows to subscribe to for a plan marked `recent`. */
    resultLimit?: number;
};

export type AppDataCollectionKey = 'transactions' | 'clients' | 'clientTransactions' | 'treasuryTransactions' | 'digitalServiceTransactions' | 'treasuryCards' | 'manualAssets' | 'manualAssetClients' | 'manualAssetTransactions' | 'investors' | 'investorTransactions';
export type AppDataCollectionPlan =
    | { mode: 'off' }
    | { mode: 'full'; order?: 'asc' | 'desc' }
    | { mode: 'recent'; order: 'desc'; limit: number };
export type AppDataQueryPlan = {
    view: string;
    signature: string;
    activeCollectionKeys: AppDataCollectionKey[];
    collections: Record<AppDataCollectionKey, AppDataCollectionPlan>;
};

type TimestampQueryLike = {
    orderBy: (fieldPath: string, direction: 'asc' | 'desc') => TimestampQueryLike;
    limit: (count: number) => TimestampQueryLike;
};

type CollectionLoadState = {
    received: boolean;
    fromCache: boolean;
    serverSynced: boolean;
};

const COLLECTION_KEYS: AppDataCollectionKey[] = [
    'transactions',
    'clients',
    'clientTransactions',
    'treasuryTransactions',
    'digitalServiceTransactions',
    'treasuryCards',
    'manualAssets',
    'manualAssetClients',
    'manualAssetTransactions',
    'investors',
    'investorTransactions'
];

const OFF: AppDataCollectionPlan = { mode: 'off' };
const FULL: AppDataCollectionPlan = { mode: 'full' };
const FULL_ASC: AppDataCollectionPlan = { mode: 'full', order: 'asc' };
const DEFAULT_RECENT_LIMIT = 100;

function createInitialCollectionState() {
    return COLLECTION_KEYS.reduce((acc, key) => {
        acc[key] = {
            received: false,
            fromCache: false,
            serverSynced: false
        };
        return acc;
    }, {} as Record<AppDataCollectionKey, CollectionLoadState>);
}

function createEmptyCollectionPlan(): Record<AppDataCollectionKey, AppDataCollectionPlan> {
    return COLLECTION_KEYS.reduce((acc, key) => {
        acc[key] = OFF;
        return acc;
    }, {} as Record<AppDataCollectionKey, AppDataCollectionPlan>);
}

function recent(limit: number): AppDataCollectionPlan {
    return { mode: 'recent', order: 'desc', limit };
}

/**
 * The plan is intentionally explicit: a collection is either full (no limit)
 * because its current screen needs complete accounting history, or recent
 * (newest-first and bounded in Firestore). It prevents accidental `limit(0)`.
 */
export function buildAppDataQueryPlan({ view, resultLimit }: { view: string; resultLimit?: number }): AppDataQueryPlan {
    const collections = createEmptyCollectionPlan();
    const recentLimit = resultLimit && resultLimit > 0 ? resultLimit : DEFAULT_RECENT_LIMIT;
    const use = (key: AppDataCollectionKey, plan: AppDataCollectionPlan) => {
        collections[key] = plan;
    };

    switch (view) {
        case 'transactions':
            // PAM/profit lookup still needs full USDT cost-basis history. The three
            // high-volume side histories are fetched as newest-first bounded rows.
            use('transactions', FULL_ASC);
            use('clients', FULL);
            use('clientTransactions', recent(recentLimit));
            use('treasuryTransactions', recent(recentLimit));
            use('digitalServiceTransactions', recent(recentLimit));
            use('treasuryCards', FULL);
            use('investors', FULL);
            use('investorTransactions', FULL);
            break;
        case 'dzd':
            // Client balance and debt ageing are historical calculations, so the
            // DZD client ledger stays full until its read model is introduced.
            use('transactions', recent(recentLimit));
            use('clients', FULL);
            use('clientTransactions', FULL_ASC);
            use('treasuryTransactions', recent(recentLimit));
            use('digitalServiceTransactions', recent(recentLimit));
            break;
        case 'statistiques':
        case 'analytics':
            // Portfolio/analytics are currently full-history financial views.
            use('transactions', FULL_ASC);
            use('clients', FULL);
            use('clientTransactions', FULL_ASC);
            use('treasuryTransactions', FULL_ASC);
            use('digitalServiceTransactions', FULL_ASC);
            break;
        case 'expenses':
            // Expense and manager-profit calculations depend on complete history.
            use('transactions', FULL_ASC);
            use('treasuryTransactions', FULL_ASC);
            use('investors', FULL);
            use('investorTransactions', FULL_ASC);
            break;
        case 'tresorerie':
                    // The stored read-model snapshot is currently stale; retain complete raw
                    // treasury events until a separately approved snapshot rebuild. A full plan
                    // deliberately omits .limit() to keep displayed balances exact.
                    use('treasuryTransactions', FULL_ASC);
            use('treasuryCards', FULL);
            break;
        case 'services':
            // Service records are small and needed in full to derive client/asset balances.
            use('clients', FULL);
            use('manualAssets', FULL);
            use('manualAssetClients', FULL);
            use('manualAssetTransactions', FULL_ASC);
            use('digitalServiceTransactions', FULL_ASC);
            break;
        case 'investors':
            // The current investor ledger remains full for canonical historical
            // profit allocation. The selected-investor history has its own bounded query.
            use('transactions', FULL_ASC);
            use('treasuryTransactions', FULL_ASC);
            use('investors', FULL);
            use('investorTransactions', FULL_ASC);
            break;
        case 'dashboard':
        default:
            // Dashboard is served by read_models/dashboard_summary only.
            break;
    }

    const activeCollectionKeys = COLLECTION_KEYS.filter((key) => collections[key].mode !== 'off');
    return {
        view,
        activeCollectionKeys,
        collections,
        signature: JSON.stringify({ view, recentLimit, collections }),
    };
}

/** Applies a timestamp plan exactly once: newest-first before Firestore limit. */
export function applyTimestampQueryPlan<T extends TimestampQueryLike>(query: T, plan: AppDataCollectionPlan): T {
    if (plan.mode === 'off' || !plan.order)
        return query;
    let next = query.orderBy('timestamp', plan.order);
    if (plan.mode === 'recent')
        next = next.limit(plan.limit);
    return next as T;
}

function isEnabled(plan: AppDataCollectionPlan) {
    return plan.mode !== 'off';
}

function sortTimestampAscending<T extends { timestamp?: number }>(rows: T[]): T[] {
    return rows.slice().sort((left, right) => Number(left.timestamp || 0) - Number(right.timestamp || 0));
}
export function useAppData(user: AppUser, refreshKey: number, options: UseAppDataOptions = {}) {
    const view = options.view ?? 'dashboard';
    const resultLimit = options.resultLimit;
    const userDocRef = useMemo(() => db.collection('users').doc(user.uid), [user.uid]);
    // The memoized plan is a real listener dependency. Changing either the view
    // or the bounded page size therefore tears down only the old plan and binds
    // the correct new queries without clearing the in-memory cache.
    const queryPlan = useMemo(
        () => buildAppDataQueryPlan({ view, resultLimit }),
        [view, resultLimit],
    );
    const activeCollectionKeys = queryPlan.activeCollectionKeys;
    // Data State - persist data across view changes (cache retention)
    const [transactions, setTransactions] = useState<Tx[]>([]);
    const [clientsDzd, setClientsDzd] = useState<ClientDzd[]>([]);
    const [clientTransactionsDzd, setClientTransactionsDzd] = useState<ClientTransactionDzd[]>([]);
    const [treasuryTransactions, setTreasuryTransactions] = useState<TreasuryTx[]>([]);
    const [digitalServiceTransactions, setDigitalServiceTransactions] = useState<DigitalServiceTransaction[]>([]);
    const [treasuryCards, setTreasuryCards] = useState<TreasuryCard[]>([]);
    const [manualAssets, setManualAssets] = useState<ManualAsset[]>([]);
    const [manualAssetClients, setManualAssetClients] = useState<ManualAssetClient[]>([]);
    const [manualAssetTransactions, setManualAssetTransactions] = useState<ManualAssetTransaction[]>([]);
    const [investors, setInvestors] = useState<Investor[]>([]);
    const [investorTransactions, setInvestorTransactions] = useState<InvestorTransaction[]>([]);
    const [collectionState, setCollectionState] = useState<Record<AppDataCollectionKey, CollectionLoadState>>(createInitialCollectionState);
        const subscribeToCollection = useCallback((
                key: AppDataCollectionKey,
        query: { onSnapshot: (callback: (snapshot: any) => void, options?: { includeMetadataChanges?: boolean }) => () => void },
        mapDocs: (docs: any[]) => any[],
        applyDocs: (docs: any[]) => void
    ) => {
        let appliedInitialDocs = false;
        setCollectionState((current) => ({
            ...current,
            [key]: { received: false, fromCache: false, serverSynced: false }
        }));
        return query.onSnapshot((snapshot) => {
            const fromCache = Boolean(snapshot.metadata?.fromCache);
            setCollectionState((current) => ({
                ...current,
                [key]: {
                    received: true,
                    fromCache,
                    serverSynced: current[key]?.serverSynced || !fromCache
                }
            }));
            if (appliedInitialDocs && (snapshot.docChanges?.() || []).length === 0)
                return;
            appliedInitialDocs = true;
            applyDocs(mapDocs(snapshot.docs));
        }, { includeMetadataChanges: true });
    }, []);
    // The query plan—not parallel require/subscribe flags—owns every listener.
        // Data arrays are deliberately retained when a collection is not in the next
        // plan, allowing instant back navigation from the local cache.
        useEffect(() => {
            const { collections } = queryPlan;
            const unsubs: Array<() => void> = [];
            const inactive = (['transactions', 'clients', 'clientTransactions', 'treasuryTransactions', 'digitalServiceTransactions'] as AppDataCollectionKey[])
                .filter((key) => !isEnabled(collections[key]));
            if (inactive.length > 0) {
                setCollectionState((current) => {
                    const next = { ...current };
                    inactive.forEach((key) => {
                        next[key] = { received: false, fromCache: false, serverSynced: false };
                    });
                    return next;
                });
            }

            if (isEnabled(collections.transactions)) {
                unsubs.push(subscribeToCollection(
                    'transactions',
                    applyTimestampQueryPlan(userDocRef.collection('usdt_txs') as any, collections.transactions) as any,
                    (docs) => sortTimestampAscending(docs.map((doc) => {
                        const data = doc.data();
                        const newDoc: any = { id: doc.id, ...data };
                        if (newDoc.usd !== undefined) {
                            newDoc.quantity = newDoc.usd;
                            delete newDoc.usd;
                        }
                        if (!newDoc.currency) newDoc.currency = 'USDT';
                        return newDoc;
                    })),
                    (docs) => setTransactions(docs as Tx[]),
                ));
            }
            if (isEnabled(collections.clients)) {
                unsubs.push(subscribeToCollection(
                    'clients',
                    userDocRef.collection('dzd_clients').orderBy('fullName', 'asc'),
                    (docs) => docs.map((doc) => ({ id: doc.id, ...doc.data() })),
                    (docs) => setClientsDzd(docs as ClientDzd[]),
                ));
            }
            if (isEnabled(collections.clientTransactions)) {
                unsubs.push(subscribeToCollection(
                    'clientTransactions',
                    applyTimestampQueryPlan(userDocRef.collection('dzd_client_txs') as any, collections.clientTransactions) as any,
                    (docs) => sortTimestampAscending(docs.map((doc) => {
                        const data = doc.data();
                        const newDoc: any = { id: doc.id, ...data };
                        if (newDoc.linkedUsdtTxId) {
                            newDoc.linkedTxId = newDoc.linkedUsdtTxId;
                            delete newDoc.linkedUsdtTxId;
                        }
                        return newDoc;
                    })),
                    (docs) => setClientTransactionsDzd(docs as ClientTransactionDzd[]),
                ));
            }
            if (isEnabled(collections.treasuryTransactions)) {
                unsubs.push(subscribeToCollection(
                    'treasuryTransactions',
                    applyTimestampQueryPlan(userDocRef.collection('treasury_txs') as any, collections.treasuryTransactions) as any,
                    (docs) => sortTimestampAscending(docs.map((doc) => ({ id: doc.id, ...doc.data() }))),
                    (docs) => setTreasuryTransactions(docs as TreasuryTx[]),
                ));
            }
            if (isEnabled(collections.digitalServiceTransactions)) {
                unsubs.push(subscribeToCollection(
                    'digitalServiceTransactions',
                    applyTimestampQueryPlan(userDocRef.collection('digital_service_txs') as any, collections.digitalServiceTransactions) as any,
                    (docs) => sortTimestampAscending(docs.map((doc) => ({ id: doc.id, ...doc.data() }))),
                    (docs) => setDigitalServiceTransactions(docs as DigitalServiceTransaction[]),
                ));
            }
            return () => unsubs.forEach((unsubscribe) => unsubscribe());
        }, [queryPlan, userDocRef, refreshKey, subscribeToCollection]);

        useEffect(() => {
            const plan = queryPlan.collections.treasuryCards;
            if (!isEnabled(plan)) {
                setCollectionState((current) => ({
                    ...current,
                    treasuryCards: { received: false, fromCache: false, serverSynced: false },
                }));
                return;
            }
            return subscribeToCollection(
                'treasuryCards',
                userDocRef.collection('treasury_cards'),
                (docs) => docs.map((doc) => ({ id: doc.id, ...doc.data() })),
                (docs) => setTreasuryCards(docs as TreasuryCard[]),
            );
        }, [queryPlan, userDocRef, refreshKey, subscribeToCollection]);

        useEffect(() => {
            const { collections } = queryPlan;
            const keys: AppDataCollectionKey[] = ['manualAssets', 'manualAssetClients', 'manualAssetTransactions'];
            const unsubs: Array<() => void> = [];
            const inactive = keys.filter((key) => !isEnabled(collections[key]));
            if (inactive.length > 0) {
                setCollectionState((current) => {
                    const next = { ...current };
                    inactive.forEach((key) => {
                        next[key] = { received: false, fromCache: false, serverSynced: false };
                    });
                    return next;
                });
            }
            if (isEnabled(collections.manualAssets)) {
                unsubs.push(subscribeToCollection(
                    'manualAssets',
                    userDocRef.collection('manual_assets').orderBy('createdAt', 'desc'),
                    (docs) => docs.map((doc) => ({ id: doc.id, ...doc.data() })),
                    (docs) => setManualAssets(docs as ManualAsset[]),
                ));
            }
            if (isEnabled(collections.manualAssetClients)) {
                unsubs.push(subscribeToCollection(
                    'manualAssetClients',
                    userDocRef.collection('manual_asset_clients').orderBy('fullName', 'asc'),
                    (docs) => docs.map((doc) => ({ id: doc.id, ...doc.data() })),
                    (docs) => setManualAssetClients(docs as ManualAssetClient[]),
                ));
            }
            if (isEnabled(collections.manualAssetTransactions)) {
                unsubs.push(subscribeToCollection(
                    'manualAssetTransactions',
                    applyTimestampQueryPlan(userDocRef.collection('actifTransactions') as any, collections.manualAssetTransactions) as any,
                    (docs) => sortTimestampAscending(docs.map((doc) => ({ id: doc.id, ...doc.data() }))),
                    (docs) => setManualAssetTransactions(docs as ManualAssetTransaction[]),
                ));
            }
            return () => unsubs.forEach((unsubscribe) => unsubscribe());
        }, [queryPlan, userDocRef, refreshKey, subscribeToCollection]);

        useEffect(() => {
            const { collections } = queryPlan;
            const keys: AppDataCollectionKey[] = ['investors', 'investorTransactions'];
            const unsubs: Array<() => void> = [];
            const inactive = keys.filter((key) => !isEnabled(collections[key]));
            if (inactive.length > 0) {
                setCollectionState((current) => {
                    const next = { ...current };
                    inactive.forEach((key) => {
                        next[key] = { received: false, fromCache: false, serverSynced: false };
                    });
                    return next;
                });
            }
            if (isEnabled(collections.investors)) {
                unsubs.push(subscribeToCollection(
                    'investors',
                    userDocRef.collection('investors'),
                    (docs) => docs.map((doc) => ({ id: doc.id, ...doc.data() })),
                    (docs) => setInvestors(docs as Investor[]),
                ));
            }
            if (isEnabled(collections.investorTransactions)) {
                unsubs.push(subscribeToCollection(
                    'investorTransactions',
                    applyTimestampQueryPlan(userDocRef.collection('investor_transactions') as any, collections.investorTransactions) as any,
                    (docs) => sortTimestampAscending(docs.map((doc) => ({ id: doc.id, ...doc.data() }))),
                    (docs) => setInvestorTransactions(docs as InvestorTransaction[]),
                ));
            }
            return () => unsubs.forEach((unsubscribe) => unsubscribe());
        }, [queryPlan, userDocRef, refreshKey, subscribeToCollection]);
    // Derived Calculations
    const treasuryStats = useMemo(() => {
        const normalizeZero = (value: number) => (Object.is(value, -0) || Math.abs(value) < 0.005 ? 0 : Number(value.toFixed(2)));
        const resolveWallet = (raw: any): 'Caisse' | 'BaridiMob' | null => {
            if (!raw)
                return null;
            const normalized = String(raw).toLowerCase();
            if (normalized.includes('caisse'))
                return 'Caisse';
            if (normalized.includes('baridi'))
                return 'BaridiMob';
            return null;
        };
        const parseLegacyTransfer = (rawAsset?: string): {
            from: 'Caisse' | 'BaridiMob' | null;
            to: 'Caisse' | 'BaridiMob' | null;
        } => {
            if (!rawAsset)
                return { from: null, to: null };
            const match = /from\s+(.+?)\s+to\s+(.+)/i.exec(rawAsset);
            if (!match)
                return { from: null, to: null };
            return { from: resolveWallet(match[1]), to: resolveWallet(match[2]) };
        };
        let caisse = 0, baridi = 0;
        treasuryTransactions.forEach(tx => {
            const txData = tx as any;
            const amount = Number(tx.amount || 0);
            if (!Number.isFinite(amount) || amount <= 0)
                return;
            if (tx.type === 'Transfer') {
                const legacy = parseLegacyTransfer(txData.asset);
                const from = resolveWallet(txData.source) || legacy.from;
                const to = resolveWallet(txData.destination) || legacy.to;
                if (!from || !to || from === to)
                    return;
                if (from === 'Caisse')
                    caisse -= amount;
                if (from === 'BaridiMob')
                    baridi -= amount;
                if (to === 'Caisse')
                    caisse += amount;
                if (to === 'BaridiMob')
                    baridi += amount;
                return;
            }
            let factor = 0;
            if (tx.type === 'Ajout' || tx.type === 'Adjustment (+)')
                factor = 1;
            else if (tx.type === 'Retrait' || tx.type === 'Adjustment (-)')
                factor = -1;
            const source = resolveWallet(txData.source)
                || (txData.asset === 'DZD-Caisse' ? 'Caisse' : txData.asset === 'DZD-Baridi' ? 'BaridiMob' : null);
            if (source === 'Caisse')
                caisse += (amount * factor);
            if (source === 'BaridiMob')
                baridi += (amount * factor);
        });
        return { caisse: normalizeZero(caisse), baridi: normalizeZero(baridi) };
    }, [treasuryTransactions]);
    const clientBalances = useMemo(() => {
        const balances = new Map<string, number>();
        clientsDzd.forEach(c => balances.set(c.id, 0));
        clientTransactionsDzd.forEach(tx => {
            if (tx.affectsBalance === false)
                return;
            balances.set(tx.clientId, (balances.get(tx.clientId) || 0) + tx.montant);
        });
        return balances;
    }, [clientsDzd, clientTransactionsDzd]);
    const assetClientBalances = useMemo(() => {
        const map = new Map<string, number>();
        manualAssetTransactions.forEach(tx => {
            const key = `${tx.actifId}_${tx.clientId}`;
            map.set(key, (map.get(key) || 0) + tx.amount);
        });
        return map;
    }, [manualAssetTransactions]);
    const assetBalances = useMemo(() => {
        const map = new Map<string, number>();
        manualAssetTransactions.forEach(tx => {
            map.set(tx.actifId, (map.get(tx.actifId) || 0) + tx.amount);
        });
        return map;
    }, [manualAssetTransactions]);
    const totals = useMemo(() => {
        let totalDettes = 0, totalAvances = 0;
        clientBalances.forEach(b => { if (b < 0)
            totalDettes += b;
        else if (b > 0)
            totalAvances += b; });
        return { totalDettes, totalAvances };
    }, [clientBalances]);
    const dataStatus = useMemo(() => {
        const activeStates = activeCollectionKeys.map(key => collectionState[key]);
        const hasReceivedInitialSnapshot = activeStates.every(state => state?.received);
        const hasServerSynced = activeStates.every(state => state?.serverSynced);
        const hasCacheSnapshot = activeStates.some(state => state?.received && state?.fromCache && !state?.serverSynced);
        return {
            hasReceivedInitialSnapshot,
            hasServerSynced,
            isShowingCachedData: hasReceivedInitialSnapshot && !hasServerSynced && hasCacheSnapshot,
            collectionState
        };
    }, [activeCollectionKeys, collectionState]);
    const isDataLoaded = dataStatus.hasReceivedInitialSnapshot;
    return {
        userDocRef,
        transactions, clientsDzd, clientTransactionsDzd, treasuryTransactions, digitalServiceTransactions, treasuryCards,
        manualAssets, manualAssetClients, manualAssetTransactions,
        investors, investorTransactions,
        treasuryStats, clientBalances, assetClientBalances, assetBalances, totals,
        isDataLoaded, dataStatus
    };
}
