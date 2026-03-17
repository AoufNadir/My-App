import React, { Suspense, lazy, useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { useLanguage } from './contexts/LanguageContext';
import { auth } from './firebaseAuth';
import { Auth } from './components/Auth';

const MainApp = lazy(() => import('./MainApp'));

export default function AppContent() {
    const { t } = useLanguage();
    const [user, setUser] = useState<User | null>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const isDark = document.documentElement.classList.contains('dark');
    const bgApp = isDark
        ? 'from-[#0B1120] via-[#0F172A] to-[#1E293B] text-gray-100'
        : 'from-[#F8FAFC] via-[#F1F5F9] to-[#E2E8F0] text-gray-900';

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (nextUser: User | null) => {
            setUser(nextUser);
            setAuthLoading(false);
        });

        return () => unsubscribe();
    }, []);

    if (authLoading) {
        return (
            <div className={`min-h-screen bg-gradient-to-br ${bgApp} flex items-center justify-center text-lg font-semibold`}>
                {t('common.loading')}
            </div>
        );
    }

    if (!user) {
        return <Auth />;
    }

    return (
        <Suspense
            fallback={
                <div className={`min-h-screen bg-gradient-to-br ${bgApp} flex items-center justify-center text-lg font-semibold`}>
                    {t('common.loading')}
                </div>
            }
        >
            <MainApp user={user} />
        </Suspense>
    );
}
