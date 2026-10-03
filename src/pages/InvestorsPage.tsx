import React, { useCallback, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCard, HeroCard, StatTile, StatTileGrid } from '../components/cards';
import { BanknotesIcon } from '../components/icons/BanknotesIcon';
import { DownloadCloudIcon } from '../components/icons/DownloadCloudIcon';
import { UserPlusIcon } from '../components/icons/UserPlusIcon';
import { Investor } from '../types';
import { InvestorsDetailsCard } from '../components/investors/InvestorsDetailsCard';
import { CommissionEditorModal } from '../components/investors/CommissionEditorModal';
import { InvestorsListSection, exportInvestorsPdf } from '../components/investors/InvestorsListSection';
import { ProfitDistributionSheet } from '../components/investors/ProfitDistributionSheet';
import { PeriodLockCard, type PeriodLockCardProps } from '../components/investors/PeriodLockCard';
import { Button } from '../components/ui/Button';
import { CurrencyAmount } from '../components/financial/CurrencyAmount';
import { useHeaderActionsSlot } from '../components/main/headerActionsSlot';
import { useLanguage } from '../contexts/LanguageContext';
import type { DerivedInvestor, InvestorEconomicsResult, ManagerProfitBreakdown } from '../hooks/useInvestorEconomics';
import type { FirestoreDocumentReference } from '../firebase';
import type { CapitalSnapshot, InvestorBreakdown } from '../utils/capitalSnapshot';
import { calculateWithdrawableProfit, wholeDzdDown } from '../utils/profitDistribution';
interface InvestorsPageProps {
    investors: DerivedInvestor[];
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
    periodLock?: Omit<PeriodLockCardProps, 'setAlert' | 'nowMs'>;
}
type InvestorsStats = {
    totalCapital: number;
    totalProfitDistributed: number;
    totalAvailable: number;
    managerFee: number;
    totalWithdrawn: number;
    activeCount: number;
    totalDeliveryExpenses: number;
    totalDebtWriteOffs: number;
    netDistributableProfit: number;
};
export const InvestorsPage: React.FC<InvestorsPageProps> = ({ investors, capitalSnapshot, investorBreakdown, onOpenInvestor, onAddInvestor, onEditInvestor, onDeleteInvestor, investorEconomicsTotals, managerFeePercentage, saveManagerFeePercentage, userDocRef, setAlert, treasuryStats, managerProfitBreakdown, periodLock }) => {
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
        const totalDebtWriteOffs = investorEconomicsTotals.totalDebtWriteOffs || 0;
        const netDistributableProfit = investorEconomicsTotals.netDistributableProfit || 0;
        return { totalCapital, totalProfitDistributed, totalAvailable, managerFee, totalWithdrawn, activeCount, totalDeliveryExpenses, totalDebtWriteOffs, netDistributableProfit }; // netDistributableProfit used for distribution banner
    }, [investors, investorBreakdown, investorEconomicsTotals]);
    const displayedTotalAvailable = useMemo(
        () => investors
            .filter((investor) => !investor.isManager)
            .reduce((sum, investor) => sum + Number(investor.displayAvailableProfit || 0), 0),
        [investors]
    );
    const displayedStats = useMemo(() => ({ ...stats, totalAvailable: displayedTotalAvailable }), [stats, displayedTotalAvailable]);
    const [isCommissionModalOpen, setIsCommissionModalOpen] = useState(false);
    const [isDistributionOpen, setIsDistributionOpen] = useState(false);
    const distributableInvestors = useMemo(() => investors.filter((investor) => !investor.isManager), [investors]);
    // What the payout plan can pay: active investors' positive balances. The page total above
    // also counts archived investors and negative balances, which the plan never pays.
    const withdrawableProfit = useMemo(() => calculateWithdrawableProfit(distributableInvestors), [distributableInvestors]);
    const handleSaveCommission = useCallback(async (nextValue: string) => {
        await saveManagerFeePercentage(nextValue);
        setAlert(t('investors.rateSaved') as string);
        setIsCommissionModalOpen(false);
    }, [saveManagerFeePercentage, setAlert, t]);
    const headerActionsSlot = useHeaderActionsSlot();
    const exportPdf = () => exportInvestorsPdf(investors, capitalSnapshot, managerProfitBreakdown);
    const addLabel = t('investorDialog.newInvestor') as string;
    const pdfLabel = t('treasury.exportPdf') as string;
    const headerIconClass = 'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-neutral-700 transition-colors hover:bg-neutral-100 active:scale-95';
    return (<div className="anim-page-in flex flex-col gap-3">
      {/* Phones get these two in the header. */}
      <div className="hidden gap-2 sm:flex">
        <Button onClick={onAddInvestor} variant="primary" size="md" className="font-bold">
          <UserPlusIcon className="h-4 w-4"/>
          <span>{addLabel}</span>
        </Button>
        {investors.length > 0 && (<Button onClick={exportPdf} variant="outline" size="md" className="font-semibold">
            <DownloadCloudIcon className="h-4 w-4"/>
            <span>{pdfLabel}</span>
          </Button>)}
      </div>
      {headerActionsSlot && createPortal(<>
          <button type="button" onClick={onAddInvestor} className={headerIconClass} title={addLabel} aria-label={addLabel}>
            <UserPlusIcon className="h-[22px] w-[22px]"/>
          </button>
          {investors.length > 0 && (<button type="button" onClick={exportPdf} className={headerIconClass} title={pdfLabel} aria-label={pdfLabel}>
              <DownloadCloudIcon className="h-[22px] w-[22px]"/>
            </button>)}
        </>, headerActionsSlot)}

      {/* Distribution reminder when available profits are significant */}
      {withdrawableProfit > 5000 && (<AlertCard tone="info" icon={<BanknotesIcon className="h-5 w-5"/>} title={t('investors.distributeProfits')} detail={<>
            {t('profitDistribution.availableToWithdraw')} : <CurrencyAmount value={wholeDzdDown(withdrawableProfit)} currency="DZD" semantic="plain" size="sm" decimals={0} className="font-semibold"/>
          </>} onAction={() => setIsDistributionOpen(true)} actionLabel={t('investors.viewPlan') as string}/>)}

      <HeroCard label={t('investors.capitalInvested')} value={stats.totalCapital}/>
      <StatTileGrid>
        {capitalSnapshot && (<>
            <StatTile label={t('investors.capitalProject') as string} value={capitalSnapshot.totalCapital}/>
            <StatTile label={t('investors.capitalOwned') as string} value={managerProfitBreakdown?.actualOwnerCapital ?? capitalSnapshot.netOwnedCapital}/>
          </>)}
        <StatTile label={t('investors.profitsToPay') as string} value={displayedStats.totalAvailable} semantic="auto"/>
        <StatTile label={t('investors.managerShare') as string} value={stats.managerFee} semantic="auto"/>
      </StatTileGrid>

      <InvestorsListSection investors={investors} capitalSnapshot={capitalSnapshot} managerProfitBreakdown={managerProfitBreakdown} activeCount={stats.activeCount} onOpenInvestor={onOpenInvestor} onAddInvestor={onAddInvestor} onEditInvestor={onEditInvestor} onDeleteInvestor={onDeleteInvestor}/>

      <InvestorsDetailsCard stats={displayedStats} capitalSnapshot={capitalSnapshot} managerFeePercentage={managerFeePercentage} managerProfitBreakdown={managerProfitBreakdown} onOpenCommissionEditor={() => setIsCommissionModalOpen(true)} reconciliationDifference={investorEconomicsTotals.reconciliationDifference}/>

      {periodLock && (<PeriodLockCard {...periodLock} setAlert={setAlert}/>)}

      <CommissionEditorModal isOpen={isCommissionModalOpen} onClose={() => setIsCommissionModalOpen(false)} value={managerFeePercentage} onSave={handleSaveCommission} managerFeeAmount={stats.managerFee}/>

      <ProfitDistributionSheet
        isOpen={isDistributionOpen}
        onClose={() => setIsDistributionOpen(false)}
        investors={distributableInvestors}
        suggestedTotal={withdrawableProfit}
        userDocRef={userDocRef}
        setAlert={setAlert}
        treasuryStats={treasuryStats}
        periodLockedThrough={periodLock?.lockedThrough ?? null}
      />
    </div>);
};
