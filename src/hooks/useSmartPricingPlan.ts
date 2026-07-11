import { useCallback, useEffect, useMemo, useState } from 'react';
import { fieldValueServerTimestamp, type FirestoreDocumentReference } from '../firebase';
import { auth } from '../firebaseAuth';
import {
    DEFAULT_PRICING_POLICY,
    monthKeyFor,
    type CustomerSegment,
    type MarketStatus,
    type PricingMonthlyPlan,
    type PricingOverride,
    type PricingPolicyConfig,
    type PricingCurrency,
} from '../services/smartPricingEngine';

type SyncState = 'loading' | 'synced' | 'saving' | 'offline' | 'error';

type StoredPolicy = PricingPolicyConfig & {
    updatedAt?: number;
    updatedBy?: string;
    migratedFromLocalStorage?: boolean;
};

type StoredPlan = PricingMonthlyPlan & {
    updatedAt?: number;
    updatedBy?: string;
    migratedFromLocalStorage?: boolean;
};

function finite(value: unknown, fallback: number) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function localNumber(key: string, fallback: number) {
    try {
        const value = localStorage.getItem(key);
        return value === null ? fallback : finite(value, fallback);
    } catch {
        return fallback;
    }
}

function migratePolicyFromLocalStorage(): StoredPolicy {
    const volSmall = Math.max(0, localNumber('app_gm_adj_vol_small', DEFAULT_PRICING_POLICY.quantityAdjustments.small));
    const volLarge = -Math.abs(localNumber('app_gm_adj_vol_large', Math.abs(DEFAULT_PRICING_POLICY.quantityAdjustments.large)));
    return {
        ...DEFAULT_PRICING_POLICY,
        revision: 1,
        vipVolumeThreshold: Math.max(1, localNumber('app_tier_vip', DEFAULT_PRICING_POLICY.vipVolumeThreshold)),
        regularVolumeThreshold: Math.max(1, localNumber('app_tier_regular', DEFAULT_PRICING_POLICY.regularVolumeThreshold)),
        smallVolumeThreshold: Math.max(1, localNumber('app_tier_petit', DEFAULT_PRICING_POLICY.smallVolumeThreshold)),
        quantityAdjustments: {
            small: volSmall,
            medium: 0,
            large: volLarge,
        },
        negotiationBuffer: Math.max(0, localNumber('app_gm_buffer', DEFAULT_PRICING_POLICY.negotiationBuffer)),
        legacyGoalMixWeights: {
            vip: Math.max(0.1, localNumber('app_gm_weight_vip', 0.8)),
            regular: Math.max(0.1, localNumber('app_gm_weight_regular', 1)),
            petit: Math.max(0.1, localNumber('app_gm_weight_petit', 1.2)),
            new: Math.max(0.1, localNumber('app_gm_weight_new', 1.4)),
        },
        migratedFromLocalStorage: true,
        updatedAt: Date.now(),
        updatedBy: auth.currentUser?.uid,
    };
}

function migratePlanFromLocalStorage(monthKey: string): StoredPlan {
    const goal = Math.max(0, localNumber('app_monthly_profit_goal', 0));
    const minimum = Math.max(0, Math.min(goal || Number.MAX_SAFE_INTEGER, localNumber('app_min_monthly_goal', 0)));
    return {
        schemaVersion: 1,
        monthKey,
        revision: 1,
        monthlyGoal: goal,
        minimumGoal: minimum,
        expectedMonthlyVolume: {
            USDT: Math.max(0, localNumber('app_expected_monthly_vol', 0)),
        },
        migratedFromLocalStorage: true,
        updatedAt: Date.now(),
        updatedBy: auth.currentUser?.uid,
    };
}

function normalizePolicy(raw: Partial<StoredPolicy> | undefined): PricingPolicyConfig {
    if (!raw || raw.schemaVersion !== 1) return DEFAULT_PRICING_POLICY;
    return {
        ...DEFAULT_PRICING_POLICY,
        ...raw,
        schemaVersion: 1,
        modelVersion: raw.modelVersion || DEFAULT_PRICING_POLICY.modelVersion,
        revision: Math.max(1, finite(raw.revision, 1)),
        vipVolumeThreshold: Math.max(1, finite(raw.vipVolumeThreshold, DEFAULT_PRICING_POLICY.vipVolumeThreshold)),
        regularVolumeThreshold: Math.max(1, finite(raw.regularVolumeThreshold, DEFAULT_PRICING_POLICY.regularVolumeThreshold)),
        smallVolumeThreshold: Math.max(1, finite(raw.smallVolumeThreshold, DEFAULT_PRICING_POLICY.smallVolumeThreshold)),
        monthlyCapitalCostRate: Math.max(0, finite(raw.monthlyCapitalCostRate, DEFAULT_PRICING_POLICY.monthlyCapitalCostRate)),
        negotiationBuffer: Math.max(0, finite(raw.negotiationBuffer, DEFAULT_PRICING_POLICY.negotiationBuffer)),
        learnedNegotiationCap: Math.max(0, finite(raw.learnedNegotiationCap, DEFAULT_PRICING_POLICY.learnedNegotiationCap)),
        minNegotiationDeals: Math.max(1, Math.round(finite(raw.minNegotiationDeals, DEFAULT_PRICING_POLICY.minNegotiationDeals))),
        minHistoryDays: Math.max(1, Math.round(finite(raw.minHistoryDays, DEFAULT_PRICING_POLICY.minHistoryDays))),
        minHistoryDeals: Math.max(1, Math.round(finite(raw.minHistoryDeals, DEFAULT_PRICING_POLICY.minHistoryDeals))),
        highCreditUtilizationPct: Math.max(1, finite(raw.highCreditUtilizationPct, DEFAULT_PRICING_POLICY.highCreditUtilizationPct)),
        seriousOverdueDays: Math.max(1, Math.round(finite(raw.seriousOverdueDays, DEFAULT_PRICING_POLICY.seriousOverdueDays))),
        creditDefaultTermDays: Math.max(1, Math.round(finite(raw.creditDefaultTermDays, DEFAULT_PRICING_POLICY.creditDefaultTermDays))),
        goalPressureWarningMargin: Math.max(0, finite(raw.goalPressureWarningMargin, DEFAULT_PRICING_POLICY.goalPressureWarningMargin)),
        quantityAdjustments: {
            small: finite(raw.quantityAdjustments?.small, DEFAULT_PRICING_POLICY.quantityAdjustments.small),
            medium: finite(raw.quantityAdjustments?.medium, 0),
            large: finite(raw.quantityAdjustments?.large, DEFAULT_PRICING_POLICY.quantityAdjustments.large),
        },
        marketBands: raw.marketBands || DEFAULT_PRICING_POLICY.marketBands,
    };
}

function normalizePlan(raw: Partial<StoredPlan> | undefined, monthKey: string): PricingMonthlyPlan {
    const goal = Math.max(0, finite(raw?.monthlyGoal, 0));
    const minimum = Math.max(0, Math.min(goal || Number.MAX_SAFE_INTEGER, finite(raw?.minimumGoal, 0)));
    return {
        schemaVersion: 1,
        monthKey,
        revision: Math.max(1, finite(raw?.revision, 1)),
        monthlyGoal: goal,
        minimumGoal: minimum,
        expectedMonthlyVolume: {
            USDT: Math.max(0, finite(raw?.expectedMonthlyVolume?.USDT, 0)),
            ...(raw?.expectedMonthlyVolume?.EUR !== undefined
                ? { EUR: Math.max(0, finite(raw.expectedMonthlyVolume.EUR, 0)) }
                : {}),
        },
    };
}

/** End of the current day in the product's fixed business timezone (UTC+1). */
export function endOfAlgiersDay(now = Date.now()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Africa/Algiers', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(now);
    const value = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);
    return Date.UTC(value('year'), value('month') - 1, value('day') + 1) - 60 * 60 * 1000 - 1;
}

function overrideDocId(override: Pick<PricingOverride, 'kind' | 'currency' | 'clientId'>) {
    return override.kind === 'market'
        ? `market_${override.currency}`
        : `client_${override.currency}_${override.clientId || 'none'}`;
}

export function useSmartPricingPlan(userDocRef: FirestoreDocumentReference) {
    const monthKey = useMemo(() => monthKeyFor(), []);
    const [policy, setPolicy] = useState<PricingPolicyConfig>(DEFAULT_PRICING_POLICY);
    const [plan, setPlan] = useState<PricingMonthlyPlan>(() => normalizePlan(undefined, monthKey));
    const [overrides, setOverrides] = useState<PricingOverride[]>([]);
    const [syncState, setSyncState] = useState<SyncState>('loading');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        let unsubPolicy: (() => void) | undefined;
        let unsubPlan: (() => void) | undefined;
        let unsubOverrides: (() => void) | undefined;
        const settingsRef = userDocRef.collection('pricing_settings').doc('current');
        const planRef = userDocRef.collection('pricing_plans').doc(monthKey);
        const overridesRef = userDocRef.collection('pricing_overrides');

        const initialize = async () => {
            setSyncState('loading');
            setError(null);
            try {
                const [settingsSnap, planSnap] = await Promise.all([settingsRef.get(), planRef.get()]);
                if (!settingsSnap.exists) await settingsRef.set(migratePolicyFromLocalStorage());
                if (!planSnap.exists) await planRef.set(migratePlanFromLocalStorage(monthKey));
                if (!active) return;

                unsubPolicy = settingsRef.onSnapshot((snapshot) => {
                    if (!active) return;
                    if (snapshot.exists) {
                        const data = snapshot.data();
                        if (data?.schemaVersion !== 1) {
                            setError('pricing_schema_unsupported');
                            setSyncState('error');
                            return;
                        }
                        setPolicy(normalizePolicy(data));
                    }
                    setSyncState(navigator.onLine ? 'synced' : 'offline');
                });
                unsubPlan = planRef.onSnapshot((snapshot) => {
                    if (!active) return;
                    if (snapshot.exists) {
                        const data = snapshot.data();
                        if (data?.schemaVersion !== 1) {
                            setError('pricing_schema_unsupported');
                            setSyncState('error');
                            return;
                        }
                        setPlan(normalizePlan(data, monthKey));
                    }
                    setSyncState(navigator.onLine ? 'synced' : 'offline');
                });
                unsubOverrides = overridesRef.onSnapshot((snapshot) => {
                    if (!active) return;
                    const now = Date.now();
                    const rows = snapshot.docs
                        .map((doc) => ({ id: doc.id, ...doc.data() } as PricingOverride))
                        .filter((override) => !override.expiresAt || override.expiresAt > now);
                    setOverrides(rows);
                    setSyncState(navigator.onLine ? 'synced' : 'offline');
                });
            } catch (cause) {
                if (!active) return;
                console.error('Smart pricing sync initialization failed', cause);
                setError('pricing_sync_failed');
                setSyncState('error');
            }
        };
        void initialize();
        return () => {
            active = false;
            unsubPolicy?.();
            unsubPlan?.();
            unsubOverrides?.();
        };
    }, [monthKey, userDocRef]);

    const savePolicy = useCallback(async (patch: Partial<PricingPolicyConfig>) => {
        const next = normalizePolicy({ ...policy, ...patch, revision: policy.revision + 1 });
        setPolicy(next);
        setSyncState('saving');
        try {
            await userDocRef.collection('pricing_settings').doc('current').set({
                ...next,
                updatedAt: fieldValueServerTimestamp(),
                updatedBy: auth.currentUser?.uid,
            }, { merge: true });
            setSyncState(navigator.onLine ? 'synced' : 'offline');
        } catch (cause) {
            console.error('Smart pricing policy save failed', cause);
            setError('pricing_save_failed');
            setSyncState('error');
            throw cause;
        }
    }, [policy, userDocRef]);

    const savePlan = useCallback(async (patch: Partial<PricingMonthlyPlan>) => {
        const next = normalizePlan({ ...plan, ...patch, revision: plan.revision + 1 }, monthKey);
        setPlan(next);
        setSyncState('saving');
        try {
            await userDocRef.collection('pricing_plans').doc(monthKey).set({
                ...next,
                updatedAt: fieldValueServerTimestamp(),
                updatedBy: auth.currentUser?.uid,
            }, { merge: true });
            setSyncState(navigator.onLine ? 'synced' : 'offline');
        } catch (cause) {
            console.error('Smart pricing plan save failed', cause);
            setError('pricing_save_failed');
            setSyncState('error');
            throw cause;
        }
    }, [monthKey, plan, userDocRef]);

    const saveDailyMarketOverride = useCallback(async (
        currency: PricingCurrency,
        marketStatus: MarketStatus,
        reason: string,
    ) => {
        const row: PricingOverride = {
            schemaVersion: 1, revision: Date.now(), kind: 'market', currency, marketStatus, reason: reason.trim(),
            scope: 'today', expiresAt: endOfAlgiersDay(),
        };
        const id = overrideDocId(row);
        await userDocRef.collection('pricing_overrides').doc(id).set({
            ...row, updatedAt: fieldValueServerTimestamp(), updatedBy: auth.currentUser?.uid,
        });
    }, [userDocRef]);

    const saveDailyClientOverride = useCallback(async (
        currency: PricingCurrency,
        clientId: string,
        customerSegment: CustomerSegment,
        reason: string,
    ) => {
        const row: PricingOverride = {
            schemaVersion: 1, revision: Date.now(), kind: 'client', currency, clientId, customerSegment, reason: reason.trim(),
            scope: 'today', expiresAt: endOfAlgiersDay(),
        };
        const id = overrideDocId(row);
        await userDocRef.collection('pricing_overrides').doc(id).set({
            ...row, updatedAt: fieldValueServerTimestamp(), updatedBy: auth.currentUser?.uid,
        });
    }, [userDocRef]);

    const clearOverride = useCallback(async (kind: 'market' | 'client', currency: PricingCurrency, clientId?: string) => {
        await userDocRef.collection('pricing_overrides').doc(overrideDocId({ kind, currency, clientId })).delete();
    }, [userDocRef]);

    return {
        policy,
        plan,
        overrides,
        syncState,
        error,
        savePolicy,
        savePlan,
        saveDailyMarketOverride,
        saveDailyClientOverride,
        clearOverride,
    };
}
