import { useEffect, useState } from 'react';
const WifiOffIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M9.172 16.172a4 4 0 015.656 0M5.636 12.636a8 8 0 0112.728 0M1.394 8.394a14 14 0 0121.212 0"/>
  </svg>);
export const OfflineBanner = () => {
    const [online, setOnline] = useState<boolean>(typeof navigator === 'undefined' ? true : navigator.onLine);
    useEffect(() => {
        const handleOnline = () => setOnline(true);
        const handleOffline = () => setOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);
    if (online)
        return null;
    return (<div role="status" aria-live="polite" className="anim-fade-slide-down fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 bg-warning px-4 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))] text-xs font-medium text-white shadow-md">
      <WifiOffIcon />
      <span>Mode hors ligne — les modifications seront synchronisées au retour de la connexion.</span>
    </div>);
};
