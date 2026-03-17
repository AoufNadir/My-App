import { useMemo, useState } from 'react';
import type { ClientDzd, ClientTransactionDzd, Investor, InvestorTransaction, PortfolioStats, Tx } from '../types';

type Translator = (key: string) => unknown;

type UseReportExportsArgs = {
    clientBalances: Map<string, number>;
    clientTransactionsDzd: ClientTransactionDzd[];
    clientsDzd: ClientDzd[];
    derivedInvestors: Investor[];
    getClientFullName: (client: ClientDzd) => string;
    investorTransactions: InvestorTransaction[];
    loadPdfReports: () => Promise<typeof import('../utils/pdfReports')>;
    portfolioStats: PortfolioStats;
    setAlert: (message: string) => void;
    t: Translator;
    transactions: Tx[];
};

function getMonthLabels(t: Translator) {
    const value = t('common.months');
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === 'string');
}

function isMobileDevice() {
    if (typeof window === 'undefined') return false;
    return /android|iphone|ipad|ipod|mobile/i.test(window.navigator.userAgent || '');
}

export function useReportExports({
    clientBalances,
    clientTransactionsDzd,
    clientsDzd,
    derivedInvestors,
    getClientFullName,
    investorTransactions,
    loadPdfReports,
    portfolioStats,
    setAlert,
    t,
    transactions
}: UseReportExportsArgs) {
    const [usdtReportMonth, setUsdtReportMonth] = useState(new Date().getMonth());
    const [usdtReportYear, setUsdtReportYear] = useState(new Date().getFullYear());
    const [reportClient, setReportClient] = useState('');
    const [reportMonth, setReportMonth] = useState(new Date().getMonth());
    const [reportYear, setReportYear] = useState(new Date().getFullYear());

    const reportMonthNames = useMemo(() => getMonthLabels(t), [t]);

    const handleExportClientReport = async (clientId: string, month: number, year: number) => {
        if (!clientId) {
            setAlert('Selectionnez un client.');
            return;
        }

        const monthLabels = getMonthLabels(t);
        const { buildClientPdfReport, openPdfPrintWindow } = await loadPdfReports();
        const report = buildClientPdfReport({
            clientId,
            month,
            year,
            monthLabel: monthLabels[month] || `${month + 1}`,
            clients: clientsDzd,
            clientTransactions: clientTransactionsDzd,
            transactions,
            clientBalance: clientBalances.get(clientId) || 0,
            getClientName: getClientFullName
        });

        if (!report) {
            setAlert('Client introuvable.');
            return;
        }

        const opened = openPdfPrintWindow(report);
        if (!opened) {
            setAlert("Impossible d'ouvrir l'apercu PDF.");
            return;
        }

        setAlert(
            isMobileDevice()
                ? "Rapport client ouvert. Appuyez sur 'Enregistrer PDF' dans la page."
                : "Rapport client pret. Enregistrez en PDF depuis l'impression."
        );
    };

    const handleExportUsdtReport = async () => {
        const monthLabels = getMonthLabels(t);
        const { buildMonthlyPdfReport, openPdfPrintWindow } = await loadPdfReports();
        const report = buildMonthlyPdfReport({
            month: usdtReportMonth,
            year: usdtReportYear,
            monthLabel: monthLabels[usdtReportMonth] || `${usdtReportMonth + 1}`,
            transactions,
            clientTransactions: clientTransactionsDzd,
            clients: clientsDzd,
            getClientName: getClientFullName,
            portfolioStats
        });

        const opened = openPdfPrintWindow(report);
        if (!opened) {
            setAlert("Impossible d'ouvrir l'apercu PDF.");
            return;
        }

        setAlert(
            isMobileDevice()
                ? "Rapport mensuel ouvert. Appuyez sur 'Enregistrer PDF' dans la page."
                : "Rapport mensuel pret. Enregistrez en PDF depuis l'impression."
        );
    };

    const handleExportInvestorReport = async (investorId: string) => {
        const investor = derivedInvestors.find((item) => item.id === investorId);
        if (!investor) {
            setAlert('Investisseur introuvable.');
            return;
        }

        const { buildInvestorPdfReport, openPdfPrintWindow } = await loadPdfReports();
        const report = buildInvestorPdfReport({
            investor,
            investorTransactions: investorTransactions.filter((tx) => tx.investorId === investorId)
        });

        const opened = openPdfPrintWindow(report);
        if (!opened) {
            setAlert("Impossible d'ouvrir l'apercu PDF.");
            return;
        }

        setAlert(
            isMobileDevice()
                ? "Rapport investisseur ouvert. Appuyez sur 'Enregistrer PDF' dans la page."
                : "Rapport investisseur pret. Enregistrez en PDF depuis l'impression."
        );
    };

    return {
        handleExportClientReport,
        handleExportInvestorReport,
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
