import { useCallback, useEffect, useState } from 'react';
import { parseDelivery, type DeliveryCurrency, type DeliveryDoc } from '../utils/deferredDelivery';

// V12-2: the USDT/EUR sold and not sent yet, and what was sent (users/{uid}/deliveries). No money: nothing here
// changes a balance or the stock of the ledger; like the inventory checks it is outside the write gate.

type UserDocRefLike = {
    collection: (name: string) => {
        doc: (id?: string) => { id: string; set: (data: Record<string, unknown>) => Promise<unknown>; delete: () => Promise<unknown> };
        onSnapshot: (callback: (snapshot: { docs: Array<{ id: string; data: () => unknown }> }) => void) => () => void;
    };
};

export function useDeliveries(userDocRef: UserDocRefLike | null | undefined, enabled: boolean, onError?: (error: unknown) => void) {
    const [docs, setDocs] = useState<DeliveryDoc[]>([]);
    const [loaded, setLoaded] = useState(false);
    useEffect(() => {
        if (!enabled || !userDocRef) {
            setDocs([]);
            return;
        }
        return userDocRef.collection('deliveries').onSnapshot((snapshot) => {
            setDocs(snapshot.docs.map((doc) => parseDelivery(doc.id, doc.data())).filter((doc): doc is DeliveryDoc => !!doc));
            setLoaded(true);
        });
    }, [userDocRef, enabled]);
    const record = useCallback((kind: DeliveryDoc['kind'], clientId: string, currency: DeliveryCurrency, quantity: number, saleTxId?: string, saleTimestamp?: number) => {
        if (!userDocRef)
            return;
        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, '0');
        userDocRef.collection('deliveries').doc().set({
            kind, direction: 'to_client', clientId, currency, quantity: Math.round(quantity * 100) / 100,
            timestamp: now.getTime(), date: `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`, time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
            ...(saleTxId ? { saleTxId } : {}),
            ...(saleTimestamp ? { saleTimestamp } : {}),
        }).catch((error) => onError?.(error));
    }, [userDocRef, onError]);
    /** Removes a line typed by mistake (the screen checks it may go). */
    const remove = useCallback((id: string) => {
        userDocRef?.collection('deliveries').doc(id).delete().catch((error) => onError?.(error));
    }, [userDocRef, onError]);
    return { docs, loaded, record, remove };
}
