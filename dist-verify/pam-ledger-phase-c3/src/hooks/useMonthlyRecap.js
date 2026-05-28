import { useEffect, useMemo, useState } from 'react';
import { computePamLedger } from '../utils/pamLedger';
const STORAGE_KEY = 'app_last_recap_month';
const FR_MONTHS = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];
function monthKeyOf(date) {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${y}-${m}`;
}
/**
 * Detects the first time the app is opened in a new calendar month and
 * surfaces a recap of the previous month's realized profit. The recap is
 * shown once — once the user dismisses it, it's marked seen in localStorage.
 *
 * This is intentionally an in-app banner (not a system Notification API
 * push) so it works without permissions or service workers.
 */
export function useMonthlyRecap(transactions) {
    const [dismissedKey, setDismissedKey] = useState(() => {
        if (typeof window === 'undefined')
            return null;
        return window.localStorage.getItem(STORAGE_KEY);
    });
    const pamLedger = useMemo(() => (transactions && transactions.length > 0 ? computePamLedger([...transactions]) : null), [transactions]);
    const recap = useMemo(() => {
        if (!transactions || transactions.length === 0 || !pamLedger)
            return null;
        const today = new Date();
        const prev = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const prevKey = monthKeyOf(prev);
        if (dismissedKey === prevKey)
            return null;
        let profit = 0;
        let sellCount = 0;
        let usdtSold = 0;
        for (const tx of transactions) {
            const d = new Date(tx.timestamp);
            if (monthKeyOf(d) !== prevKey)
                continue;
            if (tx.type !== 'sell')
                continue;
            sellCount += 1;
            profit += pamLedger.profitByTxId[tx.id]?.derivedProfit || 0;
            if (tx.currency === 'USDT')
                usdtSold += Number(tx.quantity || 0);
        }
        if (sellCount === 0)
            return null;
        return {
            monthKey: prevKey,
            monthLabel: FR_MONTHS[prev.getMonth()],
            profit,
            sellCount,
            usdtSold,
        };
    }, [transactions, dismissedKey, pamLedger]);
    const dismiss = () => {
        if (!recap)
            return;
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(STORAGE_KEY, recap.monthKey);
        }
        setDismissedKey(recap.monthKey);
    };
    // Keep dismissedKey in sync if another tab updates it
    useEffect(() => {
        if (typeof window === 'undefined')
            return;
        const onStorage = (e) => {
            if (e.key === STORAGE_KEY)
                setDismissedKey(e.newValue);
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);
    return { recap, dismiss };
}
