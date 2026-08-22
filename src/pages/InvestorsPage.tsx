import React, { useCallback, useMemo, useState } from 'react';
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
import { useLanguage } from '../contexts/LanguageContext';
import type { InvestorEconomicsResult, ManagerProfitBreakdown } from '../hooks/useInvestorEconomics';
import type { FirestoreDocumentReference } from '../firebase';
import type { CapitalSnapshot, InvestorBreakdown } from '../utils/capitalSnapshot';
interface InvestorsPageProps {
    investors: Investor[];
    capitalSnapshot?: CapitalSnapshot;
    investorBreakdown?: InvestorBreakdown;
    onOpenInvestor: (investor: Investor) => void;
    onAddInvestor: () => void;
    onEditInvestor: (investor: Investor) => void;
    onDeleteInvestor: (investor: Investor) => void;
    investorEconomicsTotals: InvestorEconomicsResult['totals'];
    managerFeePercentage: string;
    saveManagerFeePercentage: (val: string) => Promise<void>;
    userDocRef: FirestoreDocumentReference;
    setAlert: (msg: string) => void;
    treasuryStats: { caisse: number; baridi: number };
    managerProfitBreakdown?: ManagerProfitBreakdown;
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
export const InvestorsPage: React.FC<InvestorsPageProps> = ({ investors, capitalSnapshot, investorBreakdown, onOpenInvestor, onAddInvestor, onEditInvestor, onDeleteInvestor, investorEconomicsTotals, managerFeePercentage, saveManagerFeePercentage, userDocRef, setAlert, treasuryStats, managerProfitBreakdown }) => {
    const { t } = useLanguage();
    const stats: InvestorsStats = useMemo(() => {
        const nonManagerInvestors = investors.filter((inv) => inv.isActive && !inv.isManager);
        const totalCapital = investorBreakdown?.capital ?? nonManagerInvestors.reduce((sum, inv) => sum + Math.max(0, Number(inv.capitalInvested || 0)), 0);
        const totalProfitDistributed = investors.reduce((sum, inv) => sum + (inv.totalProfit || 0), 0);
        const totalAvailable = investorBreakdown?.profits ?? nonManagerInvestors.reduce((sum, inv) => sum + Math.max(0, Number(inv.availableProfit || 0)), 0);
        const totalWithdrawn = investors.reduce((sum, inv) => sum + (inv.withdrawnProfit || 0), 0);
        const managerFee = investorEconomicsTotals.managerShare;
        const activeCount = investors.filter((inv) => inv.isActive).length;
        const totalDeliveryExpenses = investorEconomicsTotals.totalDeliveryExpenses || 0;
        const netDistributableProfit = investorEconomicsTotals.netDistributableProfit || 0;
        return { totalCapital, totalProfitDistributed, totalAvailable, managerFee, totalWithdrawn, activeCount, totalDeliveryExpenses, netDistributableProfit }; // netDistributableProfit used for distribution banner
    }, [investors, investorBreakdown, investorEconomicsTotals]);
    const [isCommissionModalOpen, setIsCommissionModalOpen] = useState(false);
    const [isDistributionOpen, setIsDistributionOpen] = useState(false);
    const distributableInvestors = useMemo(() => investors.filter((investor) => !investor.isManager), [investors]);
    const handleSaveCommission = useCallback(async (nextValue: string) => {
        await saveManagerFeePercentage(nextValue);
        setAlert('✅ Taux actuel du gérant sauvegardé.');
        setIsCommissionModalOpen(false);
    }, [saveManagerFeePercentage, setAlert]);
    return (<div className="anim-page-in space-y-6">
      <PageHeader title={t('investors.title') as string} subtitle={`${stats.activeCount} ${t('investors.activeSuffix')}`} className="-mx-4 sm:mx-0 sm:rounded-card" actions={(<Button onClick={onAddInvestor} variant="primary" size="md" className="font-semibold">
            <PlusIcon className="h-4 w-4"/>
            <span className="hidden sm:inline">{t('investors.add')}</span>
          </Button>)}/>

      <HeroKpiCard accent="sky" icon={<UserIcon className="w-5 h-5"/>} primaryLabel={t('investors.capitalInvested') as string} primaryValue={stats.totalCapital} primaryCurrency="DZD" primarySemantic="plain" secondary={[
            ...(capitalSnapshot ? [
                { label: t('investors.capitalProject') as string, value: capitalSnapshot.totalCapital, currency: 'DZD' as const, semantic: 'plain' as const },
                { label: t('investors.capitalOwned') as string, value: managerProfitBreakdown?.actualOwnerCapital ?? capitalSnapshot.netOwnedCapital, currency: 'DZD' as const, semantic: 'plain' as const }
            ] : []),
            { label: t('investors.profitsToPay') as string, value: stats.totalAvailable, currency: 'DZD', semantic: 'auto' },
            { label: t('investors.managerShare') as string, value: stats.managerFee, currency: 'DZD', semantic: 'auto' }
        ]}/>

      {/* Distribution reminder when available profits are significant */}
      {stats.totalAvailable > 5000 && (<button
          type="button"
          onClick={() => setIsDistributionOpen(true)}
          className="flex w-full items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-start transition-colors hover:bg-primary/10 active:scale-[0.99]">
          <BanknotesIcon className="h-5 w-5 shrink-0 text-primary"/>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-primary">{t('investors.distributeProfits')}</p>
            <p className="mt-0.5 text-xs text-primary/60">
              {t('investors.profitsToPay')} : <CurrencyAmount value={stats.totalAvailable} currency="DZD" semantic="plain" size="sm" decimals={0}/> - {t('investors.tapToViewPlan')}
            </p>
          </div>
          <svg className="w-5 h-5 shrink-0 text-primary/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
          </svg>
        </button>)}

      <InvestorsDetailsCard stats={stats} capitalSnapshot={capitalSnapshot} managerFeePercentage={managerFeePercentage} managerProfitBreakdown={managerProfitBreakdown} onOpenCommissionEditor={() => setIsCommissionModalOpen(true)} reconciliationDifference={investorEconomicsTotals.reconciliationDifference}/>

      <InvestorsListSection investors={investors} capitalSnapshot={capitalSnapshot} managerProfitBreakdown={managerProfitBreakdown} activeCount={stats.activeCount} onOpenInvestor={onOpenInvestor} onEditInvestor={onEditInvestor} onDeleteInvestor={onDeleteInvestor}/>

      <CommissionEditorModal isOpen={isCommissionModalOpen} onClose={() => setIsCommissionModalOpen(false)} value={managerFeePercentage} onSave={handleSaveCommission} managerFeeAmount={stats.managerFee}/>

      <ProfitDistributionSheet
        isOpen={isDistributionOpen}
        onClose={() => setIsDistributionOpen(false)}
        investors={distributableInvestors}
        suggestedTotal={stats.totalAvailable}
        userDocRef={userDocRef}
        setAlert={setAlert}
        treasuryStats={treasuryStats}
      />
    </div>);
};
