import { useMemo } from 'react';
import { db } from '../firebase';
import { now } from '../utils';
import { roundM } from '../utils/money';
import { recordTreasuryShadow } from '../accounting/treasuryShadowDiagnostics';
import { recordPortfolioShadow } from '../accounting/portfolioShadowDiagnostics';
import { recordClientShadow } from '../accounting/clientShadowDiagnostics';
import { clientPositionFromLegacyRows } from '../accounting/clientShadowLegacyAdapter';
import type { PortfolioInventoryState } from '../accounting/portfolioShadow';
import type { ClientTransactionDzd, Investor, InvestorTransaction, PoAuditAction, PoCurrencyCode, PoOrder, PoOrderStatus, PoPaymentMethodType, PoRole, PoUser, TreasuryTx } from '../types';
import {
    allocateProfitDeltaAtTimestamp,
    type ManagerFeeHistoryEntry,
} from './useInvestorEconomics';
import { getSummaryWriteMode, isSummaryWriteEnabled } from '../readModels/readModelActivation';
import { mustPrepareWriterReadModelDelta } from '../readModels/preparedWriterDeltas';
import { transitionClientBalanceDelta } from '../readModels/readModelDeltas';
import { applyReadModelDeltasWithinTransaction } from '../readModels/productionSummaryWriter';

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

function periodProfitDeltas(timestamp: number, profitDzd: number, ownerProfitDzd: number, currency: 'USDT' | 'EUR', quantity = 0) {
    const nowDate = new Date();
    const dayStart = new Date(nowDate);
    dayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(nowDate);
    const dow = weekStart.getDay();
    weekStart.setDate(weekStart.getDate() - (dow === 0 ? 6 : dow - 1));
    weekStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(nowDate.getFullYear(), nowDate.getMonth(), 1).getTime();
    const yearStart = new Date(nowDate.getFullYear(), 0, 1).getTime();
    const isToday = timestamp >= dayStart.getTime();
    const isWeek = timestamp >= weekStart.getTime();
    const isMonth = timestamp >= monthStart;
    const isYear = timestamp >= yearStart;
    return {
        todayProfitDelta: isToday ? profitDzd : 0,
        weekToDateProfitDelta: isWeek ? profitDzd : 0,
        monthToDateProfitDelta: isMonth ? profitDzd : 0,
        yearToDateProfitDelta: isYear ? profitDzd : 0,
        allTimeProfitDelta: profitDzd,
        todaySellCountDelta: isToday ? 1 : 0,
        todayUsdtSoldDelta: isToday && currency === 'USDT' ? quantity : 0,
        todayEurSoldDelta: isToday && currency === 'EUR' ? quantity : 0,
        monthToDateUsdtSoldDelta: isMonth && currency === 'USDT' ? quantity : 0,
        monthToDateEurSoldDelta: isMonth && currency === 'EUR' ? quantity : 0,
        yearToDateUsdtSoldDelta: isYear && currency === 'USDT' ? quantity : 0,
        yearToDateEurSoldDelta: isYear && currency === 'EUR' ? quantity : 0,
        allTimeUsdtSoldDelta: currency === 'USDT' ? quantity : 0,
        allTimeEurSoldDelta: currency === 'EUR' ? quantity : 0,
        ownerProfitTodayDelta: isToday ? ownerProfitDzd : 0,
        ownerProfitWeekDelta: isWeek ? ownerProfitDzd : 0,
        ownerProfitMonthDelta: isMonth ? ownerProfitDzd : 0,
        ownerProfitYearDelta: isYear ? ownerProfitDzd : 0,
        ownerProfitAllTimeDelta: ownerProfitDzd,
    };
}

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
    inventoryBefore: PortfolioInventoryState;
    clientPaymentStatus: 'credit' | 'baridi' | 'cash';
};

export type PoOrderAccountingContext = {
    investors?: Investor[];
    investorTransactions?: InvestorTransaction[];
    treasuryTransactions?: TreasuryTx[];
    personalExpenses?: TreasuryTx[];
    managerFeePercentage?: number;
    managerFeeHistory?: ManagerFeeHistoryEntry[];
    clientTransactionsDzd?: ClientTransactionDzd[];
};

export type AddCurrencyInput = { code: PoCurrencyCode; label: string; minOrder: number; maxOrder: number };
export type AddPricingTierInput = { currencyId: string; minQty: number; maxQty: number; unitPriceDzd: number };
export type AddPaymentMethodInput = { type: PoPaymentMethodType; label: string };
export type AddCashLocationInput = { label: string };

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
    seedCatalog: () => Promise<void>;
    addCurrency: (input: AddCurrencyInput) => Promise<void>;
    setCurrencyActive: (id: string, active: boolean) => Promise<void>;
    updateCurrencyLimits: (id: string, minOrder: number, maxOrder: number) => Promise<void>;
    addPricingTier: (input: AddPricingTierInput) => Promise<void>;
    setTierActive: (id: string, active: boolean) => Promise<void>;
    addPaymentMethod: (input: AddPaymentMethodInput) => Promise<void>;
    setPaymentMethodActive: (id: string, active: boolean) => Promise<void>;
    addCashLocation: (input: AddCashLocationInput) => Promise<void>;
    setCashLocationActive: (id: string, active: boolean) => Promise<void>;
};

/**
 * Admin-side write actions for the order system. `actorUid` is the operator's
 * Auth uid (the audit actor; must equal request.auth.uid for the rules, and is
 * the owner of the users/{uid} ledger subtree).
 */
export function usePoOrderHandlers(actorUid: string, accountingContext: PoOrderAccountingContext = {}): PoOrderHandlers {
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
            const orderRef = db.collection('po_orders').doc(order.id);
            const sellRef = opRef.collection('usdt_txs').doc();
            const treasuryReceiptRef = ctx.clientPaymentStatus !== 'credit'
                ? opRef.collection('treasury_txs').doc()
                : null;
            const clientTxRef = order.clientId
                ? opRef.collection('dzd_client_txs').doc()
                : null;
            const clientTxId = clientTxRef?.id;
            const nextStatus: PoOrderStatus = ctx.clientPaymentStatus === 'credit' ? 'DEBT_ACTIVE' : 'DELIVERED';
            const summaryWriteMode = getSummaryWriteMode();
            const hasReadModelContext = Boolean(
                accountingContext.investors
                && accountingContext.investorTransactions
                && accountingContext.treasuryTransactions
                && accountingContext.personalExpenses
                && accountingContext.managerFeeHistory
                && accountingContext.clientTransactionsDzd
                && Number.isFinite(Number(accountingContext.managerFeePercentage)),
            );
            if (isSummaryWriteEnabled(summaryWriteMode) && !hasReadModelContext) {
                throw new Error('PO_READ_MODEL_CONTEXT_REQUIRED');
            }
            const clientRows = accountingContext.clientTransactionsDzd || [];
            const clientBalanceBefore = order.clientId
                ? clientPositionFromLegacyRows(clientRows as any[], order.clientId, timestamp).balanceDzd
                : 0;
            const clientBalanceDelta = ctx.clientPaymentStatus === 'credit' ? -totalRevenue : 0;
            const day = new Date(timestamp);
            day.setHours(0, 0, 0, 0);
            const dayStart = day.getTime();
            const dayEnd = dayStart + 86_400_000 - 1;
            const activeClientsTodayDelta = order.clientId && !clientRows.some((row) => row.clientId === order.clientId && row.timestamp >= dayStart && row.timestamp <= dayEnd)
                ? 1
                : 0;
            const allocation = hasReadModelContext
                ? allocateProfitDeltaAtTimestamp({
                    investors: accountingContext.investors || [],
                    investorTransactions: accountingContext.investorTransactions || [],
                    treasuryTransactions: accountingContext.treasuryTransactions || [],
                    personalExpenses: accountingContext.personalExpenses || [],
                    managerFeePercentage: Number(accountingContext.managerFeePercentage || 30),
                    managerFeeHistory: accountingContext.managerFeeHistory || [],
                    projectProfitDzd: profit,
                    timestamp,
                })
                : null;
            const legacyCost = roundM(ctx.avgBuy * quantity);
            const readModelDelta = allocation
                ? mustPrepareWriterReadModelDelta('orders.complete-order', {
                    operationId: `legacy:orders.complete-order:${order.id}`,
                    effectiveAt: timestamp,
                    payload: {
                        type: 'orders_complete_order',
                        orderId: order.id,
                        sellTxId: sellRef.id,
                        currency: ctx.currencyCode,
                        quantity,
                        totalRevenue,
                        profit,
                        clientPaymentStatus: ctx.clientPaymentStatus,
                        linkedClientId: order.clientId || 'none',
                        allocation,
                    },
                    affectedSummaries: ['dashboard_summary', 'portfolio_summary', 'treasury_summary', 'clients_summary', 'investors_summary', 'financial_summary'],
                    wallets: ctx.clientPaymentStatus === 'credit'
                        ? undefined
                        : { [ctx.clientPaymentStatus === 'baridi' ? 'BaridiMob' : 'Caisse']: totalRevenue },
                    portfolio: {
                        [ctx.currencyCode]: {
                            quantityDelta: -quantity,
                            costBasisDeltaDzd: -legacyCost,
                            realizedProfitDeltaDzd: profit,
                            soldQuantityDelta: quantity,
                        },
                    },
                    clients: {
                        ...transitionClientBalanceDelta(clientBalanceBefore, clientBalanceBefore + clientBalanceDelta),
                        activeClientsTodayDelta,
                    },
                    investors: {
                        externalInvestorProfitsDelta: allocation.externalInvestorProfitsDeltaDzd,
                        investorLiabilityDelta: allocation.investorLiabilityDeltaDzd,
                        managerTradingOwnerProfitDelta: allocation.managerProfitDeltaDzd,
                        managerActualOwnerCapitalDelta: allocation.managerProfitDeltaDzd,
                        globalNetProfitDelta: allocation.projectProfitDzd,
                    },
                    dashboardDaily: periodProfitDeltas(timestamp, profit, allocation.managerProfitDeltaDzd, ctx.currencyCode, quantity),
                    recentOperation: { operationId: `legacy:orders.complete-order:${order.id}`, source: 'legacy', type: `Commande ${ctx.currencyCode}`, effectiveAt: timestamp },
                })
                : null;

            await db.runTransaction(async (transaction) => {
                const freshOrderSnapshot = await transaction.get(orderRef);
                if (!freshOrderSnapshot.exists) {
                    throw new Error('ORDER_NOT_FOUND');
                }
                const freshOrder = freshOrderSnapshot.data() as PoOrder;
                if (freshOrder?.linkedUsdtTxId) {
                    throw new Error('ALREADY_COMPLETED');
                }
                if (readModelDelta) {
                    await applyReadModelDeltasWithinTransaction({
                        userDocRef: opRef as any,
                        transaction: transaction as any,
                        deltas: [readModelDelta],
                        summaryWriteMode,
                    });
                }

                transaction.set(sellRef, {
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

                // Customer sale receipt: prepaid cash/BaridiMob only; credit creates no cash movement.
                if (ctx.clientPaymentStatus !== 'credit') {
                    const source = ctx.clientPaymentStatus === 'baridi' ? 'BaridiMob' : 'Caisse';
                    transaction.set(treasuryReceiptRef!, {
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
                if (order.clientId && clientTxRef) {
                    transaction.set(clientTxRef, {
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

                transaction.update(orderRef, clean({
                    status: nextStatus,
                    linkedUsdtTxId: sellRef.id,
                    linkedClientTxId: clientTxId,
                    updatedAt: Date.now(),
                }));
            });
            if (ctx.clientPaymentStatus !== 'credit') {
                const wallet = ctx.clientPaymentStatus === 'baridi' ? 'BaridiMob' : 'Caisse';
                recordTreasuryShadow({
                    operationId: `shadow:po-order:${order.id}`,
                    actorUid,
                    effectiveAt: timestamp,
                    kind: 'po_order_sale_receipt_cash',
                    wallet,
                    amountDzd: totalRevenue,
                    clientId: order.clientId,
                }, [{ type: 'Ajout', source: wallet, amount: totalRevenue }]);
                recordPortfolioShadow({
                    operationId: `shadow:po-portfolio-cash:${order.id}`,
                    actorUid,
                    effectiveAt: timestamp,
                    kind: 'portfolio_order_sale_cash',
                    currency: ctx.currencyCode,
                    quantity,
                    inventoryBefore: ctx.inventoryBefore,
                    wallet,
                    clientId: order.clientId,
                    proceedsDzd: totalRevenue,
                }, {
                    quantityDeltas: { [ctx.currencyCode]: -quantity },
                    costBasisDeltasDzd: { [ctx.currencyCode]: -legacyCost },
                    cashDeltasDzd: { [wallet]: totalRevenue },
                    realizedTradingProfitDzd: profit,
                });
            }
            else {
                recordPortfolioShadow({
                    operationId: `shadow:po-portfolio-credit:${order.id}`,
                    actorUid,
                    effectiveAt: timestamp,
                    kind: 'portfolio_order_sale_credit',
                    currency: ctx.currencyCode,
                    quantity,
                    inventoryBefore: ctx.inventoryBefore,
                    clientId: order.clientId,
                    proceedsDzd: totalRevenue,
                }, {
                    quantityDeltas: { [ctx.currencyCode]: -quantity },
                    costBasisDeltasDzd: { [ctx.currencyCode]: -legacyCost },
                    clientReceivableDzd: totalRevenue,
                    realizedTradingProfitDzd: profit,
                });
            }

            // This read is intentionally asynchronous and diagnostic only. It
            // starts after the Legacy transaction commits, and any failure is
            // unable to delay or change delivery. V2 never writes in this phase.
            if (order.clientId && ctx.clientPaymentStatus === 'credit' && clientTxId) {
                const shadowClientId = order.clientId;
                const shadowClientTxId = clientTxId;
                void opRef.collection('dzd_client_txs').where('clientId', '==', shadowClientId).get()
                    .then((snapshot) => {
                        const beforeRows = snapshot.docs
                            .filter((document) => document.id !== shadowClientTxId)
                            .map((document) => ({ id: document.id, ...document.data() }));
                        recordClientShadow({
                            operationId: `shadow:po-client-credit:${order.id}`,
                            actorUid,
                            effectiveAt: timestamp,
                            kind: 'client_order_credit_sale',
                            clientId: shadowClientId,
                            amountDzd: totalRevenue,
                            positionBefore: clientPositionFromLegacyRows(beforeRows as any[], shadowClientId, timestamp),
                            revenueAccount: 'income.purchase_order_sale',
                        }, { clientDeltas: { [shadowClientId]: -totalRevenue } });
                    })
                    .catch((error) => console.warn('[clientsV2 shadow read failure]', { orderId: order.id, error }));
            }
            await logAudit(
                nextStatus === 'DEBT_ACTIVE' ? 'debt_activated' : 'admin_marked_delivered',
                'order',
                order.id,
                { linkedUsdtTxId: sellRef.id, totalDzd: totalRevenue },
            );
        };

        // One-time default catalog: EUR/USDT currencies, sample EUR pricing
        // tiers, BaridiMob + Cash payment methods, and one cash location.
        const seedCatalog: PoOrderHandlers['seedCatalog'] = async () => {
            const operatorUid = actorUid;
            const batch = db.batch();

            const eurRef = db.collection('po_currencies').doc();
            batch.set(eurRef, { code: 'EUR', label: 'Euro', active: true, minOrder: 50, maxOrder: 5000, operatorUid });
            const usdtRef = db.collection('po_currencies').doc();
            batch.set(usdtRef, { code: 'USDT', label: 'USDT', active: true, minOrder: 50, maxOrder: 10000, operatorUid });

            const eurTiers: Array<[number, number, number]> = [
                [1, 100, 250],
                [101, 500, 249],
                [501, 1000, 248],
            ];
            eurTiers.forEach(([minQty, maxQty, unitPriceDzd]) => {
                batch.set(db.collection('po_pricing_tiers').doc(), {
                    currencyId: eurRef.id, minQty, maxQty, unitPriceDzd,
                    requiresAdminApproval: false, active: true, operatorUid,
                });
            });

            batch.set(db.collection('po_payment_methods').doc(), { type: 'baridimob', label: 'BaridiMob', active: true, operatorUid });
            batch.set(db.collection('po_payment_methods').doc(), { type: 'cash', label: 'Cash / Espèces', active: true, operatorUid });

            batch.set(db.collection('po_cash_locations').doc(), { label: 'Point principal', active: true, operatorUid });

            await batch.commit();
        };

        const addCurrency: PoOrderHandlers['addCurrency'] = async (input) => {
            await db.collection('po_currencies').add({ ...input, active: true, operatorUid: actorUid });
        };
        const setCurrencyActive: PoOrderHandlers['setCurrencyActive'] = (id, active) =>
            db.collection('po_currencies').doc(id).update({ active });
        const updateCurrencyLimits: PoOrderHandlers['updateCurrencyLimits'] = (id, minOrder, maxOrder) =>
            db.collection('po_currencies').doc(id).update({ minOrder, maxOrder });

        const addPricingTier: PoOrderHandlers['addPricingTier'] = async (input) => {
            await db.collection('po_pricing_tiers').add({
                ...input, requiresAdminApproval: false, active: true, operatorUid: actorUid,
            });
        };
        const setTierActive: PoOrderHandlers['setTierActive'] = (id, active) =>
            db.collection('po_pricing_tiers').doc(id).update({ active });

        const addPaymentMethod: PoOrderHandlers['addPaymentMethod'] = async (input) => {
            await db.collection('po_payment_methods').add({ ...input, active: true, operatorUid: actorUid });
        };
        const setPaymentMethodActive: PoOrderHandlers['setPaymentMethodActive'] = (id, active) =>
            db.collection('po_payment_methods').doc(id).update({ active });

        const addCashLocation: PoOrderHandlers['addCashLocation'] = async (input) => {
            await db.collection('po_cash_locations').add({ ...input, active: true, operatorUid: actorUid });
        };
        const setCashLocationActive: PoOrderHandlers['setCashLocationActive'] = (id, active) =>
            db.collection('po_cash_locations').doc(id).update({ active });

        return {
            logAudit,
            approveUser,
            blockUser,
            reactivateUser,
            confirmPayment,
            rejectOrder,
            cancelOrder,
            completeOrder,
            seedCatalog,
            addCurrency,
            setCurrencyActive,
            updateCurrencyLimits,
            addPricingTier,
            setTierActive,
            addPaymentMethod,
            setPaymentMethodActive,
            addCashLocation,
            setCashLocationActive,
        };
    }, [actorUid]);
}
