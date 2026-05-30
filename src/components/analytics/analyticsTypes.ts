import { Tx, ClientDzd, ClientTransactionDzd } from '../../types';
export type AnalyticsPageProps = {
    statsView: 'usdt' | 'clients';
    setStatsView: (view: 'usdt' | 'clients') => void;
    setIsSettingsModalOpen: (isOpen: boolean) => void;
    portfolioStats: any;
    totalPortfolioValue: number;
    suggestedProfitMargin: string;
    suggestedSellingPrice?: string;
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
    getClientFullName: (client: ClientDzd) => string;
    reportClient: string;
    setReportClient: (id: string) => void;
    reportMonth: number;
    setReportMonth: (month: number) => void;
    reportYear: number;
    setReportYear: (year: number) => void;
    handleExportUsdtReport: () => void;
    handleExportClientReport: (clientId: string, month: number, year: number) => void;
    openPortfolioBalanceEditModal?: (asset: 'USDT' | 'EUR') => void;
};
export type MonthlyClientRank = {
    clientId: string;
    clientName: string;
    buyVolumeUsdt: number;
    sellVolumeUsdt: number;
    totalVolumeUsdt: number;
    realizedProfit: number;
    txCount: number;
    sellCount: number;
};
export type MonthlyClientRanking = {
    rankedRows: MonthlyClientRank[];
    topTradedClient: MonthlyClientRank | null;
    topProfitableClient: MonthlyClientRank | null;
};
export type CalculatedStats = {
    volUsdtBought: number;
    volUsdtSold: number;
    volEurBought: number;
    volEurSold: number;
    realizedProfit: number;
};
