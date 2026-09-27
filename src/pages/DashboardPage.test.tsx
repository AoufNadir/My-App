import assert from 'node:assert/strict';
import { useMemo, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { SectionHeading } from '../components/ui/SectionHeading';
import { CurrencyAmount, type CurrencyCode } from '../components/financial/CurrencyAmount';
import { CapitalOverviewCard } from '../components/financial/CapitalOverviewCard';
import { ArrowRightLeftIcon } from '../components/icons/ArrowRightLeftIcon';
import { BriefcaseIcon } from '../components/icons/BriefcaseIcon';
import { ChevronRightIcon } from '../components/icons/ChevronRightIcon';
import { SparklesIcon } from '../components/icons/SparklesIcon';
import { TrendingUpIcon } from '../components/icons/TrendingUpIcon';
import { WalletIcon } from '../components/icons/WalletIcon';
import { TransactionDisplayList } from '../components/transactions/TransactionDisplayList';
import { useTransactionsViewModel } from '../components/transactions/useTransactionsViewModel';
import type { DisplayTx, TransactionFilterMode } from '../components/transactions/transactionsTypes';
import type { ClientDzd, ClientTransactionDzd, OverdueDebtClient, TreasuryCard, TreasuryTx, Tx } from '../types';
import type { CapitalSnapshot } from '../utils/capitalSnapshot';
import type { PamLedgerResult } from '../utils/pamLedger';
import type { ManagerProfitBreakdown } from '../hooks/useInvestorEconomics';
import type { FinancialAuditData } from '../components/financial/OwnerProfitSummary';
import type { WeeklyRecap } from '../hooks/useWeeklyRecap';
import type { MonthlyRecap } from '../hooks/useMonthlyRecap';
import { LanguageProvider, useLanguage } from '../contexts/LanguageContext';
import { translations } from '../translations';
import { DashboardPage } from './DashboardPage';

// V2-3 rebuilt the dashboard from the shared cards: alerts, one hero with a period switch, balance
// tiles, a situation row, the latest operations and the month plan. This test renders the previous
// dashboard and the new one with the same data, and checks that every amount the previous one
// showed is still on the page, formatted the same way. Two parts moved on purpose:
// - the capital card, which stays at the top of Trésorerie;
// - the three largest overdue debts, now one alert with the count and the total of all of them
//   (the list itself is on the Clients page that the alert opens).

// ---- Reference: the dashboard before V2-3 (V2-2, commit 2121438), copied verbatim ----
// (OwnerProfitPeriodSummary and its Metric come from components/financial/OwnerProfitSummary.tsx.)
type OwnerProfitPeriods = {
    today: number;
    week: number;
    month: number;
    year: number;
};

function Metric({ label, value, semantic = 'auto' }: { label: string; value: number; semantic?: 'auto' | 'plain' }) {
    return (
        <div className="min-w-0 rounded-xl border border-border bg-surface-muted px-3 py-3">
            <p className="mb-2 truncate text-xs font-semibold text-neutral-500">{label}</p>
            <div>
                <CurrencyAmount value={value} currency="DZD" semantic={semantic} size="lg" decimals={0} />
            </div>
        </div>
    );
}

function OwnerProfitPeriodSummary({ periods }: { periods: OwnerProfitPeriods }) {
    const { t } = useLanguage();
    return (
        <Card>
            <CardHeader className="p-4 pb-3">
                <SectionHeading icon={<BriefcaseIcon className="h-4 w-4" />}>
                    {t('dashboard.ownerProfitSummary') as string}
                </SectionHeading>
                <p className="mt-1 text-xs text-neutral-500">{t('dashboard.ownerProfitSummaryHint') as string}</p>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 p-4 pt-0 sm:grid-cols-4">
                <Metric label={t('dashboard.ownerProfitToday') as string} value={periods.today} />
                <Metric label={t('dashboard.ownerProfitWeek') as string} value={periods.week} />
                <Metric label={t('dashboard.ownerProfitMonth') as string} value={periods.month} />
                <Metric label={t('dashboard.ownerProfitYear') as string} value={periods.year} />
            </CardContent>
        </Card>
    );
}
const RECENT_TRANSACTION_LIMIT = 5;
const EMPTY_RECENT_DATE_RANGE = { start: null, end: null };
const ignoreRecentFilterChange = (_mode: TransactionFilterMode) => undefined;
const ignoreRecentDateChange = (_range: { start: Date | null; end: Date | null }) => undefined;
type ReferenceDashboardPageProps = {
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
        <p className="mb-2 truncate text-xs font-semibold text-neutral-500">{label}</p>
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
                  <div key={row.id} className="bg-surface-muted/55 px-4 py-2 text-[13px] font-bold text-neutral-500">
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

function ReferenceDashboardContent({
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
}: ReferenceDashboardPageProps) {
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
    const usdtLocked = Number(portfolioStats?.usdt?.locked || 0);
    const eurLocked = Number(portfolioStats?.eur?.locked || 0);
    const usdtInStock = usdtAvailable + usdtLocked;
    const eurInStock = eurAvailable + eurLocked;
    const lowStock = usdtInStock < 100 && eurInStock < 100;
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
          { type: 'metric', label: t('dashboard.usdtInStock') as string, value: usdtInStock, currency: 'USDT' },
          { type: 'metric', label: t('dashboard.eurInStock') as string, value: eurInStock, currency: 'EUR' },
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
// ---- End of the reference ----

// ---- Fake data (made-up names and amounts, chosen so that no two amounts are alike) ----
const storage = new Map<string, string>();
const fakeWindow = {
    localStorage: {
        getItem: (key: string) => (storage.has(key) ? storage.get(key)! : null),
        setItem: (key: string, value: string) => { storage.set(key, String(value)); },
        removeItem: (key: string) => { storage.delete(key); },
    },
};
(globalThis as { window?: unknown }).window = fakeWindow;
const PERIOD_STORAGE_KEY = 'app_dashboard_profit_period';
const PERIODS = ['today', 'week', 'month', 'year'] as const;
type Period = typeof PERIODS[number];

const noop = () => undefined;
const pad = (n: number) => String(n).padStart(2, '0');
const stamp = (hoursAgo: number) => {
    const timestamp = Date.now() - hoursAgo * 3_600_000;
    const date = new Date(timestamp);
    return { timestamp, date: `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`, time: `${pad(date.getHours())}:${pad(date.getMinutes())}` };
};
const clientsDzd = [
    { id: 'c1', fullName: 'Client Alpha' },
    { id: 'c2', fullName: 'Client Beta' },
] as unknown as ClientDzd[];
const transactions = [
    { id: 't1', ...stamp(2), type: 'sell', currency: 'USDT', quantity: 1000, sell: 251.5, total: 251_500 },
    { id: 't2', ...stamp(5), type: 'buy', currency: 'USDT', quantity: 2000, price: 242.9, total: 485_800 },
    { id: 't3', ...stamp(30), type: 'buy', currency: 'EUR', quantity: 400, price: 262.25, total: 104_900 },
] as unknown as Tx[];
const clientTransactionsDzd = [
    { id: 'l1', ...stamp(3), clientId: 'c2', montant: 50_000, type: 'Règlement Reçu', paymentMethod: 'Espèces' },
    { id: 'l2', ...stamp(2), clientId: 'c1', montant: -251_500, type: 'Vente USDT', linkedTxId: 't1', linkRole: 'primary' },
] as unknown as ClientTransactionDzd[];
const capitalSnapshot: CapitalSnapshot = {
    caisseBalance: 1_250_431,
    baridiBalance: 480_217,
    cashTotal: 1_730_648,
    stockValue: 2_100_559,
    treasuryCardsTotal: 0,
    receivables: 310_155,
    clientAdvances: 45_120,
    netClientPosition: 265_035,
    serviceReceivables: 0,
    serviceClientAdvances: 0,
    servicesCapitalImpact: 0,
    managerPendingAdvances: 0,
    totalCapital: 4_096_242,
    investorLiability: 900_333,
    netOwnedCapital: 3_195_909,
};
const investorBreakdown = { capital: 800_000, profits: 100_333, total: 900_333 };
const dailyOverview = {
    caisse: 1_250_431,
    baridi: 480_217,
    activeClients: 3,
    todayProfit: 12_345.4,
    todaySellCount: 4,
    weekToDateProfit: 43_210.6,
    monthToDateProfit: 184_523.2,
    yearToDateProfit: 1_520_987.7,
    allTimeProfit: 3_004_117,
    todayUsdtSold: 1000,
    todayEurSold: 0,
    monthToDateUsdtSold: 21_000,
    monthToDateEurSold: 900,
    yearToDateUsdtSold: 160_000,
    yearToDateEurSold: 7_000,
    allTimeUsdtSold: 400_000,
    allTimeEurSold: 20_000,
    ownerProfitToday: 8_100.4,
    ownerProfitWeek: 29_050.5,
    ownerProfitMonth: 121_345.6,
    ownerProfitYear: 998_765.4,
    ownerProfitAllTime: 2_001_002,
};
const overdue = (clientId: string, fullName: string, balance: number, overdueAmount: number, daysOverdue: number): OverdueDebtClient => {
    const oldestUnpaidTimestamp = Date.now() - (daysOverdue + 7) * 86_400_000;
    return { clientId, fullName, overdueAmount, daysOverdue, oldestUnpaidTimestamp, oldestUnpaidDate: new Date(oldestUnpaidTimestamp).toLocaleDateString('fr-FR'), lastPaymentTimestamp: null, balance };
};
// Four late clients: the previous dashboard listed the three largest debts.
const overdueDebtClients = [
    overdue('d1', 'Client Gamma', -150_000.5, 120_000, 21),
    overdue('d2', 'Client Delta', -90_100.25, 90_100.25, 12),
    overdue('d3', 'Client Epsilon', -40_050, 10_000, 9),
    overdue('d4', 'Client Zeta', -0.001, 5_300.75, 3),
];
const baseProps = {
    managerProfitBreakdown: {} as ManagerProfitBreakdown,
    financialAudit: {} as FinancialAuditData,
    dailyOverview,
    portfolioStats: { usdt: { available: 8_000.25, locked: 420.5, avgBuy: 245 }, eur: { available: 1_100, locked: 50.75, avgBuy: 262 } },
    treasuryStats: {},
    totals: {},
    treasuryCards: [] as TreasuryCard[],
    investorLiability: 900_333,
    investorBreakdown,
    capitalSnapshot,
    globalNetProfit: 0,
    overdueDebtClients,
    isDataReady: true,
    onNewTransaction: noop,
    onOpenClients: noop,
    onOpenClient: noop,
    onOpenClientDebts: noop,
    onOpenTreasury: noop,
    onOpenAnalytics: noop,
    transactions,
    clientTransactionsDzd,
    clientsDzd,
    treasuryTransactions: [] as TreasuryTx[],
    profitByTxId: {} as PamLedgerResult['profitByTxId'],
    getRelativeDateLabel: (date: string) => date,
    getClientFullName: (client: ClientDzd) => (client as unknown as { fullName: string }).fullName,
    openForm: noop,
    openAdjustmentModal: noop,
    setTxToDelete: noop,
    onOpenTransactions: noop,
    onOpenMonthPlan: noop,
    monthlyGoal: 0,
};
type NewProps = Parameters<typeof DashboardPage>[0];

// ---- Helpers ----
// Every amount on the page is a CurrencyAmount: its number and currency sit in <bdi dir="ltr">.
function amountsIn(html: string): string[] {
    return [...html.matchAll(/<bdi dir="ltr">(.*?)<\/bdi>/g)].map((match) => match[1]
        .replace(/<!-- -->/g, '')
        .replace(/<span[^>]*>/g, ' ')
        .replace(/<\/span>/g, '')
        .replace(/\s+/g, ' ')
        .trim());
}
function amountText(value: number, currency: CurrencyCode, decimals: number, extra: { showSign?: boolean; minDecimals?: number; maxDecimals?: number } = {}) {
    const [text] = amountsIn(renderToStaticMarkup(<CurrencyAmount value={value} currency={currency} decimals={decimals} {...extra}/>));
    return text;
}
function withoutEach(list: string[], removed: string[], label: string) {
    const rest = list.slice();
    for (const item of removed) {
        const index = rest.indexOf(item);
        assert.ok(index >= 0, `${label}: ${item} was on the previous dashboard`);
        rest.splice(index, 1);
    }
    return rest;
}
function assertContainsEach(html: string, expected: string[], label: string) {
    const rest = amountsIn(html);
    for (const item of expected) {
        const index = rest.indexOf(item);
        assert.ok(index >= 0, `${label}: ${item} is shown`);
        rest.splice(index, 1);
    }
}
function renderNew(props: Partial<NewProps> = {}, options: { period?: string | null; lang?: 'fr' | 'ar' } = {}) {
    storage.clear();
    if (options.period)
        storage.set(PERIOD_STORAGE_KEY, options.period);
    storage.set('app_lang', options.lang ?? 'fr');
    return renderToStaticMarkup(<LanguageProvider><DashboardPage {...baseProps} {...props}/></LanguageProvider>);
}
const fr = translations.fr as unknown as { dashboard: Record<string, string>; common: Record<string, string>; smartPricing: Record<string, string>; finance: Record<string, string> };
const ar = translations.ar as unknown as typeof fr;
const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/'/g, '&#x27;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---- 1. Every amount of the previous dashboard is still shown, for the period it belongs to ----
{
    const referenceHtml = renderToStaticMarkup(<ReferenceDashboardContent {...baseProps}/>);
    const referenceAmounts = amountsIn(referenceHtml);
    assert.ok(referenceAmounts.length >= 18, `the reference shows its amounts (${referenceAmounts.length})`);

    // Moved: the capital card (Trésorerie) and the three largest overdue debts (one alert now).
    const capitalAmounts = amountsIn(renderToStaticMarkup(<CapitalOverviewCard t={(key) => key} capitalSnapshot={capitalSnapshot} investorBreakdown={investorBreakdown}/>));
    assert.equal(capitalAmounts.length, 3, 'capital card: own capital, project value, investors');
    const debtAmount = (client: OverdueDebtClient) => (client.balance < -0.005 ? Math.abs(client.balance) : Math.abs(client.overdueAmount));
    const largestDebts = overdueDebtClients.slice().sort((a, b) => debtAmount(b) - debtAmount(a)).slice(0, 3);
    const movedDebtAmounts = largestDebts.map((client) => amountText(debtAmount(client), 'DZD', 2));
    const kept = withoutEach(withoutEach(referenceAmounts, capitalAmounts, 'capital card'), movedDebtAmounts, 'overdue debts');

    const periodAmounts: Record<Period, string[]> = {
        today: [amountText(dailyOverview.todayProfit, 'DZD', 0), amountText(dailyOverview.ownerProfitToday, 'DZD', 0)],
        week: [amountText(dailyOverview.weekToDateProfit, 'DZD', 0), amountText(dailyOverview.ownerProfitWeek, 'DZD', 0)],
        month: [amountText(dailyOverview.monthToDateProfit, 'DZD', 0), amountText(dailyOverview.ownerProfitMonth, 'DZD', 0)],
        year: [amountText(dailyOverview.yearToDateProfit, 'DZD', 0), amountText(dailyOverview.ownerProfitYear, 'DZD', 0)],
    };
    const always = withoutEach(kept, PERIODS.flatMap((period) => periodAmounts[period]), 'profit by period');
    // Balances, stock, what clients owe and what is owed, the liquidity gap, and the latest operations.
    for (const expected of [
        amountText(capitalSnapshot.caisseBalance, 'DZD', 0),
        amountText(capitalSnapshot.baridiBalance, 'DZD', 0),
        amountText(8_420.75, 'USDT', 2),
        amountText(1_150.75, 'EUR', 2),
        amountText(capitalSnapshot.receivables, 'DZD', 0),
        amountText(capitalSnapshot.clientAdvances + investorBreakdown.profits, 'DZD', 0),
        amountText(capitalSnapshot.cashTotal - capitalSnapshot.clientAdvances - investorBreakdown.profits, 'DZD', 0),
    ])
        assert.ok(always.includes(expected), `the reference showed ${expected}`);

    for (const period of PERIODS) {
        const html = renderNew({}, { period });
        assertContainsEach(html, [...always, ...periodAmounts[period]], `period ${period}`);
        for (const other of PERIODS.filter((candidate) => candidate !== period))
            assert.ok(!amountsIn(html).includes(periodAmounts[other][0]), `period ${period} hides the ${other} profit`);
        const periodTitle = fr.dashboard[{ today: 'ownerProfitToday', week: 'ownerProfitWeek', month: 'ownerProfitMonth', year: 'ownerProfitYear' }[period]];
        assert.ok(html.includes(escapeHtml(`${fr.dashboard.profitSummary} · ${periodTitle}`)), `period ${period}: the title names the period`);
        const optionLabel = fr.dashboard[{ today: 'periodDay', week: 'periodWeek', month: 'periodMonth', year: 'periodYear' }[period]];
        assert.equal(html.split('aria-pressed="true"').length - 1, 1, 'one period is selected');
        assert.match(html, new RegExp(`aria-pressed="true"[^>]*>${escapeHtml(optionLabel)}<`), `period ${period} is the selected option`);
    }

    // The capital card stays on Trésorerie only.
    const monthHtml = renderNew();
    assert.ok(!monthHtml.includes(escapeHtml(fr.dashboard.capitalTotal)), 'no capital card on the dashboard');
    for (const amount of capitalAmounts)
        assert.ok(!amountsIn(monthHtml).includes(amount), `capital amount ${amount} not repeated`);

    // One alert counts every late client and totals their debts, as the previous rows computed each one.
    const total = overdueDebtClients.reduce((sum, client) => sum + debtAmount(client), 0);
    assert.ok(monthHtml.includes(escapeHtml(fr.dashboard.overdueClientsMany).replace('{count}', '<bdi dir="ltr" class="tabular-nums">4</bdi>')), 'four late clients');
    assertContainsEach(monthHtml, [amountText(total, 'DZD', 2)], 'total of the overdue debts');
    const alertButton = monthHtml.match(/<button[^>]*>(?:(?!<\/button>).)*<\/button>/g)?.find((button) => button.includes('clients en retard'));
    assert.ok(alertButton?.includes(`>${fr.dashboard.viewAction}<`), 'the whole alert is one button that opens the clients');
    // The reminders that only said all is well are gone.
    for (const key of ['stable', 'calmDay', 'attentionNeeded'])
        assert.ok(!monthHtml.includes(escapeHtml(fr.dashboard[key])), `no "${fr.dashboard[key]}"`);
    // The month plan entry keeps its two wordings.
    assert.ok(monthHtml.includes(escapeHtml(fr.smartPricing.title)) && monthHtml.includes(escapeHtml(fr.smartPricing.subtitle)), 'month plan without a goal');
    const withGoal = renderNew({ monthlyGoal: 150_000 });
    assert.ok(withGoal.includes(escapeHtml(fr.smartPricing.monthPlan)), 'month plan with a goal');
}

// ---- 2. The chosen period is remembered, and a missing or broken storage falls back to the month ----
{
    for (const stored of [null, 'decade']) {
        const html = renderNew({}, { period: stored });
        assertContainsEach(html, [amountText(dailyOverview.monthToDateProfit, 'DZD', 0)], `stored ${stored}`);
    }
    const saved = (globalThis as { window?: unknown }).window;
    delete (globalThis as { window?: unknown }).window;
    const html = renderToStaticMarkup(<DashboardPage {...baseProps}/>);
    assertContainsEach(html, [amountText(dailyOverview.monthToDateProfit, 'DZD', 0)], 'no window');
    (globalThis as { window?: unknown }).window = { get localStorage(): never { throw new Error('blocked'); } };
    assertContainsEach(renderToStaticMarkup(<DashboardPage {...baseProps}/>), [amountText(dailyOverview.monthToDateProfit, 'DZD', 0)], 'blocked storage');
    (globalThis as { window?: unknown }).window = saved;
}

// ---- 3. When the read model sends only the first late clients, the count is right and no partial total is shown ----
{
    const html = renderNew({ overdueDebtClients: overdueDebtClients.slice(0, 3), overdueDebtClientCount: 7 });
    assert.ok(html.includes('<bdi dir="ltr" class="tabular-nums">7</bdi>'), 'seven late clients');
    assert.ok(!html.includes(escapeHtml(fr.dashboard.overdueClientsDebt.split('{amount}')[0])), 'no partial total');
    const single = renderNew({ overdueDebtClients: overdueDebtClients.slice(0, 1), overdueDebtClientCount: 1 });
    assert.ok(single.includes(escapeHtml(fr.dashboard.overdueClientsOne)), 'one late client');
    const none = renderNew({ overdueDebtClients: [], overdueDebtClientCount: 0 });
    assert.ok(!none.includes('en retard'), 'no overdue alert');
}

// ---- 4. Warnings no longer hide behind the debts, and the stack folds after two alerts ----
{
    const lowCash = { ...capitalSnapshot, cashTotal: 40_000 };
    const emptyStock = { usdt: { available: 10, locked: 0 }, eur: { available: 5, locked: 0 } };
    const html = renderNew({ capitalSnapshot: lowCash, portfolioStats: emptyStock });
    assert.ok(html.includes(escapeHtml(fr.dashboard.uncoveredAdvances)), 'uncovered advances shown next to the debts');
    assert.ok(!html.includes(escapeHtml(fr.dashboard.lowStock)), 'third alert folded');
    assert.ok(html.includes(escapeHtml(fr.dashboard.moreAlerts.replace('{count}', '1'))), 'one more alert');
    const withoutDebts = renderNew({ capitalSnapshot: lowCash, portfolioStats: emptyStock, overdueDebtClients: [], overdueDebtClientCount: 0 });
    assert.ok(withoutDebts.includes(escapeHtml(fr.dashboard.uncoveredAdvances)) && withoutDebts.includes(escapeHtml(fr.dashboard.lowStock)), 'both warnings');
    assert.ok(!withoutDebts.includes(escapeHtml(fr.dashboard.moreAlerts.split('(')[0])), 'nothing folded');
}

// ---- 5. The weekly and monthly recaps show the same figures as the banners they replace ----
{
    const weeklyRecap: WeeklyRecap = { weekKey: '2026-W39', weekLabel: 'Semaine du 21 septembre', profit: 43_200.5, sellCount: 18, usdtSold: 12_000.4, eurSold: 350.2, activeDays: 5, topClientName: 'Client Beta', topClientProfit: 5_100.3 };
    const monthlyRecap: MonthlyRecap = { monthKey: '2026-08', monthLabel: 'Août', profit: 210_450.75, sellCount: 64, usdtSold: 45_678.91 };
    let dismissed = '';
    const props = { overdueDebtClients: [], overdueDebtClientCount: 0, weeklyRecap, monthlyRecap, onDismissWeeklyRecap: () => { dismissed = 'week'; }, onDismissMonthlyRecap: noop };
    const html = renderNew(props);
    assert.ok(html.includes(escapeHtml(fr.dashboard.weeklyRecapTitle)) && html.includes(escapeHtml(fr.dashboard.monthlyRecapTitle)), 'both recaps');
    assertContainsEach(html, [
        amountText(43_200.5, 'DZD', 2, { showSign: true }),
        amountText(12_000.4, 'USDT', 0),
        amountText(350.2, 'EUR', 0),
        amountText(5_100.3, 'DZD', 0, { showSign: true }),
        amountText(210_450.75, 'DZD', 2, { showSign: true }),
        amountText(45_678.91, 'USDT', 2, { minDecimals: 0, maxDecimals: 2 }),
    ], 'recap amounts');
    for (const count of [18, 5, 64])
        assert.ok(html.includes(`<bdi dir="ltr" class="tabular-nums">${count}</bdi>`), `recap count ${count}`);
    assert.ok(html.includes('Client Beta'), 'top client');
    assert.equal(html.split(`aria-label="${escapeHtml(fr.common.close)}"`).length - 1, 2, 'each recap can be closed');
    assert.equal(dismissed, '', 'nothing closed while rendering');

    const arabic = renderNew(props, { lang: 'ar' });
    assert.ok(arabic.includes(ar.dashboard.weeklyRecapTitle) && arabic.includes(ar.dashboard.monthlyRecapTitle), 'Arabic recap titles');
    assertContainsEach(arabic, [amountText(43_200.5, 'DZD', 2, { showSign: true }), amountText(210_450.75, 'DZD', 2, { showSign: true })], 'Arabic recap amounts');
}

// ---- 6. The notification request is one of the alerts, only when asked for ----
{
    const shown = renderNew({ overdueDebtClients: [], overdueDebtClientCount: 0, showNotificationPrompt: true, onEnableNotifications: async () => 'granted', onDismissNotificationPrompt: noop });
    for (const key of ['notificationsTitle', 'notificationsBody', 'notificationsEnable', 'notificationsLater'])
        assert.ok(shown.includes(escapeHtml(fr.dashboard[key])), `notification ${key}`);
    const hidden = renderNew({ overdueDebtClients: [], overdueDebtClientCount: 0, showNotificationPrompt: false, onEnableNotifications: async () => 'granted', onDismissNotificationPrompt: noop });
    assert.ok(!hidden.includes(escapeHtml(fr.dashboard.notificationsTitle)), 'no request when not asked');
}

// ---- 7. Arabic: same amounts, Arabic labels ----
{
    const html = renderNew({}, { lang: 'ar', period: 'week' });
    assert.ok(html.includes(`${ar.dashboard.profitSummary} · ${ar.dashboard.ownerProfitWeek}`), 'Arabic hero title');
    assert.ok(html.includes(ar.dashboard.overdueClientsMany.replace('{count}', '<bdi dir="ltr" class="tabular-nums">4</bdi>')), 'Arabic overdue alert');
    assertContainsEach(html, amountsIn(renderNew({}, { lang: 'fr', period: 'week' })), 'same amounts in both languages');
    for (const key of ['lastOperations', 'liquidityGap', 'toPay', 'ownerProfitSummary'])
        assert.ok(html.includes(ar.dashboard[key]), `Arabic ${key}`);
    assert.ok(html.includes(ar.finance.toReceive) && html.includes(ar.common.caisseBalance), 'Arabic balances');
}

console.log('DashboardPage tests passed');
