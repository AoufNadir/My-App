import { fromCents, toCents } from './money';

/**
 * Inventory (الجرد): the owner counts what he really holds and the app shows the gap against
 * what its own books say. Pure functions only; nothing here writes a balance or touches a profit.
 */

export type InventoryAccount = 'caisse' | 'baridi' | 'usdt' | 'eur';

export const INVENTORY_ACCOUNTS: readonly InventoryAccount[] = ['caisse', 'baridi', 'usdt', 'eur'];

export type InventoryExpected = Record<InventoryAccount, number>;

/** A missing, empty or invalid entry means « not counted today »; it is never read as zero. */
export type InventoryCounted = Partial<Record<InventoryAccount, number | null | undefined>>;

/** counted below the books (money missing), above the books (surplus), or the same. */
export type InventoryGapStatus = 'match' | 'short' | 'over';

export type InventoryRow = {
    account: InventoryAccount;
    expected: number;
    counted: number;
    /** counted - expected: negative when the real amount is lower than the books say */
    gap: number;
    status: InventoryGapStatus;
};

/**
 * Cash is counted in whole dinars (the balance correction window only takes whole dinars), so less
 * than one dinar of difference is a match. USDT and EUR are counted to the cent; one cent is noise.
 */
export const INVENTORY_TOLERANCE_CENTS: Record<InventoryAccount, number> = {
    caisse: 99,
    baridi: 99,
    usdt: 1,
    eur: 1,
};

export const isDzdAccount = (account: InventoryAccount): boolean => account === 'caisse' || account === 'baridi';

const finite = (value: unknown): number => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
};

const normalizeZero = (value: number): number => (Object.is(value, -0) ? 0 : value);

/**
 * What the books say each account holds. USDT and EUR include the part still locked for 24 hours,
 * because it is physically in the wallet.
 */
export function inventoryExpected(input: {
    caisse: number;
    baridi: number;
    usdtAvailable: number;
    usdtLocked?: number;
    eurAvailable: number;
    eurLocked?: number;
}): InventoryExpected {
    const sum = (a: number, b: number) => normalizeZero(fromCents(toCents(finite(a)) + toCents(finite(b))));
    return {
        caisse: normalizeZero(fromCents(toCents(finite(input.caisse)))),
        baridi: normalizeZero(fromCents(toCents(finite(input.baridi)))),
        usdt: sum(input.usdtAvailable, input.usdtLocked ?? 0),
        eur: sum(input.eurAvailable, input.eurLocked ?? 0),
    };
}

/** Compares what was counted with the books, for the accounts that were counted only. */
export function compareInventory(expected: InventoryExpected, counted: InventoryCounted): InventoryRow[] {
    const rows: InventoryRow[] = [];
    for (const account of INVENTORY_ACCOUNTS) {
        const raw = counted[account];
        if (raw === null || raw === undefined || !Number.isFinite(raw))
            continue;
        const expectedCents = toCents(finite(expected[account]));
        const countedCents = toCents(raw);
        const gapCents = countedCents - expectedCents;
        const status: InventoryGapStatus = Math.abs(gapCents) <= INVENTORY_TOLERANCE_CENTS[account]
            ? 'match'
            : gapCents < 0 ? 'short' : 'over';
        rows.push({
            account,
            expected: fromCents(expectedCents),
            counted: fromCents(countedCents),
            gap: normalizeZero(fromCents(gapCents)),
            status,
        });
    }
    return rows;
}

/** One saved inventory. `rows` holds only the accounts counted that day. */
export type InventoryCheck = {
    id: string;
    timestamp: number;
    date: string;
    time: string;
    rows: Array<Pick<InventoryRow, 'account' | 'expected' | 'counted' | 'gap' | 'status'>>;
    note?: string;
};

/** The document saved for a check, or null when nothing was counted. */
export function buildInventoryCheckData(
    expected: InventoryExpected,
    counted: InventoryCounted,
    stamp: { date: string; time: string; timestamp: number },
    note?: string,
): Omit<InventoryCheck, 'id'> | null {
    const rows = compareInventory(expected, counted);
    if (rows.length === 0)
        return null;
    const trimmed = (note || '').trim();
    return {
        timestamp: stamp.timestamp,
        date: stamp.date,
        time: stamp.time,
        rows,
        ...(trimmed ? { note: trimmed } : {}),
    };
}

const STATUSES: readonly InventoryGapStatus[] = ['match', 'short', 'over'];

/**
 * Reads a saved document defensively: a row that does not make sense is dropped, a check with no
 * valid row (or no valid time) is ignored. The stored status is kept as written, not recomputed.
 */
export function parseInventoryCheck(id: string, data: unknown): InventoryCheck | null {
    if (!data || typeof data !== 'object')
        return null;
    const raw = data as Record<string, unknown>;
    const timestamp = Number(raw.timestamp);
    if (!Number.isFinite(timestamp) || timestamp <= 0 || !Array.isArray(raw.rows))
        return null;
    const rows: InventoryCheck['rows'] = [];
    for (const item of raw.rows) {
        const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
        const account = INVENTORY_ACCOUNTS.find((a) => a === row.account);
        const expected = Number(row.expected);
        const counted = Number(row.counted);
        const gap = Number(row.gap);
        const status = STATUSES.find((st) => st === row.status);
        if (!account || !status || ![expected, counted, gap].every(Number.isFinite))
            continue;
        if (rows.some((r) => r.account === account))
            continue;
        rows.push({ account, expected, counted, gap, status });
    }
    if (rows.length === 0)
        return null;
    const note = typeof raw.note === 'string' && raw.note.trim() ? raw.note.trim() : undefined;
    return {
        id,
        timestamp,
        date: typeof raw.date === 'string' ? raw.date : '',
        time: typeof raw.time === 'string' ? raw.time : '',
        rows,
        ...(note ? { note } : {}),
    };
}

/** True when every account counted that day matched the books. */
export const isCheckClean = (check: Pick<InventoryCheck, 'rows'>): boolean =>
    check.rows.length > 0 && check.rows.every((row) => row.status === 'match');

/** Newest first, whatever order the list arrived in. */
export const sortChecksNewestFirst = <T extends Pick<InventoryCheck, 'timestamp'>>(checks: readonly T[]): T[] =>
    [...checks].sort((a, b) => b.timestamp - a.timestamp);

/**
 * The most recent check at which this account was counted and matched the books: the day from which
 * a later gap on that account must have come. Null when it never matched.
 */
export function lastMatchingCheck(checks: readonly InventoryCheck[], account: InventoryAccount): InventoryCheck | null {
    for (const check of sortChecksNewestFirst(checks)) {
        const row = check.rows.find((r) => r.account === account);
        if (row && row.status === 'match')
            return check;
    }
    return null;
}

/** The most recent check whose every counted account matched. */
export function lastCleanCheck(checks: readonly InventoryCheck[]): InventoryCheck | null {
    return sortChecksNewestFirst(checks).find(isCheckClean) ?? null;
}

type CorrectionTreasuryTx = { type?: string; source?: string; amount?: number; origin?: string; timestamp?: number };
type CorrectionPortfolioTx = { type?: string; currency?: string; quantity?: number; origin?: string; timestamp?: number };

export type BalanceCorrection = { account: InventoryAccount; amount: number; timestamp: number };

/**
 * Every balance correction already made through the « edit balance » windows (they all carry
 * origin balance_edit), signed: positive added to the books, negative removed from them.
 */
export function listBalanceCorrections(
    treasuryTransactions: readonly CorrectionTreasuryTx[],
    portfolioTransactions: readonly CorrectionPortfolioTx[],
): BalanceCorrection[] {
    const corrections: BalanceCorrection[] = [];
    for (const tx of treasuryTransactions) {
        if (tx.origin !== 'balance_edit')
            continue;
        const account: InventoryAccount | null = tx.source === 'Caisse' ? 'caisse' : tx.source === 'BaridiMob' ? 'baridi' : null;
        const amount = finite(tx.amount);
        if (!account || amount <= 0)
            continue;
        const sign = tx.type === 'Ajout' || tx.type === 'Adjustment (+)' ? 1 : tx.type === 'Retrait' || tx.type === 'Adjustment (-)' ? -1 : 0;
        if (sign === 0)
            continue;
        corrections.push({ account, amount: sign * amount, timestamp: finite(tx.timestamp) });
    }
    for (const tx of portfolioTransactions) {
        if (tx.origin !== 'balance_edit')
            continue;
        const account: InventoryAccount | null = tx.currency === 'USDT' ? 'usdt' : tx.currency === 'EUR' ? 'eur' : null;
        const amount = finite(tx.quantity);
        if (!account || amount <= 0)
            continue;
        const sign = tx.type === 'Ajout Manuel' ? 1 : tx.type === 'Retrait Manuel' ? -1 : 0;
        if (sign === 0)
            continue;
        corrections.push({ account, amount: sign * amount, timestamp: finite(tx.timestamp) });
    }
    return corrections.sort((a, b) => b.timestamp - a.timestamp);
}

export type InventoryMonth = {
    /** yyyy-mm, local time */
    month: string;
    checks: InventoryCheck[];
    /** Net balance corrections of the month per account (zero when none) */
    corrections: InventoryExpected;
    correctionCount: number;
};

export const monthKeyOf = (timestamp: number): string => {
    const d = new Date(timestamp);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const emptyTotals = (): InventoryExpected => ({ caisse: 0, baridi: 0, usdt: 0, eur: 0 });

/**
 * The monthly list: for each month, the checks made and the gaps absorbed by balance corrections,
 * newest month first. Months with neither are left out.
 */
export function inventoryMonths(checks: readonly InventoryCheck[], corrections: readonly BalanceCorrection[]): InventoryMonth[] {
    const months = new Map<string, InventoryMonth>();
    const ensure = (month: string): InventoryMonth => {
        let entry = months.get(month);
        if (!entry) {
            entry = { month, checks: [], corrections: emptyTotals(), correctionCount: 0 };
            months.set(month, entry);
        }
        return entry;
    };
    for (const check of sortChecksNewestFirst(checks))
        ensure(monthKeyOf(check.timestamp)).checks.push(check);
    const cents: Record<string, Record<InventoryAccount, number>> = {};
    for (const correction of corrections) {
        const month = monthKeyOf(correction.timestamp);
        const entry = ensure(month);
        entry.correctionCount += 1;
        const bucket = cents[month] || (cents[month] = { caisse: 0, baridi: 0, usdt: 0, eur: 0 });
        bucket[correction.account] += toCents(correction.amount);
    }
    for (const [month, bucket] of Object.entries(cents)) {
        const entry = months.get(month)!;
        for (const account of INVENTORY_ACCOUNTS)
            entry.corrections[account] = normalizeZero(fromCents(bucket[account]));
    }
    return [...months.values()].sort((a, b) => (a.month < b.month ? 1 : a.month > b.month ? -1 : 0));
}

/**
 * What to type in the existing « edit balance » window to bring the books to what was counted:
 * the new balance in whole dinars for the cash boxes, a signed adjustment for USDT and EUR (so the
 * 24-hour locked part of the stock cannot skew the result).
 */
export function correctionEntryFor(row: Pick<InventoryRow, 'account' | 'counted' | 'gap'>): string {
    if (isDzdAccount(row.account))
        return String(Math.round(row.counted));
    const cents = toCents(row.gap);
    const abs = (Math.abs(cents) / 100).toFixed(2);
    return cents < 0 ? `-${abs}` : `+${abs}`;
}
