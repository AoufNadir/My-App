import { fromCents, toCents } from './money';

/**
 * « Confirm the client's balance » (V5-3): the owner asks a client what their balance is, types
 * it, and the app compares it with its own figure. A saved confirmation holds no money: it never
 * changes a balance, only narrows where a mistake can be (the operations since the client last
 * agreed) and lets two clients whose gaps cancel out point to a client-to-client transfer that was
 * never recorded.
 *
 * Sign, as everywhere in the app: a positive balance is an advance (the client has credit with
 * us), a negative one is a debt. The gap is what the client says minus what the app says.
 */

/** A gap this small (one dinar) counts as agreement. */
export const CLIENT_CONFIRMATION_TOLERANCE_CENTS = 100;
/** An older confirmation no longer says anything about today's balance. */
export const CLIENT_CONFIRMATION_MAX_AGE_DAYS = 14;
/** How many saved confirmations are kept in view. */
export const CLIENT_CONFIRMATIONS_LISTED = 300;
/** How many operations a hint lists. */
export const CLIENT_CONFIRMATION_LIST_LIMIT = 8;

const DAY_MS = 24 * 60 * 60 * 1000;

export type ClientConfirmation = {
    id: string;
    clientId: string;
    timestamp: number;
    date: string;
    time: string;
    /** The balance the client says, in the app's sign (positive: advance, negative: debt) */
    claimed: number;
    /** What the app said at that moment */
    appBalance: number;
    /** claimed - appBalance, to the cent */
    gap: number;
    note?: string;
};

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const roundCents = (value: number) => fromCents(toCents(value));

/** Whether a gap counts as agreement. */
export const isAgreement = (gap: number): boolean => Math.abs(toCents(gap)) <= CLIENT_CONFIRMATION_TOLERANCE_CENTS;

export function buildClientConfirmationData(
    clientId: string,
    claimed: number,
    appBalance: number,
    stamp: { date: string; time: string; timestamp: number },
    note = '',
): Omit<ClientConfirmation, 'id'> | null {
    if (!clientId || !finite(claimed) || !finite(appBalance) || !finite(stamp.timestamp))
        return null;
    const cleanNote = note.trim();
    return {
        clientId,
        timestamp: stamp.timestamp,
        date: stamp.date,
        time: stamp.time,
        claimed: roundCents(claimed),
        appBalance: roundCents(appBalance),
        gap: fromCents(toCents(claimed) - toCents(appBalance)),
        ...(cleanNote ? { note: cleanNote } : {}),
    };
}

/** Reads a stored document safely: anything malformed is dropped, the gap is recomputed from the two balances. */
export function parseClientConfirmation(id: string, raw: unknown): ClientConfirmation | null {
    if (!raw || typeof raw !== 'object')
        return null;
    const data = raw as Record<string, unknown>;
    if (typeof data.clientId !== 'string' || !data.clientId || !finite(data.timestamp) || !finite(data.claimed) || !finite(data.appBalance))
        return null;
    return {
        id,
        clientId: data.clientId,
        timestamp: data.timestamp,
        date: typeof data.date === 'string' ? data.date : '',
        time: typeof data.time === 'string' ? data.time : '',
        claimed: roundCents(data.claimed),
        appBalance: roundCents(data.appBalance),
        gap: fromCents(toCents(data.claimed) - toCents(data.appBalance)),
        ...(typeof data.note === 'string' && data.note.trim() ? { note: data.note.trim() } : {}),
    };
}

export const sortConfirmationsNewestFirst = (confirmations: readonly ClientConfirmation[]): ClientConfirmation[] =>
    [...confirmations].sort((a, b) => b.timestamp - a.timestamp);

/** The newest confirmation of each client. */
export function latestConfirmationByClient(confirmations: readonly ClientConfirmation[]): Map<string, ClientConfirmation> {
    const latest = new Map<string, ClientConfirmation>();
    for (const confirmation of sortConfirmationsNewestFirst(confirmations)) {
        if (!latest.has(confirmation.clientId))
            latest.set(confirmation.clientId, confirmation);
    }
    return latest;
}

/** The last time this client's figure and the app's agreed, or null when they never did. */
export function lastAgreedConfirmation(confirmations: readonly ClientConfirmation[], clientId: string): ClientConfirmation | null {
    return sortConfirmationsNewestFirst(confirmations).find((confirmation) => confirmation.clientId === clientId && isAgreement(confirmation.gap)) ?? null;
}

export type ClientGap = {
    clientId: string;
    claimed: number;
    /** The app's balance now */
    balanceNow: number;
    /** claimed - balanceNow: what is still different */
    gap: number;
    confirmedAt: number;
    confirmedDate: string;
};

/**
 * The clients whose latest confirmation still differs from the app today. A confirmation older than
 * two weeks is ignored, and a gap that the app has since closed (an operation was added or edited)
 * is not listed any more.
 */
export function openClientGaps(input: {
    confirmations: readonly ClientConfirmation[];
    balances: ReadonlyMap<string, number>;
    now: number;
    /** Only these clients are looked at (the active ones); everyone when omitted */
    clientIds?: ReadonlySet<string>;
}): ClientGap[] {
    const gaps: ClientGap[] = [];
    for (const confirmation of latestConfirmationByClient(input.confirmations).values()) {
        if (input.clientIds && !input.clientIds.has(confirmation.clientId))
            continue;
        if (input.now - confirmation.timestamp > CLIENT_CONFIRMATION_MAX_AGE_DAYS * DAY_MS)
            continue;
        const balanceNow = input.balances.get(confirmation.clientId) ?? 0;
        const gap = fromCents(toCents(confirmation.claimed) - toCents(balanceNow));
        if (isAgreement(gap))
            continue;
        gaps.push({ clientId: confirmation.clientId, claimed: confirmation.claimed, balanceNow: roundCents(balanceNow), gap, confirmedAt: confirmation.timestamp, confirmedDate: confirmation.date });
    }
    return gaps;
}

export type ClientTransferSuggestion = {
    /** The client whose real balance is higher than the app's: the transfer raises it */
    fromClientId: string;
    /** The client whose real balance is lower than the app's: the transfer lowers it */
    toClientId: string;
    amount: number;
};

/**
 * Two clients whose gaps are equal and opposite: a transfer between them was probably never
 * recorded. In the app a transfer raises the source's balance and lowers the destination's, so the
 * source is the client who says more than the app and the destination the one who says less.
 * One-to-one: each client is in at most one suggestion.
 */
export function clientTransferSuggestions(gaps: readonly ClientGap[]): ClientTransferSuggestion[] {
    const higher = gaps.filter((gap) => gap.gap > 0).sort((a, b) => toCents(b.gap) - toCents(a.gap));
    const lower = gaps.filter((gap) => gap.gap < 0).sort((a, b) => toCents(a.gap) - toCents(b.gap));
    const used = new Set<string>();
    const suggestions: ClientTransferSuggestion[] = [];
    for (const source of higher) {
        let best: ClientGap | null = null;
        let bestDistance = Infinity;
        for (const destination of lower) {
            if (used.has(destination.clientId))
                continue;
            const distance = Math.abs(toCents(source.gap) + toCents(destination.gap));
            if (distance <= CLIENT_CONFIRMATION_TOLERANCE_CENTS && distance < bestDistance) {
                best = destination;
                bestDistance = distance;
            }
        }
        if (!best)
            continue;
        used.add(best.clientId);
        suggestions.push({ fromClientId: source.clientId, toClientId: best.clientId, amount: fromCents(Math.max(toCents(source.gap), Math.abs(toCents(best.gap)))) });
    }
    return suggestions;
}

export type ClientOperationRow = {
    id: string;
    clientId: string;
    timestamp: number;
    date?: string;
    time?: string;
    type?: string;
    montant?: number;
    /** False for an operation settled on the spot, which does not touch the balance */
    affectsBalance?: boolean;
};

export type ClientOperationHint = {
    id: string;
    timestamp: number;
    date: string;
    time: string;
    type: string;
    /** The effect on the client's balance (positive: toward advance) */
    effect: number;
};

/**
 * The operations that touched this client's balance since the app and the client last agreed
 * (everything when they never did), newest first: where the mistake is.
 */
export function clientOperationsSince(
    rows: readonly ClientOperationRow[],
    clientId: string,
    since: number | null,
): { count: number; operations: ClientOperationHint[] } {
    const all: ClientOperationHint[] = [];
    for (const row of rows) {
        if (row.clientId !== clientId || row.affectsBalance === false || (since !== null && row.timestamp <= since))
            continue;
        const effect = Number(row.montant);
        if (!Number.isFinite(effect) || effect === 0)
            continue;
        all.push({ id: row.id, timestamp: row.timestamp, date: row.date ?? '', time: row.time ?? '', type: String(row.type ?? ''), effect });
    }
    all.sort((a, b) => b.timestamp - a.timestamp);
    return { count: all.length, operations: all.slice(0, CLIENT_CONFIRMATION_LIST_LIMIT) };
}
