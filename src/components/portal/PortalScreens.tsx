import React from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebaseAuth';
import { useLanguage } from '../../contexts/LanguageContext';
import { Button } from '../ui/Button';

type Tone = 'pending' | 'blocked' | 'info';

// Phase-1 placeholder surfaces for non-operator roles. Text is inline bilingual
// (FR/AR) so each screen is self-contained; admin order management lives inside
// MainApp for the operator. Full client/agent portals arrive in later phases.
function PortalShell({ title, message, tone, uid }: { title: string; message: string; tone: Tone; uid?: string }) {
    const { lang } = useLanguage();
    const toneClass = tone === 'blocked'
        ? 'text-danger'
        : tone === 'pending'
            ? 'text-warning'
            : 'text-primary';
    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-app-bg text-neutral-900">
            <div className="w-full max-w-sm space-y-6 text-center">
                <div className="flex justify-center">
                    <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface shadow-card">
                        <img src="/logo.png" alt="Pro Digital" className="h-full w-full object-cover" />
                    </div>
                </div>
                <div className="space-y-2">
                    <h1 className={`text-xl font-bold ${toneClass}`}>{title}</h1>
                    <p className="text-sm leading-relaxed text-neutral-600">{message}</p>
                </div>
                {uid && (
                    <div className="space-y-1">
                        <p className="text-[11px] font-medium text-neutral-400">
                            {lang === 'ar' ? 'معرّف هذا الحساب (UID):' : 'Identifiant de ce compte (UID) :'}
                        </p>
                        <code className="block select-all overflow-x-auto rounded-lg border border-border bg-surface px-3 py-2 text-[11px] text-neutral-600">
                            {uid}
                        </code>
                    </div>
                )}
                <Button variant="outline" onClick={() => signOut(auth)} className="h-12 w-full rounded-lg text-sm">
                    {lang === 'ar' ? 'تسجيل الخروج' : 'Se déconnecter'}
                </Button>
            </div>
        </div>
    );
}

export function AwaitingApprovalScreen({ uid }: { uid?: string }) {
    const { lang } = useLanguage();
    return (
        <PortalShell
            uid={uid}
            tone="pending"
            title={lang === 'ar' ? 'في انتظار الموافقة' : "En attente d'approbation"}
            message={lang === 'ar'
                ? 'تم إنشاء حسابك بنجاح. يجب أن يوافق عليه المسؤول قبل أن تتمكن من إنشاء الطلبات.'
                : "Votre compte a bien été créé. Un administrateur doit l'approuver avant que vous puissiez passer des commandes."}
        />
    );
}

export function BlockedScreen({ uid }: { uid?: string }) {
    const { lang } = useLanguage();
    return (
        <PortalShell
            uid={uid}
            tone="blocked"
            title={lang === 'ar' ? 'تم حظر الحساب' : 'Compte bloqué'}
            message={lang === 'ar'
                ? 'تم تعطيل هذا الحساب. يرجى التواصل مع الإدارة.'
                : "Ce compte a été désactivé. Veuillez contacter l'administration."}
        />
    );
}

export function ClientPortalPlaceholder({ uid }: { uid?: string }) {
    const { lang } = useLanguage();
    return (
        <PortalShell
            uid={uid}
            tone="info"
            title={lang === 'ar' ? 'بوابة العميل قريبًا' : 'Espace client bientôt disponible'}
            message={lang === 'ar'
                ? 'تمت الموافقة على حسابك. ميزة إنشاء الطلبات ستكون متاحة قريبًا.'
                : "Votre compte est approuvé. La création de commandes sera disponible très prochainement."}
        />
    );
}

export function AgentDashboardPlaceholder({ uid }: { uid?: string }) {
    const { lang } = useLanguage();
    return (
        <PortalShell
            uid={uid}
            tone="info"
            title={lang === 'ar' ? 'لوحة الوكيل قريبًا' : 'Espace agent bientôt disponible'}
            message={lang === 'ar'
                ? 'تمت الموافقة على حسابك كوكيل. لوحة تأكيد المدفوعات النقدية ستكون متاحة قريبًا.'
                : "Votre compte agent est approuvé. Le tableau de confirmation des paiements en espèces arrive bientôt."}
        />
    );
}
