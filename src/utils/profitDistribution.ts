import type { Investor } from '../types';

export type ProfitDistributionInvestor = Pick<
    Investor,
    'id' | 'name' | 'isActive' | 'isManager' | 'availableProfit'
>;

export type ProfitDistributionRow<T extends ProfitDistributionInvestor = ProfitDistributionInvestor> = {
    inv: T;
    normalizedShare: number;
    amount: number;
    availableProfit: number;
    exceedsAvailable: boolean;
};

// Half a centime: below this, an amount is not above what is owed.
const CENT_TOLERANCE = 0.005;

const toPositiveAmount = (value: unknown): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

/** Whole DZD that can be paid out of `amount` without paying more than it. */
export const wholeDzdDown = (amount: number): number =>
    Math.max(0, Math.floor((Number.isFinite(amount) ? amount : 0) + CENT_TOLERANCE));

// Splits `total` in whole DZD in proportion to each balance. Rounding never goes up:
// the total is rounded down, and a leftover unit never lifts a row above its balance.
const distributeWholeUnits = (total: number, balances: ReadonlyArray<number>): number[] => {
    const totalUnits = wholeDzdDown(total);
    const balanceSum = balances.reduce((sum, balance) => sum + toPositiveAmount(balance), 0);

    if (totalUnits <= 0 || balanceSum <= 0) {
        return balances.map(() => 0);
    }

    const rawShares = balances.map((balance) => (totalUnits * toPositiveAmount(balance)) / balanceSum);
    const flooredShares = rawShares.map(Math.floor);
    let remainder = totalUnits - flooredShares.reduce((sum, share) => sum + share, 0);

    const order = rawShares
        .map((share, index) => ({ index, fraction: share - Math.floor(share) }))
        .sort((a, b) => b.fraction - a.fraction);

    for (let i = 0; i < order.length && remainder > 0; i += 1) {
        const index = order[i].index;
        if (flooredShares[index] + 1 > toPositiveAmount(balances[index]) + CENT_TOLERANCE)
            continue;
        flooredShares[index] += 1;
        remainder -= 1;
    }

    return flooredShares;
};

export function calculateWithdrawableProfit<T extends ProfitDistributionInvestor>(
    investors: ReadonlyArray<T>
): number {
    return investors.reduce((sum, investor) => {
        if (!investor.isActive || investor.isManager) {
            return sum;
        }

        return sum + toPositiveAmount(investor.availableProfit);
    }, 0);
}

export function buildProfitDistributionPlan<T extends ProfitDistributionInvestor>(
    investors: ReadonlyArray<T>,
    totalAmount: number
): ProfitDistributionRow<T>[] {
    const eligible = investors
        .filter((investor) => investor.isActive && !investor.isManager)
        .map((investor) => ({
            investor,
            availableProfit: toPositiveAmount(investor.availableProfit)
        }))
        .filter((row) => row.availableProfit > 0);

    const totalAvailableProfit = eligible.reduce((sum, row) => sum + row.availableProfit, 0);
    const amounts = distributeWholeUnits(totalAmount, eligible.map((row) => row.availableProfit));

    return eligible
        .map((row, index) => {
            const amount = amounts[index] || 0;

            return {
                inv: row.investor,
                normalizedShare: totalAvailableProfit > 0 ? row.availableProfit / totalAvailableProfit : 0,
                amount,
                availableProfit: row.availableProfit,
                exceedsAvailable: amount > row.availableProfit + CENT_TOLERANCE
            };
        })
        .filter((row) => row.amount > 0);
}
