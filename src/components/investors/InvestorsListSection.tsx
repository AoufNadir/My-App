import React from 'react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { SectionHeading } from '../ui/SectionHeading';
import { EmptyState } from '../ui/EmptyState';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { CurrencyAmount } from '../financial/CurrencyAmount';
import { UsersIcon } from '../icons/UsersIcon';
import { ChevronRightIcon } from '../icons/ChevronRightIcon';
import { DownloadCloudIcon } from '../icons/DownloadCloudIcon';
import { SwipeableListItem } from '../ui/SwipeableListItem';
import { Investor } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import type { CapitalSnapshot } from '../../utils/capitalSnapshot';
import type { DerivedInvestor, ManagerProfitBreakdown } from '../../hooks/useInvestorEconomics';

async function exportInvestorsPdf(investors: DerivedInvestor[], capitalSnapshot?: CapitalSnapshot, managerProfitBreakdown?: ManagerProfitBreakdown) {
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
    onEditInvestor: (investor: Investor) => void;
    onDeleteInvestor: (investor: Investor) => void;
};
export function InvestorsListSection({ investors, capitalSnapshot, managerProfitBreakdown, activeCount, onOpenInvestor, onEditInvestor, onDeleteInvestor }: InvestorsListSectionProps) {
    const { t } = useLanguage();
    return (<Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 border-b border-border p-4">
        <SectionHeading icon={<UsersIcon className="w-4 h-4"/>}>
          {t('investors.title')}
        </SectionHeading>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="primary" size="sm">{activeCount} {t('investors.activeSuffix')}</Badge>
          {investors.length > 0 && (
            <Button onClick={() => exportInvestorsPdf(investors, capitalSnapshot, managerProfitBreakdown)} variant="icon" size="icon" className="rounded-button bg-neutral-100 hover:bg-neutral-200" aria-label={t('treasury.exportPdf')} title={t('treasury.exportPdf')}>
              <DownloadCloudIcon className="w-4 h-4"/>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {investors.length === 0 ? (<EmptyState icon={<UsersIcon className="w-6 h-6"/>} title={t('emptyStates.investors.title') as string} subtitle={t('emptyStates.investors.subtitle') as string}/>) : (<div className="divide-y divide-neutral-100">
            {investors.map((investor) => {
                const isManager = Boolean(investor.isManager);
                const rawAvailableProfit = Number(investor.availableProfit || 0);
                const availableProfit = isManager ? 0 : Number(investor.displayAvailableProfit || 0);
                const requiresRegularization = !isManager && rawAvailableProfit < -0.005;
                const displayedCapital = isManager
                    ? Number(managerProfitBreakdown?.actualOwnerCapital ?? capitalSnapshot?.netOwnedCapital ?? investor.capitalInvested ?? 0)
                    : Number(investor.capitalInvested || 0);
                return (<React.Fragment key={investor.id}>
                  <SwipeableListItem onEdit={() => onEditInvestor(investor)} onDelete={() => onDeleteInvestor(investor)}>
                    <div onClick={() => onOpenInvestor(investor)} className="group flex min-h-touch w-full cursor-pointer items-center justify-between gap-3 bg-surface p-4 transition-colors hover:bg-neutral-50">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-lg font-bold text-secondary">
                          {investor.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex min-w-0 items-center gap-1.5">
                          <h3 className="text-base font-semibold truncate">{investor.name}</h3>
                          {investor.isManager && (<Badge variant="warning" size="sm">{t('investors.manager')}</Badge>)}
                          {!investor.isActive && (<Badge variant="neutral" size="sm">{t('investors.inactive')}</Badge>)}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-3 text-end">
                        <div>
                          <CurrencyAmount value={displayedCapital} currency="DZD" size="lg" decimals={0}/>
                          {!isManager && (
                            <div className="mt-1 flex items-baseline justify-end gap-1.5">
                              <span className={`text-[10px] font-semibold ${requiresRegularization ? 'text-financial-loss' : 'text-neutral-400'}`}>
                                {requiresRegularization ? t('investors.balanceToRegularize') : t('investors.availableProfit')}
                              </span>
                              <CurrencyAmount value={requiresRegularization ? Math.abs(availableProfit) : availableProfit} currency="DZD" semantic={requiresRegularization ? 'loss' : 'auto'} size="md" showSign={!requiresRegularization} decimals={0}/>
                            </div>
                          )}
                          {!isManager && investor.roi !== null && investor.roi !== undefined && (<div className={`mt-0.5 flex items-baseline justify-end gap-1 text-[10px] font-bold tabular-nums ${investor.roi > 0 ? 'text-financial-profit' : investor.roi < 0 ? 'text-financial-loss' : 'text-neutral-400'}`} dir="ltr">
                            <span className="text-neutral-400">{t('investors.cumulativeReturn')}</span>
                            <span>{investor.roi > 0 ? '+' : ''}{investor.roi.toFixed(1)}%</span>
                          </div>)}
                        </div>
                        <ChevronRightIcon className="w-5 h-5 text-neutral-400"/>
                      </div>
                    </div>
                  </SwipeableListItem>
                </React.Fragment>);
            })}
          </div>)}
      </CardContent>
    </Card>);
}
