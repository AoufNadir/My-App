import { PageHeader } from '../components/ui/PageHeader';
import { HeroKpiCard } from '../components/ui/HeroKpiCard';
import { TrendingUpIcon } from '../components/icons/TrendingUpIcon';
import { useLanguage } from '../contexts/LanguageContext';
import { AnalyticsReportCard } from '../components/analytics/AnalyticsReportCard';
import { AnalyticsPageProps } from '../components/analytics/analyticsTypes';
import { useAnalyticsViewModel } from '../components/analytics/useAnalyticsViewModel';

export function AnalyticsPage(props: AnalyticsPageProps) {
    const { t } = useLanguage();
    const { calculatedStats, heatmapData, monthlyClientRanking } = useAnalyticsViewModel({
        transactions: props.transactions,
        usdtReportMonth: props.usdtReportMonth,
        usdtReportYear: props.usdtReportYear,
        clientTransactionsDzd: props.clientTransactionsDzd,
        clientsDzd: props.clientsDzd,
        getClientFullName: props.getClientFullName,
        t: t as (key: string) => string,
    });
    const monthOptions = props.reportMonths(props.usdtReportYear);
    const selectedMonthLabel = monthOptions[props.usdtReportMonth] || `${props.usdtReportMonth + 1}`;
    const analyticsReportCardProps = {
        ...props,
        t,
        calculatedStats,
        monthlyClientRanking,
        heatmapData,
    };

    return (
        <div className="anim-page-in space-y-4">
            <PageHeader
                title={t('nav.analytics') as string}
                subtitle={`${selectedMonthLabel} ${props.usdtReportYear}`}
            />

            <HeroKpiCard
                accent="emerald"
                icon={<TrendingUpIcon className="h-5 w-5" />}
                primaryLabel={t('portfolio.realizedProfit') as string}
                primaryValue={calculatedStats.realizedProfit}
                primaryCurrency="DZD"
                primarySemantic="auto"
                secondary={[
                    { label: t('portfolio.usdtSold') as string, value: calculatedStats.volUsdtSold, currency: 'USDT', semantic: 'plain' },
                    { label: t('portfolio.eurSold') as string, value: calculatedStats.volEurSold, currency: 'EUR', semantic: 'plain' },
                ]}
            />

            <AnalyticsReportCard {...analyticsReportCardProps} />
        </div>
    );
}
