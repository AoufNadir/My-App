import React, { useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { useLanguage } from '../contexts/LanguageContext';
import { usePoAdminData } from '../hooks/usePoAdminData';
import { usePoOrderHandlers, type ApproveUserOptions, type CompleteOrderContext } from '../hooks/usePoOrderHandlers';
import { inventoryFromLegacyPortfolioStats } from '../accounting/portfolioShadowLegacyAdapter';
import { Button } from '../components/ui/Button';
import { CatalogManager } from '../components/orders/CatalogManager';
import type { ClientDzd, PoCashLocation, PoOrder, PoOrderStatus, PoRole, PoUser, PortfolioStats } from '../types';

type OrdersAdminPageProps = {
    user: User;
    setAlert: (message: string) => void;
    clientsDzd: ClientDzd[];
    portfolioStats: PortfolioStats;
};

const FINAL_STATUSES: PoOrderStatus[] = ['DELIVERED', 'CANCELLED', 'REJECTED', 'DEBT_ACTIVE', 'DEBT_PAID'];
const CONFIRMABLE_STATUSES: PoOrderStatus[] = ['NEW', 'WAITING_PAYMENT', 'PAYMENT_PROOF_SUBMITTED', 'WAITING_ADMIN_CONFIRMATION'];

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

const fieldClass = 'h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-neutral-900 focus:border-primary focus:ring-2 focus:ring-primary';

type Strings = {
    title: string; subtitle: string; notConfiguredTitle: string; notConfigured: string;
    total: string; waitingPayment: string; waitingAdmin: string; debts: string; delivered: string; pendingUsers: string;
    pendingHeader: string; approvedHeader: string; ordersHeader: string; empty: string; loading: string;
    qty: string; noPending: string; noApproved: string; role: string; client: string; agent: string;
    linkClient: string; none: string; cashLocation: string; enableDebt: string; debtLimit: string;
    approve: string; block: string; reactivate: string; blocked: string; pendingTag: string;
    approveOk: string; blockOk: string; reactivateOk: string; error: string;
    confirm: string; deliver: string; reject: string;
    confirmOk: string; deliverOk: string; rejectOk: string;
    alreadyCompleted: string; clientRequired: string;
    catalogHeader: string;
    yourUidLabel: string; copy: string; copied: string;
    deliveryTo: string; addressCopied: string;
};

function buildStrings(lang: 'fr' | 'ar'): Strings {
    return lang === 'ar'
        ? {
            title: 'الطلبات', subtitle: 'إدارة طلبات العملاء',
            notConfiguredTitle: 'نظام الطلبات غير مُهيّأ',
            notConfigured: 'يجب ضبط معرّف المشغّل (OPERATOR_UID) في src/config/orderSystem.ts وفي firestore.rules قبل تفعيل الطلبات.',
            total: 'إجمالي الطلبات', waitingPayment: 'بانتظار الدفع', waitingAdmin: 'بانتظار التأكيد',
            debts: 'ديون نشطة', delivered: 'تم التسليم', pendingUsers: 'حسابات بانتظار الموافقة',
            pendingHeader: 'حسابات بانتظار الموافقة', approvedHeader: 'الحسابات المعتمدة',
            ordersHeader: 'الطلبات الأخيرة', empty: 'لا توجد طلبات بعد.', loading: 'جارٍ التحميل…',
            qty: 'الكمية', noPending: 'لا توجد حسابات بانتظار الموافقة.', noApproved: 'لا توجد حسابات معتمدة.',
            role: 'الدور', client: 'عميل', agent: 'وكيل', linkClient: 'ربط بعميل', none: 'بدون',
            cashLocation: 'نقطة الكاش', enableDebt: 'تفعيل الدين', debtLimit: 'سقف الدين (دج)',
            approve: 'موافقة', block: 'حظر', reactivate: 'إعادة التفعيل', blocked: 'محظور', pendingTag: 'قيد الانتظار',
            approveOk: 'تمت الموافقة على الحساب.', blockOk: 'تم حظر الحساب.', reactivateOk: 'تمت إعادة تفعيل الحساب.',
            error: 'حدث خطأ. حاول مرة أخرى.',
            confirm: 'تأكيد الدفع', deliver: 'تسليم', reject: 'رفض',
            confirmOk: 'تم تأكيد الدفع.', deliverOk: 'تم تسليم الطلب وتسجيله.', rejectOk: 'تم رفض الطلب.',
            alreadyCompleted: 'تم تسجيل هذا الطلب مسبقًا.', clientRequired: 'يجب ربط الطلب بعميل قبل تسجيل دين.',
            catalogHeader: 'الكتالوج',
            yourUidLabel: 'معرّف حسابك (UID) — انسخه وضعه في الملفين أعلاه:', copy: 'نسخ', copied: 'تم نسخ المعرّف.',
            deliveryTo: 'التسليم إلى', addressCopied: 'تم نسخ العنوان.',
        }
        : {
            title: 'Commandes', subtitle: 'Gestion des commandes clients',
            notConfiguredTitle: 'Système de commandes non configuré',
            notConfigured: "Définissez OPERATOR_UID dans src/config/orderSystem.ts et dans firestore.rules pour activer les commandes.",
            total: 'Total commandes', waitingPayment: 'En attente de paiement', waitingAdmin: 'À confirmer',
            debts: 'Dettes actives', delivered: 'Livrées', pendingUsers: 'Comptes à approuver',
            pendingHeader: 'Comptes à approuver', approvedHeader: 'Comptes approuvés',
            ordersHeader: 'Commandes récentes', empty: 'Aucune commande pour le moment.', loading: 'Chargement…',
            qty: 'Quantité', noPending: 'Aucun compte en attente.', noApproved: 'Aucun compte approuvé.',
            role: 'Rôle', client: 'Client', agent: 'Agent', linkClient: 'Lier à un client', none: 'Aucun',
            cashLocation: 'Point cash', enableDebt: 'Activer la dette', debtLimit: 'Plafond de dette (DZD)',
            approve: 'Approuver', block: 'Bloquer', reactivate: 'Réactiver', blocked: 'Bloqué', pendingTag: 'En attente',
            approveOk: 'Compte approuvé.', blockOk: 'Compte bloqué.', reactivateOk: 'Compte réactivé.',
            error: 'Une erreur est survenue. Réessayez.',
            confirm: 'Confirmer paiement', deliver: 'Livrer', reject: 'Rejeter',
            confirmOk: 'Paiement confirmé.', deliverOk: 'Commande livrée et enregistrée.', rejectOk: 'Commande rejetée.',
            alreadyCompleted: 'Cette commande est déjà enregistrée.', clientRequired: 'Liez la commande à un client avant d’enregistrer une dette.',
            catalogHeader: 'Catalogue',
            yourUidLabel: 'Votre identifiant opérateur (UID) — copiez-le dans les deux fichiers ci-dessus :', copy: 'Copier', copied: 'Identifiant copié.',
            deliveryTo: 'Livraison à', addressCopied: 'Adresse copiée.',
        };
}

type PendingUserRowProps = {
    target: PoUser;
    clientsDzd: ClientDzd[];
    cashLocations: PoCashLocation[];
    strings: Strings;
    onApprove: (target: PoUser, opts: ApproveUserOptions) => Promise<void>;
    onBlock: (target: PoUser) => Promise<void>;
};

const PendingUserRow: React.FC<PendingUserRowProps> = ({
    target, clientsDzd, cashLocations, strings, onApprove, onBlock,
}) => {
    const [role, setRole] = useState<PoRole>('client');
    const [linkedClientId, setLinkedClientId] = useState('');
    const [assignedCashLocationId, setAssignedCashLocationId] = useState('');
    const [debtEnabled, setDebtEnabled] = useState(false);
    const [debtLimitDzd, setDebtLimitDzd] = useState('');
    const [busy, setBusy] = useState(false);

    const submit = async () => {
        setBusy(true);
        await onApprove(target, {
            role,
            linkedClientId: role === 'client' && linkedClientId ? linkedClientId : undefined,
            assignedCashLocationId: role === 'agent' && assignedCashLocationId ? assignedCashLocationId : undefined,
            debtEnabled: role === 'client' ? debtEnabled : undefined,
            debtLimitDzd: role === 'client' && debtEnabled && debtLimitDzd ? Number(debtLimitDzd) : undefined,
        });
        setBusy(false);
    };

    return (
        <li className="space-y-3 py-3">
            <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                    <div className="truncate font-semibold text-neutral-900">{target.displayName || target.email}</div>
                    <div className="truncate text-xs text-neutral-500">{target.email}</div>
                </div>
                <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE_CLASS.pending}`}>
                    {strings.pendingTag}
                </span>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label className="text-xs font-medium text-neutral-600">
                    {strings.role}
                    <select className={`${fieldClass} mt-1`} value={role} onChange={(e) => setRole(e.target.value as PoRole)}>
                        <option value="client">{strings.client}</option>
                        <option value="agent">{strings.agent}</option>
                    </select>
                </label>

                {role === 'client' && (
                    <label className="text-xs font-medium text-neutral-600">
                        {strings.linkClient}
                        <select className={`${fieldClass} mt-1`} value={linkedClientId} onChange={(e) => setLinkedClientId(e.target.value)}>
                            <option value="">{strings.none}</option>
                            {clientsDzd.map((c) => (
                                <option key={c.id} value={c.id}>{c.fullName}</option>
                            ))}
                        </select>
                    </label>
                )}

                {role === 'agent' && (
                    <label className="text-xs font-medium text-neutral-600">
                        {strings.cashLocation}
                        <select className={`${fieldClass} mt-1`} value={assignedCashLocationId} onChange={(e) => setAssignedCashLocationId(e.target.value)}>
                            <option value="">{strings.none}</option>
                            {cashLocations.map((loc) => (
                                <option key={loc.id} value={loc.id}>{loc.label}</option>
                            ))}
                        </select>
                    </label>
                )}

                {role === 'client' && (
                    <label className="flex items-center gap-2 text-xs font-medium text-neutral-600 sm:mt-5">
                        <input type="checkbox" checked={debtEnabled} onChange={(e) => setDebtEnabled(e.target.checked)} className="h-4 w-4" />
                        {strings.enableDebt}
                    </label>
                )}

                {role === 'client' && debtEnabled && (
                    <label className="text-xs font-medium text-neutral-600">
                        {strings.debtLimit}
                        <input type="number" inputMode="numeric" className={`${fieldClass} mt-1`} value={debtLimitDzd} onChange={(e) => setDebtLimitDzd(e.target.value)} />
                    </label>
                )}
            </div>

            <div className="flex gap-2">
                <Button variant="success" size="sm" loading={busy} onClick={submit}>{strings.approve}</Button>
                <Button variant="outline" size="sm" disabled={busy} onClick={() => onBlock(target)}>{strings.block}</Button>
            </div>
        </li>
    );
};

type OrderRowProps = {
    order: PoOrder;
    clientLabel: string;
    strings: Strings;
    lang: 'fr' | 'ar';
    setAlert: (message: string) => void;
    onConfirm: (order: PoOrder) => Promise<void>;
    onReject: (order: PoOrder) => Promise<void>;
    onDeliver: (order: PoOrder) => Promise<void>;
};

const OrderRow: React.FC<OrderRowProps> = ({ order, clientLabel, strings, lang, setAlert, onConfirm, onReject, onDeliver }) => {
    const [busy, setBusy] = useState(false);
    const run = async (fn: (o: PoOrder) => Promise<void>) => {
        setBusy(true);
        try {
            await fn(order);
        } finally {
            setBusy(false);
        }
    };
    const isFinal = FINAL_STATUSES.includes(order.status);
    const canConfirm = CONFIRMABLE_STATUSES.includes(order.status);
    const canDeliver = order.status === 'PAYMENT_CONFIRMED' || order.status === 'WAITING_DELIVERY';
    return (
        <li className="space-y-2 py-3">
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-neutral-900">{order.orderCode}</span>
                        <StatusBadge status={order.status} lang={lang} />
                    </div>
                    <div className="mt-0.5 truncate text-xs text-neutral-500">
                        {clientLabel ? `${clientLabel} · ` : ''}
                        {strings.qty}: {order.quantity} {order.currencyId} · {new Date(order.createdAt).toLocaleDateString(lang === 'ar' ? 'ar' : 'fr-FR')}
                    </div>
                </div>
                <div className="shrink-0 text-end text-sm font-bold text-neutral-900">{formatDzd(order.totalDzd)}</div>
            </div>
            {order.deliveryAddress && (
                <button
                    type="button"
                    onClick={() => {
                        navigator.clipboard?.writeText(order.deliveryAddress);
                        setAlert(`✅ ${strings.addressCopied}`);
                    }}
                    className="block w-full truncate rounded-lg border border-border bg-app-bg px-2.5 py-1.5 text-start text-xs text-neutral-600 hover:border-primary/40"
                    title={order.deliveryAddress}
                >
                    <span className="font-medium text-neutral-500">
                        {strings.deliveryTo}{order.deliveryNetwork ? ` (${order.deliveryNetwork})` : ''}:
                    </span>{' '}
                    {order.deliveryAddress}
                </button>
            )}
            {!isFinal && (
                <div className="flex flex-wrap gap-2">
                    {canConfirm && (
                        <Button variant="primary" size="sm" loading={busy} onClick={() => run(onConfirm)}>{strings.confirm}</Button>
                    )}
                    {canDeliver && (
                        <Button variant="success" size="sm" loading={busy} onClick={() => run(onDeliver)}>{strings.deliver}</Button>
                    )}
                    <Button variant="outline" size="sm" disabled={busy} onClick={() => run(onReject)}>{strings.reject}</Button>
                </div>
            )}
        </li>
    );
};

// Admin order-management surface (operator-only — MainApp is gated to the
// operator). Lists incoming orders, approves/links/blocks accounts, completes
// orders into the existing ledger, and writes audit entries.
export function OrdersAdminPage({ user, setAlert, clientsDzd, portfolioStats }: OrdersAdminPageProps) {
    const { lang } = useLanguage();
    const data = usePoAdminData(true);
    const handlers = usePoOrderHandlers(user.uid);
    const strings = useMemo(() => buildStrings(lang), [lang]);

    const clientName = useMemo(() => {
        const map = new Map<string, string>();
        clientsDzd.forEach((c) => map.set(c.id, c.fullName));
        return map;
    }, [clientsDzd]);

    const pendingUsers = useMemo(() => data.users.filter((u) => u.status === 'pending'), [data.users]);
    const managedUsers = useMemo(() => data.users.filter((u) => u.status !== 'pending' && u.uid !== user.uid), [data.users, user.uid]);

    const summary = useMemo(() => {
        const byStatus = (s: PoOrderStatus) => data.orders.filter((o) => o.status === s).length;
        return {
            total: data.orders.length,
            waitingPayment: byStatus('WAITING_PAYMENT') + byStatus('PAYMENT_PROOF_SUBMITTED'),
            waitingAdmin: byStatus('WAITING_ADMIN_CONFIRMATION'),
            debts: byStatus('DEBT_ACTIVE'),
            delivered: byStatus('DELIVERED'),
            pendingUsers: pendingUsers.length,
        };
    }, [data.orders, pendingUsers.length]);

    const cardClass = 'rounded-xl border border-border bg-surface p-4 shadow-card';

    if (!data.configured) {
        return (
            <div className="py-4">
                <div className="rounded-xl border border-warning/30 bg-warning-bg p-4 text-warning">
                    <h2 className="mb-1 text-base font-bold">{strings.notConfiguredTitle}</h2>
                    <p className="text-sm leading-relaxed">{strings.notConfigured}</p>
                    <p className="mt-3 text-xs font-medium">{strings.yourUidLabel}</p>
                    <div className="mt-1 flex items-center gap-2">
                        <code className="block flex-1 select-all overflow-x-auto rounded-lg border border-border bg-surface px-3 py-2 text-xs text-neutral-700">{user.uid}</code>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                navigator.clipboard?.writeText(user.uid);
                                setAlert(`✅ ${strings.copied}`);
                            }}
                        >
                            {strings.copy}
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    const handleApprove = async (target: PoUser, opts: ApproveUserOptions) => {
        try {
            await handlers.approveUser(target, opts);
            setAlert(`✅ ${strings.approveOk}`);
        } catch {
            setAlert(`❌ ${strings.error}`);
        }
    };
    const handleBlock = async (target: PoUser) => {
        try {
            await handlers.blockUser(target);
            setAlert(`✅ ${strings.blockOk}`);
        } catch {
            setAlert(`❌ ${strings.error}`);
        }
    };
    const handleReactivate = async (target: PoUser) => {
        try {
            await handlers.reactivateUser(target);
            setAlert(`✅ ${strings.reactivateOk}`);
        } catch {
            setAlert(`❌ ${strings.error}`);
        }
    };

    const currencyById = useMemo(() => {
        const m = new Map<string, 'USDT' | 'EUR'>();
        data.currencies.forEach((c) => m.set(c.id, c.code));
        return m;
    }, [data.currencies]);

    const resolveCtx = (order: PoOrder): CompleteOrderContext => {
        const code = currencyById.get(order.currencyId) || 'USDT';
        const avgBuy = code === 'EUR' ? portfolioStats.eur.avgBuy : portfolioStats.usdt.avgBuy;
        let clientPaymentStatus: 'credit' | 'baridi' | 'cash';
        if (order.paymentType === 'debt') {
            clientPaymentStatus = 'credit';
        } else if (order.cashLocationId) {
            clientPaymentStatus = 'cash';
        } else {
            const method = data.paymentMethods.find((pm) => pm.id === order.paymentMethodId);
            clientPaymentStatus = method?.type === 'cash' ? 'cash' : 'baridi';
        }
        return {
            currencyCode: code,
            avgBuy,
            inventoryBefore: inventoryFromLegacyPortfolioStats(portfolioStats, code),
            clientPaymentStatus,
        };
    };

    const handleConfirm = async (order: PoOrder) => {
        try {
            await handlers.confirmPayment(order);
            setAlert(`✅ ${strings.confirmOk}`);
        } catch {
            setAlert(`❌ ${strings.error}`);
        }
    };
    const handleReject = async (order: PoOrder) => {
        try {
            await handlers.rejectOrder(order);
            setAlert(`✅ ${strings.rejectOk}`);
        } catch {
            setAlert(`❌ ${strings.error}`);
        }
    };
    const handleDeliver = async (order: PoOrder) => {
        try {
            await handlers.completeOrder(order, resolveCtx(order));
            setAlert(`✅ ${strings.deliverOk}`);
        } catch (e: any) {
            if (e?.message === 'ALREADY_COMPLETED') setAlert(`⚠️ ${strings.alreadyCompleted}`);
            else if (e?.message === 'CLIENT_REQUIRED') setAlert(`⚠️ ${strings.clientRequired}`);
            else setAlert(`❌ ${strings.error}`);
        }
    };

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
                <h1 className="text-xl font-extrabold text-neutral-900">{strings.title}</h1>
                <p className="text-sm text-neutral-500">{strings.subtitle}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {stat(strings.total, summary.total, 'neutral')}
                {stat(strings.waitingPayment, summary.waitingPayment, 'pending')}
                {stat(strings.waitingAdmin, summary.waitingAdmin, 'pending')}
                {stat(strings.debts, summary.debts, 'danger')}
                {stat(strings.delivered, summary.delivered, 'success')}
                {stat(strings.pendingUsers, summary.pendingUsers, 'pending')}
            </div>

            {/* Pending accounts */}
            <div className={cardClass}>
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-neutral-500">{strings.pendingHeader}</h2>
                {pendingUsers.length === 0 ? (
                    <p className="py-4 text-center text-sm text-neutral-400">{strings.noPending}</p>
                ) : (
                    <ul className="divide-y divide-border">
                        {pendingUsers.map((u) => (
                            <PendingUserRow
                                key={u.uid}
                                target={u}
                                clientsDzd={clientsDzd}
                                cashLocations={data.cashLocations}
                                strings={strings}
                                onApprove={handleApprove}
                                onBlock={handleBlock}
                            />
                        ))}
                    </ul>
                )}
            </div>

            {/* Approved / managed accounts */}
            <div className={cardClass}>
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-neutral-500">{strings.approvedHeader}</h2>
                {managedUsers.length === 0 ? (
                    <p className="py-4 text-center text-sm text-neutral-400">{strings.noApproved}</p>
                ) : (
                    <ul className="divide-y divide-border">
                        {managedUsers.map((u) => (
                            <li key={u.uid} className="flex items-center justify-between gap-3 py-3">
                                <div className="min-w-0">
                                    <div className="truncate font-semibold text-neutral-900">{u.displayName || u.email}</div>
                                    <div className="truncate text-xs text-neutral-500">
                                        {u.role === 'agent' ? strings.agent : strings.client}
                                        {u.linkedClientId && clientName.get(u.linkedClientId) ? ` · ${clientName.get(u.linkedClientId)}` : ''}
                                        {u.status === 'blocked' ? ` · ${strings.blocked}` : ''}
                                    </div>
                                </div>
                                {u.status === 'blocked' ? (
                                    <Button variant="outline" size="sm" onClick={() => handleReactivate(u)}>{strings.reactivate}</Button>
                                ) : (
                                    <Button variant="outline" size="sm" onClick={() => handleBlock(u)}>{strings.block}</Button>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* Catalog */}
            <div className={cardClass}>
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-neutral-500">{strings.catalogHeader}</h2>
                <CatalogManager
                    lang={lang}
                    currencies={data.currencies}
                    pricingTiers={data.pricingTiers}
                    paymentMethods={data.paymentMethods}
                    cashLocations={data.cashLocations}
                    handlers={handlers}
                    setAlert={setAlert}
                />
            </div>

            {/* Orders */}
            <div className={cardClass}>
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-neutral-500">{strings.ordersHeader}</h2>
                {!data.isLoaded ? (
                    <p className="py-6 text-center text-sm text-neutral-400">{strings.loading}</p>
                ) : data.orders.length === 0 ? (
                    <p className="py-6 text-center text-sm text-neutral-400">{strings.empty}</p>
                ) : (
                    <ul className="divide-y divide-border">
                        {data.orders.map((order: PoOrder) => (
                            <OrderRow
                                key={order.id}
                                order={order}
                                clientLabel={order.clientId ? (clientName.get(order.clientId) || '') : ''}
                                strings={strings}
                                lang={lang}
                                setAlert={setAlert}
                                onConfirm={handleConfirm}
                                onReject={handleReject}
                                onDeliver={handleDeliver}
                            />
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
