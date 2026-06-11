import { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import type { AppUser } from '../firebaseAuth';
import { Tx, ClientDzd, ClientTransactionDzd, TreasuryTx, TreasuryCard, ManualAsset, ManualAssetClient, ManualAssetTransaction, Investor, InvestorTransaction } from '../types';
import { computePamLedger } from '../utils/pamLedger';
type UseAppDataOptions = {
    subscribeManualAssets?: boolean;
    subscribeInvestors?: boolean;
    subscribeTreasuryCards?: boolean;
};
type AppDataCollectionKey = 'transactions' | 'clients' | 'clientTransactions' | 'treasuryTransactions' | 'treasuryCards' | 'manualAssets' | 'manualAssetClients' | 'manualAssetTransactions' | 'investors' | 'investorTransactions';
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
    'treasuryCards',
    'manualAssets',
    'manualAssetClients',
    'manualAssetTransactions',
    'investors',
    'investorTransactions'
];
function createInitialCollectionState(activeKeys: Set<AppDataCollectionKey>) {
    return COLLECTION_KEYS.reduce((acc, key) => {
        const inactive = !activeKeys.has(key);
        acc[key] = {
            received: inactive,
            fromCache: false,
            serverSynced: inactive
        };
        return acc;
    }, {} as Record<AppDataCollectionKey, CollectionLoadState>);
}
export function useAppData(user: AppUser, refreshKey: number, options: UseAppDataOptions = {}) {
    const userDocRef = useMemo(() => db.collection('users').doc(user.uid), [user.uid]);
    const subscribeManualAssets = options.subscribeManualAssets ?? true;
    const subscribeInvestors = options.subscribeInvestors ?? true;
    const subscribeTreasuryCards = options.subscribeTreasuryCards ?? true;
    // Data State
    const [transactions, setTransactions] = useState<Tx[]>([]);
    const [clientsDzd, setClientsDzd] = useState<ClientDzd[]>([]);
    const [clientTransactionsDzd, setClientTransactionsDzd] = useState<ClientTransactionDzd[]>([]);
    const [treasuryTransactions, setTreasuryTransactions] = useState<TreasuryTx[]>([]);
    const [treasuryCards, setTreasuryCards] = useState<TreasuryCard[]>([]);
    const [manualAssets, setManualAssets] = useState<ManualAsset[]>([]);
    const [manualAssetClients, setManualAssetClients] = useState<ManualAssetClient[]>([]);
    const [manualAssetTransactions, setManualAssetTransactions] = useState<ManualAssetTransaction[]>([]);
    const [investors, setInvestors] = useState<Investor[]>([]);
    const [investorTransactions, setInvestorTransactions] = useState<InvestorTransaction[]>([]);
    const [collectionState, setCollectionState] = useState<Record<AppDataCollectionKey, CollectionLoadState>>(() => createInitialCollectionState(new Set(COLLECTION_KEYS)));
    const activeCollectionKeys = useMemo(() => {
        const keys: AppDataCollectionKey[] = ['transactions', 'clients', 'clientTransactions', 'treasuryTransactions'];
        if (subscribeTreasuryCards)
            keys.push('treasuryCards');
        if (subscribeManualAssets)
            keys.push('manualAssets', 'manualAssetClients', 'manualAssetTransactions');
        if (subscribeInvestors)
            keys.push('investors', 'investorTransactions');
        return keys;
    }, [subscribeTreasuryCards, subscribeManualAssets, subscribeInvestors]);
    // Real-time Listeners
    useEffect(() => {
        const activeKeys = new Set<AppDataCollectionKey>(activeCollectionKeys);
        const appliedDocSnapshots = new Set<AppDataCollectionKey>();
        setCollectionState(createInitialCollectionState(activeKeys));
        const markSnapshot = (key: AppDataCollectionKey, snap: {
            metadata?: {
                fromCache?: boolean;
            };
        }) => {
            const fromCache = Boolean(snap.metadata?.fromCache);
            setCollectionState(prev => ({
                ...prev,
                [key]: {
                    received: true,
                    fromCache,
                    serverSynced: prev[key]?.serverSynced || !fromCache
                }
            }));
        };
        const shouldApplyDocs = (key: AppDataCollectionKey, snap: {
            docChanges?: () => unknown[];
        }) => {
            if (!appliedDocSnapshots.has(key)) {
                appliedDocSnapshots.add(key);
                return true;
            }
            return (snap.docChanges?.() || []).length > 0;
        };
        const snapshotOptions = { includeMetadataChanges: true };
        const unsubTxs = userDocRef.collection('usdt_txs').orderBy('timestamp', 'asc').onSnapshot(snap => {
            markSnapshot('transactions', snap);
            if (!shouldApplyDocs('transactions', snap))
                return;
            setTransactions(snap.docs.map(doc => {
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
            }) as Tx[]);
        }, snapshotOptions);
        const unsubClients = userDocRef.collection('dzd_clients').orderBy('fullName', 'asc').onSnapshot(snap => {
            markSnapshot('clients', snap);
            if (!shouldApplyDocs('clients', snap))
                return;
            setClientsDzd(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ClientDzd[]);
        }, snapshotOptions);
        const unsubClientTxs = userDocRef.collection('dzd_client_txs').orderBy('timestamp', 'asc').onSnapshot(snap => {
            markSnapshot('clientTransactions', snap);
            if (!shouldApplyDocs('clientTransactions', snap))
                return;
            setClientTransactionsDzd(snap.docs.map(doc => {
                const data = doc.data();
                const newDoc: any = { id: doc.id, ...data };
                if (newDoc.linkedUsdtTxId) {
                    newDoc.linkedTxId = newDoc.linkedUsdtTxId;
                    delete newDoc.linkedUsdtTxId;
                }
                return newDoc;
            }) as ClientTransactionDzd[]);
        }, snapshotOptions);
        const unsubTreasuryTxs = userDocRef.collection('treasury_txs').orderBy('timestamp', 'asc').onSnapshot(snap => {
            markSnapshot('treasuryTransactions', snap);
            if (!shouldApplyDocs('treasuryTransactions', snap))
                return;
            setTreasuryTransactions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as TreasuryTx[]);
        }, snapshotOptions);
        if (!subscribeTreasuryCards) {
            setTreasuryCards([]);
        }
        if (!subscribeManualAssets) {
            setManualAssets([]);
            setManualAssetClients([]);
            setManualAssetTransactions([]);
        }
        if (!subscribeInvestors) {
            setInvestors([]);
            setInvestorTransactions([]);
        }
        const unsubTreasuryCards = subscribeTreasuryCards
            ? userDocRef.collection('treasury_cards').onSnapshot(snap => {
                markSnapshot('treasuryCards', snap);
                if (!shouldApplyDocs('treasuryCards', snap))
                    return;
                setTreasuryCards(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as TreasuryCard[]);
            }, snapshotOptions)
            : () => undefined;
        const unsubManualAssets = subscribeManualAssets
            ? userDocRef.collection('manual_assets').orderBy('createdAt', 'desc').onSnapshot(snap => {
                markSnapshot('manualAssets', snap);
                if (!shouldApplyDocs('manualAssets', snap))
                    return;
                setManualAssets(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ManualAsset[]);
            }, snapshotOptions)
            : () => undefined;
        const unsubManualClients = subscribeManualAssets
            ? userDocRef.collection('manual_asset_clients').orderBy('fullName', 'asc').onSnapshot(snap => {
                markSnapshot('manualAssetClients', snap);
                if (!shouldApplyDocs('manualAssetClients', snap))
                    return;
                setManualAssetClients(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ManualAssetClient[]);
            }, snapshotOptions)
            : () => undefined;
        const unsubManualTxs = subscribeManualAssets
            ? userDocRef.collection('actifTransactions').orderBy('timestamp', 'desc').onSnapshot(snap => {
                markSnapshot('manualAssetTransactions', snap);
                if (!shouldApplyDocs('manualAssetTransactions', snap))
                    return;
                setManualAssetTransactions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ManualAssetTransaction[]);
            }, snapshotOptions)
            : () => undefined;
        const unsubInvestors = subscribeInvestors
            ? userDocRef.collection('investors').onSnapshot(snap => {
                markSnapshot('investors', snap);
                if (!shouldApplyDocs('investors', snap))
                    return;
                setInvestors(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Investor[]);
            }, snapshotOptions)
            : () => undefined;
        const unsubInvestorTxs = subscribeInvestors
            ? userDocRef.collection('investor_transactions').onSnapshot(snap => {
                markSnapshot('investorTransactions', snap);
                if (!shouldApplyDocs('investorTransactions', snap))
                    return;
                setInvestorTransactions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as InvestorTransaction[]);
            }, snapshotOptions)
            : () => undefined;
        return () => {
            unsubTxs();
            unsubClients();
            unsubClientTxs();
            unsubTreasuryTxs();
            unsubTreasuryCards();
            unsubManualAssets();
            unsubManualClients();
            unsubManualTxs();
            unsubInvestors();
            unsubInvestorTxs();
        };
    }, [userDocRef, refreshKey, subscribeManualAssets, subscribeInvestors, subscribeTreasuryCards, activeCollectionKeys]);
    // Derived Calculations
    // L2: portfolioStats was previously computed inline here, duplicating the math
    // in utils/pamLedger.ts. Both implementations had to be kept in sync (locked
    // support lived only here; cost basis math lived in both). Delegate to
    // computePamLedger so there is a single source of truth — it now supports
    // locked/lockedBatches natively.
    const portfolioStats = useMemo(() => computePamLedger(transactions).portfolioStats, [transactions]);
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
            const source = txData.source
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
        transactions, clientsDzd, clientTransactionsDzd, treasuryTransactions, treasuryCards,
        manualAssets, manualAssetClients, manualAssetTransactions,
        investors, investorTransactions,
        portfolioStats, treasuryStats, clientBalances, assetClientBalances, assetBalances, totals,
        isDataLoaded, dataStatus
    };
}
