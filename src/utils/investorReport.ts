import type { Investor, InvestorTransaction, TreasuryTx, Tx } from '../types';
import { deriveInvestorEconomics, type ManagerFeeHistoryEntry } from '../hooks/useInvestorEconomics';
import type { DebtWriteOff } from './debtWriteOffs';
import { calculateManagerOwnerCapital, isPersonalExpenseCapitalWithdrawal } from './managerCapital';
import { computePamLedger, type PamLedgerResult } from './pamLedger';

// The investor report: what an investor (or the manager) receives about his account over a
// period. The numbers are those of the old printed report (buildInvestorPdfReport in
// pdfReports.ts), computed the same way; investorReport.test.ts compares the two.

/** Both bounds optional: none is the whole history, a start alone runs to today. */
export type InvestorReportDateRange = {
    startTs?: number | null;
    endTs?: number | null;
};

/** What the report is made from: the investor at the report's end, his rows, the bounds. */
export type InvestorReportInput = {
    investor: Investor;
    investorTransactions: InvestorTransaction[];
    personalExpenses?: TreasuryTx[];
    reportStartTs?: number | null;
    reportEndTs?: number | null;
};

/** The app's data the report is computed from (as useReportExports receives it). */
export type InvestorReportSources = {
    derivedInvestors: Investor[];
    investorTransactions: InvestorTransaction[];
    transactions: Tx[];
    managerFeePercentage: string;
    managerFeeHistory?: ManagerFeeHistoryEntry[];
    /** The ledger of every transaction, already computed by the app */
    pamLedger: PamLedgerResult;
    deliveryExpenses?: TreasuryTx[];
    debtWriteOffs?: DebtWriteOff[];
    personalExpenses?: TreasuryTx[];
};

export type PreparedInvestorReport = { ok: true; input: InvestorReportInput } | { ok: false; reason: 'notFound' | 'notFoundAtClose' };

/**
 * The investor as the report shows him: the period's profit from the economics of the period,
 * and capital, available profit and share as they stood at the report's end date.
 */
export function prepareInvestorReportInput({ derivedInvestors, investorTransactions, transactions, managerFeePercentage, managerFeeHistory, pamLedger, deliveryExpenses, debtWriteOffs, personalExpenses }: InvestorReportSources, investorId: string, range: InvestorReportDateRange = {}): PreparedInvestorReport {
    const periodEconomics = deriveInvestorEconomics({
        investors: derivedInvestors,
        investorTransactions,
        transactions,
        managerFeePercentage,
        managerFeeHistory,
        pamLedger,
        periodStartTs: range.startTs,
        periodEndTs: range.endTs,
        deliveryExpenses,
        debtWriteOffs,
        personalExpenses
    });
    const investor = periodEconomics.derivedInvestors.find((item) => item.id === investorId);
    if (!investor)
        return { ok: false, reason: 'notFound' };
    // Period profit is intentionally calculated with the selected range,
    // while balances must represent the investor's complete state at the
    // report end date. Rebuild the closing view from data up to endTs so a
    // reinvestment funded by earlier profit is not mistaken for a loss in
    // the selected period.
    const closingEndTs = range.endTs ?? null;
    const transactionsAtClose = closingEndTs == null
        ? transactions
        : transactions.filter((tx) => Number(tx.timestamp) <= closingEndTs);
    const investorTransactionsAtClose = closingEndTs == null
        ? investorTransactions
        : investorTransactions.filter((tx) => Number(tx.timestamp) <= closingEndTs);
    const deliveryExpensesAtClose = closingEndTs == null
        ? deliveryExpenses
        : (deliveryExpenses || []).filter((tx) => Number(tx.timestamp) <= closingEndTs);
    const debtWriteOffsAtClose = closingEndTs == null
        ? debtWriteOffs
        : (debtWriteOffs || []).filter((row) => row.timestamp <= closingEndTs);
    const personalExpensesAtClose = closingEndTs == null
        ? personalExpenses
        : (personalExpenses || []).filter((tx) => Number(tx.timestamp) <= closingEndTs);
    const closingEconomics = deriveInvestorEconomics({
        investors: derivedInvestors,
        investorTransactions: investorTransactionsAtClose,
        transactions: transactionsAtClose,
        managerFeePercentage,
        managerFeeHistory,
        pamLedger: computePamLedger(transactionsAtClose),
        periodEndTs: closingEndTs,
        deliveryExpenses: deliveryExpensesAtClose,
        debtWriteOffs: debtWriteOffsAtClose,
        personalExpenses: personalExpensesAtClose
    });
    const closingInvestor = closingEconomics.derivedInvestors.find((item) => item.id === investorId);
    if (!closingInvestor)
        return { ok: false, reason: 'notFoundAtClose' };
    const reportInvestor = {
        ...investor,
        capitalInvested: closingInvestor.capitalInvested,
        availableProfit: closingInvestor.availableProfit,
        displayAvailableProfit: closingInvestor.displayAvailableProfit,
        sharePercentage: closingInvestor.sharePercentage,
    };
    return {
        ok: true,
        input: {
            investor: reportInvestor,
            investorTransactions: investorTransactions.filter((tx) => tx.investorId === investorId),
            personalExpenses,
            reportStartTs: range.startTs,
            reportEndTs: range.endTs
        }
    };
}

/** How the investor page names an operation (the manager's rows have their own names). */
export type InvestorReportOperationKind = 'deposit' | 'withdrawCapital' | 'personalExpenseCapital' | 'withdrawProfit' | 'personalExpense' | 'reinvest' | 'retained' | 'distribution';

export type InvestorReportOperation = {
    id: string;
    timestamp: number;
    kind: InvestorReportOperationKind;
    /** Added to the account (+) or taken from it (−), as on the investor page */
    positive: boolean;
    amount: number;
    source: InvestorTransaction['paymentSource'] | null;
    notes: string;
};

export type InvestorReport = {
    investorId: string;
    investorName: string;
    isManager: boolean;
    startTs: number | null;
    endTs: number | null;
    issuedAt: number;
    reference: string;
    /** At the end date */
    capital: number;
    availableProfit: number;
    /** The manager's capital already holds his profit: his estimated value is his capital alone. */
    estimatedValue: number;
    sharePercent: number;
    notes: string;
    /** Over the period */
    periodProfit: number;
    /** Period profit ÷ capital × 100; none without capital */
    yieldPct: number | null;
    deposits: number;
    capitalWithdrawals: number;
    /** Profit reinvested; for the manager, the profit kept in the business */
    reinvested: number;
    /** Profit withdrawn; for the manager, his personal expenses */
    profitOut: number;
    /** Deposits + reinvested (not for the manager) − capital withdrawals */
    netMovement: number;
    /** Newest first */
    operations: InvestorReportOperation[];
};

function operationKind(tx: InvestorTransaction, isManager: boolean, personalExpenses: TreasuryTx[]): { kind: InvestorReportOperationKind; positive: boolean } {
    switch (tx.type) {
        case 'profit_distribution':
            return { kind: 'distribution', positive: true };
        case 'withdraw_profit':
            return { kind: isManager ? 'personalExpense' : 'withdrawProfit', positive: false };
        case 'reinvest_profit':
            return { kind: isManager ? 'retained' : 'reinvest', positive: true };
        case 'deposit_capital':
            return { kind: 'deposit', positive: true };
        default:
            return { kind: isManager && isPersonalExpenseCapitalWithdrawal(tx, personalExpenses) ? 'personalExpenseCapital' : 'withdrawCapital', positive: false };
    }
}

const pad2 = (value: number) => String(value).padStart(2, '0');
const dayStamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}`;
};

/** I-20261001-20261009-AB12: the period (ALL without a start, today without an end), then the investor. */
function investorReportReference(investorId: string, startTs: number | null, endTs: number | null, issuedAt: number): string {
    const code = investorId.replace(/[^A-Za-z0-9]/g, '').slice(-4).toUpperCase() || '0000';
    return `I-${startTs == null ? 'ALL' : dayStamp(startTs)}-${dayStamp(endTs ?? issuedAt)}-${code}`;
}

/** The report's numbers, computed exactly as the old printed report computed them. */
export function buildInvestorReport(input: InvestorReportInput, now: number): InvestorReport {
    const startTs = input.reportStartTs ?? null;
    const endTs = input.reportEndTs ?? null;
    const periodTxs = input.investorTransactions.filter((tx) => {
        if (input.reportStartTs != null && tx.timestamp < input.reportStartTs)
            return false;
        if (input.reportEndTs != null && tx.timestamp > input.reportEndTs)
            return false;
        return true;
    });
    const orderedTxs = [...periodTxs].sort((a, b) => b.timestamp - a.timestamp);
    const isManager = input.investor.isManager === true;
    const personalExpenses = input.personalExpenses || [];
    const managerCapital = isManager
        ? calculateManagerOwnerCapital({
            investor: input.investor,
            investorTransactions: periodTxs,
            personalExpenses,
            periodStartTs: input.reportStartTs,
            periodEndTs: input.reportEndTs,
            profitWithdrawals: Number((input.investor as { profitWithdrawals?: number }).profitWithdrawals || 0),
        })
        : null;
    const deposits = orderedTxs
        .filter((tx) => tx.type === 'deposit_capital')
        .reduce((sum, tx) => sum + tx.amount, 0);
    const capitalWithdrawals = isManager && managerCapital
        ? managerCapital.capitalWithdrawals
        : orderedTxs
            .filter((tx) => tx.type === 'withdraw_capital' && !isPersonalExpenseCapitalWithdrawal(tx, personalExpenses))
            .reduce((sum, tx) => sum + tx.amount, 0);
    const reinvestedProfit = orderedTxs
        .filter((tx) => tx.type === 'reinvest_profit')
        .reduce((sum, tx) => sum + tx.amount, 0);
    const withdrawnProfit = orderedTxs
        .filter((tx) => tx.type === 'withdraw_profit')
        .reduce((sum, tx) => sum + tx.amount, 0);
    const periodProfit = Number(input.investor.totalProfit || 0);
    const availableProfit = Number(input.investor.availableProfit || 0);
    // Closing capital from the caller, built from the whole history up to the report end
    // (managerCapital above only sees the period's rows).
    const capital = Number(input.investor.capitalInvested || 0);
    return {
        investorId: input.investor.id,
        investorName: input.investor.name || '',
        isManager,
        startTs,
        endTs,
        issuedAt: now,
        reference: investorReportReference(input.investor.id, startTs, endTs, now),
        capital,
        availableProfit,
        estimatedValue: isManager ? capital : capital + availableProfit,
        sharePercent: Number(input.investor.sharePercentage || 0) * 100,
        notes: input.investor.notes || '',
        periodProfit,
        yieldPct: capital > 0 ? (periodProfit / capital) * 100 : null,
        deposits,
        capitalWithdrawals,
        reinvested: isManager ? (managerCapital?.retainedProfit || 0) : reinvestedProfit,
        profitOut: isManager ? (managerCapital?.personalExpensesTotal || 0) : withdrawnProfit,
        netMovement: deposits + (isManager ? 0 : reinvestedProfit) - capitalWithdrawals,
        operations: orderedTxs.map((tx) => ({
            id: tx.id,
            timestamp: tx.timestamp,
            ...operationKind(tx, isManager, personalExpenses),
            amount: tx.amount,
            source: tx.paymentSource ?? null,
            notes: tx.notes || '',
        })),
    };
}

const dayKey = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
};

/** The name in Latin letters for a file name (Rostom-El-Hakim); empty for a name in Arabic letters. */
function fileNamePart(name: string): string {
    return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

/** ProDigital_Rostom-El-Hakim_2026-10-01_2026-10-09.pdf (to the issue day without an end, the end alone without a start). */
export function investorReportFileName(report: Pick<InvestorReport, 'investorName' | 'startTs' | 'endTs' | 'issuedAt'>): string {
    const name = fileNamePart(report.investorName);
    const end = dayKey(report.endTs ?? report.issuedAt);
    return `ProDigital_${name ? `${name}_` : ''}${report.startTs == null ? end : `${dayKey(report.startTs)}_${end}`}.pdf`;
}
