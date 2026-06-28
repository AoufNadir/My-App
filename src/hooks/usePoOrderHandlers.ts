import { useMemo } from 'react';
import { db } from '../firebase';
import { now } from '../utils';
import { roundM } from '../utils/money';
import type { PoAuditAction, PoOrder, PoOrderStatus, PoRole, PoUser } from '../types';

/** Drop undefined keys — Firestore rejects undefined field values. */
function clean(obj: Record<string, any>): Record<string, any> {
    const out: Record<string, any> = {};
    Object.keys(obj).forEach((k) => {
        if (obj[k] !== undefined) out[k] = obj[k];
    });
    return out;
}

const PAYMENT_METHOD_BY_STATUS: Record<'credit' | 'baridi' | 'cash', 'Crédit' | 'BaridiMob' | 'Espèces'> = {
    credit: 'Crédit',
    baridi: 'BaridiMob',
    cash: 'Espèces',
};

export type ApproveUserOptions = {
    role: PoRole;
    linkedClientId?: string;
    agentId?: string;
    assignedCashLocationId?: string;
    debtEnabled?: boolean;
    debtLimitDzd?: number;
};

export type CompleteOrderContext = {
    currencyCode: 'USDT' | 'EUR';
    avgBuy: number;
    clientPaymentStatus: 'credit' | 'baridi' | 'cash';
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
    confirmPayment: (order: PoOrder) => Promise<void>;
    rejectOrder: (order: PoOrder) => Promise<void>;
    cancelOrder: (order: PoOrder) => Promise<void>;
    completeOrder: (order: PoOrder, ctx: CompleteOrderContext) => Promise<void>;
};

/**
 * Admin-side write actions for the order system. `actorUid` is the operator's
 * Auth uid (the audit actor; must equal request.auth.uid for the rules, and is
 * the owner of the users/{uid} ledger subtree).
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

        const setOrderStatus = async (order: PoOrder, status: PoOrderStatus, action: PoAuditAction) => {
            await db.collection('po_orders').doc(order.id).update({ status, updatedAt: Date.now() });
            await logAudit(action, 'order', order.id, { status });
        };

        const confirmPayment: PoOrderHandlers['confirmPayment'] = (order) =>
            setOrderStatus(order, 'PAYMENT_CONFIRMED', 'admin_confirmed_payment');
        const rejectOrder: PoOrderHandlers['rejectOrder'] = (order) =>
            setOrderStatus(order, 'REJECTED', 'order_rejected');
        const cancelOrder: PoOrderHandlers['cancelOrder'] = (order) =>
            setOrderStatus(order, 'CANCELLED', 'order_cancelled');

        // Completion → ledger. Reproduces the handleSell batch shape so the
        // operator's existing accounting (portfolio, clients, treasury,
        // investors) stays correct. Admin-only, idempotent via linkedUsdtTxId.
        const completeOrder: PoOrderHandlers['completeOrder'] = async (order, ctx) => {
            if (order.linkedUsdtTxId) {
                throw new Error('ALREADY_COMPLETED');
            }
            if (ctx.clientPaymentStatus === 'credit' && !order.clientId) {
                throw new Error('CLIENT_REQUIRED');
            }

            const quantity = roundM(order.quantity);
            const totalRevenue = Math.round(order.totalDzd);
            const sell = order.unitPriceDzd;
            const profit = Number((order.totalDzd - ctx.avgBuy * quantity).toFixed(2));
            const { date, time, timestamp } = now();
            const orderNote = `Commande ${order.orderCode}`;
            const opRef = db.collection('users').doc(actorUid);
            const batch = db.batch();

            const sellRef = opRef.collection('usdt_txs').doc();
            batch.set(sellRef, {
                timestamp,
                type: 'sell',
                quantity,
                sell,
                total: totalRevenue,
                profit,
                date,
                time,
                notes: orderNote,
                currency: ctx.currencyCode,
                linkedClientId: order.clientId || 'none',
                clientPaymentStatus: ctx.clientPaymentStatus,
                settlementCurrency: 'DZD',
            });

            // Treasury inflow only for prepaid (cash/baridi), never for debt.
            if (ctx.clientPaymentStatus !== 'credit') {
                const source = ctx.clientPaymentStatus === 'baridi' ? 'BaridiMob' : 'Caisse';
                batch.set(opRef.collection('treasury_txs').doc(), {
                    timestamp,
                    date,
                    time,
                    type: 'Ajout',
                    source,
                    amount: totalRevenue,
                    notes: orderNote,
                    linkedTxId: sellRef.id,
                });
            }

            // Client ledger row (when the account is linked to a ClientDzd).
            let clientTxId: string | undefined;
            if (order.clientId) {
                const clientTxRef = opRef.collection('dzd_client_txs').doc();
                clientTxId = clientTxRef.id;
                batch.set(clientTxRef, {
                    clientId: order.clientId,
                    timestamp,
                    date,
                    time,
                    montant: -totalRevenue,
                    type: ctx.currencyCode === 'EUR' ? 'Vente EUR' : 'Vente USDT',
                    notes: orderNote,
                    linkedTxId: sellRef.id,
                    linkRole: 'primary',
                    paymentMethod: PAYMENT_METHOD_BY_STATUS[ctx.clientPaymentStatus],
                    affectsBalance: ctx.clientPaymentStatus === 'credit',
                });
            }

            const nextStatus: PoOrderStatus = ctx.clientPaymentStatus === 'credit' ? 'DEBT_ACTIVE' : 'DELIVERED';
            batch.update(db.collection('po_orders').doc(order.id), clean({
                status: nextStatus,
                linkedUsdtTxId: sellRef.id,
                linkedClientTxId: clientTxId,
                updatedAt: Date.now(),
            }));

            await batch.commit();
            await logAudit(
                nextStatus === 'DEBT_ACTIVE' ? 'debt_activated' : 'admin_marked_delivered',
                'order',
                order.id,
                { linkedUsdtTxId: sellRef.id, totalDzd: totalRevenue },
            );
        };

        return {
            logAudit,
            approveUser,
            blockUser,
            reactivateUser,
            confirmPayment,
            rejectOrder,
            cancelOrder,
            completeOrder,
        };
    }, [actorUid]);
}
