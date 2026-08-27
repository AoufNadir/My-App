import { useEffect, useMemo, useState } from 'react';
import type { ClientDzd, ClientTransactionDzd, Tx } from '../types';
import { computePamLedger, type PamLedgerResult } from '../utils/pamLedger';

const STORAGE_KEY = 'app_last_recap_week';

export interface WeeklyRecap {
    weekKey: string;
    weekLabel: string;
    profit: number;
    sellCount: number;
    usdtSold: number;
    eurSold: number;
    activeDays: number;
    topClientName: string | null;
    topClientProfit: number;
}

function getWeekStart(date: Date): Date {
    const d = new Date(date);
    const dow = d.getDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

function weekKeyOf(date: Date): string {
    const start = getWeekStart(date);
    const y = start.getFullYear();
    const jan1 = new Date(y, 0, 1);
    const week = Math.ceil(((start.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
    return `${y}-W${String(week).padStart(2, '0')}`;
}

function weekLabel(start: Date): string {
    return `Semaine du ${start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`;
}

type UseWeeklyRecapArgs = {
    transactions?: ReadonlyArray<Tx>;
    clientTransactionsDzd?: ReadonlyArray<ClientTransactionDzd>;
    clientsDzd?: ReadonlyArray<ClientDzd>;
    getClientFullName?: (client: ClientDzd) => string;
    providedPamLedger?: PamLedgerResult;
};

export function useWeeklyRecap({
    transactions,
    clientTransactionsDzd = [],
    clientsDzd = [],
    getClientFullName,
    providedPamLedger,
}: UseWeeklyRecapArgs): { recap: WeeklyRecap | null; dismiss: () => void } {
    const [dismissedKey, setDismissedKey] = useState<string | null>(() => {
        if (typeof window === 'undefined') return null;
        return window.localStorage.getItem(STORAGE_KEY);
    });

    const today = new Date();
    const thisWeekStart = getWeekStart(today);
    const prevWeekStart = new Date(thisWeekStart.getTime() - 7 * 86400000);
    const prevWeekEnd = new Date(thisWeekStart.getTime() - 1);
    const prevWeekKey = weekKeyOf(prevWeekStart);

    const shouldBuild = Boolean(transactions?.length) && dismissedKey !== prevWeekKey && today.getDay() === 1;

    const pamLedger = useMemo(() => {
        if (!shouldBuild) return null;
        return providedPamLedger || computePamLedger([...(transactions || [])]);
    }, [providedPamLedger, shouldBuild, transactions]);

    const recap = useMemo<WeeklyRecap | null>(() => {
        if (!shouldBuild || !pamLedger || !transactions) return null;

        const start = prevWeekStart.getTime();
        const end = prevWeekEnd.getTime();

        let profit = 0;
        let sellCount = 0;
        let usdtSold = 0;
        let eurSold = 0;
        const activeDaysSet = new Set<string>();
        const weekSellTxIds = new Set<string>();

        for (const row of pamLedger.sellProfitRows) {
            if (row.timestamp < start || row.timestamp > end) continue;
            profit += row.derivedProfit || 0;
            sellCount++;
            if (row.currency === 'USDT') usdtSold += Number(row.quantity || 0);
            else if (row.currency === 'EUR') eurSold += Number(row.quantity || 0);
            activeDaysSet.add(new Date(row.timestamp).toDateString());
            if ((row as any).txId) weekSellTxIds.add((row as any).txId);
        }

        if (sellCount === 0) return null;

        // Best client of the week: link sell txIds → client via clientTransactionsDzd
        let topClientName: string | null = null;
        let topClientProfit = 0;
        if (clientTransactionsDzd.length > 0 && clientsDzd.length > 0) {
            // Also collect txIds from week sell transactions
            const weekSells = transactions.filter(tx =>
                tx.type === 'sell' && tx.timestamp >= start && tx.timestamp <= end
            );
            const txIdSet = new Set(weekSells.map(tx => tx.id));

            // Map clientId → profit from linked sells
            const clientProfitMap = new Map<string, number>();
            for (const clientTx of clientTransactionsDzd) {
                if (!clientTx.linkedTxId || !clientTx.clientId) continue;
                if (!txIdSet.has(clientTx.linkedTxId)) continue;
                const sellProfit = pamLedger.profitByTxId[clientTx.linkedTxId]?.derivedProfit || 0;
                clientProfitMap.set(clientTx.clientId, (clientProfitMap.get(clientTx.clientId) || 0) + sellProfit);
            }

            let bestClientId = '';
            let bestProfit = 0;
            for (const [clientId, p] of clientProfitMap.entries()) {
                if (p > bestProfit) { bestProfit = p; bestClientId = clientId; }
            }

            if (bestClientId) {
                const client = clientsDzd.find(c => c.id === bestClientId);
                if (client) {
                    topClientName = getClientFullName ? getClientFullName(client) : (client.fullName || null);
                    topClientProfit = bestProfit;
                }
            }
        }

        return {
            weekKey: prevWeekKey,
            weekLabel: weekLabel(prevWeekStart),
            profit,
            sellCount,
            usdtSold,
            eurSold,
            activeDays: activeDaysSet.size,
            topClientName,
            topClientProfit,
        };
    }, [shouldBuild, pamLedger, transactions, clientTransactionsDzd, clientsDzd, prevWeekKey]);

    const dismiss = () => {
        if (!recap) return;
        if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, recap.weekKey);
        setDismissedKey(recap.weekKey);
    };

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const onStorage = (e: StorageEvent) => {
            if (e.key === STORAGE_KEY) setDismissedKey(e.newValue);
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    return { recap, dismiss };
}
