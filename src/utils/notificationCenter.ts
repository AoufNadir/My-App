// The Home page's bell (V11-4): what needs attention, how many are unread, and what « read » means.
// An item is read when the signature saved for it is the one it has now. A state (late clients, uncovered advances, low
// stock) changes its signature when the situation changes (18 late clients, then 19), so it comes back unread by itself;
// an event (an investor's term, a recap) keeps the same signature until it is dealt with or goes away.

export type NotificationEntry = { id: string; signature: string; urgent?: boolean };
export type ReadMap = Record<string, string>;

export const NOTIFICATION_READ_STORAGE_KEY = 'app_notification_read';

export function isUnread(entry: NotificationEntry, read: ReadMap): boolean {
    return read[entry.id] !== entry.signature;
}

export function unreadCount(entries: ReadonlyArray<NotificationEntry>, read: ReadMap): number {
    return entries.filter((entry) => isUnread(entry, read)).length;
}

/** Red when something urgent (money at risk) is still unread, blue otherwise, and no badge without unread items. */
export function badgeTone(entries: ReadonlyArray<NotificationEntry>, read: ReadMap): 'none' | 'urgent' | 'info' {
    const unread = entries.filter((entry) => isUnread(entry, read));
    if (unread.length === 0)
        return 'none';
    return unread.some((entry) => entry.urgent) ? 'urgent' : 'info';
}

/** Marks every entry as read, and forgets the ones that are gone so the saved map does not grow. */
export function markAllRead(entries: ReadonlyArray<NotificationEntry>): ReadMap {
    return Object.fromEntries(entries.map((entry) => [entry.id, entry.signature]));
}

export function parseReadMap(raw: string | null): ReadMap {
    try {
        const value = raw ? JSON.parse(raw) : null;
        if (!value || typeof value !== 'object' || Array.isArray(value))
            return {};
        return Object.fromEntries(Object.entries(value).filter((pair): pair is [string, string] => typeof pair[1] === 'string'));
    }
    catch {
        return {};
    }
}

export function readStoredReadMap(): ReadMap {
    try {
        return parseReadMap(window.localStorage.getItem(NOTIFICATION_READ_STORAGE_KEY));
    }
    catch {
        return {};
    }
}

export function storeReadMap(map: ReadMap) {
    try {
        window.localStorage.setItem(NOTIFICATION_READ_STORAGE_KEY, JSON.stringify(map));
    }
    catch {
        // Storage unavailable: read lasts for this visit only.
    }
}
