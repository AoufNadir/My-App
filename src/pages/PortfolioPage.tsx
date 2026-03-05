import React from 'react';
import { motion } from 'framer-motion';
import { Card } from '../components/ui/Card';
import { UnifiedTitle } from '../components/ui/UnifiedTitle';
import { BriefcaseIcon } from '../components/icons/BriefcaseIcon';
import { useLanguage } from '../contexts/LanguageContext';
import { Tx, ClientDzd, ClientTransactionDzd } from '../types';
import { PortfolioStatCard } from '../components/portfolio/PortfolioStatCard';

type PortfolioPageProps = {
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
  selectedHeatmapDay: { day: number; profit: number; } | null;
  setSelectedHeatmapDay: (day: { day: number; profit: number; } | null) => void;
  simMode: 'dzd' | 'eur' | 'sell_dzd';
  setSimMode: (mode: 'dzd' | 'eur' | 'sell_dzd') => void;
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

export function PortfolioPage(props: PortfolioPageProps) {
  const {
    isDark,
    setIsSettingsModalOpen,
    cardBase,
    subtleText,
    portfolioStats,
    suggestedProfitMargin,
    suggestedSellingPrice,
    parseAndEvaluate,
    openPortfolioBalanceEditModal
  } = props;

  const { t } = useLanguage();
  const normalizeNearZero = (value: number) => (Object.is(value, -0) || Math.abs(value) < 0.005 ? 0 : value);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="space-y-4">
        <Card className={`${cardBase} p-4 sm:p-6`}>
          <UnifiedTitle
            as="h2"
            isDark={isDark}
            variant="section"
            className="mb-4"
            icon={<BriefcaseIcon className="w-4 h-4" />}
          >
            {t('portfolio.currentStatus')}
          </UnifiedTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <PortfolioStatCard isDark={isDark} subtleText={subtleText} title={t('portfolio.netProfitLoss')} value={portfolioStats.usdt.totalProfit.toFixed(2)} currency="DZD" colorClass={portfolioStats.usdt.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'} />
            <PortfolioStatCard
              isDark={isDark}
              subtleText={subtleText}
              title={t('portfolio.currentBalanceEur')}
              value={normalizeNearZero(portfolioStats.eur.available).toFixed(2)}
              currency="EUR"
              colorClass="text-amber-400"
              onEdit={openPortfolioBalanceEditModal ? () => openPortfolioBalanceEditModal('EUR') : undefined}
            />
            <PortfolioStatCard isDark={isDark} subtleText={subtleText} title={t('portfolio.avgBuyPriceEur')} value={portfolioStats.eur.avgBuy.toFixed(2)} currency="DZD" colorClass="text-gray-300" />
            <PortfolioStatCard
              isDark={isDark}
              subtleText={subtleText}
              title={t('portfolio.currentBalanceUsdt')}
              value={normalizeNearZero(portfolioStats.usdt.available).toFixed(2)}
              currency="USDT"
              colorClass="text-sky-400"
              onEdit={openPortfolioBalanceEditModal ? () => openPortfolioBalanceEditModal('USDT') : undefined}
            />
            <PortfolioStatCard isDark={isDark} subtleText={subtleText} title={t('portfolio.avgBuyPriceUsdt')} value={portfolioStats.usdt.avgBuy.toFixed(2)} currency="DZD" colorClass="text-gray-300" />
            <PortfolioStatCard
              isDark={isDark}
              subtleText={subtleText}
              title={t('portfolio.suggestedSellPrice')}
              value={suggestedSellingPrice && parseFloat(suggestedSellingPrice) > 0
                ? parseFloat(suggestedSellingPrice).toFixed(2)
                : (portfolioStats.usdt.avgBuy + parseAndEvaluate(suggestedProfitMargin)).toFixed(2)
              }
              currency="DZD"
              colorClass="text-yellow-400"
              className={`${isDark ? 'hover:border-yellow-500/50' : 'hover:border-yellow-400/50'} hover:scale-[1.02]`}
              onEdit={() => setIsSettingsModalOpen(true)}
            >
              <div className={`text-xs mt-2 ${subtleText}`}>
                {t('portfolio.margin')}: {suggestedSellingPrice && parseFloat(suggestedSellingPrice) > 0
                  ? (parseFloat(suggestedSellingPrice) - portfolioStats.usdt.avgBuy).toFixed(2)
                  : suggestedProfitMargin
                } DA
              </div>
            </PortfolioStatCard>
          </div>
        </Card>
      </div>
    </motion.div>
  );
}
