import { HeroCard, StatTile } from '../cards';
import { CurrencyAmount } from '../financial/CurrencyAmount';
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
    return (<>
      <HeroCard label={t('investorDashboard.currentValueEstimate')} value={stats.totalValue} note={<p className="text-xs text-neutral-500">{t('investorDashboard.capitalPlusUnpaidProfits')}</p>}/>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <StatTile label={(investor.isManager ? t('investors.managerOwnedCapital') : t('investors.capitalInvested')) as string} value={investor.capitalInvested} hint={<span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-xs font-bold ${investor.isActive ? 'bg-financial-profit-bg text-financial-profit' : 'bg-surface-muted text-neutral-600'}`}>
            {investor.isActive ? t('investors.active') : t('investors.inactive')}
          </span>}/>
        <StatTile label={t('investors.totalProfitCumulative') as string} value={stats.currentTotalProfit} display={<CurrencyAmount value={stats.currentTotalProfit} currency="DZD" semantic="auto" size="lg" showSign decimals={0}/>} hint={<span className={stats.profitPercentage >= 0 ? 'text-financial-profit' : 'text-financial-loss'}>
            <span dir="ltr" className="font-bold">{profitPercentSign}{formatNumber(stats.profitPercentage, { min: 2, max: 2 })}%</span> {t('investors.cumulativeReturn')}
          </span>}/>
        <div className="col-span-2 sm:col-span-1">
          <StatTile label={t('investorDashboard.investmentDuration') as string} value={stats.diffDays} display={<span className="text-base font-semibold text-neutral-900"><span dir="ltr" className="tabular-nums">{stats.diffDays}</span> <span className="text-sm font-normal text-neutral-500">{t('investors.days')}</span></span>} hint={`${t('investorDashboard.since')} ${new Date(investor.entryDate).toLocaleDateString('fr-FR')}`}/>
        </div>
      </div>
    </>);
}
