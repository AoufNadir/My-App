import type { Investor, InvestorTransaction, TreasuryTx } from '../types';
import { allocateProfitDeltaAtTimestamp, type ManagerFeeHistoryEntry } from '../hooks/useInvestorEconomics';
import { DEBT_WRITE_OFF_TYPE } from '../utils/debtWriteOffs';
import { mustPrepareWriterReadModelDelta } from './preparedWriterDeltas';
import { transitionClientBalanceDelta, type ReadModelDelta } from './readModelDeltas';

/**
 * Read-model delta of a client debt written off with Solder: the debt leaves the client
 * balances and the loss is split like a project expense at the moment of the write-off.
 */
export function prepareDebtWriteOffReadModelDelta(input: {
    investors: Investor[];
    investorTransactions: InvestorTransaction[];
    treasuryTransactions: TreasuryTx[];
    managerFeePercentage: string | number;
    managerFeeHistory?: ManagerFeeHistoryEntry[];
    clientId: string;
    txId: string;
    /** Client balance before the write-off (negative: the client owes us). */
    balance: number;
    /** Amount added back to the client's balance (the debt cleared, positive). */
    montant: number;
    timestamp: number;
}): ReadModelDelta {
    const allocation = allocateProfitDeltaAtTimestamp({
        investors: input.investors,
        investorTransactions: input.investorTransactions,
        treasuryTransactions: input.treasuryTransactions,
        personalExpenses: input.treasuryTransactions.filter((tx) => tx.origin === 'personal_expense'),
        managerFeePercentage: input.managerFeePercentage,
        managerFeeHistory: input.managerFeeHistory,
        projectProfitDzd: -input.montant,
        timestamp: input.timestamp,
    });
    const operationId = `legacy:clients.receivable-write-off:${input.txId}`;
    return mustPrepareWriterReadModelDelta('clients.receivable-write-off', {
        operationId,
        effectiveAt: input.timestamp,
        payload: {
            type: 'client_receivable_write_off',
            clientId: input.clientId,
            txId: input.txId,
            balance: input.balance,
            montant: input.montant,
            allocation,
        },
        affectedSummaries: ['dashboard_summary', 'clients_summary', 'investors_summary', 'financial_summary'],
        clients: transitionClientBalanceDelta(input.balance, 0),
        investors: {
            externalInvestorProfitsDelta: allocation.externalInvestorProfitsDeltaDzd,
            investorLiabilityDelta: allocation.investorLiabilityDeltaDzd,
            managerTradingOwnerProfitDelta: allocation.managerProfitDeltaDzd,
            managerActualOwnerCapitalDelta: allocation.managerProfitDeltaDzd,
            globalNetProfitDelta: allocation.projectProfitDzd,
        },
        dashboardDaily: {
            ownerProfitTodayDelta: allocation.managerProfitDeltaDzd,
            ownerProfitWeekDelta: allocation.managerProfitDeltaDzd,
            ownerProfitMonthDelta: allocation.managerProfitDeltaDzd,
            ownerProfitYearDelta: allocation.managerProfitDeltaDzd,
            ownerProfitAllTimeDelta: allocation.managerProfitDeltaDzd,
        },
        recentOperation: { operationId, source: 'legacy', type: DEBT_WRITE_OFF_TYPE, effectiveAt: input.timestamp },
    });
}
