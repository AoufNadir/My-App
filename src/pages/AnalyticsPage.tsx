import { motion } from 'framer-motion';
import { useLanguage } from '../contexts/LanguageContext';
import { AnalyticsReportCard } from '../components/analytics/AnalyticsReportCard';
import { AnalyticsPageProps } from '../components/analytics/analyticsTypes';
import { useAnalyticsViewModel } from '../components/analytics/useAnalyticsViewModel';

export function AnalyticsPage(props: AnalyticsPageProps) {
  const { t } = useLanguage();

  const { calculatedStats, heatmapData, simSellResult, monthlyClientRanking } = useAnalyticsViewModel({
    transactions: props.transactions,
    usdtReportMonth: props.usdtReportMonth,
    usdtReportYear: props.usdtReportYear,
    simMode: props.simMode,
    simSellUsdtQty: props.simSellUsdtQty,
    simSellDzdPrice: props.simSellDzdPrice,
    parseAndEvaluate: props.parseAndEvaluate,
    portfolioUsdtAvgBuy: props.portfolioStats.usdt.avgBuy,
    clientTransactionsDzd: props.clientTransactionsDzd,
    clientsDzd: props.clientsDzd,
    getClientFullName: props.getClientFullName,
    t: t as (key: string) => string
  });

  const analyticsReportCardProps = {
    ...props,
    t,
    calculatedStats,
    monthlyClientRanking,
    heatmapData,
    simSellResult
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="space-y-4">
        <AnalyticsReportCard {...analyticsReportCardProps} />
      </div>
    </motion.div>
  );
}
