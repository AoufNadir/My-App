// V17-3 (owner, 2026-11-19): the edit log. Every time a money line that already exists is changed or deleted, a line
// « before / after » is kept in the collection `edit_log`, in the SAME write (batch or transaction) as the change, so
// one never exists without the other. Creating a line logs nothing (the line itself is the record). No figure, balance
// or stored money field changes: the log is a new collection that nothing reads to compute.
//
// The « before » comes from what the app already has in memory (MainApp gives a source); no extra read is made.

export const EDIT_LOG_COLLECTION = 'edit_log';
/** A batch larger than this (a reset, an import) is not logged line by line: it would pass Firestore's 500 writes. */
export const EDIT_LOG_MAX_OPERATIONS = 240;

/** The fields worth keeping: amounts, prices, dates, who, how. */
export const EDIT_LOG_FIELDS = [
    'amount', 'montant', 'quantity', 'price', 'sell', 'total', 'amountDzd', 'settledAmount',
    'type', 'origin', 'currency', 'source', 'destination', 'paymentMethod', 'advanceState',
    'clientId', 'linkedClientId', 'investorId', 'payee', 'notes', 'date', 'time', 'timestamp',
    'fullName', 'initialCapital', 'percentage',
] as const;
/** The fields that are money: a change of one of them is what the guard watches. */
export const EDIT_LOG_MONEY_FIELDS = ['amount', 'montant', 'quantity', 'price', 'sell', 'total', 'amountDzd', 'settledAmount'] as const;

export type EditLogEntry = {
    at: number;
    collection: string;
    docId: string;
    kind: 'edit' | 'delete';
    before: Record<string, unknown>;
    after: Record<string, unknown> | null;
};
type Source = (collection: string, docId: string) => Record<string, unknown> | undefined;

let source: Source | null = null;
/** MainApp gives what it holds in memory; null when nobody is signed in (tests: nothing is logged). */
export function setEditLogSource(next: Source | null) {
    source = next;
}

const isPlain = (v: unknown) => v === null || ['string', 'number', 'boolean'].includes(typeof v);
function pick(data: Record<string, unknown> | undefined | null): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    if (!data) return out;
    for (const key of EDIT_LOG_FIELDS) {
        const value = data[key];
        if (value !== undefined && isPlain(value)) out[key] = value;
    }
    return out;
}
const same = (a: Record<string, unknown>, b: Record<string, unknown>) => {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) if (a[k] !== b[k]) return false;
    return true;
};

/**
 * The log line for one write, or null (a creation, a path that is not money, nothing tracked changed, no source).
 * `path` is users/{uid}/{collection}/{docId}; `isMoney` says whether that collection holds money.
 */
export function editLogEntryFor(input: {
    path: string;
    kind: 'set' | 'update' | 'delete';
    data?: Record<string, unknown>;
    merge?: boolean;
    isMoney: (collection: string) => boolean;
    now?: number;
}): { userPath: string; entry: EditLogEntry } | null {
    if (!source) return null;
    const segments = input.path.split('/');
    if (segments.length !== 4 || segments[0] !== 'users') return null;
    const [, uid, collection, docId] = segments;
    if (!input.isMoney(collection)) return null;
    const existing = source(collection, docId);
    if (!existing) return null; // a creation
    const before = pick(existing);
    let after: Record<string, unknown> | null;
    if (input.kind === 'delete') after = null;
    else if (input.kind === 'update' || input.merge) {
        // A deleteField() (an object) removes the field; any other object is not kept.
        const merged: Record<string, unknown> = { ...existing };
        for (const [k, v] of Object.entries(input.data || {})) {
            if (isPlain(v)) merged[k] = v;
            else if (v && typeof v === 'object' && /delete/i.test(String((v as { _methodName?: unknown })._methodName ?? ''))) delete merged[k];
        }
        after = pick(merged);
    } else after = pick(input.data);
    if (after && same(before, after)) return null;
    return {
        userPath: `users/${uid}`,
        entry: { at: input.now ?? Date.now(), collection, docId, kind: after ? 'edit' : 'delete', before, after },
    };
}

/** The money field that changed most in an entry (for the bell and the list), or null. */
export function moneyChange(entry: Pick<EditLogEntry, 'before' | 'after'>): { field: string; from: number; to: number | null } | null {
    let best: { field: string; from: number; to: number | null; diff: number } | null = null;
    for (const field of EDIT_LOG_MONEY_FIELDS) {
        const from = Number(entry.before[field]);
        if (!Number.isFinite(from)) continue;
        const toRaw = entry.after ? Number(entry.after[field]) : null;
        const to = toRaw === null || !Number.isFinite(toRaw) ? null : toRaw;
        if (entry.after && to === from) continue;
        const diff = Math.abs((to ?? 0) - from);
        if (!best || diff > best.diff) best = { field, from, to, diff };
    }
    return best ? { field: best.field, from: best.from, to: best.to } : null;
}
