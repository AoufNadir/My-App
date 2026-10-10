import { addDoc, collection, deleteField, deleteDoc, doc, getDoc, getDocs, getFirestore, initializeFirestore, limit, onSnapshot, orderBy, persistentLocalCache, persistentMultipleTabManager, query, runTransaction as nativeRunTransaction, serverTimestamp, setDoc, updateDoc, where, writeBatch, type DocumentData, type DocumentReference as NativeDocumentReference, type DocumentSnapshot as NativeDocumentSnapshot, type Firestore, type OrderByDirection, type Query as NativeQuery, type QuerySnapshot as NativeQuerySnapshot, type SetOptions, type Transaction as NativeTransaction, type Unsubscribe, type WhereFilterOp, type WriteBatch as NativeWriteBatch, } from 'firebase/firestore';
import { app } from './firebaseApp';
// FIX-PERF (Phase 3): enable IndexedDB-backed persistent cache so cold starts
// hydrate instantly from local storage while the live snapshot listeners
// reconcile in the background. Multi-tab manager keeps multiple open tabs
// in sync.
let firestore: Firestore;
try {
    firestore = initializeFirestore(app, {
        localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager(),
        }),
        // A single stray `undefined` in a nested map (e.g. pricing snapshots)
        // must not abort a whole sale batch. Writers still strip undefined
        // explicitly; this is the safety net.
        ignoreUndefinedProperties: true,
    });
}
catch {
    // initializeFirestore throws if called twice (HMR) or if the environment
    // does not support persistence — fall back to the default in-memory cache
    // (without ignoreUndefinedProperties; dev-only path).
    firestore = getFirestore(app);
}
export type { AppUser } from './firebaseAuth';
type FirestoreReadDiagnosticKind = 'query' | 'collection' | 'document';
type FirestoreReadDiagnosticEntry = {
    id: number;
    kind: FirestoreReadDiagnosticKind;
    label: string;
    startedAt: number;
};
type FirestoreReadDiagnosticBucket = {
    getCalls: number;
    listenerStarts: number;
    listenerStops: number;
    activeListeners: number;
};
type FirestoreReadDiagnosticSnapshot = {
    note: string;
    getCalls: number;
    listenerStarts: number;
    listenerStops: number;
    activeListeners: number;
    active: FirestoreReadDiagnosticEntry[];
    byLabel: Record<string, FirestoreReadDiagnosticBucket>;
};
type FirestoreReadDiagnosticApi = {
    snapshot: () => FirestoreReadDiagnosticSnapshot;
    reset: () => void;
};
declare global {
    interface Window {
        __PRO_DIGITAL_FIRESTORE_DIAG__?: FirestoreReadDiagnosticApi;
    }
}
const createEmptyDiagnosticBucket = (): FirestoreReadDiagnosticBucket => ({
    getCalls: 0,
    listenerStarts: 0,
    listenerStops: 0,
    activeListeners: 0
});
const firestoreReadDiagnostics = (() => {
    let nextListenerId = 1;
    let getCalls = 0;
    let listenerStarts = 0;
    let listenerStops = 0;
    const activeListeners = new Map<number, FirestoreReadDiagnosticEntry>();
    const byLabel = new Map<string, FirestoreReadDiagnosticBucket>();
    const bucketFor = (label: string) => {
        const existing = byLabel.get(label);
        if (existing)
            return existing;
        const bucket = createEmptyDiagnosticBucket();
        byLabel.set(label, bucket);
        return bucket;
    };
    const toSnapshot = (): FirestoreReadDiagnosticSnapshot => ({
        note: 'Diagnostic local only: counts Firestore get() calls and listener lifecycle events. It is not a billed document-read counter.',
        getCalls,
        listenerStarts,
        listenerStops,
        activeListeners: activeListeners.size,
        active: Array.from(activeListeners.values()),
        byLabel: Object.fromEntries(byLabel.entries())
    });
    const api = {
        trackGet(label: string) {
            getCalls += 1;
            bucketFor(label).getCalls += 1;
        },
        startListener(kind: FirestoreReadDiagnosticKind, label: string) {
            const id = nextListenerId++;
            const startedAt = Date.now();
            listenerStarts += 1;
            const bucket = bucketFor(label);
            bucket.listenerStarts += 1;
            bucket.activeListeners += 1;
            activeListeners.set(id, { id, kind, label, startedAt });
            return id;
        },
        stopListener(id: number) {
            const entry = activeListeners.get(id);
            if (!entry)
                return;
            activeListeners.delete(id);
            listenerStops += 1;
            const bucket = bucketFor(entry.label);
            bucket.listenerStops += 1;
            bucket.activeListeners = Math.max(0, bucket.activeListeners - 1);
        },
        snapshot: toSnapshot,
        reset() {
            nextListenerId = 1;
            getCalls = 0;
            listenerStarts = 0;
            listenerStops = 0;
            activeListeners.clear();
            byLabel.clear();
        }
    };
    if (typeof window !== 'undefined')
        window.__PRO_DIGITAL_FIRESTORE_DIAG__ = {
            snapshot: api.snapshot,
            reset: api.reset
        };
    return api;
})();
class FirestoreQuerySnapshot {
    constructor(private readonly nativeSnapshot: NativeQuerySnapshot<DocumentData>, private readonly compatDb: FirestoreCompat) { }
    get docs() {
        return this.nativeSnapshot.docs.map((docSnap) => new FirestoreDocumentSnapshot(docSnap, this.compatDb));
    }
    get size() {
        return this.nativeSnapshot.size;
    }
    get empty() {
        return this.nativeSnapshot.empty;
    }
    get metadata() {
        return this.nativeSnapshot.metadata;
    }
    forEach(callback: (doc: FirestoreDocumentSnapshot) => void) {
        this.nativeSnapshot.forEach((docSnap) => callback(new FirestoreDocumentSnapshot(docSnap, this.compatDb)));
    }
    docChanges() {
        return this.nativeSnapshot.docChanges().map((change) => ({
            type: change.type,
            doc: new FirestoreDocumentSnapshot(change.doc, this.compatDb),
            oldIndex: change.oldIndex,
            newIndex: change.newIndex
        }));
    }
}
class FirestoreQuery {
    constructor(private readonly nativeQuery: NativeQuery<DocumentData>, private readonly compatDb: FirestoreCompat, private readonly debugLabel: string) { }
    where(fieldPath: string, opStr: WhereFilterOp, value: unknown) {
        return new FirestoreQuery(query(this.nativeQuery, where(fieldPath, opStr, value)), this.compatDb, `${this.debugLabel}.where(${fieldPath},${opStr})`);
    }
    orderBy(fieldPath: string, directionStr: OrderByDirection = 'asc') {
        return new FirestoreQuery(query(this.nativeQuery, orderBy(fieldPath, directionStr)), this.compatDb, `${this.debugLabel}.orderBy(${fieldPath},${directionStr})`);
    }
    limit(limitNumber: number) {
        return new FirestoreQuery(query(this.nativeQuery, limit(limitNumber)), this.compatDb, `${this.debugLabel}.limit(${limitNumber})`);
    }
    async get() {
        firestoreReadDiagnostics.trackGet(this.debugLabel);
        const snapshot = await getDocs(this.nativeQuery);
        return new FirestoreQuerySnapshot(snapshot, this.compatDb);
    }
    onSnapshot(callback: (snapshot: FirestoreQuerySnapshot) => void, options?: {
        includeMetadataChanges?: boolean;
    }): Unsubscribe {
        const listenerId = firestoreReadDiagnostics.startListener('query', this.debugLabel);
        const unsubscribe = options
            ? onSnapshot(this.nativeQuery, options, (snapshot) => callback(new FirestoreQuerySnapshot(snapshot, this.compatDb)))
            : onSnapshot(this.nativeQuery, (snapshot) => callback(new FirestoreQuerySnapshot(snapshot, this.compatDb)));
        return () => {
            firestoreReadDiagnostics.stopListener(listenerId);
            unsubscribe();
        };
    }
}
class FirestoreCollectionReference {
    constructor(private readonly nativeCollectionPath: string, private readonly compatDb: FirestoreCompat) { }
    private nativeCollection() {
        return collection(firestore, this.nativeCollectionPath);
    }
    doc(id?: string) {
        const nativeRef = id ? doc(this.nativeCollection(), id) : doc(this.nativeCollection());
        return new FirestoreDocumentReference(nativeRef, this.compatDb);
    }
    async add(data: DocumentData) {
        const refusal = financialWriteRefusal([{ path: `${this.nativeCollectionPath}/_`, kind: 'create', data }]);
        if (refusal)
            throw refusal;
        const nativeRef = await addDoc(this.nativeCollection(), data);
        return new FirestoreDocumentReference(nativeRef, this.compatDb);
    }
    where(fieldPath: string, opStr: WhereFilterOp, value: unknown) {
        return new FirestoreQuery(query(this.nativeCollection(), where(fieldPath, opStr, value)), this.compatDb, `${this.nativeCollectionPath}.where(${fieldPath},${opStr})`);
    }
    orderBy(fieldPath: string, directionStr: OrderByDirection = 'asc') {
        return new FirestoreQuery(query(this.nativeCollection(), orderBy(fieldPath, directionStr)), this.compatDb, `${this.nativeCollectionPath}.orderBy(${fieldPath},${directionStr})`);
    }
    limit(limitNumber: number) {
        return new FirestoreQuery(query(this.nativeCollection(), limit(limitNumber)), this.compatDb, `${this.nativeCollectionPath}.limit(${limitNumber})`);
    }
    async get() {
        firestoreReadDiagnostics.trackGet(this.nativeCollectionPath);
        const snapshot = await getDocs(this.nativeCollection());
        return new FirestoreQuerySnapshot(snapshot, this.compatDb);
    }
    onSnapshot(callback: (snapshot: FirestoreQuerySnapshot) => void, options?: {
        includeMetadataChanges?: boolean;
    }): Unsubscribe {
        const listenerId = firestoreReadDiagnostics.startListener('collection', this.nativeCollectionPath);
        const unsubscribe = options
            ? onSnapshot(this.nativeCollection(), options, (snapshot) => callback(new FirestoreQuerySnapshot(snapshot, this.compatDb)))
            : onSnapshot(this.nativeCollection(), (snapshot) => callback(new FirestoreQuerySnapshot(snapshot, this.compatDb)));
        return () => {
            firestoreReadDiagnostics.stopListener(listenerId);
            unsubscribe();
        };
    }
}
// ── Financial write gate ──
// While the app shows figures from the local cache (before the first server
// sync), a write could be validated against stale balances. MainApp installs a
// gate that refuses writes to financial collections until the server answered.
// The same gate refuses writes that would change a closed month (utils/periodLock).
const FINANCIAL_COLLECTIONS = new Set([
    'usdt_txs', 'dzd_clients', 'dzd_client_txs', 'treasury_txs', 'treasury_cards',
    'digital_service_txs', 'manual_assets', 'manual_asset_clients', 'actifTransactions',
    'investors', 'investor_transactions',
    // A count compares with the books: made on stale balances it would show false differences.
    'cash_counts',
]);
export type FinancialWrite = {
    path: string;
    kind: 'create' | 'set' | 'update' | 'delete';
    data?: DocumentData;
};
type FinancialWriteGate = {
    /** Returns a user-facing reason while writes must wait, otherwise null. */
    blockedReason: () => string | null;
    /** Returns a user-facing reason when these particular writes must be refused, otherwise null. */
    refusedWritesReason?: (writes: readonly FinancialWrite[]) => string | null;
    /** Called (after the caller's own error handling) with the reason of a refused write. */
    onBlocked?: (reason: string) => void;
};
let financialWriteGate: FinancialWriteGate | null = null;
export function setFinancialWriteGate(gate: FinancialWriteGate | null) {
    financialWriteGate = gate;
}
export class FinancialWriteBlockedError extends Error {
    constructor(reason: string) {
        super(reason);
        this.name = 'FinancialWriteBlockedError';
    }
}
function isFinancialPath(path: string): boolean {
    // users/{uid}/{collection}/{docId}...
    const segments = path.split('/');
    return segments[0] === 'users' && FINANCIAL_COLLECTIONS.has(segments[2] || '');
}
export function financialWriteRefusal(writes: readonly (string | FinancialWrite)[]): FinancialWriteBlockedError | null {
    const financialWrites = writes
        .map((write): FinancialWrite => (typeof write === 'string' ? { path: write, kind: 'set' } : write))
        .filter((write) => isFinancialPath(write.path));
    if (!financialWriteGate || financialWrites.length === 0)
        return null;
    const reason = financialWriteGate.blockedReason()
        || financialWriteGate.refusedWritesReason?.(financialWrites)
        || null;
    if (!reason)
        return null;
    const onBlocked = financialWriteGate?.onBlocked;
    // Deferred so this message replaces the generic error the caller shows.
    if (onBlocked)
        setTimeout(() => onBlocked(reason), 0);
    return new FinancialWriteBlockedError(reason);
}
export type FirestoreBatchOperation =
    | { kind: 'set'; ref: FirestoreDocumentReference; data: DocumentData; options?: SetOptions }
    | { kind: 'update'; ref: FirestoreDocumentReference; data: DocumentData }
    | { kind: 'delete'; ref: FirestoreDocumentReference };

export class FirestoreWriteBatch {
    readonly operations: FirestoreBatchOperation[] = [];
    constructor(private readonly nativeBatch: NativeWriteBatch) { }
    set(ref: FirestoreDocumentReference, data: DocumentData, options?: SetOptions) {
        this.operations.push({ kind: 'set', ref, data, options });
        if (options) {
            this.nativeBatch.set(ref.nativeRef, data, options);
            return;
        }
        this.nativeBatch.set(ref.nativeRef, data);
    }
    update(ref: FirestoreDocumentReference, data: DocumentData) {
        this.operations.push({ kind: 'update', ref, data });
        this.nativeBatch.update(ref.nativeRef, data);
    }
    delete(ref: FirestoreDocumentReference) {
        this.operations.push({ kind: 'delete', ref });
        this.nativeBatch.delete(ref.nativeRef);
    }
    commit() {
        const refusal = financialWriteRefusal(this.operations.map((operation) => ({
            path: operation.ref.nativeRef.path,
            kind: operation.kind,
            data: operation.kind === 'delete' ? undefined : operation.data,
        })));
        if (refusal)
            return Promise.reject(refusal);
        return this.nativeBatch.commit();
    }
}
export class FirestoreTransaction {
    constructor(private readonly nativeTransaction: NativeTransaction, private readonly compatDb: FirestoreCompat) { }
    async get(ref: FirestoreDocumentReference) {
        firestoreReadDiagnostics.trackGet(`transaction:${ref.nativeRef.path}`);
        const snapshot = await this.nativeTransaction.get(ref.nativeRef);
        return new FirestoreDocumentSnapshot(snapshot, this.compatDb);
    }
    set(ref: FirestoreDocumentReference, data: DocumentData, options?: SetOptions) {
        throwIfFinancialWriteBlocked({ path: ref.nativeRef.path, kind: 'set', data });
        if (options) {
            this.nativeTransaction.set(ref.nativeRef, data, options);
            return;
        }
        this.nativeTransaction.set(ref.nativeRef, data);
    }
    update(ref: FirestoreDocumentReference, data: DocumentData) {
        throwIfFinancialWriteBlocked({ path: ref.nativeRef.path, kind: 'update', data });
        this.nativeTransaction.update(ref.nativeRef, data);
    }
    delete(ref: FirestoreDocumentReference) {
        throwIfFinancialWriteBlocked({ path: ref.nativeRef.path, kind: 'delete' });
        this.nativeTransaction.delete(ref.nativeRef);
    }
}
// Transaction writes (order completion, summary writer) go through the same gate:
// throwing aborts the whole transaction before anything is committed.
function throwIfFinancialWriteBlocked(write: FinancialWrite) {
    const refusal = financialWriteRefusal([write]);
    if (refusal)
        throw refusal;
}
export class FirestoreDocumentReference {
    constructor(readonly nativeRef: NativeDocumentReference<DocumentData>, private readonly compatDb: FirestoreCompat) { }
    get id() {
        return this.nativeRef.id;
    }
    get firestore() {
        return this.compatDb;
    }
    collection(collectionName: string) {
        return new FirestoreCollectionReference(`${this.nativeRef.path}/${collectionName}`, this.compatDb);
    }
    async get() {
        firestoreReadDiagnostics.trackGet(this.nativeRef.path);
        const snapshot = await getDoc(this.nativeRef);
        return new FirestoreDocumentSnapshot(snapshot, this.compatDb);
    }
    set(data: DocumentData, options?: SetOptions) {
        const refusal = financialWriteRefusal([{ path: this.nativeRef.path, kind: 'set', data }]);
        if (refusal)
            return Promise.reject(refusal);
        if (options) {
            return setDoc(this.nativeRef, data, options);
        }
        return setDoc(this.nativeRef, data);
    }
    update(data: DocumentData) {
        const refusal = financialWriteRefusal([{ path: this.nativeRef.path, kind: 'update', data }]);
        if (refusal)
            return Promise.reject(refusal);
        return updateDoc(this.nativeRef, data);
    }
    delete() {
        const refusal = financialWriteRefusal([{ path: this.nativeRef.path, kind: 'delete' }]);
        if (refusal)
            return Promise.reject(refusal);
        return deleteDoc(this.nativeRef);
    }
    onSnapshot(callback: (snapshot: FirestoreDocumentSnapshot) => void, options?: {
        includeMetadataChanges?: boolean;
    }, onError?: (error: Error) => void): Unsubscribe {
        const listenerId = firestoreReadDiagnostics.startListener('document', this.nativeRef.path);
        const unsubscribe = onSnapshot(this.nativeRef, options ?? {}, (snap) => callback(new FirestoreDocumentSnapshot(snap, this.compatDb)), onError);
        return () => {
            firestoreReadDiagnostics.stopListener(listenerId);
            unsubscribe();
        };
    }
}
class FirestoreDocumentSnapshot {
    constructor(private readonly nativeSnapshot: NativeDocumentSnapshot<DocumentData>, private readonly compatDb: FirestoreCompat) { }
    get id() {
        return this.nativeSnapshot.id;
    }
    get exists() {
        return this.nativeSnapshot.exists();
    }
    get ref() {
        return new FirestoreDocumentReference(this.nativeSnapshot.ref, this.compatDb);
    }
    data() {
        return this.nativeSnapshot.data() as any;
    }
}
class FirestoreCompat {
    constructor(private readonly nativeFirestore: Firestore) { }
    collection(path: string) {
        return new FirestoreCollectionReference(path, this);
    }
    batch() {
        return new FirestoreWriteBatch(writeBatch(this.nativeFirestore));
    }
    async runTransaction<T>(updateFunction: (transaction: FirestoreTransaction) => Promise<T>): Promise<T> {
        return nativeRunTransaction(this.nativeFirestore, (nativeTransaction) => updateFunction(new FirestoreTransaction(nativeTransaction, this)));
    }
}
export const db = new FirestoreCompat(firestore);
export const fieldValueDelete = () => deleteField();
export const fieldValueServerTimestamp = () => serverTimestamp();
