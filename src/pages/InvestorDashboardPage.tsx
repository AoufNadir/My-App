import React, { useMemo } from 'react';
import { Button } from '../components/ui/Button';
import { DownloadCloudIcon } from '../components/icons/DownloadCloudIcon';
import { WalletIcon } from '../components/icons/WalletIcon';
import { InvestorPerformanceChart } from '../components/dashboard/InvestorPerformanceChart';
import { Investor, InvestorTransaction } from '../types';
import { InvestorDashboardStatsGrid } from '../components/investor-dashboard/InvestorDashboardStatsGrid';
import { InvestorDashboardTransactionsTable } from '../components/investor-dashboard/InvestorDashboardTransactionsTable';
import { useInvestorReportDialog } from '../components/investor-details/useInvestorReportDialog';
import { useLanguage } from '../contexts/LanguageContext';
import { getNameInitials } from '../utils/nameUtils';
interface InvestorDashboardPageProps {
    investor: Investor;
    transactions: InvestorTransaction[];
    globalNetProfit: number;
    managerFeePercentage: number;
    totalCapital: number;
    onExportReport?: (range?: {
        startTs?: number | null;
        endTs?: number | null;
    }) => void;
}
type DashboardStats = {
    totalValue: number;
    profitPercentage: number;
    diffDays: number;
    currentTotalProfit: number;
};
export const InvestorDashboardPage: React.FC<InvestorDashboardPageProps> = ({ investor, transactions, onExportReport }) => {
    const { t } = useLanguage();
    const stats = useMemo<DashboardStats>(() => {
        const currentTotalProfit = Number(investor.totalProfit || 0);
        const currentAvailable = Number(investor.availableProfit || 0);
        const totalValue = investor.capitalInvested + currentAvailable;
        const profitPercentage = investor.capitalInvested > 0
            ? (currentTotalProfit / investor.capitalInvested) * 100
            : 0;
        const entry = new Date(investor.entryDate).getTime();
        const diffDays = Math.ceil(Math.abs(Date.now() - entry) / (1000 * 60 * 60 * 24));
        return { totalValue, profitPercentage, diffDays, currentTotalProfit };
    }, [investor]);
    const orderedTransactions = useMemo(() => [...transactions].sort((a, b) => b.timestamp - a.timestamp), [transactions]);
    const report = useInvestorReportDialog(onExportReport);
    const handleRequestWithdrawal = () => {
        const subject = encodeURIComponent(String(t('investorDashboard.withdrawalMailSubject')).replace('{name}', investor.name));
        const body = encodeURIComponent(String(t('investorDashboard.withdrawalMailBody')));
        window.location.href = `mailto:admin@proodigital.com?subject=${subject}&body=${body}`;
    };
    return (<div className="min-h-screen bg-app-bg px-4 pb-24 pt-4 text-neutral-900 md:px-8 md:pt-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-3">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[15px] font-bold text-primary dark:text-primary-light">
              {getNameInitials(investor.name)}
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold text-neutral-900">{t('investorDashboard.title')}</h1>
              <p className="truncate text-xs text-neutral-500">{String(t('investorDashboard.welcome')).replace('{name}', investor.name)}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button onClick={report.open} variant="outline" size="md" className="font-semibold">
              <DownloadCloudIcon className="h-4 w-4"/>
              <span>{t('investorDashboard.report')}</span>
            </Button>
            <Button onClick={handleRequestWithdrawal} variant="primary" size="md" className="font-bold">
              <WalletIcon className="h-4 w-4"/>
              <span>{t('investorDashboard.withdraw')}</span>
            </Button>
          </div>
        </header>

        <InvestorDashboardStatsGrid investor={investor} stats={stats}/>

        <InvestorPerformanceChart transactions={transactions} currentCapital={stats.totalValue}/>

        <InvestorDashboardTransactionsTable orderedTransactions={orderedTransactions} isManager={investor.isManager === true}/>

        {report.dialog}

        <footer className="pb-8 pt-2 text-center text-xs text-neutral-500">
          <p>&copy; {new Date().getFullYear()} Pro Digital Investment. {t('investorDashboard.rights')}</p>
          <p className="mt-1">{t('investorDashboard.disclaimer')}</p>
        </footer>
      </div>
    </div>);
};
