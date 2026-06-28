import React, { useMemo } from 'react';
import type { User } from 'firebase/auth';
import { useLanguage } from '../contexts/LanguageContext';
import { usePoAdminData } from '../hooks/usePoAdminData';
import type { PoOrder, PoOrderStatus } from '../types';

type OrdersAdminPageProps = {
    user: User;
    setAlert: (message: string) => void;
};

type Tone = 'neutral' | 'pending' | 'info' | 'success' | 'danger';

const STATUS_TONE: Record<PoOrderStatus, Tone> = {
    NEW: 'info',
    WAITING_PAYMENT: 'pending',
    PAYMENT_PROOF_SUBMITTED: 'pending',
    WAITING_ADMIN_CONFIRMATION: 'pending',
    PAYMENT_CONFIRMED: 'success',
    WAITING_DELIVERY: 'info',
    DELIVERED: 'success',
    CANCELLED: 'neutral',
    REJECTED: 'danger',
    DEBT_ACTIVE: 'danger',
    DEBT_PAID: 'success',
};

const STATUS_LABEL: Record<PoOrderStatus, { fr: string; ar: string }> = {
    NEW: { fr: 'Nouveau', ar: 'طلب جديد' },
    WAITING_PAYMENT: { fr: 'En attente de paiement', ar: 'في انتظار الدفع' },
    PAYMENT_PROOF_SUBMITTED: { fr: 'Preuve envoyée', ar: 'تم إرسال إثبات الدفع' },
    WAITING_ADMIN_CONFIRMATION: { fr: 'À confirmer (admin)', ar: 'في انتظار تأكيد الإدارة' },
    PAYMENT_CONFIRMED: { fr: 'Paiement confirmé', ar: 'تم تأكيد الدفع' },
    WAITING_DELIVERY: { fr: 'En attente de livraison', ar: 'في انتظار التسليم' },
    DELIVERED: { fr: 'Livré', ar: 'تم التسليم' },
    CANCELLED: { fr: 'Annulé', ar: 'ملغي' },
    REJECTED: { fr: 'Rejeté', ar: 'مرفوض' },
    DEBT_ACTIVE: { fr: 'Dette active', ar: 'دين نشط' },
    DEBT_PAID: { fr: 'Dette réglée', ar: 'دين مسدد' },
};

const TONE_CLASS: Record<Tone, string> = {
    neutral: 'bg-neutral-100 text-neutral-600',
    pending: 'bg-warning-bg text-warning',
    info: 'bg-info-bg text-primary',
    success: 'bg-success-bg text-success',
    danger: 'bg-danger-bg text-danger',
};

function StatusBadge({ status, lang }: { status: PoOrderStatus; lang: 'fr' | 'ar' }) {
    const tone = STATUS_TONE[status] ?? 'neutral';
    const label = STATUS_LABEL[status]?.[lang] ?? status;
    return (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE_CLASS[tone]}`}>
            {label}
        </span>
    );
}

function formatDzd(value: number): string {
    return `${Math.round(value || 0).toLocaleString('fr-FR')} DZD`;
}

// Admin order-management surface (operator-only — MainApp is gated to the
// operator). Read-only in this phase: it lists incoming orders and pending
// accounts. Approval/confirmation/completion actions land in later commits.
export function OrdersAdminPage({ user: _user, setAlert: _setAlert }: OrdersAdminPageProps) {
    const { lang } = useLanguage();
    const data = usePoAdminData(true);

    const summary = useMemo(() => {
        const byStatus = (s: PoOrderStatus) => data.orders.filter((o) => o.status === s).length;
        return {
            total: data.orders.length,
            waitingPayment: byStatus('WAITING_PAYMENT') + byStatus('PAYMENT_PROOF_SUBMITTED'),
            waitingAdmin: byStatus('WAITING_ADMIN_CONFIRMATION'),
            debts: byStatus('DEBT_ACTIVE'),
            delivered: byStatus('DELIVERED'),
            pendingUsers: data.users.filter((u) => u.status === 'pending').length,
        };
    }, [data.orders, data.users]);

    const tr = lang === 'ar'
        ? {
            title: 'الطلبات',
            subtitle: 'إدارة طلبات العملاء',
            notConfiguredTitle: 'نظام الطلبات غير مُهيّأ',
            notConfigured: 'يجب ضبط معرّف المشغّل (OPERATOR_UID) في src/config/orderSystem.ts وفي firestore.rules قبل تفعيل الطلبات.',
            total: 'إجمالي الطلبات',
            waitingPayment: 'بانتظار الدفع',
            waitingAdmin: 'بانتظار التأكيد',
            debts: 'ديون نشطة',
            delivered: 'تم التسليم',
            pendingUsers: 'حسابات بانتظار الموافقة',
            ordersHeader: 'الطلبات الأخيرة',
            empty: 'لا توجد طلبات بعد.',
            loading: 'جارٍ التحميل…',
            qty: 'الكمية',
        }
        : {
            title: 'Commandes',
            subtitle: 'Gestion des commandes clients',
            notConfiguredTitle: 'Système de commandes non configuré',
            notConfigured: "Définissez OPERATOR_UID dans src/config/orderSystem.ts et dans firestore.rules pour activer les commandes.",
            total: 'Total commandes',
            waitingPayment: 'En attente de paiement',
            waitingAdmin: 'À confirmer',
            debts: 'Dettes actives',
            delivered: 'Livrées',
            pendingUsers: 'Comptes à approuver',
            ordersHeader: 'Commandes récentes',
            empty: 'Aucune commande pour le moment.',
            loading: 'Chargement…',
            qty: 'Quantité',
        };

    const cardClass = 'rounded-xl border border-border bg-surface p-4 shadow-card';

    if (!data.configured) {
        return (
            <div className="py-4">
                <div className="rounded-xl border border-warning/30 bg-warning-bg p-4 text-warning">
                    <h2 className="mb-1 text-base font-bold">{tr.notConfiguredTitle}</h2>
                    <p className="text-sm leading-relaxed">{tr.notConfigured}</p>
                </div>
            </div>
        );
    }

    const stat = (label: string, value: number, tone: Tone) => (
        <div className={cardClass}>
            <div className={`text-2xl font-extrabold ${tone === 'danger' ? 'text-danger' : tone === 'pending' ? 'text-warning' : tone === 'success' ? 'text-success' : 'text-neutral-900'}`}>
                {value}
            </div>
            <div className="mt-1 text-xs font-medium text-neutral-500">{label}</div>
        </div>
    );

    return (
        <div className="space-y-4 py-2">
            <div>
                <h1 className="text-xl font-extrabold text-neutral-900">{tr.title}</h1>
                <p className="text-sm text-neutral-500">{tr.subtitle}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {stat(tr.total, summary.total, 'neutral')}
                {stat(tr.waitingPayment, summary.waitingPayment, 'pending')}
                {stat(tr.waitingAdmin, summary.waitingAdmin, 'pending')}
                {stat(tr.debts, summary.debts, 'danger')}
                {stat(tr.delivered, summary.delivered, 'success')}
                {stat(tr.pendingUsers, summary.pendingUsers, 'pending')}
            </div>

            <div className={cardClass}>
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-neutral-500">{tr.ordersHeader}</h2>
                {!data.isLoaded ? (
                    <p className="py-6 text-center text-sm text-neutral-400">{tr.loading}</p>
                ) : data.orders.length === 0 ? (
                    <p className="py-6 text-center text-sm text-neutral-400">{tr.empty}</p>
                ) : (
                    <ul className="divide-y divide-border">
                        {data.orders.map((order: PoOrder) => (
                            <li key={order.id} className="flex items-center justify-between gap-3 py-3">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-neutral-900">{order.orderCode}</span>
                                        <StatusBadge status={order.status} lang={lang} />
                                    </div>
                                    <div className="mt-0.5 truncate text-xs text-neutral-500">
                                        {tr.qty}: {order.quantity} {order.currencyId} · {new Date(order.createdAt).toLocaleDateString(lang === 'ar' ? 'ar' : 'fr-FR')}
                                    </div>
                                </div>
                                <div className="shrink-0 text-end text-sm font-bold text-neutral-900">
                                    {formatDzd(order.totalDzd)}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
