import type { Investor, InvestorTransaction, TreasuryTx } from '../types';
import { calculateManagerOwnerCapital, isPersonalExpenseCapitalWithdrawal } from './managerCapital';

/**
 * The figures of the investor PDF report, without any HTML (V3-5). They are the figures of
 * `buildInvestorPdfReport` in pdfReports.ts, computed the same way from the same input, so moving
 * the report to the shared sheet changes its look only.
 */

/** As prepared by `prepareInvestorReport` (useReportExports): period profit, closing balances. */
export type InvestorReportInput = {
    /** Period figures (totalProfit) with the closing capital, available profit and share */
    investor: Investor;
    /** This investor's rows, whole history */
    investorTransactions: InvestorTransaction[];
    personalExpenses?: TreasuryTx[];
    reportStartTs?: number | null;
    reportEndTs?: number | null;
};

/** How a row reads, as on the investor page (getTxMeta). */
export type InvestorReportRowKind = 'profitDistribution' | 'withdrawProfit' | 'personalExpense' | 'reinvestProfit' | 'retainedProfit' | 'depositCapital' | 'personalExpenseCapital' | 'withdrawCapital';

export type InvestorReportRow = {
    id: string;
    timestamp: number;
    kind: InvestorReportRowKind;
    /** Signed: + money in for the investor, − money out */
    amount: number;
    source: string | null;
    notes: string | null;
};

export type InvestorReport = {
    isManager: boolean;
    startTs: number | null;
    endTs: number | null;
    /** At the end date */
    capital: number;
    availableProfit: number;
    estimatedValue: number;
    sharePercent: number;
    notes: string | null;
    /** Over the period */
    periodProfit: number;
    /** Period profit ÷ capital × 100; null without capital */
    yieldPercent: number | null;
    movementCount: number;
    capitalAdded: number;
    /** Reinvested profit, or for the manager the profit kept in the project */
    reinvested: number;
    /** Profit withdrawn, or for the manager his personal expenses */
    profitOut: number;
    capitalWithdrawn: number;
    netCapitalMovement: number;
    /** Newest first */
    rows: InvestorReportRow[];
};

function rowKind(tx: InvestorTransaction, isManager: boolean, personalExpenses: TreasuryTx[]): InvestorReportRowKind {
    switch (tx.type) {
        case 'profit_distribution':
            return 'profitDistribution';
        case 'withdraw_profit':
            return isManager ? 'personalExpense' : 'withdrawProfit';
        case 'reinvest_profit':
            return isManager ? 'retainedProfit' : 'reinvestProfit';
        case 'deposit_capital':
            return 'depositCapital';
        default:
            return isManager && isPersonalExpenseCapitalWithdrawal(tx, personalExpenses) ? 'personalExpenseCapital' : 'withdrawCapital';
    }
}
const POSITIVE: ReadonlySet<InvestorReportRowKind> = new Set(['profitDistribution', 'reinvestProfit', 'retainedProfit', 'depositCapital']);

export function buildInvestorReport(input: InvestorReportInput): InvestorReport {
    const personalExpenses = input.personalExpenses || [];
    const startTs = input.reportStartTs ?? null;
    const endTs = input.reportEndTs ?? null;
    const periodTxs = input.investorTransactions.filter((tx) => {
        if (startTs != null && tx.timestamp < startTs)
            return false;
        if (endTs != null && tx.timestamp > endTs)
            return false;
        return true;
    });
    const orderedTxs = [...periodTxs].sort((a, b) => b.timestamp - a.timestamp);
    const isManager = input.investor.isManager === true;
    const managerCapital = isManager
        ? calculateManagerOwnerCapital({
            investor: input.investor,
            investorTransactions: periodTxs,
            personalExpenses,
            periodStartTs: startTs,
            periodEndTs: endTs,
            profitWithdrawals: Number((input.investor as { profitWithdrawals?: number }).profitWithdrawals || 0),
        })
        : null;
    const sumOf = (type: InvestorTransaction['type']) => orderedTxs.filter((tx) => tx.type === type).reduce((sum, tx) => sum + tx.amount, 0);
    const capitalAdded = sumOf('deposit_capital');
    const capitalWithdrawn = isManager && managerCapital
        ? managerCapital.capitalWithdrawals
        : orderedTxs
            .filter((tx) => tx.type === 'withdraw_capital' && !isPersonalExpenseCapitalWithdrawal(tx, personalExpenses))
            .reduce((sum, tx) => sum + tx.amount, 0);
    const reinvestedProfit = sumOf('reinvest_profit');
    const withdrawnProfit = sumOf('withdraw_profit');
    const periodProfit = Number(input.investor.totalProfit || 0);
    const availableProfit = Number(input.investor.availableProfit || 0);
    const capital = Number(input.investor.capitalInvested || 0);
    const sharePercent = Number(input.investor.sharePercentage || 0) * 100;
    return {
        isManager,
        startTs,
        endTs,
        capital,
        availableProfit,
        // The manager's capital already holds his unwithdrawn profit.
        estimatedValue: isManager ? capital : capital + availableProfit,
        sharePercent,
        notes: input.investor.notes ? String(input.investor.notes) : null,
        periodProfit,
        yieldPercent: capital > 0 ? (periodProfit / capital) * 100 : null,
        movementCount: orderedTxs.length,
        capitalAdded,
        reinvested: isManager ? (managerCapital?.retainedProfit || 0) : reinvestedProfit,
        profitOut: isManager ? (managerCapital?.personalExpensesTotal || 0) : withdrawnProfit,
        capitalWithdrawn,
        netCapitalMovement: capitalAdded + (isManager ? 0 : reinvestedProfit) - capitalWithdrawn,
        rows: orderedTxs.map((tx) => {
            const kind = rowKind(tx, isManager, personalExpenses);
            const source = (tx as { paymentSource?: string }).paymentSource;
            return {
                id: tx.id,
                timestamp: tx.timestamp,
                kind,
                amount: (POSITIVE.has(kind) ? 1 : -1) * Math.abs(tx.amount),
                source: source ? String(source) : null,
                notes: tx.notes ? String(tx.notes) : null,
            };
        }),
    };
}
