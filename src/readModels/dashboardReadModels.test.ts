import assert from 'node:assert/strict';
import type { ClientDzd, ClientTransactionDzd, DigitalServiceTransaction, Investor, InvestorTransaction, ManualAsset, ManualAssetClient, ManualAssetTransaction, TreasuryCard, TreasuryTx, Tx } from '../types';
import { computeCapitalSnapshot } from '../utils/capitalSnapshot';
import {
    READ_MODEL_CANONICAL_OWNERS,
    buildDashboardReadModelShadowFromLegacy,
    getReadModelsMode,
    reconcileDashboardReadModelsWithLegacy,
} from './dashboardReadModels';

const asOf = new Date('2026-08-23T12:00:00.000Z').getTime();
const dayStart = new Date('2026-08-23T00:00:00.000Z').getTime();
const generationId = 'test-generation-1';
const snapshotRevision = 101;

const transactions: Tx[] = [
    {
        id: 'buy-1',
        type: 'buy',
        quantity: 100,
        price: 200,
        total: 20_000,
        date: '23/08/2026',
        time: '08:00',
        timestamp: dayStart + 1000,
        currency: 'USDT',
    },
    {
        id: 'sell-1',
        type: 'sell',
        quantity: 10,
        sell: 250,
        total: 2_500,
        date: '23/08/2026',
        time: '09:00',
        timestamp: dayStart + 2000,
        currency: 'USDT',
    },
];

const clientsDzd: ClientDzd[] = [
    { id: 'client-debt', fullName: 'Client Debt' },
    { id: 'client-advance', fullName: 'Client Advance' },
];

const clientTransactionsDzd: ClientTransactionDzd[] = [
    {
        id: 'client-debt-tx',
        clientId: 'client-debt',
        montant: -1000,
        type: 'Vente USDT',
        date: '23/08/2026',
        time: '09:00',
        timestamp: dayStart + 2000,
    },
    {
        id: 'client-advance-tx',
        clientId: 'client-advance',
        montant: 200,
        type: 'Règlement Reçu',
        date: '23/08/2026',
        time: '10:00',
        timestamp: dayStart + 3000,
    },
];

const treasuryTransactions: TreasuryTx[] = [
    {
        id: 'cash-opening',
        type: 'Ajout',
        source: 'Caisse',
        amount: 10_000,
        date: '23/08/2026',
        time: '07:00',
        timestamp: dayStart,
    },
    {
        id: 'baridi-opening',
        type: 'Ajout',
        source: 'BaridiMob',
        amount: 5_000,
        date: '23/08/2026',
        time: '07:05',
        timestamp: dayStart + 1,
    },
    {
        id: 'delivery-1',
        type: 'Retrait',
        source: 'Caisse',
        amount: 100,
        amountDzd: 100,
        origin: 'delivery_expense',
        date: '23/08/2026',
        time: '10:00',
        timestamp: dayStart + 4000,
    },
];

const treasuryCards: TreasuryCard[] = [
    { id: 'card-1', name: 'Card', value: 300 },
];

const manualAssets: ManualAsset[] = [
    { id: 'asset-1', name: 'Service', createdAt: dayStart, updatedAt: dayStart },
];

const manualAssetClients: ManualAssetClient[] = [
    { id: 'asset-client-1', assetId: 'asset-1', fullName: 'Service Client', createdAt: dayStart, updatedAt: dayStart },
];

const manualAssetTransactions: ManualAssetTransaction[] = [
    {
        id: 'service-1',
        actifId: 'asset-1',
        clientId: 'asset-client-1',
        type: 'service',
        amount: -3000,
        date: '23/08/2026',
        time: '09:30',
        timestamp: dayStart + 2500,
    },
    {
        id: 'service-payment-1',
        actifId: 'asset-1',
        clientId: 'asset-client-1',
        type: 'payment_received',
        amount: 1000,
        date: '23/08/2026',
        time: '10:30',
        timestamp: dayStart + 3500,
    },
];

const digitalServiceTransactions: DigitalServiceTransaction[] = [
    {
        id: 'digital-1',
        type: 'digital_service_sale',
        clientId: 'client-debt',
        serviceName: 'Digital',
        purchaseWallet: 'Caisse',
        purchaseCurrency: 'DZD',
        purchaseAmount: 300,
        purchaseRateToDzd: 1,
        purchaseAmountDzd: 300,
        saleWallet: 'Caisse',
        saleCurrency: 'DZD',
        saleAmount: 1000,
        saleRateToDzd: 1,
        saleAmountDzd: 1000,
        profitDzd: 700,
        date: '23/08/2026',
        time: '11:00',
        timestamp: dayStart + 5000,
    },
];

const investors: Investor[] = [
    {
        id: 'manager',
        name: 'Manager',
        entryDate: '2026-08-01',
        capitalInvested: 100_000,
        initialCapital: 100_000,
        sharePercentage: 0,
        totalProfit: 0,
        withdrawnProfit: 0,
        availableProfit: 0,
        isActive: true,
        isManager: true,
    },
    {
        id: 'external',
        name: 'External',
        entryDate: '2026-08-01',
        capitalInvested: 100_000,
        initialCapital: 100_000,
        sharePercentage: 0,
        totalProfit: 0,
        withdrawnProfit: 0,
        availableProfit: 0,
        isActive: true,
    },
];

const investorTransactions: InvestorTransaction[] = [];

const shadow = buildDashboardReadModelShadowFromLegacy({
    transactions,
    clientsDzd,
    clientTransactionsDzd,
    treasuryTransactions,
    treasuryCards,
    manualAssets,
    manualAssetClients,
    manualAssetTransactions,
    digitalServiceTransactions,
    investors,
    investorTransactions,
    managerFeePercentage: 30,
    managerFeeHistory: [{ id: 'initial-30', percentage: 30, effectiveFrom: dayStart - 1, createdAt: dayStart - 1 }],
    ownerOpeningCapital: 100_000,
    preTrackingPersonalExpenses: 0,
    getClientFullName: (client) => client.fullName,
    asOf,
    generationId,
    snapshotRevision,
    summaryRevisions: {
        dashboard_summary: 7,
        treasury_summary: 2,
        portfolio_summary: 3,
        clients_summary: 4,
        investors_summary: 5,
        services_summary: 6,
        financial_summary: 8,
    },
});

assert.equal(getReadModelsMode(undefined), 'shadow');
assert.equal(getReadModelsMode('legacy'), 'legacy');
assert.equal(getReadModelsMode('read'), 'read');

assert.equal(shadow.meta.generationId, generationId);
assert.equal(shadow.meta.snapshotRevision, snapshotRevision);
assert.equal(shadow.dashboard.meta.generationId, generationId);
assert.equal(shadow.treasury.meta.generationId, generationId);
assert.equal(shadow.portfolio.meta.generationId, generationId);
assert.equal(shadow.clients.meta.generationId, generationId);
assert.equal(shadow.investors.meta.generationId, generationId);
assert.equal(shadow.services.meta.generationId, generationId);
assert.equal(shadow.financial.meta.generationId, generationId);
assert.equal(shadow.dashboard.revision, 7);
assert.equal(shadow.treasury.revision, 2);
assert.equal(shadow.portfolio.revision, 3);
assert.equal(shadow.clients.revision, 4);
assert.equal(shadow.investors.revision, 5);
assert.equal(shadow.services.revision, 6);
assert.equal(shadow.financial.revision, 8);

assert.equal(READ_MODEL_CANONICAL_OWNERS.portfolioCostValue, 'portfolio_summary');
assert.equal(READ_MODEL_CANONICAL_OWNERS.clientReceivables, 'clients_summary');
assert.equal(READ_MODEL_CANONICAL_OWNERS.managerProfitBreakdown, 'investors_summary');
assert.equal(READ_MODEL_CANONICAL_OWNERS.dashboardMoneyMap, 'dashboard_summary');
assert.equal(READ_MODEL_CANONICAL_OWNERS.capitalSnapshot, 'dashboard_summary');

assert.equal(shadow.treasury.caisseBalance, 9900);
assert.equal(shadow.treasury.baridiBalance, 5000);
assert.equal(shadow.treasury.treasuryCardsTotal, 300);
assert.equal(shadow.treasury.deliveryExpensesTotal, 100);

assert.equal(shadow.portfolio.valuationBasis, 'cost_pam');
assert.equal(shadow.portfolio.marketValueDzd, null);
assert.equal(shadow.portfolio.positions.usdt.available, 90);
assert.equal(shadow.portfolio.positions.usdt.avgBuy, 200);
assert.equal(shadow.portfolio.costValueDzd, 18000);
assert.equal(shadow.portfolio.tradingProfit.today, 500);
assert.equal(shadow.portfolio.soldQuantity.USDT.today, 10);

assert.equal(shadow.clients.totalReceivables, 1000);
assert.equal(shadow.clients.totalAdvances, 200);
assert.equal(shadow.clients.netClientPosition, 800);
assert.equal(shadow.clients.activeClientsToday, 2);

assert.equal(shadow.services.amountToReceive, 2000);
assert.equal(shadow.services.manualServiceRevenue, 3000);
assert.equal(shadow.services.digitalServiceProfit, 700);
assert.equal(shadow.services.serviceRevenue, 3700);
assert.equal(shadow.services.netCapitalImpact, 2000);

assert.equal(shadow.investors.globalNetProfit, 400);
assert.equal(shadow.investors.externalInvestorCapital, 100000);
assert.equal(shadow.investors.externalInvestorProfits, 140);
assert.equal(shadow.investors.managerProfitBreakdown.tradingOwnerProfit, 260);
assert.equal(shadow.investors.managerProfitBreakdown.serviceProfit, 3700);

assert.equal(shadow.financial.capitalSnapshot.stockValue, 18000);
assert.equal(shadow.financial.capitalSnapshot.receivables, 1000);
assert.equal(shadow.financial.capitalSnapshot.clientAdvances, 200);
assert.equal(shadow.financial.dailyOverview.periodBuckets[0].asOfDate, '2026-08-23');
assert.equal(shadow.financial.dailyOverview.todayProfit, 500);
assert.equal(shadow.financial.dailyOverview.ownerProfitAllTime, 3960);
assert.equal(shadow.dashboard.sourceSummaries.treasury_summary.revision, shadow.treasury.revision);
assert.equal(shadow.dashboard.sourceSummaries.financial_summary.revision, shadow.financial.revision);
assert.equal(shadow.dashboard.money.caisseBalance, 9900);
assert.equal(shadow.dashboard.money.baridiBalance, 5000);
assert.equal(shadow.dashboard.money.clientReceivables, 1000);
assert.equal(shadow.dashboard.money.clientAdvances, 200);
assert.equal(shadow.dashboard.money.serviceReceivables, 2000);
assert.equal(shadow.dashboard.money.serviceAdvances, 0);
assert.equal(shadow.dashboard.money.investorCapital, 100000);
assert.equal(shadow.dashboard.money.investorProfits, 140);
assert.equal(shadow.dashboard.money.totalCapital, shadow.financial.capitalSnapshot.totalCapital);
assert.equal(shadow.dashboard.money.netOwnedCapital, shadow.financial.capitalSnapshot.netOwnedCapital);
assert.equal(shadow.dashboard.portfolio.valuationBasis, 'cost_pam');
assert.equal(shadow.dashboard.portfolio.marketValueDzd, null);
assert.equal(shadow.dashboard.portfolio.costValueDzd, 18000);
assert.equal(shadow.dashboard.dailyOverview.todayProfit, 500);
assert.equal(shadow.dashboard.dailyOverview.ownerProfitAllTime, 3960);
assert.equal(shadow.dashboard.clients.topOverdueClients.maxItems, 3);
assert.ok(shadow.dashboard.clients.topOverdueClients.items.length <= 3);
assert.equal(shadow.dashboard.recentOperations.maxItems, 5);
assert.equal(shadow.dashboard.recentOperations.items.length, 0);

const legacyCapitalSnapshot = computeCapitalSnapshot({
    caisseBalance: shadow.treasury.caisseBalance,
    baridiBalance: shadow.treasury.baridiBalance,
    portfolioStats: shadow.portfolio.positions,
    totalDettes: -shadow.clients.totalReceivables,
    totalAvances: shadow.clients.totalAdvances,
    treasuryCards,
    investorLiability: shadow.investors.investorLiability,
    services: shadow.services,
    managerPendingAdvances: shadow.treasury.managerPendingAdvances,
});

const reconciliation = reconcileDashboardReadModelsWithLegacy(shadow, {
    treasuryStats: { caisse: shadow.treasury.caisseBalance, baridi: shadow.treasury.baridiBalance },
    portfolioStats: shadow.portfolio.positions,
    totals: { totalDettes: -shadow.clients.totalReceivables, totalAvances: shadow.clients.totalAdvances },
    investorBreakdown: shadow.investors.investorBreakdown,
    investorLiability: shadow.investors.investorLiability,
    capitalSnapshot: legacyCapitalSnapshot,
    servicesSummary: shadow.services,
    dailyOverview: shadow.financial.dailyOverview,
    globalNetProfit: shadow.investors.globalNetProfit,
    managerProfitBreakdown: shadow.investors.managerProfitBreakdown,
    financialAudit: shadow.financial.financialAudit,
});

assert.equal(reconciliation.ok, true);
assert.equal(reconciliation.mismatches.length, 0);

console.log('dashboard read model shadow tests passed');
