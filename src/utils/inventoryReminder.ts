import { investorTermDaysKey } from './investorTerms';
import { toDateInputValue } from './dateInput';

/**
 * V5-4: the daily reminder to count the cash (the inventory). It looks only at when the last count
 * was saved, never at a balance. Local time throughout, like every day the app shows.
 *
 * - counted today: no reminder;
 * - last count yesterday: the reminder opens at 17:00, when the day is nearly done;
 * - never counted, or two days or more ago: it shows at once.
 * « Remind me tomorrow » hides it for the rest of today.
 */
export const REMINDER_FROM_HOUR = 17;

export type InventoryReminder = {
    /** Whole days since the last count; null when no count was ever saved. */
    daysSince: number | null;
    lastTimestamp: number | null;
};

const dayStart = (timestamp: number): number => {
    const date = new Date(timestamp);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
};

export function inventoryReminder(input: {
    /** Time of the latest saved count, null when the list is known to be empty. */
    lastTimestamp: number | null;
    now: number;
    /** The local day (yyyy-mm-dd) on which « remind me tomorrow » was tapped. */
    snoozedDay: string | null;
    /** False until the saved counts were really received: an empty cache is not « never counted ». */
    ready: boolean;
}): InventoryReminder | null {
    if (!input.ready)
        return null;
    const today = toDateInputValue(new Date(input.now));
    if (input.snoozedDay === today)
        return null;
    if (input.lastTimestamp === null || !Number.isFinite(input.lastTimestamp))
        return { daysSince: null, lastTimestamp: null };
    // Round: a day is 23 or 25 hours long when the clock changes.
    const daysSince = Math.round((dayStart(input.now) - dayStart(input.lastTimestamp)) / 86_400_000);
    if (daysSince <= 0)
        return null;
    if (daysSince === 1 && new Date(input.now).getHours() < REMINDER_FROM_HOUR)
        return null;
    return { daysSince, lastTimestamp: input.lastTimestamp };
}

/** The sentence key for a reminder: never counted, counted yesterday, or counted {days} ago. */
export function inventoryReminderKey(reminder: Pick<InventoryReminder, 'daysSince'>): 'inventoryReminder.never' | 'inventoryReminder.yesterday' | 'inventoryReminder.days' {
    if (reminder.daysSince === null)
        return 'inventoryReminder.never';
    return reminder.daysSince === 1 ? 'inventoryReminder.yesterday' : 'inventoryReminder.days';
}

/** The sentence as plain text (phone notification); the home card builds it with rendered numbers. */
export function inventoryReminderText(reminder: Pick<InventoryReminder, 'daysSince'>, t: (key: string) => unknown): string {
    const key = inventoryReminderKey(reminder);
    const template = String(t(key));
    if (key !== 'inventoryReminder.days' || reminder.daysSince === null)
        return template;
    const days = String(t(investorTermDaysKey(reminder.daysSince))).split('{count}').join(String(reminder.daysSince));
    return template.split('{days}').join(days);
}

// « Remind me tomorrow »: the local day on which it was tapped, kept on this phone.
export const INVENTORY_SNOOZE_STORAGE_KEY = 'app_inventory_reminder_snooze';
type SnoozeStorage = Pick<Storage, 'getItem' | 'setItem'>;
const browserStorage = (): SnoozeStorage | null => {
    try {
        return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
    }
    catch {
        return null;
    }
};

/** The day (yyyy-mm-dd) « remind me tomorrow » was tapped; null when never, or when storage is unavailable. */
export function readInventorySnooze(storage: SnoozeStorage | null = browserStorage()): string | null {
    try {
        const value = storage?.getItem(INVENTORY_SNOOZE_STORAGE_KEY);
        return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
    }
    catch {
        return null;
    }
}

export function snoozeInventoryReminder(now: number, storage: SnoozeStorage | null = browserStorage()): string {
    const day = toDateInputValue(new Date(now));
    try {
        storage?.setItem(INVENTORY_SNOOZE_STORAGE_KEY, day);
    }
    catch {
        // Storage unavailable (private browsing): the reminder comes back on the next visit.
    }
    return day;
}
