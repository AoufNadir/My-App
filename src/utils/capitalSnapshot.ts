import type { Investor, TreasuryCard } from '../types';
/** Split of investor liability into capital and undistributed profits. */
export type InvestorBreakdown = {
    capital: number;   // sum of capitalInvested for non-managers
    profits: number;   // sum of availableProfit for non-managers
    total: number;     // capital + profits = investorLiability
};
/** Returns investorLiability split into capital and undistributed profits. */
export function calculateInvestorBreakdown(investors: ReadonlyArray<Investor>): InvestorBreakdown {
    return investors.reduce((acc, inv) => {
        if (inv.isManager) return acc;
        const capital = Number.isFinite(Number(inv.capitalInvested)) ? Math.max(0, Number(inv.capitalInvested || 0)) : 0;
        const profit  = Number.isFinite(Number(inv.availableProfit))  ? Math.max(0, Number(inv.availableProfit  || 0)) : 0;
        return { capital: acc.capital + capital, profits: acc.profits + profit, total: acc.total + capital + profit };
    }, { capital: 0, profits: 0, total: 0 });
}
type CapitalSnapshotInput = {
    caisseBalance: number;
    baridiBalance: number;
    portfolioValue: number;
    totalDettes: number;
    totalAvances: number;
    treasuryCards: TreasuryCard[];
    investorLiability?: number;
    servicesCapitalImpact?: number;
};
export function calculateInvestorLiability(investors: ReadonlyArray<Investor>): number {
    return investors.reduce((sum, investor) => {
        if (investor.isManager)
            return sum;
        const capitalInvested = Number(investor.capitalInvested || 0);
        const availableProfit = Number(investor.availableProfit || 0);
        const capitalDebt = Number.isFinite(capitalInvested) ? Math.max(0, capitalInvested) : 0;
        const profitDebt = Number.isFinite(availableProfit) ? Math.max(0, availableProfit) : 0;
        return sum + capitalDebt + profitDebt;
    }, 0);
}
export function computeCapitalSnapshot({ caisseBalance, baridiBalance, portfolioValue, totalDettes, totalAvances, treasuryCards, investorLiability = 0, servicesCapitalImpact = 0 }: CapitalSnapshotInput) {
    const cashTotal = (Number(caisseBalance) || 0) + (Number(baridiBalance) || 0);
    const treasuryCardsTotal = treasuryCards.reduce((sum, card) => sum + (Number(card.value) || 0), 0);
    const receivables = Math.abs(Number(totalDettes) || 0);
    const clientAdvances = Math.max(0, Number(totalAvances) || 0);
    const netClientPosition = receivables - clientAdvances;
    const servicesImpact = Number(servicesCapitalImpact) || 0;
    const totalCapital = cashTotal
        + (Number(portfolioValue) || 0)
        + treasuryCardsTotal
        + netClientPosition
        + servicesImpact;
    const investorDebt = Math.max(0, Number(investorLiability) || 0);
    const netOwnedCapital = totalCapital - investorDebt;
    return {
        cashTotal,
        treasuryCardsTotal,
        receivables,
        clientAdvances,
        netClientPosition,
        servicesCapitalImpact: servicesImpact,
        totalCapital,
        investorLiability: investorDebt,
        netOwnedCapital
    };
}
