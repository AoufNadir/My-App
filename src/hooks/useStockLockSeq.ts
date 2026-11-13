import { useEffect, useState } from 'react';
import type { FirestoreDocumentReference } from '../firebase';
import { stockLockSeqOf } from '../utils/stockLock';

/**
 * V13-7: the lock number this tab has seen, read from `stock_lock/main` itself (not from the operations: a deleted
 * sale would take its number away and every later save would be refused). Firestore applies one write to all of a
 * tab's listeners together, so a tab that sees the new number also sees the sale that made it.
 */
export function useStockLockSeq(userDocRef: FirestoreDocumentReference | null | undefined): number | null {
    const [seq, setSeq] = useState<number | null>(null);
    useEffect(() => {
        if (!userDocRef) return;
        return userDocRef.collection('stock_lock').doc('main').onSnapshot(
            (snap) => setSeq(stockLockSeqOf(snap.exists ? snap.data() : null)),
            undefined,
            () => setSeq(null),
        );
    }, [userDocRef]);
    return seq;
}
