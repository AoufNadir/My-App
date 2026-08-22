import { Card, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { CurrencyAmount } from '../financial/CurrencyAmount';
import { TrendingUpIcon } from '../icons/TrendingUpIcon';
import { Investor } from '../../types';
import { formatNumber } from '../../pages/shared/pageFormat';
import { useLanguage } from '../../contexts/LanguageContext';
type DashboardStats = {
    totalValue: number;
    profitPercentage: number;
    diffDays: number;
    currentTotalProfit: number;
};
type InvestorDashboardStatsGridProps = {
    investor: Investor;
    stats: DashboardStats;
};
export function InvestorDashboardStatsGrid({ investor, stats }: InvestorDashboardStatsGridProps) {
    const { t } = useLanguage();
    const profitPercentSign = stats.profitPercentage >= 0 ? '+' : '';
    return (<div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
      <Card className="border border-border bg-surface shadow-sm">
        <CardContent className="p-4">
          <p className="text-[11px] font-semibold uppercase text-neutral-500">{investor.isManager ? t('investors.managerOwnedCapital') : t('investors.capitalInvested')}</p>
          <p className="mt-1"><CurrencyAmount value={investor.capitalInvested} currency="DZD" size="lg" decimals={0}/></p>
          <div className="mt-2 flex items-center gap-1 text-xs">
            <Badge variant={investor.isActive ? 'success' : 'neutral'} size="sm">{investor.isActive ? t('investors.active') : t('investors.inactive')}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="relative overflow-hidden border border-border bg-surface shadow-sm">
        <CardContent className="p-4">
          <p className="text-[11px] font-semibold uppercase text-neutral-500">{t('investorDashboard.currentValueEstimate')}</p>
          <p className="mt-1"><CurrencyAmount value={stats.totalValue} currency="DZD" semantic="neutral" size="lg" decimals={0}/></p>
          <p className="mt-2 text-xs text-neutral-400">{t('investorDashboard.capitalPlusUnpaidProfits')}</p>
        </CardContent>
      </Card>

      <Card className="border border-border bg-surface shadow-sm">
        <CardContent className="p-4">
          <p className="text-[11px] font-semibold uppercase text-neutral-500">{t('investorDashboard.totalNetProfit')}</p>
          <p className="mt-1"><CurrencyAmount value={stats.currentTotalProfit} currency="DZD" semantic="auto" size="lg" showSign decimals={0}/></p>
          <div className={`mt-2 flex items-center gap-1 text-xs ${stats.profitPercentage >= 0 ? 'text-financial-profit' : 'text-financial-loss'}`}>
            <TrendingUpIcon className="w-3 h-3"/>
            <span dir="ltr" className="font-medium">{profitPercentSign}{formatNumber(stats.profitPercentage, { min: 2, max: 2 })}% {t('investorDashboard.returnLabel')}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border bg-surface shadow-sm">
        <CardContent className="p-4">
          <p className="text-[11px] font-semibold uppercase text-neutral-500">{t('investorDashboard.investmentDuration')}</p>
          <p className="mt-1 text-base font-semibold"><span dir="ltr">{stats.diffDays}</span> <span className="text-sm font-normal text-neutral-500">{t('investors.days')}</span></p>
          <p className="mt-2 text-xs text-neutral-400">{t('investorDashboard.since')} {new Date(investor.entryDate).toLocaleDateString('fr-FR')}</p>
        </CardContent>
      </Card>
    </div>);
}
