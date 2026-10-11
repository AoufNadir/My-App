import type { ClientTransactionDzd, TreasuryTx, Tx } from '../types';

/**
 * V7-2: every money movement typed by hand has a reason and a visible effect.
 *
 * The treasury adjustment window is the catch-all of the (+) menu: it moves the Caisse, BaridiMob,
 * USDT or EUR without saying why. Recording a payment sent to a client there, without the client,
 * moves the box but not his balance, and the gap only shows at the inventory. This module holds what
 * the window asks (a reason per wallet and direction), when Save is allowed, and how the movements
 * recorded without a reason are found afterwards. Nothing here changes a balance.
 */

export type AdjustmentAssetValue = 'DZD-Caisse' | 'DZD-Baridi' | 'USDT' | 'EUR';
export type AdjustmentDirection = 'add' | 'subtract';

/**
 * - `client`: collecting from or paying a client (the client row carries the effect).
 * - `personal_withdrawal`, `project_expense`, `wallet_transfer`, `buy`, `sell`: windows that already exist.
 * - `other`: a correction or any other reason, written in words.
 */
export type AdjustmentReason = 'client' | 'personal_withdrawal' | 'project_expense' | 'wallet_transfer' | 'buy' | 'sell' | 'other';

const DZD_ADD: readonly AdjustmentReason[] = ['client', 'wallet_transfer', 'other'];
const DZD_SUBTRACT: readonly AdjustmentReason[] = ['client', 'personal_withdrawal', 'project_expense', 'wallet_transfer', 'other'];
const CRYPTO_ADD: readonly AdjustmentReason[] = ['buy', 'other'];
const CRYPTO_SUBTRACT: readonly AdjustmentReason[] = ['sell', 'personal_withdrawal', 'project_expense', 'other'];

export const isDzdAdjustmentAsset = (asset: string) => asset === 'DZD-Caisse' || asset === 'DZD-Baridi';

/** The wallet of a cash or BaridiMob adjustment, as the window names it. */
export const adjustmentAssetOf = (value: string): AdjustmentAssetValue | null =>
    value === 'DZD-Caisse' || value === 'DZD-Baridi' || value === 'USDT' || value === 'EUR' ? value : null;

/** The reasons offered for this wallet and direction, in the order shown. */
export function adjustmentReasonsFor(asset: AdjustmentAssetValue, direction: AdjustmentDirection): readonly AdjustmentReason[] {
    if (isDzdAdjustmentAsset(asset))
        return direction === 'add' ? DZD_ADD : DZD_SUBTRACT;
    return direction === 'add' ? CRYPTO_ADD : CRYPTO_SUBTRACT;
}

/** True when this reason is one the window offers for this wallet and direction. */
export function isAdjustmentReasonAllowed(asset: string, direction: AdjustmentDirection, reason: AdjustmentReason | ''): boolean {
    const wallet = adjustmentAssetOf(asset);
    return Boolean(wallet && reason && adjustmentReasonsFor(wallet, direction).includes(reason));
}

/** These reasons already have a window of their own: choosing one leaves the adjustment window for it. */
export const isRedirectReason = (reason: AdjustmentReason | '') =>
    reason === 'personal_withdrawal' || reason === 'project_expense' || reason === 'wallet_transfer' || reason === 'buy' || reason === 'sell';

/** Notes that say nothing: the defaults the window and the older versions wrote. */
const EMPTY_NOTES = new Set(['ajustement trésorerie', 'ajustement tresorerie', 'ajustement manuel']);

/** A written reason: at least three characters, and not the default note that explains nothing. */
export function isMeaningfulReasonNote(note: string | undefined | null): boolean {
    const text = String(note ?? '').trim();
    return text.length >= 3 && !EMPTY_NOTES.has(text.toLowerCase());
}

export type AdjustmentReasonBlock = 'reason' | 'client' | 'note';

/** Why Save is off for the reason part of the window, or null when the reason is complete. */
export function adjustmentReasonBlock(input: { reason: AdjustmentReason | ''; clientId: string; note: string }): AdjustmentReasonBlock | null {
    if (!input.reason || isRedirectReason(input.reason))
        return 'reason';
    if (input.reason === 'client' && !input.clientId)
        return 'client';
    if (input.reason === 'other' && !isMeaningfulReasonNote(input.note))
        return 'note';
    return null;
}

// ── Reasons written in words (users/{uid}/movement_reasons) ─────────────────

export type MovementKind = 'treasury' | 'crypto';

/** A reason written for a movement; a separate collection, so it never touches the movement itself. */
export type MovementReasonDoc = {
    id: string;
    movementKind: MovementKind;
    movementId: string;
    note: string;
    timestamp: number;
    /** Where it was written: the adjustment window, or the review list afterwards */
    source: 'adjustment' | 'review';
};

export const movementReasonDocId = (kind: MovementKind, movementId: string) => `${kind}_${movementId}`;

export function buildMovementReasonData(kind: MovementKind, movementId: string, note: string, timestamp: number, source: MovementReasonDoc['source']): Omit<MovementReasonDoc, 'id'> | null {
    const text = String(note ?? '').trim();
    if (!movementId || !isMeaningfulReasonNote(text) || !Number.isFinite(timestamp))
        return null;
    return { movementKind: kind, movementId, note: text, timestamp, source };
}

/** Reads a stored document safely: anything malformed is dropped. */
export function parseMovementReason(id: string, raw: unknown): MovementReasonDoc | null {
    if (!raw || typeof raw !== 'object')
        return null;
    const data = raw as Record<string, unknown>;
    if ((data.movementKind !== 'treasury' && data.movementKind !== 'crypto') || typeof data.movementId !== 'string' || !data.movementId)
        return null;
    if (typeof data.note !== 'string' || !data.note.trim() || typeof data.timestamp !== 'number' || !Number.isFinite(data.timestamp))
        return null;
    return {
        id,
        movementKind: data.movementKind,
        movementId: data.movementId,
        note: data.note.trim(),
        timestamp: data.timestamp,
        source: data.source === 'review' ? 'review' : 'adjustment',
    };
}

export function reasonMapOf(reasons: readonly MovementReasonDoc[]): Map<string, MovementReasonDoc> {
    return new Map(reasons.map((reason) => [movementReasonDocId(reason.movementKind, reason.movementId), reason] as const));
}

// ── Movements recorded without a reason ─────────────────────────────────────

/** Fields that tie a treasury row to something that explains it (a sale, an expense, an investor, a client...). */
const TREASURY_LINKS = [
    'origin', 'linkedTxId', 'linkedInvestorTxId', 'linkedCapitalInvestorTxId', 'linkedTreasuryTxId', 'linkedAssetTxId',
    'linkedDigitalServiceTxId', 'linkedProjectExpenseTxId', 'linkedReturnTxId', 'advanceState', 'expenseWallet',
] as const;
const CRYPTO_LINKS = [
    'origin', 'linkedTxId', 'linkedDigitalServiceTxId', 'linkedProjectExpenseTxId', 'linkedPersonalExpenseTxId', 'linkedTreasuryTxId',
] as const;

const hasAny = (row: object, keys: readonly string[]) => keys.some((key) => Boolean((row as Record<string, unknown>)[key]));

/** A plain cash or BaridiMob entry or exit: not a transfer between wallets. */
function isPlainTreasuryMovement(tx: TreasuryTx): boolean {
    if (tx.type === 'Transfer' || String(tx.notes ?? '').includes('Virement'))
        return false;
    return (tx.type === 'Ajout' || tx.type === 'Retrait' || tx.type === 'Adjustment (+)' || tx.type === 'Adjustment (-)')
        && (tx.source === 'Caisse' || tx.source === 'BaridiMob');
}

/** True for a cash or BaridiMob movement that nothing explains: no link, no client row, no origin. */
export function isUnlinkedTreasuryMovement(tx: TreasuryTx, clientLinkedIds: ReadonlySet<string>): boolean {
    return isPlainTreasuryMovement(tx) && !hasAny(tx, TREASURY_LINKS) && !clientLinkedIds.has(tx.id);
}

/** True for a hand-typed USDT or EUR entry or exit that nothing explains. */
export function isUnlinkedCryptoMovement(tx: Tx): boolean {
    return (tx.type === 'Ajout Manuel' || tx.type === 'Retrait Manuel') && !hasAny(tx, CRYPTO_LINKS);
}

export type ReviewWallet = 'Caisse' | 'BaridiMob' | 'USDT' | 'EUR';

export type ReviewRow = {
    key: string;
    kind: MovementKind;
    id: string;
    wallet: ReviewWallet;
    direction: 'in' | 'out';
    /** Dinars for the cash wallets, units for USDT and EUR */
    amount: number;
    currency: 'DZD' | 'USDT' | 'EUR';
    timestamp: number;
    date: string;
    time: string;
    /** What was typed when it was recorded (may be the empty default) */
    note: string;
    /** The reason written afterwards, when there is one */
    reasonNote?: string;
    /** Only a cash or BaridiMob movement can be attached to a client */
    canLinkClient: boolean;
};

export type MovementReview = {
    /** No client, no link, no written reason */
    unexplained: ReviewRow[];
    /** Explained in words only: kept in view so they can be checked */
    explained: ReviewRow[];
};

const newestFirst = (a: ReviewRow, b: ReviewRow) => b.timestamp - a.timestamp || a.key.localeCompare(b.key);

export function buildMovementReview(input: {
    treasury: readonly TreasuryTx[];
    crypto: readonly Tx[];
    clientRows: ReadonlyArray<Pick<ClientTransactionDzd, 'linkedTxId'>>;
    reasons: readonly MovementReasonDoc[];
}): MovementReview {
    const clientLinkedIds = new Set<string>();
    for (const row of input.clientRows) {
        if (row.linkedTxId)
            clientLinkedIds.add(row.linkedTxId);
    }
    const reasonByKey = reasonMapOf(input.reasons);
    const review: MovementReview = { unexplained: [], explained: [] };
    const place = (row: ReviewRow) => (row.reasonNote ? review.explained : review.unexplained).push(row);
    for (const tx of input.treasury) {
        if (!isUnlinkedTreasuryMovement(tx, clientLinkedIds))
            continue;
        const reason = reasonByKey.get(movementReasonDocId('treasury', tx.id));
        place({
            key: movementReasonDocId('treasury', tx.id),
            kind: 'treasury',
            id: tx.id,
            wallet: tx.source as ReviewWallet,
            direction: tx.type === 'Ajout' || tx.type === 'Adjustment (+)' ? 'in' : 'out',
            amount: Math.abs(Number(tx.amount || 0)),
            currency: 'DZD',
            timestamp: tx.timestamp,
            date: tx.date,
            time: tx.time,
            note: String(tx.notes ?? ''),
            ...(reason ? { reasonNote: reason.note } : {}),
            canLinkClient: true,
        });
    }
    for (const tx of input.crypto) {
        if (!isUnlinkedCryptoMovement(tx))
            continue;
        const reason = reasonByKey.get(movementReasonDocId('crypto', tx.id));
        place({
            key: movementReasonDocId('crypto', tx.id),
            kind: 'crypto',
            id: tx.id,
            wallet: tx.currency,
            direction: tx.type === 'Ajout Manuel' ? 'in' : 'out',
            amount: Math.abs(Number(tx.quantity || 0)),
            currency: tx.currency,
            timestamp: tx.timestamp,
            date: tx.date,
            time: tx.time,
            note: String(tx.notes ?? ''),
            ...(reason ? { reasonNote: reason.note } : {}),
            canLinkClient: false,
        });
    }
    review.unexplained.sort(newestFirst);
    review.explained.sort(newestFirst);
    return review;
}
