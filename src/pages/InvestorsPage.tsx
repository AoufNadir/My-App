import React, { useMemo, useState } from 'react';
import { UserIcon } from '../components/icons/UserIcon';
import { PlusIcon } from '../components/icons/PlusIcon';
import { Investor } from '../types';
import { InvestorsDetailsCard } from '../components/investors/InvestorsDetailsCard';
import { CommissionEditorModal } from '../components/investors/CommissionEditorModal';
import { InvestorsListSection } from '../components/investors/InvestorsListSection';
import { HeroKpiCard } from '../components/ui/HeroKpiCard';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import type { InvestorEconomicsResult } from '../hooks/useInvestorEconomics';
interface InvestorsPageProps {
    investors: Investor[];
    onOpenInvestor: (investor: Investor) => void;
    onAddInvestor: () => void;
    onEditInvestor: (investor: Investor) => void;
    onDeleteInvestor: (investor: Investor) => void;
    investorEconomicsTotals: InvestorEconomicsResult['totals'];
    managerFeePercentage: string;
    setManagerFeePercentage: (val: string) => void;
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
export const InvestorsPage: React.FC<InvestorsPageProps> = ({ investors, onOpenInvestor, onAddInvestor, onEditInvestor, onDeleteInvestor, investorEconomicsTotals, managerFeePercentage, setManagerFeePercentage }) => {
    const stats: InvestorsStats = useMemo(() => {
        const totalCapital = investors.reduce((sum, inv) => sum + (inv.isActive ? inv.capitalInvested : 0), 0);
        const totalProfitDistributed = investors.reduce((sum, inv) => sum + (inv.totalProfit || 0), 0);
        const totalAvailable = investors.reduce((sum, inv) => sum + (inv.availableProfit || 0), 0);
        const totalWithdrawn = investors.reduce((sum, inv) => sum + (inv.withdrawnProfit || 0), 0);
        const managerFee = investorEconomicsTotals.managerShare;
        const activeCount = investors.filter((inv) => inv.isActive).length;
        const totalDeliveryExpenses = investorEconomicsTotals.totalDeliveryExpenses || 0;
        const netDistributableProfit = investorEconomicsTotals.netDistributableProfit || 0;
        return { totalCapital, totalProfitDistributed, totalAvailable, managerFee, totalWithdrawn, activeCount, totalDeliveryExpenses, netDistributableProfit };
    }, [investors, investorEconomicsTotals]);
    const [isCommissionModalOpen, setIsCommissionModalOpen] = useState(false);
    return (<div className="anim-page-in space-y-6">
      <PageHeader title="Investisseurs" subtitle={`${stats.activeCount} actifs`} className="-mx-4 sm:mx-0 sm:rounded-lg" actions={(<Button onClick={onAddInvestor} className="gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary-dark">
            <PlusIcon className="h-4 w-4"/>
            <span className="hidden sm:inline">Ajouter</span>
          </Button>)}/>

      <HeroKpiCard accent="sky" icon={<UserIcon className="w-5 h-5"/>} primaryLabel="Capital total investisseurs" primaryValue={stats.totalCapital} primaryCurrency="DZD" primarySemantic="plain" secondary={[
            { label: 'Profit distribué', value: stats.totalProfitDistributed, currency: 'DZD', semantic: 'auto' },
            { label: 'Profit disponible', value: stats.totalAvailable, currency: 'DZD', semantic: 'auto' },
            { label: 'Fee gérant', value: stats.managerFee, currency: 'DZD', semantic: 'auto' }
        ]}/>

      <InvestorsDetailsCard stats={stats} managerFeePercentage={managerFeePercentage} onOpenCommissionEditor={() => setIsCommissionModalOpen(true)} reconciliationDifference={investorEconomicsTotals.reconciliationDifference}/>

      <InvestorsListSection investors={investors} activeCount={stats.activeCount} onOpenInvestor={onOpenInvestor} onEditInvestor={onEditInvestor} onDeleteInvestor={onDeleteInvestor}/>

      <CommissionEditorModal isOpen={isCommissionModalOpen} onClose={() => setIsCommissionModalOpen(false)} value={managerFeePercentage} onChange={setManagerFeePercentage} managerFeeAmount={stats.managerFee}/>
    </div>);
};
