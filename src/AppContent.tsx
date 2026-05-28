import React, { Suspense, lazy, useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { useLanguage } from './contexts/LanguageContext';
import { auth } from './firebaseAuth';
import { Auth } from './components/Auth';
import { AuthLockScreen } from './components/AuthLockScreen';
import { useAuthLock } from './hooks/useAuthLock';
const MainApp = lazy(() => import('./MainApp'));
export default function AppContent() {
    const { t } = useLanguage();
    const [user, setUser] = useState<User | null>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const { isLocked, unlock } = useAuthLock();
    const bgApp = 'bg-app-bg text-neutral-900';
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (nextUser: User | null) => {
            setUser(nextUser);
            setAuthLoading(false);
        });
        return () => unsubscribe();
    }, []);
    if (authLoading) {
        return (<div className={`min-h-screen ${bgApp} flex items-center justify-center text-lg font-semibold`}>
                {t('common.loading')}
            </div>);
    }
    if (!user) {
        return <Auth />;
    }
    return (<>
            <Suspense fallback={<div className={`min-h-screen ${bgApp} flex items-center justify-center text-lg font-semibold`}>
                        {t('common.loading')}
                    </div>}>
                <MainApp user={user}/>
            </Suspense>
            {isLocked && <AuthLockScreen onUnlock={unlock}/>}
        </>);
}
