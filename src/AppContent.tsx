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
    ClientPortalPlaceholder,
    AgentDashboardPlaceholder,
} from './components/portal/PortalScreens';
const MainApp = lazy(() => import('./MainApp'));
export default function AppContent() {
    const { t } = useLanguage();
    const [user, setUser] = useState<User | null>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const { isLocked, unlock } = useAuthLock();
    const { loading: profileLoading, profile, gateActive, isOperator } = usePoProfile(user);
    const bgApp = 'bg-app-bg text-neutral-900';
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
    const operatorView = (
        <>
            <Suspense fallback={loadingScreen}>
                <MainApp user={user} />
            </Suspense>
            {isLocked && <AuthLockScreen onUnlock={unlock} />}
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
        return <AwaitingApprovalScreen />;
    }
    if (profile.status === 'blocked') {
        return <BlockedScreen />;
    }
    if (profile.role === 'admin') {
        return operatorView;
    }
    if (profile.role === 'agent') {
        return <AgentDashboardPlaceholder />;
    }
    return <ClientPortalPlaceholder />;
}
