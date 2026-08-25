import { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '../firebase';
import type { AppUser } from '../firebaseAuth';
import { Tx, ClientDzd, ClientTransactionDzd, TreasuryTx, TreasuryCard, ManualAsset, ManualAssetClient, ManualAssetTransaction, Investor, InvestorTransaction, DigitalServiceTransaction } from '../types';
type UseAppDataOptions = {
    subscribeCoreFinancial?: boolean;
    subscribeManualAssets?: boolean;
    subscribeInvestors?: boolean;
    subscribeTreasuryCards?: boolean;
    requireManualAssets?: boolean;
    requireInvestors?: boolean;
    requireTreasuryCards?: boolean;
};
type AppDataCollectionKey = 'transactions' | 'clients' | 'clientTransactions' | 'treasuryTransactions' | 'digitalServiceTransactions' | 'treasuryCards' | 'manualAssets' | 'manualAssetClients' | 'manualAssetTransactions' | 'investors' | 'investorTransactions';
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
function getCollectionsForView(view: string): AppDataCollectionKey[] {
    // Dashboard uses read models only - no legacy listeners
    if (view === 'dashboard') return [];
    // Core financial needed by most views
    const core: AppDataCollectionKey[] = ['transactions', 'clients', 'clientTransactions', 'treasuryTransactions', 'digitalServiceTransactions'];
    switch (view) {
        case 'transactions':
            // transactions, clients, treasury, digital services, investors (for profit), treasuryCards
            return [...core, 'treasuryCards', 'investors', 'investorTransactions'] as AppDataCollectionKey[];
        case 'dzd':
            // clients + their transactions, core financial, investors
            return [...core, 'investors', 'investorTransactions'] as AppDataCollectionKey[];
        case 'statistiques':
        case 'analytics':
            // portfolio stats from transactions only
            return ['transactions', 'clients', 'clientTransactions', 'treasuryTransactions', 'digitalServiceTransactions'] as AppDataCollectionKey[];
        case 'expenses':
            // personal expenses from treasury, investors for manager profit
            return [...core, 'investors', 'investorTransactions'] as AppDataCollectionKey[];
        case 'tresorerie':
            // treasury stats, transactions, investors, treasuryCards
            return [...core, 'treasuryCards', 'investors', 'investorTransactions'] as AppDataCollectionKey[];
        case 'services':
            // manual assets + core for context
            return [...core, 'manualAssets', 'manualAssetClients', 'manualAssetTransactions'] as AppDataCollectionKey[];
        case 'investors':
            // investors + their transactions + core for portfolio stats
            return [...core, 'treasuryCards', 'investors', 'investorTransactions'] as AppDataCollectionKey[];
        default:
            return [] as AppDataCollectionKey[];
    }
}
export function useAppData(user: AppUser, refreshKey: number, options: UseAppDataOptions & { view?: string } = {}) {
    const view = options.view ?? 'dashboard';
    const userDocRef = useMemo(() => db.collection('users').doc(user.uid), [user.uid]);
    const subscribeCoreFinancial = options.subscribeCoreFinancial ?? (view !== 'dashboard');
    const subscribeManualAssets = options.subscribeManualAssets ?? false;
    const subscribeInvestors = options.subscribeInvestors ?? false;
    const subscribeTreasuryCards = options.subscribeTreasuryCards ?? false;
    const requireManualAssets = options.requireManualAssets ?? subscribeManualAssets;
    const requireInvestors = options.requireInvestors ?? subscribeInvestors;
    const requireTreasuryCards = options.requireTreasuryCards ?? subscribeTreasuryCards;
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
    const activeCollectionKeys = useMemo(() => {
                    const coreKeys: AppDataCollectionKey[] = ['transactions', 'clients', 'clientTransactions', 'treasuryTransactions', 'digitalServiceTransactions'];
                    const viewKeys = getCollectionsForView(view);
                    const keys: AppDataCollectionKey[] = subscribeCoreFinancial
                        ? viewKeys.filter((k): k is AppDataCollectionKey => coreKeys.includes(k))
                        : [];
                    if (requireTreasuryCards && viewKeys.includes('treasuryCards' as AppDataCollectionKey))
                        keys.push('treasuryCards' as AppDataCollectionKey);
                    if (requireManualAssets && ['manualAssets', 'manualAssetClients', 'manualAssetTransactions'].some(k => viewKeys.includes(k as AppDataCollectionKey)))
                        keys.push('manualAssets' as AppDataCollectionKey, 'manualAssetClients' as AppDataCollectionKey, 'manualAssetTransactions' as AppDataCollectionKey);
                    if (requireInvestors && ['investors', 'investorTransactions'].some(k => viewKeys.includes(k as AppDataCollectionKey)))
                        keys.push('investors' as AppDataCollectionKey, 'investorTransactions' as AppDataCollectionKey);
                    return keys;
                }, [subscribeCoreFinancial, view, requireTreasuryCards, requireManualAssets, requireInvestors]);
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
    // Core financial listeners - only for views that need them
    useEffect(() => {
        if (!subscribeCoreFinancial) {
            // Don't clear data - retain cache for instant navigation back
            // Just mark as not receiving new updates
            setCollectionState((current) => ({
                ...current,
                transactions: { received: false, fromCache: false, serverSynced: false },
                clients: { received: false, fromCache: false, serverSynced: false },
                clientTransactions: { received: false, fromCache: false, serverSynced: false },
                treasuryTransactions: { received: false, fromCache: false, serverSynced: false },
                digitalServiceTransactions: { received: false, fromCache: false, serverSynced: false },
            }));
            return;
        }
        const unsubTxs = subscribeToCollection(
            'transactions',
            userDocRef.collection('usdt_txs').orderBy('timestamp', 'asc'),
            (docs) => docs.map(doc => {
                const data = doc.data();
                const newDoc: any = { id: doc.id, ...data };
                if (newDoc.usd !== undefined) {
                    newDoc.quantity = newDoc.usd;
                    delete newDoc.usd;
                }
                if (!newDoc.currency) {
                    newDoc.currency = 'USDT';
                }
                return newDoc;
            }),
            (docs) => setTransactions(docs as Tx[])
        );
        const unsubClients = subscribeToCollection(
            'clients',
            userDocRef.collection('dzd_clients').orderBy('fullName', 'asc'),
            (docs) => docs.map(doc => ({ id: doc.id, ...doc.data() })),
            (docs) => setClientsDzd(docs as ClientDzd[])
        );
        const unsubClientTxs = subscribeToCollection(
            'clientTransactions',
            userDocRef.collection('dzd_client_txs').orderBy('timestamp', 'asc'),
            (docs) => docs.map(doc => {
                const data = doc.data();
                const newDoc: any = { id: doc.id, ...data };
                if (newDoc.linkedUsdtTxId) {
                    newDoc.linkedTxId = newDoc.linkedUsdtTxId;
                    delete newDoc.linkedUsdtTxId;
                }
                return newDoc;
            }),
            (docs) => setClientTransactionsDzd(docs as ClientTransactionDzd[])
        );
        const unsubTreasuryTxs = subscribeToCollection(
            'treasuryTransactions',
            userDocRef.collection('treasury_txs').orderBy('timestamp', 'asc'),
            (docs) => docs.map(doc => ({ id: doc.id, ...doc.data() })),
            (docs) => setTreasuryTransactions(docs as TreasuryTx[])
        );
        const unsubDigitalServices = subscribeToCollection(
            'digitalServiceTransactions',
            userDocRef.collection('digital_service_txs').orderBy('timestamp', 'asc'),
            (docs) => docs.map(doc => ({ id: doc.id, ...doc.data() })),
            (docs) => setDigitalServiceTransactions(docs as DigitalServiceTransaction[])
        );
        return () => {
            unsubTxs();
            unsubClients();
            unsubClientTxs();
            unsubTreasuryTxs();
            unsubDigitalServices();
        };
    }, [subscribeCoreFinancial, userDocRef, refreshKey, subscribeToCollection]);
    useEffect(() => {
        if (!subscribeTreasuryCards) {
            // Retain cache
            setCollectionState((current) => ({
                ...current,
                treasuryCards: { received: false, fromCache: false, serverSynced: false },
            }));
            return;
        }
        return subscribeToCollection(
            'treasuryCards',
            userDocRef.collection('treasury_cards'),
            (docs) => docs.map(doc => ({ id: doc.id, ...doc.data() })),
            (docs) => setTreasuryCards(docs as TreasuryCard[])
        );
    }, [subscribeTreasuryCards, userDocRef, refreshKey, subscribeToCollection]);
    useEffect(() => {
        if (!subscribeManualAssets) {
            // Retain cache
            setCollectionState((current) => ({
                ...current,
                manualAssets: { received: false, fromCache: false, serverSynced: false },
                manualAssetClients: { received: false, fromCache: false, serverSynced: false },
                manualAssetTransactions: { received: false, fromCache: false, serverSynced: false },
            }));
            return;
        }
        const unsubAssets = subscribeToCollection(
            'manualAssets',
            userDocRef.collection('manual_assets').orderBy('createdAt', 'desc'),
            (docs) => docs.map(doc => ({ id: doc.id, ...doc.data() })),
            (docs) => setManualAssets(docs as ManualAsset[])
        );
        const unsubClients = subscribeToCollection(
            'manualAssetClients',
            userDocRef.collection('manual_asset_clients').orderBy('fullName', 'asc'),
            (docs) => docs.map(doc => ({ id: doc.id, ...doc.data() })),
            (docs) => setManualAssetClients(docs as ManualAssetClient[])
        );
        const unsubTransactions = subscribeToCollection(
            'manualAssetTransactions',
            userDocRef.collection('actifTransactions').orderBy('timestamp', 'desc'),
            (docs) => docs.map(doc => ({ id: doc.id, ...doc.data() })),
            (docs) => setManualAssetTransactions(docs as ManualAssetTransaction[])
        );
        return () => {
            unsubAssets();
            unsubClients();
            unsubTransactions();
        };
    }, [subscribeManualAssets, userDocRef, refreshKey, subscribeToCollection]);
    useEffect(() => {
        if (!subscribeInvestors) {
            // Retain cache
            setCollectionState((current) => ({
                ...current,
                investors: { received: false, fromCache: false, serverSynced: false },
                investorTransactions: { received: false, fromCache: false, serverSynced: false },
            }));
            return;
        }
        const unsubInvestors = subscribeToCollection(
            'investors',
            userDocRef.collection('investors'),
            (docs) => docs.map(doc => ({ id: doc.id, ...doc.data() })),
            (docs) => setInvestors(docs as Investor[])
        );
        const unsubTransactions = subscribeToCollection(
            'investorTransactions',
            userDocRef.collection('investor_transactions'),
            (docs) => docs.map(doc => ({ id: doc.id, ...doc.data() })),
            (docs) => setInvestorTransactions(docs as InvestorTransaction[])
        );
        return () => {
            unsubInvestors();
            unsubTransactions();
        };
    }, [subscribeInvestors, userDocRef, refreshKey, subscribeToCollection]);
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
