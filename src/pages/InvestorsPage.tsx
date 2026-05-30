import React, { useMemo, useState } from 'react';
import { UserIcon } from '../components/icons/UserIcon';
import { PlusIcon } from '../components/icons/PlusIcon';
import { BanknotesIcon } from '../components/icons/BanknotesIcon';
import { Investor } from '../types';
import { InvestorsDetailsCard } from '../components/investors/InvestorsDetailsCard';
import { CommissionEditorModal } from '../components/investors/CommissionEditorModal';
import { InvestorsListSection } from '../components/investors/InvestorsListSection';
import { HeroKpiCard } from '../components/ui/HeroKpiCard';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { CurrencyAmount } from '../components/financial/CurrencyAmount';
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
      {stats.totalAvailable > 10000 && (<div className="flex items-center gap-3 rounded-xl border border-warning/30 bg-warning-bg px-4 py-3">
          <BanknotesIcon className="h-5 w-5 shrink-0 text-warning"/>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-warning">Profits à distribuer</p>
            <p className="mt-0.5 text-xs text-warning/70">
              <CurrencyAmount value={stats.totalAvailable} currency="DZD" semantic="plain" size="sm" decimals={0}/> disponibles pour les investisseurs actifs
            </p>
          </div>
        </div>)}

      <InvestorsDetailsCard stats={stats} managerFeePercentage={managerFeePercentage} onOpenCommissionEditor={() => setIsCommissionModalOpen(true)} reconciliationDifference={investorEconomicsTotals.reconciliationDifference}/>

      <InvestorsListSection investors={investors} activeCount={stats.activeCount} onOpenInvestor={onOpenInvestor} onEditInvestor={onEditInvestor} onDeleteInvestor={onDeleteInvestor}/>

      <CommissionEditorModal isOpen={isCommissionModalOpen} onClose={() => setIsCommissionModalOpen(false)} value={managerFeePercentage} onChange={setManagerFeePercentage} managerFeeAmount={stats.managerFee}/>
    </div>);
};
