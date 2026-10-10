import { useCallback, useMemo, useState } from 'react';
import type { ClientDzd, ClientTransactionDzd, Investor, InvestorTransaction, PortfolioStats, TreasuryTx, Tx } from '../types';
import type { ExpensesPeriodKey } from '../utils/expensesReport';
import type { MonthlyReportInput } from '../utils/monthlyReport';
import { computePamLedger, type PamLedgerResult } from '../utils/pamLedger';
import type { ManagerFeeHistoryEntry } from './useInvestorEconomics';
import type { DebtWriteOff } from '../utils/debtWriteOffs';
import { prepareInvestorReportInput, type InvestorReportDateRange, type PreparedInvestorReport } from '../utils/investorReport';
type Translator = (key: string) => unknown;
type UseReportExportsArgs = {
    clientTransactionsDzd: ClientTransactionDzd[];
    clientsDzd: ClientDzd[];
    derivedInvestors: Investor[];
    getClientFullName: (client: ClientDzd) => string;
    investorTransactions: InvestorTransaction[];
    managerFeePercentage: string;
    managerFeeHistory?: ManagerFeeHistoryEntry[];
    pamLedger?: PamLedgerResult;
    portfolioStats: PortfolioStats;
    t: Translator;
    transactions: Tx[];
    deliveryExpenses?: TreasuryTx[];
    debtWriteOffs?: DebtWriteOff[];
    personalExpenses?: TreasuryTx[];
};
export type { InvestorReportDateRange };
/** The report window to show: what it reports on is fixed when the user asks for it. */
export type ReportWindowRequest =
    | { kind: 'monthly'; input: MonthlyReportInput }
    | { kind: 'expenses'; periodKey: ExpensesPeriodKey; expenses: TreasuryTx[]; managerProfitAvailable: number };
function getMonthLabels(t: Translator) {
    const value = t('common.months');
    if (!Array.isArray(value))
        return [];
    return value.filter((item): item is string => typeof item === 'string');
}
export function useReportExports({ clientTransactionsDzd, clientsDzd, derivedInvestors, getClientFullName, investorTransactions, managerFeePercentage, managerFeeHistory, pamLedger: providedPamLedger, portfolioStats, t, transactions, deliveryExpenses, debtWriteOffs, personalExpenses }: UseReportExportsArgs) {
    const [reportWindow, setReportWindow] = useState<ReportWindowRequest | null>(null);
    const [usdtReportMonth, setUsdtReportMonth] = useState(new Date().getMonth());
    const [usdtReportYear, setUsdtReportYear] = useState(new Date().getFullYear());
    const [reportClient, setReportClient] = useState('');
    const [reportMonth, setReportMonth] = useState(new Date().getMonth());
    const [reportYear, setReportYear] = useState(new Date().getFullYear());
    const reportMonthNames = useMemo(() => getMonthLabels(t), [t]);
    const reportPamLedger = useMemo(() => providedPamLedger || computePamLedger(transactions), [providedPamLedger, transactions]);
    /** Opens the monthly report window for the month chosen on the Analyse page. */
    const handleExportUsdtReport = () => {
        setReportWindow({
            kind: 'monthly',
            input: {
                month: usdtReportMonth,
                year: usdtReportYear,
                transactions,
                clientTransactions: clientTransactionsDzd,
                clients: clientsDzd,
                getClientName: getClientFullName,
                portfolioStats,
                pamLedger: reportPamLedger
            }
        });
    };
    /**
     * The investor report's numbers for one investor and period, for the report window (which
     * shows them and makes the PDF). Recomputed for each period the window asks for, and when the
     * data changes while it is open.
     */
    const prepareInvestorReport = useCallback((investorId: string, range: InvestorReportDateRange = {}): PreparedInvestorReport => prepareInvestorReportInput({
        derivedInvestors,
        investorTransactions,
        transactions,
        managerFeePercentage,
        managerFeeHistory,
        pamLedger: reportPamLedger,
        deliveryExpenses,
        debtWriteOffs,
        personalExpenses
    }, investorId, range), [derivedInvestors, investorTransactions, transactions, managerFeePercentage, managerFeeHistory, reportPamLedger, deliveryExpenses, debtWriteOffs, personalExpenses]);
    /** Opens the personal-expenses report window for the day, week, month or year that holds today. */
    const handleExportPersonalExpensesReport = (periodKey: ExpensesPeriodKey) => {
        const managerInvestor = derivedInvestors.find((inv) => inv.isManager === true);
        setReportWindow({
            kind: 'expenses',
            periodKey,
            expenses: personalExpenses || [],
            managerProfitAvailable: Number(managerInvestor?.availableProfit || 0)
        });
    };
    const closeReportWindow = useCallback(() => setReportWindow(null), []);
    return {
        prepareInvestorReport,
        reportWindow,
        closeReportWindow,
        handleExportPersonalExpensesReport,
        handleExportUsdtReport,
        reportClient,
        reportMonth,
        reportMonthNames,
        reportYear,
        setReportClient,
        setReportMonth,
        setReportYear,
        setUsdtReportMonth,
        setUsdtReportYear,
        usdtReportMonth,
        usdtReportYear
    };
}
