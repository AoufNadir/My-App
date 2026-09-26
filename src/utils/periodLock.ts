// Month closing. Once a month's profits have been distributed, its operations are frozen:
// editing or deleting one of them, or adding one dated inside it, would change profits the
// investors were already paid (the PAM ledger and the profit split are recomputed from the
// whole history). The lock is one date, `lockedThrough`: every operation dated at or before
// it is closed. It always falls on the last millisecond of a month (local time), and a month
// can only be reopened together with the months after it, because editing it changes their
// profits too.

/** Collections whose rows are dated operations. Entities (clients, investors, cards) are not locked. */
export const PERIOD_LOCK_COLLECTIONS: ReadonlySet<string> = new Set([
    'usdt_txs',
    'dzd_client_txs',
    'treasury_txs',
    'digital_service_txs',
    'actifTransactions',
    'investor_transactions',
]);

export type PeriodLockReason = 'profit_distribution' | 'manual_lock' | 'manual_reopen';

export type PeriodLockWrite = {
    /** users/{uid}/{collection}/{docId}; a document created with `add` ends in `/_`. */
    path: string;
    kind: 'create' | 'set' | 'update' | 'delete';
    data?: Record<string, unknown>;
};

export type PeriodLockViolation = {
    collection: string;
    docId: string;
    /** Date of the closed operation that the write would change. */
    timestamp: number;
};

/** First millisecond (local time) of the month containing `ts`. */
export function startOfMonth(ts: number): number {
    const date = new Date(ts);
    return new Date(date.getFullYear(), date.getMonth(), 1).getTime();
}

/** Last millisecond (local time) of the month containing `ts`. */
export function endOfMonth(ts: number): number {
    const date = new Date(ts);
    return new Date(date.getFullYear(), date.getMonth() + 1, 1).getTime() - 1;
}

/** Last millisecond (local time) of the month before the one containing `ts`. */
export function endOfPreviousMonth(ts: number): number {
    return startOfMonth(ts) - 1;
}

export function readPeriodLockedThrough(value: unknown): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function isInLockedPeriod(timestamp: unknown, lockedThrough: number | null | undefined): boolean {
    if (lockedThrough == null)
        return false;
    const ts = Number(timestamp);
    return Number.isFinite(ts) && ts <= lockedThrough;
}

/**
 * Lock after a profit distribution made at `distributionTs`: every month before the
 * distribution's month is closed. Returns null when that is already the case (the lock
 * never moves back on its own).
 */
export function lockAfterDistribution(currentLockedThrough: number | null | undefined, distributionTs: number): number | null {
    const next = endOfPreviousMonth(distributionTs);
    return currentLockedThrough != null && currentLockedThrough >= next ? null : next;
}

/** Lock after reopening the month that starts at `monthStartTs` (and every month after it). */
export function lockAfterReopening(monthStartTs: number): number {
    return endOfPreviousMonth(monthStartTs);
}

/** Closed months, most recent first: the ones the user can choose to reopen from. */
export function closedMonthStarts(lockedThrough: number | null | undefined, maxMonths = 24): number[] {
    if (lockedThrough == null)
        return [];
    const months: number[] = [];
    let monthStart = startOfMonth(lockedThrough);
    for (let i = 0; i < maxMonths; i += 1) {
        months.push(monthStart);
        monthStart = startOfMonth(monthStart - 1);
    }
    return months;
}

/**
 * The first write that would change a closed month, or null. `savedTimestamp` gives the date
 * of an operation already saved (from the data the app has loaded), undefined when unknown.
 */
export function findPeriodLockViolation(input: {
    lockedThrough: number | null | undefined;
    writes: readonly PeriodLockWrite[];
    savedTimestamp: (collection: string, docId: string) => number | undefined;
}): PeriodLockViolation | null {
    const { lockedThrough } = input;
    if (lockedThrough == null)
        return null;
    for (const write of input.writes) {
        const [root, , collection, docId] = write.path.split('/');
        if (root !== 'users' || !collection || !docId || !PERIOD_LOCK_COLLECTIONS.has(collection))
            continue;
        // Editing or deleting an operation of a closed month.
        if (write.kind !== 'create') {
            const saved = input.savedTimestamp(collection, docId);
            if (saved !== undefined && isInLockedPeriod(saved, lockedThrough))
                return { collection, docId, timestamp: saved };
        }
        // Saving an operation dated inside a closed month: a new one, or one moved there.
        if (write.kind !== 'delete' && write.data && 'timestamp' in write.data) {
            const timestamp = Number(write.data.timestamp);
            if (isInLockedPeriod(timestamp, lockedThrough))
                return { collection, docId, timestamp };
        }
    }
    return null;
}

/** Looks up the date of a saved operation in the rows the app has loaded, by collection. */
export function savedTimestampFrom(savedOperations: Readonly<Record<string, readonly { id: string; timestamp?: unknown }[] | undefined>>) {
    return (collection: string, docId: string): number | undefined => {
        const row = savedOperations[collection]?.find((item) => item.id === docId);
        const timestamp = Number(row?.timestamp);
        return row && Number.isFinite(timestamp) ? timestamp : undefined;
    };
}

/** dd/mm/yyyy in local time, like the dates the app saves with each operation. */
export function formatLockDate(ts: number): string {
    const date = new Date(ts);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}/${date.getFullYear()}`;
}

export function formatLockMonth(ts: number, monthNames: readonly string[]): string {
    const date = new Date(ts);
    const name = monthNames[date.getMonth()] || String(date.getMonth() + 1).padStart(2, '0');
    return `${name} ${date.getFullYear()}`;
}

/** Fields saved on the user document. */
export function periodLockFields(lockedThrough: number | null, reason: PeriodLockReason, at: number) {
    return {
        // 0 means no closed month.
        periodLockedThrough: lockedThrough ?? 0,
        periodLockReason: reason,
        periodLockUpdatedAt: at,
    };
}

/** One row of users/{uid}/period_lock_history: when each month was closed or reopened. */
export function periodLockHistoryEntry(previousLockedThrough: number | null, lockedThrough: number | null, reason: PeriodLockReason, at: number) {
    return {
        previousLockedThrough: previousLockedThrough ?? 0,
        lockedThrough: lockedThrough ?? 0,
        reason,
        at,
    };
}
