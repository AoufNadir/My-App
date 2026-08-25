import { useEffect, useState } from 'react';
const VIEW_ALIASES: Record<string, string> = {
    clients: 'dzd',
    client: 'dzd',
    reports: 'analytics',
    portfolio: 'statistiques',
    operations: 'transactions',
};
const VALID_VIEWS = new Set([
    'dashboard',
    'transactions',
    'dzd',
    'statistiques',
    'analytics',
    'expenses',
    'tresorerie',
    'services',
    'investors',
]);
function normalizeView(value: string | null | undefined, fallback = 'dashboard') {
    if (!value)
        return fallback;
    const normalized = VIEW_ALIASES[value] || value;
    return VALID_VIEWS.has(normalized) ? normalized : fallback;
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
        setView(targetView);
    };
    const setNormalizedView = (nextView: string) => {
        const targetView = normalizeView(nextView);
        if (targetView === view)
            return;
        setView(targetView);
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
