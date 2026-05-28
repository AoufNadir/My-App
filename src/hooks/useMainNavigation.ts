import { startTransition, useEffect, useState } from 'react';
function normalizeView(value: string | null | undefined, fallback = 'dashboard') {
    if (!value)
        return fallback;
    return value === 'reports' ? 'analytics' : value;
}
function getStoredValue(key: string, fallback: string) {
    if (typeof window === 'undefined')
        return fallback;
    return normalizeView(window.localStorage.getItem(key), fallback);
}
export function useMainNavigation() {
    const [view, setView] = useState(() => getStoredValue('app_view', 'dashboard'));
    const [selectedClientId, setSelectedClientId] = useState<string | null>(() => {
        if (typeof window === 'undefined')
            return null;
        return window.localStorage.getItem('selected_client_id');
    });
    const [isInvestorRoute, setIsInvestorRoute] = useState(() => typeof window !== 'undefined' && window.location.pathname.startsWith('/investor'));
    const [investorIdFromUrl, setInvestorIdFromUrl] = useState<string | null>(() => {
        if (typeof window === 'undefined')
            return null;
        return new URLSearchParams(window.location.search).get('id');
    });
    useEffect(() => {
        if (typeof window === 'undefined')
            return;
        const pathname = window.location.pathname;
        if (pathname.startsWith('/investor')) {
            setIsInvestorRoute(true);
            setInvestorIdFromUrl(new URLSearchParams(window.location.search).get('id'));
            return;
        }
        setIsInvestorRoute(false);
    }, []);
    useEffect(() => {
        if (typeof window === 'undefined')
            return;
        window.localStorage.setItem('app_view', view);
    }, [view]);
    useEffect(() => {
        if (typeof window === 'undefined')
            return;
        if (selectedClientId) {
            window.localStorage.setItem('selected_client_id', selectedClientId);
            return;
        }
        window.localStorage.removeItem('selected_client_id');
    }, [selectedClientId]);
    const navigateToView = (nextView: string) => {
        const targetView = normalizeView(nextView);
        if (targetView === view)
            return;
        startTransition(() => {
            setView(targetView);
        });
    };
    const setNormalizedView = (nextView: string) => {
        setView(normalizeView(nextView));
    };
    return {
        investorIdFromUrl,
        isInvestorRoute,
        navigateToView,
        selectedClientId,
        setSelectedClientId,
        setView: setNormalizedView,
        view
    };
}
