export type QueryPlanCollectionState = {
    received?: boolean;
    fromCache?: boolean;
    serverSynced?: boolean;
};

/**
 * A computation may use a collection only when its own listener is current.
 * Unrelated collections that the active plan intentionally omits must not
 * invalidate a fully-synced ledger needed by the active view.
 */
export function isCollectionReadyForCompute(
    collectionState: Record<string, QueryPlanCollectionState | undefined>,
    key: string,
    isOnline: boolean,
): boolean {
    const state = collectionState[key];
    return Boolean(state?.serverSynced || (!isOnline && state?.received));
}
