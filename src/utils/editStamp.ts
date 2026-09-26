import { now } from '../utils';

export type OperationStamp = { date: string; time: string; timestamp: number };

/** Formats a timestamp the same way `now()` does. */
export const stampAt = (timestamp: number): OperationStamp => {
    const d = new Date(timestamp);
    return {
        date: d.toLocaleDateString('fr-FR'),
        time: d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        timestamp
    };
};

/**
 * Date of an operation being saved. A new operation is stamped now; an edited one keeps
 * its original date so its linked client/treasury/portfolio rows stay in the same period.
 */
export const operationStamp = (editing?: { timestamp?: number; date?: string; time?: string } | null): OperationStamp => {
    const timestamp = Number(editing?.timestamp);
    if (!editing || !Number.isFinite(timestamp) || timestamp <= 0)
        return now();
    const derived = stampAt(timestamp);
    return {
        date: editing.date || derived.date,
        time: editing.time || derived.time,
        timestamp
    };
};
