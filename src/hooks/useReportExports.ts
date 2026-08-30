import { useMemo, useState } from 'react';
import type { ClientDzd, ClientTransactionDzd, Investor, InvestorTransaction, PortfolioStats, TreasuryTx, Tx } from '../types';
import { computePamLedger, type PamLedgerResult } from '../utils/pamLedger';
import { deriveInvestorEconomics, type ManagerFeeHistoryEntry } from './useInvestorEconomics';
type Translator = (key: string) => unknown;
type UseReportExportsArgs = {
    clientBalances: Map<string, number>;
    clientTransactionsDzd: ClientTransactionDzd[];
    clientsDzd: ClientDzd[];
    derivedInvestors: Investor[];
    getClientFullName: (client: ClientDzd) => string;
    investorTransactions: InvestorTransaction[];
    loadPdfReports: () => Promise<typeof import('../utils/pdfReports')>;
    managerFeePercentage: string;
    managerFeeHistory?: ManagerFeeHistoryEntry[];
    pamLedger?: PamLedgerResult;
    portfolioStats: PortfolioStats;
    setAlert: (message: string) => void;
    t: Translator;
    transactions: Tx[];
    deliveryExpenses?: TreasuryTx[];
    personalExpenses?: TreasuryTx[];
};
export type InvestorReportDateRange = {
    startTs?: number | null;
    endTs?: number | null;
};
export type ClientReportDateRange = {
    startTs: number;
    endTs: number;
};
export type ClientReportRequest = number | ClientReportDateRange;
function getMonthLabels(t: Translator) {
    const value = t('common.months');
    if (!Array.isArray(value))
        return [];
    return value.filter((item): item is string => typeof item === 'string');
}
function isMobileDevice() {
    if (typeof window === 'undefined')
        return false;
    return /android|iphone|ipad|ipod|mobile/i.test(window.navigator.userAgent || '');
}
export function useReportExports({ clientBalances, clientTransactionsDzd, clientsDzd, derivedInvestors, getClientFullName, investorTransactions, loadPdfReports, managerFeePercentage, managerFeeHistory, pamLedger: providedPamLedger, portfolioStats, setAlert, t, transactions, deliveryExpenses, personalExpenses }: UseReportExportsArgs) {
    const [usdtReportMonth, setUsdtReportMonth] = useState(new Date().getMonth());
    const [usdtReportYear, setUsdtReportYear] = useState(new Date().getFullYear());
    const [reportClient, setReportClient] = useState('');
    const [reportMonth, setReportMonth] = useState(new Date().getMonth());
    const [reportYear, setReportYear] = useState(new Date().getFullYear());
    const reportMonthNames = useMemo(() => getMonthLabels(t), [t]);
    const reportPamLedger = useMemo(() => providedPamLedger || computePamLedger(transactions), [providedPamLedger, transactions]);
    const handleExportClientReport = async (clientId: string, monthOrRange: ClientReportRequest, year?: number) => {
        if (!clientId) {
            setAlert('⚠️ Sélectionnez un client.');
            return;
        }
        const range: ClientReportDateRange = typeof monthOrRange === 'number'
            ? {
                startTs: new Date(year || new Date().getFullYear(), monthOrRange, 1).getTime(),
                endTs: new Date(year || new Date().getFullYear(), monthOrRange + 1, 0, 23, 59, 59, 999).getTime(),
            }
            : monthOrRange;
        if (!Number.isFinite(range.startTs) || !Number.isFinite(range.endTs) || range.startTs > range.endTs) {
            setAlert('⚠️ La date de début doit être avant la date de fin.');
            return;
        }
        const monthLabels = getMonthLabels(t);
        const month = typeof monthOrRange === 'number' ? monthOrRange : new Date(range.startTs).getMonth();
        const reportYear = typeof monthOrRange === 'number' ? (year || new Date().getFullYear()) : new Date(range.startTs).getFullYear();
        const periodLabel = typeof monthOrRange === 'number'
            ? `${monthLabels[month] || `${month + 1}`} ${reportYear}`
            : `Du ${new Date(range.startTs).toLocaleDateString('fr-FR')} au ${new Date(range.endTs).toLocaleDateString('fr-FR')}`;
        const clientName = clientsDzd.find((client) => client.id === clientId);
        const { buildClientPdfReport, openPdfPrintWindow } = await loadPdfReports();
        const report = buildClientPdfReport({
            clientId,
            reportStartTs: range.startTs,
            reportEndTs: range.endTs,
            periodLabel,
            clients: clientsDzd,
            clientTransactions: clientTransactionsDzd,
            transactions,
            clientBalance: clientBalances.get(clientId) || 0,
            getClientName: getClientFullName
        });
        if (!report) {
            setAlert(clientName ? '⚠️ Aucune opération trouvée pour cette période.' : '⚠️ Client introuvable.');
            return;
        }
        const opened = openPdfPrintWindow(report);
        if (!opened) {
            setAlert("❌ Impossible d’ouvrir l’aperçu PDF.");
            return;
        }
        setAlert(isMobileDevice()
            ? `Relevé client ${clientName ? getClientFullName(clientName) : ''} - ${periodLabel} ouvert. Appuyez sur 'Enregistrer PDF' dans la page.`
            : `Relevé client ${clientName ? getClientFullName(clientName) : ''} - ${periodLabel} prêt. Enregistrez en PDF depuis l'impression.`);
    };
    const handleExportUsdtReport = async () => {
        const monthLabels = getMonthLabels(t);
        const monthLabel = monthLabels[usdtReportMonth] || `${usdtReportMonth + 1}`;
        const { buildMonthlyPdfReport, openPdfPrintWindow } = await loadPdfReports();
        const report = buildMonthlyPdfReport({
            month: usdtReportMonth,
            year: usdtReportYear,
            monthLabel,
            transactions,
            clientTransactions: clientTransactionsDzd,
            clients: clientsDzd,
            getClientName: getClientFullName,
            portfolioStats,
            pamLedger: reportPamLedger
        });
        const opened = openPdfPrintWindow(report);
        if (!opened) {
            setAlert("❌ Impossible d’ouvrir l’aperçu PDF.");
            return;
        }
        setAlert(isMobileDevice()
            ? `Rapport mensuel ${monthLabel} ${usdtReportYear} ouvert. Appuyez sur 'Enregistrer PDF' dans la page.`
            : `Rapport mensuel ${monthLabel} ${usdtReportYear} prêt. Enregistrez en PDF depuis l'impression.`);
    };
    const handleExportInvestorReport = async (investorId: string, range: InvestorReportDateRange = {}) => {
        const periodEconomics = deriveInvestorEconomics({
            investors: derivedInvestors,
            investorTransactions,
            transactions,
            managerFeePercentage,
            managerFeeHistory,
            pamLedger: reportPamLedger,
            periodStartTs: range.startTs,
            periodEndTs: range.endTs,
            deliveryExpenses,
            personalExpenses
        });
        const investor = periodEconomics.derivedInvestors.find((item) => item.id === investorId);
        if (!investor) {
            setAlert('⚠️ Investisseur introuvable.');
            return;
        }
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
            personalExpenses: personalExpensesAtClose
        });
        const closingInvestor = closingEconomics.derivedInvestors.find((item) => item.id === investorId);
        if (!closingInvestor) {
            setAlert('⚠️ Investisseur introuvable à la date de clôture.');
            return;
        }
        const reportInvestor = {
            ...investor,
            capitalInvested: closingInvestor.capitalInvested,
            availableProfit: closingInvestor.availableProfit,
            displayAvailableProfit: closingInvestor.displayAvailableProfit,
            sharePercentage: closingInvestor.sharePercentage,
        };
        const { buildInvestorPdfReport, openPdfPrintWindow } = await loadPdfReports();
        const report = buildInvestorPdfReport({
            investor: reportInvestor,
            investorTransactions: investorTransactions.filter((tx) => tx.investorId === investorId),
            personalExpenses,
            reportStartTs: range.startTs,
            reportEndTs: range.endTs
        });
        const opened = openPdfPrintWindow(report);
        if (!opened) {
            setAlert("❌ Impossible d’ouvrir l’aperçu PDF.");
            return;
        }
        setAlert(isMobileDevice()
            ? "Rapport investisseur ouvert. Appuyez sur 'Enregistrer PDF' dans la page."
            : "Rapport investisseur prêt. Enregistrez en PDF depuis l'impression.");
    };
    const handleExportPersonalExpensesReport = async (periodKey: 'day' | 'week' | 'month' | 'year') => {
        const expenses = personalExpenses || [];
        const { buildPersonalExpensesPdfReport, openPdfPrintWindow } = await loadPdfReports();
        const nowTs = Date.now();
        const d = new Date(nowTs);
        let periodStart: number;
        let periodEnd: number;
        let periodLabel: string;
        if (periodKey === 'day') {
            const sd = new Date(d);
            sd.setHours(0, 0, 0, 0);
            periodStart = sd.getTime();
            const ed = new Date(sd);
            ed.setHours(23, 59, 59, 999);
            periodEnd = ed.getTime();
            periodLabel = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        }
        else if (periodKey === 'week') {
            const sd = new Date(d);
            const dow = sd.getDay();
            const diff = dow === 0 ? -6 : 1 - dow;
            sd.setDate(sd.getDate() + diff);
            sd.setHours(0, 0, 0, 0);
            periodStart = sd.getTime();
            const ed = new Date(sd);
            ed.setDate(ed.getDate() + 6);
            ed.setHours(23, 59, 59, 999);
            periodEnd = ed.getTime();
            periodLabel = `Semaine du ${sd.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;
        }
        else if (periodKey === 'month') {
            const sd = new Date(d.getFullYear(), d.getMonth(), 1);
            periodStart = sd.getTime();
            periodEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
            periodLabel = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        }
        else {
            const sd = new Date(d.getFullYear(), 0, 1);
            periodStart = sd.getTime();
            periodEnd = new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999).getTime();
            periodLabel = String(d.getFullYear());
        }
        const prevStart = (() => {
            const ps = new Date(periodStart);
            if (periodKey === 'day') {
                ps.setDate(ps.getDate() - 1);
                ps.setHours(0, 0, 0, 0);
                return ps.getTime();
            }
            if (periodKey === 'week') {
                ps.setDate(ps.getDate() - 7);
                return ps.getTime();
            }
            if (periodKey === 'month') {
                return new Date(ps.getFullYear(), ps.getMonth() - 1, 1).getTime();
            }
            return new Date(ps.getFullYear() - 1, 0, 1).getTime();
        })();
        const prevEnd = (() => {
            if (periodKey === 'day') {
                const e = new Date(prevStart);
                e.setHours(23, 59, 59, 999);
                return e.getTime();
            }
            if (periodKey === 'week') {
                const e = new Date(prevStart);
                e.setDate(e.getDate() + 6);
                e.setHours(23, 59, 59, 999);
                return e.getTime();
            }
            if (periodKey === 'month') {
                const e = new Date(prevStart);
                return new Date(e.getFullYear(), e.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
            }
            return new Date(new Date(prevStart).getFullYear(), 11, 31, 23, 59, 59, 999).getTime();
        })();
        const netExpense = (tx: TreasuryTx): number => {
            if (tx.origin === 'personal_expense_return')
                return 0;
            if (tx.advanceState === 'settled')
                return Number(tx.settledAmount || 0);
            return Number(tx.amount || 0);
        };
        const previousPeriodTotal = expenses
            .filter((tx) => tx.timestamp >= prevStart && tx.timestamp <= prevEnd && tx.advanceState !== 'pending' && tx.origin !== 'personal_expense_return')
            .reduce((sum, tx) => sum + netExpense(tx), 0);
        const managerInvestor = derivedInvestors.find((inv) => inv.isManager === true);
        const managerProfitAvailable = Number(managerInvestor?.availableProfit || 0);
        const report = buildPersonalExpensesPdfReport({
            expenses,
            periodLabel,
            periodKey,
            periodStart,
            periodEnd,
            previousPeriodTotal,
            managerProfitAvailable
        });
        const opened = openPdfPrintWindow(report);
        if (!opened) {
            setAlert("❌ Impossible d’ouvrir l’aperçu PDF.");
            return;
        }
        setAlert(isMobileDevice()
            ? "Rapport dépenses ouvert. Appuyez sur 'Enregistrer PDF' dans la page."
            : "Rapport dépenses prêt. Enregistrez en PDF depuis l'impression.");
    };
    return {
        handleExportClientReport,
        handleExportInvestorReport,
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
