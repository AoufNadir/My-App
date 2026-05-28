import React, { useMemo, useState } from 'react';
import { Button } from '../components/ui/Button';
import { Modal, ModalContent, ModalFooter, ModalHeader, ModalTitle } from '../components/ui/Modal';
import { Label } from '../components/ui/Label';
import { DatePicker } from '../components/ui/DatePicker';
import { PageHeader } from '../components/ui/PageHeader';
import { DownloadCloudIcon } from '../components/icons/DownloadCloudIcon';
import { Investor, InvestorTransaction } from '../types';
import { InvestorDetailsContent } from '../components/investor-details/InvestorDetailsContent';
type InvestorReportDateRange = {
    startTs?: number | null;
    endTs?: number | null;
};
interface InvestorDetailsPageProps {
    investor: Investor;
    transactions: InvestorTransaction[];
    onBack: () => void;
    onAddCapital: () => void;
    onWithdrawCapital: () => void;
    onWithdrawProfit: () => void;
    onReinvestProfit: () => void;
    onDeleteTransaction: (tx: InvestorTransaction) => void;
    onExportReport: (range?: InvestorReportDateRange) => void;
    cardBase: string;
    subtleText: string;
    globalNetProfit: number;
    managerFeePercentage: number;
    totalCapital: number;
}
export const InvestorDetailsPage: React.FC<InvestorDetailsPageProps> = ({ investor, transactions, onBack, onAddCapital, onWithdrawCapital, onWithdrawProfit, onReinvestProfit, onDeleteTransaction, onExportReport, cardBase, subtleText }) => {
    const [activeTab, setActiveTab] = useState<'overview' | 'history'>('overview');
    const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
    const [reportStartDate, setReportStartDate] = useState('');
    const [reportEndDate, setReportEndDate] = useState('');
    const [reportDateError, setReportDateError] = useState('');
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
    const setCurrentMonthRange = () => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const toInput = (date: Date) => {
            const yyyy = date.getFullYear();
            const mm = String(date.getMonth() + 1).padStart(2, '0');
            const dd = String(date.getDate()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd}`;
        };
        setReportStartDate(toInput(start));
        setReportEndDate(toInput(now));
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
    const openReportDialog = () => {
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
        onExportReport({ startTs, endTs });
        setIsReportDialogOpen(false);
    };
    return (<div className="anim-page-in space-y-6">
      <PageHeader title={investor.name} subtitle={`Investisseur depuis le ${new Date(investor.entryDate).toLocaleDateString('fr-FR')}`} onBack={onBack} className="-mx-4 sm:mx-0 sm:rounded-lg" actions={(<Button onClick={openReportDialog} className="gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary-dark">
            <DownloadCloudIcon className="w-4 h-4"/>
            PDF
          </Button>)}/>

      <InvestorDetailsContent investor={investor} orderedTransactions={orderedTransactions} activeTab={activeTab} setActiveTab={setActiveTab} onAddCapital={onAddCapital} onWithdrawCapital={onWithdrawCapital} onWithdrawProfit={onWithdrawProfit} onReinvestProfit={onReinvestProfit} onDeleteTransaction={onDeleteTransaction} cardBase={cardBase} subtleText={subtleText}/>

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
    </div>);
};
