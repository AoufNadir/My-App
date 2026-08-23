import type {
    ClientDzd,
    ClientTransactionDzd,
    DigitalServiceTransaction,
    Investor,
    InvestorTransaction,
    ManualAsset,
    ManualAssetClient,
    ManualAssetTransaction,
    OverdueDebtClient,
    PortfolioStats,
    TreasuryCard,
    TreasuryTx,
    Tx,
} from '../types';
import { deriveInvestorEconomics, getManagerProfitBreakdown, reconcileManagerProfitBreakdown, type ManagerFeeHistoryEntry } from '../hooks/useInvestorEconomics';
import { computePamLedger, type PamLedgerResult } from '../utils/pamLedger';
import { computeClientDebtState } from '../utils/clientDebt';
import {
    calculateInvestorBreakdown,
    calculateInvestorLiability,
    calculateServicesCapitalImpact,
    computeCapitalSnapshot,
    type CapitalSnapshot,
    type InvestorBreakdown,
} from '../utils/capitalSnapshot';
import { summarizePersonalExpenseTotals } from '../utils/financialAudit';
import { roundM } from '../utils/money';

export type ReadModelsMode = 'legacy' | 'shadow' | 'read';
export type ReadModelName =
    | 'dashboard_summary'
    | 'treasury_summary'
    | 'portfolio_summary'
    | 'clients_summary'
    | 'investors_summary'
    | 'services_summary'
    | 'financial_summary';

export type DomainReadModelName = Exclude<ReadModelName, 'dashboard_summary'>;

export type CanonicalFinancialValue =
    | 'cashBalances'
    | 'treasuryCardsTotal'
    | 'managerPendingAdvances'
    | 'deliveryExpensesTotal'
    | 'portfolioQuantities'
    | 'portfolioCostValue'
    | 'portfolioTradingProfit'
    | 'clientReceivables'
    | 'clientAdvances'
    | 'activeClientsToday'
    | 'investorCapital'
    | 'investorProfits'
    | 'managerProfitBreakdown'
    | 'serviceReceivables'
    | 'serviceAdvances'
    | 'serviceRevenue'
    | 'dashboardCapitalSnapshot'
    | 'dashboardDailyOverview'
    | 'dashboardMoneyMap'
    | 'dashboardPortfolioStatus'
    | 'dashboardRecentOperations'
    | 'capitalSnapshot'
    | 'dailyOverview';

export const READ_MODEL_SCHEMA_VERSION = 1;

export const READ_MODEL_CANONICAL_OWNERS: Record<CanonicalFinancialValue, ReadModelName> = {
    cashBalances: 'treasury_summary',
    treasuryCardsTotal: 'treasury_summary',
    managerPendingAdvances: 'treasury_summary',
    deliveryExpensesTotal: 'treasury_summary',
    portfolioQuantities: 'portfolio_summary',
    portfolioCostValue: 'portfolio_summary',
    portfolioTradingProfit: 'portfolio_summary',
    clientReceivables: 'clients_summary',
    clientAdvances: 'clients_summary',
    activeClientsToday: 'clients_summary',
    investorCapital: 'investors_summary',
    investorProfits: 'investors_summary',
    managerProfitBreakdown: 'investors_summary',
    serviceReceivables: 'services_summary',
    serviceAdvances: 'services_summary',
    serviceRevenue: 'services_summary',
    dashboardCapitalSnapshot: 'dashboard_summary',
    dashboardDailyOverview: 'dashboard_summary',
    dashboardMoneyMap: 'dashboard_summary',
    dashboardPortfolioStatus: 'dashboard_summary',
    dashboardRecentOperations: 'dashboard_summary',
    capitalSnapshot: 'dashboard_summary',
    dailyOverview: 'dashboard_summary',
};

export type ReadModelSnapshotMeta = {
    schemaVersion: typeof READ_MODEL_SCHEMA_VERSION;
    snapshotRevision: number;
    generationId: string;
    generatedAt: number;
    updatedAt: number;
    asOf: {
        timestamp: number;
        dateKey: string;
        dayStartTs: number;
        weekStartTs: number;
        monthStartTs: number;
        yearStartTs: number;
    };
};

export type PeriodBucket = {
    key: 'today' | 'week' | 'month' | 'year' | 'allTime' | 'last7Days';
    asOfDate: string;
    startTs: number | null;
    endTs: number;
};

export type TreasuryReadModel = {
    meta: ReadModelSnapshotMeta;
    revision: number;
    canonicalOwner: 'treasury_summary';
    caisseBalance: number;
    baridiBalance: number;
    cashTotal: number;
    treasuryCardsTotal: number;
    managerPendingAdvances: number;
    deliveryExpensesTotal: number;
};

export type PortfolioReadModel = {
    meta: ReadModelSnapshotMeta;
    revision: number;
    canonicalOwner: 'portfolio_summary';
    valuationBasis: 'cost_pam';
    marketValueDzd: null;
    costValueDzd: number;
    positions: PortfolioStats;
    tradingProfit: {
        today: number;
        week: number;
        month: number;
        year: number;
        allTime: number;
    };
    soldQuantity: {
        USDT: { today: number; month: number; year: number; allTime: number };
        EUR: { today: number; month: number; year: number; allTime: number };
    };
    sellCountToday: number;
    last7DaysProfit: number[];
    periodBuckets: PeriodBucket[];
};

export type ClientsReadModel = {
    meta: ReadModelSnapshotMeta;
    revision: number;
    canonicalOwner: 'clients_summary';
    clientCount: number;
    transactionCount: number;
    totalReceivables: number;
    totalAdvances: number;
    netClientPosition: number;
    activeClientsToday: number;
    topOverdueClients: OverdueDebtClient[];
};

export type InvestorsReadModel = {
    meta: ReadModelSnapshotMeta;
    revision: number;
    canonicalOwner: 'investors_summary';
    investorCount: number;
    externalInvestorCapital: number;
    externalInvestorProfits: number;
    investorLiability: number;
    investorBreakdown: InvestorBreakdown;
    globalNetProfit: number;
    managerProfitBreakdown: ReturnType<typeof getManagerProfitBreakdown>;
    reconciliationDifference: number;
};

export type ServicesReadModel = {
    meta: ReadModelSnapshotMeta;
    revision: number;
    canonicalOwner: 'services_summary';
    amountToReceive: number;
    clientAdvances: number;
    cashReceived: number;
    manualServiceRevenue: number;
    digitalServiceProfit: number;
    serviceRevenue: number;
    netCapitalImpact: number;
    servicesCount: number;
    clientsCount: number;
};

export type FinancialReadModel = {
    meta: ReadModelSnapshotMeta;
    revision: number;
    canonicalOwner: 'financial_summary';
    ownerRefs: typeof READ_MODEL_CANONICAL_OWNERS;
    capitalSnapshot: CapitalSnapshot;
    dailyOverview: DashboardDailyOverviewSummary;
    globalNetProfit: number;
    financialAudit: DashboardFinancialAuditSummary;
    reconciliationStatus: 'UNVERIFIED' | 'OK' | 'MISMATCH';
};

export type DashboardBoundedList<T> = {
    maxItems: number;
    itemCount: number;
    items: T[];
};

export type DashboardRecentOperationRef = {
    operationId: string;
    source: 'legacy' | 'v2';
    type: string;
    effectiveAt: number;
};

export type DashboardSummaryReadModel = {
    meta: ReadModelSnapshotMeta;
    revision: number;
    canonicalOwner: 'dashboard_summary';
    ownerRefs: typeof READ_MODEL_CANONICAL_OWNERS;
    sourceSummaries: Record<DomainReadModelName, { generationId: string; revision: number }>;
    capitalSnapshot: CapitalSnapshot;
    dailyOverview: DashboardDailyOverviewSummary;
    money: {
        caisseBalance: number;
        baridiBalance: number;
        liquidities: number;
        treasuryCardsTotal: number;
        clientReceivables: number;
        clientAdvances: number;
        serviceReceivables: number;
        serviceAdvances: number;
        investorCapital: number;
        investorProfits: number;
        investorLiability: number;
        netOwnedCapital: number;
        totalCapital: number;
    };
    portfolio: {
        valuationBasis: 'cost_pam';
        marketValueDzd: null;
        costValueDzd: number;
        usdt: PortfolioStats['usdt'];
        eur: PortfolioStats['eur'];
        tradingProfit: PortfolioReadModel['tradingProfit'];
        soldQuantity: PortfolioReadModel['soldQuantity'];
    };
    clients: {
        clientCount: number;
        activeClientsToday: number;
        topOverdueClients: DashboardBoundedList<OverdueDebtClient>;
    };
    investors: {
        investorCount: number;
        investorBreakdown: InvestorBreakdown;
        managerProfitBreakdown: ReturnType<typeof getManagerProfitBreakdown>;
    };
    services: Pick<ServicesReadModel,
        'amountToReceive'
        | 'clientAdvances'
        | 'cashReceived'
        | 'manualServiceRevenue'
        | 'digitalServiceProfit'
        | 'serviceRevenue'
        | 'netCapitalImpact'
        | 'servicesCount'
        | 'clientsCount'
    >;
    financialAudit: DashboardFinancialAuditSummary;
    recentOperations: DashboardBoundedList<DashboardRecentOperationRef>;
};

export type DashboardDailyOverviewSummary = {
    periodBuckets: PeriodBucket[];
    caisse: number;
    baridi: number;
    activeClients: number;
    todayProfit: number;
    todaySellCount: number;
    weekToDateProfit: number;
    monthToDateProfit: number;
    yearToDateProfit: number;
    allTimeProfit: number;
    todayUsdtSold: number;
    todayEurSold: number;
    monthToDateUsdtSold: number;
    monthToDateEurSold: number;
    yearToDateUsdtSold: number;
    yearToDateEurSold: number;
    allTimeUsdtSold: number;
    allTimeEurSold: number;
    ownerProfitToday: number;
    ownerProfitWeek: number;
    ownerProfitMonth: number;
    ownerProfitYear: number;
    ownerProfitAllTime: number;
    last7DaysProfit: number[];
};

export type DashboardFinancialAuditSummary = {
    openingCapital: number;
    tradingOwnerProfit: number;
    serviceProfit: number;
    historicalPersonalExpenses: number;
    currentPersonalExpenses: number;
    totalPersonalExpenses: number;
    deliveryExpensesSinceStart: number;
    actualOwnerCapital: number;
};

export type DashboardReadModelSet = {
    mode: 'shadow';
    meta: ReadModelSnapshotMeta;
    dashboard: DashboardSummaryReadModel;
    treasury: TreasuryReadModel;
    portfolio: PortfolioReadModel;
    clients: ClientsReadModel;
    investors: InvestorsReadModel;
    services: ServicesReadModel;
    financial: FinancialReadModel;
};

export type DashboardReadModelLegacyBaseline = {
    treasuryStats: { caisse: number; baridi: number };
    portfolioStats: PortfolioStats;
    totals: { totalDettes: number; totalAvances: number };
    investorBreakdown: InvestorBreakdown;
    investorLiability: number;
    capitalSnapshot: CapitalSnapshot;
    servicesSummary: ServicesReadModelComparable;
    dailyOverview: DashboardDailyOverviewComparable;
    globalNetProfit: number;
    managerProfitBreakdown: ReturnType<typeof getManagerProfitBreakdown>;
    financialAudit: DashboardFinancialAuditSummary;
};

export type ServicesReadModelComparable = Pick<ServicesReadModel,
    'amountToReceive'
    | 'clientAdvances'
    | 'cashReceived'
    | 'manualServiceRevenue'
    | 'digitalServiceProfit'
    | 'serviceRevenue'
    | 'netCapitalImpact'
    | 'servicesCount'
    | 'clientsCount'
>;

export type DashboardDailyOverviewComparable = Omit<DashboardDailyOverviewSummary, 'periodBuckets'>;

export type ReadModelReconciliationMismatch = {
    field: string;
    canonicalOwner: ReadModelName;
    legacy: number;
    shadow: number;
    difference: number;
};

export type DashboardReadModelReconciliation = {
    ok: boolean;
    toleranceDzd: number;
    generationId: string;
    snapshotRevision: number;
    mismatches: ReadModelReconciliationMismatch[];
};

export type DashboardReadModelShadowDiagnostic = {
    mode: 'shadow';
    readModels: DashboardReadModelSet;
    reconciliation: DashboardReadModelReconciliation;
};

declare global {
    interface Window {
        __PRO_DIGITAL_READ_MODELS_SHADOW__?: DashboardReadModelShadowDiagnostic;
    }
}

export type BuildDashboardReadModelsInput = {
    transactions: Tx[];
    clientsDzd: ClientDzd[];
    clientTransactionsDzd: ClientTransactionDzd[];
    treasuryTransactions: TreasuryTx[];
    treasuryCards: TreasuryCard[];
    manualAssets: ManualAsset[];
    manualAssetClients: ManualAssetClient[];
    manualAssetTransactions: ManualAssetTransaction[];
    digitalServiceTransactions: DigitalServiceTransaction[];
    investors: Investor[];
    investorTransactions: InvestorTransaction[];
    managerFeePercentage: string | number;
    managerFeeHistory: ManagerFeeHistoryEntry[];
    ownerOpeningCapital: number;
    preTrackingPersonalExpenses: number;
    getClientFullName: (client: ClientDzd) => string;
    asOf?: number;
    generationId?: string;
    snapshotRevision?: number;
    summaryRevisions?: Partial<Record<ReadModelName, number>>;
};

const ZERO_EPSILON = 0.005;
const DAY_MS = 86_400_000;
const DASHBOARD_TOP_OVERDUE_CLIENTS_LIMIT = 3;
const DASHBOARD_RECENT_OPERATIONS_LIMIT = 5;

function configuredReadModelsMode(): string | undefined {
    const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
    return env?.VITE_READ_MODELS_MODE;
}

export function getReadModelsMode(value = configuredReadModelsMode()): ReadModelsMode {
    if (value === 'legacy' || value === 'read' || value === 'shadow')
        return value;
    return 'shadow';
}

function finite(value: unknown, fallback = 0): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function money(value: number): number {
    return roundM(value);
}

function boundedList<T>(items: readonly T[], maxItems: number): DashboardBoundedList<T> {
    const safeLimit = Math.max(0, Math.trunc(maxItems));
    return {
        maxItems: safeLimit,
        itemCount: items.length,
        items: items.slice(0, safeLimit),
    };
}

function resolveSummaryRevision(revisions: BuildDashboardReadModelsInput['summaryRevisions'], name: ReadModelName): number {
    const parsed = finite(revisions?.[name], 1);
    return Math.max(1, Math.trunc(parsed));
}

function dateKey(timestamp: number): string {
    return new Date(timestamp).toISOString().slice(0, 10);
}

function startOfWeek(timestamp: number): number {
    const date = new Date(timestamp);
    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    date.setDate(date.getDate() + diff);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
}

function createSnapshotMeta(input: Pick<BuildDashboardReadModelsInput, 'asOf' | 'generationId' | 'snapshotRevision'>): ReadModelSnapshotMeta {
    const generatedAt = input.asOf || Date.now();
    const dayStart = new Date(generatedAt);
    dayStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(generatedAt);
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const yearStart = new Date(generatedAt);
    yearStart.setMonth(0, 1);
    yearStart.setHours(0, 0, 0, 0);
    const snapshotRevision = input.snapshotRevision ?? generatedAt;
    return {
        schemaVersion: READ_MODEL_SCHEMA_VERSION,
        snapshotRevision,
        generationId: input.generationId || `shadow:${snapshotRevision}`,
        generatedAt,
        updatedAt: generatedAt,
        asOf: {
            timestamp: generatedAt,
            dateKey: dateKey(generatedAt),
            dayStartTs: dayStart.getTime(),
            weekStartTs: startOfWeek(generatedAt),
            monthStartTs: monthStart.getTime(),
            yearStartTs: yearStart.getTime(),
        },
    };
}

function makePeriodBuckets(meta: ReadModelSnapshotMeta): PeriodBucket[] {
    return [
        { key: 'today', asOfDate: meta.asOf.dateKey, startTs: meta.asOf.dayStartTs, endTs: meta.asOf.timestamp },
        { key: 'week', asOfDate: meta.asOf.dateKey, startTs: meta.asOf.weekStartTs, endTs: meta.asOf.timestamp },
        { key: 'month', asOfDate: meta.asOf.dateKey, startTs: meta.asOf.monthStartTs, endTs: meta.asOf.timestamp },
        { key: 'year', asOfDate: meta.asOf.dateKey, startTs: meta.asOf.yearStartTs, endTs: meta.asOf.timestamp },
        { key: 'allTime', asOfDate: meta.asOf.dateKey, startTs: null, endTs: meta.asOf.timestamp },
        { key: 'last7Days', asOfDate: meta.asOf.dateKey, startTs: meta.asOf.dayStartTs - (6 * DAY_MS), endTs: meta.asOf.timestamp },
    ];
}

function resolveWallet(raw: unknown): 'Caisse' | 'BaridiMob' | null {
    if (!raw)
        return null;
    const normalized = String(raw).toLowerCase();
    if (normalized.includes('caisse'))
        return 'Caisse';
    if (normalized.includes('baridi'))
        return 'BaridiMob';
    return null;
}

function parseLegacyTransfer(rawAsset?: string): { from: 'Caisse' | 'BaridiMob' | null; to: 'Caisse' | 'BaridiMob' | null } {
    if (!rawAsset)
        return { from: null, to: null };
    const match = /from\s+(.+?)\s+to\s+(.+)/i.exec(rawAsset);
    if (!match)
        return { from: null, to: null };
    return { from: resolveWallet(match[1]), to: resolveWallet(match[2]) };
}

export function buildTreasuryStatsFromLegacy(treasuryTransactions: readonly TreasuryTx[]): { caisse: number; baridi: number } {
    let caisse = 0;
    let baridi = 0;
    treasuryTransactions.forEach((tx) => {
        const txData = tx as TreasuryTx & { asset?: string };
        const amount = Number(tx.amount || 0);
        if (!Number.isFinite(amount) || amount <= 0)
            return;
        if (tx.type === 'Transfer') {
            const legacy = parseLegacyTransfer(txData.asset);
            const from = resolveWallet(txData.source) || legacy.from;
            const to = resolveWallet(txData.destination) || legacy.to;
            if (!from || !to || from === to)
                return;
            if (from === 'Caisse')
                caisse -= amount;
            if (from === 'BaridiMob')
                baridi -= amount;
            if (to === 'Caisse')
                caisse += amount;
            if (to === 'BaridiMob')
                baridi += amount;
            return;
        }
        let factor = 0;
        if (tx.type === 'Ajout' || tx.type === 'Adjustment (+)')
            factor = 1;
        else if (tx.type === 'Retrait' || tx.type === 'Adjustment (-)')
            factor = -1;
        const source = resolveWallet(txData.source)
            || (txData.asset === 'DZD-Caisse' ? 'Caisse' : txData.asset === 'DZD-Baridi' ? 'BaridiMob' : null);
        if (source === 'Caisse')
            caisse += amount * factor;
        if (source === 'BaridiMob')
            baridi += amount * factor;
    });
    return {
        caisse: Math.abs(caisse) < ZERO_EPSILON ? 0 : money(caisse),
        baridi: Math.abs(baridi) < ZERO_EPSILON ? 0 : money(baridi),
    };
}

export function buildClientBalancesFromLegacy(clients: readonly ClientDzd[], transactions: readonly ClientTransactionDzd[]): Map<string, number> {
    const balances = new Map<string, number>();
    clients.forEach((client) => balances.set(client.id, 0));
    transactions.forEach((tx) => {
        if (tx.affectsBalance === false)
            return;
        balances.set(tx.clientId, money((balances.get(tx.clientId) || 0) + Number(tx.montant || 0)));
    });
    return balances;
}

function buildClientTotals(clientBalances: Map<string, number>): { totalDettes: number; totalAvances: number } {
    let totalDettes = 0;
    let totalAvances = 0;
    clientBalances.forEach((balance) => {
        if (balance < 0)
            totalDettes = money(totalDettes + balance);
        else if (balance > 0)
            totalAvances = money(totalAvances + balance);
    });
    return { totalDettes, totalAvances };
}

function buildAssetClientBalances(transactions: readonly ManualAssetTransaction[]): Map<string, number> {
    const balances = new Map<string, number>();
    transactions.forEach((tx) => {
        const key = `${tx.actifId}_${tx.clientId}`;
        balances.set(key, money((balances.get(key) || 0) + Number(tx.amount || 0)));
    });
    return balances;
}

function buildOverdueClients(input: {
    clients: readonly ClientDzd[];
    clientTransactions: readonly ClientTransactionDzd[];
    clientBalances: Map<string, number>;
    getClientFullName: (client: ClientDzd) => string;
    nowTs: number;
    minDays: number;
}): OverdueDebtClient[] {
    const txByClient = new Map<string, ClientTransactionDzd[]>();
    for (const tx of input.clientTransactions) {
        if (tx.affectsBalance === false)
            continue;
        const current = txByClient.get(tx.clientId) || [];
        current.push(tx);
        txByClient.set(tx.clientId, current);
    }
    const results: OverdueDebtClient[] = [];
    for (const client of input.clients) {
        const currentBalance = input.clientBalances.get(client.id) || 0;
        if (currentBalance >= -ZERO_EPSILON)
            continue;
        const clientTxs = txByClient.get(client.id) || [];
        if (clientTxs.length === 0)
            continue;
        const debtState = computeClientDebtState(clientTxs, input.nowTs, Math.max(0, input.minDays));
        const overdueLots = debtState.openLots.filter((lot) => input.nowTs > lot.dueTimestamp);
        if (overdueLots.length === 0)
            continue;
        const overdueAmount = money(overdueLots.reduce((sum, lot) => sum + lot.remaining, 0));
        if (overdueAmount <= ZERO_EPSILON)
            continue;
        const oldestUnpaidTimestamp = overdueLots.reduce((min, lot) => Math.min(min, lot.timestamp), overdueLots[0].timestamp);
        const oldestDueTimestamp = overdueLots.reduce((min, lot) => Math.min(min, lot.dueTimestamp), overdueLots[0].dueTimestamp);
        results.push({
            clientId: client.id,
            fullName: input.getClientFullName(client),
            phone: client.phone,
            overdueAmount,
            daysOverdue: Math.max(0, Math.floor((input.nowTs - oldestDueTimestamp) / DAY_MS)),
            oldestUnpaidTimestamp,
            oldestUnpaidDate: new Date(oldestUnpaidTimestamp).toLocaleDateString('fr-FR'),
            lastPaymentTimestamp: debtState.lastPaymentTimestamp,
            balance: currentBalance,
        });
    }
    return results.sort((a, b) => {
        if (b.overdueAmount !== a.overdueAmount)
            return b.overdueAmount - a.overdueAmount;
        if (b.daysOverdue !== a.daysOverdue)
            return b.daysOverdue - a.daysOverdue;
        return a.fullName.localeCompare(b.fullName);
    });
}

export function buildTreasuryReadModel(input: {
    meta: ReadModelSnapshotMeta;
    revision: number;
    treasuryTransactions: TreasuryTx[];
    treasuryCards: TreasuryCard[];
}): TreasuryReadModel {
    const treasuryStats = buildTreasuryStatsFromLegacy(input.treasuryTransactions);
    const treasuryCardsTotal = money(input.treasuryCards.reduce((sum, card) => sum + finite(card.value), 0));
    const managerPendingAdvances = money(input.treasuryTransactions
        .filter((tx) => tx.origin === 'personal_expense' && tx.advanceState === 'pending')
        .reduce((sum, tx) => sum + Math.max(0, finite(tx.amount)), 0));
    const deliveryExpensesTotal = money(input.treasuryTransactions
        .filter((tx) => tx.origin === 'delivery_expense' && tx.timestamp <= input.meta.asOf.timestamp)
        .reduce((sum, tx) => sum + Math.max(0, finite(tx.amountDzd ?? tx.amount)), 0));
    return {
        meta: input.meta,
        revision: input.revision,
        canonicalOwner: 'treasury_summary',
        caisseBalance: treasuryStats.caisse,
        baridiBalance: treasuryStats.baridi,
        cashTotal: money(treasuryStats.caisse + treasuryStats.baridi),
        treasuryCardsTotal,
        managerPendingAdvances,
        deliveryExpensesTotal,
    };
}

export function buildPortfolioReadModel(input: {
    meta: ReadModelSnapshotMeta;
    revision: number;
    pamLedger: PamLedgerResult;
}): PortfolioReadModel {
    const buckets = makePeriodBuckets(input.meta);
    const day7StartTs = input.meta.asOf.dayStartTs - (6 * DAY_MS);
    const last7DaysProfit = new Array(7).fill(0) as number[];
    const tradingProfit = { today: 0, week: 0, month: 0, year: 0, allTime: 0 };
    const soldQuantity = {
        USDT: { today: 0, month: 0, year: 0, allTime: 0 },
        EUR: { today: 0, month: 0, year: 0, allTime: 0 },
    };
    let sellCountToday = 0;
    input.pamLedger.sellProfitRows.forEach((row) => {
        if (row.timestamp > input.meta.asOf.timestamp)
            return;
        const profit = finite(row.derivedProfit);
        const quantity = finite(row.quantity);
        tradingProfit.allTime = money(tradingProfit.allTime + profit);
        soldQuantity[row.currency].allTime = money(soldQuantity[row.currency].allTime + quantity);
        if (row.timestamp >= input.meta.asOf.weekStartTs)
            tradingProfit.week = money(tradingProfit.week + profit);
        if (row.timestamp >= input.meta.asOf.dayStartTs) {
            tradingProfit.today = money(tradingProfit.today + profit);
            soldQuantity[row.currency].today = money(soldQuantity[row.currency].today + quantity);
            sellCountToday += 1;
        }
        if (row.timestamp >= input.meta.asOf.monthStartTs) {
            tradingProfit.month = money(tradingProfit.month + profit);
            soldQuantity[row.currency].month = money(soldQuantity[row.currency].month + quantity);
        }
        if (row.timestamp >= input.meta.asOf.yearStartTs) {
            tradingProfit.year = money(tradingProfit.year + profit);
            soldQuantity[row.currency].year = money(soldQuantity[row.currency].year + quantity);
        }
        if (row.timestamp >= day7StartTs) {
            const dayDiff = Math.floor((new Date(row.timestamp).getTime() - day7StartTs) / DAY_MS);
            if (dayDiff >= 0 && dayDiff < 7)
                last7DaysProfit[dayDiff] = money(last7DaysProfit[dayDiff] + profit);
        }
    });
    const stats = input.pamLedger.portfolioStats;
    const costValueDzd = money(
        (finite(stats.usdt.available) + finite(stats.usdt.locked)) * finite(stats.usdt.avgBuy)
        + (finite(stats.eur.available) + finite(stats.eur.locked)) * finite(stats.eur.avgBuy)
    );
    return {
        meta: input.meta,
        revision: input.revision,
        canonicalOwner: 'portfolio_summary',
        valuationBasis: 'cost_pam',
        marketValueDzd: null,
        costValueDzd,
        positions: stats,
        tradingProfit,
        soldQuantity,
        sellCountToday,
        last7DaysProfit,
        periodBuckets: buckets,
    };
}

export function buildClientsReadModel(input: {
    meta: ReadModelSnapshotMeta;
    revision: number;
    clients: ClientDzd[];
    clientTransactions: ClientTransactionDzd[];
    clientBalances: Map<string, number>;
    getClientFullName: (client: ClientDzd) => string;
}): ClientsReadModel {
    const totals = buildClientTotals(input.clientBalances);
    const activeClientIds = new Set<string>();
    input.clientTransactions.forEach((tx) => {
        if (tx.timestamp >= input.meta.asOf.dayStartTs && tx.timestamp <= input.meta.asOf.timestamp)
            activeClientIds.add(tx.clientId);
    });
    const topOverdueClients = buildOverdueClients({
        clients: input.clients,
        clientTransactions: input.clientTransactions,
        clientBalances: input.clientBalances,
        getClientFullName: input.getClientFullName,
        nowTs: input.meta.asOf.timestamp,
        minDays: -1,
    }).slice(0, 3);
    return {
        meta: input.meta,
        revision: input.revision,
        canonicalOwner: 'clients_summary',
        clientCount: input.clients.length,
        transactionCount: input.clientTransactions.length,
        totalReceivables: Math.abs(totals.totalDettes),
        totalAdvances: Math.abs(totals.totalAvances),
        netClientPosition: money(Math.abs(totals.totalDettes) - Math.abs(totals.totalAvances)),
        activeClientsToday: activeClientIds.size,
        topOverdueClients,
    };
}

export function buildServicesReadModel(input: {
    meta: ReadModelSnapshotMeta;
    revision: number;
    manualAssets: ManualAsset[];
    manualAssetClients: ManualAssetClient[];
    manualAssetTransactions: ManualAssetTransaction[];
    digitalServiceTransactions: DigitalServiceTransaction[];
    assetClientBalances: Map<string, number>;
}): ServicesReadModel {
    let amountToReceive = 0;
    let clientAdvances = 0;
    input.assetClientBalances.forEach((balance) => {
        if (balance < -ZERO_EPSILON)
            amountToReceive = money(amountToReceive + Math.abs(balance));
        else if (balance > ZERO_EPSILON)
            clientAdvances = money(clientAdvances + balance);
    });
    const cashReceived = money(input.manualAssetTransactions.reduce((sum, tx) => sum + (tx.type === 'payment_received' ? Math.abs(finite(tx.amount)) : 0), 0));
    const manualServiceRevenue = money(input.manualAssetTransactions.reduce((sum, tx) => sum + ((tx.type === 'service' || tx.type === 'invoice') ? Math.abs(finite(tx.amount)) : 0), 0));
    const digitalServiceProfit = money(input.digitalServiceTransactions.reduce((sum, tx) => sum + finite(tx.profitDzd), 0));
    const serviceRevenue = money(manualServiceRevenue + digitalServiceProfit);
    const { servicesCapitalImpact } = calculateServicesCapitalImpact({ amountToReceive, clientAdvances });
    return {
        meta: input.meta,
        revision: input.revision,
        canonicalOwner: 'services_summary',
        amountToReceive,
        clientAdvances,
        cashReceived,
        manualServiceRevenue,
        digitalServiceProfit,
        serviceRevenue,
        netCapitalImpact: money(servicesCapitalImpact),
        servicesCount: input.manualAssets.length,
        clientsCount: input.manualAssetClients.length,
    };
}

export function buildInvestorsReadModel(input: {
    meta: ReadModelSnapshotMeta;
    revision: number;
    investors: Investor[];
    investorTransactions: InvestorTransaction[];
    transactions: Tx[];
    treasuryTransactions: TreasuryTx[];
    deliveryExpenses: TreasuryTx[];
    personalExpenses: TreasuryTx[];
    managerFeePercentage: string | number;
    managerFeeHistory: ManagerFeeHistoryEntry[];
    pamLedger: PamLedgerResult;
    ownerOpeningCapital: number;
    actualOwnerCapital: number;
    serviceProfit: number;
    preTrackingPersonalExpenses: number;
}): InvestorsReadModel {
    const economics = deriveInvestorEconomics({
        investors: input.investors,
        investorTransactions: input.investorTransactions,
        transactions: input.transactions,
        managerFeePercentage: String(input.managerFeePercentage),
        managerFeeHistory: input.managerFeeHistory,
        pamLedger: input.pamLedger,
        deliveryExpenses: input.deliveryExpenses,
        treasuryTransactions: input.treasuryTransactions,
        personalExpenses: input.personalExpenses,
    });
    const derivedInvestors = economics.derivedInvestors;
    const investorBreakdown = calculateInvestorBreakdown(derivedInvestors);
    const investorLiability = calculateInvestorLiability(derivedInvestors);
    const baseManagerBreakdown = getManagerProfitBreakdown(economics, input.managerFeePercentage);
    const managerProfitBreakdown = reconcileManagerProfitBreakdown({
        breakdown: baseManagerBreakdown,
        openingCapital: input.ownerOpeningCapital,
        actualOwnerCapital: input.actualOwnerCapital,
        serviceProfit: input.serviceProfit,
        preTrackingPersonalExpenses: input.preTrackingPersonalExpenses,
    });
    return {
        meta: input.meta,
        revision: input.revision,
        canonicalOwner: 'investors_summary',
        investorCount: derivedInvestors.length,
        externalInvestorCapital: money(investorBreakdown.capital),
        externalInvestorProfits: money(investorBreakdown.profits),
        investorLiability: money(investorLiability),
        investorBreakdown,
        globalNetProfit: money(economics.totals.netDistributableProfit || input.pamLedger.totals.derivedProfit || 0),
        managerProfitBreakdown,
        reconciliationDifference: money(economics.totals.reconciliationDifference),
    };
}

export function buildDashboardSummaryReadModel(input: {
    meta: ReadModelSnapshotMeta;
    revision: number;
    treasury: TreasuryReadModel;
    portfolio: PortfolioReadModel;
    clients: ClientsReadModel;
    investors: InvestorsReadModel;
    services: ServicesReadModel;
    financial: FinancialReadModel;
}): DashboardSummaryReadModel {
    return {
        meta: input.meta,
        revision: input.revision,
        canonicalOwner: 'dashboard_summary',
        ownerRefs: READ_MODEL_CANONICAL_OWNERS,
        sourceSummaries: {
            treasury_summary: { generationId: input.treasury.meta.generationId, revision: input.treasury.revision },
            portfolio_summary: { generationId: input.portfolio.meta.generationId, revision: input.portfolio.revision },
            clients_summary: { generationId: input.clients.meta.generationId, revision: input.clients.revision },
            investors_summary: { generationId: input.investors.meta.generationId, revision: input.investors.revision },
            services_summary: { generationId: input.services.meta.generationId, revision: input.services.revision },
            financial_summary: { generationId: input.financial.meta.generationId, revision: input.financial.revision },
        },
        capitalSnapshot: input.financial.capitalSnapshot,
        dailyOverview: input.financial.dailyOverview,
        money: {
            caisseBalance: input.treasury.caisseBalance,
            baridiBalance: input.treasury.baridiBalance,
            liquidities: input.treasury.cashTotal,
            treasuryCardsTotal: input.treasury.treasuryCardsTotal,
            clientReceivables: input.clients.totalReceivables,
            clientAdvances: input.clients.totalAdvances,
            serviceReceivables: input.services.amountToReceive,
            serviceAdvances: input.services.clientAdvances,
            investorCapital: input.investors.externalInvestorCapital,
            investorProfits: input.investors.externalInvestorProfits,
            investorLiability: input.investors.investorLiability,
            netOwnedCapital: input.financial.capitalSnapshot.netOwnedCapital,
            totalCapital: input.financial.capitalSnapshot.totalCapital,
        },
        portfolio: {
            valuationBasis: input.portfolio.valuationBasis,
            marketValueDzd: input.portfolio.marketValueDzd,
            costValueDzd: input.portfolio.costValueDzd,
            usdt: input.portfolio.positions.usdt,
            eur: input.portfolio.positions.eur,
            tradingProfit: input.portfolio.tradingProfit,
            soldQuantity: input.portfolio.soldQuantity,
        },
        clients: {
            clientCount: input.clients.clientCount,
            activeClientsToday: input.clients.activeClientsToday,
            topOverdueClients: boundedList(input.clients.topOverdueClients, DASHBOARD_TOP_OVERDUE_CLIENTS_LIMIT),
        },
        investors: {
            investorCount: input.investors.investorCount,
            investorBreakdown: input.investors.investorBreakdown,
            managerProfitBreakdown: input.investors.managerProfitBreakdown,
        },
        services: {
            amountToReceive: input.services.amountToReceive,
            clientAdvances: input.services.clientAdvances,
            cashReceived: input.services.cashReceived,
            manualServiceRevenue: input.services.manualServiceRevenue,
            digitalServiceProfit: input.services.digitalServiceProfit,
            serviceRevenue: input.services.serviceRevenue,
            netCapitalImpact: input.services.netCapitalImpact,
            servicesCount: input.services.servicesCount,
            clientsCount: input.services.clientsCount,
        },
        financialAudit: input.financial.financialAudit,
        recentOperations: boundedList([], DASHBOARD_RECENT_OPERATIONS_LIMIT),
    };
}

function buildDailyOverview(input: {
    meta: ReadModelSnapshotMeta;
    treasury: TreasuryReadModel;
    portfolio: PortfolioReadModel;
    clients: ClientsReadModel;
    investors: Investor[];
    investorTransactions: InvestorTransaction[];
    transactions: Tx[];
    managerFeePercentage: string | number;
    managerFeeHistory: ManagerFeeHistoryEntry[];
    pamLedger: PamLedgerResult;
    deliveryExpenses: TreasuryTx[];
    treasuryTransactions: TreasuryTx[];
    manualAssetTransactions: ManualAssetTransaction[];
    digitalServiceTransactions: DigitalServiceTransaction[];
    baseOwnerProfitAllTime: number;
}): DashboardDailyOverviewSummary {
    const deriveOwnerTradingProfitForPeriod = (periodStartTs: number) => {
        const economics = deriveInvestorEconomics({
            investors: input.investors,
            investorTransactions: input.investorTransactions,
            transactions: input.transactions,
            managerFeePercentage: String(input.managerFeePercentage),
            managerFeeHistory: input.managerFeeHistory,
            pamLedger: input.pamLedger,
            periodStartTs,
            periodEndTs: input.meta.asOf.timestamp,
            deliveryExpenses: input.deliveryExpenses,
            treasuryTransactions: input.treasuryTransactions,
        });
        return getManagerProfitBreakdown(economics, input.managerFeePercentage).ownerTotalProfit;
    };
    const serviceProfitForPeriod = (periodStartTs: number) => money(input.manualAssetTransactions.reduce((sum, tx) => {
        if (tx.timestamp < periodStartTs || tx.timestamp > input.meta.asOf.timestamp)
            return sum;
        if (tx.type !== 'service' && tx.type !== 'invoice')
            return sum;
        return sum + Math.abs(finite(tx.amount));
    }, 0));
    const serviceProfitAllTime = money(input.manualAssetTransactions.reduce((sum, tx) => {
        if (tx.timestamp > input.meta.asOf.timestamp || (tx.type !== 'service' && tx.type !== 'invoice'))
            return sum;
        return sum + Math.abs(finite(tx.amount));
    }, 0));
    const digitalServiceProfitForPeriod = (periodStartTs: number) => money(input.digitalServiceTransactions.reduce((sum, tx) => {
        if (tx.timestamp < periodStartTs || tx.timestamp > input.meta.asOf.timestamp)
            return sum;
        return sum + finite(tx.profitDzd);
    }, 0));
    const digitalServiceProfitAllTime = money(input.digitalServiceTransactions.reduce((sum, tx) => {
        if (tx.timestamp > input.meta.asOf.timestamp)
            return sum;
        return sum + finite(tx.profitDzd);
    }, 0));
    return {
        periodBuckets: makePeriodBuckets(input.meta),
        caisse: input.treasury.caisseBalance,
        baridi: input.treasury.baridiBalance,
        activeClients: input.clients.activeClientsToday,
        todayProfit: input.portfolio.tradingProfit.today,
        todaySellCount: input.portfolio.sellCountToday,
        weekToDateProfit: input.portfolio.tradingProfit.week,
        monthToDateProfit: input.portfolio.tradingProfit.month,
        yearToDateProfit: input.portfolio.tradingProfit.year,
        allTimeProfit: input.portfolio.tradingProfit.allTime,
        todayUsdtSold: input.portfolio.soldQuantity.USDT.today,
        todayEurSold: input.portfolio.soldQuantity.EUR.today,
        monthToDateUsdtSold: input.portfolio.soldQuantity.USDT.month,
        monthToDateEurSold: input.portfolio.soldQuantity.EUR.month,
        yearToDateUsdtSold: input.portfolio.soldQuantity.USDT.year,
        yearToDateEurSold: input.portfolio.soldQuantity.EUR.year,
        allTimeUsdtSold: input.portfolio.soldQuantity.USDT.allTime,
        allTimeEurSold: input.portfolio.soldQuantity.EUR.allTime,
        ownerProfitToday: money(deriveOwnerTradingProfitForPeriod(input.meta.asOf.dayStartTs) + serviceProfitForPeriod(input.meta.asOf.dayStartTs) + digitalServiceProfitForPeriod(input.meta.asOf.dayStartTs)),
        ownerProfitWeek: money(deriveOwnerTradingProfitForPeriod(input.meta.asOf.weekStartTs) + serviceProfitForPeriod(input.meta.asOf.weekStartTs) + digitalServiceProfitForPeriod(input.meta.asOf.weekStartTs)),
        ownerProfitMonth: money(deriveOwnerTradingProfitForPeriod(input.meta.asOf.monthStartTs) + serviceProfitForPeriod(input.meta.asOf.monthStartTs) + digitalServiceProfitForPeriod(input.meta.asOf.monthStartTs)),
        ownerProfitYear: money(deriveOwnerTradingProfitForPeriod(input.meta.asOf.yearStartTs) + serviceProfitForPeriod(input.meta.asOf.yearStartTs) + digitalServiceProfitForPeriod(input.meta.asOf.yearStartTs)),
        ownerProfitAllTime: money(input.baseOwnerProfitAllTime + serviceProfitAllTime + digitalServiceProfitAllTime),
        last7DaysProfit: input.portfolio.last7DaysProfit,
    };
}

export function buildDashboardReadModelShadowFromLegacy(input: BuildDashboardReadModelsInput): DashboardReadModelSet {
    const meta = createSnapshotMeta(input);
    const pamLedger = computePamLedger(input.transactions, { nowMs: meta.asOf.timestamp });
    const treasury = buildTreasuryReadModel({
        meta,
        revision: resolveSummaryRevision(input.summaryRevisions, 'treasury_summary'),
        treasuryTransactions: input.treasuryTransactions,
        treasuryCards: input.treasuryCards,
    });
    const portfolio = buildPortfolioReadModel({ meta, revision: resolveSummaryRevision(input.summaryRevisions, 'portfolio_summary'), pamLedger });
    const clientBalances = buildClientBalancesFromLegacy(input.clientsDzd, input.clientTransactionsDzd);
    const clients = buildClientsReadModel({
        meta,
        revision: resolveSummaryRevision(input.summaryRevisions, 'clients_summary'),
        clients: input.clientsDzd,
        clientTransactions: input.clientTransactionsDzd,
        clientBalances,
        getClientFullName: input.getClientFullName,
    });
    const assetClientBalances = buildAssetClientBalances(input.manualAssetTransactions);
    const services = buildServicesReadModel({
        meta,
        revision: resolveSummaryRevision(input.summaryRevisions, 'services_summary'),
        manualAssets: input.manualAssets,
        manualAssetClients: input.manualAssetClients,
        manualAssetTransactions: input.manualAssetTransactions,
        digitalServiceTransactions: input.digitalServiceTransactions,
        assetClientBalances,
    });
    const deliveryExpenses = input.treasuryTransactions.filter((tx) => tx.origin === 'delivery_expense');
    const personalExpenses = input.treasuryTransactions.filter((tx) => tx.origin === 'personal_expense');
    const preliminaryInvestors = buildInvestorsReadModel({
        meta,
        revision: resolveSummaryRevision(input.summaryRevisions, 'investors_summary'),
        investors: input.investors,
        investorTransactions: input.investorTransactions,
        transactions: input.transactions,
        treasuryTransactions: input.treasuryTransactions,
        deliveryExpenses,
        personalExpenses,
        managerFeePercentage: input.managerFeePercentage,
        managerFeeHistory: input.managerFeeHistory,
        pamLedger,
        ownerOpeningCapital: input.ownerOpeningCapital,
        actualOwnerCapital: input.ownerOpeningCapital,
        serviceProfit: services.serviceRevenue,
        preTrackingPersonalExpenses: input.preTrackingPersonalExpenses,
    });
    const capitalSnapshot = computeCapitalSnapshot({
        caisseBalance: treasury.caisseBalance,
        baridiBalance: treasury.baridiBalance,
        portfolioStats: portfolio.positions,
        totalDettes: -clients.totalReceivables,
        totalAvances: clients.totalAdvances,
        treasuryCards: input.treasuryCards,
        investorLiability: preliminaryInvestors.investorLiability,
        services,
        managerPendingAdvances: treasury.managerPendingAdvances,
    });
    const investors = buildInvestorsReadModel({
        meta,
        revision: resolveSummaryRevision(input.summaryRevisions, 'investors_summary'),
        investors: input.investors,
        investorTransactions: input.investorTransactions,
        transactions: input.transactions,
        treasuryTransactions: input.treasuryTransactions,
        deliveryExpenses,
        personalExpenses,
        managerFeePercentage: input.managerFeePercentage,
        managerFeeHistory: input.managerFeeHistory,
        pamLedger,
        ownerOpeningCapital: input.ownerOpeningCapital,
        actualOwnerCapital: capitalSnapshot.netOwnedCapital,
        serviceProfit: services.serviceRevenue,
        preTrackingPersonalExpenses: input.preTrackingPersonalExpenses,
    });
    const dailyOverview = buildDailyOverview({
        meta,
        treasury,
        portfolio,
        clients,
        investors: input.investors,
        investorTransactions: input.investorTransactions,
        transactions: input.transactions,
        managerFeePercentage: input.managerFeePercentage,
        managerFeeHistory: input.managerFeeHistory,
        pamLedger,
        deliveryExpenses,
        treasuryTransactions: input.treasuryTransactions,
        manualAssetTransactions: input.manualAssetTransactions,
        digitalServiceTransactions: input.digitalServiceTransactions,
        baseOwnerProfitAllTime: getManagerProfitBreakdown(deriveInvestorEconomics({
            investors: input.investors,
            investorTransactions: input.investorTransactions,
            transactions: input.transactions,
            managerFeePercentage: String(input.managerFeePercentage),
            managerFeeHistory: input.managerFeeHistory,
            pamLedger,
            deliveryExpenses,
            treasuryTransactions: input.treasuryTransactions,
            personalExpenses,
        }), input.managerFeePercentage).ownerTotalProfit,
    });
    const personalExpenseTotals = summarizePersonalExpenseTotals(input.treasuryTransactions);
    const financialAudit: DashboardFinancialAuditSummary = {
        openingCapital: input.ownerOpeningCapital,
        tradingOwnerProfit: investors.managerProfitBreakdown.tradingOwnerProfit,
        serviceProfit: investors.managerProfitBreakdown.serviceProfit,
        historicalPersonalExpenses: investors.managerProfitBreakdown.personalExpenses,
        currentPersonalExpenses: personalExpenseTotals.current,
        totalPersonalExpenses: investors.managerProfitBreakdown.totalPersonalExpenses,
        deliveryExpensesSinceStart: treasury.deliveryExpensesTotal,
        actualOwnerCapital: investors.managerProfitBreakdown.actualOwnerCapital,
    };
    const financial: FinancialReadModel = {
        meta,
        revision: resolveSummaryRevision(input.summaryRevisions, 'financial_summary'),
        canonicalOwner: 'financial_summary',
        ownerRefs: READ_MODEL_CANONICAL_OWNERS,
        capitalSnapshot,
        dailyOverview,
        globalNetProfit: investors.globalNetProfit,
        financialAudit,
        reconciliationStatus: 'UNVERIFIED',
    };
    const dashboard = buildDashboardSummaryReadModel({
        meta,
        revision: resolveSummaryRevision(input.summaryRevisions, 'dashboard_summary'),
        treasury,
        portfolio,
        clients,
        investors,
        services,
        financial,
    });
    return {
        mode: 'shadow',
        meta,
        dashboard,
        treasury,
        portfolio,
        clients,
        investors,
        services,
        financial,
    };
}

function compareMetric(
    mismatches: ReadModelReconciliationMismatch[],
    field: string,
    canonicalOwner: ReadModelName,
    legacy: number,
    shadow: number,
    toleranceDzd: number,
): void {
    const normalizedLegacy = money(legacy);
    const normalizedShadow = money(shadow);
    const difference = money(normalizedLegacy - normalizedShadow);
    if (Math.abs(difference) > toleranceDzd) {
        mismatches.push({ field, canonicalOwner, legacy: normalizedLegacy, shadow: normalizedShadow, difference });
    }
}

export function reconcileDashboardReadModelsWithLegacy(
    readModels: DashboardReadModelSet,
    legacy: DashboardReadModelLegacyBaseline,
    toleranceDzd = 0.01,
): DashboardReadModelReconciliation {
    const mismatches: ReadModelReconciliationMismatch[] = [];
    compareMetric(mismatches, 'treasury.caisseBalance', 'treasury_summary', legacy.treasuryStats.caisse, readModels.treasury.caisseBalance, toleranceDzd);
    compareMetric(mismatches, 'treasury.baridiBalance', 'treasury_summary', legacy.treasuryStats.baridi, readModels.treasury.baridiBalance, toleranceDzd);
    compareMetric(mismatches, 'portfolio.costValueDzd', 'portfolio_summary', legacy.capitalSnapshot.stockValue, readModels.portfolio.costValueDzd, toleranceDzd);
    compareMetric(mismatches, 'clients.totalReceivables', 'clients_summary', legacy.capitalSnapshot.receivables, readModels.clients.totalReceivables, toleranceDzd);
    compareMetric(mismatches, 'clients.totalAdvances', 'clients_summary', legacy.capitalSnapshot.clientAdvances, readModels.clients.totalAdvances, toleranceDzd);
    compareMetric(mismatches, 'investors.externalInvestorCapital', 'investors_summary', legacy.investorBreakdown.capital, readModels.investors.externalInvestorCapital, toleranceDzd);
    compareMetric(mismatches, 'investors.externalInvestorProfits', 'investors_summary', legacy.investorBreakdown.profits, readModels.investors.externalInvestorProfits, toleranceDzd);
    compareMetric(mismatches, 'investors.investorLiability', 'investors_summary', legacy.investorLiability, readModels.investors.investorLiability, toleranceDzd);
    compareMetric(mismatches, 'services.amountToReceive', 'services_summary', legacy.servicesSummary.amountToReceive, readModels.services.amountToReceive, toleranceDzd);
    compareMetric(mismatches, 'services.clientAdvances', 'services_summary', legacy.servicesSummary.clientAdvances, readModels.services.clientAdvances, toleranceDzd);
    compareMetric(mismatches, 'services.serviceRevenue', 'services_summary', legacy.servicesSummary.serviceRevenue, readModels.services.serviceRevenue, toleranceDzd);
    compareMetric(mismatches, 'dashboard.money.caisseBalance', 'dashboard_summary', legacy.treasuryStats.caisse, readModels.dashboard.money.caisseBalance, toleranceDzd);
    compareMetric(mismatches, 'dashboard.money.baridiBalance', 'dashboard_summary', legacy.treasuryStats.baridi, readModels.dashboard.money.baridiBalance, toleranceDzd);
    compareMetric(mismatches, 'dashboard.money.clientReceivables', 'dashboard_summary', legacy.capitalSnapshot.receivables, readModels.dashboard.money.clientReceivables, toleranceDzd);
    compareMetric(mismatches, 'dashboard.money.clientAdvances', 'dashboard_summary', legacy.capitalSnapshot.clientAdvances, readModels.dashboard.money.clientAdvances, toleranceDzd);
    compareMetric(mismatches, 'dashboard.money.investorCapital', 'dashboard_summary', legacy.investorBreakdown.capital, readModels.dashboard.money.investorCapital, toleranceDzd);
    compareMetric(mismatches, 'dashboard.money.investorProfits', 'dashboard_summary', legacy.investorBreakdown.profits, readModels.dashboard.money.investorProfits, toleranceDzd);
    compareMetric(mismatches, 'dashboard.money.investorLiability', 'dashboard_summary', legacy.investorLiability, readModels.dashboard.money.investorLiability, toleranceDzd);
    compareMetric(mismatches, 'dashboard.money.serviceReceivables', 'dashboard_summary', legacy.servicesSummary.amountToReceive, readModels.dashboard.money.serviceReceivables, toleranceDzd);
    compareMetric(mismatches, 'dashboard.money.serviceAdvances', 'dashboard_summary', legacy.servicesSummary.clientAdvances, readModels.dashboard.money.serviceAdvances, toleranceDzd);
    compareMetric(mismatches, 'dashboard.money.totalCapital', 'dashboard_summary', legacy.capitalSnapshot.totalCapital, readModels.dashboard.money.totalCapital, toleranceDzd);
    compareMetric(mismatches, 'dashboard.money.netOwnedCapital', 'dashboard_summary', legacy.capitalSnapshot.netOwnedCapital, readModels.dashboard.money.netOwnedCapital, toleranceDzd);
    compareMetric(mismatches, 'dashboard.portfolio.costValueDzd', 'dashboard_summary', legacy.capitalSnapshot.stockValue, readModels.dashboard.portfolio.costValueDzd, toleranceDzd);
    compareMetric(mismatches, 'dashboard.dailyOverview.todayProfit', 'dashboard_summary', legacy.dailyOverview.todayProfit, readModels.dashboard.dailyOverview.todayProfit, toleranceDzd);
    compareMetric(mismatches, 'dashboard.dailyOverview.monthToDateProfit', 'dashboard_summary', legacy.dailyOverview.monthToDateProfit, readModels.dashboard.dailyOverview.monthToDateProfit, toleranceDzd);
    compareMetric(mismatches, 'dashboard.dailyOverview.ownerProfitAllTime', 'dashboard_summary', legacy.dailyOverview.ownerProfitAllTime, readModels.dashboard.dailyOverview.ownerProfitAllTime, toleranceDzd);
    compareMetric(mismatches, 'dashboard.financialAudit.actualOwnerCapital', 'dashboard_summary', legacy.financialAudit.actualOwnerCapital, readModels.dashboard.financialAudit.actualOwnerCapital, toleranceDzd);
    compareMetric(mismatches, 'financial.capitalSnapshot.totalCapital', 'financial_summary', legacy.capitalSnapshot.totalCapital, readModels.financial.capitalSnapshot.totalCapital, toleranceDzd);
    compareMetric(mismatches, 'financial.capitalSnapshot.netOwnedCapital', 'financial_summary', legacy.capitalSnapshot.netOwnedCapital, readModels.financial.capitalSnapshot.netOwnedCapital, toleranceDzd);
    compareMetric(mismatches, 'financial.globalNetProfit', 'financial_summary', legacy.globalNetProfit, readModels.financial.globalNetProfit, toleranceDzd);
    compareMetric(mismatches, 'daily.todayProfit', 'financial_summary', legacy.dailyOverview.todayProfit, readModels.financial.dailyOverview.todayProfit, toleranceDzd);
    compareMetric(mismatches, 'daily.monthToDateProfit', 'financial_summary', legacy.dailyOverview.monthToDateProfit, readModels.financial.dailyOverview.monthToDateProfit, toleranceDzd);
    compareMetric(mismatches, 'daily.ownerProfitAllTime', 'financial_summary', legacy.dailyOverview.ownerProfitAllTime, readModels.financial.dailyOverview.ownerProfitAllTime, toleranceDzd);
    compareMetric(mismatches, 'manager.tradingOwnerProfit', 'investors_summary', legacy.managerProfitBreakdown.tradingOwnerProfit, readModels.investors.managerProfitBreakdown.tradingOwnerProfit, toleranceDzd);
    compareMetric(mismatches, 'financialAudit.actualOwnerCapital', 'financial_summary', legacy.financialAudit.actualOwnerCapital, readModels.financial.financialAudit.actualOwnerCapital, toleranceDzd);
    return {
        ok: mismatches.length === 0,
        toleranceDzd,
        generationId: readModels.meta.generationId,
        snapshotRevision: readModels.meta.snapshotRevision,
        mismatches,
    };
}
