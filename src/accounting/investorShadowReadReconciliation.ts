import type { Investor, InvestorTransaction, TreasuryTx, Tx } from '../types';
import { getManagerFeeAt, type ManagerFeeHistoryEntry } from '../hooks/useInvestorEconomics';
import { computePamLedger } from '../utils/pamLedger';
import { buildInvestorCapitalReconciliation, calculateManagerOwnerCapital, calculateTotalPersonalExpenses, isPersonalExpenseCapitalWithdrawal, isSyntheticInitialCapitalDeposit } from '../utils/managerCapital';
import { fromCents, toCents } from '../utils/money';
import { buildInvestorShadowDraft, createInvestorProfitAllocationSnapshot } from './investorShadow';
import type { ProfitAllocationSnapshot } from './types';

type LegacyInvestorProjection = Pick<Investor,
    'id' | 'capitalInvested' | 'totalProfit' | 'availableProfit' | 'isManager'> & {
        reinvestedProfit?: number;
        totalPersonalExpenses?: number;
        profitWithdrawals?: number;
    };

export type InvestorReadReconciliationMetric = {
    legacyDzd: number;
    shadowDzd: number;
    differenceDzd: number;
};

export type InvestorAllocationSnapshotRow = {
    source: 'sale' | 'delivery_expense';
    sourceId: string;
    effectiveAt: number;
    snapshot: ProfitAllocationSnapshot;
};

export type InvestorReadReconciliationRow = {
    investorId: string;
    legacyCapitalDzd: number;
    shadowCapitalDzd: number;
    capitalDifferenceDzd: number;
    legacyTotalProfitDzd: number;
    shadowTotalProfitDzd: number;
    totalProfitDifferenceDzd: number;
    legacyAvailableProfitDzd: number;
    shadowAvailableProfitDzd: number;
    availableProfitDifferenceDzd: number;
    legacyReinvestedProfitDzd: number;
    shadowReinvestedProfitDzd: number;
    reinvestedProfitDifferenceDzd: number;
    legacyPersonalExpensesDzd: number;
    shadowPersonalExpensesDzd: number;
    personalExpensesDifferenceDzd: number;
    legacyManagerShareDzd: number;
    shadowManagerShareDzd: number;
    managerShareDifferenceDzd: number;
};

export type InvestorReadReconciliation = {
    investorCount: number;
    allocationEventCount: number;
    snapshots: InvestorAllocationSnapshotRow[];
    rows: InvestorReadReconciliationRow[];
    totals: {
        capital: InvestorReadReconciliationMetric;
        totalProfit: InvestorReadReconciliationMetric;
        availableProfit: InvestorReadReconciliationMetric;
        reinvestedProfit: InvestorReadReconciliationMetric;
        personalExpenses: InvestorReadReconciliationMetric;
        managerShare: InvestorReadReconciliationMetric;
    };
    errors: string[];
    ok: boolean;
};

const money = (value: number) => fromCents(toCents(value));

function toMs(value: unknown, fallback = 0): number {
    if (typeof value === 'number') return value;
    if (value && typeof (value as { toMillis?: () => number }).toMillis === 'function') return (value as { toMillis: () => number }).toMillis();
    const parsed = new Date(String(value || '')).getTime();
    return Number.isFinite(parsed) ? parsed : fallback;
}

function historicalCapitalAt(investor: Investor, rows: InvestorTransaction[], personalExpenses: TreasuryTx[], effectiveAt: number): number {
    const opening = buildInvestorCapitalReconciliation(investor, rows, personalExpenses).openingCapital;
    return [...rows]
        .filter((row) => toMs(row.timestamp) <= effectiveAt)
        .filter((row) => !isSyntheticInitialCapitalDeposit(row, investor))
        .filter((row) => !isPersonalExpenseCapitalWithdrawal(row, personalExpenses))
        .reduce((capital, row) => {
            if (row.type === 'deposit_capital' || row.type === 'reinvest_profit') return money(capital + Number(row.amount || 0));
            if (row.type === 'withdraw_capital') return money(capital - Number(row.amount || 0));
            return capital;
        }, opening);
}

type ProfitMovementKind = 'personal_expense' | 'profit_withdrawal' | 'ignored';

function classifyProfitMovement(row: InvestorTransaction, treasuryById: Map<string, TreasuryTx>): ProfitMovementKind {
    if (row.origin === 'personal_expense') return 'personal_expense';
    if (row.origin === 'profit_withdrawal') return 'profit_withdrawal';
    const linkedTreasury = row.linkedTreasuryTxId ? treasuryById.get(row.linkedTreasuryTxId) : undefined;
    if (linkedTreasury?.origin === 'personal_expense') return 'personal_expense';
    if (linkedTreasury?.origin === 'investor_profit_withdrawal') return 'profit_withdrawal';
    const notes = String(row.notes || '').toLocaleLowerCase();
    return notes.includes('dépense perso') || notes.includes('depense perso') || notes.includes('avance perso')
        || notes.includes('dépense personnelle') || notes.includes('depense personnelle')
        ? 'personal_expense'
        : 'ignored';
}

function metric(legacyDzd: number, shadowDzd: number): InvestorReadReconciliationMetric {
    const normalizedLegacy = money(legacyDzd);
    const normalizedShadow = money(shadowDzd);
    return { legacyDzd: normalizedLegacy, shadowDzd: normalizedShadow, differenceDzd: money(normalizedLegacy - normalizedShadow) };
}

function totalMetric(rows: InvestorReadReconciliationRow[], key: keyof Pick<InvestorReadReconciliationRow,
    'legacyCapitalDzd' | 'legacyTotalProfitDzd' | 'legacyAvailableProfitDzd' | 'legacyReinvestedProfitDzd' | 'legacyPersonalExpensesDzd' | 'legacyManagerShareDzd'>,
    shadowKey: keyof Pick<InvestorReadReconciliationRow,
        'shadowCapitalDzd' | 'shadowTotalProfitDzd' | 'shadowAvailableProfitDzd' | 'shadowReinvestedProfitDzd' | 'shadowPersonalExpensesDzd' | 'shadowManagerShareDzd'>,
): InvestorReadReconciliationMetric {
    return metric(
        rows.reduce((sum, row) => money(sum + Number(row[key] || 0)), 0),
        rows.reduce((sum, row) => money(sum + Number(row[shadowKey] || 0)), 0),
    );
}

function appendSnapshot(args: {
    source: InvestorAllocationSnapshotRow['source'];
    sourceId: string;
    effectiveAt: number;
    projectProfitDzd: number;
    manager: Investor;
    investors: Investor[];
    transactionsByInvestor: Map<string, InvestorTransaction[]>;
    personalExpenses: TreasuryTx[];
    managerFeeHistory: ManagerFeeHistoryEntry[];
    snapshots: InvestorAllocationSnapshotRow[];
    profits: Map<string, number>;
    errors: string[];
}): void {
    const eligibleInvestorCapital = args.investors
        .filter((investor) => toMs(investor.entryDate, Number.MAX_SAFE_INTEGER) <= args.effectiveAt)
        .map((investor) => ({
            investorId: investor.id,
            capitalDzd: Math.max(0, historicalCapitalAt(investor, args.transactionsByInvestor.get(investor.id) || [], args.personalExpenses, args.effectiveAt)),
            isManager: investor.isManager === true,
        }))
        .filter((entry) => toCents(entry.capitalDzd) > 0);
    try {
        const snapshot = createInvestorProfitAllocationSnapshot({
            operationId: `shadow:investor-allocation:${args.source}:${args.sourceId}`,
            actorUid: 'shadow-read',
            effectiveAt: args.effectiveAt,
            kind: 'profit_allocation',
            projectProfitDzd: money(args.projectProfitDzd),
            managerId: args.manager.id,
            managerFeePercentage: getManagerFeeAt(args.effectiveAt, args.managerFeeHistory),
            eligibleInvestorCapital,
        });
        const draft = buildInvestorShadowDraft({
            operationId: `shadow:investor-allocation:${args.source}:${args.sourceId}`,
            actorUid: 'shadow-read',
            effectiveAt: args.effectiveAt,
            kind: 'profit_allocation',
            projectProfitDzd: money(args.projectProfitDzd),
            managerId: args.manager.id,
            managerFeePercentage: snapshot.managerFeePercentage,
            eligibleInvestorCapital,
        });
        if (draft.postings.length < 2) throw new Error('Allocation draft has no counterpart.');
        args.snapshots.push({ source: args.source, sourceId: args.sourceId, effectiveAt: args.effectiveAt, snapshot });
        args.profits.set(args.manager.id, money((args.profits.get(args.manager.id) || 0) + snapshot.managerFeeDzd + snapshot.managerCapitalDzd));
        snapshot.externalInvestorShares.forEach((share) => args.profits.set(share.investorId, money((args.profits.get(share.investorId) || 0) + share.amountDzd)));
    }
    catch (error) {
        args.errors.push(`${args.source}:${args.sourceId}: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Read-only historical reconciliation using data already loaded by the app.
 * It deliberately creates no accounting operation and imports no Firebase API.
 */
export function reconcileLegacyInvestorsToShadow(input: {
    investors: Investor[];
    investorTransactions: InvestorTransaction[];
    transactions: Tx[];
    deliveryExpenses: TreasuryTx[];
    treasuryTransactions: TreasuryTx[];
    personalExpenses?: TreasuryTx[];
    managerFeeHistory: ManagerFeeHistoryEntry[];
    legacyDerivedInvestors: LegacyInvestorProjection[];
    legacyManagerShareDzd: number;
}): InvestorReadReconciliation {
    // Historical entitlement remains attached to an archived investor. Archive
    // status only changes UI/lifecycle; it cannot erase an earlier allocation.
    const activeInvestors = input.investors;
    const manager = activeInvestors.find((investor) => investor.isManager === true);
    const errors: string[] = [];
    if (!manager) errors.push('No active manager is configured for historical allocation.');
    const transactionsByInvestor = new Map<string, InvestorTransaction[]>();
    input.investorTransactions.forEach((row) => {
        const current = transactionsByInvestor.get(row.investorId) || [];
        current.push(row);
        transactionsByInvestor.set(row.investorId, current);
    });
    const personalExpenses = input.personalExpenses || [];
    const treasuryById = new Map(input.treasuryTransactions.map((row) => [row.id, row]));
    const snapshots: InvestorAllocationSnapshotRow[] = [];
    const profits = new Map(activeInvestors.map((investor) => [investor.id, 0]));
    if (manager) {
        const sales = computePamLedger(input.transactions).sellProfitRows
            .filter((row) => Number.isFinite(row.derivedProfit))
            .sort((left, right) => left.timestamp - right.timestamp);
        sales.forEach((sale) => appendSnapshot({
            source: 'sale',
            sourceId: sale.txId,
            effectiveAt: sale.timestamp,
            projectProfitDzd: sale.derivedProfit,
            manager,
            investors: activeInvestors,
            transactionsByInvestor,
            personalExpenses,
            managerFeeHistory: input.managerFeeHistory,
            snapshots,
            profits,
            errors,
        }));
        input.deliveryExpenses
            .filter((expense) => expense.origin === 'delivery_expense')
            .map((expense) => ({ expense, amount: Number(expense.amountDzd ?? expense.amount ?? 0), effectiveAt: toMs(expense.timestamp) }))
            .filter((row) => Number.isFinite(row.amount) && row.amount > 0)
            .sort((left, right) => left.effectiveAt - right.effectiveAt)
            .forEach(({ expense, amount, effectiveAt }) => appendSnapshot({
                source: 'delivery_expense',
                sourceId: expense.id,
                effectiveAt,
                projectProfitDzd: -amount,
                manager,
                investors: activeInvestors,
                transactionsByInvestor,
                personalExpenses,
                managerFeeHistory: input.managerFeeHistory,
                snapshots,
                profits,
                errors,
            }));
    }
    const legacyById = new Map(input.legacyDerivedInvestors.map((investor) => [investor.id, investor]));
    const rows = activeInvestors.map((investor) => {
        const legacy = legacyById.get(investor.id);
        const investorRows = transactionsByInvestor.get(investor.id) || [];
        const legacyCapitalDzd = Number(legacy?.capitalInvested || 0);
        const shadowTotalProfitDzd = money(profits.get(investor.id) || 0);
        const legacyTotalProfitDzd = Number(legacy?.totalProfit || 0);
        const reinvestedFromRows = investorRows
            .filter((row) => row.type === 'reinvest_profit')
            .reduce((sum, row) => money(sum + Number(row.amount || 0)), 0);
        const shadowReinvestedProfitDzd = investor.isManager ? 0 : reinvestedFromRows;
        const shadowPersonalExpensesDzd = investor.isManager
            ? calculateTotalPersonalExpenses(personalExpenses)
            : 0;
        const shadowProfitWithdrawalsDzd = investorRows
            .filter((row) => row.type === 'withdraw_profit')
            .filter((row) => !investor.isManager || classifyProfitMovement(row, treasuryById) === 'profit_withdrawal')
            .reduce((sum, row) => money(sum + Number(row.amount || 0)), 0);
        const shadowAvailableProfitDzd = money(shadowTotalProfitDzd - shadowProfitWithdrawalsDzd - shadowPersonalExpensesDzd - shadowReinvestedProfitDzd);
        const baseCapital = buildInvestorCapitalReconciliation(investor, investorRows, personalExpenses).currentCapital;
        const shadowCapitalDzd = investor.isManager
            ? calculateManagerOwnerCapital({
                investor: { ...investor, totalProfit: shadowTotalProfitDzd },
                investorTransactions: investorRows,
                personalExpenses,
            }).ownerCapital
            : baseCapital;
        const legacyReinvestedProfitDzd = Number(legacy?.reinvestedProfit || 0);
        const legacyPersonalExpensesDzd = Number(legacy?.totalPersonalExpenses || 0);
        const legacyAvailableProfitDzd = Number(legacy?.availableProfit || 0);
        const legacyManagerShareDzd = investor.id === manager?.id ? Number(input.legacyManagerShareDzd || 0) : 0;
        const shadowManagerShareDzd = investor.id === manager?.id ? shadowTotalProfitDzd : 0;
        return {
            investorId: investor.id,
            legacyCapitalDzd,
            shadowCapitalDzd,
            capitalDifferenceDzd: money(legacyCapitalDzd - shadowCapitalDzd),
            legacyTotalProfitDzd,
            shadowTotalProfitDzd,
            totalProfitDifferenceDzd: money(legacyTotalProfitDzd - shadowTotalProfitDzd),
            legacyAvailableProfitDzd,
            shadowAvailableProfitDzd,
            availableProfitDifferenceDzd: money(legacyAvailableProfitDzd - shadowAvailableProfitDzd),
            legacyReinvestedProfitDzd,
            shadowReinvestedProfitDzd,
            reinvestedProfitDifferenceDzd: money(legacyReinvestedProfitDzd - shadowReinvestedProfitDzd),
            legacyPersonalExpensesDzd,
            shadowPersonalExpensesDzd,
            personalExpensesDifferenceDzd: money(legacyPersonalExpensesDzd - shadowPersonalExpensesDzd),
            legacyManagerShareDzd,
            shadowManagerShareDzd,
            managerShareDifferenceDzd: money(legacyManagerShareDzd - shadowManagerShareDzd),
        };
    });
    const totals = {
        capital: totalMetric(rows, 'legacyCapitalDzd', 'shadowCapitalDzd'),
        totalProfit: totalMetric(rows, 'legacyTotalProfitDzd', 'shadowTotalProfitDzd'),
        availableProfit: totalMetric(rows, 'legacyAvailableProfitDzd', 'shadowAvailableProfitDzd'),
        reinvestedProfit: totalMetric(rows, 'legacyReinvestedProfitDzd', 'shadowReinvestedProfitDzd'),
        personalExpenses: totalMetric(rows, 'legacyPersonalExpensesDzd', 'shadowPersonalExpensesDzd'),
        managerShare: totalMetric(rows, 'legacyManagerShareDzd', 'shadowManagerShareDzd'),
    };
    const ok = errors.length === 0 && Object.values(totals).every((entry) => Math.abs(toCents(entry.differenceDzd)) <= 1);
    return { investorCount: activeInvestors.length, allocationEventCount: snapshots.length, snapshots, rows, totals, errors, ok };
}
