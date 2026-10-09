import type { Investor, InvestorTransaction } from '../types';
import { formatDayLabel, toDateInputValue } from './dateInput';

// Every three months from the day an investor joined, the owner either reinvests that investor's
// profit or pays it out (decision of 2026-10-04). The reminder opens seven days before that day
// and stays until one of the operations below is recorded from the opening day on. Nothing is
// saved for it: the terms come again from the entry date and the history each time, and « remind
// me in 3 days » is kept on this device only. The manager and archived investors have no term.

export const TERM_MONTHS = 3;
export const TERM_NOTICE_DAYS = 7;
export const TERM_SNOOZE_DAYS = 3;
/** Operations that settle a term: the profit reinvested or paid out, or capital withdrawn. */
export const TERM_DECISION_TYPES: ReadonlyArray<InvestorTransaction['type']> = ['reinvest_profit', 'withdraw_profit', 'withdraw_capital'];
const TERM_SNOOZE_STORAGE_KEY = 'app_investor_term_snooze';
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

export type InvestorTermState = 'upcoming' | 'due' | 'overdue';
export type InvestorTermInvestor = Pick<Investor, 'id' | 'name' | 'entryDate' | 'capitalInvested' | 'availableProfit' | 'isActive' | 'isManager' | 'archived'> & {
    /** Whole-dinar profit the investor list shows; without it, the stored figure. */
    displayAvailableProfit?: number;
};
export type InvestorTerm = {
    investorId: string;
    investorName: string;
    /** The term day, local yyyy-mm-dd. « Remind me later » is kept under it. */
    termKey: string;
    /** Midnight, local time, of the term day. */
    termTs: number;
    /** Midnight of the day the reminder opens, seven days before. */
    noticeTs: number;
    /** 1 for the first three months, 2 for the next three… */
    cycle: number;
    /** Whole days from today to the term: 5 = in five days, 0 = today, -3 = three days ago. */
    daysLeft: number;
    state: InvestorTermState;
    /** The profit the investor list shows (whole dinars); below zero, a balance to settle. */
    availableProfit: number;
    /** Same rule as the investor page: reinvesting needs more than one cent of profit. */
    canReinvest: boolean;
};
type LocalDay = { year: number; month: number; day: number };

const startOfDay = (ts: number) => {
    const date = new Date(ts);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
};
const localDayOf = (ts: number): LocalDay => {
    const date = new Date(ts);
    return { year: date.getFullYear(), month: date.getMonth(), day: date.getDate() };
};
/** Whole days between two midnights, right across a daylight-saving change. */
const daysBetween = (fromDay: number, toDay: number) => Math.round((toDay - fromDay) / 86_400_000);

/**
 * The day the investor joined, local time, as the investor page shows it. Without a readable entry
 * date, the day of the first capital deposit; without either, no term.
 */
export function investorTermAnchor(investor: Pick<Investor, 'entryDate'>, transactions: ReadonlyArray<InvestorTransaction>): LocalDay | null {
    const entry = String(investor.entryDate || '').trim();
    const dateOnly = DATE_ONLY.exec(entry);
    if (dateOnly)
        return { year: Number(dateOnly[1]), month: Number(dateOnly[2]) - 1, day: Number(dateOnly[3]) };
    const entryTs = entry ? new Date(entry).getTime() : Number.NaN;
    if (Number.isFinite(entryTs))
        return localDayOf(entryTs);
    const firstDeposit = transactions
        .filter((tx) => tx.type === 'deposit_capital' && Number.isFinite(Number(tx.timestamp)))
        .reduce((first, tx) => Math.min(first, Number(tx.timestamp)), Number.POSITIVE_INFINITY);
    return Number.isFinite(firstDeposit) ? localDayOf(firstDeposit) : null;
}

/**
 * The term `cycle` × 3 months after the anchor. Each term counts from the anchor, not from the
 * previous term, so a 31st stays a 31st where the month has one: 31/08 → 30/11 → 28/02 → 31/05.
 */
export function investorTermDay(anchor: LocalDay, cycle: number): number {
    const monthIndex = anchor.month + cycle * TERM_MONTHS;
    const year = anchor.year + Math.floor(monthIndex / 12);
    const month = ((monthIndex % 12) + 12) % 12;
    const lastDay = new Date(year, month + 1, 0).getDate();
    return new Date(year, month, Math.min(anchor.day, lastDay)).getTime();
}

const noticeDayOf = (termTs: number) => {
    const date = new Date(termTs);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() - TERM_NOTICE_DAYS).getTime();
};

/** Active investors who are neither the manager nor archived, with capital or profit to decide on. */
export function hasInvestorTerms(investor: InvestorTermInvestor): boolean {
    if (investor.isManager || investor.archived || !investor.isActive)
        return false;
    return Number(investor.capitalInvested || 0) > 0.005 || Number(investor.availableProfit || 0) > 0.005;
}

/**
 * The investor's open term at `nowTs`: the latest term whose reminder has opened, unless a
 * reinvestment, a profit payout or a capital withdrawal was recorded from its opening day on.
 * `transactions` may hold other investors' operations: only this investor's are read.
 */
export function openInvestorTerm(investor: InvestorTermInvestor, transactions: ReadonlyArray<InvestorTransaction>, nowTs: number): InvestorTerm | null {
    if (!hasInvestorTerms(investor))
        return null;
    const own = transactions.filter((tx) => tx.investorId === investor.id);
    const anchor = investorTermAnchor(investor, own);
    if (!anchor)
        return null;
    const today = startOfDay(nowTs);
    let cycle = 0;
    let termTs = 0;
    // At most one term per three months: 400 cycles is a hundred years.
    for (let next = 1; next <= 400; next += 1) {
        const day = investorTermDay(anchor, next);
        if (noticeDayOf(day) > today)
            break;
        cycle = next;
        termTs = day;
    }
    if (cycle === 0)
        return null;
    const noticeTs = noticeDayOf(termTs);
    const settled = own.some((tx) => TERM_DECISION_TYPES.includes(tx.type) && Number(tx.timestamp) >= noticeTs);
    if (settled)
        return null;
    const daysLeft = daysBetween(today, termTs);
    const rawAvailable = Number(investor.availableProfit || 0);
    return {
        investorId: investor.id,
        investorName: investor.name,
        termKey: toDateInputValue(new Date(termTs)),
        termTs,
        noticeTs,
        cycle,
        daysLeft,
        state: daysLeft > 0 ? 'upcoming' : daysLeft === 0 ? 'due' : 'overdue',
        availableProfit: Number(investor.displayAvailableProfit ?? rawAvailable),
        canReinvest: rawAvailable > 0.01,
    };
}

/** Every open term, the most urgent first (the oldest overdue, then the nearest), then by name. */
export function openInvestorTerms(investors: ReadonlyArray<InvestorTermInvestor>, transactions: ReadonlyArray<InvestorTransaction>, nowTs: number): InvestorTerm[] {
    const byInvestor = new Map<string, InvestorTransaction[]>();
    for (const tx of transactions) {
        const list = byInvestor.get(tx.investorId);
        if (list)
            list.push(tx);
        else
            byInvestor.set(tx.investorId, [tx]);
    }
    return investors
        .map((investor) => openInvestorTerm(investor, byInvestor.get(investor.id) ?? [], nowTs))
        .filter((term): term is InvestorTerm => term !== null)
        .sort((a, b) => a.daysLeft - b.daysLeft || a.investorName.localeCompare(b.investorName));
}

// ---- How a term is worded ----

export type InvestorTermTiming = Pick<InvestorTerm, 'daysLeft' | 'state' | 'termTs'>;

/** Arabic words its days differently for 1, 2, 3 to 10, and 11 on (investorTerms.day*). */
export function investorTermDaysKey(count: number): string {
    if (count === 1)
        return 'investorTerms.dayOne';
    if (count === 2)
        return 'investorTerms.dayTwo';
    return count <= 10 ? 'investorTerms.dayFew' : 'investorTerms.dayMany';
}

/** « Le {date}, dans {days} », « Aujourd’hui, le {date} » or « Le {date}, il y a {days} ». */
export function investorTermWhenKey(term: Pick<InvestorTerm, 'state'>): string {
    return term.state === 'upcoming' ? 'investorTerms.dueIn' : term.state === 'due' ? 'investorTerms.dueToday' : 'investorTerms.overdue';
}

/** The same sentence as plain text, for the phone notification. */
export function investorTermWhenText(term: InvestorTermTiming, t: (key: string) => unknown): string {
    const count = Math.abs(term.daysLeft);
    const days = String(t(investorTermDaysKey(count))).split('{count}').join(String(count));
    return String(t(investorTermWhenKey(term)))
        .split('{date}').join(formatDayLabel(new Date(term.termTs)))
        .split('{days}').join(days);
}

// ---- « Remind me in 3 days », on this device only ----

export type InvestorTermSnoozes = Record<string, { term: string; until: number }>;
type SnoozeStorage = Pick<Storage, 'getItem' | 'setItem'>;
const browserStorage = (): SnoozeStorage | null => {
    try {
        return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
    }
    catch {
        return null;
    }
};

export function readTermSnoozes(storage: SnoozeStorage | null = browserStorage()): InvestorTermSnoozes {
    try {
        const parsed = JSON.parse(storage?.getItem(TERM_SNOOZE_STORAGE_KEY) || '{}');
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
            return {};
        const snoozes: InvestorTermSnoozes = {};
        for (const [investorId, value] of Object.entries(parsed as Record<string, unknown>)) {
            const entry = value as { term?: unknown; until?: unknown } | null;
            if (entry && typeof entry.term === 'string' && Number.isFinite(Number(entry.until)))
                snoozes[investorId] = { term: entry.term, until: Number(entry.until) };
        }
        return snoozes;
    }
    catch {
        return {};
    }
}

export function writeTermSnoozes(snoozes: InvestorTermSnoozes, storage: SnoozeStorage | null = browserStorage()) {
    try {
        storage?.setItem(TERM_SNOOZE_STORAGE_KEY, JSON.stringify(snoozes));
    }
    catch {
        // Storage unavailable (private browsing): the reminder comes back on the next visit.
    }
}

/** Hides this term's reminder until the start of the day three days from now. Past snoozes are dropped. */
export function snoozeInvestorTerm(snoozes: InvestorTermSnoozes, term: Pick<InvestorTerm, 'investorId' | 'termKey'>, nowTs: number): InvestorTermSnoozes {
    const today = new Date(startOfDay(nowTs));
    const until = new Date(today.getFullYear(), today.getMonth(), today.getDate() + TERM_SNOOZE_DAYS).getTime();
    const next: InvestorTermSnoozes = {};
    for (const [investorId, entry] of Object.entries(snoozes)) {
        if (entry.until > nowTs)
            next[investorId] = entry;
    }
    next[term.investorId] = { term: term.termKey, until };
    return next;
}

/** A snooze covers one term: when the next term opens, its reminder shows again. */
export function isInvestorTermSnoozed(term: Pick<InvestorTerm, 'investorId' | 'termKey'>, snoozes: InvestorTermSnoozes, nowTs: number): boolean {
    const entry = snoozes[term.investorId];
    return Boolean(entry && entry.term === term.termKey && nowTs < entry.until);
}
