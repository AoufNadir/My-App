import { useMemo, useState, type ReactNode } from 'react';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { SectionHeading } from '../components/ui/SectionHeading';
import { CurrencyAmount, type AmountSemantic } from '../components/financial/CurrencyAmount';
import { CapitalOverviewCard } from '../components/financial/CapitalOverviewCard';
import { AlertTriangleIcon } from '../components/icons/AlertTriangleIcon';
import { BanknotesIcon } from '../components/icons/BanknotesIcon';
import { ArrowRightLeftIcon } from '../components/icons/ArrowRightLeftIcon';
import { ArrowUpRightIcon } from '../components/icons/ArrowUpRightIcon';
import { BriefcaseIcon } from '../components/icons/BriefcaseIcon';
import { CalendarIcon } from '../components/icons/CalendarIcon';
import { LandmarkIcon } from '../components/icons/LandmarkIcon';
import { PlusIcon } from '../components/icons/PlusIcon';
import { SparklesIcon } from '../components/icons/SparklesIcon';
import { TrendingUpIcon } from '../components/icons/TrendingUpIcon';
import { UsersIcon } from '../components/icons/UsersIcon';
import { WalletIcon } from '../components/icons/WalletIcon';
import { ShareIcon } from '../components/icons/ShareIcon';
import { TransactionDisplayList } from '../components/transactions/TransactionDisplayList';
import { useTransactionsViewModel } from '../components/transactions/useTransactionsViewModel';
import { Skeleton } from '../components/ui/Skeleton';
import type { DisplayTx, TransactionFilterMode } from '../components/transactions/transactionsTypes';
import type { ClientDzd, ClientTransactionDzd, OverdueDebtClient, TreasuryCard, TreasuryTx, Tx } from '../types';
import type { CapitalSnapshot } from '../utils/capitalSnapshot';
import type { PamLedgerResult } from '../utils/pamLedger';
import type { ManagerProfitBreakdown } from '../hooks/useInvestorEconomics';
import { OwnerProfitPeriodSummary } from '../components/financial/OwnerProfitSummary';
import { useLanguage } from '../contexts/LanguageContext';
const RECENT_TRANSACTION_LIMIT = 5;
const EMPTY_RECENT_DATE_RANGE = { start: null, end: null };
const ignoreRecentFilterChange = (_mode: TransactionFilterMode) => undefined;
const ignoreRecentDateChange = (_range: { start: Date | null; end: Date | null }) => undefined;
type DashboardPageProps = {
    managerProfitBreakdown: ManagerProfitBreakdown;
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
    action?: () => void;
    actionLabel?: string;
};
const PRIORITY_TONE_CLASSES: Record<Tone, {
    item: string;
    title: string;
    body: string;
    action: string;
}> = {
    danger: {
        item: 'border border-danger/20 border-s-4 border-s-danger/70 bg-danger-bg text-neutral-900 shadow-sm',
        title: 'text-danger',
        body: 'text-neutral-700',
        action: 'border border-danger/20 bg-surface text-danger',
    },
    warning: {
        item: 'border border-warning/25 bg-warning-bg text-neutral-900 shadow-sm',
        title: 'text-warning',
        body: 'text-neutral-700',
        action: 'border border-warning/25 bg-surface text-warning',
    },
    success: {
        item: 'border border-success/20 bg-success-bg text-neutral-900 shadow-sm',
        title: 'text-success',
        body: 'text-neutral-700',
        action: 'border border-success/20 bg-surface text-success',
    },
    info: {
        item: 'border border-info/20 bg-info-bg text-neutral-900 shadow-sm',
        title: 'text-info',
        body: 'text-neutral-700',
        action: 'border border-info/20 bg-surface text-info',
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
function ActionStrip({ actions, }: {
    actions: Array<{
        label: string;
        icon: ReactNode;
        onClick: () => void;
        primary?: boolean;
    }>;
}) {
    return (<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {actions.map((action) => (<Button key={action.label} type="button" onClick={action.onClick} variant={action.primary ? 'primary' : 'outline'} size="md" className="min-h-[64px] w-full px-2.5 text-xs font-bold sm:min-h-[56px] sm:text-sm">
          <span className="inline-flex h-full min-w-0 flex-col items-center justify-center gap-1.5 text-center sm:flex-row sm:gap-2">
            {action.icon}
            <span className="max-w-full truncate leading-tight">{action.label}</span>
          </span>
        </Button>))}
    </div>);
}
function PriorityList({ title, items, onTitleClick, }: {
    title: string;
    items: PriorityItem[];
    onTitleClick?: () => void;
}) {
    const renderItemContent = (item: PriorityItem, tone: typeof PRIORITY_TONE_CLASSES[Tone]) => (<div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1.5">
      <p className={`min-w-0 text-base font-bold leading-snug ${tone.title}`}>{item.title}</p>
      {item.action && item.actionLabel && (<span className={`inline-flex min-h-8 shrink-0 items-center justify-center rounded-button px-2.5 text-xs font-bold ${tone.action}`}>
          {item.actionLabel}
        </span>)}
      <p className={`col-span-2 text-sm leading-relaxed ${tone.body}`}>{item.body}</p>
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
            return item.action ? (<button key={item.id} type="button" onClick={item.action} className={`w-full rounded-card p-4 text-start transition-all hover:border-border-strong hover:shadow-card-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.99] ${tone.item}`}>
              {renderItemContent(item, tone)}
            </button>) : (<div key={item.id} className={`rounded-card p-4 ${tone.item}`}>
              {renderItemContent(item, tone)}
            </div>);
        })}
      </CardContent>
    </Card>);
}
const DAY_LABELS_SHORT = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
function TodaySummary({ title, items, last7DaysProfit, todaySellCount, onShare, shareCopied }: {
    title: string;
    items: Array<{
        label: string;
        value: number;
        semantic?: AmountSemantic;
        icon: ReactNode;
    }>;
    last7DaysProfit?: number[];
    todaySellCount?: number;
    onShare?: () => void;
    shareCopied?: boolean;
}) {
    const { t } = useLanguage();
    const days = last7DaysProfit ?? [];
    const maxAbs = Math.max(...days.map(Math.abs), 1);
    // Day labels: compute from today going back 6 days
    const todayDowIndex = new Date().getDay(); // 0=Sun..6=Sat
    const dayLabels = Array.from({ length: 7 }, (_, i) => {
        const dow = (todayDowIndex - 6 + i + 7) % 7;
        return DAY_LABELS_SHORT[dow === 0 ? 6 : dow - 1]; // Mon=0..Sun=6
    });
    return (<Card>
      <CardHeader className="p-4 pb-3">
        <div className="flex items-center justify-between gap-2">
          <SectionHeading icon={<CalendarIcon className="w-4 h-4"/>}>{title}</SectionHeading>
          <div className="flex items-center gap-2 shrink-0">
            {typeof todaySellCount === 'number' && todaySellCount > 0 && (
              <span className="text-xs font-semibold text-neutral-500">
                <span className="tabular-nums text-primary font-bold">{todaySellCount}</span> {t('dashboard.opsShort')}
              </span>
            )}
            {onShare && (
              <button type="button" onClick={onShare} className="flex h-8 w-8 items-center justify-center rounded-button bg-neutral-100 text-neutral-500 transition-colors hover:bg-neutral-200 hover:text-neutral-800" aria-label={t('dashboard.shareSummary')} title={shareCopied ? t('common.copied') : t('dashboard.shareSummary')}>
                {shareCopied
                  ? <span className="text-[10px] font-bold text-financial-profit">✓</span>
                  : <ShareIcon className="w-3.5 h-3.5"/>}
              </button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {items.map((item) => (<div key={item.label} className="rounded-xl border border-border bg-surface-muted px-3 py-3">
              <div className="flex items-center justify-between gap-1 mb-2">
                <p className="text-[11px] font-semibold text-neutral-500 truncate">{item.label}</p>
                <span className="text-neutral-300 shrink-0">{item.icon}</span>
              </div>
              <CurrencyAmount value={item.value} currency="DZD" semantic={item.semantic ?? 'auto'} size="lg" decimals={0}/>
            </div>))}
        </div>

        {days.length === 7 && days.some((v) => v !== 0) && (
          <div>
            <div className="flex items-end gap-1.5 h-16 mb-1">
              {days.map((profit, i) => {
                const isToday = i === 6;
                const barH = profit === 0 ? 0 : Math.max(8, (Math.abs(profit) / maxAbs) * 58);
                const barColor = profit > 0
                  ? (isToday ? 'bg-financial-profit' : 'bg-financial-profit/40')
                  : profit < 0 ? 'bg-financial-loss/50' : '';
                return (
                  <div key={i} className="flex flex-1 flex-col items-center gap-1">
                    <div className="flex w-full flex-1 items-end justify-center">
                      {profit !== 0 ? (
                        <div
                          className={`w-2.5 rounded-t-md transition-all ${barColor}`}
                          style={{ height: `${barH}px` }}
                        />
                      ) : (
                        <div className="w-2.5 h-1 rounded-full bg-neutral-100"/>
                      )}
                    </div>
                    <span className={`text-[9px] font-bold leading-none ${isToday ? 'text-primary' : 'text-neutral-400'}`}>
                      {dayLabels[i]}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="text-[9px] font-medium text-neutral-300 text-end">7 jours</p>
          </div>
        )}
      </CardContent>
    </Card>);
}
function MoneyMap({ title, rows, }: {
    title: string;
    rows: Array<{
        label: string;
        value: number;
        semantic?: AmountSemantic;
        icon: ReactNode;
    }>;
}) {
    return (<Card>
      <CardHeader className="p-4 pb-3">
        <SectionHeading icon={<WalletIcon className="w-4 h-4"/>}>{title}</SectionHeading>
      </CardHeader>
      <CardContent className="p-0 divide-y divide-neutral-100">
        {rows.map((row) => (<div key={row.label} className="flex items-center justify-between gap-3 px-4 py-3.5">
            <div className="flex items-center gap-3 min-w-0">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600">
                {row.icon}
              </span>
              <p className="text-sm font-medium text-neutral-500">{row.label}</p>
            </div>
            <CurrencyAmount value={row.value} currency="DZD" semantic={row.semantic ?? 'plain'} size="lg" decimals={0}/>
          </div>))}
      </CardContent>
    </Card>);
}
function PortfolioStatusCard({ title, stockLabel, valueLabel, pamLabel, portfolioStats, stockValue, }: {
    title: string;
    stockLabel: string;
    valueLabel: string;
    pamLabel: string;
    portfolioStats: any;
    stockValue: number;
}) {
    const usdtQty = Number(portfolioStats?.usdt?.available || 0);
    const eurQty = Number(portfolioStats?.eur?.available || 0);
    const usdtPam = Number(portfolioStats?.usdt?.avgBuy || 0);
    const eurPam = Number(portfolioStats?.eur?.avgBuy || 0);
    const usdtValue = usdtQty * usdtPam;
    const eurValue = eurQty * eurPam;
    const assetRows = [
        { label: 'USDT', qty: usdtQty, currency: 'USDT' as const, pam: usdtPam, value: usdtValue },
        { label: 'EUR', qty: eurQty, currency: 'EUR' as const, pam: eurPam, value: eurValue }
    ];
    return (<Card>
      <CardHeader className="p-4 pb-3 flex flex-row items-start justify-between gap-3">
        <SectionHeading icon={<BriefcaseIcon className="w-4 h-4"/>}>{title}</SectionHeading>
        <div className="text-end shrink-0">
          <p className="text-xs font-medium text-neutral-500">{stockLabel}</p>
          <CurrencyAmount value={stockValue} currency="DZD" size="md" decimals={0}/>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="grid gap-3 sm:grid-cols-2">
          {assetRows.map((asset) => (<div key={asset.label} className="rounded-xl border border-border bg-surface-muted p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface text-neutral-600">
                    <WalletIcon className="h-5 w-5"/>
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-neutral-800">{asset.label}</p>
                    <CurrencyAmount value={asset.qty} currency={asset.currency} size="lg"/>
                  </div>
                </div>
                <div className="text-end shrink-0">
                  <p className="text-xs font-medium text-neutral-500">{pamLabel}</p>
                  <CurrencyAmount value={asset.pam} currency="DZD" size="sm" decimals={2}/>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between rounded-lg bg-surface px-3 py-2 text-sm">
                <span className="text-neutral-500">{valueLabel}</span>
                <CurrencyAmount value={asset.value} currency="DZD" size="sm" decimals={0} className="font-semibold text-neutral-700"/>
              </div>
            </div>))}
        </div>
      </CardContent>
    </Card>);
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
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} height={64}/>) }
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
    managerProfitBreakdown,
    portfolioStats,
    capitalSnapshot,
    investorBreakdown,
    overdueDebtClients,
    globalNetProfit,
    onNewTransaction,
    onOpenClients,
    onOpenClient,
    onOpenClientDebts,
    onOpenTreasury,
    onOpenAnalytics,
    onOpenPersonalWithdrawal,
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
    onQuickSell,
    quickSellPreview,
    onOpenMonthPlan,
    monthlyGoal = 0,
}: DashboardPageProps) {
    const { t } = useLanguage();
    const [shareCopied, setShareCopied] = useState(false);
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

    const handleShareDaySummary = () => {
        const fmt = (n: number) => Math.round(n).toLocaleString('fr-FR');
        const sign = (n: number) => n >= 0 ? `+${fmt(n)}` : fmt(n);
        const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
        const lines: string[] = [
            `📊 ${t('dashboard.summaryWord')} ${today}`,
            ``,
            `💰 ${t('common.todayProfit')} : ${sign(dailyOverview.todayProfit)} DZD`,
            dailyOverview.weekToDateProfit !== undefined ? `📅 ${t('dashboard.thisWeek')} : ${sign(dailyOverview.weekToDateProfit)} DZD` : '',
            `📆 ${t('dashboard.thisMonth')} : ${sign(dailyOverview.monthToDateProfit)} DZD`,
            ``,
            `💵 Caisse : ${fmt(capitalSnapshot.caisseBalance)} DZD`,
            `📱 BaridiMob : ${fmt(capitalSnapshot.baridiBalance)} DZD`,
        ].filter(Boolean);
        if (dailyOverview.todaySellCount) lines.push(``, `🔄 ${dailyOverview.todaySellCount} ${t('transactions.operationsWord')}`);
        const text = lines.join('\n');
        if (typeof navigator.share === 'function') {
            navigator.share({ text }).catch(() => {});
        } else {
            navigator.clipboard.writeText(text).then(() => {
                setShareCopied(true);
                setTimeout(() => setShareCopied(false), 2000);
            });
        }
    };
    const stockValue = capitalSnapshot.stockValue;
    const cashTotal = capitalSnapshot.cashTotal;
    const totalDebt = capitalSnapshot.receivables;
    const totalAdvances = capitalSnapshot.clientAdvances;
    const lowStock = Number(portfolioStats?.usdt?.available || 0) < 100
        && Number(portfolioStats?.eur?.available || 0) < 100;
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
                title: `${index + 1}. ${client.fullName}`,
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
    const primaryActions = [
        { label: t('dashboard.newOperation') as string, icon: <PlusIcon className="h-4 w-4"/>, onClick: onNewTransaction, primary: true },
        { label: t('nav.clients') as string, icon: <UsersIcon className="h-4 w-4"/>, onClick: onOpenClients },
        { label: t('nav.treasury') as string, icon: <ArrowRightLeftIcon className="h-4 w-4"/>, onClick: onOpenTreasury },
        { label: t('nav.analytics') as string, icon: <TrendingUpIcon className="h-4 w-4"/>, onClick: onOpenAnalytics }
    ];
    return (<div className="anim-page-in space-y-5">
      <CapitalOverviewCard t={t} capitalSnapshot={capitalSnapshot} investorBreakdown={investorBreakdown}/>

      <ActionStrip actions={primaryActions}/>

      {/* Quick Sell button — only when USDT stock available */}
      {onQuickSell && quickSellPreview && (
        <button type="button" onClick={onQuickSell}
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-danger/25 bg-danger-bg px-4 py-3 text-start transition-colors hover:bg-danger-bg/80 active:scale-[0.99]">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-financial-loss">⚡ {t('dashboard.quickSellUsdt')}</p>
            <p className="text-xs text-neutral-500 mt-0.5" dir="ltr">
              {quickSellPreview.qty.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} USDT
              @ {quickSellPreview.price.toFixed(2)} DZD
              → <span className="text-financial-profit font-semibold">
                +{Math.round((quickSellPreview.price - quickSellPreview.pam) * quickSellPreview.qty).toLocaleString('fr-FR')} DZD
              </span>
            </p>
          </div>
          <svg className="w-4 h-4 shrink-0 text-financial-loss/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
          </svg>
        </button>
      )}

      {onOpenPersonalWithdrawal && (<Button onClick={onOpenPersonalWithdrawal} variant="outline" size="md" className="flex w-full items-center justify-center gap-2 border-primary/20 bg-primary/10 font-bold text-primary hover:bg-primary/20">
          <BanknotesIcon className="h-4 w-4"/>
          <span>{t('dashboard.personalExpenseToday')}</span>
        </Button>)}

      <TodaySummary title={t('dashboard.profitSummary') as string} last7DaysProfit={dailyOverview.last7DaysProfit} todaySellCount={dailyOverview.todaySellCount} onShare={handleShareDaySummary} shareCopied={shareCopied} items={[
            { label: t('dashboard.profitToday') as string, value: dailyOverview.todayProfit, semantic: 'auto', icon: <BriefcaseIcon className="h-4 w-4"/> },
            { label: t('dashboard.thisWeek') as string, value: dailyOverview.weekToDateProfit ?? 0, semantic: 'auto', icon: <TrendingUpIcon className="h-4 w-4"/> },
            { label: t('dashboard.profitMonth') as string, value: dailyOverview.monthToDateProfit, semantic: 'auto', icon: <CalendarIcon className="h-4 w-4"/> },
            { label: t('dashboard.profitYear') as string, value: dailyOverview.yearToDateProfit, semantic: 'auto', icon: <CalendarIcon className="h-4 w-4"/> },
        ]}/>

      <OwnerProfitPeriodSummary periods={{
          today: dailyOverview.ownerProfitToday,
          week: dailyOverview.ownerProfitWeek,
          month: dailyOverview.ownerProfitMonth,
          year: dailyOverview.ownerProfitYear,
      }}/>

      {/* Month plan — entry to the smart pricing hub (progress + prices live inside) */}
      {monthlyGoal > 0 && onOpenMonthPlan && (
        <button type="button" onClick={onOpenMonthPlan}
          className="flex w-full items-center justify-between rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-start transition-colors hover:bg-primary/10 active:scale-[0.99]">
          <span className="text-sm font-bold text-primary">📋 {t('smartPricing.monthPlan')}</span>
          <svg className="w-4 h-4 shrink-0 text-primary/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
          </svg>
        </button>
      )}

      {/* No goal yet → CTA to open the month plan and set one */}
      {monthlyGoal <= 0 && onOpenMonthPlan && (
        <button type="button" onClick={onOpenMonthPlan}
          className="flex w-full items-center justify-between rounded-xl border border-dashed border-primary/40 bg-primary/5 px-4 py-3 text-start transition-colors hover:bg-primary/10 active:scale-[0.99]">
          <div>
            <p className="text-sm font-bold text-primary">🎯 {t('smartPricing.title')}</p>
            <p className="text-xs text-neutral-500 mt-0.5">{t('smartPricing.subtitle')}</p>
          </div>
          <svg className="w-4 h-4 shrink-0 text-primary/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
          </svg>
        </button>
      )}

      <PriorityList title={t('dashboard.attentionNeeded') as string} items={priorities} onTitleClick={onOpenClientDebts}/>

      <PortfolioStatusCard title={t('portfolio.currentStatus') as string} stockLabel={t('finance.stock') as string} valueLabel={t('transactions.value') as string} pamLabel={t('portfolio.currentPam') as string} portfolioStats={portfolioStats} stockValue={stockValue}/>

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

      <MoneyMap title={t('dashboard.moneyMap') as string} rows={[
            { label: t('common.caisseBalance') as string, value: capitalSnapshot.caisseBalance, icon: <WalletIcon className="h-4 w-4"/> },
            { label: t('common.baridiBalance') as string, value: capitalSnapshot.baridiBalance, icon: <LandmarkIcon className="h-4 w-4"/> },
            { label: t('finance.stock') as string, value: stockValue, icon: <BriefcaseIcon className="h-4 w-4"/> },
            { label: t('finance.toReceive') as string, value: totalDebt, semantic: totalDebt > 0 ? 'profit' : 'plain', icon: <ArrowUpRightIcon className="h-4 w-4"/> },
            { label: t('finance.clientAdvance') as string, value: totalAdvances, semantic: totalAdvances > 0 ? 'loss' : 'plain', icon: <AlertTriangleIcon className="h-4 w-4"/> },
            { label: t('treasury.investorCapital') as string, value: investorBreakdown?.capital ?? capitalSnapshot.investorLiability, semantic: 'loss', icon: <UsersIcon className="h-4 w-4"/> },
            { label: t('treasury.profitsNotWithdrawn') as string, value: investorBreakdown?.profits ?? 0, semantic: 'loss', icon: <UsersIcon className="h-4 w-4"/> }
        ]}/>
    </div>);
}
