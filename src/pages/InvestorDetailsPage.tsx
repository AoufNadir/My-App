import React, { useMemo, useState } from 'react';
import { Button } from '../components/ui/Button';
import { ChevronLeftIcon } from '../components/icons/ChevronLeftIcon';
import { FileSpreadsheetIcon } from '../components/icons/FileSpreadsheetIcon';
import { InvestorTransaction, TreasuryTx } from '../types';
import { InvestorDetailsContent } from '../components/investor-details/InvestorDetailsContent';
import { useInvestorReportDialog, type InvestorReportDateRange } from '../components/investor-details/useInvestorReportDialog';
import { useLanguage } from '../contexts/LanguageContext';
import type { CapitalSnapshot } from '../utils/capitalSnapshot';
import type { DerivedInvestor, ManagerProfitBreakdown } from '../hooks/useInvestorEconomics';
import type { InvestorTerm } from '../utils/investorTerms';
import { InvestorTermAlert } from '../components/investors/InvestorTermAlert';
interface InvestorDetailsPageProps {
    investor: DerivedInvestor;
    transactions: InvestorTransaction[];
    onBack: () => void;
    onAddCapital: () => void;
    onWithdrawCapital: () => void;
    onWithdrawProfit: () => void;
    onReinvestProfit: () => void;
    onDeleteTransaction: (tx: InvestorTransaction) => void;
    onExportReport: (range?: InvestorReportDateRange) => void;
    globalNetProfit: number;
    managerFeePercentage: number;
    totalCapital: number;
    capitalSnapshot?: CapitalSnapshot;
    managerProfitBreakdown?: ManagerProfitBreakdown;
    personalExpenses?: TreasuryTx[];
    /** The investor's open quarterly term, if any: shown at the top with the same two windows. */
    term?: InvestorTerm | null;
}
export const InvestorDetailsPage: React.FC<InvestorDetailsPageProps> = ({ investor, transactions, onBack, onAddCapital, onWithdrawCapital, onWithdrawProfit, onReinvestProfit, onDeleteTransaction, onExportReport, capitalSnapshot, managerProfitBreakdown, personalExpenses, term }) => {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<'overview' | 'history'>('overview');
    const orderedTransactions = useMemo(() => [...transactions].sort((a, b) => b.timestamp - a.timestamp), [transactions]);
    const report = useInvestorReportDialog(onExportReport);
    return (<div className="anim-page-in flex flex-col gap-3">
      <div className="flex items-center gap-1">
        <button type="button" onClick={onBack} aria-label={t('common.back')} className="-ms-2 flex h-touch w-touch shrink-0 items-center justify-center rounded-full text-neutral-600 transition-colors hover:bg-surface-muted hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <ChevronLeftIcon aria-hidden="true" className="h-6 w-6 rtl:-scale-x-100"/>
        </button>
        <h2 className="min-w-0 flex-1 truncate text-lg font-bold text-neutral-900">{investor.name}</h2>
        <Button onClick={report.open} variant="primary" size="sm" className="ms-1 shrink-0">
          <FileSpreadsheetIcon className="h-4 w-4"/>
          PDF
        </Button>
      </div>

      {term && term.investorId === investor.id && (<InvestorTermAlert term={term} showName={false} onReinvest={onReinvestProfit} onWithdraw={onWithdrawProfit}/>)}

      <InvestorDetailsContent investor={investor} capitalSnapshot={capitalSnapshot} managerProfitBreakdown={managerProfitBreakdown} orderedTransactions={orderedTransactions} activeTab={activeTab} setActiveTab={setActiveTab} onAddCapital={onAddCapital} onWithdrawCapital={onWithdrawCapital} onWithdrawProfit={onWithdrawProfit} onReinvestProfit={onReinvestProfit} onDeleteTransaction={onDeleteTransaction} personalExpenses={personalExpenses}/>

      {report.dialog}
    </div>);
};
