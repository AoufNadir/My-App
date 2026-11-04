// Which phone notifications the owner wants (V9-4). Kept on the phone only: nothing is written to the
// database and no number is touched. Everything is on until switched off.

export const NOTIFICATION_KINDS = ['overdue', 'profit', 'terms', 'inventory'] as const;
export type NotificationKind = typeof NOTIFICATION_KINDS[number];
export const NOTIFICATION_PREFS_KEY = 'app_notif_prefs';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
const defaultStorage = (): StorageLike | null => {
    try {
        return typeof localStorage === 'undefined' ? null : localStorage;
    }
    catch {
        return null;
    }
};

export function readNotificationPrefs(storage: StorageLike | null = defaultStorage()): Record<NotificationKind, boolean> {
    const prefs = Object.fromEntries(NOTIFICATION_KINDS.map((kind) => [kind, true])) as Record<NotificationKind, boolean>;
    try {
        const saved = JSON.parse(storage?.getItem(NOTIFICATION_PREFS_KEY) ?? 'null');
        if (saved && typeof saved === 'object')
            for (const kind of NOTIFICATION_KINDS)
                if (saved[kind] === false)
                    prefs[kind] = false;
    }
    catch {
        // A damaged value reads as « everything on ».
    }
    return prefs;
}

export function writeNotificationPref(kind: NotificationKind, enabled: boolean, storage: StorageLike | null = defaultStorage()): Record<NotificationKind, boolean> {
    const prefs = { ...readNotificationPrefs(storage), [kind]: enabled };
    try {
        storage?.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(prefs));
    }
    catch {
        // Storage refused (private window): the choice lasts until the page closes.
    }
    return prefs;
}

export const isNotificationEnabled = (kind: NotificationKind, storage: StorageLike | null = defaultStorage()): boolean => readNotificationPrefs(storage)[kind];

/** The number on the app's icon (where the phone allows it); 0 clears it. */
export function setAppBadgeCount(count: number): void {
    try {
        const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
        if (count > 0)
            void nav.setAppBadge?.(count)?.catch(() => { });
        else
            void nav.clearAppBadge?.()?.catch(() => { });
    }
    catch {
        // No badge on this phone.
    }
}
