import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

const WifiOffIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4 shrink-0">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M9.172 16.172a4 4 0 015.656 0M5.636 12.636a8 8 0 0112.728 0M1.394 8.394a14 14 0 0121.212 0"/>
    </svg>
);

const WifiIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4 shrink-0">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 12.55a11 11 0 0114.08 0M1.42 9a16 16 0 0121.16 0M8.53 16.11a6 6 0 016.95 0M12 20h.01"/>
    </svg>
);

export const OfflineBanner = () => {
    const { t } = useLanguage();
    const [online, setOnline] = useState<boolean>(
        typeof navigator === 'undefined' ? true : navigator.onLine
    );
    const [showReconnected, setShowReconnected] = useState(false);
    const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isFirstMount = useRef(true);

    useEffect(() => {
        const handleOnline = () => {
            setOnline(true);
            // Don't show "reconnected" on first load
            if (!isFirstMount.current) {
                setShowReconnected(true);
                reconnectTimer.current = setTimeout(() => setShowReconnected(false), 3000);
            }
        };
        const handleOffline = () => {
            setOnline(false);
            setShowReconnected(false);
            if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        isFirstMount.current = false;

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
        };
    }, []);

    // One thin line over the top of the screen: it does not push the page down.
    // "Back online" toast
    if (showReconnected) {
        return (
            <div role="status" aria-live="polite"
                className="anim-fade-slide-down fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 border-b border-success/30 bg-financial-profit-bg px-4 pb-1.5 pt-[calc(0.375rem+env(safe-area-inset-top))] text-xs font-bold text-neutral-900">
                <span className="text-financial-profit"><WifiIcon/></span>
                <span>{t('common.backOnline')}</span>
            </div>
        );
    }

    // Offline line
    if (!online) {
        return (
            <div role="status" aria-live="polite"
                className="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 border-b border-warning/40 bg-financial-debt-bg px-4 pb-1.5 pt-[calc(0.375rem+env(safe-area-inset-top))] text-xs font-bold text-neutral-900">
                <span className="text-financial-debt"><WifiOffIcon/></span>
                <span className="min-w-0 truncate">{t('common.offlineLine')}</span>
            </div>
        );
    }

    return null;
};
