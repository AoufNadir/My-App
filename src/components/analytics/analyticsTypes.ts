import { Tx, ClientDzd, ClientTransactionDzd } from '../../types';
export type AnalyticsPageProps = {
    statsView: 'usdt' | 'clients';
    setStatsView: (view: 'usdt' | 'clients') => void;
    setIsSettingsModalOpen: (isOpen: boolean) => void;
    portfolioStats: any;
    totalPortfolioValue: number;
    parseAndEvaluate: (expr: string) => number;
    usdtReportMonth: number;
    setUsdtReportMonth: (month: number) => void;
    usdtReportYear: number;
    setUsdtReportYear: (year: number) => void;
    reportMonths: (year: number) => string[];
    reportYears: number[];
    monthlyStats: any;
    transactions: Tx[];
    selectedHeatmapDay: {
        day: number;
        profit: number;
    } | null;
    setSelectedHeatmapDay: (day: {
        day: number;
        profit: number;
    } | null) => void;
    dzdDashboardStats: any;
    clientsDzd: ClientDzd[];
    clientTransactionsDzd: ClientTransactionDzd[];
    /** The client rows as the client reports read them (adjustment payments carry their channel) */
    reportClientRows?: ClientTransactionDzd[];
    getClientFullName: (client: ClientDzd) => string;
    reportClient: string;
    setReportClient: (id: string) => void;
    reportMonth: number;
    setReportMonth: (month: number) => void;
    reportYear: number;
    setReportYear: (year: number) => void;
    handleExportUsdtReport: () => void;
    openPortfolioBalanceEditModal?: (asset: 'USDT' | 'EUR') => void;
};
