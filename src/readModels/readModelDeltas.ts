import type {
    ClientsReadModel,
    DashboardReadModelSet,
    DashboardRecentOperationRef,
    FinancialReadModel,
    InvestorsReadModel,
    PortfolioReadModel,
    ReadModelName,
    ServicesReadModel,
    TreasuryReadModel,
} from './dashboardReadModels';
import { stableReadModelPayloadHash } from './initialSnapshotWriter';
import { roundM } from '../utils/money';
import { computePamLedger } from '../utils/pamLedger';
import type { Tx } from '../types';

export type ReadModelCurrency = 'USDT' | 'EUR';
export type ReadModelWallet = 'Caisse' | 'BaridiMob';
export type ReadModelAppliedOpsPath = 'read_model_applied_ops';

export const READ_MODEL_APPLIED_OPS_PATH: ReadModelAppliedOpsPath = 'read_model_applied_ops';

export type CurrencyInventoryDelta = {
    quantityDelta: number;
    costBasisDeltaDzd: number;
    realizedProfitDeltaDzd?: number;
    soldQuantityDelta?: number;
};

export type ClientPositionDelta = {
    clientCountDelta?: number;
    receivablesDelta: number;
    advancesDelta: number;
    activeClientsTodayDelta?: number;
};

export type InvestorPositionDelta = {
    investorCountDelta?: number;
    externalInvestorCapitalDelta?: number;
    externalInvestorProfitsDelta?: number;
    investorLiabilityDelta?: number;
    managerTradingOwnerProfitDelta?: number;
    managerServiceProfitDelta?: number;
    managerPersonalExpensesDelta?: number;
    managerActualOwnerCapitalDelta?: number;
    globalNetProfitDelta?: number;
};

export type ServicePositionDelta = {
    servicesCountDelta?: number;
    clientsCountDelta?: number;
    amountToReceiveDelta?: number;
    clientAdvancesDelta?: number;
    cashReceivedDelta?: number;
    manualServiceRevenueDelta?: number;
    digitalServiceProfitDelta?: number;
    serviceRevenueDelta?: number;
    netCapitalImpactDelta?: number;
};

export type ReadModelDelta = {
    operationId: string;
    payloadHash: string;
    effectiveAt: number;
    affectedSummaries: ReadModelName[];
    wallets?: Partial<Record<ReadModelWallet, number>>;
    treasuryCardsDelta?: number;
    managerPendingAdvancesDelta?: number;
    deliveryExpensesDelta?: number;
    portfolio?: Partial<Record<ReadModelCurrency, CurrencyInventoryDelta>>;
    clients?: ClientPositionDelta;
    investors?: InvestorPositionDelta;
    services?: ServicePositionDelta;
    dashboardDaily?: {
        todayProfitDelta?: number;
        weekToDateProfitDelta?: number;
        monthToDateProfitDelta?: number;
        yearToDateProfitDelta?: number;
        allTimeProfitDelta?: number;
        todaySellCountDelta?: number;
        todayUsdtSoldDelta?: number;
        todayEurSoldDelta?: number;
        monthToDateUsdtSoldDelta?: number;
        monthToDateEurSoldDelta?: number;
        yearToDateUsdtSoldDelta?: number;
        yearToDateEurSoldDelta?: number;
        allTimeUsdtSoldDelta?: number;
        allTimeEurSoldDelta?: number;
        ownerProfitTodayDelta?: number;
        ownerProfitWeekDelta?: number;
        ownerProfitMonthDelta?: number;
        ownerProfitYearDelta?: number;
        ownerProfitAllTimeDelta?: number;
    };
    recentOperation?: DashboardRecentOperationRef | null;
};

export type ReadModelDeltaBuildInput = Omit<ReadModelDelta, 'payloadHash'> & {
    payload: unknown;
};

function money(value: number): number {
    return roundM(value);
}

function add(value: number, delta = 0): number {
    return money(Number(value || 0) + Number(delta || 0));
}

function addInteger(value: number, delta = 0): number {
    return Math.max(0, Math.trunc(Number(value || 0) + Number(delta || 0)));
}

function uniqueReadModelNames(names: readonly ReadModelName[]): ReadModelName[] {
    return Array.from(new Set(names));
}

function withRevision<T extends { revision: number }>(summary: T): T {
    return { ...summary, revision: summary.revision + 1 };
}

function isAffected(delta: ReadModelDelta, name: ReadModelName): boolean {
    return delta.affectedSummaries.includes(name);
}

export function buildReadModelDelta(input: ReadModelDeltaBuildInput): ReadModelDelta {
    const { payload, affectedSummaries, ...rest } = input;
    return {
        ...rest,
        affectedSummaries: uniqueReadModelNames(affectedSummaries),
        payloadHash: stableReadModelPayloadHash(payload),
    };
}

export function derivePortfolioSellReadModelEconomics(input: {
    transactions: readonly Tx[];
    sellTx: Tx;
    fallbackProfitDzd: number;
    fallbackCostBasisDzd: number;
    nowMs?: number;
}): { realizedProfitDzd: number; soldCostDzd: number } {
    const ledger = computePamLedger([...input.transactions, input.sellTx], {
        nowMs: input.nowMs ?? input.sellTx.timestamp,
    });
    const row = ledger.profitByTxId[input.sellTx.id];
    return {
        realizedProfitDzd: roundM(row?.derivedProfit ?? input.fallbackProfitDzd),
        soldCostDzd: roundM(row?.soldCostDzd ?? input.fallbackCostBasisDzd),
    };
}

export function transitionClientBalanceDelta(beforeBalance: number, afterBalance: number): ClientPositionDelta {
    const beforeReceivable = beforeBalance < -0.005 ? Math.abs(beforeBalance) : 0;
    const beforeAdvance = beforeBalance > 0.005 ? beforeBalance : 0;
    const afterReceivable = afterBalance < -0.005 ? Math.abs(afterBalance) : 0;
    const afterAdvance = afterBalance > 0.005 ? afterBalance : 0;
    return {
        receivablesDelta: money(afterReceivable - beforeReceivable),
        advancesDelta: money(afterAdvance - beforeAdvance),
    };
}

export function combineClientPositionDeltas(deltas: readonly ClientPositionDelta[]): ClientPositionDelta {
    const combined = deltas.reduce<ClientPositionDelta>((acc, delta) => ({
        receivablesDelta: add(acc.receivablesDelta, delta.receivablesDelta),
        advancesDelta: add(acc.advancesDelta, delta.advancesDelta),
        clientCountDelta: addInteger(acc.clientCountDelta || 0, delta.clientCountDelta || 0),
        activeClientsTodayDelta: addInteger(acc.activeClientsTodayDelta || 0, delta.activeClientsTodayDelta || 0),
    }), { clientCountDelta: 0, receivablesDelta: 0, advancesDelta: 0, activeClientsTodayDelta: 0 });
    return {
        receivablesDelta: combined.receivablesDelta,
        advancesDelta: combined.advancesDelta,
        activeClientsTodayDelta: combined.activeClientsTodayDelta || 0,
        ...(combined.clientCountDelta ? { clientCountDelta: combined.clientCountDelta } : {}),
    };
}

function applyTreasuryDelta(summary: TreasuryReadModel, delta: ReadModelDelta): TreasuryReadModel {
    if (!isAffected(delta, 'treasury_summary'))
        return summary;
    const wallets = delta.wallets || {};
    const caisseBalance = add(summary.caisseBalance, wallets.Caisse || 0);
    const baridiBalance = add(summary.baridiBalance, wallets.BaridiMob || 0);
    return {
        ...withRevision(summary),
        caisseBalance,
        baridiBalance,
        cashTotal: money(caisseBalance + baridiBalance),
        treasuryCardsTotal: add(summary.treasuryCardsTotal, delta.treasuryCardsDelta || 0),
        managerPendingAdvances: add(summary.managerPendingAdvances, delta.managerPendingAdvancesDelta || 0),
        deliveryExpensesTotal: add(summary.deliveryExpensesTotal, delta.deliveryExpensesDelta || 0),
    };
}

function applyPortfolioCurrencyDelta(summary: PortfolioReadModel, currency: ReadModelCurrency, delta: CurrencyInventoryDelta): PortfolioReadModel {
    const key = currency.toLowerCase() as 'usdt' | 'eur';
    const current = summary.positions[key];
    const available = add(current.available, delta.quantityDelta);
    const costBasis = add(current.costBasis, delta.costBasisDeltaDzd);
    const totalQty = money(available + Number(current.locked || 0));
    const avgBuy = totalQty > 0.005 ? money(costBasis / totalQty) : 0;
    const realizedProfit = money(delta.realizedProfitDeltaDzd || 0);
    const positions = {
        ...summary.positions,
        [key]: {
            ...current,
            available,
            costBasis: Math.abs(costBasis) < 0.005 ? 0 : costBasis,
            avgBuy,
            totalProfit: add(current.totalProfit, realizedProfit),
        },
    };
    const soldKey = currency;
    const soldQuantity = {
        ...summary.soldQuantity,
        [soldKey]: {
            ...summary.soldQuantity[soldKey],
            today: add(summary.soldQuantity[soldKey].today, delta.soldQuantityDelta || 0),
            month: add(summary.soldQuantity[soldKey].month, delta.soldQuantityDelta || 0),
            year: add(summary.soldQuantity[soldKey].year, delta.soldQuantityDelta || 0),
            allTime: add(summary.soldQuantity[soldKey].allTime, delta.soldQuantityDelta || 0),
        },
    };
    return {
        ...summary,
        positions,
        costValueDzd: money(
            (positions.usdt.available + positions.usdt.locked) * positions.usdt.avgBuy
            + (positions.eur.available + positions.eur.locked) * positions.eur.avgBuy
        ),
        tradingProfit: {
            today: add(summary.tradingProfit.today, realizedProfit),
            week: add(summary.tradingProfit.week, realizedProfit),
            month: add(summary.tradingProfit.month, realizedProfit),
            year: add(summary.tradingProfit.year, realizedProfit),
            allTime: add(summary.tradingProfit.allTime, realizedProfit),
        },
        soldQuantity,
        sellCountToday: addInteger(summary.sellCountToday, delta.soldQuantityDelta ? 1 : 0),
    };
}

function applyPortfolioDelta(summary: PortfolioReadModel, delta: ReadModelDelta): PortfolioReadModel {
    if (!isAffected(delta, 'portfolio_summary'))
        return summary;
    let next = withRevision(summary);
    const deltas = delta.portfolio || {};
    (['USDT', 'EUR'] as const).forEach((currency) => {
        const currencyDelta = deltas[currency];
        if (currencyDelta)
            next = applyPortfolioCurrencyDelta(next, currency, currencyDelta);
    });
    return next;
}

function applyClientsDelta(summary: ClientsReadModel, delta: ReadModelDelta): ClientsReadModel {
    if (!isAffected(delta, 'clients_summary'))
        return summary;
    const clientDelta = delta.clients || { receivablesDelta: 0, advancesDelta: 0 };
    return {
        ...withRevision(summary),
        clientCount: addInteger(summary.clientCount, clientDelta.clientCountDelta || 0),
        totalReceivables: add(summary.totalReceivables, clientDelta.receivablesDelta),
        totalAdvances: add(summary.totalAdvances, clientDelta.advancesDelta),
        netClientPosition: add(summary.netClientPosition, (clientDelta.receivablesDelta || 0) - (clientDelta.advancesDelta || 0)),
        activeClientsToday: addInteger(summary.activeClientsToday, clientDelta.activeClientsTodayDelta || 0),
        transactionCount: addInteger(summary.transactionCount, 1),
    };
}

function applyInvestorsDelta(summary: InvestorsReadModel, delta: ReadModelDelta): InvestorsReadModel {
    if (!isAffected(delta, 'investors_summary'))
        return summary;
    const investorDelta = delta.investors || {};
    const externalInvestorCapital = add(summary.externalInvestorCapital, investorDelta.externalInvestorCapitalDelta || 0);
    const externalInvestorProfits = add(summary.externalInvestorProfits, investorDelta.externalInvestorProfitsDelta || 0);
    const investorLiability = add(summary.investorLiability, investorDelta.investorLiabilityDelta ?? ((investorDelta.externalInvestorCapitalDelta || 0) + (investorDelta.externalInvestorProfitsDelta || 0)));
    const previousManager = summary.managerProfitBreakdown;
    const tradingOwnerProfit = add(previousManager.tradingOwnerProfit, investorDelta.managerTradingOwnerProfitDelta || 0);
    const serviceProfit = add(previousManager.serviceProfit, investorDelta.managerServiceProfitDelta || 0);
    const ownerTotalProfit = money(tradingOwnerProfit + serviceProfit);
    const personalExpenses = add(previousManager.personalExpenses, investorDelta.managerPersonalExpensesDelta || 0);
    const totalPersonalExpenses = add(previousManager.totalPersonalExpenses, investorDelta.managerPersonalExpensesDelta || 0);
    const personalExpensesChargedToProfit = money(Math.max(0, Math.min(totalPersonalExpenses, Math.max(0, ownerTotalProfit))));
    const personalExpensesChargedToCapital = money(Math.max(0, totalPersonalExpenses - personalExpensesChargedToProfit));
    const retainedProfit = money(ownerTotalProfit - personalExpensesChargedToProfit);
    const availableProfit = money(Math.max(0, retainedProfit));
    const actualOwnerCapital = add(previousManager.actualOwnerCapital, investorDelta.managerActualOwnerCapitalDelta || 0);
    const historicalOwnerCapital = money(
        previousManager.openingCapital
        + retainedProfit
        + Number(previousManager.capitalAdditions || 0)
        - Number(previousManager.capitalWithdrawals || 0)
        - personalExpensesChargedToCapital
    );
    return {
        ...withRevision(summary),
        investorCount: addInteger(summary.investorCount, investorDelta.investorCountDelta || 0),
        externalInvestorCapital,
        externalInvestorProfits,
        investorLiability,
        investorBreakdown: {
            capital: externalInvestorCapital,
            profits: externalInvestorProfits,
            total: money(externalInvestorCapital + externalInvestorProfits),
        },
        globalNetProfit: add(summary.globalNetProfit, investorDelta.globalNetProfitDelta || 0),
        managerProfitBreakdown: {
            ...previousManager,
            tradingOwnerProfit,
            serviceProfit,
            ownerTotalProfit,
            personalExpenses,
            totalPersonalExpenses,
            personalExpensesChargedToProfit,
            personalExpensesChargedToCapital,
            retainedProfit,
            reinvestedProfit: retainedProfit,
            availableProfit,
            displayAvailableProfit: availableProfit,
            profitDeficit: personalExpensesChargedToCapital,
            historicalOwnerCapital,
            actualOwnerCapital,
            balanceSheetOwnerCapital: actualOwnerCapital,
            ownerCapitalReconciliationDifference: money(actualOwnerCapital - historicalOwnerCapital),
        },
    };
}

function applyServicesDelta(summary: ServicesReadModel, delta: ReadModelDelta): ServicesReadModel {
    if (!isAffected(delta, 'services_summary'))
        return summary;
    const serviceDelta = delta.services || {};
    return {
        ...withRevision(summary),
        servicesCount: addInteger(summary.servicesCount, serviceDelta.servicesCountDelta || 0),
        clientsCount: addInteger(summary.clientsCount, serviceDelta.clientsCountDelta || 0),
        amountToReceive: add(summary.amountToReceive, serviceDelta.amountToReceiveDelta || 0),
        clientAdvances: add(summary.clientAdvances, serviceDelta.clientAdvancesDelta || 0),
        cashReceived: add(summary.cashReceived, serviceDelta.cashReceivedDelta || 0),
        manualServiceRevenue: add(summary.manualServiceRevenue, serviceDelta.manualServiceRevenueDelta || 0),
        digitalServiceProfit: add(summary.digitalServiceProfit, serviceDelta.digitalServiceProfitDelta || 0),
        serviceRevenue: add(summary.serviceRevenue, serviceDelta.serviceRevenueDelta || 0),
        netCapitalImpact: add(summary.netCapitalImpact, serviceDelta.netCapitalImpactDelta || 0),
    };
}

function applyFinancialDelta(summary: FinancialReadModel, delta: ReadModelDelta, next: {
    treasury: TreasuryReadModel;
    portfolio: PortfolioReadModel;
    clients: ClientsReadModel;
    investors: InvestorsReadModel;
    services: ServicesReadModel;
}): FinancialReadModel {
    if (!isAffected(delta, 'financial_summary'))
        return summary;
    const daily = delta.dashboardDaily || {};
    const capitalSnapshot = {
        ...summary.capitalSnapshot,
        caisseBalance: next.treasury.caisseBalance,
        baridiBalance: next.treasury.baridiBalance,
        cashTotal: next.treasury.cashTotal,
        stockValue: next.portfolio.costValueDzd,
        treasuryCardsTotal: next.treasury.treasuryCardsTotal,
        receivables: next.clients.totalReceivables,
        clientAdvances: next.clients.totalAdvances,
        netClientPosition: money(next.clients.totalReceivables - next.clients.totalAdvances),
        serviceReceivables: next.services.amountToReceive,
        serviceClientAdvances: next.services.clientAdvances,
        servicesCapitalImpact: next.services.netCapitalImpact,
        managerPendingAdvances: next.treasury.managerPendingAdvances,
        investorLiability: next.investors.investorLiability,
    };
    capitalSnapshot.totalCapital = money(
        capitalSnapshot.cashTotal
        + capitalSnapshot.stockValue
        + capitalSnapshot.treasuryCardsTotal
        + capitalSnapshot.netClientPosition
        + capitalSnapshot.servicesCapitalImpact
        + capitalSnapshot.managerPendingAdvances
    );
    capitalSnapshot.netOwnedCapital = money(capitalSnapshot.totalCapital - capitalSnapshot.investorLiability);
    return {
        ...withRevision(summary),
        capitalSnapshot,
        dailyOverview: {
            ...summary.dailyOverview,
            caisse: next.treasury.caisseBalance,
            baridi: next.treasury.baridiBalance,
            activeClients: next.clients.activeClientsToday,
            todayProfit: add(summary.dailyOverview.todayProfit, daily.todayProfitDelta || 0),
            todaySellCount: addInteger(summary.dailyOverview.todaySellCount, daily.todaySellCountDelta || 0),
            weekToDateProfit: add(summary.dailyOverview.weekToDateProfit, daily.weekToDateProfitDelta || 0),
            monthToDateProfit: add(summary.dailyOverview.monthToDateProfit, daily.monthToDateProfitDelta || 0),
            yearToDateProfit: add(summary.dailyOverview.yearToDateProfit, daily.yearToDateProfitDelta || 0),
            allTimeProfit: add(summary.dailyOverview.allTimeProfit, daily.allTimeProfitDelta || 0),
            todayUsdtSold: add(summary.dailyOverview.todayUsdtSold, daily.todayUsdtSoldDelta || 0),
            todayEurSold: add(summary.dailyOverview.todayEurSold, daily.todayEurSoldDelta || 0),
            monthToDateUsdtSold: add(summary.dailyOverview.monthToDateUsdtSold, daily.monthToDateUsdtSoldDelta || 0),
            monthToDateEurSold: add(summary.dailyOverview.monthToDateEurSold, daily.monthToDateEurSoldDelta || 0),
            yearToDateUsdtSold: add(summary.dailyOverview.yearToDateUsdtSold, daily.yearToDateUsdtSoldDelta || 0),
            yearToDateEurSold: add(summary.dailyOverview.yearToDateEurSold, daily.yearToDateEurSoldDelta || 0),
            allTimeUsdtSold: add(summary.dailyOverview.allTimeUsdtSold, daily.allTimeUsdtSoldDelta || 0),
            allTimeEurSold: add(summary.dailyOverview.allTimeEurSold, daily.allTimeEurSoldDelta || 0),
            ownerProfitToday: add(summary.dailyOverview.ownerProfitToday, daily.ownerProfitTodayDelta || 0),
            ownerProfitWeek: add(summary.dailyOverview.ownerProfitWeek, daily.ownerProfitWeekDelta || 0),
            ownerProfitMonth: add(summary.dailyOverview.ownerProfitMonth, daily.ownerProfitMonthDelta || 0),
            ownerProfitYear: add(summary.dailyOverview.ownerProfitYear, daily.ownerProfitYearDelta || 0),
            ownerProfitAllTime: add(summary.dailyOverview.ownerProfitAllTime, daily.ownerProfitAllTimeDelta || 0),
        },
        globalNetProfit: next.investors.globalNetProfit,
        financialAudit: {
            ...summary.financialAudit,
            tradingOwnerProfit: next.investors.managerProfitBreakdown.tradingOwnerProfit,
            serviceProfit: next.investors.managerProfitBreakdown.serviceProfit,
            historicalPersonalExpenses: next.investors.managerProfitBreakdown.personalExpenses,
            totalPersonalExpenses: next.investors.managerProfitBreakdown.totalPersonalExpenses,
            deliveryExpensesSinceStart: next.treasury.deliveryExpensesTotal,
            actualOwnerCapital: next.investors.managerProfitBreakdown.actualOwnerCapital || capitalSnapshot.netOwnedCapital,
        },
    };
}

function rebuildDashboardFromDomains(summary: DashboardReadModelSet['dashboard'], next: Omit<DashboardReadModelSet, 'mode' | 'meta' | 'dashboard'>, delta: ReadModelDelta): DashboardReadModelSet['dashboard'] {
    if (!isAffected(delta, 'dashboard_summary'))
        return summary;
    const recentItems = delta.recentOperation
        ? [delta.recentOperation, ...summary.recentOperations.items].slice(0, summary.recentOperations.maxItems)
        : summary.recentOperations.items;
    return {
        ...withRevision(summary),
        sourceSummaries: {
            treasury_summary: { generationId: next.treasury.meta.generationId, revision: next.treasury.revision },
            portfolio_summary: { generationId: next.portfolio.meta.generationId, revision: next.portfolio.revision },
            clients_summary: { generationId: next.clients.meta.generationId, revision: next.clients.revision },
            investors_summary: { generationId: next.investors.meta.generationId, revision: next.investors.revision },
            services_summary: { generationId: next.services.meta.generationId, revision: next.services.revision },
            financial_summary: { generationId: next.financial.meta.generationId, revision: next.financial.revision },
        },
        capitalSnapshot: next.financial.capitalSnapshot,
        dailyOverview: next.financial.dailyOverview,
        money: {
            caisseBalance: next.treasury.caisseBalance,
            baridiBalance: next.treasury.baridiBalance,
            liquidities: next.treasury.cashTotal,
            treasuryCardsTotal: next.treasury.treasuryCardsTotal,
            clientReceivables: next.clients.totalReceivables,
            clientAdvances: next.clients.totalAdvances,
            serviceReceivables: next.services.amountToReceive,
            serviceAdvances: next.services.clientAdvances,
            investorCapital: next.investors.externalInvestorCapital,
            investorProfits: next.investors.externalInvestorProfits,
            investorLiability: next.investors.investorLiability,
            netOwnedCapital: next.financial.capitalSnapshot.netOwnedCapital,
            totalCapital: next.financial.capitalSnapshot.totalCapital,
        },
        portfolio: {
            valuationBasis: next.portfolio.valuationBasis,
            marketValueDzd: next.portfolio.marketValueDzd,
            costValueDzd: next.portfolio.costValueDzd,
            usdt: next.portfolio.positions.usdt,
            eur: next.portfolio.positions.eur,
            tradingProfit: next.portfolio.tradingProfit,
            soldQuantity: next.portfolio.soldQuantity,
        },
        clients: {
            ...summary.clients,
            clientCount: next.clients.clientCount,
            activeClientsToday: next.clients.activeClientsToday,
        },
        investors: {
            investorCount: next.investors.investorCount,
            investorBreakdown: next.investors.investorBreakdown,
            managerProfitBreakdown: next.investors.managerProfitBreakdown,
        },
        services: {
            amountToReceive: next.services.amountToReceive,
            clientAdvances: next.services.clientAdvances,
            cashReceived: next.services.cashReceived,
            manualServiceRevenue: next.services.manualServiceRevenue,
            digitalServiceProfit: next.services.digitalServiceProfit,
            serviceRevenue: next.services.serviceRevenue,
            netCapitalImpact: next.services.netCapitalImpact,
            servicesCount: next.services.servicesCount,
            clientsCount: next.services.clientsCount,
        },
        financialAudit: next.financial.financialAudit,
        recentOperations: {
            ...summary.recentOperations,
            itemCount: recentItems.length,
            items: recentItems,
        },
    };
}

export function applyReadModelDelta(snapshot: DashboardReadModelSet, delta: ReadModelDelta): DashboardReadModelSet {
    const treasury = applyTreasuryDelta(snapshot.treasury, delta);
    const portfolio = applyPortfolioDelta(snapshot.portfolio, delta);
    const clients = applyClientsDelta(snapshot.clients, delta);
    const investors = applyInvestorsDelta(snapshot.investors, delta);
    const services = applyServicesDelta(snapshot.services, delta);
    const financial = applyFinancialDelta(snapshot.financial, delta, { treasury, portfolio, clients, investors, services });
    const dashboard = rebuildDashboardFromDomains(snapshot.dashboard, { treasury, portfolio, clients, investors, services, financial }, delta);
    return { ...snapshot, treasury, portfolio, clients, investors, services, financial, dashboard };
}
