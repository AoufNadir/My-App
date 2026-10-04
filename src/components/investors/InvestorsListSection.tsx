import { Fragment } from 'react';
import { SectionCard } from '../cards';
import { EmptyState } from '../ui/EmptyState';
import { Button } from '../ui/Button';
import { CurrencyAmount } from '../financial/CurrencyAmount';
import { UsersIcon } from '../icons/UsersIcon';
import { UserPlusIcon } from '../icons/UserPlusIcon';
import { ChevronRightIcon } from '../icons/ChevronRightIcon';
import { SwipeableListItem } from '../ui/SwipeableListItem';
import { Investor } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import { getNameInitials } from '../../utils/nameUtils';
import type { CapitalSnapshot } from '../../utils/capitalSnapshot';
import type { DerivedInvestor, ManagerProfitBreakdown } from '../../hooks/useInvestorEconomics';
import type { InvestorTerm } from '../../utils/investorTerms';
import { InvestorTermBadge } from './InvestorTermAlert';

export async function exportInvestorsPdf(investors: DerivedInvestor[], capitalSnapshot?: CapitalSnapshot, managerProfitBreakdown?: ManagerProfitBreakdown) {
    const { buildInvestorListPdf, openPdfPrintWindow } = await import('../../utils/pdfReports');
    const rows = investors.map((inv) => ({
        name: inv.name,
        isManager: !!inv.isManager,
        isActive: !!inv.isActive,
        capitalInvested: inv.isManager
            ? Number(managerProfitBreakdown?.actualOwnerCapital ?? capitalSnapshot?.netOwnedCapital ?? inv.capitalInvested ?? 0)
            : Number(inv.capitalInvested || 0),
        availableProfit: inv.isManager ? 0 : Number(inv.displayAvailableProfit || 0),
        withdrawnProfit: Number(inv.withdrawnProfit || 0),
        totalProfit: Number(inv.totalProfit || 0),
        roi: inv.isManager ? null : (inv as any).roi !== null && (inv as any).roi !== undefined ? Number((inv as any).roi) : null,
        entryDate: inv.entryDate || '',
    }));
    const report = buildInvestorListPdf(rows);
    openPdfPrintWindow(report);
}
type InvestorsListSectionProps = {
    investors: DerivedInvestor[];
    capitalSnapshot?: CapitalSnapshot;
    managerProfitBreakdown?: ManagerProfitBreakdown;
    activeCount: number;
    onOpenInvestor: (investor: Investor) => void;
    onAddInvestor?: () => void;
    onEditInvestor: (investor: Investor) => void;
    onDeleteInvestor: (investor: Investor) => void;
    /** Open quarterly terms: a mark next to the investor's name. */
    termsByInvestorId?: ReadonlyMap<string, InvestorTerm>;
};
const pillClass = 'shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-bold leading-none';
export function InvestorsListSection({ investors, capitalSnapshot, managerProfitBreakdown, activeCount, onOpenInvestor, onAddInvestor, onEditInvestor, onDeleteInvestor, termsByInvestorId }: InvestorsListSectionProps) {
    const { t } = useLanguage();
    return (<SectionCard flush title={<>{t('investors.title')} <span className="font-semibold text-neutral-500">· <bdi>{activeCount}</bdi> {t('investors.activeSuffix')}</span></>}>
      {investors.length === 0 ? (<EmptyState icon={<UsersIcon className="h-5 w-5"/>} title={t('emptyStates.investors.title') as string} subtitle={t('emptyStates.investors.subtitle') as string} action={onAddInvestor ? (<Button onClick={onAddInvestor} variant="primary" size="md" className="font-bold">
            <UserPlusIcon className="h-4 w-4"/>
            <span>{t('investorDialog.newInvestor')}</span>
          </Button>) : undefined}/>) : (<div>
          {investors.map((investor) => {
                const isManager = Boolean(investor.isManager);
                const rawAvailableProfit = Number(investor.availableProfit || 0);
                const availableProfit = isManager ? 0 : Number(investor.displayAvailableProfit || 0);
                const requiresRegularization = !isManager && rawAvailableProfit < -0.005;
                const displayedCapital = isManager
                    ? Number(managerProfitBreakdown?.actualOwnerCapital ?? capitalSnapshot?.netOwnedCapital ?? investor.capitalInvested ?? 0)
                    : Number(investor.capitalInvested || 0);
                const hasRoi = !isManager && investor.roi !== null && investor.roi !== undefined;
                const term = termsByInvestorId?.get(investor.id);
                return (<Fragment key={investor.id}>
                  <SwipeableListItem onEdit={() => onEditInvestor(investor)} onDelete={() => onDeleteInvestor(investor)}>
                    <div onClick={() => onOpenInvestor(investor)} className="relative z-10 flex w-full cursor-pointer items-center gap-3 border-t border-border bg-surface px-4 py-3 transition-colors hover:bg-surface-muted">
                      {/* The row opens the investor; this button gives it to the keyboard. */}
                      <button type="button" className="flex min-w-0 flex-1 items-center gap-3 rounded-button text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
                        <span aria-hidden="true" className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${isManager ? 'bg-primary/10 text-primary dark:text-primary-light' : 'bg-surface-muted text-neutral-600'}`}>
                          {getNameInitials(investor.name)}
                        </span>
                        <span className="min-w-0 flex-1">
                          {/* Name and capital share the first line; the profit lines use the full width below. */}
                          <span className="flex items-start justify-between gap-3">
                            <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 pt-0.5">
                              <span className="min-w-0 break-words text-[15px] font-semibold leading-snug text-neutral-900">{investor.name}</span>
                              {isManager && <span className={`${pillClass} bg-financial-debt-bg text-financial-debt`}>{t('investors.manager')}</span>}
                              {!investor.isActive && <span className={`${pillClass} bg-surface-muted text-neutral-600`}>{t('investors.inactive')}</span>}
                              {term && <InvestorTermBadge term={term}/>}
                            </span>
                            <span className="flex shrink-0 flex-col items-end gap-0.5">
                              <CurrencyAmount value={displayedCapital} currency="DZD" semantic="plain" size="md" decimals={0} className="font-semibold"/>
                              <span className="text-xs text-neutral-500">{isManager ? t('investors.ownCapitalShort') : t('investors.capitalShort')}</span>
                            </span>
                          </span>
                          {!isManager && (<span className="mt-0.5 flex min-w-0 flex-wrap items-baseline gap-x-1.5 text-xs">
                              <span className={requiresRegularization ? 'font-semibold text-financial-loss' : 'text-neutral-500'}>
                                {requiresRegularization ? t('investors.balanceToRegularize') : t('investors.availableProfit')}
                              </span>
                              <CurrencyAmount value={requiresRegularization ? Math.abs(availableProfit) : availableProfit} currency="DZD" semantic={requiresRegularization ? 'loss' : 'auto'} size="sm" showSign={!requiresRegularization} decimals={0} className="font-semibold"/>
                            </span>)}
                          {hasRoi && (<span className="mt-0.5 flex min-w-0 flex-wrap items-baseline gap-x-1.5 text-xs">
                              <span className="text-neutral-500">{t('investors.cumulativeReturn')}</span>
                              <span dir="ltr" className={`font-bold tabular-nums ${investor.roi! > 0 ? 'text-financial-profit' : investor.roi! < 0 ? 'text-financial-loss' : 'text-neutral-500'}`}>{investor.roi! > 0 ? '+' : ''}{investor.roi!.toFixed(1)}%</span>
                            </span>)}
                        </span>
                      </button>
                      <ChevronRightIcon aria-hidden="true" className="h-5 w-5 shrink-0 text-neutral-400 rtl:-scale-x-100"/>
                    </div>
                  </SwipeableListItem>
                </Fragment>);
            })}
        </div>)}
    </SectionCard>);
}
