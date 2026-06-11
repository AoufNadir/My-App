import type { Investor, PortfolioStats, TreasuryCard } from '../types';

const EPSILON = 0.005;

const toFiniteNumber = (value: unknown): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const toAbsoluteAmount = (value: unknown): number => Math.abs(toFiniteNumber(value));

type PortfolioPosition = {
    available?: number;
    avgBuy?: number;
    locked?: number;
};

export type ServicesCapitalInput = {
    amountToReceive?: number;
    clientAdvances?: number;
    cashReceived?: number;
    serviceRevenue?: number;
    receivablesAlreadyIncluded?: boolean;
    advancesAlreadyIncluded?: boolean;
};

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
    portfolioValue?: number;
    portfolioStats?: Pick<PortfolioStats, 'usdt' | 'eur'>;
    totalDettes: number;
    totalAvances: number;
    treasuryCards?: ReadonlyArray<TreasuryCard>;
    investorLiability?: number;
    services?: ServicesCapitalInput;
    /** Sum of pending personal advances (manager has taken cash but not yet reconciled).
     *  Treated as a receivable so totalCapital stays neutral during the pending period. */
    managerPendingAdvances?: number;
};

export type CapitalSnapshot = {
    caisseBalance: number;
    baridiBalance: number;
    cashTotal: number;
    stockValue: number;
    treasuryCardsTotal: number;
    receivables: number;
    clientAdvances: number;
    netClientPosition: number;
    serviceReceivables: number;
    serviceClientAdvances: number;
    servicesCapitalImpact: number;
    managerPendingAdvances: number;
    totalCapital: number;
    investorLiability: number;
    netOwnedCapital: number;
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

export function calculateStockValue(portfolioStats?: Pick<PortfolioStats, 'usdt' | 'eur'>): number {
    const usdt = portfolioStats?.usdt as PortfolioPosition | undefined;
    const eur = portfolioStats?.eur as PortfolioPosition | undefined;
    const usdtTotal = toFiniteNumber(usdt?.available) + toFiniteNumber(usdt?.locked);
    const eurTotal = toFiniteNumber(eur?.available) + toFiniteNumber(eur?.locked);
    return (usdtTotal * toFiniteNumber(usdt?.avgBuy))
        + (eurTotal * toFiniteNumber(eur?.avgBuy));
}

export function calculateServicesCapitalImpact(services?: ServicesCapitalInput): {
    serviceReceivables: number;
    serviceClientAdvances: number;
    servicesCapitalImpact: number;
} {
    const serviceReceivables = services?.receivablesAlreadyIncluded
        ? 0
        : toAbsoluteAmount(services?.amountToReceive);
    const serviceClientAdvances = services?.advancesAlreadyIncluded
        ? 0
        : toAbsoluteAmount(services?.clientAdvances);
    return {
        serviceReceivables,
        serviceClientAdvances,
        servicesCapitalImpact: serviceReceivables - serviceClientAdvances
    };
}

export function computeCapitalSnapshot({ caisseBalance, baridiBalance, portfolioValue, portfolioStats, totalDettes, totalAvances, treasuryCards = [], investorLiability = 0, services, managerPendingAdvances = 0 }: CapitalSnapshotInput): CapitalSnapshot {
    const normalizedCaisse = toFiniteNumber(caisseBalance);
    const normalizedBaridi = toFiniteNumber(baridiBalance);
    const cashTotal = normalizedCaisse + normalizedBaridi;
    const stockValue = portfolioValue === undefined ? calculateStockValue(portfolioStats) : toFiniteNumber(portfolioValue);
    const treasuryCardsTotal = treasuryCards.reduce((sum, card) => sum + toFiniteNumber(card.value), 0);
    const receivables = toAbsoluteAmount(totalDettes);
    const clientAdvances = toAbsoluteAmount(totalAvances);
    const netClientPosition = receivables - clientAdvances;
    const {
        serviceReceivables,
        serviceClientAdvances,
        servicesCapitalImpact
    } = calculateServicesCapitalImpact(services);
    const pendingAdvances = Math.max(0, toFiniteNumber(managerPendingAdvances));
    const totalCapital = cashTotal
        + stockValue
        + treasuryCardsTotal
        + netClientPosition
        + servicesCapitalImpact
        + pendingAdvances;
    const investorDebt = Math.max(0, toFiniteNumber(investorLiability));
    const netOwnedCapital = totalCapital - investorDebt;
    const normalizeZero = (value: number) => Math.abs(value) < EPSILON ? 0 : value;
    return {
        caisseBalance: normalizedCaisse,
        baridiBalance: normalizedBaridi,
        cashTotal,
        stockValue: normalizeZero(stockValue),
        treasuryCardsTotal,
        receivables,
        clientAdvances,
        netClientPosition,
        serviceReceivables,
        serviceClientAdvances,
        servicesCapitalImpact,
        managerPendingAdvances: pendingAdvances,
        totalCapital,
        investorLiability: investorDebt,
        netOwnedCapital
    };
}
