import type { DigitalServiceTransaction, ManualAssetTransaction } from '../types';

/**
 * Profit of the other businesses (services such as design or printing, and digital services),
 * kept apart from the profit of selling USDT and EUR.
 *
 * Nothing is computed here that the Home page did not already add into « mon profit réel »:
 * the same two sums, with the same filters, only returned one by one instead of added into the
 * owner's trading profit. The dashboard adds them back in the same order, so its old figures
 * stay exact to the last digit.
 */
export type ServiceProfitParts = {
    /** Services billed by hand (type `service` or `invoice`), the full amount of each line */
    manual: number;
    /** Margin of the digital services sold (can be a loss) */
    digital: number;
};

export type ServiceProfitPeriodKey = 'today' | 'week' | 'month' | 'year' | 'allTime';

export type ServiceProfitOverview = Record<ServiceProfitPeriodKey, ServiceProfitParts>;

export type ServiceProfitPeriodStarts = {
    nowTs: number;
    dayStartTs: number;
    weekStartTs: number;
    monthStartTs: number;
    yearStartTs: number;
};

/**
 * The Home page figures that used to be one number: the owner's profit of the USDT and EUR sales alone,
 * and the profit of the other businesses. Their sum is the old « mon profit réel » of the dashboard.
 */
export type OwnerProfitSplit = {
    trading: { today: number; week: number; month: number; year: number };
    services: ServiceProfitOverview;
};

const ZERO_PARTS: ServiceProfitParts = { manual: 0, digital: 0 };
const TRADING_KEYS = ['today', 'week', 'month', 'year'] as const;
const SERVICE_KEYS: ReadonlyArray<ServiceProfitPeriodKey> = ['today', 'week', 'month', 'year', 'allTime'];

/** True when the other businesses have never earned or lost anything. */
export function hasNoServiceActivity(overview: ServiceProfitOverview | undefined | null): boolean {
    return !overview || (overview.allTime.manual === 0 && overview.allTime.digital === 0);
}

export function emptyServiceProfitOverview(): ServiceProfitOverview {
    return {
        today: { ...ZERO_PARTS },
        week: { ...ZERO_PARTS },
        month: { ...ZERO_PARTS },
        year: { ...ZERO_PARTS },
        allTime: { ...ZERO_PARTS },
    };
}

/** What is added to a period: the manual and the digital part, in the order the dashboard adds them. */
export function serviceProfitTotal(parts: ServiceProfitParts): number {
    return parts.manual + parts.digital;
}

function manualProfitSince(manualAssetTransactions: ReadonlyArray<ManualAssetTransaction>, periodStartTs: number | null, nowTs: number): number {
    return manualAssetTransactions.reduce((sum, tx) => {
        if (tx.timestamp > nowTs || (periodStartTs !== null && tx.timestamp < periodStartTs))
            return sum;
        if (tx.type !== 'service' && tx.type !== 'invoice')
            return sum;
        const amount = Math.abs(Number(tx.amount || 0));
        return Number.isFinite(amount) ? sum + amount : sum;
    }, 0);
}

function digitalProfitSince(digitalServiceTransactions: ReadonlyArray<DigitalServiceTransaction>, periodStartTs: number | null, nowTs: number): number {
    return digitalServiceTransactions.reduce((sum, tx) => {
        if (tx.timestamp > nowTs || (periodStartTs !== null && tx.timestamp < periodStartTs))
            return sum;
        const amount = Number(tx.profitDzd || 0);
        return Number.isFinite(amount) ? sum + amount : sum;
    }, 0);
}

export function buildServiceProfitOverview(input: {
    manualAssetTransactions: ReadonlyArray<ManualAssetTransaction>;
    digitalServiceTransactions: ReadonlyArray<DigitalServiceTransaction>;
} & ServiceProfitPeriodStarts): ServiceProfitOverview {
    const { manualAssetTransactions, digitalServiceTransactions, nowTs } = input;
    const parts = (periodStartTs: number | null): ServiceProfitParts => ({
        manual: manualProfitSince(manualAssetTransactions, periodStartTs, nowTs),
        digital: digitalProfitSince(digitalServiceTransactions, periodStartTs, nowTs),
    });
    return {
        today: parts(input.dayStartTs),
        week: parts(input.weekStartTs),
        month: parts(input.monthStartTs),
        year: parts(input.yearStartTs),
        allTime: parts(null),
    };
}

/** Same figures in both (what decides whether the Home page has to be drawn again). */
export function areOwnerProfitSplitsEqual(prev: OwnerProfitSplit | null | undefined, next: OwnerProfitSplit | null | undefined): boolean {
    if (prev === next)
        return true;
    if (!prev || !next)
        return !prev && !next;
    return TRADING_KEYS.every((key) => prev.trading[key] === next.trading[key])
        && SERVICE_KEYS.every((key) => prev.services[key].manual === next.services[key].manual
            && prev.services[key].digital === next.services[key].digital);
}
