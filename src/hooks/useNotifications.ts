import { useCallback, useEffect, useState } from 'react';
import type { FirestoreDocumentReference } from '../firebase';

const PERM_ASKED_KEY = 'app_notification_perm_asked';
const NOTIF_LAST_OVERDUE_KEY = 'app_notif_last_overdue';
const NOTIF_LAST_DISTRIB_KEY = 'app_notif_last_distrib';

export type NotifPermission = 'default' | 'granted' | 'denied' | 'unsupported';

function dayKey() {
    return new Date().toISOString().slice(0, 10);
}

export function useNotifications(userDocRef?: FirestoreDocumentReference) {
    const isSupported = typeof window !== 'undefined' && 'Notification' in window;

    const [permission, setPermission] = useState<NotifPermission>(() => {
        if (!isSupported) return 'unsupported';
        return Notification.permission as NotifPermission;
    });

    const [permAsked, setPermAsked] = useState(() =>
        typeof window !== 'undefined' && !!localStorage.getItem(PERM_ASKED_KEY)
    );

    // Sync permission state when it changes externally
    useEffect(() => {
        if (!isSupported) return;
        setPermission(Notification.permission as NotifPermission);
    }, [isSupported]);

    const requestPermission = useCallback(async () => {
        if (!isSupported) return 'unsupported' as NotifPermission;
        localStorage.setItem(PERM_ASKED_KEY, '1');
        setPermAsked(true);
        try {
            const result = await Notification.requestPermission();
            setPermission(result as NotifPermission);

            // Try to register FCM token for future background push
            if (result === 'granted' && userDocRef) {
                registerFCMToken(userDocRef).catch(() => {/* silent fail */});
            }

            return result as NotifPermission;
        } catch {
            return 'denied' as NotifPermission;
        }
    }, [isSupported, userDocRef]);

    const showNotification = useCallback((
        title: string,
        body: string,
        options?: { icon?: string; tag?: string; requireInteraction?: boolean }
    ) => {
        if (!isSupported || Notification.permission !== 'granted') return;
        try {
            new Notification(title, {
                body,
                icon: '/pwa-icon.png',
                badge: '/pwa-icon.png',
                ...options,
            });
        } catch {
            // Some browsers restrict Notification outside secure contexts or SW
        }
    }, [isSupported]);

    // Auto-check overdue clients (once per day)
    const notifyOverdueClients = useCallback((overdueCount: number, overdueNames: string[]) => {
        if (!isSupported || Notification.permission !== 'granted' || overdueCount === 0) return;
        const today = dayKey();
        if (localStorage.getItem(NOTIF_LAST_OVERDUE_KEY) === today) return;
        localStorage.setItem(NOTIF_LAST_OVERDUE_KEY, today);

        const names = overdueNames.slice(0, 2).join(', ');
        const extra = overdueCount > 2 ? ` et ${overdueCount - 2} autre${overdueCount > 3 ? 's' : ''}` : '';
        showNotification(
            `⚠️ ${overdueCount} client${overdueCount > 1 ? 's' : ''} en retard`,
            `${names}${extra} — dettes impayées depuis plus de 7 jours`,
            { tag: 'overdue-clients' }
        );
    }, [isSupported, showNotification]);

    // Auto-check investor profit distribution (once per day)
    const notifyInvestorProfit = useCallback((totalAvailable: number) => {
        if (!isSupported || Notification.permission !== 'granted' || totalAvailable < 10000) return;
        const today = dayKey();
        if (localStorage.getItem(NOTIF_LAST_DISTRIB_KEY) === today) return;
        localStorage.setItem(NOTIF_LAST_DISTRIB_KEY, today);

        showNotification(
            '💰 Profits à distribuer',
            `${Math.round(totalAvailable).toLocaleString('fr-FR')} DZD disponibles pour les investisseurs`,
            { tag: 'investor-profit' }
        );
    }, [isSupported, showNotification]);

    return {
        isSupported,
        permission,
        permAsked,
        requestPermission,
        showNotification,
        notifyOverdueClients,
        notifyInvestorProfit,
    };
}

// Register FCM token for background push (requires VAPID key from Firebase Console)
async function registerFCMToken(userDocRef: FirestoreDocumentReference) {
    try {
        const { getMessaging, getToken } = await import('firebase/messaging');
        const { app } = await import('../firebaseApp');
        const messaging = getMessaging(app);

        // VAPID key from Firebase Console → Project Settings → Cloud Messaging → Web Push certificates
        // Replace this placeholder with your actual VAPID key:
        const VAPID_KEY = ''; // TODO: Add VAPID key from Firebase Console

        if (!VAPID_KEY) return; // Skip if not configured

        const token = await getToken(messaging, { vapidKey: VAPID_KEY });
        if (token) {
            await userDocRef.set({ fcmToken: token, fcmTokenUpdatedAt: Date.now() }, { merge: true });
        }
    } catch {
        // FCM not available in this context (requires HTTPS + service worker)
    }
}
