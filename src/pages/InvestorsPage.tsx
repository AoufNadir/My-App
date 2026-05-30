import React, { useMemo, useState } from 'react';
import { UserIcon } from '../components/icons/UserIcon';
import { PlusIcon } from '../components/icons/PlusIcon';
import { BanknotesIcon } from '../components/icons/BanknotesIcon';
import { Investor } from '../types';
import { InvestorsDetailsCard } from '../components/investors/InvestorsDetailsCard';
import { CommissionEditorModal } from '../components/investors/CommissionEditorModal';
import { InvestorsListSection } from '../components/investors/InvestorsListSection';
import { ProfitDistributionSheet } from '../components/investors/ProfitDistributionSheet';
import { HeroKpiCard } from '../components/ui/HeroKpiCard';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { CurrencyAmount } from '../components/financial/CurrencyAmount';
import type { InvestorEconomicsResult } from '../hooks/useInvestorEconomics';
import type { FirestoreDocumentReference } from '../firebase';
interface InvestorsPageProps {
    investors: Investor[];
    onOpenInvestor: (investor: Investor) => void;
    onAddInvestor: () => void;
    onEditInvestor: (investor: Investor) => void;
    onDeleteInvestor: (investor: Investor) => void;
    investorEconomicsTotals: InvestorEconomicsResult['totals'];
    managerFeePercentage: string;
    setManagerFeePercentage: (val: string) => void;
    userDocRef: FirestoreDocumentReference;
    setAlert: (msg: string) => void;
}
type InvestorsStats = {
    totalCapital: number;
    totalProfitDistributed: number;
    totalAvailable: number;
    managerFee: number;
    totalWithdrawn: number;
    activeCount: number;
    totalDeliveryExpenses: number;
    netDistributableProfit: number;
};
export const InvestorsPage: React.FC<InvestorsPageProps> = ({ investors, onOpenInvestor, onAddInvestor, onEditInvestor, onDeleteInvestor, investorEconomicsTotals, managerFeePercentage, setManagerFeePercentage, userDocRef, setAlert }) => {
    const stats: InvestorsStats = useMemo(() => {
        const totalCapital = investors.reduce((sum, inv) => sum + (inv.isActive ? inv.capitalInvested : 0), 0);
        const totalProfitDistributed = investors.reduce((sum, inv) => sum + (inv.totalProfit || 0), 0);
        const totalAvailable = investors.reduce((sum, inv) => sum + (inv.availableProfit || 0), 0);
        const totalWithdrawn = investors.reduce((sum, inv) => sum + (inv.withdrawnProfit || 0), 0);
        const managerFee = investorEconomicsTotals.managerShare;
        const activeCount = investors.filter((inv) => inv.isActive).length;
        const totalDeliveryExpenses = investorEconomicsTotals.totalDeliveryExpenses || 0;
        const netDistributableProfit = investorEconomicsTotals.netDistributableProfit || 0;
        return { totalCapital, totalProfitDistributed, totalAvailable, managerFee, totalWithdrawn, activeCount, totalDeliveryExpenses, netDistributableProfit }; // netDistributableProfit used for distribution banner
    }, [investors, investorEconomicsTotals]);
    const [isCommissionModalOpen, setIsCommissionModalOpen] = useState(false);
    const [isDistributionOpen, setIsDistributionOpen] = useState(false);
    return (<div className="anim-page-in space-y-6">
      <PageHeader title="Investisseurs" subtitle={`${stats.activeCount} actifs`} className="-mx-4 sm:mx-0 sm:rounded-card" actions={(<Button onClick={onAddInvestor} variant="primary" size="md" className="font-semibold">
            <PlusIcon className="h-4 w-4"/>
            <span className="hidden sm:inline">Ajouter</span>
          </Button>)}/>

      <HeroKpiCard accent="sky" icon={<UserIcon className="w-5 h-5"/>} primaryLabel="Capital total investisseurs" primaryValue={stats.totalCapital} primaryCurrency="DZD" primarySemantic="plain" secondary={[
            { label: 'Profit distribué', value: stats.totalProfitDistributed, currency: 'DZD', semantic: 'auto' },
            { label: 'Profit disponible', value: stats.totalAvailable, currency: 'DZD', semantic: 'auto' },
            { label: 'Fee gérant', value: stats.managerFee, currency: 'DZD', semantic: 'auto' }
        ]}/>

      {/* Distribution reminder when available profits are significant */}
      {stats.netDistributableProfit > 5000 && (<button
          type="button"
          onClick={() => setIsDistributionOpen(true)}
          className="flex w-full items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-start transition-colors hover:bg-primary/10 active:scale-[0.99]">
          <BanknotesIcon className="h-5 w-5 shrink-0 text-primary"/>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-primary">Distribuer les profits</p>
            <p className="mt-0.5 text-xs text-primary/60">
              Profit net disponible : <CurrencyAmount value={stats.netDistributableProfit} currency="DZD" semantic="plain" size="sm" decimals={0}/> — appuyez pour voir le plan
            </p>
          </div>
          <svg className="w-5 h-5 shrink-0 text-primary/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
          </svg>
        </button>)}

      <InvestorsDetailsCard stats={stats} managerFeePercentage={managerFeePercentage} onOpenCommissionEditor={() => setIsCommissionModalOpen(true)} reconciliationDifference={investorEconomicsTotals.reconciliationDifference}/>

      <InvestorsListSection investors={investors} activeCount={stats.activeCount} onOpenInvestor={onOpenInvestor} onEditInvestor={onEditInvestor} onDeleteInvestor={onDeleteInvestor}/>

      <CommissionEditorModal isOpen={isCommissionModalOpen} onClose={() => setIsCommissionModalOpen(false)} value={managerFeePercentage} onChange={setManagerFeePercentage} managerFeeAmount={stats.managerFee}/>

      <ProfitDistributionSheet
        isOpen={isDistributionOpen}
        onClose={() => setIsDistributionOpen(false)}
        investors={investors}
        suggestedTotal={stats.netDistributableProfit}
        userDocRef={userDocRef}
        setAlert={setAlert}
      />
    </div>);
};
