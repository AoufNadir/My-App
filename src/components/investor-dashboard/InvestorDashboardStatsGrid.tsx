import { Card, CardContent } from '../ui/Card';
import { TrendingUpIcon } from '../icons/TrendingUpIcon';
import { Investor } from '../../types';
import { formatDzd, formatNumber } from '../../pages/shared/pageFormat';

type DashboardStats = {
  totalValue: number;
  profitPercentage: number;
  diffDays: number;
  currentTotalProfit: number;
};

type InvestorDashboardStatsGridProps = {
  investor: Investor;
  stats: DashboardStats;
  isDark: boolean;
};

export function InvestorDashboardStatsGrid({
  investor,
  stats,
  isDark
}: InvestorDashboardStatsGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} border shadow-sm`}>
        <CardContent className="p-4">
          <p className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Capital Investi</p>
          <p className="text-2xl font-bold mt-1">{formatDzd(investor.capitalInvested, { min: 0, max: 2 })}</p>
          <div className="mt-2 text-xs flex items-center gap-1 text-emerald-500">
            <span className="py-0.5 px-1.5 bg-emerald-500/10 rounded-md font-medium">Actif</span>
          </div>
        </CardContent>
      </Card>

      <Card className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} border shadow-sm relative overflow-hidden`}>
        <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-bl-full -mr-2 -mt-2" />
        <CardContent className="p-4">
          <p className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Valeur Actuelle (Estimee)</p>
          <p className="text-2xl font-bold mt-1 text-indigo-500">{formatDzd(stats.totalValue, { min: 0, max: 2 })}</p>
          <p className={`text-xs mt-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Capital + profits non retires</p>
        </CardContent>
      </Card>

      <Card className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} border shadow-sm`}>
        <CardContent className="p-4">
          <p className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Profit Net Total</p>
          <p className="text-2xl font-bold mt-1 text-emerald-500">+{formatDzd(stats.currentTotalProfit, { min: 0, max: 2 })}</p>
          <div className="mt-2 text-xs flex items-center gap-1 text-emerald-500">
            <TrendingUpIcon className="w-3 h-3" />
            <span className="font-medium">+{formatNumber(stats.profitPercentage, { min: 2, max: 2 })}% de rendement</span>
          </div>
        </CardContent>
      </Card>

      <Card className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} border shadow-sm`}>
        <CardContent className="p-4">
          <p className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Duree d'investissement</p>
          <p className="text-2xl font-bold mt-1">{stats.diffDays} <span className="text-sm font-normal text-gray-500">Jours</span></p>
          <p className={`text-xs mt-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Depuis le {new Date(investor.entryDate).toLocaleDateString('fr-FR')}</p>
        </CardContent>
      </Card>
    </div>
  );
}
