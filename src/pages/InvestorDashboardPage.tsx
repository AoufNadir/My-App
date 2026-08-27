import React, { useMemo } from 'react';
import { Button } from '../components/ui/Button';
import { Modal, ModalContent, ModalFooter, ModalHeader, ModalTitle } from '../components/ui/Modal';
import { Label } from '../components/ui/Label';
import { DatePicker } from '../components/ui/DatePicker';
import { PageHeader } from '../components/ui/PageHeader';
import { DownloadCloudIcon } from '../components/icons/DownloadCloudIcon';
import { WalletIcon } from '../components/icons/WalletIcon';
import { InvestorPerformanceChart } from '../components/dashboard/InvestorPerformanceChart';
import { Investor, InvestorTransaction } from '../types';
import { InvestorDashboardStatsGrid } from '../components/investor-dashboard/InvestorDashboardStatsGrid';
import { InvestorDashboardTransactionsTable } from '../components/investor-dashboard/InvestorDashboardTransactionsTable';
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
    const [isReportDialogOpen, setIsReportDialogOpen] = React.useState(false);
    const [reportStartDate, setReportStartDate] = React.useState('');
    const [reportEndDate, setReportEndDate] = React.useState('');
    const [reportDateError, setReportDateError] = React.useState('');
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
    const parseDateBoundary = (value: string, endOfDay: boolean) => {
        if (!value)
            return null;
        const [year, month, day] = value.split('-').map(Number);
        if (!year || !month || !day)
            return null;
        const date = new Date(year, month - 1, day);
        date.setHours(endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
        return date.getTime();
    };
    const formatInputDate = (date: Date) => {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    };
    const setCurrentMonthRange = () => {
        const now = new Date();
        setReportStartDate(formatInputDate(new Date(now.getFullYear(), now.getMonth(), 1)));
        setReportEndDate(formatInputDate(now));
        setReportDateError('');
    };
    const setCurrentYearRange = () => {
        const now = new Date();
        setReportStartDate(`${now.getFullYear()}-01-01`);
        setReportEndDate(`${now.getFullYear()}-12-31`);
        setReportDateError('');
    };
    const clearReportRange = () => {
        setReportStartDate('');
        setReportEndDate('');
        setReportDateError('');
    };
    const handleDownloadReport = () => {
        if (!reportStartDate && !reportEndDate)
            setCurrentMonthRange();
        setReportDateError('');
        setIsReportDialogOpen(true);
    };
    const handleCreateReport = () => {
        const startTs = parseDateBoundary(reportStartDate, false);
        const endTs = parseDateBoundary(reportEndDate, true);
        if ((reportStartDate && startTs === null) || (reportEndDate && endTs === null)) {
            setReportDateError('Date invalide.');
            return;
        }
        if (startTs !== null && endTs !== null && startTs > endTs) {
            setReportDateError('La date de debut doit etre avant la date de fin.');
            return;
        }
        onExportReport?.({ startTs, endTs });
        setIsReportDialogOpen(false);
    };
    const handleRequestWithdrawal = () => {
        const subject = encodeURIComponent(`Demande de retrait - ${investor.name}`);
        const body = encodeURIComponent('Je souhaite effectuer un retrait de...');
        window.location.href = `mailto:admin@proodigital.com?subject=${subject}&body=${body}`;
    };
    return (<div className="min-h-screen space-y-6 bg-app-bg p-4 pb-24 text-neutral-900 md:p-8">
      <PageHeader title="Tableau de Bord Investisseur" subtitle={`Bienvenue, ${investor.name}`} className="-mx-4 md:mx-0 md:rounded-lg" actions={(<>
          <Button onClick={handleDownloadReport} variant="outline" className="gap-2 border-border bg-surface text-neutral-700 shadow-sm hover:bg-neutral-50">
            <DownloadCloudIcon className="w-4 h-4"/>
            <span className="hidden sm:inline">Rapport</span>
          </Button>
          <Button onClick={handleRequestWithdrawal} className="gap-2 bg-primary text-white shadow-sm hover:bg-primary-dark">
            <WalletIcon className="w-4 h-4"/>
            <span className="hidden sm:inline">Retrait</span>
          </Button>
        </>)}/>

      <InvestorDashboardStatsGrid investor={investor} stats={stats}/>

      <div className="w-full">
        <InvestorPerformanceChart transactions={transactions} currentCapital={stats.totalValue}/>
      </div>

      <InvestorDashboardTransactionsTable orderedTransactions={orderedTransactions} isManager={investor.isManager === true}/>

      <Modal isOpen={isReportDialogOpen} onClose={() => setIsReportDialogOpen(false)} className="max-w-md bg-surface">
        <ModalHeader onClose={() => setIsReportDialogOpen(false)} className="border-b border-border px-4 py-3 sm:px-5">
          <ModalTitle className="text-base sm:text-lg">Creer rapport investisseur</ModalTitle>
        </ModalHeader>
        <ModalContent className="space-y-4 px-4 py-4 sm:px-5">
          <div className="grid grid-cols-2 gap-3">
            <Button onClick={setCurrentMonthRange} variant="outline" className="rounded-lg bg-surface px-3 py-2 text-sm font-bold">
              Mois courant
            </Button>
            <Button onClick={setCurrentYearRange} variant="outline" className="rounded-lg bg-surface px-3 py-2 text-sm font-bold">
              Annee courante
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>Date debut</Label>
              <DatePicker value={reportStartDate} onChange={(iso) => { setReportStartDate(iso); setReportDateError(''); }} className="mt-1"/>
            </div>
            <div>
              <Label>Date fin</Label>
              <DatePicker value={reportEndDate} onChange={(iso) => { setReportEndDate(iso); setReportDateError(''); }} className="mt-1"/>
            </div>
          </div>
          {reportDateError && <p className="text-sm font-semibold text-danger">{reportDateError}</p>}
        </ModalContent>
        <ModalFooter className="border-t border-border px-4 py-3 sm:px-5">
          <Button onClick={clearReportRange} variant="outline" className="w-full bg-surface">
            Tout l'historique
          </Button>
          <Button onClick={handleCreateReport} className="w-full bg-primary text-white hover:bg-primary-dark">
            Creer PDF
          </Button>
        </ModalFooter>
      </Modal>

      <div className="pb-8 text-center text-xs text-neutral-500">
        <p>&copy; {new Date().getFullYear()} Pro Digital Investment. Tous droits reserves.</p>
        <p className="mt-1">Les performances passees ne prejudent pas des performances futures.</p>
      </div>
    </div>);
};
