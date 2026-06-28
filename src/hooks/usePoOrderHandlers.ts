import { useMemo } from 'react';
import { db } from '../firebase';
import type { PoAuditAction, PoRole, PoUser } from '../types';

/** Drop undefined keys — Firestore rejects undefined field values. */
function clean(obj: Record<string, any>): Record<string, any> {
    const out: Record<string, any> = {};
    Object.keys(obj).forEach((k) => {
        if (obj[k] !== undefined) out[k] = obj[k];
    });
    return out;
}

export type ApproveUserOptions = {
    role: PoRole;
    linkedClientId?: string;
    agentId?: string;
    assignedCashLocationId?: string;
    debtEnabled?: boolean;
    debtLimitDzd?: number;
};

export type PoOrderHandlers = {
    logAudit: (
        action: PoAuditAction,
        targetType: 'order' | 'user' | 'confirmation',
        targetId: string,
        details?: Record<string, any>,
    ) => Promise<unknown>;
    approveUser: (target: PoUser, opts: ApproveUserOptions) => Promise<void>;
    blockUser: (target: PoUser) => Promise<void>;
    reactivateUser: (target: PoUser) => Promise<void>;
};

/**
 * Admin-side write actions for the order system. `actorUid` is the operator's
 * Auth uid (also the audit actor; must equal request.auth.uid for the rules).
 * Order completion → ledger is added in a later commit.
 */
export function usePoOrderHandlers(actorUid: string): PoOrderHandlers {
    return useMemo<PoOrderHandlers>(() => {
        const logAudit: PoOrderHandlers['logAudit'] = (action, targetType, targetId, details) => {
            const payload = clean({
                action,
                actorUid,
                targetType,
                targetId,
                createdAt: Date.now(),
                detailsJson: details ? JSON.stringify(details) : undefined,
            });
            return db.collection('po_audit_logs').add(payload);
        };

        const approveUser: PoOrderHandlers['approveUser'] = async (target, opts) => {
            const isClient = opts.role === 'client';
            const isAgent = opts.role === 'agent';
            const updates = clean({
                status: 'approved',
                role: opts.role,
                approvedAt: Date.now(),
                approvedBy: actorUid,
                linkedClientId: isClient ? opts.linkedClientId : undefined,
                agentId: isAgent ? (opts.agentId || target.uid) : undefined,
                assignedCashLocationId: isAgent ? opts.assignedCashLocationId : undefined,
                debtEnabled: isClient ? !!opts.debtEnabled : undefined,
                debtLimitDzd: isClient && opts.debtEnabled ? opts.debtLimitDzd : undefined,
            });
            await db.collection('po_users').doc(target.uid).update(updates);
            await logAudit('admin_approved_user', 'user', target.uid, {
                role: opts.role,
                linkedClientId: opts.linkedClientId,
            });
        };

        const blockUser: PoOrderHandlers['blockUser'] = async (target) => {
            await db.collection('po_users').doc(target.uid).update({ status: 'blocked' });
            await logAudit('admin_blocked_user', 'user', target.uid);
        };

        const reactivateUser: PoOrderHandlers['reactivateUser'] = async (target) => {
            await db.collection('po_users').doc(target.uid).update({ status: 'approved' });
        };

        return { logAudit, approveUser, blockUser, reactivateUser };
    }, [actorUid]);
}
