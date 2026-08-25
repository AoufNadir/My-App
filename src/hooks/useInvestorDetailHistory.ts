import { useEffect, useMemo, useState } from 'react';
import type { FirestoreDocumentReference } from '../firebase';
import type { InvestorTransaction } from '../types';

const DEFAULT_RECENT_INVESTOR_HISTORY_LIMIT = 100;

export type InvestorDetailQueryPlan =
    | { enabled: false; signature: 'off' }
    | { enabled: true; investorId: string; limit: number; signature: string };

type InvestorDetailQueryLike = {
    where: (field: string, operator: '==', value: string) => InvestorDetailQueryLike;
    orderBy: (field: string, direction: 'desc') => InvestorDetailQueryLike;
    limit: (count: number) => InvestorDetailQueryLike;
};

type InvestorHistoryState = {
    received: boolean;
    fromCache: boolean;
    serverSynced: boolean;
};

const INITIAL_STATE: InvestorHistoryState = {
    received: false,
    fromCache: false,
    serverSynced: false,
};

/** Builds the exact Firestore plan for a selected investor's visible history. */
export function buildInvestorDetailQueryPlan({
    investorId,
    resultLimit,
}: {
    investorId: string | null | undefined;
    resultLimit?: number;
}): InvestorDetailQueryPlan {
    if (!investorId)
        return { enabled: false, signature: 'off' };

    const limit = resultLimit && resultLimit > 0
        ? Math.floor(resultLimit)
        : DEFAULT_RECENT_INVESTOR_HISTORY_LIMIT;
    return {
        enabled: true,
        investorId,
        limit,
        signature: `investor:${investorId}:limit:${limit}`,
    };
}

/** Applies filtering, newest-first ordering, and a positive Firestore limit. */
export function applyInvestorDetailQueryPlan<T extends InvestorDetailQueryLike>(query: T, plan: InvestorDetailQueryPlan): T {
    if (!plan.enabled)
        return query;
    return query
        .where('investorId', '==', plan.investorId)
        .orderBy('timestamp', 'desc')
        .limit(plan.limit) as T;
}

/**
 * Bounded, per-investor history for the detail screen. The cache is retained by
 * investor ID so returning to the same detail view paints immediately while its
 * current listener synchronizes in the background.
 */
export function useInvestorDetailHistory(
    userDocRef: FirestoreDocumentReference,
    investorId: string | null | undefined,
    resultLimit?: number,
) {
    const queryPlan = useMemo(
        () => buildInvestorDetailQueryPlan({ investorId, resultLimit }),
        [investorId, resultLimit],
    );
    const [transactionsByInvestor, setTransactionsByInvestor] = useState<Record<string, InvestorTransaction[]>>({});
    const [state, setState] = useState<InvestorHistoryState>(INITIAL_STATE);

    useEffect(() => {
        if (!queryPlan.enabled) {
            setState(INITIAL_STATE);
            return;
        }

        setState(INITIAL_STATE);
        const query = applyInvestorDetailQueryPlan(
            userDocRef.collection('investor_transactions') as any,
            queryPlan,
        ) as any;
        return query.onSnapshot((snapshot: any) => {
            const fromCache = Boolean(snapshot.metadata?.fromCache);
            const rows = snapshot.docs
                .map((doc: any) => ({ id: doc.id, ...doc.data() } as InvestorTransaction))
                .sort((left: InvestorTransaction, right: InvestorTransaction) => Number(right.timestamp || 0) - Number(left.timestamp || 0));
            setTransactionsByInvestor((current) => ({
                ...current,
                [queryPlan.investorId]: rows,
            }));
            setState((current) => ({
                received: true,
                fromCache,
                serverSynced: current.serverSynced || !fromCache,
            }));
        }, { includeMetadataChanges: true });
    }, [userDocRef, queryPlan]);

    const transactions = queryPlan.enabled
        ? transactionsByInvestor[queryPlan.investorId] || []
        : [];
    return {
        transactions,
        queryPlan,
        state,
    };
}
