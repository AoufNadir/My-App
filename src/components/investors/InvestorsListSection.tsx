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

async function exportInvestorsPdf(investors: Investor[]) {
    const { buildInvestorListPdf, openPdfPrintWindow } = await import('../../utils/pdfReports');
    const rows = investors.map((inv) => ({
        name: inv.name,
        isManager: !!inv.isManager,
        isActive: !!inv.isActive,
        capitalInvested: Number(inv.capitalInvested || 0),
        availableProfit: Number(inv.availableProfit || 0),
        withdrawnProfit: Number(inv.withdrawnProfit || 0),
        totalProfit: Number(inv.totalProfit || 0),
        roi: (inv as any).roi !== null && (inv as any).roi !== undefined ? Number((inv as any).roi) : null,
        entryDate: inv.entryDate || '',
    }));
    const report = buildInvestorListPdf(rows);
    openPdfPrintWindow(report);
}
type InvestorsListSectionProps = {
    investors: Investor[];
    activeCount: number;
    onOpenInvestor: (investor: Investor) => void;
    onEditInvestor: (investor: Investor) => void;
    onDeleteInvestor: (investor: Investor) => void;
};
export function InvestorsListSection({ investors, activeCount, onOpenInvestor, onEditInvestor, onDeleteInvestor }: InvestorsListSectionProps) {
    const { t } = useLanguage();
    return (<Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 border-b border-border p-4">
        <SectionHeading icon={<UsersIcon className="w-4 h-4"/>}>
          {t('investors.list')}
        </SectionHeading>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="primary" size="sm">{activeCount} {t('investors.active')}</Badge>
          {investors.length > 0 && (
            <Button onClick={() => exportInvestorsPdf(investors)} variant="icon" size="icon" className="rounded-button bg-neutral-100 hover:bg-neutral-200" aria-label={t('investors.exportPdf') as string} title={t('investors.exportPdf') as string}>
              <DownloadCloudIcon className="w-4 h-4"/>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {investors.length === 0 ? (<EmptyState icon={<UsersIcon className="w-6 h-6"/>} title={t('investors.emptyTitle') as string} subtitle={t('investors.emptySubtitle') as string}/>) : (<div className="divide-y divide-neutral-100">
            {investors.map((investor) => {
                const availableProfit = Number(investor.availableProfit || 0);
                return (<React.Fragment key={investor.id}>
                  <SwipeableListItem onEdit={() => onEditInvestor(investor)} onDelete={() => onDeleteInvestor(investor)}>
                    <div onClick={() => onOpenInvestor(investor)} className="group flex min-h-touch w-full cursor-pointer items-center justify-between gap-3 bg-surface p-4 transition-colors hover:bg-neutral-50">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-lg font-bold text-secondary">
                          {investor.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                          <h3 className="break-words text-base font-semibold">{investor.name}</h3>
                          {investor.isManager && (<Badge variant="warning" size="sm">{t('investors.manager')}</Badge>)}
                          {!investor.isActive && (<Badge variant="neutral" size="sm">{t('investors.inactive')}</Badge>)}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-3 text-end">
                        <div>
                          <div className="text-xs font-medium text-neutral-500">{t('financialTerms.investorCapital')}</div>
                          <CurrencyAmount value={investor.capitalInvested} currency="DZD" size="lg" decimals={0}/>
                          <div className="mt-1 text-xs font-medium text-neutral-500">{t('financialTerms.unwithdrawnProfit')}</div>
                          <div>
                            <CurrencyAmount value={availableProfit} currency="DZD" semantic="auto" size="md" showSign decimals={0}/>
                          </div>
                          {(investor as any).roi !== null && (investor as any).roi !== undefined && (<div className={`mt-0.5 text-xs font-bold tabular-nums ${(investor as any).roi > 0 ? 'text-financial-profit' : (investor as any).roi < 0 ? 'text-financial-loss' : 'text-neutral-400'}`} dir="ltr">
                            {(investor as any).roi > 0 ? '+' : ''}{((investor as any).roi as number).toFixed(1)}% ROI
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
