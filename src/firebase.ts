import {
    addDoc,
    collection,
    deleteField,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    getFirestore,
    limit,
    onSnapshot,
    orderBy,
    query,
    setDoc,
    updateDoc,
    where,
    writeBatch,
    type DocumentData,
    type DocumentReference as NativeDocumentReference,
    type Firestore,
    type OrderByDirection,
    type Query as NativeQuery,
    type QueryConstraint,
    type QuerySnapshot as NativeQuerySnapshot,
    type SetOptions,
    type Unsubscribe,
    type WhereFilterOp,
    type WriteBatch as NativeWriteBatch,
} from 'firebase/firestore';
import { app } from './firebaseApp';
const firestore = getFirestore(app);
export type { AppUser } from './firebaseAuth';

class FirestoreQuerySnapshot {
    constructor(
        private readonly nativeSnapshot: NativeQuerySnapshot<DocumentData>,
        private readonly compatDb: FirestoreCompat
    ) { }

    get docs() {
        return this.nativeSnapshot.docs.map((docSnap) => new FirestoreDocumentSnapshot(docSnap, this.compatDb));
    }

    get size() {
        return this.nativeSnapshot.size;
    }

    get empty() {
        return this.nativeSnapshot.empty;
    }

    forEach(callback: (doc: FirestoreDocumentSnapshot) => void) {
        this.nativeSnapshot.forEach((docSnap) => callback(new FirestoreDocumentSnapshot(docSnap, this.compatDb)));
    }
}

class FirestoreQuery {
    constructor(
        private readonly nativeQuery: NativeQuery<DocumentData>,
        private readonly compatDb: FirestoreCompat
    ) { }

    where(fieldPath: string, opStr: WhereFilterOp, value: unknown) {
        return new FirestoreQuery(query(this.nativeQuery, where(fieldPath, opStr, value)), this.compatDb);
    }

    orderBy(fieldPath: string, directionStr: OrderByDirection = 'asc') {
        return new FirestoreQuery(query(this.nativeQuery, orderBy(fieldPath, directionStr)), this.compatDb);
    }

    limit(limitNumber: number) {
        return new FirestoreQuery(query(this.nativeQuery, limit(limitNumber)), this.compatDb);
    }

    async get() {
        const snapshot = await getDocs(this.nativeQuery);
        return new FirestoreQuerySnapshot(snapshot, this.compatDb);
    }

    onSnapshot(callback: (snapshot: FirestoreQuerySnapshot) => void): Unsubscribe {
        return onSnapshot(this.nativeQuery, (snapshot) => callback(new FirestoreQuerySnapshot(snapshot, this.compatDb)));
    }
}

class FirestoreCollectionReference {
    constructor(
        private readonly nativeCollectionPath: string,
        private readonly compatDb: FirestoreCompat
    ) { }

    private nativeCollection() {
        return collection(firestore, this.nativeCollectionPath);
    }

    doc(id?: string) {
        const nativeRef = id ? doc(this.nativeCollection(), id) : doc(this.nativeCollection());
        return new FirestoreDocumentReference(nativeRef, this.compatDb);
    }

    async add(data: DocumentData) {
        const nativeRef = await addDoc(this.nativeCollection(), data);
        return new FirestoreDocumentReference(nativeRef, this.compatDb);
    }

    where(fieldPath: string, opStr: WhereFilterOp, value: unknown) {
        return new FirestoreQuery(query(this.nativeCollection(), where(fieldPath, opStr, value)), this.compatDb);
    }

    orderBy(fieldPath: string, directionStr: OrderByDirection = 'asc') {
        return new FirestoreQuery(query(this.nativeCollection(), orderBy(fieldPath, directionStr)), this.compatDb);
    }

    limit(limitNumber: number) {
        return new FirestoreQuery(query(this.nativeCollection(), limit(limitNumber)), this.compatDb);
    }

    async get() {
        const snapshot = await getDocs(this.nativeCollection());
        return new FirestoreQuerySnapshot(snapshot, this.compatDb);
    }

    onSnapshot(callback: (snapshot: FirestoreQuerySnapshot) => void): Unsubscribe {
        return onSnapshot(this.nativeCollection(), (snapshot) => callback(new FirestoreQuerySnapshot(snapshot, this.compatDb)));
    }
}

class FirestoreWriteBatch {
    constructor(private readonly nativeBatch: NativeWriteBatch) { }

    set(ref: FirestoreDocumentReference, data: DocumentData, options?: SetOptions) {
        if (options) {
            this.nativeBatch.set(ref.nativeRef, data, options);
            return;
        }
        this.nativeBatch.set(ref.nativeRef, data);
    }

    update(ref: FirestoreDocumentReference, data: DocumentData) {
        this.nativeBatch.update(ref.nativeRef, data);
    }

    delete(ref: FirestoreDocumentReference) {
        this.nativeBatch.delete(ref.nativeRef);
    }

    commit() {
        return this.nativeBatch.commit();
    }
}

export class FirestoreDocumentReference {
    constructor(
        readonly nativeRef: NativeDocumentReference<DocumentData>,
        private readonly compatDb: FirestoreCompat
    ) { }

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
        const snapshot = await getDoc(this.nativeRef);
        return new FirestoreDocumentSnapshot(snapshot, this.compatDb);
    }

    set(data: DocumentData, options?: SetOptions) {
        if (options) {
            return setDoc(this.nativeRef, data, options);
        }
        return setDoc(this.nativeRef, data);
    }

    update(data: DocumentData) {
        return updateDoc(this.nativeRef, data);
    }

    delete() {
        return deleteDoc(this.nativeRef);
    }
}

class FirestoreDocumentSnapshot {
    constructor(
        private readonly nativeSnapshot: Awaited<ReturnType<typeof getDoc>>,
        private readonly compatDb: FirestoreCompat
    ) { }

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
}

export const db = new FirestoreCompat(firestore);
export const fieldValueDelete = () => deleteField();
