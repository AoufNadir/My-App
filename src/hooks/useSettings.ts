import { useCallback, useState, useEffect } from 'react';
import type { FirestoreDocumentReference } from '../firebase';
import type { ManagerFeeHistoryEntry } from './useInvestorEconomics';
import { LEGACY_MANAGER_FEE_PERCENTAGE } from './useInvestorEconomics';

export function parseManagerFeePercentage(value: string | number): number {
    const parsed = typeof value === 'string' ? parseFloat(value.replace(',', '.').trim()) : Number(value);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
        throw new Error('Le taux doit etre compris entre 0 et 100.');
    }
    return Number(parsed.toFixed(2));
}

export function formatManagerFeePercentage(value: string | number): string {
    const parsed = parseManagerFeePercentage(value);
    return Number.isInteger(parsed) ? String(parsed) : parsed.toString();
}

function normalizeStoredManagerFeePercentage(value: unknown): string {
    if (value === undefined || value === null || value === '') {
        return String(LEGACY_MANAGER_FEE_PERCENTAGE);
    }
    return formatManagerFeePercentage(value as string | number);
}

function toMs(value: unknown, fallback = 0): number {
    if (typeof value === 'number')
        return value;
    if (value && typeof (value as { toMillis?: () => number }).toMillis === 'function') {
        return (value as { toMillis: () => number }).toMillis();
    }
    const parsed = new Date(value as string).getTime();
    return Number.isFinite(parsed) ? parsed : fallback;
}

export function useSettings(userDocRef: FirestoreDocumentReference) {
    const [managerFeePercentage, setManagerFeePercentage] = useState(() => normalizeStoredManagerFeePercentage(localStorage.getItem('managerFeePercentage')));
    const [managerFeeHistory, setManagerFeeHistory] = useState<ManagerFeeHistoryEntry[]>([]);
    const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);
    useEffect(() => {
        localStorage.setItem('managerFeePercentage', managerFeePercentage);
    }, [managerFeePercentage]);
    useEffect(() => {
        const loadSettings = async () => {
            try {
                const [doc, historySnapshot] = await Promise.all([
                    userDocRef.get(),
                    userDocRef.collection('manager_fee_history').orderBy('effectiveFrom', 'asc').get()
                ]);
                if (doc.exists) {
                    const data = doc.data();
                    if (data?.managerFeePercentage !== undefined) {
                        setManagerFeePercentage(normalizeStoredManagerFeePercentage(data.managerFeePercentage));
                    }
                }
                const history = historySnapshot.docs.reduce<ManagerFeeHistoryEntry[]>((items, historyDoc) => {
                    const data = historyDoc.data();
                    const percentage = Number(data?.percentage);
                    const effectiveFrom = toMs(data?.effectiveFrom, Number.NaN);
                    if (!Number.isFinite(percentage) || !Number.isFinite(effectiveFrom))
                        return items;
                    items.push({
                        id: historyDoc.id,
                        percentage,
                        effectiveFrom,
                        createdAt: toMs(data?.createdAt, effectiveFrom),
                    });
                    return items;
                }, []);
                setManagerFeeHistory(history);
            }
            catch (e) {
                console.error('Error loading settings:', e);
            }
            finally {
                setIsSettingsLoaded(true);
            }
        };
        loadSettings();
    }, [userDocRef]);
    const saveManagerFeePercentage = useCallback(async (value: string | number) => {
        const percentage = parseManagerFeePercentage(value);
        const effectiveFrom = Date.now();
        const historyRef = userDocRef.collection('manager_fee_history').doc();
        const batch = userDocRef.firestore.batch();
        batch.set(userDocRef, {
            managerFeePercentage: percentage,
            managerFeeUpdatedAt: effectiveFrom,
        }, { merge: true });
        batch.set(historyRef, {
            percentage,
            effectiveFrom,
            createdAt: effectiveFrom,
        });
        await batch.commit();
        const formatted = formatManagerFeePercentage(percentage);
        const entry: ManagerFeeHistoryEntry = {
            id: historyRef.id,
            percentage,
            effectiveFrom,
            createdAt: effectiveFrom,
        };
        setManagerFeePercentage(formatted);
        setManagerFeeHistory((current) => [...current, entry].sort((a, b) => a.effectiveFrom - b.effectiveFrom));
        localStorage.setItem('managerFeePercentage', formatted);
    }, [userDocRef]);
    return {
        managerFeePercentage,
        managerFeeHistory,
        saveManagerFeePercentage,
        isSettingsLoaded
    };
}
