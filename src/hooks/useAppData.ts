import { useState, useEffect, useMemo } from 'react';
import { db, type AppUser } from '../firebase';
import {
    Tx, ClientDzd, ClientTransactionDzd, TreasuryTx, TreasuryCard,
    ManualAsset, ManualAssetClient, ManualAssetTransaction,
    Investor, InvestorTransaction
} from '../types';

type UseAppDataOptions = {
    subscribeManualAssets?: boolean;
    subscribeInvestors?: boolean;
};

export function useAppData(user: AppUser, refreshKey: number, options: UseAppDataOptions = {}) {
    const userDocRef = useMemo(() => db.collection('users').doc(user.uid), [user.uid]);
    const subscribeManualAssets = options.subscribeManualAssets ?? true;
    const subscribeInvestors = options.subscribeInvestors ?? true;

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

    // Real-time Listeners
    useEffect(() => {
        const unsubTxs = userDocRef.collection('usdt_txs').orderBy('timestamp', 'asc').onSnapshot(snap => {
            setTransactions(snap.docs.map(doc => {
                const data = doc.data();
                const newDoc: any = { id: doc.id, ...data };
                if (newDoc.usd !== undefined) { newDoc.quantity = newDoc.usd; delete newDoc.usd; }
                if (!newDoc.currency) { newDoc.currency = 'USDT'; }
                return newDoc;
            }) as Tx[]);
        });

        const unsubClients = userDocRef.collection('dzd_clients').orderBy('fullName', 'asc').onSnapshot(snap => {
            setClientsDzd(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ClientDzd[]);
        });

        const unsubClientTxs = userDocRef.collection('dzd_client_txs').orderBy('timestamp', 'asc').onSnapshot(snap => {
            setClientTransactionsDzd(snap.docs.map(doc => {
                const data = doc.data();
                const newDoc: any = { id: doc.id, ...data };
                if (newDoc.linkedUsdtTxId) { newDoc.linkedTxId = newDoc.linkedUsdtTxId; delete newDoc.linkedUsdtTxId; }
                return newDoc;
            }) as ClientTransactionDzd[]);
        });

        const unsubTreasuryTxs = userDocRef.collection('treasury_txs').orderBy('timestamp', 'asc').onSnapshot(snap => {
            setTreasuryTransactions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as TreasuryTx[]);
        });

        const unsubTreasuryCards = userDocRef.collection('treasury_cards').onSnapshot(snap => {
            setTreasuryCards(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as TreasuryCard[]);
        });

        const unsubManualAssets = subscribeManualAssets
            ? userDocRef.collection('manual_assets').orderBy('createdAt', 'desc').onSnapshot(snap => {
                setManualAssets(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ManualAsset[]);
            })
            : () => undefined;

        const unsubManualClients = subscribeManualAssets
            ? userDocRef.collection('manual_asset_clients').orderBy('fullName', 'asc').onSnapshot(snap => {
                setManualAssetClients(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ManualAssetClient[]);
            })
            : () => undefined;

        const unsubManualTxs = subscribeManualAssets
            ? userDocRef.collection('actifTransactions').orderBy('timestamp', 'desc').onSnapshot(snap => {
                setManualAssetTransactions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ManualAssetTransaction[]);
            })
            : () => undefined;

        const unsubInvestors = subscribeInvestors
            ? userDocRef.collection('investors').onSnapshot(snap => {
                setInvestors(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Investor[]);
            })
            : () => undefined;

        const unsubInvestorTxs = subscribeInvestors
            ? userDocRef.collection('investor_transactions').onSnapshot(snap => {
                setInvestorTransactions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as InvestorTransaction[]);
            })
            : () => undefined;

        return () => {
            unsubTxs(); unsubClients(); unsubClientTxs(); unsubTreasuryTxs(); unsubTreasuryCards();
            unsubManualAssets(); unsubManualClients(); unsubManualTxs(); unsubInvestors(); unsubInvestorTxs();
        };
    }, [userDocRef, refreshKey, subscribeManualAssets, subscribeInvestors]);

    // Derived Calculations
    const portfolioStats = useMemo(() => {
        const createInitialStats = () => ({ costBasis: 0, purchasedQty: 0, available: 0, totalProfit: 0, avgBuy: 0 });
        const round2 = (value: number) => Number(value.toFixed(2));
        const normalizeZero = (value: number) => (Object.is(value, -0) || Math.abs(value) < 0.005 ? 0 : round2(value));
        let usdtStats = createInitialStats();
        let eurStats = createInitialStats();

        for (const tx of transactions) {
            const stats = tx.currency === 'USDT' ? usdtStats : eurStats;
            const txQuantity = round2(Math.abs(Number(tx.quantity || 0)));
            const txTotal = round2(Number(tx.total || 0));
            if (txQuantity <= 0) continue;

            if (tx.type === 'buy' || tx.type === 'Ajout Manuel') {
                stats.available = round2(stats.available + txQuantity);
            } else {
                stats.available = round2(stats.available - txQuantity);
            }

            if (tx.type === 'Ajout Manuel' && txTotal > 0) {
                stats.purchasedQty = round2(stats.purchasedQty + txQuantity);
                stats.costBasis = round2(stats.costBasis + txTotal);
            } else if (tx.type === 'buy') {
                stats.purchasedQty = round2(stats.purchasedQty + txQuantity);
                stats.costBasis = round2(stats.costBasis + txTotal);
            } else if (tx.type === 'sell' || tx.type === 'Retrait Manuel') {
                const avgBuy = (stats.purchasedQty > 0) ? (stats.costBasis / stats.purchasedQty) : 0;
                const removedQty = Math.min(txQuantity, stats.purchasedQty);
                if (tx.type === 'sell' && tx.currency === 'USDT') {
                    const sellPrice = Number(tx.sell);
                    if (removedQty > 0 && Number.isFinite(sellPrice) && sellPrice > 0) {
                        const realized = (sellPrice - avgBuy) * removedQty;
                        usdtStats.totalProfit = round2(usdtStats.totalProfit + realized);
                    } else {
                        // Fallback for historical/legacy rows with no recoverable cost basis.
                        usdtStats.totalProfit = round2(usdtStats.totalProfit + Number(tx.profit || 0));
                    }
                }
                stats.purchasedQty = round2(stats.purchasedQty - removedQty);
                stats.costBasis = round2(stats.costBasis - (removedQty * avgBuy));
                if (stats.purchasedQty < 0.00001) { stats.purchasedQty = 0; stats.costBasis = 0; }
            }
        }
        usdtStats.available = normalizeZero(usdtStats.available);
        eurStats.available = normalizeZero(eurStats.available);

        // If displayed available quantity is zero, consider the position fully closed.
        // This prevents stale PAM from remaining when only microscopic residue exists.
        if (usdtStats.available === 0) {
            usdtStats.purchasedQty = 0;
            usdtStats.costBasis = 0;
        }
        if (eurStats.available === 0) {
            eurStats.purchasedQty = 0;
            eurStats.costBasis = 0;
        }

        usdtStats.purchasedQty = normalizeZero(usdtStats.purchasedQty);
        eurStats.purchasedQty = normalizeZero(eurStats.purchasedQty);
        usdtStats.costBasis = normalizeZero(usdtStats.costBasis);
        eurStats.costBasis = normalizeZero(eurStats.costBasis);

        if (usdtStats.purchasedQty === 0) usdtStats.costBasis = 0;
        if (eurStats.purchasedQty === 0) eurStats.costBasis = 0;

        usdtStats.avgBuy = (usdtStats.purchasedQty > 0) ? usdtStats.costBasis / usdtStats.purchasedQty : 0;
        eurStats.avgBuy = (eurStats.purchasedQty > 0) ? eurStats.costBasis / eurStats.purchasedQty : 0;
        usdtStats.avgBuy = normalizeZero(usdtStats.avgBuy);
        eurStats.avgBuy = normalizeZero(eurStats.avgBuy);
        usdtStats.totalProfit = normalizeZero(usdtStats.totalProfit);
        return { usdt: usdtStats, eur: eurStats };
    }, [transactions]);

    const treasuryStats = useMemo(() => {
        const normalizeZero = (value: number) => (Object.is(value, -0) || Math.abs(value) < 0.005 ? 0 : Number(value.toFixed(2)));
        const resolveWallet = (raw: any): 'Caisse' | 'BaridiMob' | null => {
            if (!raw) return null;
            const normalized = String(raw).toLowerCase();
            if (normalized.includes('caisse')) return 'Caisse';
            if (normalized.includes('baridi')) return 'BaridiMob';
            return null;
        };
        const parseLegacyTransfer = (rawAsset?: string): { from: 'Caisse' | 'BaridiMob' | null; to: 'Caisse' | 'BaridiMob' | null } => {
            if (!rawAsset) return { from: null, to: null };
            const match = /from\s+(.+?)\s+to\s+(.+)/i.exec(rawAsset);
            if (!match) return { from: null, to: null };
            return { from: resolveWallet(match[1]), to: resolveWallet(match[2]) };
        };

        let caisse = 0, baridi = 0;
        treasuryTransactions.forEach(tx => {
            const txData = tx as any;
            const amount = Number(tx.amount || 0);
            if (!Number.isFinite(amount) || amount <= 0) return;

            if (tx.type === 'Transfer') {
                const legacy = parseLegacyTransfer(txData.asset);
                const from = resolveWallet(txData.source) || legacy.from;
                const to = resolveWallet(txData.destination) || legacy.to;
                if (!from || !to || from === to) return;
                if (from === 'Caisse') caisse -= amount;
                if (from === 'BaridiMob') baridi -= amount;
                if (to === 'Caisse') caisse += amount;
                if (to === 'BaridiMob') baridi += amount;
                return;
            }

            let factor = 0;
            if (tx.type === 'Ajout' || tx.type === 'Adjustment (+)') factor = 1;
            else if (tx.type === 'Retrait' || tx.type === 'Adjustment (-)') factor = -1;

            const source = txData.source
                || (txData.asset === 'DZD-Caisse' ? 'Caisse' : txData.asset === 'DZD-Baridi' ? 'BaridiMob' : null);

            if (source === 'Caisse') caisse += (amount * factor);
            if (source === 'BaridiMob') baridi += (amount * factor);
        });
        return { caisse: normalizeZero(caisse), baridi: normalizeZero(baridi) };
    }, [treasuryTransactions]);

    const clientBalances = useMemo(() => {
        const balances = new Map<string, number>();
        clientsDzd.forEach(c => balances.set(c.id, 0));
        clientTransactionsDzd.forEach(tx => {
            if (tx.affectsBalance === false) return;
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
        clientBalances.forEach(b => { if (b < 0) totalDettes += b; else if (b > 0) totalAvances += b; });
        assetBalances.forEach(b => { if (b < 0) totalDettes += b; else if (b > 0) totalAvances += b; });
        return { totalDettes, totalAvances };
    }, [clientBalances, assetBalances]);

    const [isDataLoaded, setIsDataLoaded] = useState(false);

    useEffect(() => {
        // Simple heuristic for initial load
        if (transactions.length > 0 || clientsDzd.length > 0 || isDataLoaded) {
            setIsDataLoaded(true);
        }
    }, [transactions, clientsDzd, isDataLoaded]);

    return {
        userDocRef,
        transactions, clientsDzd, clientTransactionsDzd, treasuryTransactions, treasuryCards,
        manualAssets, manualAssetClients, manualAssetTransactions,
        investors, investorTransactions,
        portfolioStats, treasuryStats, clientBalances, assetClientBalances, assetBalances, totals,
        isDataLoaded
    };
}
