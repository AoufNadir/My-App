import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { ClientDzd, ClientTransactionDzd, Investor, InvestorTransaction, TreasuryCard, TreasuryTx, Tx } from '../types';
import { buildDashboardReadModelShadowFromLegacy } from './dashboardReadModels';
import {
    READ_MODEL_APPLIED_OPS_PATH,
    applyReadModelDelta,
    buildReadModelDelta,
    combineClientPositionDeltas,
    derivePortfolioSellReadModelEconomics,
    transitionClientBalanceDelta,
} from './readModelDeltas';
import { allocateProfitDeltaAtTimestamp } from '../hooks/useInvestorEconomics';
import { distributeProportionally, roundM } from '../utils/money';
import {
    WRITER_COVERAGE_MATRIX,
    WRITER_COVERAGE_NON_ATOMIC_RISKS,
    findWriterCoverageById,
} from './writerCoverageMatrix';
import {
    prepareWriterReadModelDelta,
    writerIdsReadyForPreparedDeltas,
} from './preparedWriterDeltas';

const asOf = new Date('2026-08-23T12:00:00.000Z').getTime();
const dayStart = new Date('2026-08-23T00:00:00.000Z').getTime();

const transactions: Tx[] = [
    {
        id: 'buy-1',
        type: 'buy',
        quantity: 100,
        price: 200,
        total: 20000,
        date: '23/08/2026',
        time: '08:00',
        timestamp: dayStart + 1000,
        currency: 'USDT',
    },
];

const treasuryTransactions: TreasuryTx[] = [
    {
        id: 'cash-opening',
        type: 'Ajout',
        source: 'Caisse',
        amount: 50000,
        date: '23/08/2026',
        time: '07:00',
        timestamp: dayStart,
    },
    {
        id: 'buy-cash-out',
        type: 'Retrait',
        source: 'Caisse',
        amount: 20000,
        date: '23/08/2026',
        time: '08:00',
        timestamp: dayStart + 1000,
        linkedTxId: 'buy-1',
    },
];

const investors: Investor[] = [
    {
        id: 'manager',
        name: 'Manager',
        entryDate: '2026-08-01',
        capitalInvested: 100000,
        initialCapital: 100000,
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
        capitalInvested: 100000,
        initialCapital: 100000,
        sharePercentage: 0,
        totalProfit: 0,
        withdrawnProfit: 0,
        availableProfit: 0,
        isActive: true,
    },
];

function buildBaseSnapshot() {
    return buildDashboardReadModelShadowFromLegacy({
        transactions,
        clientsDzd: [] as ClientDzd[],
        clientTransactionsDzd: [] as ClientTransactionDzd[],
        treasuryTransactions,
        treasuryCards: [{ id: 'card-1', name: 'Card', value: 1000 }] as TreasuryCard[],
        manualAssets: [],
        manualAssetClients: [],
        manualAssetTransactions: [],
        digitalServiceTransactions: [],
        investors,
        investorTransactions: [] as InvestorTransaction[],
        managerFeePercentage: 30,
        managerFeeHistory: [{ id: 'initial-30', percentage: 30, effectiveFrom: dayStart - 1, createdAt: dayStart - 1 }],
        ownerOpeningCapital: 100000,
        preTrackingPersonalExpenses: 0,
        getClientFullName: (client) => client.fullName,
        asOf,
        generationId: 'writer-coverage-generation',
        snapshotRevision: 77,
        summaryRevisions: {
            dashboard_summary: 1,
            treasury_summary: 1,
            portfolio_summary: 1,
            clients_summary: 1,
            investors_summary: 1,
            services_summary: 1,
            financial_summary: 1,
        },
    });
}

const requiredWriterIds = [
    'portfolio.buy-cash',
    'portfolio.buy-credit',
    'portfolio.sell-cash',
    'portfolio.sell-credit',
    'portfolio.exchange',
    'portfolio.manual-adjustment',
    'treasury.adjustment',
    'treasury.transfer',
    'treasury.cards',
    'clients.settlement',
    'clients.transfer',
    'clients.initial-adjustment-remise',
    'investors.capital',
    'investors.profit-payout',
    'investors.reinvest-profit',
    'investors.personal-expenses',
    'project.delivery-expense',
    'services.digital',
    'services.manual-assets',
    'orders.complete-order',
    'legacy.edit-delete',
    'entity.archive-only',
    'main.global-reset',
];

requiredWriterIds.forEach((id) => {
    assert.ok(findWriterCoverageById(id), `missing writer coverage row: ${id}`);
});

WRITER_COVERAGE_MATRIX.forEach((row) => {
    assert.equal(row.idempotencyPath, READ_MODEL_APPLIED_OPS_PATH, `${row.id} must use the shared idempotency path`);
    assert.ok(row.tests.length > 0, `${row.id} must declare tests`);
    assert.doesNotMatch(row.incrementalDelta, /full[- ]?history|rebuild/i, `${row.id} must not rely on full-history rebuild`);
    if (row.id !== 'main.global-reset') {
        assert.ok(row.domainSummaries.includes('dashboard_summary'), `${row.id} must update dashboard_summary`);
        assert.ok(row.dashboardFields.length > 0, `${row.id} must list dashboard fields`);
    }
});

assert.equal(findWriterCoverageById('legacy.edit-delete')?.atomicMechanism, 'requires_operation_index_before_write_mode');
assert.equal(findWriterCoverageById('entity.archive-only')?.atomicMechanism, 'requires_operation_index_before_write_mode');
assert.equal(findWriterCoverageById('main.global-reset')?.atomicMechanism, 'dev_admin_only_block_before_read_mode');
assert.match(findWriterCoverageById('treasury.adjustment')?.incrementalDelta || '', /correction/i);
assert.ok(WRITER_COVERAGE_NON_ATOMIC_RISKS.length >= 3);

const preparedWriterIds = writerIdsReadyForPreparedDeltas();
assert.equal(preparedWriterIds.includes('main.global-reset'), false, 'Global reset must not be represented as a financial delta');
WRITER_COVERAGE_MATRIX
    .filter((row) => row.id !== 'main.global-reset')
    .forEach((row) => {
        assert.ok(preparedWriterIds.includes(row.id), `${row.id} must be ready for prepared/shadow deltas`);
        const result = prepareWriterReadModelDelta(row.id, {
            operationId: `prepared:${row.id}`,
            effectiveAt: asOf,
            payload: { writerId: row.id },
            affectedSummaries: [...row.domainSummaries],
        });
        assert.equal(result.ok, true, `${row.id} should accept its coverage summaries`);
        if (result.ok) {
            assert.equal(result.prepared.delta.operationId, `prepared:${row.id}`);
            assert.equal(result.prepared.coverage.id, row.id);
        }
    });
assert.equal(prepareWriterReadModelDelta('main.global-reset', {
    operationId: 'prepared:reset',
    effectiveAt: asOf,
    payload: {},
    affectedSummaries: [],
}).ok, false);
assert.equal(prepareWriterReadModelDelta('treasury.adjustment', {
    operationId: 'prepared:bad',
    effectiveAt: asOf,
    payload: {},
    affectedSummaries: ['dashboard_summary'],
}).ok, false, 'Prepared deltas must not silently drift from the coverage matrix');

const deltasSource = readFileSync('src/readModels/readModelDeltas.ts', 'utf8');
const matrixSource = readFileSync('src/readModels/writerCoverageMatrix.ts', 'utf8');
assert.doesNotMatch(deltasSource, /from ['"].*firebase|collection\(|\.set\(|\.update\(|\.delete\(|getDocs|onSnapshot/);
assert.doesNotMatch(matrixSource, /from ['"].*firebase|collection\(|\.set\(|\.update\(|\.delete\(|getDocs|onSnapshot/);

const base = buildBaseSnapshot();
const baseSerialized = JSON.stringify(base);

const treasuryCorrection = buildReadModelDelta({
    operationId: 'op:treasury-correction',
    effectiveAt: asOf,
    payload: { kind: 'treasury_adjustment_in', amountDzd: 1000, wallet: 'Caisse' },
    affectedSummaries: ['dashboard_summary', 'treasury_summary', 'financial_summary'],
    wallets: { Caisse: 1000 },
    recentOperation: { operationId: 'op:treasury-correction', source: 'legacy', type: 'Correction solde', effectiveAt: asOf },
});
const afterTreasury = applyReadModelDelta(base, treasuryCorrection);
assert.equal(JSON.stringify(base), baseSerialized, 'applyReadModelDelta must not mutate the input snapshot');
assert.equal(afterTreasury.treasury.caisseBalance, base.treasury.caisseBalance + 1000);
assert.equal(afterTreasury.dashboard.money.caisseBalance, afterTreasury.treasury.caisseBalance);
assert.equal(afterTreasury.financial.dailyOverview.todayProfit, base.financial.dailyOverview.todayProfit, 'treasury correction is not income/profit');
assert.equal(afterTreasury.dashboard.recentOperations.items[0].operationId, 'op:treasury-correction');

const saleCash = buildReadModelDelta({
    operationId: 'op:sale-cash',
    effectiveAt: asOf,
    payload: { kind: 'portfolio_sale_cash', currency: 'USDT', quantity: 10, revenueDzd: 2500, costDzd: 2000 },
    affectedSummaries: ['dashboard_summary', 'portfolio_summary', 'treasury_summary', 'investors_summary', 'financial_summary'],
    wallets: { Caisse: 2500 },
    portfolio: { USDT: { quantityDelta: -10, costBasisDeltaDzd: -2000, realizedProfitDeltaDzd: 500, soldQuantityDelta: 10 } },
    investors: {
        externalInvestorProfitsDelta: 200,
        investorLiabilityDelta: 200,
        managerTradingOwnerProfitDelta: 300,
        managerActualOwnerCapitalDelta: 300,
        globalNetProfitDelta: 500,
    },
    dashboardDaily: {
        todayProfitDelta: 500,
        weekToDateProfitDelta: 500,
        monthToDateProfitDelta: 500,
        yearToDateProfitDelta: 500,
        allTimeProfitDelta: 500,
        todaySellCountDelta: 1,
        todayUsdtSoldDelta: 10,
        monthToDateUsdtSoldDelta: 10,
        yearToDateUsdtSoldDelta: 10,
        allTimeUsdtSoldDelta: 10,
        ownerProfitTodayDelta: 300,
        ownerProfitWeekDelta: 300,
        ownerProfitMonthDelta: 300,
        ownerProfitYearDelta: 300,
        ownerProfitAllTimeDelta: 300,
    },
});
const afterSale = applyReadModelDelta(base, saleCash);
assert.equal(afterSale.portfolio.positions.usdt.available, 90);
assert.equal(afterSale.portfolio.positions.usdt.costBasis, 18000);
assert.equal(afterSale.portfolio.costValueDzd, 18000);
assert.equal(afterSale.treasury.caisseBalance, base.treasury.caisseBalance + 2500);
assert.equal(afterSale.investors.externalInvestorProfits, base.investors.externalInvestorProfits + 200);
assert.equal(afterSale.financial.dailyOverview.todayProfit, base.financial.dailyOverview.todayProfit + 500);
assert.equal(afterSale.dashboard.money.investorLiability, afterSale.investors.investorLiability);
assert.equal(afterSale.dashboard.portfolio.soldQuantity.USDT.today, afterSale.portfolio.soldQuantity.USDT.today);
{
    const operationId = 'DK96K4g84HJ7jH9lcNK4';
    const effectiveAt = new Date('2026-08-23T20:49:41.398Z').getTime();
    const canonicalSellTx: Tx = {
        id: operationId,
        type: 'sell',
        quantity: 500,
        sell: 250,
        total: 125000,
        profit: 1635,
        date: '23/08/2026',
        time: '20:49',
        timestamp: effectiveAt,
        currency: 'USDT',
        clientPaymentStatus: 'credit',
        linkedClientId: 'clplZYjwqgHTuS3n5Fmz',
        settlementCurrency: 'DZD',
    };
    const economics = derivePortfolioSellReadModelEconomics({
        transactions: [{
            id: 'dk-regression-opening-buy',
            type: 'buy',
            quantity: 500,
            price: 246.73178,
            total: 123365.89,
            date: '23/08/2026',
            time: '20:00',
            timestamp: effectiveAt - 1000,
            currency: 'USDT',
        }],
        sellTx: canonicalSellTx,
        fallbackProfitDzd: canonicalSellTx.profit || 0,
        fallbackCostBasisDzd: 123365,
        nowMs: effectiveAt,
    });
    assert.equal(economics.realizedProfitDzd, 1634.11, 'sell-credit delta must use canonical PAM derived profit, not stored tx.profit');
    assert.equal(economics.soldCostDzd, 123365.89);

    const managerFeePercentage = 20;
    const managerFee = roundM(economics.realizedProfitDzd * (managerFeePercentage / 100));
    const investorPool = roundM(economics.realizedProfitDzd - managerFee);
    const [managerCapitalShare, externalInvestorShare] = distributeProportionally(investorPool, [2000000, 1000000]);
    const allocation = allocateProfitDeltaAtTimestamp({
        investors: [
            {
                id: 'manager',
                name: 'Manager',
                entryDate: '2026-01-01',
                capitalInvested: 2000000,
                initialCapital: 2000000,
                sharePercentage: 0,
                totalProfit: 0,
                withdrawnProfit: 0,
                availableProfit: 0,
                isActive: true,
                isManager: true,
            },
            {
                id: 'external',
                name: 'External Investor',
                entryDate: '2026-01-01',
                capitalInvested: 1000000,
                initialCapital: 1000000,
                sharePercentage: 0,
                totalProfit: 0,
                withdrawnProfit: 0,
                availableProfit: 0,
                isActive: true,
            },
        ] as Investor[],
        investorTransactions: [] as InvestorTransaction[],
        treasuryTransactions: [] as TreasuryTx[],
        personalExpenses: [] as TreasuryTx[],
        managerFeeHistory: [{ id: 'rate-20', percentage: managerFeePercentage, effectiveFrom: effectiveAt - 1, createdAt: effectiveAt - 1 }],
        projectProfitDzd: economics.realizedProfitDzd,
        timestamp: effectiveAt,
    });
    assert.equal(allocation.externalInvestorProfitsDeltaDzd, externalInvestorShare);
    assert.equal(allocation.managerProfitDeltaDzd, roundM(managerFee + managerCapitalShare));
    assert.equal(roundM(allocation.managerProfitDeltaDzd + allocation.externalInvestorProfitsDeltaDzd), economics.realizedProfitDzd);
}

const firstClientDelta = transitionClientBalanceDelta(-1000, -400);
assert.deepEqual(firstClientDelta, { receivablesDelta: -600, advancesDelta: 0 });
const secondClientDelta = transitionClientBalanceDelta(-400, 100);
assert.deepEqual(secondClientDelta, { receivablesDelta: -400, advancesDelta: 100 });
assert.deepEqual(combineClientPositionDeltas([firstClientDelta, secondClientDelta]), {
    receivablesDelta: -1000,
    advancesDelta: 100,
    activeClientsTodayDelta: 0,
});

const reinvest = buildReadModelDelta({
    operationId: 'op:reinvest',
    effectiveAt: asOf,
    payload: { kind: 'profit_reinvestment', amountDzd: 50 },
    affectedSummaries: ['dashboard_summary', 'investors_summary', 'financial_summary'],
    investors: {
        externalInvestorCapitalDelta: 50,
        externalInvestorProfitsDelta: -50,
        investorLiabilityDelta: 0,
    },
});
const afterReinvest = applyReadModelDelta(afterSale, reinvest);
assert.equal(afterReinvest.investors.externalInvestorCapital, afterSale.investors.externalInvestorCapital + 50);
assert.equal(afterReinvest.investors.externalInvestorProfits, afterSale.investors.externalInvestorProfits - 50);
assert.equal(afterReinvest.investors.investorLiability, afterSale.investors.investorLiability);
assert.equal(afterReinvest.treasury.cashTotal, afterSale.treasury.cashTotal, 'reinvestment has no cash movement');

const serviceCredit = buildReadModelDelta({
    operationId: 'op:service-credit',
    effectiveAt: asOf,
    payload: { kind: 'digital_service_sale', amountDzd: 1000, costDzd: 300, profitDzd: 700 },
    affectedSummaries: ['dashboard_summary', 'services_summary', 'clients_summary', 'investors_summary', 'financial_summary'],
    services: {
        amountToReceiveDelta: 1000,
        digitalServiceProfitDelta: 700,
        serviceRevenueDelta: 700,
        netCapitalImpactDelta: 1000,
    },
    clients: { receivablesDelta: 1000, advancesDelta: 0, activeClientsTodayDelta: 1 },
    investors: {
        managerServiceProfitDelta: 700,
        managerActualOwnerCapitalDelta: 700,
    },
    dashboardDaily: {
        ownerProfitTodayDelta: 700,
        ownerProfitWeekDelta: 700,
        ownerProfitMonthDelta: 700,
        ownerProfitYearDelta: 700,
        ownerProfitAllTimeDelta: 700,
    },
});
const afterService = applyReadModelDelta(afterSale, serviceCredit);
assert.equal(afterService.services.amountToReceive, afterSale.services.amountToReceive + 1000);
assert.equal(afterService.services.digitalServiceProfit, afterSale.services.digitalServiceProfit + 700);
assert.equal(afterService.clients.totalReceivables, afterSale.clients.totalReceivables + 1000);
assert.equal(afterService.dashboard.services.amountToReceive, afterService.services.amountToReceive);
assert.equal(afterService.dashboard.money.serviceReceivables, afterService.services.amountToReceive);

let bounded = base;
for (let index = 0; index < 6; index += 1) {
    bounded = applyReadModelDelta(bounded, buildReadModelDelta({
        operationId: `op:recent:${index}`,
        effectiveAt: asOf + index,
        payload: { index },
        affectedSummaries: ['dashboard_summary'],
        recentOperation: { operationId: `op:recent:${index}`, source: 'legacy', type: 'noop', effectiveAt: asOf + index },
    }));
}
assert.equal(bounded.dashboard.recentOperations.items.length, 5);
assert.equal(bounded.dashboard.recentOperations.items[0].operationId, 'op:recent:5');
assert.equal(bounded.dashboard.recentOperations.items[4].operationId, 'op:recent:1');

// ── Regression: canonical actualOwnerCapital (legacy vs read-model drift) ──
// Production symptom: legacy computed actualOwnerCapital fresh from the
// balance-sheet pipeline (computeCapitalSnapshot → netOwnedCapital →
// reconcileManagerProfitBreakdown) while the read models accumulated
// managerActualOwnerCapitalDeltas into an independent copy — the two
// disagreed by 0.18 DZD on dashboard.financialAudit.actualOwnerCapital /
// financialAudit.actualOwnerCapital. The fix derives the canonical value
// from the POST-DELTA components on every apply and mirrors it into
// investors_summary, so read model == legacy recomputation at every step.
{
    const driftBase = buildBaseSnapshot();
    const beforeAoc = driftBase.financial.capitalSnapshot.netOwnedCapital;
    assert.equal(driftBase.financial.financialAudit.actualOwnerCapital, beforeAoc, 'base snapshot builds actualOwnerCapital from the balance sheet');
    assert.equal(driftBase.investors.managerProfitBreakdown.actualOwnerCapital, beforeAoc, 'investors_summary agrees with the balance sheet at generation time');

    // Two operations whose manager-capital deltas carry fractional cent tails
    // (+0.09 twice = +0.18) while the balance-sheet components stay put —
    // exactly the op class that made the old accumulated copy creep 0.18 DZD
    // above the legacy balance-sheet value.
    const driftOps = [0, 1].map((index) => buildReadModelDelta({
        operationId: `op:aoc-drift:${index}`,
        effectiveAt: asOf + index,
        payload: { kind: 'manager_capital_reclass', amountDzd: 0.09 },
        affectedSummaries: ['dashboard_summary', 'investors_summary', 'financial_summary'],
        investors: { managerActualOwnerCapitalDelta: 0.09 },
    }));
    const drifted = driftOps.reduce((snapshot, delta) => applyReadModelDelta(snapshot, delta), driftBase);

    // Legacy-equivalent recomputation: components unchanged by these internal
    // reclasses ⇒ legacy still reports the opening balance-sheet value.
    const legacyEquivalent = beforeAoc;
    const readModelValue = drifted.financial.financialAudit.actualOwnerCapital;
    assert.ok(
        Math.abs(readModelValue - legacyEquivalent) <= 0.01,
        `actualOwnerCapital must track the balance-sheet derivation (expected ${legacyEquivalent}, got ${readModelValue})`
    );
    // Single source of truth across every surface:
    assert.equal(drifted.investors.managerProfitBreakdown.actualOwnerCapital, readModelValue, 'investors_summary mirrors the canonical value');
    assert.equal(drifted.dashboard.financialAudit.actualOwnerCapital, readModelValue, 'dashboard_summary mirrors the canonical value');
}

console.log('read model writer coverage tests passed');
