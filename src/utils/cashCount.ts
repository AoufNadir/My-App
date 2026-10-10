/**
 * The count (« le comptage », الجرد, V5-2): what is really in the Caisse, on BaridiMob and in the
 * USDT and EUR wallets, against what the app expects. A count only reads the books: it is saved
 * with its date so a later mistake is looked for after the last count that agreed, and it never
 * changes a balance, a profit or an investor's share.
 */

export const CASH_COUNT_ACCOUNTS = ['caisse', 'baridi', 'usdt', 'eur'] as const;
export type CashCountAccount = typeof CASH_COUNT_ACCOUNTS[number];
export type CashCountValues = Record<CashCountAccount, number>;

/** DZD agree within a dinar, USDT and EUR within a cent. */
export const CASH_COUNT_TOLERANCE: CashCountValues = { caisse: 1, baridi: 1, usdt: 0.01, eur: 0.01 };
export const CASH_COUNT_UNIT: Record<CashCountAccount, 'DZD' | 'USDT' | 'EUR'> = { caisse: 'DZD', baridi: 'DZD', usdt: 'USDT', eur: 'EUR' };

export type CashCountLine = {
    account: CashCountAccount;
    expected: number;
    /** null: this account was not counted */
    counted: number | null;
    /** counted − expected: + more than the app expects, − missing; null when not counted */
    difference: number | null;
    agrees: boolean;
};

export type CashCount = {
    id: string;
    timestamp: number;
    expected: CashCountValues;
    counted: Partial<CashCountValues>;
    note?: string;
};

const round = (value: number, account: CashCountAccount) => {
    const factor = CASH_COUNT_UNIT[account] === 'DZD' ? 100 : 10000;
    return Math.round(value * factor) / factor;
};

export function compareCashCount(expected: CashCountValues, counted: Partial<Record<CashCountAccount, number | null>>): CashCountLine[] {
    return CASH_COUNT_ACCOUNTS.map((account) => {
        const value = counted[account];
        const has = typeof value === 'number' && Number.isFinite(value);
        const difference = has ? round((value as number) - expected[account], account) : null;
        return {
            account,
            expected: expected[account],
            counted: has ? (value as number) : null,
            difference,
            agrees: difference === null || Math.abs(difference) < CASH_COUNT_TOLERANCE[account],
        };
    });
}

/** At least one account counted, and every counted account agrees. */
export function cashCountAgrees(lines: ReadonlyArray<CashCountLine>): boolean {
    return lines.some((line) => line.counted !== null) && lines.every((line) => line.agrees);
}

/** What the app expects now: the Caisse and BaridiMob balances, and the USDT and EUR stock (available + locked). */
export function expectedCashCount(input: {
    caisse: number;
    baridi: number;
    usdt: { available: number; locked?: number };
    eur: { available: number; locked?: number };
}): CashCountValues {
    return {
        caisse: round(Number(input.caisse) || 0, 'caisse'),
        baridi: round(Number(input.baridi) || 0, 'baridi'),
        usdt: round((Number(input.usdt.available) || 0) + (Number(input.usdt.locked) || 0), 'usdt'),
        eur: round((Number(input.eur.available) || 0) + (Number(input.eur.locked) || 0), 'eur'),
    };
}

/** The saved count as Firestore stores it: only the accounts that were counted. */
export function cashCountRecord(timestamp: number, expected: CashCountValues, counted: Partial<Record<CashCountAccount, number | null>>, note: string) {
    const countedOnly: Partial<CashCountValues> = {};
    for (const account of CASH_COUNT_ACCOUNTS) {
        const value = counted[account];
        if (typeof value === 'number' && Number.isFinite(value))
            countedOnly[account] = value;
    }
    return { timestamp, expected, counted: countedOnly, ...(note.trim() ? { note: note.trim() } : {}) };
}

/** The last count where every counted account agreed: a mistake found later happened after it. */
export function lastAgreeingCount(counts: ReadonlyArray<CashCount>): CashCount | null {
    const ordered = [...counts].sort((a, b) => b.timestamp - a.timestamp);
    return ordered.find((count) => cashCountAgrees(compareCashCount(count.expected, count.counted))) ?? null;
}
