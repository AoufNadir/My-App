import { useMemo, type ReactNode } from 'react';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { SectionHeading } from '../components/ui/SectionHeading';
import { CurrencyAmount } from '../components/financial/CurrencyAmount';
import { CapitalOverviewCard } from '../components/financial/CapitalOverviewCard';
import { ArrowRightLeftIcon } from '../components/icons/ArrowRightLeftIcon';
import { ChevronRightIcon } from '../components/icons/ChevronRightIcon';
import { SparklesIcon } from '../components/icons/SparklesIcon';
import { TrendingUpIcon } from '../components/icons/TrendingUpIcon';
import { WalletIcon } from '../components/icons/WalletIcon';
import { TransactionDisplayList } from '../components/transactions/TransactionDisplayList';
import { useTransactionsViewModel } from '../components/transactions/useTransactionsViewModel';
import { Skeleton } from '../components/ui/Skeleton';
import type { DisplayTx, TransactionFilterMode } from '../components/transactions/transactionsTypes';
import type { ClientDzd, ClientTransactionDzd, OverdueDebtClient, TreasuryCard, TreasuryTx, Tx } from '../types';
import type { CapitalSnapshot } from '../utils/capitalSnapshot';
import type { PamLedgerResult } from '../utils/pamLedger';
import type { ManagerProfitBreakdown } from '../hooks/useInvestorEconomics';
import { OwnerProfitPeriodSummary, type FinancialAuditData } from '../components/financial/OwnerProfitSummary';
import { useLanguage } from '../contexts/LanguageContext';
const RECENT_TRANSACTION_LIMIT = 5;
const EMPTY_RECENT_DATE_RANGE = { start: null, end: null };
const ignoreRecentFilterChange = (_mode: TransactionFilterMode) => undefined;
const ignoreRecentDateChange = (_range: { start: Date | null; end: Date | null }) => undefined;
type DashboardPageProps = {
    managerProfitBreakdown: ManagerProfitBreakdown;
    financialAudit: FinancialAuditData;
    dailyOverview: {
        caisse: number;
        baridi: number;
        activeClients: number;
        todayProfit: number;
        todaySellCount?: number;
        weekToDateProfit?: number;
        monthToDateProfit: number;
        yearToDateProfit: number;
        allTimeProfit: number;
        todayUsdtSold: number;
        todayEurSold: number;
        monthToDateUsdtSold: number;
        monthToDateEurSold: number;
        yearToDateUsdtSold: number;
        yearToDateEurSold: number;
        allTimeUsdtSold: number;
        allTimeEurSold: number;
        ownerProfitToday: number;
        ownerProfitWeek: number;
        ownerProfitMonth: number;
        ownerProfitYear: number;
        ownerProfitAllTime: number;
        last7DaysProfit?: number[];
    };
    portfolioStats: any;
    treasuryStats: any;
    totals: any;
    treasuryCards: TreasuryCard[];
    investorLiability?: number;
    investorBreakdown?: { capital: number; profits: number; total: number };
    capitalSnapshot: CapitalSnapshot;
    servicesSummary?: {
        netCapitalImpact?: number;
    };
    globalNetProfit: number;
    overdueDebtClients: OverdueDebtClient[];
    isDataReady: boolean;
    onNewTransaction: () => void;
    onOpenClients: () => void;
    onOpenClient: (clientId: string) => void;
    onOpenClientDebts: () => void;
    onOpenTreasury: () => void;
    onOpenAnalytics: () => void;
    onOpenPersonalWithdrawal?: () => void;
    transactions: Tx[];
    clientTransactionsDzd: ClientTransactionDzd[];
    clientsDzd: ClientDzd[];
    treasuryTransactions: TreasuryTx[];
    profitByTxId: PamLedgerResult['profitByTxId'];
    getRelativeDateLabel: (dateString: string) => string;
    getClientFullName: (client: ClientDzd) => string;
    openForm: (newMode: 'buy_usdt' | 'sell_usdt' | 'buy_eur' | 'sell_eur', txToEdit?: Tx | null) => void;
    openAdjustmentModal: (type: 'add' | 'subtract', txToEdit?: TreasuryTx | null) => void;
    setTxToDelete: (tx: Tx | null) => void;
    handleEditPortfolioTx?: (tx: Tx) => void;
    handleEditClientTx?: (tx: ClientTransactionDzd) => void;
    handleEditTreasuryTx?: (tx: TreasuryTx) => void;
    handleDeleteClientTxClick?: (tx: ClientTransactionDzd) => void;
    setTreasuryTxToDelete?: (tx: TreasuryTx | null) => void;
    onOpenTransactions?: () => void;
    onQuickSell?: () => void;
    quickSellPreview?: { qty: number; price: number; pam: number } | null;
    onOpenMonthPlan?: () => void;
    monthlyGoal?: number;
    /** Avg monthly USDT volume (90d ÷ 3) — drives the required-margin chip. */
};
type Tone = 'success' | 'warning' | 'danger' | 'info';
type PriorityItem = {
    id: string;
    title: string;
    body: ReactNode;
    tone: Tone;
    rank?: number;
    action?: () => void;
    actionLabel?: string;
};
const PRIORITY_TONE_CLASSES: Record<Tone, {
    item: string;
    title: string;
    body: string;
    action: string;
    badge: string;
}> = {
    danger: {
        item: 'border border-border border-s-4 border-s-danger/70 bg-surface text-neutral-900 shadow-sm',
        title: 'text-neutral-900',
        body: 'text-neutral-700',
        action: 'border border-danger/20 bg-surface text-danger',
        badge: 'bg-danger/10 text-danger',
    },
    warning: {
        item: 'border border-border border-s-4 border-s-warning/70 bg-surface text-neutral-900 shadow-sm',
        title: 'text-neutral-900',
        body: 'text-neutral-700',
        action: 'border border-warning/25 bg-surface text-warning',
        badge: 'bg-warning/10 text-warning',
    },
    success: {
        item: 'border border-border border-s-4 border-s-success/70 bg-surface text-neutral-900 shadow-sm',
        title: 'text-neutral-900',
        body: 'text-neutral-700',
        action: 'border border-success/20 bg-surface text-success',
        badge: 'bg-success/10 text-success',
    },
    info: {
        item: 'border border-border border-s-4 border-s-info/70 bg-surface text-neutral-900 shadow-sm',
        title: 'text-neutral-900',
        body: 'text-neutral-700',
        action: 'border border-info/20 bg-surface text-info',
        badge: 'bg-info/10 text-info',
    },
};
function toneClasses(tone: Tone): typeof PRIORITY_TONE_CLASSES[Tone] {
    return PRIORITY_TONE_CLASSES[tone];
}
function renderDebtPriorityBody(template: string, amount: number, days: number, date: string) {
    return (<>
      {template.split(/(\{amount\}|\{days\}|\{date\})/g).map((part, index) => {
            if (part === '{amount}') {
                return <CurrencyAmount key={index} value={amount} currency="DZD" decimals={2} size="sm" className="font-semibold text-danger"/>;
            }
            if (part === '{days}') {
                return <span key={index} dir="ltr" className="tabular-nums">{days}</span>;
            }
            if (part === '{date}') {
                return <span key={index} dir="ltr" className="tabular-nums">{date}</span>;
            }
            return part;
        })}
    </>);
}
function PriorityList({ title, items, onTitleClick, }: {
    title: string;
    items: PriorityItem[];
    onTitleClick?: () => void;
}) {
    const renderItemContent = (item: PriorityItem, tone: typeof PRIORITY_TONE_CLASSES[Tone]) => (<div className="flex min-w-0 items-start gap-3">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold tabular-nums ${tone.badge}`}>
        {item.rank ?? <SparklesIcon className="h-4 w-4"/>}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`min-w-0 truncate text-base font-bold leading-snug ${tone.title}`}>{item.title}</p>
        <p className={`mt-1 text-sm leading-relaxed ${tone.body}`}>{item.body}</p>
      </div>
      {item.action && item.actionLabel && (<span className={`inline-flex min-h-8 shrink-0 items-center justify-center rounded-full px-3 text-xs font-bold ${tone.action}`}>
        {item.actionLabel}
      </span>)}
    </div>);
    return (<Card>
      <CardHeader className="p-4 pb-3">
        {onTitleClick ? (<button type="button" onClick={onTitleClick} className="w-full min-h-touch text-start rounded-md transition-opacity hover:opacity-85 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <SectionHeading icon={<SparklesIcon className="w-4 h-4"/>}>{title}</SectionHeading>
          </button>) : (<SectionHeading icon={<SparklesIcon className="w-4 h-4"/>}>{title}</SectionHeading>)}
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-2">
        {items.map((item) => {
            const tone = toneClasses(item.tone);
            return item.action ? (<button key={item.id} type="button" onClick={item.action} className={`w-full rounded-xl p-3 text-start transition-all hover:border-border-strong hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.99] ${tone.item}`}>
              {renderItemContent(item, tone)}
            </button>) : (<div key={item.id} className={`rounded-xl p-3 ${tone.item}`}>
              {renderItemContent(item, tone)}
            </div>);
        })}
      </CardContent>
    </Card>);
}
function SmartPricingShortcut({ title, subtitle, onClick }: {
    title: string;
    subtitle: string;
    onClick: () => void;
}) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3 rounded-card border border-primary/15 bg-surface px-4 py-3 text-start shadow-card transition-all hover:border-primary/25 hover:bg-primary/[0.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.99]"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <SparklesIcon className="h-5 w-5"/>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-extrabold text-primary">{title}</span>
          <span className="mt-0.5 block truncate text-xs font-medium text-neutral-500">{subtitle}</span>
        </span>
        <ChevronRightIcon className="h-5 w-5 shrink-0 text-primary/45"/>
      </button>
    );
}
type DashboardMetricCellProps = {
    label: string;
    value: number;
    currency?: 'DZD' | 'USDT' | 'EUR';
    semantic?: 'auto' | 'plain' | 'profit' | 'loss';
};
function renderDashboardMetricCell({ label, value, currency = 'DZD', semantic = 'auto' }: DashboardMetricCellProps) {
    return (
      <div className="min-w-0 rounded-xl border border-border bg-surface-muted px-3 py-3">
        <p className="mb-2 truncate text-[11px] font-semibold text-neutral-500">{label}</p>
        <CurrencyAmount value={value} currency={currency} semantic={semantic} size="lg" decimals={currency === 'DZD' ? 0 : 2}/>
      </div>
    );
}
function SalesProfitSummary({ title, periods }: {
    title: string;
    periods: {
        today: number;
        week: number;
        month: number;
        year: number;
    };
}) {
    const { t } = useLanguage();
    const rows = [
        { label: t('dashboard.profitToday') as string, value: periods.today },
        { label: t('dashboard.thisWeek') as string, value: periods.week },
        { label: t('dashboard.profitMonth') as string, value: periods.month },
        { label: t('dashboard.profitYear') as string, value: periods.year },
    ];
    return (
      <Card>
        <CardHeader className="p-4 pb-3">
          <SectionHeading icon={<TrendingUpIcon className="w-4 h-4"/>}>{title}</SectionHeading>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {rows.map((row) => (
              <div key={row.label} className="contents">
                {renderDashboardMetricCell({ label: row.label, value: row.value })}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
}
type QuickSituationMetricRow = {
    type: 'metric';
    label: string;
    value: number;
    currency?: 'DZD' | 'USDT' | 'EUR';
    semantic?: 'auto' | 'plain' | 'profit' | 'loss';
    emphasis?: boolean;
};
type QuickSituationSectionRow = {
    type: 'section';
    id: string;
    label: string;
};
type QuickSituationRow = QuickSituationMetricRow | QuickSituationSectionRow;
function QuickSituationCard({ title, rows }: {
    title: string;
    rows: QuickSituationRow[];
}) {
    return (
      <Card>
        <CardHeader className="p-4 pb-3">
          <SectionHeading icon={<WalletIcon className="w-4 h-4"/>}>{title}</SectionHeading>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {rows.map((row) => {
              if (row.type === 'section') {
                return (
                  <div key={row.id} className="bg-surface-muted/55 px-4 py-2 text-[11px] font-bold uppercase tracking-normal text-neutral-500">
                    {row.label}
                  </div>
                );
              }
              return (
                <div key={row.label} className={`flex min-h-[58px] items-center justify-between gap-4 px-4 py-3 ${row.emphasis ? 'bg-surface-muted' : 'bg-surface'}`}>
                  <span className="min-w-0 text-sm font-semibold text-neutral-600">{row.label}</span>
                  <CurrencyAmount
                    value={row.value}
                    currency={row.currency ?? 'DZD'}
                    semantic={row.semantic ?? 'plain'}
                    size="lg"
                    decimals={(row.currency ?? 'DZD') === 'DZD' ? 0 : 2}
                    className="shrink-0"
                  />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
}
function DashboardLoadingState() {
    return (<div className="anim-page-in space-y-5" aria-busy="true" aria-label="Chargement des donnees financieres">
      <div className="rounded-card border border-border bg-surface p-5">
        <Skeleton width="34%" height={14}/>
        <Skeleton width="58%" height={38} className="mt-4"/>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (<div key={index}>
            <Skeleton width="64%" height={11}/>
            <Skeleton width="88%" height={24} className="mt-2"/>
          </div>))}
        </div>
      </div>
      <Skeleton height={180}/>
    </div>);
}

export function DashboardPage(props: DashboardPageProps) {
    if (!props.isDataReady)
        return <DashboardLoadingState/>;
    return <DashboardContent {...props}/>;
}
function DashboardContent({
    dailyOverview,
    portfolioStats,
    capitalSnapshot,
    investorBreakdown,
    overdueDebtClients,
    onOpenClient,
    onOpenClientDebts,
    onOpenTreasury,
    onOpenAnalytics,
    transactions,
    clientTransactionsDzd,
    clientsDzd,
    treasuryTransactions,
    profitByTxId,
    getRelativeDateLabel,
    getClientFullName,
    openForm,
    openAdjustmentModal,
    setTxToDelete,
    handleEditPortfolioTx,
    handleEditClientTx,
    handleEditTreasuryTx,
    handleDeleteClientTxClick,
    setTreasuryTxToDelete,
    onOpenTransactions,
    onOpenMonthPlan,
    monthlyGoal = 0,
}: DashboardPageProps) {
    const { t } = useLanguage();
    const {
        groupedTransactions: recentGroupedTransactions,
        formatDzdAmount: formatRecentDzdAmount,
        handleEditDisplayTx: handleOpenRecentDisplayTx,
        handleDeleteDisplayTx: handleDeleteRecentDisplayTx,
        profitByTxId: recentProfitByTxId,
    } = useTransactionsViewModel({
        t: t as (key: string) => string,
        filterMode: 'all',
        setFilterMode: ignoreRecentFilterChange,
        dateRange: EMPTY_RECENT_DATE_RANGE,
        setDateRange: ignoreRecentDateChange,
        transactions,
        clientTransactionsDzd,
        clientsDzd,
        treasuryTransactions,
        getClientFullName,
        openForm,
        openAdjustmentModal,
        setTxToDelete,
        handleEditPortfolioTx,
        handleEditClientTx,
        handleEditTreasuryTx,
        handleDeleteClientTxClick,
        setTreasuryTxToDelete,
        resultLimit: RECENT_TRANSACTION_LIMIT,
        providedProfitByTxId: profitByTxId,
    });
    const recentTransactionGroups = useMemo<Array<[string, DisplayTx[]]>>(() => {
        const groups: Array<[string, DisplayTx[]]> = [];
        let remaining = RECENT_TRANSACTION_LIMIT;
        for (const [date, txs] of Object.entries(recentGroupedTransactions) as Array<[string, DisplayTx[]]>) {
            if (remaining <= 0) break;
            const visibleTxs = txs.slice(0, remaining);
            if (visibleTxs.length > 0) {
                groups.push([date, visibleTxs]);
                remaining -= visibleTxs.length;
            }
        }
        return groups;
    }, [recentGroupedTransactions]);
    const recentTransactionCount = useMemo(
        () => recentTransactionGroups.reduce((count, [, txs]) => count + txs.length, 0),
        [recentTransactionGroups]
    );

    const cashTotal = capitalSnapshot.cashTotal;
    const totalDebt = capitalSnapshot.receivables;
    const totalAdvances = capitalSnapshot.clientAdvances;
    const investorProfitsDue = Number(investorBreakdown?.profits || 0);
    const quickPayable = totalAdvances + investorProfitsDue;
    const liquidityGap = cashTotal - quickPayable;
    const usdtAvailable = Number(portfolioStats?.usdt?.available || 0);
    const eurAvailable = Number(portfolioStats?.eur?.available || 0);
    const lowStock = usdtAvailable < 100 && eurAvailable < 100;
    const getClientDebtAmount = (client: OverdueDebtClient) => {
        const balance = Number(client.balance || 0);
        if (balance < -0.005)
            return Math.abs(balance);
        return Math.abs(Number(client.overdueAmount || 0));
    };
    const priorities = useMemo<PriorityItem[]>(() => {
        const rows: PriorityItem[] = [];
        const topDebtClients = overdueDebtClients
            .slice()
            .sort((a, b) => {
            const byAmount = getClientDebtAmount(b) - getClientDebtAmount(a);
            if (Math.abs(byAmount) > 0.005)
                return byAmount;
            const byOldest = Number(a.oldestUnpaidTimestamp || 0) - Number(b.oldestUnpaidTimestamp || 0);
            if (Math.abs(byOldest) > 1)
                return byOldest;
            return a.fullName.localeCompare(b.fullName);
        })
            .slice(0, 3);
        if (topDebtClients.length > 0) {
            return topDebtClients.map((client, index) => ({
                id: `urgent-debt-${client.clientId}`,
                title: client.fullName,
                rank: index + 1,
                body: renderDebtPriorityBody(t('dashboard.debtPriorityCardBody') as string, getClientDebtAmount(client), client.daysOverdue, client.oldestUnpaidDate),
                tone: 'danger' as Tone,
                action: () => onOpenClient(client.clientId),
                actionLabel: t('dashboard.viewClient') as string,
            }));
        }
        if (cashTotal < totalAdvances && totalAdvances > 0) {
            rows.push({
                id: 'uncovered-advances',
                title: t('dashboard.uncoveredAdvances') as string,
                body: t('dashboard.uncoveredAdvancesBody') as string,
                tone: 'warning',
                action: onOpenTreasury,
                actionLabel: t('dashboard.openTreasury') as string,
            });
        }
        if (lowStock) {
            rows.push({
                id: 'low-stock',
                title: t('dashboard.lowStock') as string,
                body: t('dashboard.lowStockBody') as string,
                tone: 'warning',
            });
        }
        if (dailyOverview.activeClients === 0 && dailyOverview.todayProfit === 0) {
            rows.push({
                id: 'calm-day',
                title: t('dashboard.calmDay') as string,
                body: t('dashboard.calmDayBody') as string,
                tone: 'info',
                action: onOpenAnalytics,
                actionLabel: t('nav.analytics') as string,
            });
        }
        if (rows.length === 0) {
            rows.push({
                id: 'stable',
                title: t('dashboard.stable') as string,
                body: t('dashboard.stableBody') as string,
                tone: 'success',
            });
        }
        return rows.slice(0, 3);
    }, [
        overdueDebtClients,
        cashTotal,
        totalAdvances,
        lowStock,
        dailyOverview.activeClients,
        dailyOverview.todayProfit,
        onOpenClient,
        onOpenClientDebts,
        onOpenTreasury,
        onOpenAnalytics,
        t
    ]);
    return (<div className="anim-page-in space-y-5">
      <CapitalOverviewCard t={t} capitalSnapshot={capitalSnapshot} investorBreakdown={investorBreakdown}/>

      <QuickSituationCard title={t('dashboard.quickSituation') as string} rows={[
          { type: 'metric', label: t('common.caisseBalance') as string, value: capitalSnapshot.caisseBalance },
          { type: 'metric', label: t('common.baridiBalance') as string, value: capitalSnapshot.baridiBalance },
          { type: 'metric', label: t('finance.toReceive') as string, value: totalDebt, semantic: totalDebt > 0 ? 'profit' : 'plain' },
          { type: 'metric', label: t('dashboard.toPay') as string, value: quickPayable, semantic: quickPayable > 0 ? 'loss' : 'plain' },
          { type: 'metric', label: t('dashboard.liquidityGap') as string, value: liquidityGap, semantic: 'auto', emphasis: true },
          { type: 'section', id: 'portfolio', label: t('nav.portfolio') as string },
          { type: 'metric', label: t('dashboard.usdtAvailable') as string, value: usdtAvailable, currency: 'USDT' },
          { type: 'metric', label: t('dashboard.eurAvailable') as string, value: eurAvailable, currency: 'EUR' },
      ]}/>

      <SalesProfitSummary title={t('dashboard.profitSummary') as string} periods={{
          today: dailyOverview.todayProfit,
          week: dailyOverview.weekToDateProfit ?? 0,
          month: dailyOverview.monthToDateProfit,
          year: dailyOverview.yearToDateProfit,
      }}/>

      <OwnerProfitPeriodSummary periods={{
          today: dailyOverview.ownerProfitToday,
          week: dailyOverview.ownerProfitWeek,
          month: dailyOverview.ownerProfitMonth,
          year: dailyOverview.ownerProfitYear,
      }}/>

      {/* Month plan — entry to the smart pricing hub (progress + prices live inside) */}
      {monthlyGoal > 0 && onOpenMonthPlan && (
        <SmartPricingShortcut
          title={t('smartPricing.monthPlan') as string}
          subtitle={t('smartPricing.title') as string}
          onClick={onOpenMonthPlan}
        />
      )}

      {/* No goal yet → CTA to open the month plan and set one */}
      {monthlyGoal <= 0 && onOpenMonthPlan && (
        <SmartPricingShortcut
          title={t('smartPricing.title') as string}
          subtitle={t('smartPricing.subtitle') as string}
          onClick={onOpenMonthPlan}
        />
      )}

      <PriorityList title={t('dashboard.attentionNeeded') as string} items={priorities} onTitleClick={onOpenClientDebts}/>

      {/* Same operation feed as Journal des Opérations, limited to the latest rows. */}
      {recentTransactionCount > 0 && (
        <Card>
          <CardHeader className="p-4 pb-3">
            <div className="flex items-center justify-between gap-2">
              <SectionHeading icon={<ArrowRightLeftIcon className="w-4 h-4"/>}>{t('dashboard.lastOperations')}</SectionHeading>
              {onOpenTransactions && (
                <button type="button" onClick={onOpenTransactions} className="text-xs font-semibold text-primary hover:underline">
                  {t('dashboard.seeAll')}
                </button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <TransactionDisplayList
              dateGroups={recentTransactionGroups}
              t={t}
              getRelativeDateLabel={getRelativeDateLabel}
              onEditDisplayTx={handleOpenRecentDisplayTx}
              onDeleteDisplayTx={handleDeleteRecentDisplayTx}
              onOpenDisplayTx={handleOpenRecentDisplayTx}
              formatDzdAmount={formatRecentDzdAmount}
              profitByTxId={recentProfitByTxId}
            />
          </CardContent>
        </Card>
      )}

    </div>);
}
