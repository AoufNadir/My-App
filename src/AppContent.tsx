import { CurrencyRegistryGate } from './currency/CurrencyRegistryGate';
import React, { Suspense, lazy, useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { useLanguage } from './contexts/LanguageContext';
import { auth } from './firebaseAuth';
import { Auth } from './components/Auth';
import { AuthLockScreen } from './components/AuthLockScreen';
import { useAuthLock } from './hooks/useAuthLock';
import { usePoProfile } from './hooks/usePoProfile';
import {
    AwaitingApprovalScreen,
    BlockedScreen,
    AgentDashboardPlaceholder,
} from './components/portal/PortalScreens';
import { ClientPortalPage } from './pages/ClientPortalPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { UpdateBar } from './components/ui/UpdateBar';
import { isOwnerUid } from './config/orderSystem';
import { useAccess } from './hooks/useAccess';
import { accessState } from './utils/access';
import { setReadOnlyReason } from './firebase';
import { AccessBanner, PendingActivationScreen, readOnlyMessage } from './components/access/AccessScreens';
const MainApp = lazy(() => import('./MainApp'));
export default function AppContent() {
    const { t, lang } = useLanguage();
    const [user, setUser] = useState<User | null>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const { isLocked, unlock } = useAuthLock();
    const { loading: profileLoading, profile, gateActive, isOperator } = usePoProfile(user);
    const bgApp = 'bg-app-bg text-neutral-900';
    // V21-1: subscriptions. The owner is never limited; a customer needs an activation, and is read-only after it ends.
    const ownerAccount = isOwnerUid(user?.uid);
    const access = useAccess(user?.uid, ownerAccount);
    const [clock, setClock] = useState(() => Date.now());
    useEffect(() => { const id = setInterval(() => setClock(Date.now()), 60_000); return () => clearInterval(id); }, []);
    const subscription = accessState({ isOperator: ownerAccount, loaded: access.loaded, access: access.access, now: clock });
    useEffect(() => { setReadOnlyReason(subscription === 'expired' ? readOnlyMessage(lang) : null); }, [subscription, lang]);
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (nextUser: User | null) => {
            setUser(nextUser);
            setAuthLoading(false);
        });
        return () => unsubscribe();
    }, []);
    const loadingScreen = (
        <div className={`min-h-screen ${bgApp} flex items-center justify-center text-lg font-semibold`}>
            {t('common.loading')}
        </div>
    );
    if (authLoading) {
        return loadingScreen;
    }
    if (!user) {
        return <Auth />;
    }
    if (subscription === 'loading') {
        return loadingScreen;
    }
    if (subscription === 'pending') {
        return <PendingActivationScreen uid={user.uid} email={user.email ?? ''} displayName={user.displayName ?? ''} />;
    }
    const operatorView = (
        <>
            <AccessBanner state={subscription} until={access.access?.until ?? null} />
            <CurrencyRegistryGate uid={user.uid} loading={loadingScreen}>
                <ErrorBoundary key="app">
                    <Suspense fallback={loadingScreen}>
                        <MainApp user={user} />
                    </Suspense>
                </ErrorBoundary>
            </CurrencyRegistryGate>
            {isLocked && <AuthLockScreen onUnlock={unlock} />}
            <UpdateBar />
        </>
    );
    // Role gate is dormant until the operator uid is configured; the operator
    // always lands on the existing dashboard.
    if (!gateActive || isOperator) {
        return operatorView;
    }
    if (profileLoading) {
        return loadingScreen;
    }
    // Non-operator users routed by their order-system role/status.
    if (!profile || profile.status === 'pending') {
        return <AwaitingApprovalScreen uid={user.uid} />;
    }
    if (profile.status === 'blocked') {
        return <BlockedScreen uid={user.uid} />;
    }
    if (profile.role === 'admin') {
        return operatorView;
    }
    if (profile.role === 'agent') {
        return <AgentDashboardPlaceholder uid={user.uid} />;
    }
    return <ClientPortalPage user={user} profile={profile} />;
}
