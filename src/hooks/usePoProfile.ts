import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { db } from '../firebase';
import type { PoUser } from '../types';
import { OPERATOR_UID, ORDER_SYSTEM_CONFIGURED, isOperatorUid } from '../config/orderSystem';

export type PoProfileState = {
    /** True while the profile is still being resolved. */
    loading: boolean;
    /** The caller's po_users doc, or null (operator, dormant gate, or no doc yet). */
    profile: PoUser | null;
    /** Whether the order-system role gate is active (operator uid configured). */
    gateActive: boolean;
    /** Whether the signed-in user is the operator (admin). */
    isOperator: boolean;
};

/**
 * Resolves the signed-in user's order-system role.
 *
 * - When the gate is dormant (operator uid not configured) or the user is the
 *   operator, returns immediately with no profile — AppContent renders MainApp.
 * - Otherwise subscribes to po_users/{uid} for live status changes and, if the
 *   doc is missing, creates a constrained pending-client profile (rules reject
 *   any attempt to self-elevate).
 */
export function usePoProfile(user: User | null): PoProfileState {
    const [profile, setProfile] = useState<PoUser | null>(null);
    const [loading, setLoading] = useState(true);

    const gateActive = ORDER_SYSTEM_CONFIGURED;
    const isOperator = isOperatorUid(user?.uid);

    useEffect(() => {
        if (!user || !gateActive || isOperator) {
            setProfile(null);
            setLoading(false);
            return;
        }
        setLoading(true);
        const ref = db.collection('po_users').doc(user.uid);
        const unsub = ref.onSnapshot((snap) => {
            if (snap.exists) {
                setProfile(snap.data() as PoUser);
                setLoading(false);
                return;
            }
            // No profile yet: create a pending client. The follow-up snapshot
            // delivers it. If rules reject the write we simply stay profile-less
            // (AppContent treats that as "awaiting approval").
            ref.set({
                uid: user.uid,
                role: 'client',
                status: 'pending',
                email: user.email || '',
                operatorUid: OPERATOR_UID,
                createdAt: Date.now(),
            }).catch(() => { /* rules may reject; handled as no-profile */ });
            setProfile(null);
            setLoading(false);
        });
        return () => unsub();
    }, [user, gateActive, isOperator]);

    return { loading, profile, gateActive, isOperator };
}
