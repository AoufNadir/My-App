import React from 'react';
import { SectionCard } from '../cards';
import { CurrencyAmount } from '../financial/CurrencyAmount';
import { PencilIcon } from '../icons/PencilIcon';
import { AlertTriangleIcon } from '../icons/AlertTriangleIcon';
import { CheckIcon } from '../icons/CheckIcon';
import { useLanguage } from '../../contexts/LanguageContext';
import type { CapitalSnapshot } from '../../utils/capitalSnapshot';
import type { ManagerProfitBreakdown } from '../../hooks/useInvestorEconomics';
type InvestorsStats = {
    totalCapital: number;
    totalProfitDistributed: number;
    totalAvailable: number;
    managerFee: number;
    totalWithdrawn: number;
    totalDeliveryExpenses?: number;
    totalDebtWriteOffs?: number;
    netDistributableProfit?: number;
};
type InvestorsDetailsCardProps = {
    stats: InvestorsStats;
    capitalSnapshot?: CapitalSnapshot;
    managerFeePercentage: string;
    managerProfitBreakdown?: ManagerProfitBreakdown;
    onOpenCommissionEditor: () => void;
    reconciliationDifference?: number;
};
/** One group of the summary: a small heading over its rows. */
function DetailGroup({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
    return (<div className="border-t border-border pt-2 first:border-t-0 first:pt-0">
      <h3 className="text-xs font-bold text-neutral-500">{title}</h3>
      <div className="mt-0.5">{children}</div>
    </div>);
}
function DetailRow({ label, value, semantic = 'auto', hideWhenZero = false }: { label: string; value: number; semantic?: 'auto' | 'loss' | 'plain'; hideWhenZero?: boolean }) {
    if (hideWhenZero && Math.abs(value) < 0.005)
        return null;
    return (<div className="flex min-h-10 items-center justify-between gap-3 py-1.5">
      <span className="min-w-0 text-[13px] text-neutral-600">{label}</span>
      <CurrencyAmount value={value} currency="DZD" semantic={semantic} size="md" decimals={0} className="shrink-0 font-semibold"/>
    </div>);
}
export function InvestorsDetailsCard({ stats, capitalSnapshot, managerFeePercentage, managerProfitBreakdown, onOpenCommissionEditor, reconciliationDifference = 0 }: InvestorsDetailsCardProps) {
    const { t } = useLanguage();
    const hasProjectCosts = (stats.totalDeliveryExpenses ?? 0) > 0 || (stats.totalDebtWriteOffs ?? 0) > 0;
    const hasReconciliationIssue = Math.abs(reconciliationDifference) > 0.01;
    const displayPercentage = managerFeePercentage?.trim() ? managerFeePercentage : '0';
    const ownerCapital = Number(managerProfitBreakdown?.actualOwnerCapital ?? capitalSnapshot?.netOwnedCapital ?? 0);
    return (<SectionCard title={t('investors.financialSummary')}>
      <div className="flex flex-col gap-2">
        {capitalSnapshot && (<DetailGroup title={t('investors.projectAssets')}>
            <DetailRow label={t('investors.capitalProject') as string} value={capitalSnapshot.totalCapital} semantic="plain"/>
            <DetailRow label={t('finance.liquidity') as string} value={capitalSnapshot.cashTotal} semantic="plain"/>
            <DetailRow label={t('finance.stock') as string} value={capitalSnapshot.stockValue} semantic="plain"/>
            <DetailRow label={t('finance.netPosition') as string} value={capitalSnapshot.netClientPosition} semantic="auto"/>
            <DetailRow label={t('finance.treasuryCards') as string} value={capitalSnapshot.treasuryCardsTotal} semantic="plain" hideWhenZero/>
            <DetailRow label={t('finance.servicesNetPosition') as string} value={capitalSnapshot.servicesCapitalImpact} semantic="auto" hideWhenZero/>
            <DetailRow label={t('personalExpenses.personalAdvance') as string} value={capitalSnapshot.managerPendingAdvances} semantic="plain" hideWhenZero/>
          </DetailGroup>)}
        <DetailGroup title={t('investors.investorsAndProfits')}>
          <DetailRow label={t('investors.capitalInvested') as string} value={stats.totalCapital} semantic="plain"/>
          <DetailRow label={t('investors.profitsToPay') as string} value={stats.totalAvailable} semantic="auto"/>
        </DetailGroup>
        {(managerProfitBreakdown || capitalSnapshot) && (<DetailGroup title={t('investors.netPart')}>
            <DetailRow label={t('investors.capitalOwned') as string} value={ownerCapital} semantic="plain"/>
          </DetailGroup>)}
        <DetailGroup title={t('investors.result')}>
          <DetailRow label={t('investors.managerShare') as string} value={stats.managerFee} semantic="auto"/>
          {!hasProjectCosts && (<DetailRow label={t('investors.attributedProfit') as string} value={stats.totalProfitDistributed} semantic="auto"/>)}
          <button type="button" onClick={onOpenCommissionEditor} className="-mx-2 flex min-h-touch w-[calc(100%+1rem)] items-center justify-between gap-3 rounded-button px-2 text-start transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <span className="text-[13px] text-neutral-600">{t('investors.managerCommissionRate')}</span>
            <span className="flex items-center gap-1.5">
              <span dir="ltr" className="text-sm font-bold text-primary dark:text-primary-light">
                <bdi>{displayPercentage}</bdi>
                <span className="ms-0.5 text-[length:max(0.85em,12px)] font-semibold opacity-80">%</span>
              </span>
              <PencilIcon aria-hidden="true" className="h-4 w-4 text-neutral-400"/>
            </span>
          </button>
          {hasProjectCosts && (<>
              <DetailRow label={t('investors.deliveryExpenses') as string} value={stats.totalDeliveryExpenses || 0} semantic="loss" hideWhenZero/>
              <DetailRow label={t('investors.debtWriteOffs') as string} value={stats.totalDebtWriteOffs || 0} semantic="loss" hideWhenZero/>
              <DetailRow label={t('investors.netDistributableProfit') as string} value={stats.netDistributableProfit || 0} semantic="auto"/>
            </>)}
        </DetailGroup>
        <div className={`mt-1 flex items-start gap-2 rounded-button px-3 py-2.5 ${hasReconciliationIssue ? 'bg-financial-loss-bg' : 'bg-financial-profit-bg'}`}>
          {hasReconciliationIssue
            ? <AlertTriangleIcon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-financial-loss"/>
            : <CheckIcon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-financial-profit"/>}
          <div className="min-w-0">
            {hasReconciliationIssue ? (<>
              <p className="text-xs font-bold text-neutral-900">{t('investors.reconciliationGap')}</p>
              <p className="mt-0.5 text-xs text-neutral-700">
                <CurrencyAmount value={reconciliationDifference} currency="DZD" semantic="loss" size="sm" decimals={2} className="font-semibold"/> - {t('investors.reconciliationBody')}
              </p>
            </>) : <p className="text-xs font-bold text-neutral-900">{t('investors.reconciliationOk')}</p>}
          </div>
        </div>
      </div>
    </SectionCard>);
}
