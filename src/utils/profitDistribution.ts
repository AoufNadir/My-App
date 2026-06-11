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

const toPositiveAmount = (value: unknown): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

const distributeWholeUnits = (total: number, weights: ReadonlyArray<number>): number[] => {
    const totalUnits = Math.max(0, Math.round(Number.isFinite(total) ? total : 0));
    const weightSum = weights.reduce((sum, weight) => sum + toPositiveAmount(weight), 0);

    if (totalUnits <= 0 || weightSum <= 0) {
        return weights.map(() => 0);
    }

    const rawShares = weights.map((weight) => (totalUnits * toPositiveAmount(weight)) / weightSum);
    const flooredShares = rawShares.map(Math.floor);
    let remainder = totalUnits - flooredShares.reduce((sum, share) => sum + share, 0);

    const order = rawShares
        .map((share, index) => ({ index, fraction: share - Math.floor(share) }))
        .sort((a, b) => b.fraction - a.fraction);

    for (let i = 0; i < order.length && remainder > 0; i += 1) {
        flooredShares[order[i].index] += 1;
        remainder -= 1;
    }

    return flooredShares;
};

export function calculateWithdrawableProfit<T extends ProfitDistributionInvestor>(
    investors: ReadonlyArray<T>
): number {
    return investors.reduce((sum, investor) => {
        if (!investor.isActive) {
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
        .filter((investor) => investor.isActive)
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
                exceedsAvailable: amount > row.availableProfit + 0.005
            };
        })
        .filter((row) => row.amount > 0);
}
