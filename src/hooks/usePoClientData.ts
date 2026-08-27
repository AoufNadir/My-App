import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { db } from '../firebase';
import { ORDER_SYSTEM_CONFIGURED } from '../config/orderSystem';
import type {
    PoCashLocation,
    PoCurrency,
    PoOrder,
    PoPaymentMethod,
    PoPricingTier,
} from '../types';

export type PoClientData = {
    orders: PoOrder[];
    currencies: PoCurrency[];
    pricingTiers: PoPricingTier[];
    paymentMethods: PoPaymentMethod[];
    cashLocations: PoCashLocation[];
    isLoaded: boolean;
};

const TOTAL_SUBS = 5;

/**
 * Client-side subscriptions: catalog data (read by approved clients per rules)
 * plus the caller's own orders (filtered server-side by clientUid == uid).
 * Only runs when ORDER_SYSTEM_CONFIGURED and user is non-null.
 */
export function usePoClientData(user: User | null): PoClientData {
    const [orders, setOrders] = useState<PoOrder[]>([]);
    const [currencies, setCurrencies] = useState<PoCurrency[]>([]);
    const [pricingTiers, setPricingTiers] = useState<PoPricingTier[]>([]);
    const [paymentMethods, setPaymentMethods] = useState<PoPaymentMethod[]>([]);
    const [cashLocations, setCashLocations] = useState<PoCashLocation[]>([]);
    const [loadedKeys, setLoadedKeys] = useState<Set<string>>(() => new Set());

    const uid = user?.uid ?? null;
    const active = !!uid && ORDER_SYSTEM_CONFIGURED;

    useEffect(() => {
        if (!active || !uid) return;
        setLoadedKeys(new Set());
        const mark = (key: string) =>
            setLoadedKeys((prev) => {
                if (prev.has(key)) return prev;
                const next = new Set(prev);
                next.add(key);
                return next;
            });

        const subs: Array<() => void> = [];

        subs.push(
            db.collection('po_orders')
                .where('clientUid', '==', uid)
                .orderBy('createdAt', 'desc')
                .onSnapshot((snap) => {
                    setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as PoOrder[]);
                    mark('orders');
                }),
        );
        subs.push(
            db.collection('po_currencies').onSnapshot((snap) => {
                setCurrencies(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as PoCurrency[]);
                mark('currencies');
            }),
        );
        subs.push(
            db.collection('po_pricing_tiers').onSnapshot((snap) => {
                setPricingTiers(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as PoPricingTier[]);
                mark('pricingTiers');
            }),
        );
        subs.push(
            db.collection('po_payment_methods').onSnapshot((snap) => {
                setPaymentMethods(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as PoPaymentMethod[]);
                mark('paymentMethods');
            }),
        );
        subs.push(
            db.collection('po_cash_locations').onSnapshot((snap) => {
                setCashLocations(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as PoCashLocation[]);
                mark('cashLocations');
            }),
        );

        return () => subs.forEach((u) => u());
    }, [active, uid]);

    return {
        orders,
        currencies,
        pricingTiers,
        paymentMethods,
        cashLocations,
        isLoaded: active && loadedKeys.size >= TOTAL_SUBS,
    };
}
