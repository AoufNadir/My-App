import { useEffect, useState } from 'react';
import { db } from '../firebase';
import { readAccess, type AccessDoc } from '../utils/access';

// V21-1: the subscription of the signed-in account (access/{uid}), live. Not read for the operator.
export function useAccess(uid: string | null | undefined, isOperator: boolean) {
    const [state, setState] = useState<{ loaded: boolean; access: AccessDoc | null }>({ loaded: false, access: null });
    useEffect(() => {
        if (!uid || isOperator) return undefined;
        return db.collection('access').doc(uid).onSnapshot((snap) => {
            setState({ loaded: true, access: snap.exists ? readAccess(snap.data()) : null });
        }, {}, (error: Error) => { console.error('Error loading access:', error); setState({ loaded: true, access: null }); });
    }, [uid, isOperator]);
    return state;
}

export type AccessRequest = { uid: string; name: string; phone: string; email: string; requestedAt: number };
export type AccessRow = AccessDoc & { uid: string };

// V21-1: the operator's list: pending requests and every subscription.
export function useSubscribers(enabled: boolean) {
    const [requests, setRequests] = useState<AccessRequest[]>([]);
    const [subscribers, setSubscribers] = useState<AccessRow[]>([]);
    useEffect(() => {
        if (!enabled) return undefined;
        const offRequests = db.collection('access_requests').onSnapshot((snap: any) => {
            setRequests(snap.docs.map((d: any) => ({ uid: d.id, name: '', phone: '', email: '', requestedAt: 0, ...d.data() })).sort((a: AccessRequest, b: AccessRequest) => b.requestedAt - a.requestedAt));
        });
        const offAccess = db.collection('access').onSnapshot((snap: any) => {
            setSubscribers(snap.docs.map((d: any) => ({ uid: d.id, ...(readAccess(d.data()) ?? { until: 0 }) })).sort((a: AccessRow, b: AccessRow) => a.until - b.until));
        });
        return () => { offRequests(); offAccess(); };
    }, [enabled]);
    return { requests, subscribers };
}
