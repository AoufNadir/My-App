type TxLifecycleStage =
    | 'edit-click'
    | 'delete-click'
    | 'handler-start'
    | 'legacy-read'
    | 'linked-rows'
    | 'old-delta'
    | 'new-delta'
    | 'commit-start'
    | 'commit-result'
    | 'ERROR';

function isTxLifecycleDebugEnabled(): boolean {
    const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
    return env?.VITE_TX_LIFECYCLE_DEBUG === 'true' || env?.VITE_VERCEL_ENV === 'preview';
}

export function logTxLifecycle(stage: TxLifecycleStage, payload: Record<string, unknown> = {}): void {
    if (!isTxLifecycleDebugEnabled()) return;
    console.log(`[TX-LIFECYCLE] ${stage}`, payload);
}

export function logTxLifecycleError(error: unknown, payload: Record<string, unknown> = {}): void {
    if (!isTxLifecycleDebugEnabled()) return;
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[TX-LIFECYCLE] ERROR', {
        name: err.name,
        message: err.message,
        stack: err.stack,
        ...payload,
    });
}
