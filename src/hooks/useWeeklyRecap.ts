import { useEffect, useMemo, useState } from 'react';
import type { Tx } from '../types';
import { computePamLedger, type PamLedgerResult } from '../utils/pamLedger';

const STORAGE_KEY = 'app_last_recap_week';

export interface WeeklyRecap {
    weekKey: string;       // "2026-W22"
    weekLabel: string;     // "Semaine du 25 mai"
    profit: number;
    sellCount: number;
    usdtSold: number;
    eurSold: number;
    activeDays: number;
}

function getWeekStart(date: Date): Date {
    const d = new Date(date);
    const dow = d.getDay();
    const diff = dow === 0 ? -6 : 1 - dow; // Mon=0
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

function weekKeyOf(date: Date): string {
    const start = getWeekStart(date);
    const y = start.getFullYear();
    // ISO week number
    const jan1 = new Date(y, 0, 1);
    const week = Math.ceil(((start.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
    return `${y}-W${String(week).padStart(2, '0')}`;
}

function weekLabel(start: Date): string {
    return `Semaine du ${start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`;
}

export function useWeeklyRecap(
    transactions: ReadonlyArray<Tx> | undefined,
    providedPamLedger?: PamLedgerResult
): { recap: WeeklyRecap | null; dismiss: () => void } {
    const [dismissedKey, setDismissedKey] = useState<string | null>(() => {
        if (typeof window === 'undefined') return null;
        return window.localStorage.getItem(STORAGE_KEY);
    });

    const today = new Date();
    // Only show recap if today is Monday (day 1)
    const isMondayOrLater = today.getDay() >= 1; // always true — but we key by week

    // Previous week: the week that ended last Sunday
    const thisWeekStart = getWeekStart(today);
    const prevWeekStart = new Date(thisWeekStart.getTime() - 7 * 86400000);
    const prevWeekEnd = new Date(thisWeekStart.getTime() - 1);
    const prevWeekKey = weekKeyOf(prevWeekStart);

    const shouldBuild = Boolean(transactions?.length) && dismissedKey !== prevWeekKey && today.getDay() === 1; // Monday only

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

        for (const row of pamLedger.sellProfitRows) {
            if (row.timestamp < start || row.timestamp > end) continue;
            profit += row.derivedProfit || 0;
            sellCount++;
            if (row.currency === 'USDT') usdtSold += Number(row.quantity || 0);
            else if (row.currency === 'EUR') eurSold += Number(row.quantity || 0);
            activeDaysSet.add(new Date(row.timestamp).toDateString());
        }

        if (sellCount === 0) return null;

        return {
            weekKey: prevWeekKey,
            weekLabel: weekLabel(prevWeekStart),
            profit,
            sellCount,
            usdtSold,
            eurSold,
            activeDays: activeDaysSet.size,
        };
    }, [shouldBuild, pamLedger, transactions, prevWeekKey]);

    const dismiss = () => {
        if (!recap) return;
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(STORAGE_KEY, recap.weekKey);
        }
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
