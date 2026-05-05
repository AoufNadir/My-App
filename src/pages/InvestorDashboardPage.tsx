import React, { useMemo } from 'react';
import { Button } from '../components/ui/Button';
import { UnifiedTitle } from '../components/ui/UnifiedTitle';
import { DownloadCloudIcon } from '../components/icons/DownloadCloudIcon';
import { WalletIcon } from '../components/icons/WalletIcon';
import { LayoutDashboardIcon } from '../components/icons/LayoutDashboardIcon';
import { InvestorPerformanceChart } from '../components/dashboard/InvestorPerformanceChart';
import { Investor, InvestorTransaction } from '../types';
import { InvestorDashboardStatsGrid } from '../components/investor-dashboard/InvestorDashboardStatsGrid';
import { InvestorDashboardTransactionsTable } from '../components/investor-dashboard/InvestorDashboardTransactionsTable';

interface InvestorDashboardPageProps {
  investor: Investor;
  transactions: InvestorTransaction[];
  isDark: boolean;
  /** Pre-computed total profit from the centralized investor engine */
  computedTotalProfit: number;
  /** Pre-computed available profit from the centralized investor engine */
  computedAvailableProfit: number;
}

type DashboardStats = {
  totalValue: number;
  profitPercentage: number;
  diffDays: number;
  currentTotalProfit: number;
};

export const InvestorDashboardPage: React.FC<InvestorDashboardPageProps> = ({
  investor,
  transactions,
  isDark,
  computedTotalProfit,
  computedAvailableProfit
}) => {
  const stats = useMemo<DashboardStats>(() => {
    const totalValue = investor.capitalInvested + computedAvailableProfit;
    const profitPercentage = investor.capitalInvested > 0
      ? (computedTotalProfit / investor.capitalInvested) * 100
      : 0;

    const entry = new Date(investor.entryDate).getTime();
    const diffDays = Math.ceil(Math.abs(Date.now() - entry) / (1000 * 60 * 60 * 24));

    return { totalValue, profitPercentage, diffDays, currentTotalProfit: computedTotalProfit };
  }, [investor, computedTotalProfit, computedAvailableProfit]);

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
          <UnifiedTitle
            as="h1"
            isDark={isDark}
            variant="page"
            icon={<LayoutDashboardIcon className="w-4 h-4" />}
          >
            Tableau de Bord Investisseur
          </UnifiedTitle>
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

      <InvestorDashboardStatsGrid investor={investor} stats={stats} isDark={isDark} />

      <div className="w-full">
        <InvestorPerformanceChart transactions={transactions} currentCapital={stats.totalValue} isDark={isDark} />
      </div>

      <InvestorDashboardTransactionsTable orderedTransactions={orderedTransactions} isDark={isDark} />

      <div className="text-center text-xs opacity-50 pb-8">
        <p>&copy; {new Date().getFullYear()} Pro Digital Investment. Tous droits reserves.</p>
        <p className="mt-1">Les performances passees ne prejudent pas des performances futures.</p>
      </div>
    </div>
  );
};
