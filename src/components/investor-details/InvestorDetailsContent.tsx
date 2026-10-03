import React, { useMemo } from 'react';
import { ListRow, SectionCard, StatTile, StatTileGrid, type CardTone } from '../cards';
import { Tabs } from '../ui/Tabs';
import { EmptyState } from '../ui/EmptyState';
import { CurrencyAmount } from '../financial/CurrencyAmount';
import { PlusIcon } from '../icons/PlusIcon';
import { MinusIcon } from '../icons/MinusIcon';
import { WalletIcon } from '../icons/WalletIcon';
import { FileSpreadsheetIcon } from '../icons/FileSpreadsheetIcon';
import { ArrowUpRightIcon } from '../icons/ArrowUpRightIcon';
import { RefreshCwIcon } from '../icons/RefreshCwIcon';
import { SwipeableListItem } from '../ui/SwipeableListItem';
import { InvestorTransaction, TreasuryTx } from '../../types';
import { formatNumber } from '../../pages/shared/pageFormat';
import { calculateManagerOwnerCapital, isPersonalExpenseCapitalWithdrawal } from '../../utils/managerCapital';
import { getNameInitials } from '../../utils/nameUtils';
import { useLanguage } from '../../contexts/LanguageContext';
import type { CapitalSnapshot } from '../../utils/capitalSnapshot';
import type { DerivedInvestor, ManagerProfitBreakdown } from '../../hooks/useInvestorEconomics';
import { OwnerProfitBreakdownCard } from '../financial/OwnerProfitSummary';
import { InvestorTxRow } from './InvestorTxRow';
type InvestorDetailsContentProps = {
    investor: DerivedInvestor;
    capitalSnapshot?: CapitalSnapshot;
    managerProfitBreakdown?: ManagerProfitBreakdown;
    orderedTransactions: InvestorTransaction[];
    activeTab: 'overview' | 'history';
    setActiveTab: (tab: 'overview' | 'history') => void;
    onAddCapital: () => void;
    onWithdrawCapital: () => void;
    onWithdrawProfit: () => void;
    onReinvestProfit: () => void;
    onDeleteTransaction: (tx: InvestorTransaction) => void;
    personalExpenses?: TreasuryTx[];
};
type TxMeta = { label: string; isPositive: boolean; icon: React.ReactNode; tone: CardTone };
function getTxMeta(tx: InvestorTransaction, t: (key: string) => any, isManager: boolean, personalExpenses: TreasuryTx[] = []): TxMeta {
    switch (tx.type) {
        case 'profit_distribution':
            return { label: t('investors.txProfitDistribution'), isPositive: true, icon: <PlusIcon className="h-4 w-4"/>, tone: 'profit' };
        case 'withdraw_profit':
            return { label: isManager ? t('investors.txPersonalExpense') : t('investors.txWithdrawProfit'), isPositive: false, icon: <WalletIcon className="h-4 w-4"/>, tone: 'debt' };
        case 'reinvest_profit':
            return { label: isManager ? t('investors.profitsReinvestedInCapital') : t('investors.txReinvestProfit'), isPositive: true, icon: <RefreshCwIcon className="h-4 w-4"/>, tone: 'dzd' };
        case 'deposit_capital':
            return { label: t('investors.txDepositCapital'), isPositive: true, icon: <PlusIcon className="h-4 w-4"/>, tone: 'asset' };
        default:
            if (isManager && isPersonalExpenseCapitalWithdrawal(tx, personalExpenses)) {
                return { label: t('investors.txPersonalExpenseCapital'), isPositive: false, icon: <WalletIcon className="h-4 w-4"/>, tone: 'debt' };
            }
            return { label: t('investors.txWithdrawCapital'), isPositive: false, icon: <MinusIcon className="h-4 w-4"/>, tone: 'neutral' };
    }
}
type Tile = { label: string; value: number; currency: 'DZD'; semantic?: 'auto' | 'plain' | 'loss'; display?: React.ReactNode };
function diffDaysSince(entryDate: string): number {
    const start = new Date(entryDate).getTime();
    if (!Number.isFinite(start)) return 0;
    return Math.max(0, Math.floor((Date.now() - start) / (1000 * 60 * 60 * 24)));
}
export function InvestorDetailsContent({ investor, capitalSnapshot, managerProfitBreakdown, orderedTransactions, activeTab, setActiveTab, onAddCapital, onWithdrawCapital, onWithdrawProfit, onReinvestProfit, onDeleteTransaction, personalExpenses = [] }: InvestorDetailsContentProps) {
    const { t } = useLanguage();
    const currentTotalProfit = investor.totalProfit || 0;
    const currentAvailable = Number(investor.availableProfit || 0);
    const displayedAvailable = Number(investor.displayAvailableProfit ?? currentAvailable);
    const currentWithdrawn = investor.withdrawnProfit || 0;
    const isManager = Boolean(investor.isManager);
    const sharePercentDisplay = formatNumber((investor.sharePercentage || 0) * 100, { min: 2, max: 2 });
    const roiDisplay = (investor as any).roi !== null && (investor as any).roi !== undefined
        ? formatNumber((investor as any).roi, { min: 2, max: 2 })
        : null;
    const managerCapital = useMemo(() => {
        if (!isManager)
            return null;
        return calculateManagerOwnerCapital({
            investor,
            investorTransactions: orderedTransactions,
            personalExpenses,
            profitWithdrawals: investor.profitWithdrawals,
        });
    }, [isManager, investor, orderedTransactions, personalExpenses]);
    const canReinvest = currentAvailable > 0.01;
    const showInvestorOnlyActions = !isManager;
    const requiresRegularization = !isManager && currentAvailable < -0.005;
    const investmentDays = useMemo(() => diffDaysSince(investor.entryDate), [investor.entryDate]);
    const formattedEntryDate = useMemo(() => new Date(investor.entryDate).toLocaleDateString('fr-FR'), [investor.entryDate]);
    const availableFormatted = currentAvailable > 0
        ? currentAvailable.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' DZD'
        : null;
    const managerSecondary: Tile[] = managerProfitBreakdown
        ? [
            { label: t('investors.totalEarned') as string, value: managerProfitBreakdown.ownerTotalProfit, currency: 'DZD', semantic: 'auto' },
            { label: t('investors.openingCapital') as string, value: managerProfitBreakdown.openingCapital, currency: 'DZD', semantic: 'plain' },
            { label: t('investors.totalPersonalExpenses') as string, value: managerProfitBreakdown.totalPersonalExpenses, currency: 'DZD', semantic: 'plain' },
            { label: t('investors.profitsReinvestedInCapital') as string, value: managerProfitBreakdown.retainedProfit, currency: 'DZD', semantic: 'auto' },
        ]
        : [
            { label: t('investors.totalEarned') as string, value: managerCapital?.personalProfitTotal || 0, currency: 'DZD', semantic: 'auto' },
            { label: t('investors.totalPersonalExpenses') as string, value: managerCapital?.personalExpensesTotal || 0, currency: 'DZD', semantic: 'plain' },
            { label: t('investors.profitsReinvestedInCapital') as string, value: managerCapital?.retainedProfit || 0, currency: 'DZD', semantic: 'auto' },
            { label: t('investors.initialCapital') as string, value: managerCapital?.initialCapital || 0, currency: 'DZD', semantic: 'plain' },
            { label: t('investors.capitalAdded') as string, value: managerCapital?.capitalAdditions || 0, currency: 'DZD', semantic: 'plain' },
            { label: t('investors.capitalWithdrawn') as string, value: managerCapital?.capitalWithdrawals || 0, currency: 'DZD', semantic: 'loss' },
        ];
    const investorSecondary: Tile[] = [
        {
            label: requiresRegularization ? t('investors.balanceToRegularize') as string : t('investors.availableProfit') as string,
            value: requiresRegularization ? Math.abs(displayedAvailable) : displayedAvailable,
            currency: 'DZD',
            semantic: requiresRegularization ? 'loss' : 'auto'
        },
        { label: t('investors.totalProfitCumulative') as string, value: currentTotalProfit, currency: 'DZD', semantic: 'auto' },
        { label: t('investors.totalWithdrawn') as string, value: currentWithdrawn, currency: 'DZD', semantic: 'plain' },
        {
            label: t('investors.fundShare') as string,
            value: 0,
            currency: 'DZD',
            display: (<span dir="ltr" className="text-base font-semibold tabular-nums text-neutral-900">
              <bdi>{sharePercentDisplay}</bdi>
              <span className="ms-1 text-[length:max(0.85em,12px)] font-normal opacity-70">%</span>
            </span>),
        },
        {
            label: t('investors.cumulativeReturn') as string,
            value: 0,
            currency: 'DZD',
            display: roiDisplay !== null ? (<span dir="ltr" className={`text-base font-semibold tabular-nums ${(investor as any).roi > 0 ? 'text-financial-profit' : (investor as any).roi < 0 ? 'text-financial-loss' : 'text-neutral-500'}`}>
              <bdi>{(investor as any).roi > 0 ? '+' : ''}{roiDisplay}</bdi>
              <span className="ms-1 text-[length:max(0.85em,12px)] font-normal opacity-70">%</span>
            </span>) : <span className="text-base text-neutral-400">-</span>,
        },
    ];
    const primaryCapitalLabel = isManager ? t('investors.managerOwnedCapital') as string : t('investors.capitalInvested') as string;
    const primaryCapitalValue = isManager ? Number(managerProfitBreakdown?.actualOwnerCapital ?? managerCapital?.ownerCapital ?? capitalSnapshot?.netOwnedCapital ?? 0) : investor.capitalInvested;
    // An investor's available profit sits under the capital; the other figures are tiles.
    const [availableLine, ...investorTiles] = investorSecondary;
    const tiles = isManager ? managerSecondary : investorTiles;
    const statusPill = isManager
        ? { label: t('investors.manager'), className: 'bg-financial-debt-bg text-financial-debt' }
        : investor.isActive
            ? { label: t('investors.active'), className: 'bg-financial-profit-bg text-financial-profit' }
            : { label: t('investors.inactive'), className: 'bg-surface-muted text-neutral-600' };
    const infoRow = 'flex min-h-12 items-center justify-between gap-3 border-t border-border px-4 py-3 first:border-t-0';
    return (<>
      <section aria-label={primaryCapitalLabel} className="rounded-card border border-border bg-surface p-4">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-bold ${isManager ? 'bg-primary/10 text-primary dark:text-primary-light' : 'bg-surface-muted text-neutral-600'}`}>
            {getNameInitials(investor.name)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="text-[13px] font-semibold text-neutral-500">{primaryCapitalLabel}</p>
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${statusPill.className}`}>{statusPill.label}</span>
            </div>
            <CurrencyAmount value={primaryCapitalValue} currency="DZD" semantic="plain" size="hero" decimals={0} className="mt-0.5 block"/>
            <p className="mt-0.5 text-xs text-neutral-500">{String(t('investors.investorSince')).replace('{date}', formattedEntryDate)}</p>
          </div>
        </div>
        {!isManager && (<div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
            <p className={`text-[13px] font-semibold ${requiresRegularization ? 'text-financial-loss' : 'text-neutral-700'}`}>{availableLine.label}</p>
            <CurrencyAmount value={availableLine.value} currency="DZD" semantic={availableLine.semantic ?? 'auto'} size="lg" decimals={0} className="shrink-0"/>
          </div>)}
      </section>

      <StatTileGrid>
        {tiles.map((tile) => (<React.Fragment key={tile.label}>
            <StatTile label={tile.label} value={tile.value} semantic={tile.semantic ?? 'auto'} display={tile.display}/>
          </React.Fragment>))}
      </StatTileGrid>

      {!isManager && <p className="px-1 text-xs text-neutral-500">{t('investors.cumulativeReturnFormula')}</p>}

      {isManager && managerProfitBreakdown && <OwnerProfitBreakdownCard breakdown={managerProfitBreakdown}/>}

      <SectionCard flush title={t('investors.actions')}>
        <ListRow icon={<PlusIcon className="h-5 w-5"/>} tone="profit" title={t('investors.addCapital')} subtitle={t('investors.addCapitalHint')} onClick={onAddCapital}/>
        <ListRow icon={<MinusIcon className="h-5 w-5"/>} tone="neutral" title={t('investors.withdrawCapital')} subtitle={t('investors.withdrawCapitalHint')} onClick={onWithdrawCapital}/>
        {showInvestorOnlyActions && (<ListRow icon={<ArrowUpRightIcon className="h-5 w-5"/>} tone="primary" title={t('investors.withdrawProfit')} subtitle={availableFormatted
                ? <><span dir="ltr" className="font-semibold text-financial-profit">{availableFormatted}</span> {t('investors.availableWord')}</>
                : t('investors.profitTransferHint')} onClick={onWithdrawProfit}/>)}
        {showInvestorOnlyActions && (canReinvest
            ? <ListRow icon={<RefreshCwIcon className="h-5 w-5"/>} tone="dzd" title={t('investors.reinvestProfits')} subtitle={t('investors.reinvestHint')} onClick={onReinvestProfit}/>
            : <ListRow icon={<RefreshCwIcon className="h-5 w-5"/>} tone="neutral" title={t('investors.reinvestProfits')} subtitle={t('investors.noProfitAvailable')} trailing={<span aria-hidden="true" className="text-xs font-bold text-neutral-400">—</span>} disabled/>)}
      </SectionCard>

      <Tabs variant="pills" tabs={[
            { id: 'overview', label: t('investors.overview') as string },
            { id: 'history', label: t('investors.history') as string, badge: orderedTransactions.length }
        ]} activeTab={activeTab} onChange={(id) => setActiveTab(id as 'overview' | 'history')}/>

      {activeTab === 'overview' && (<div role="tabpanel" aria-label={t('investors.overview') as string} className="overflow-hidden rounded-card border border-border bg-surface">
          <div className={infoRow}>
            <span className="text-sm text-neutral-500">{t('investors.status')}</span>
            <span className="flex flex-wrap items-center justify-end gap-1.5">
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${investor.isActive ? 'bg-financial-profit-bg text-financial-profit' : 'bg-surface-muted text-neutral-600'}`}>{investor.isActive ? t('investors.active') : t('investors.inactive')}</span>
              {isManager && (<span className="rounded-full bg-financial-debt-bg px-2 py-0.5 text-xs font-bold text-financial-debt">{t('investors.manager')}</span>)}
            </span>
          </div>
          <div className={infoRow}>
            <span className="text-sm text-neutral-500">{t('investors.entryDate')}</span>
            <span dir="ltr" className="text-sm font-semibold tabular-nums text-neutral-900">{formattedEntryDate}</span>
          </div>
          <div className={infoRow}>
            <span className="text-sm text-neutral-500">{t('investors.investmentDuration')}</span>
            <span className="text-sm font-semibold text-neutral-900">
              <span dir="ltr" className="tabular-nums">{investmentDays}</span> <span className="font-normal text-neutral-500">{t('investors.days')}</span>
            </span>
          </div>
          {!isManager && (<div className={infoRow}>
              <span className="text-sm text-neutral-500">{t('investors.fundShare')}</span>
              <span dir="ltr" className="text-sm font-semibold tabular-nums text-neutral-900">
                <bdi>{sharePercentDisplay}</bdi>
                <span className="ms-1 text-[length:max(0.85em,12px)] font-normal opacity-70">%</span>
              </span>
            </div>)}
          {investor.notes && (<div className="border-t border-border px-4 py-3">
              <p className="text-xs font-semibold text-neutral-500">{t('investors.notes')}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">{investor.notes}</p>
            </div>)}
        </div>)}

      {activeTab === 'history' && (<div role="tabpanel" aria-label={t('investors.history') as string} className="overflow-hidden rounded-card border border-border bg-surface">
          {orderedTransactions.length === 0 ? (<EmptyState icon={<FileSpreadsheetIcon className="h-5 w-5"/>} title={t('investors.noTransactions') as string}/>) : (<div>
              {orderedTransactions.map((tx) => {
                    const meta = getTxMeta(tx, t, isManager, personalExpenses);
                    const signedAmount = (meta.isPositive ? 1 : -1) * Math.abs(tx.amount);
                    return (<div key={tx.id} className="border-t border-border first:border-t-0">
                      <SwipeableListItem onDelete={() => onDeleteTransaction(tx)}>
                        <InvestorTxRow icon={meta.icon} tone={meta.tone} label={meta.label} date={tx.date} time={tx.time} notes={tx.notes} amount={signedAmount}/>
                      </SwipeableListItem>
                    </div>);
                })}
            </div>)}
        </div>)}
    </>);
}
