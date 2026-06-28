import { useEffect, useMemo, useState } from 'react';
import { db } from '../firebase';
import { ORDER_SYSTEM_CONFIGURED } from '../config/orderSystem';
import type {
    PoOrder,
    PoUser,
    PoCurrency,
    PoPricingTier,
    PoPaymentMethod,
    PoCashLocation,
    PoAgentConfirmation,
} from '../types';

export type PoAdminData = {
    orders: PoOrder[];
    users: PoUser[];
    currencies: PoCurrency[];
    pricingTiers: PoPricingTier[];
    paymentMethods: PoPaymentMethod[];
    cashLocations: PoCashLocation[];
    agentConfirmations: PoAgentConfirmation[];
    /** True once every active subscription has delivered its first snapshot. */
    isLoaded: boolean;
    /** False until OPERATOR_UID is configured (admin reads would be denied). */
    configured: boolean;
};

const SUB_KEYS = [
    'orders',
    'users',
    'currencies',
    'pricingTiers',
    'paymentMethods',
    'cashLocations',
    'agentConfirmations',
] as const;

/**
 * Admin-only subscriptions to the top-level po_* collections. Kept separate
 * from useAppData (which owns the operator's private users/{uid} subtree).
 * Only runs when `enabled` (the Orders view is active) and the operator uid is
 * configured — otherwise admin reads would be rejected by the security rules.
 */
export function usePoAdminData(enabled: boolean): PoAdminData {
    const [orders, setOrders] = useState<PoOrder[]>([]);
    const [users, setUsers] = useState<PoUser[]>([]);
    const [currencies, setCurrencies] = useState<PoCurrency[]>([]);
    const [pricingTiers, setPricingTiers] = useState<PoPricingTier[]>([]);
    const [paymentMethods, setPaymentMethods] = useState<PoPaymentMethod[]>([]);
    const [cashLocations, setCashLocations] = useState<PoCashLocation[]>([]);
    const [agentConfirmations, setAgentConfirmations] = useState<PoAgentConfirmation[]>([]);
    const [loadedKeys, setLoadedKeys] = useState<Set<string>>(() => new Set());

    const active = enabled && ORDER_SYSTEM_CONFIGURED;

    useEffect(() => {
        if (!active) {
            return;
        }
        setLoadedKeys(new Set());
        const mark = (key: string) => setLoadedKeys((prev) => {
            if (prev.has(key)) return prev;
            const next = new Set(prev);
            next.add(key);
            return next;
        });
        const subs: Array<() => void> = [];

        subs.push(db.collection('po_orders').orderBy('createdAt', 'desc').onSnapshot((snap) => {
            setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as PoOrder[]);
            mark('orders');
        }));
        subs.push(db.collection('po_users').onSnapshot((snap) => {
            setUsers(snap.docs.map((d) => d.data()) as PoUser[]);
            mark('users');
        }));
        subs.push(db.collection('po_currencies').onSnapshot((snap) => {
            setCurrencies(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as PoCurrency[]);
            mark('currencies');
        }));
        subs.push(db.collection('po_pricing_tiers').onSnapshot((snap) => {
            setPricingTiers(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as PoPricingTier[]);
            mark('pricingTiers');
        }));
        subs.push(db.collection('po_payment_methods').onSnapshot((snap) => {
            setPaymentMethods(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as PoPaymentMethod[]);
            mark('paymentMethods');
        }));
        subs.push(db.collection('po_cash_locations').onSnapshot((snap) => {
            setCashLocations(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as PoCashLocation[]);
            mark('cashLocations');
        }));
        subs.push(db.collection('po_agent_confirmations').orderBy('createdAt', 'desc').onSnapshot((snap) => {
            setAgentConfirmations(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as PoAgentConfirmation[]);
            mark('agentConfirmations');
        }));

        return () => subs.forEach((unsub) => unsub());
    }, [active]);

    const isLoaded = useMemo(
        () => active && SUB_KEYS.every((key) => loadedKeys.has(key)),
        [active, loadedKeys],
    );

    return {
        orders,
        users,
        currencies,
        pricingTiers,
        paymentMethods,
        cashLocations,
        agentConfirmations,
        isLoaded,
        configured: ORDER_SYSTEM_CONFIGURED,
    };
}
