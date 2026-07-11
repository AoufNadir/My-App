import React, { useMemo, useState } from 'react';
import { signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from '../firebaseAuth';
import { useLanguage } from '../contexts/LanguageContext';
import { db } from '../firebase';
import { OPERATOR_UID } from '../config/orderSystem';
import { usePoClientData } from '../hooks/usePoClientData';
import { Button } from '../components/ui/Button';
import type { PoCurrency, PoDeliveryNetwork, PoPricingTier, PoOrder, PoUser } from '../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateOrderCode(): string {
    const b36 = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).slice(2, 4).toUpperCase();
    return `PD-${b36}${rand}`;
}

function fmtDzd(n: number): string {
    return n.toLocaleString('fr-DZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' DZD';
}

function fmtQty(n: number, code: string): string {
    return n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' ' + code;
}

function findTier(tiers: PoPricingTier[], currencyId: string, qty: number): PoPricingTier | null {
    return tiers.find(
        (t) => t.currencyId === currencyId && t.active && qty >= t.minQty && qty <= t.maxQty,
    ) ?? null;
}

// ── Localised strings ─────────────────────────────────────────────────────────

type Strings = {
    greeting: string;
    signOut: string;
    prices: string;
    available: string;
    range: string;
    unitPrice: string;
    noCatalog: string;
    newOrder: string;
    selectCurrency: string;
    quantity: string;
    qtyHint: (min: number, max: number, code: string) => string;
    paymentType: string;
    prepaid: string;
    debt: string;
    paymentMethod: string;
    selectMethod: string;
    note: string;
    notePlaceholder: string;
    unitPriceLabel: string;
    totalLabel: string;
    noTierForQty: string;
    deliveryAddress: string;
    deliveryAddressWalletHint: string;
    deliveryAddressBankHint: string;
    deliveryAddressPlaceholderWallet: string;
    deliveryAddressPlaceholderBank: string;
    deliveryNetwork: string;
    submit: string;
    submitting: string;
    myOrders: string;
    noOrders: string;
    cancel: string;
    cancelling: string;
    statusLabels: Record<string, string>;
    orderCode: string;
    createdAt: string;
    awaitingPayment: string;
    deliveryTo: string;
};

function buildStrings(lang: string): Strings {
    const ar = lang === 'ar';
    return {
        greeting: ar ? 'أهلاً بك' : 'Bienvenue',
        signOut: ar ? 'تسجيل الخروج' : 'Se déconnecter',
        prices: ar ? 'الأسعار والكميات' : 'Tarifs disponibles',
        available: ar ? 'الحد المتاح' : 'Plafond',
        range: ar ? 'الكمية' : 'Quantité',
        unitPrice: ar ? 'السعر (DZD)' : 'Prix unitaire (DZD)',
        noCatalog: ar ? 'لا توجد عملات متاحة حالياً. تواصل مع الإدارة.' : 'Aucune devise disponible pour le moment. Contactez l\'administration.',
        newOrder: ar ? 'طلب جديد' : 'Nouvelle commande',
        selectCurrency: ar ? 'اختر العملة' : 'Choisir la devise',
        quantity: ar ? 'الكمية' : 'Quantité',
        qtyHint: (min, max, code) => ar
            ? `بين ${min} و${max} ${code}`
            : `Entre ${min} et ${max} ${code}`,
        paymentType: ar ? 'نوع الدفع' : 'Type de paiement',
        prepaid: ar ? 'مسبق الدفع' : 'Prépayé',
        debt: ar ? 'دين (مؤجل)' : 'Crédit (différé)',
        paymentMethod: ar ? 'طريقة الدفع' : 'Méthode de paiement',
        selectMethod: ar ? 'اختر طريقة الدفع' : 'Choisir la méthode',
        note: ar ? 'ملاحظة (اختياري)' : 'Remarque (optionnel)',
        notePlaceholder: ar ? 'أي تفاصيل إضافية...' : 'Détails supplémentaires...',
        unitPriceLabel: ar ? 'السعر الوحدوي' : 'Prix unitaire',
        totalLabel: ar ? 'الإجمالي' : 'Total',
        noTierForQty: ar ? 'الكمية المدخلة خارج النطاق المتاح' : 'Quantité hors plage disponible',
        deliveryAddress: ar ? 'أين نرسل لك الطلبية؟' : 'Où envoyer votre commande ?',
        deliveryAddressWalletHint: ar ? 'عنوان المحفظة' : 'Adresse du portefeuille',
        deliveryAddressBankHint: ar ? 'معلومات الحساب البنكي / RIP' : 'Coordonnées bancaires / RIP',
        deliveryAddressPlaceholderWallet: ar ? 'الصق عنوان محفظتك هنا...' : 'Collez votre adresse de portefeuille...',
        deliveryAddressPlaceholderBank: ar ? 'RIP / IBAN / اسم صاحب الحساب...' : 'RIP / IBAN / nom du titulaire...',
        deliveryNetwork: ar ? 'الشبكة' : 'Réseau',
        submit: ar ? 'إرسال الطلب' : 'Envoyer la commande',
        submitting: ar ? 'جاري الإرسال...' : 'Envoi en cours...',
        myOrders: ar ? 'طلباتي' : 'Mes commandes',
        noOrders: ar ? 'لا توجد طلبات بعد.' : 'Aucune commande pour le moment.',
        cancel: ar ? 'إلغاء' : 'Annuler',
        cancelling: ar ? 'جاري الإلغاء...' : 'Annulation...',
        statusLabels: ar
            ? {
                NEW: 'جديد',
                WAITING_PAYMENT: 'بانتظار الدفع',
                PAYMENT_PROOF_SUBMITTED: 'تم إرفاق الإثبات',
                WAITING_ADMIN_CONFIRMATION: 'بانتظار تأكيد المسؤول',
                PAYMENT_CONFIRMED: 'الدفع مؤكد',
                WAITING_DELIVERY: 'بانتظار التسليم',
                DELIVERED: 'تم التسليم',
                CANCELLED: 'ملغى',
                REJECTED: 'مرفوض',
                DEBT_ACTIVE: 'دين نشط',
                DEBT_PAID: 'الدين مسدد',
            }
            : {
                NEW: 'Nouveau',
                WAITING_PAYMENT: 'En attente de paiement',
                PAYMENT_PROOF_SUBMITTED: 'Preuve soumise',
                WAITING_ADMIN_CONFIRMATION: 'En attente admin',
                PAYMENT_CONFIRMED: 'Paiement confirmé',
                WAITING_DELIVERY: 'En attente livraison',
                DELIVERED: 'Livré',
                CANCELLED: 'Annulé',
                REJECTED: 'Rejeté',
                DEBT_ACTIVE: 'Crédit actif',
                DEBT_PAID: 'Crédit réglé',
            },
        orderCode: ar ? 'رقم الطلب' : 'N° commande',
        createdAt: ar ? 'التاريخ' : 'Date',
        awaitingPayment: ar
            ? 'سيتواصل معك المسؤول لتأكيد الدفع.'
            : "L'administrateur vous contactera pour confirmer le paiement.",
        deliveryTo: ar ? 'التسليم إلى' : 'Livraison à',
    };
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
    NEW: 'bg-blue-100 text-blue-700',
    WAITING_PAYMENT: 'bg-yellow-100 text-yellow-700',
    PAYMENT_PROOF_SUBMITTED: 'bg-yellow-100 text-yellow-700',
    WAITING_ADMIN_CONFIRMATION: 'bg-orange-100 text-orange-700',
    PAYMENT_CONFIRMED: 'bg-teal-100 text-teal-700',
    WAITING_DELIVERY: 'bg-indigo-100 text-indigo-700',
    DELIVERED: 'bg-green-100 text-green-700',
    CANCELLED: 'bg-neutral-200 text-neutral-500',
    REJECTED: 'bg-red-100 text-red-600',
    DEBT_ACTIVE: 'bg-orange-100 text-orange-700',
    DEBT_PAID: 'bg-green-100 text-green-700',
};

const CANCELLABLE_STATUSES = new Set<string>(['NEW', 'WAITING_PAYMENT']);

// ── Price board ───────────────────────────────────────────────────────────────

function PriceBoard({
    currencies,
    tiers,
    s,
}: {
    currencies: PoCurrency[];
    tiers: PoPricingTier[];
    s: Strings;
}) {
    const active = currencies.filter((c) => c.active);
    if (active.length === 0) {
        return <p className="text-sm text-neutral-500 text-center py-6">{s.noCatalog}</p>;
    }
    return (
        <div className="grid gap-4 sm:grid-cols-2">
            {active.map((cur) => {
                const curTiers = tiers
                    .filter((t) => t.currencyId === cur.id && t.active)
                    .sort((a, b) => a.minQty - b.minQty);
                return (
                    <div key={cur.id} className="rounded-xl border border-border bg-surface p-4 shadow-card">
                        <div className="mb-3 flex items-center justify-between">
                            <span className="text-base font-bold text-primary">{cur.label}</span>
                            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                                {cur.code}
                            </span>
                        </div>
                        {curTiers.length === 0 ? (
                            <p className="text-xs text-neutral-400">{s.noCatalog}</p>
                        ) : (
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border text-[11px] text-neutral-400 uppercase">
                                        <th className="pb-1 text-start font-medium">{s.range}</th>
                                        <th className="pb-1 text-end font-medium">{s.unitPrice}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {curTiers.map((tier) => (
                                        <tr key={tier.id} className="border-b border-border/50 last:border-0">
                                            <td className="py-1.5 text-neutral-700">
                                                {tier.minQty} – {tier.maxQty} {cur.code}
                                            </td>
                                            <td className="py-1.5 text-end font-semibold text-neutral-900">
                                                {tier.unitPriceDzd.toLocaleString('fr-DZ')} DZD
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                        <p className="mt-2 text-[11px] text-neutral-400">
                            {s.available}: {cur.minOrder} – {cur.maxOrder} {cur.code}
                        </p>
                    </div>
                );
            })}
        </div>
    );
}

// ── Order form ────────────────────────────────────────────────────────────────

type OrderFormProps = {
    uid: string;
    currencies: PoCurrency[];
    tiers: PoPricingTier[];
    paymentMethods: ReturnType<typeof usePoClientData>['paymentMethods'];
    debtEnabled: boolean;
    s: Strings;
    onSuccess: () => void;
};

function OrderForm({ uid, currencies, tiers, paymentMethods, debtEnabled, s, onSuccess }: OrderFormProps) {
    const activeCurrencies = useMemo(() => currencies.filter((c) => c.active), [currencies]);
    const activeMethods = useMemo(() => paymentMethods.filter((m) => m.active), [paymentMethods]);

    const [selectedCurId, setSelectedCurId] = useState(() => activeCurrencies[0]?.id ?? '');
    const [qtyStr, setQtyStr] = useState('');
    const [paymentType, setPaymentType] = useState<'prepaid' | 'debt'>('prepaid');
    const [methodId, setMethodId] = useState(() => activeMethods[0]?.id ?? '');
    const [clientNote, setClientNote] = useState('');
    const [deliveryAddress, setDeliveryAddress] = useState('');
    const [deliveryNetwork, setDeliveryNetwork] = useState<PoDeliveryNetwork>('TRC20');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const selectedCur = activeCurrencies.find((c) => c.id === selectedCurId) ?? null;
    const isCrypto = selectedCur?.code === 'USDT';
    const qty = parseFloat(qtyStr) || 0;
    const tier = selectedCur ? findTier(tiers, selectedCur.id, qty) : null;
    const unitPrice = tier?.unitPriceDzd ?? 0;
    const totalDzd = tier ? Math.round(qty * unitPrice) : 0;
    const qtyValid = selectedCur && qty >= selectedCur.minOrder && qty <= selectedCur.maxOrder;
    const deliveryValid = deliveryAddress.trim().length > 0;
    const canSubmit = qtyValid && !!tier && !!methodId && deliveryValid && !submitting;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSubmit || !selectedCur || !tier) return;
        setError('');
        setSubmitting(true);
        try {
            const now = Date.now();
            await db.collection('po_orders').add({
                orderCode: generateOrderCode(),
                operatorUid: OPERATOR_UID,
                clientUid: uid,
                currencyId: selectedCur.id,
                quantity: qty,
                unitPriceDzd: unitPrice,
                totalDzd,
                pricingTierId: tier.id,
                quoteCreatedAt: now,
                quoteExpiresAt: now + 24 * 60 * 60 * 1000,
                status: 'NEW',
                paymentType,
                paymentMethodId: methodId,
                deliveryAddress: deliveryAddress.trim(),
                deliveryNetwork: isCrypto ? deliveryNetwork : null,
                clientNote: clientNote.trim() || null,
                createdAt: now,
                updatedAt: now,
            });
            setQtyStr('');
            setClientNote('');
            setDeliveryAddress('');
            onSuccess();
        } catch (err: any) {
            setError(err?.message ?? 'Erreur');
        } finally {
            setSubmitting(false);
        }
    };

    if (activeCurrencies.length === 0) {
        return <p className="text-sm text-neutral-500 text-center py-4">{s.noCatalog}</p>;
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {/* Currency selector */}
            <div className="space-y-1.5">
                <label className="block text-sm font-medium text-neutral-700">{s.selectCurrency}</label>
                <div className="flex gap-2 flex-wrap">
                    {activeCurrencies.map((cur) => (
                        <button
                            key={cur.id}
                            type="button"
                            onClick={() => { setSelectedCurId(cur.id); setQtyStr(''); }}
                            className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${
                                selectedCurId === cur.id
                                    ? 'border-primary bg-primary text-white'
                                    : 'border-border bg-surface text-neutral-700 hover:border-primary/50'
                            }`}
                        >
                            {cur.label} ({cur.code})
                        </button>
                    ))}
                </div>
            </div>

            {/* Quantity */}
            {selectedCur && (
                <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-neutral-700">{s.quantity}</label>
                    <input
                        type="number"
                        min={selectedCur.minOrder}
                        max={selectedCur.maxOrder}
                        step="1"
                        value={qtyStr}
                        onChange={(e) => setQtyStr(e.target.value)}
                        placeholder={s.qtyHint(selectedCur.minOrder, selectedCur.maxOrder, selectedCur.code)}
                        className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <p className="text-[11px] text-neutral-400">
                        {s.qtyHint(selectedCur.minOrder, selectedCur.maxOrder, selectedCur.code)}
                    </p>
                </div>
            )}

            {/* Price preview */}
            {qty > 0 && selectedCur && (
                <div className={`rounded-xl border p-4 ${
                    tier ? 'border-primary/20 bg-primary/5' : 'border-yellow-200 bg-yellow-50'
                }`}>
                    {tier ? (
                        <div className="space-y-1">
                            <div className="flex justify-between text-sm text-neutral-700">
                                <span>{s.unitPriceLabel}</span>
                                <span className="font-semibold">{unitPrice.toLocaleString('fr-DZ')} DZD / {selectedCur.code}</span>
                            </div>
                            <div className="flex justify-between text-base font-bold text-primary border-t border-primary/20 pt-2 mt-2">
                                <span>{s.totalLabel}</span>
                                <span>{fmtDzd(totalDzd)}</span>
                            </div>
                            <div className="text-[11px] text-neutral-500 text-center pt-1">
                                {fmtQty(qty, selectedCur.code)} × {unitPrice.toLocaleString('fr-DZ')} DZD
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-yellow-700 text-center font-medium">{s.noTierForQty}</p>
                    )}
                </div>
            )}

            {/* Delivery address — where the admin must send the currency */}
            {selectedCur && (
                <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-neutral-700">{s.deliveryAddress}</label>
                    {isCrypto && (
                        <select
                            value={deliveryNetwork}
                            onChange={(e) => setDeliveryNetwork(e.target.value as PoDeliveryNetwork)}
                            className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-neutral-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                            <option value="TRC20">TRC20 (TRON)</option>
                            <option value="BEP20">BEP20 (BNB Chain)</option>
                            <option value="ERC20">ERC20 (Ethereum)</option>
                            <option value="TON">TON</option>
                            <option value="other">{s.deliveryNetwork}: {s.deliveryAddressWalletHint}</option>
                        </select>
                    )}
                    <input
                        type="text"
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        placeholder={isCrypto ? s.deliveryAddressPlaceholderWallet : s.deliveryAddressPlaceholderBank}
                        className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <p className="text-[11px] text-neutral-400">
                        {isCrypto ? s.deliveryAddressWalletHint : s.deliveryAddressBankHint}
                    </p>
                </div>
            )}

            {/* Payment type */}
            {debtEnabled && (
                <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-neutral-700">{s.paymentType}</label>
                    <div className="flex gap-2">
                        {(['prepaid', 'debt'] as const).map((pt) => (
                            <button
                                key={pt}
                                type="button"
                                onClick={() => setPaymentType(pt)}
                                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                                    paymentType === pt
                                        ? 'border-primary bg-primary text-white'
                                        : 'border-border bg-surface text-neutral-700'
                                }`}
                            >
                                {pt === 'prepaid' ? s.prepaid : s.debt}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Payment method */}
            {activeMethods.length > 0 && (
                <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-neutral-700">{s.paymentMethod}</label>
                    <select
                        value={methodId}
                        onChange={(e) => setMethodId(e.target.value)}
                        className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-neutral-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                        <option value="">{s.selectMethod}</option>
                        {activeMethods.map((m) => (
                            <option key={m.id} value={m.id}>{m.label}</option>
                        ))}
                    </select>
                </div>
            )}

            {/* Note */}
            <div className="space-y-1.5">
                <label className="block text-sm font-medium text-neutral-700">{s.note}</label>
                <textarea
                    rows={2}
                    value={clientNote}
                    onChange={(e) => setClientNote(e.target.value)}
                    placeholder={s.notePlaceholder}
                    className="w-full resize-none rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
            </div>

            {error && (
                <p className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
                    {error}
                </p>
            )}

            <Button
                type="submit"
                variant="primary"
                className="w-full h-12 text-sm"
                disabled={!canSubmit}
                loading={submitting}
            >
                {submitting ? s.submitting : s.submit}
            </Button>
        </form>
    );
}

// ── Order list ────────────────────────────────────────────────────────────────

type OrderRowProps = {
    order: PoOrder;
    currencies: PoCurrency[];
    s: Strings;
};

const OrderRow: React.FC<OrderRowProps> = ({ order, currencies, s }) => {
    const [cancelling, setCancelling] = useState(false);
    const cur = currencies.find((c) => c.id === order.currencyId);
    const canCancel = CANCELLABLE_STATUSES.has(order.status);

    const handleCancel = async () => {
        if (!canCancel) return;
        setCancelling(true);
        try {
            await db.collection('po_orders').doc(order.id).update({
                status: 'CANCELLED',
                updatedAt: Date.now(),
            });
        } catch {
            // silent — Firestore will revert optimistic cache
        } finally {
            setCancelling(false);
        }
    };

    const dateStr = new Date(order.createdAt).toLocaleDateString('fr-DZ', {
        day: '2-digit', month: '2-digit', year: '2-digit',
    });

    return (
        <div className="rounded-xl border border-border bg-surface p-4 shadow-card space-y-3">
            <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5">
                    <p className="text-[12px] font-mono text-neutral-400">{order.orderCode}</p>
                    <p className="text-[11px] text-neutral-400">{dateStr}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_COLOR[order.status] ?? 'bg-neutral-100 text-neutral-600'}`}>
                    {s.statusLabels[order.status] ?? order.status}
                </span>
            </div>

            <div className="flex justify-between items-end">
                <div>
                    <p className="text-base font-bold text-neutral-900">
                        {fmtQty(order.quantity, cur?.code ?? '')}
                    </p>
                    <p className="text-sm text-neutral-500">{fmtDzd(order.totalDzd)}</p>
                </div>
                {canCancel && (
                    <Button
                        variant="danger"
                        size="sm"
                        loading={cancelling}
                        onClick={handleCancel}
                        className="shrink-0"
                    >
                        {cancelling ? s.cancelling : s.cancel}
                    </Button>
                )}
            </div>

            {order.deliveryAddress && (
                <p className="truncate text-[11px] text-neutral-400 border-t border-border pt-2">
                    {s.deliveryTo}{order.deliveryNetwork ? ` (${order.deliveryNetwork})` : ''}: {order.deliveryAddress}
                </p>
            )}

            {order.status === 'NEW' && (
                <p className="text-[11px] text-neutral-400">
                    {s.awaitingPayment}
                </p>
            )}
        </div>
    );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type Section = 'prices' | 'order' | 'myorders';

export function ClientPortalPage({ user, profile }: { user: User; profile: PoUser }) {
    const { lang } = useLanguage();
    const s = useMemo(() => buildStrings(lang), [lang]);
    const data = usePoClientData(user);
    const [activeSection, setActiveSection] = useState<Section>('prices');
    const [orderSuccess, setOrderSuccess] = useState(false);

    const displayName = profile.displayName || user.displayName || user.email?.split('@')[0] || '';

    const handleOrderSuccess = () => {
        setOrderSuccess(true);
        setActiveSection('myorders');
        setTimeout(() => setOrderSuccess(false), 4000);
    };

    const tabs: Array<{ key: Section; label: string }> = [
        { key: 'prices', label: s.prices },
        { key: 'order', label: s.newOrder },
        { key: 'myorders', label: `${s.myOrders}${data.orders.length > 0 ? ` (${data.orders.length})` : ''}` },
    ];

    return (
        <div className="min-h-screen bg-app-bg text-neutral-900 flex flex-col">
            {/* Header */}
            <header className="sticky top-0 z-10 bg-surface border-b border-border px-4 py-3 flex items-center justify-between gap-3 shadow-sm">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface">
                        <img src="/logo.png" alt="Pro Digital" className="h-full w-full object-cover" />
                    </div>
                    <span className="truncate text-sm font-semibold text-neutral-800">
                        {s.greeting}{displayName ? `, ${displayName}` : ''}
                    </span>
                </div>
                <Button variant="outline" size="sm" onClick={() => signOut(auth)} className="shrink-0 text-[12px]">
                    {s.signOut}
                </Button>
            </header>

            {/* Tab bar */}
            <nav className="bg-surface border-b border-border">
                <div className="flex overflow-x-auto scrollbar-none">
                    {tabs.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveSection(tab.key)}
                            className={`shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                                activeSection === tab.key
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-neutral-500 hover:text-neutral-700'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </nav>

            {/* Content */}
            <main className="flex-1 px-4 py-5 max-w-2xl mx-auto w-full">
                {orderSuccess && (
                    <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 font-medium">
                        {lang === 'ar' ? '✓ تم إرسال طلبك بنجاح!' : '✓ Commande envoyée avec succès !'}
                    </div>
                )}

                {!data.isLoaded && (
                    <div className="flex items-center justify-center py-16">
                        <svg className="animate-spin h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                    </div>
                )}

                {data.isLoaded && (
                    <>
                        {activeSection === 'prices' && (
                            <PriceBoard
                                currencies={data.currencies}
                                tiers={data.pricingTiers}
                                s={s}
                            />
                        )}

                        {activeSection === 'order' && (
                            <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
                                <h2 className="mb-4 text-base font-bold text-neutral-900">{s.newOrder}</h2>
                                <OrderForm
                                    uid={user.uid}
                                    currencies={data.currencies}
                                    tiers={data.pricingTiers}
                                    paymentMethods={data.paymentMethods}
                                    debtEnabled={profile.debtEnabled ?? false}
                                    s={s}
                                    onSuccess={handleOrderSuccess}
                                />
                            </div>
                        )}

                        {activeSection === 'myorders' && (
                            <div className="space-y-3">
                                {data.orders.length === 0 ? (
                                    <p className="text-center text-sm text-neutral-500 py-10">{s.noOrders}</p>
                                ) : (
                                    data.orders.map((order) => (
                                        <OrderRow
                                            key={order.id}
                                            order={order}
                                            currencies={data.currencies}
                                            s={s}
                                        />
                                    ))
                                )}
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}
