import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { useLanguage } from './contexts/LanguageContext';
import { auth } from './firebase';
import { Auth } from './components/Auth';
import MainApp from './MainApp';

export default function AppContent() {
    const { t } = useLanguage();
    const [user, setUser] = useState<User | null>(null);
    const [authLoading, setAuthLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (nextUser: User | null) => {
            setUser(nextUser);
            setAuthLoading(false);
        });

        return () => unsubscribe();
    }, []);

    if (authLoading) {
        const isDark = document.documentElement.classList.contains('dark');
        const bgApp = isDark
            ? 'from-[#0B1120] via-[#0F172A] to-[#1E293B] text-gray-100'
            : 'from-[#F8FAFC] via-[#F1F5F9] to-[#E2E8F0] text-gray-900';

        return (
            <div className={`min-h-screen bg-gradient-to-br ${bgApp} flex items-center justify-center text-lg font-semibold`}>
                {t('common.loading')}
            </div>
        );
    }

    if (!user) {
        return <Auth />;
    }

    return <MainApp user={user} />;
}
