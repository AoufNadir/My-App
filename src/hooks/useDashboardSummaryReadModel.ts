import { useEffect, useMemo, useState } from 'react';
import type { DashboardSummaryReadModel, ReadModelsMode } from '../readModels/dashboardReadModels';

type DashboardSummaryDocumentSnapshot = {
    exists: boolean;
    data: () => unknown;
    metadata?: { fromCache?: boolean };
};

type DashboardSummaryDocumentReference = {
    onSnapshot: (
        callback: (snapshot: DashboardSummaryDocumentSnapshot) => void,
        options?: { includeMetadataChanges?: boolean },
    ) => () => void;
};

type DashboardSummaryCollectionReference = {
    doc: (id: string) => DashboardSummaryDocumentReference;
};

type DashboardSummaryUserDocumentReference = {
    collection: (name: string) => DashboardSummaryCollectionReference;
};

export type DashboardSummaryReadState = {
    dashboardSummary: DashboardSummaryReadModel | null;
    isDashboardSummaryReady: boolean;
    hasServerSynced: boolean;
    error: Error | null;
};

export function useDashboardSummaryReadModel(
    userDocRef: DashboardSummaryUserDocumentReference,
    mode: ReadModelsMode,
): DashboardSummaryReadState {
    const enabled = mode === 'read';
    const [dashboardSummary, setDashboardSummary] = useState<DashboardSummaryReadModel | null>(null);
    const [hasReceived, setHasReceived] = useState(false);
    const [hasServerSynced, setHasServerSynced] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!enabled) {
            setDashboardSummary(null);
            setHasReceived(false);
            setHasServerSynced(false);
            setError(null);
            return;
        }
        const ref = userDocRef.collection('read_models').doc('dashboard_summary');
        return ref.onSnapshot((snapshot) => {
            const fromCache = Boolean(snapshot.metadata?.fromCache);
            setHasReceived(true);
            setHasServerSynced((current) => current || !fromCache);
            setError(null);
            setDashboardSummary(snapshot.exists ? snapshot.data() as DashboardSummaryReadModel : null);
        }, { includeMetadataChanges: true });
    }, [enabled, userDocRef]);

    return useMemo(() => ({
        dashboardSummary,
        isDashboardSummaryReady: enabled ? Boolean(dashboardSummary && hasReceived) : false,
        hasServerSynced,
        error,
    }), [dashboardSummary, enabled, error, hasReceived, hasServerSynced]);
}
