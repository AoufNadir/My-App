import { Tx, ClientDzd, ClientTransactionDzd } from '../../types';

export type AnalyticsSimMode = 'dzd' | 'eur' | 'sell_dzd';

export type AnalyticsPageProps = {
  statsView: 'usdt' | 'clients';
  setStatsView: (view: 'usdt' | 'clients') => void;
  isDark: boolean;
  setIsSettingsModalOpen: (isOpen: boolean) => void;
  cardBase: string;
  subtleText: string;
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
  selectedHeatmapDay: { day: number; profit: number } | null;
  setSelectedHeatmapDay: (day: { day: number; profit: number } | null) => void;
  simMode: AnalyticsSimMode;
  setSimMode: (mode: AnalyticsSimMode) => void;
  simBuyQty: string;
  setSimBuyQty: (val: string) => void;
  simBuyPrice: string;
  setSimBuyPrice: (val: string) => void;
  fieldBase: string;
  newPamFromDzdSimulator: number | null;
  simEurQty: string;
  setSimEurQty: (val: string) => void;
  simEurDzdPrice: string;
  setSimEurDzdPrice: (val: string) => void;
  simEurUsdtRate: string;
  setSimEurUsdtRate: (val: string) => void;
  newPamFromEurSimulator: number | null;
  handleExportUsdtReport: () => void;
  dzdDashboardStats: any;
  reportClient: string;
  setReportClient: (id: string) => void;
  clientsDzd: ClientDzd[];
  clientTransactionsDzd: ClientTransactionDzd[];
  getClientFullName: (client: ClientDzd) => string;
  reportMonth: number;
  setReportMonth: (month: number) => void;
  reportYear: number;
  setReportYear: (year: number) => void;
  handleExportClientReport: (clientId: string, month: number, year: number) => void;
  simSellUsdtQty?: string;
  setSimSellUsdtQty?: (val: string) => void;
  simSellDzdPrice?: string;
  setSimSellDzdPrice?: (val: string) => void;
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
  realizedProfit: number;
};

export type SimSellResult = {
  profit: number;
  isProfitable: boolean;
} | null;
