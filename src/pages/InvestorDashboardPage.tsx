import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { DownloadCloudIcon } from '../components/icons/DownloadCloudIcon';
import { WalletIcon } from '../components/icons/WalletIcon';
import { TrendingUpIcon } from '../components/icons/TrendingUpIcon';
import { InvestorPerformanceChart } from '../components/dashboard/InvestorPerformanceChart';
import { Investor, InvestorTransaction } from '../types';
import { formatDzd, formatNumber } from './shared/pageFormat';

interface InvestorDashboardPageProps {
  investor: Investor;
  transactions: InvestorTransaction[];
  isDark: boolean;
  globalNetProfit: number;
  managerFeePercentage: number;
  totalCapital: number;
}

type DashboardStats = {
  totalValue: number;
  profitPercentage: number;
  diffDays: number;
  currentTotalProfit: number;
};

function getInvestorDashboardTxMeta(type: InvestorTransaction['type']) {
  if (type === 'profit_distribution') return { label: 'Distribution Profit', badge: 'bg-emerald-500/10 text-emerald-500', positive: true };
  if (type === 'deposit_capital') return { label: 'Depot Capital', badge: 'bg-blue-500/10 text-blue-500', positive: true };
  if (type === 'withdraw_profit') return { label: 'Retrait Profit', badge: 'bg-amber-500/10 text-amber-500', positive: false };
  return { label: 'Retrait Capital', badge: 'bg-gray-500/10 text-gray-500', positive: false };
}

export const InvestorDashboardPage: React.FC<InvestorDashboardPageProps> = ({
  investor,
  transactions,
  isDark,
  globalNetProfit,
  managerFeePercentage,
  totalCapital
}) => {
  const stats = useMemo<DashboardStats>(() => {
    const share = totalCapital > 0 ? (investor.capitalInvested / totalCapital) : 0;
    const managerFee = globalNetProfit * (managerFeePercentage / 100);
    const distributablePool = globalNetProfit - managerFee;

    const currentTotalProfit = distributablePool * share;
    const currentAvailable = currentTotalProfit - investor.withdrawnProfit;
    const totalValue = investor.capitalInvested + currentAvailable;
    const profitPercentage = investor.capitalInvested > 0
      ? (currentTotalProfit / investor.capitalInvested) * 100
      : 0;

    const entry = new Date(investor.entryDate).getTime();
    const diffDays = Math.ceil(Math.abs(Date.now() - entry) / (1000 * 60 * 60 * 24));

    return { totalValue, profitPercentage, diffDays, currentTotalProfit };
  }, [investor, globalNetProfit, managerFeePercentage, totalCapital]);

  const orderedTransactions = useMemo(
    () => [...transactions].sort((a, b) => b.timestamp - a.timestamp),
    [transactions]
  );

  const handleDownloadReport = () => {
    alert('La fonctionnalite de telechargement sera disponible bientot.');
  };

  const handleRequestWithdrawal = () => {
    const subject = encodeURIComponent(`Demande de retrait - ${investor.name}`);
    const body = encodeURIComponent('Je souhaite effectuer un retrait de...');
    window.location.href = `mailto:admin@proodigital.com?subject=${subject}&body=${body}`;
  };

  return (
    <div className={`min-h-screen ${isDark ? 'bg-slate-900 text-white' : 'bg-slate-50 text-gray-900'} p-4 md:p-8 space-y-6 pb-24`}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-500">
            Tableau de Bord Investisseur
          </h1>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Bienvenue, <span className="font-semibold text-indigo-500">{investor.name}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleDownloadReport}
            className={`gap-2 ${isDark ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-white text-gray-700 hover:bg-gray-50'} border border-gray-200 dark:border-gray-700 shadow-sm`}
          >
            <DownloadCloudIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Rapport</span>
          </Button>
          <Button
            onClick={handleRequestWithdrawal}
            className="gap-2 bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-500/20"
          >
            <WalletIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Retrait</span>
          </Button>
        </div>
      </div>

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

      <div className="w-full">
        <InvestorPerformanceChart transactions={transactions} currentCapital={stats.totalValue} isDark={isDark} />
      </div>

      <Card className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} border shadow-sm`}>
        <CardHeader className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
          <h3 className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Historique des Transactions</h3>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className={`${isDark ? 'bg-slate-900/50 text-gray-400' : 'bg-slate-50 text-gray-500'} font-medium`}>
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-right">Montant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {orderedTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center opacity-50">Aucune transaction trouvee.</td>
                  </tr>
                ) : (
                  orderedTransactions.map((tx) => {
                    const meta = getInvestorDashboardTxMeta(tx.type);
                    return (
                      <tr key={tx.id} className={`${isDark ? 'hover:bg-slate-700/30' : 'hover:bg-slate-50'} transition-colors`}>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className={`font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>{tx.date}</div>
                          <div className="text-xs opacity-50">{tx.time}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${meta.badge}`}>
                            {meta.label}
                          </span>
                        </td>
                        <td className={`px-4 py-3 text-right font-bold ${meta.positive ? 'text-emerald-500' : 'text-red-500'}`}>
                          {meta.positive ? '+' : '-'}{formatDzd(tx.amount, { min: 0, max: 2 })}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="text-center text-xs opacity-50 pb-8">
        <p>&copy; {new Date().getFullYear()} Pro Digital Investment. Tous droits reserves.</p>
        <p className="mt-1">Les performances passees ne prejudent pas des performances futures.</p>
      </div>
    </div>
  );
};
