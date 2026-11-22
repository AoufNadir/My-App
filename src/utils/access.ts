// V21-1 (owner, 2026-11-22): subscriptions. A customer account works only once the operator has activated it
// (access/{uid}.until, a date in ms); past that date it is read-only. The operator's own account is never limited.
// The Firestore rules enforce the same thing on the server (canWrite in firestore.rules).

export type AccessDoc = { until: number; name?: string; phone?: string; email?: string; activatedAt?: number };
export type AccessState = 'operator' | 'loading' | 'pending' | 'active' | 'expiring' | 'expired';

export const DAY_MS = 24 * 60 * 60 * 1000;
export const EXPIRY_WARNING_DAYS = 7;
export const ACCESS_DURATIONS = [
    { id: 'trial', days: 14 },
    { id: 'month', days: 30 },
    { id: 'quarter', days: 90 },
    { id: 'year', days: 365 },
] as const;
export type AccessDurationId = (typeof ACCESS_DURATIONS)[number]['id'];

export function readAccess(raw: unknown): AccessDoc | null {
    if (!raw || typeof raw !== 'object') return null;
    const until = Number((raw as { until?: unknown }).until);
    return Number.isFinite(until) ? { ...(raw as AccessDoc), until } : null;
}

export function accessState(input: { isOperator: boolean; loaded: boolean; access: AccessDoc | null; now: number }): AccessState {
    if (input.isOperator) return 'operator';
    if (!input.loaded) return 'loading';
    if (!input.access) return 'pending';
    if (input.access.until <= input.now) return 'expired';
    return input.access.until - input.now <= EXPIRY_WARNING_DAYS * DAY_MS ? 'expiring' : 'active';
}

export const daysLeft = (until: number, now: number): number => Math.max(0, Math.ceil((until - now) / DAY_MS));

/** A new end date: an extension starts from the current end when it is still running, otherwise from now. */
export function extendedUntil(current: number | null | undefined, days: number, now: number): number {
    const from = current && current > now ? current : now;
    return from + days * DAY_MS;
}

export const canWriteWith = (state: AccessState): boolean => state === 'operator' || state === 'active' || state === 'expiring';
