import assert from 'node:assert/strict';

import { deriveInvestorEconomics, getManagerProfitBreakdown } from '../hooks/useInvestorEconomics';
import { buildDashboardReadModelShadowFromLegacy } from '../readModels/dashboardReadModels';
import { prepareDebtWriteOffReadModelDelta } from '../readModels/debtWriteOffDelta';
import { applyReadModelDelta } from '../readModels/readModelDeltas';
import { collectDebtWriteOffs } from './debtWriteOffs';
import type { ClientDzd, ClientTransactionDzd, Investor, InvestorTransaction, TreasuryTx, Tx } from '../types';

const HOUR = 3_600_000;
const SALE_TS = new Date(2026, 8, 1, 10).getTime();
const WRITE_OFF_TS = new Date(2026, 9, 1, 10).getTime();

const investor = (id: string, isManager = false) => ({
    id,
    name: id,
    entryDate: '2026-01-01',
    capitalInvested: 1_000_000,
    initialCapital: 1_000_000,
    sharePercentage: 0,
    totalProfit: 0,
    withdrawnProfit: 0,
    availableProfit: 0,
    isActive: true,
    ...(isManager ? { isManager: true } : {}),
}) as Investor;
const investors = [investor('manager', true), investor('external')];
const managerFeeHistory = [{ id: 'fee-30', percentage: 30, effectiveFrom: 0, createdAt: 0 }];

// 400 USDT bought for 95 000 DZD and sold on credit for 100 000 DZD: 5 000 DZD profit.
const transactions = [
    { id: 'buy', type: 'buy', currency: 'USDT', quantity: 400, total: 95_000, date: '01/09/2026', time: '09:00', timestamp: SALE_TS - HOUR },
    { id: 'sell', type: 'sell', currency: 'USDT', quantity: 400, sell: 250, total: 100_000, date: '01/09/2026', time: '10:00', timestamp: SALE_TS, clientId: 'client' },
] as unknown as Tx[];
const clientRow = (fields: Partial<ClientTransactionDzd> & Pick<ClientTransactionDzd, 'id' | 'type' | 'montant' | 'timestamp'>) => ({
    clientId: 'client',
    date: '01/09/2026',
    time: '10:00',
    ...fields,
}) as ClientTransactionDzd;
const creditSale = clientRow({ id: 'sale-debt', type: 'Vente USDT', montant: -100_000, timestamp: SALE_TS, linkedTxId: 'sell' });
// What "Solder" now saves for a client who owes 100 000 DZD.
const writeOff = clientRow({ id: 'write-off', type: 'Remise solde', montant: 100_000, timestamp: WRITE_OFF_TS, paymentMethod: 'Remise' as never, countsAsLoss: true });

const economics = (clientTransactions: ClientTransactionDzd[], extra: { periodStartTs?: number; periodEndTs?: number } = {}) => deriveInvestorEconomics({
    investors,
    investorTransactions: [],
    transactions,
    managerFeePercentage: '30',
    managerFeeHistory,
    debtWriteOffs: collectDebtWriteOffs(clientTransactions),
    ...extra,
});
const profitOf = (result: ReturnType<typeof economics>, id: string) => result.derivedInvestors.find((inv) => inv.id === id)?.totalProfit;

// Audit item 8: the client never pays and the debt is cleared. Before, the project still
// showed +5 000 DZD. Now the 100 000 DZD are a loss: the project is at -95 000 DZD.
{
    const before = economics([creditSale]);
    assert.equal(before.totals.netDistributableProfit, 5_000);
    assert.equal(profitOf(before, 'manager'), 3_250);
    assert.equal(profitOf(before, 'external'), 1_750);

    const after = economics([creditSale, writeOff]);
    assert.equal(after.totals.derivedProfit, 5_000);
    assert.equal(after.totals.totalDebtWriteOffs, 100_000);
    assert.equal(after.totals.netDistributableProfit, -95_000);
    // Same split as any profit: 30 % manager fee, the rest by capital (1 000 000 each).
    assert.equal(profitOf(after, 'manager'), 3_250 - 65_000);
    assert.equal(profitOf(after, 'external'), 1_750 - 35_000);
    assert.equal(after.totals.reconciliationDifference, 0);
    assert.equal(getManagerProfitBreakdown(after, '30').totalDebtWriteOffs, 100_000);
    assert.equal(getManagerProfitBreakdown(after, '30').projectNetProfit, -95_000);
}

// The loss is shared exactly like a project expense of the same amount on the same day:
// the profit-split rule itself is unchanged.
{
    const asWriteOff = economics([creditSale, writeOff]);
    const asExpense = deriveInvestorEconomics({
        investors,
        investorTransactions: [],
        transactions,
        managerFeePercentage: '30',
        managerFeeHistory,
        deliveryExpenses: [{ id: 'expense', type: 'Retrait', source: 'Caisse', origin: 'delivery_expense', amount: 100_000, date: '01/10/2026', time: '10:00', timestamp: WRITE_OFF_TS } as TreasuryTx],
    });
    for (const id of ['manager', 'external'])
        assert.equal(profitOf(asWriteOff, id), profitOf(asExpense, id), id);
    assert.equal(asWriteOff.totals.managerShare, asExpense.totals.managerShare);
    assert.equal(asWriteOff.totals.investorShare, asExpense.totals.investorShare);
    assert.equal(asWriteOff.totals.netDistributableProfit, asExpense.totals.netDistributableProfit);
}

// Only write-offs saved from now on count. Older "Remise solde" rows have no flag, and an
// advance given back to a client (we owed him) is not a loss.
{
    const oldWriteOff = clientRow({ id: 'old', type: 'Remise solde', montant: 100_000, timestamp: WRITE_OFF_TS });
    const advanceCancelled = clientRow({ id: 'advance', type: 'Remise solde', montant: -3_000, timestamp: WRITE_OFF_TS, countsAsLoss: true });
    const historyOnly = clientRow({ id: 'history', type: 'Remise solde', montant: 100_000, timestamp: WRITE_OFF_TS, countsAsLoss: true, affectsBalance: false });
    const adjustment = clientRow({ id: 'adjust', type: 'Ajustement Solde', montant: 100_000, timestamp: WRITE_OFF_TS, countsAsLoss: true });
    const rows = [creditSale, oldWriteOff, advanceCancelled, historyOnly, adjustment];
    assert.deepEqual(collectDebtWriteOffs(rows), []);
    assert.deepEqual(economics(rows).totals, economics([creditSale]).totals);
    assert.deepEqual(collectDebtWriteOffs([writeOff]), [{ id: 'write-off', clientId: 'client', amountDzd: 100_000, timestamp: WRITE_OFF_TS }]);
}

// Period reports count a write-off in the period it was made.
{
    const september = economics([creditSale, writeOff], { periodStartTs: new Date(2026, 8, 1).getTime(), periodEndTs: new Date(2026, 9, 1).getTime() - 1 });
    assert.equal(september.totals.totalDebtWriteOffs, 0);
    assert.equal(september.totals.netDistributableProfit, 5_000);
    const october = economics([creditSale, writeOff], { periodStartTs: new Date(2026, 9, 1).getTime(), periodEndTs: new Date(2026, 10, 1).getTime() - 1 });
    assert.equal(october.totals.totalDebtWriteOffs, 100_000);
    assert.equal(october.totals.netDistributableProfit, -100_000);
}

// Dashboard summaries: applying the write-off's delta gives the same numbers as rebuilding
// them from the data. The client paid 98 000 DZD and the last 2 000 DZD are written off.
{
    const payment = clientRow({ id: 'payment', type: 'Règlement Reçu', montant: 98_000, timestamp: SALE_TS + HOUR });
    const smallWriteOff = clientRow({ id: 'small-write-off', type: 'Remise solde', montant: 2_000, timestamp: WRITE_OFF_TS, countsAsLoss: true });
    const treasuryTransactions = [
        { id: 'cash-in', type: 'Ajout', source: 'Caisse', amount: 200_000, date: '01/09/2026', time: '08:00', timestamp: SALE_TS - 2 * HOUR },
        { id: 'buy-cash', type: 'Retrait', source: 'Caisse', amount: 95_000, date: '01/09/2026', time: '09:00', timestamp: SALE_TS - HOUR, linkedTxId: 'buy' },
        { id: 'payment-cash', type: 'Ajout', source: 'Caisse', amount: 98_000, date: '01/09/2026', time: '11:00', timestamp: SALE_TS + HOUR, linkedTxId: 'payment' },
    ] as TreasuryTx[];
    const snapshot = (clientTransactionsDzd: ClientTransactionDzd[]) => buildDashboardReadModelShadowFromLegacy({
        transactions,
        clientsDzd: [{ id: 'client', fullName: 'Client' } as ClientDzd],
        clientTransactionsDzd,
        treasuryTransactions,
        treasuryCards: [],
        manualAssets: [],
        manualAssetClients: [],
        manualAssetTransactions: [],
        digitalServiceTransactions: [],
        investors,
        investorTransactions: [] as InvestorTransaction[],
        managerFeePercentage: 30,
        managerFeeHistory,
        ownerOpeningCapital: 1_000_000,
        preTrackingPersonalExpenses: 0,
        getClientFullName: (client) => client.fullName,
        asOf: WRITE_OFF_TS + HOUR,
        generationId: 'debt-write-off',
    });
    const base = snapshot([creditSale, payment]);
    const rebuilt = snapshot([creditSale, payment, smallWriteOff]);
    const delta = prepareDebtWriteOffReadModelDelta({
        investors,
        investorTransactions: [],
        treasuryTransactions,
        managerFeePercentage: '30',
        managerFeeHistory,
        clientId: 'client',
        txId: 'small-write-off',
        balance: -2_000,
        montant: 2_000,
        timestamp: WRITE_OFF_TS,
    });
    const applied = applyReadModelDelta(base, delta);
    assert.equal(base.clients.totalReceivables, 2_000);
    assert.equal(applied.clients.totalReceivables, rebuilt.clients.totalReceivables);
    assert.equal(rebuilt.clients.totalReceivables, 0);
    assert.equal(rebuilt.investors.globalNetProfit, 3_000);
    assert.equal(applied.investors.globalNetProfit, rebuilt.investors.globalNetProfit);
    assert.equal(applied.investors.externalInvestorProfits, rebuilt.investors.externalInvestorProfits);
    assert.equal(applied.investors.investorLiability, rebuilt.investors.investorLiability);
    assert.equal(applied.investors.managerProfitBreakdown.tradingOwnerProfit, rebuilt.investors.managerProfitBreakdown.tradingOwnerProfit);
    assert.equal(rebuilt.investors.managerProfitBreakdown.tradingOwnerProfit, 3_250 - 1_300);
}

console.log('debtWriteOffs tests passed');
