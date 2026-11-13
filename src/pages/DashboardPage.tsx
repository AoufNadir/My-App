import { useShowEur, useShowRmb } from '../contexts/CurrencyVisibilityContext';
import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { CurrencyAmount, type AmountSemantic } from '../components/financial/CurrencyAmount';
import { AlertCard, HeroCard, SectionCard, StatTile, StatTileGrid } from '../components/cards';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { Button } from '../components/ui/Button';
import { BellIcon } from '../components/icons/BellIcon';
import { ChevronRightIcon } from '../components/icons/ChevronRightIcon';
import { DollarSignIcon } from '../components/icons/DollarSignIcon';
import { EuroIcon } from '../components/icons/EuroIcon';
import { LandmarkIcon } from '../components/icons/LandmarkIcon';
import { AlertTriangleIcon } from '../components/icons/AlertTriangleIcon';
import { ArrowUpRightIcon } from '../components/icons/ArrowUpRightIcon';
import { ArrowDownLeftIcon } from '../components/icons/ArrowDownLeftIcon';
import type { ActionItem } from '../components/dashboard/ActionCenter';
import { NotificationCenter, type NotificationItem } from '../components/dashboard/NotificationCenter';
import { percentChange, type ProfitPeriod } from '../utils/dashboardComparison';
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
import type { FinancialAuditData } from '../components/financial/OwnerProfitSummary';
import type { WeeklyRecap } from '../hooks/useWeeklyRecap';
import type { MonthlyRecap } from '../hooks/useMonthlyRecap';
import type { InvestorTerm } from '../utils/investorTerms';
import { InvestorTermAlert } from '../components/investors/InvestorTermAlert';
import type { InventoryReminder } from '../utils/inventoryReminder';
import { InventoryReminderAlert } from '../components/treasury/InventoryReminderAlert';
import { ServiceProfitCard } from '../components/dashboard/ServiceProfitCard';
import { hasNoServiceActivity, type OwnerProfitSplit } from '../utils/serviceProfitOverview';
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
        /** Absent when the dashboard comes from the stored summary, which only has the total. */
        ownerProfitSplit?: OwnerProfitSplit;
        last7DaysProfit?: number[];
        /** The same sums over the matching part of the period before; absent from the stored summary. */
        previousProfit?: Record<ProfitPeriod, number>;
    };
    portfolioStats: any;
    /** V13-6: RMB in stock (quantity), shown like EUR: when RMB is on, or when some is held */
    rmbInStock?: number;
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
    /** Number of overdue clients when `overdueDebtClients` is a shortened list (dashboard read model). */
    overdueDebtClientCount?: number;
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
    monthlyGoal?: number;
    /** The goal to suggest when none is set (the average monthly profit of the last 90 days). */
    suggestedGoal?: number;
    onSaveGoal?: (goal: number) => void;
    /** V12-1: money movements nothing explains (no client, no link, no reason), and the way to the list. */
    unexplainedMovementCount?: number;
    /** V12-13: habits against forgetting */
    habits?: {
        subscriptionsDue: ReadonlyArray<{ id: string; name: string; amount: number; wallet: string }>;
        eveningCount: boolean;
        smallExpenses: { spent: number; budget: number };
        lateRecordings: number;
        p2pUnbalanced: ReadonlyArray<{ id: string; name: string; balance: number }>;
    };
    onRecordSubscription?: (id: string) => void;
    onQuickExpense?: () => void;
    onOpenInventory?: () => void;
    /** V12-2: clients still owed USDT/EUR they bought, and how much */
    pendingDeliveries?: { clients: number; USDT: number; EUR: number; late?: number; awaited?: { USDT: number; EUR: number }; supplierList?: ReadonlyArray<{ clientId: string; remaining: number; currency: string }> };
    onReviewMovements?: () => void;
    /** Opens the bell's sheet at first draw (screens and tests that read what it holds). */
    initialNotificationsOpen?: boolean;
    /** Avg monthly USDT volume (90d ÷ 3) — drives the required-margin chip. */
    // Recaps and the notification request are shown on this page only, among its alerts.
    weeklyRecap?: WeeklyRecap | null;
    onDismissWeeklyRecap?: () => void;
    monthlyRecap?: MonthlyRecap | null;
    onDismissMonthlyRecap?: () => void;
    showNotificationPrompt?: boolean;
    onEnableNotifications?: () => Promise<unknown>;
    onDismissNotificationPrompt?: () => void;
    /** Investors' quarterly terms to recall, the most urgent first, without the ones put off. */
    investorTerms?: ReadonlyArray<InvestorTerm>;
    onInvestorTermReinvest?: (investorId: string) => void;
    onInvestorTermWithdraw?: (investorId: string) => void;
    onInvestorTermSnooze?: (term: InvestorTerm) => void;
    /** Reminder to count the cash (V5-4): only when the last inventory is old or missing. */
    inventoryReminder?: InventoryReminder | null;
    onInventoryReminderSnooze?: () => void;
};
const PROFIT_PERIODS: ProfitPeriod[] = ['today', 'week', 'month', 'year'];
const PROFIT_PERIOD_LABEL_KEYS: Record<ProfitPeriod, { option: string; title: string }> = {
    today: { option: 'dashboard.periodDay', title: 'dashboard.ownerProfitToday' },
    week: { option: 'dashboard.periodWeek', title: 'dashboard.ownerProfitWeek' },
    month: { option: 'dashboard.periodMonth', title: 'dashboard.ownerProfitMonth' },
    year: { option: 'dashboard.periodYear', title: 'dashboard.ownerProfitYear' },
};
const PROFIT_PERIOD_STORAGE_KEY = 'app_dashboard_profit_period';
function readStoredProfitPeriod(): ProfitPeriod {
    try {
        const stored = window.localStorage.getItem(PROFIT_PERIOD_STORAGE_KEY);
        return PROFIT_PERIODS.find((period) => period === stored) ?? 'month';
    }
    catch {
        return 'month';
    }
}
function storeProfitPeriod(period: ProfitPeriod) {
    try {
        window.localStorage.setItem(PROFIT_PERIOD_STORAGE_KEY, period);
    }
    catch {
        // Storage unavailable (private browsing): the choice lasts for this visit only.
    }
}
/** Replaces `{name}` placeholders of a translated sentence with rendered values. */
function fillTemplate(template: string, values: Record<string, ReactNode>) {
    return template.split(/(\{[a-zA-Z]+\})/g).map((part, index) => {
        const key = part.startsWith('{') && part.endsWith('}') ? part.slice(1, -1) : '';
        return <Fragment key={index}>{key in values ? values[key] : part}</Fragment>;
    });
}
function CountText({ value }: { value: number }) {
    return <bdi dir="ltr" className="tabular-nums">{value}</bdi>;
}
function WeeklyRecapAlert({ recap, onDismiss }: { recap: WeeklyRecap; onDismiss?: () => void }) {
    const { t } = useLanguage();
    return (<AlertCard tone="info" icon={<TrendingUpIcon className="h-5 w-5"/>} title={t('dashboard.weeklyRecapTitle') as string} onDismiss={onDismiss} dismissLabel={t('common.close') as string} detail={<>
        <span className="block">
          <CurrencyAmount value={recap.profit} currency="DZD" semantic={recap.profit < 0 ? 'loss' : 'plain'} size="sm" showSign className="font-bold"/>
          {' · '}{fillTemplate(t('dashboard.recapSales') as string, { count: <CountText value={recap.sellCount}/> })}
          {recap.usdtSold > 0 && (<>{' · '}<CurrencyAmount value={recap.usdtSold} currency="USDT" size="sm" decimals={0}/></>)}
          {recap.eurSold > 0 && (<>{' · '}<CurrencyAmount value={recap.eurSold} currency="EUR" size="sm" decimals={0}/></>)}
          {' · '}{fillTemplate(t('dashboard.recapActiveDays') as string, { count: <CountText value={recap.activeDays}/> })}
        </span>
        {recap.topClientName && (<span className="block">
            {fillTemplate(t('dashboard.recapTopClient') as string, { name: <bdi>{recap.topClientName}</bdi> })}
            {recap.topClientProfit > 0 && (<>{' '}<CurrencyAmount value={recap.topClientProfit} currency="DZD" size="sm" decimals={0} showSign/></>)}
          </span>)}
      </>}/>);
}
function MonthlyRecapAlert({ recap, onDismiss }: { recap: MonthlyRecap; onDismiss?: () => void }) {
    const { t } = useLanguage();
    return (<AlertCard tone="info" icon={<TrendingUpIcon className="h-5 w-5"/>} title={t('dashboard.monthlyRecapTitle') as string} onDismiss={onDismiss} dismissLabel={t('common.close') as string} detail={<>
        <CurrencyAmount value={recap.profit} currency="DZD" semantic={recap.profit < 0 ? 'loss' : 'plain'} size="sm" showSign className="font-bold"/>
        {' · '}{fillTemplate(t('dashboard.recapSales') as string, { count: <CountText value={recap.sellCount}/> })}
        {' · '}<CurrencyAmount value={recap.usdtSold} currency="USDT" size="sm" minDecimals={0} maxDecimals={2}/>
      </>}/>);
}
function NotificationPromptAlert({ onEnable, onLater }: { onEnable: () => Promise<unknown>; onLater: () => void }) {
    const { t } = useLanguage();
    const [isEnabling, setIsEnabling] = useState(false);
    const handleEnable = async () => {
        setIsEnabling(true);
        try {
            await onEnable();
        }
        finally {
            setIsEnabling(false);
        }
    };
    return (<AlertCard tone="info" icon={<BellIcon className="h-5 w-5"/>} title={t('dashboard.notificationsTitle') as string} detail={t('dashboard.notificationsBody') as string} footer={<>
        <Button type="button" size="sm" onClick={handleEnable} disabled={isEnabling} className="font-bold">
          {isEnabling ? t('dashboard.notificationsEnabling') : t('dashboard.notificationsEnable')}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onLater}>
          {t('dashboard.notificationsLater')}
        </Button>
      </>}/>);
}
function SituationValue({ label, value, semantic }: { label: string; value: number; semantic: AmountSemantic }) {
    return (<span className="flex min-w-0 flex-col gap-0.5">
      <span className="text-xs font-semibold text-neutral-500">{label}</span>
      <span><CurrencyAmount value={value} currency="DZD" semantic={semantic} size="lg" decimals={0}/></span>
    </span>);
}
/** What clients owe, what is owed, and the gap with cash — opens the treasury. */
function QuickSituationCard({ toReceive, toPay, liquidityGap, onOpen }: {
    toReceive: number;
    toPay: number;
    liquidityGap: number;
    onOpen?: () => void;
}) {
    const { t } = useLanguage();
    const content = (<>
      <span className="grid min-w-0 flex-1 grid-cols-2 gap-x-4 gap-y-2.5">
        <SituationValue label={t('finance.toReceive') as string} value={toReceive} semantic={toReceive > 0 ? 'profit' : 'plain'}/>
        <SituationValue label={t('dashboard.toPay') as string} value={toPay} semantic={toPay > 0 ? 'loss' : 'plain'}/>
        <span className="col-span-2 flex items-center justify-between gap-3 border-t border-border pt-2.5">
          <span className="min-w-0 text-xs font-semibold text-neutral-500">{t('dashboard.liquidityGap')}</span>
          <CurrencyAmount value={liquidityGap} currency="DZD" semantic="auto" size="lg" decimals={0} className="shrink-0"/>
        </span>
      </span>
      {onOpen && <ChevronRightIcon aria-hidden="true" className="h-5 w-5 shrink-0 self-center text-neutral-400 rtl:-scale-x-100"/>}
    </>);
    const cardClass = 'flex w-full items-start gap-3 rounded-card border border-border bg-surface px-4 py-3 text-start';
    return onOpen
        ? (<button type="button" onClick={onOpen} className={`${cardClass} transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary`}>
          {content}
        </button>)
        : <div className={cardClass}>{content}</div>;
}
/** Progress toward the month's goal; without a goal, a line that invites to set one. */
function GoalCard({ goal, profit, suggested, onSave }: { goal: number; profit: number; suggested: number; onSave?: (goal: number) => void }) {
    const { t } = useLanguage();
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');
    if (!onSave)
        return null;
    const startEditing = () => {
        setDraft(String(goal > 0 ? goal : suggested > 0 ? suggested : ''));
        setEditing(true);
    };
    const save = () => {
        const value = Math.round(Number(draft));
        if (Number.isFinite(value) && value > 0) {
            onSave(value);
            setEditing(false);
        }
    };
    if (editing) {
        return (<div className="flex items-center gap-2 rounded-card border border-border bg-surface px-4 py-3">
        <input type="number" inputMode="numeric" min={1} value={draft} onChange={(event) => setDraft(event.target.value)} aria-label={t('dashboard.goalTitle') as string} className="min-w-0 flex-1 rounded-input border border-border bg-surface px-3 py-2 text-sm tabular-nums"/>
        <Button type="button" size="sm" onClick={save} className="font-bold">{t('common.save')}</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>{t('common.cancel')}</Button>
      </div>);
    }
    if (goal <= 0) {
        return (<button type="button" onClick={startEditing} className="flex w-full items-center justify-between gap-3 rounded-card border border-dashed border-border bg-surface px-4 py-3 text-start text-sm font-semibold text-primary">
        <span>{t('dashboard.goalSet')}</span>
        <ChevronRightIcon aria-hidden="true" className="h-5 w-5 shrink-0 rtl:-scale-x-100"/>
      </button>);
    }
    const percent = Math.max(0, Math.min(100, Math.round((profit / goal) * 100)));
    return (<button type="button" onClick={startEditing} className="flex w-full flex-col gap-2 rounded-card border border-border bg-surface px-4 py-3 text-start">
      <span className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-semibold text-neutral-500">{t('dashboard.goalTitle')}</span>
        <span className="text-sm font-bold tabular-nums text-neutral-900"><bdi dir="ltr">{profit >= goal ? '✓ ' : ''}{percent}%</bdi></span>
      </span>
      <span role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
        <span className="block h-full rounded-full bg-primary" style={{ width: `${percent}%` }}/>
      </span>
      <span className="flex items-center justify-between gap-3 text-xs text-neutral-500">
        <CurrencyAmount value={profit} currency="DZD" size="sm" decimals={0}/>
        <CurrencyAmount value={goal} currency="DZD" size="sm" decimals={0}/>
      </span>
    </button>);
}
/** « +12 % vs hier » under the main number; nothing when the period before had no profit to compare with. */
function ProfitChange({ current, previous, period }: { current: number; previous: number; period: ProfitPeriod }) {
    const { t } = useLanguage();
    if (!(previous > 0))
        return null;
    const change = percentChange(current, previous);
    if (change === null || change === undefined)
        return null;
    const rounded = Math.round(change);
    const tone = rounded > 0 ? 'text-financial-profit' : rounded < 0 ? 'text-financial-loss' : 'text-neutral-500';
    return (<p className={`text-xs font-semibold ${tone}`}>
      <bdi dir="ltr" className="tabular-nums">{rounded > 0 ? '+' : ''}{rounded}%</bdi>{' '}
      <span className="font-normal text-neutral-500">{t(`dashboard.versus_${period}`)}</span>
    </p>);
}
function DashboardLoadingState() {
    const { t } = useLanguage();
    return (<div className="anim-page-in flex flex-col gap-3" aria-busy="true" aria-label={t('dashboard.loadingAria') as string}>
      <div className="rounded-card border border-border bg-surface p-4">
        <Skeleton height={36}/>
        <Skeleton width="46%" height={13} className="mt-4"/>
        <Skeleton width="58%" height={34} className="mt-2"/>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (<Skeleton key={index} height={66}/>))}
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
    rmbInStock = 0,
    capitalSnapshot,
    investorBreakdown,
    overdueDebtClients,
    overdueDebtClientCount,
    onOpenClients,
    onOpenClientDebts,
    onOpenTreasury,
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
    monthlyGoal = 0,
    suggestedGoal = 0,
    onSaveGoal,
    initialNotificationsOpen = false,
    unexplainedMovementCount = 0,
    habits,
    onRecordSubscription,
    onQuickExpense,
    onOpenInventory,
    pendingDeliveries,
    onReviewMovements,
    weeklyRecap,
    onDismissWeeklyRecap,
    monthlyRecap,
    onDismissMonthlyRecap,
    showNotificationPrompt = false,
    onEnableNotifications,
    onDismissNotificationPrompt,
    investorTerms = [],
    onInvestorTermReinvest,
    onInvestorTermWithdraw,
    onInvestorTermSnooze,
    inventoryReminder = null,
    onInventoryReminderSnooze,
}: DashboardPageProps) {
    const { t } = useLanguage();
    const [profitPeriod, setProfitPeriod] = useState<ProfitPeriod>(readStoredProfitPeriod);
    const selectProfitPeriod = (period: ProfitPeriod) => {
        setProfitPeriod(period);
        storeProfitPeriod(period);
    };
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
    const showEur = useShowEur();
    const showRmb = useShowRmb();
    const eurInStock = eurAvailable + eurLocked;
    const lowStock = usdtInStock < 100 && eurInStock < 100;
    const getClientDebtAmount = (client: OverdueDebtClient) => {
        const balance = Number(client.balance || 0);
        if (balance < -0.005)
            return Math.abs(balance);
        return Math.abs(Number(client.overdueAmount || 0));
    };
    const salesProfitByPeriod: Record<ProfitPeriod, number> = {
        today: dailyOverview.todayProfit,
        week: dailyOverview.weekToDateProfit ?? 0,
        month: dailyOverview.monthToDateProfit,
        year: dailyOverview.yearToDateProfit,
    };
    // With the split, « mon profit » is the USDT and EUR sales alone and the other businesses have a card of their own;
    // without it (the stored summary) the total that includes them stays as it was.
    const profitSplit = dailyOverview.ownerProfitSplit;
    const ownerProfitByPeriod: Record<ProfitPeriod, number> = profitSplit ? profitSplit.trading : {
        today: dailyOverview.ownerProfitToday,
        week: dailyOverview.ownerProfitWeek,
        month: dailyOverview.ownerProfitMonth,
        year: dailyOverview.ownerProfitYear,
    };
    const serviceProfitCard = profitSplit && !hasNoServiceActivity(profitSplit.services) ? (<ServiceProfitCard periodTitle={t(PROFIT_PERIOD_LABEL_KEYS[profitPeriod].title) as string} parts={{ ...profitSplit.services[profitPeriod], manual: 0 }} inUse={{ digital: profitSplit.services.allTime.digital !== 0 }}/>) : null;
    const salesProfit = salesProfitByPeriod[profitPeriod];

    // « À traiter »: short lines for what needs a decision. The cards with their own buttons (investors, cash count) stay as cards.
    const overdueCount = Math.max(overdueDebtClientCount ?? 0, overdueDebtClients.length);
    const actionItems: ActionItem[] = [];
    if (overdueCount > 0) {
        const overdueDebtTotal = overdueDebtClients.reduce((sum, client) => sum + getClientDebtAmount(client), 0);
        const hasEveryOverdueClient = overdueDebtClients.length >= overdueCount;
        actionItems.push({
            id: 'overdue-debts', tone: 'loss', icon: <AlertTriangleIcon className="h-4 w-4"/>,
            title: overdueCount === 1
                ? t('dashboard.overdueClientsOne') as string
                : fillTemplate(t('dashboard.overdueClientsMany') as string, { count: <CountText value={overdueCount}/> }),
            detail: hasEveryOverdueClient
                ? fillTemplate(t('dashboard.overdueClientsDebt') as string, { amount: <CurrencyAmount value={overdueDebtTotal} currency="DZD" decimals={2} size="sm" className="font-bold"/> })
                : undefined,
            onOpen: onOpenClientDebts,
        });
    }
    if (cashTotal < totalAdvances && totalAdvances > 0) {
        actionItems.push({ id: 'uncovered-advances', tone: 'debt', icon: <WalletIcon className="h-4 w-4"/>, title: t('dashboard.uncoveredAdvances') as string, detail: t('dashboard.uncoveredAdvancesBody') as string, onOpen: onOpenTreasury });
    }
    if (unexplainedMovementCount > 0) {
        actionItems.push({ id: 'unexplained-movements', tone: 'debt', icon: <AlertTriangleIcon className="h-4 w-4"/>, title: fillTemplate(t('movementReview.homeTitle') as string, { count: <CountText value={unexplainedMovementCount}/> }), detail: t('movementReview.homeBody') as string, onOpen: onReviewMovements });
    }
    if (pendingDeliveries && pendingDeliveries.clients > 0) {
        const parts = [pendingDeliveries.USDT > 0 ? `${pendingDeliveries.USDT.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} USDT` : '', pendingDeliveries.EUR > 0 ? `${pendingDeliveries.EUR.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} EUR` : ''].filter(Boolean).join(' · ');
        const late = pendingDeliveries.late ?? 0;
        actionItems.push({ id: 'pending-deliveries', tone: late > 0 ? 'loss' : 'primary', icon: <DollarSignIcon className="h-4 w-4"/>, title: fillTemplate(t(late > 0 ? 'dashboard.pendingDeliveriesLate' : 'dashboard.pendingDeliveries') as string, { count: <CountText value={late > 0 ? late : pendingDeliveries.clients}/> }), detail: <bdi dir="ltr">{parts}</bdi>, onOpen: onOpenClients });
    }
    const suppliersWaiting = new Set((pendingDeliveries?.supplierList ?? []).map((item) => item.clientId)).size;
    if (suppliersWaiting > 0) {
        actionItems.push({ id: 'supplier-receipts', tone: 'primary', icon: <DollarSignIcon className="h-4 w-4"/>, title: fillTemplate(t('dashboard.supplierReceipts') as string, { count: <CountText value={suppliersWaiting}/> }), onOpen: onOpenClients });
    }
    for (const sub of habits?.subscriptionsDue ?? []) {
        actionItems.push({ id: `subscription-${sub.id}`, tone: 'primary', icon: <WalletIcon className="h-4 w-4"/>, title: fillTemplate(t('habits.subDue') as string, { name: <bdi>{sub.name}</bdi> }), detail: <bdi dir="ltr">{sub.amount} {sub.wallet === 'Caisse' || sub.wallet === 'BaridiMob' ? 'DZD' : sub.wallet} · {sub.wallet}</bdi>, onOpen: onRecordSubscription ? () => onRecordSubscription(sub.id) : undefined });
    }
    if (habits?.eveningCount) {
        actionItems.push({ id: 'evening-count', tone: 'debt', icon: <WalletIcon className="h-4 w-4"/>, title: t('habits.eveningTitle') as string, detail: t('habits.eveningBody') as string, onOpen: onOpenInventory });
    }
    if (habits && habits.p2pUnbalanced.length > 0) {
        actionItems.push({ id: 'p2p-unbalanced', tone: 'debt', icon: <AlertTriangleIcon className="h-4 w-4"/>, title: fillTemplate(t('habits.p2pTitle') as string, { count: <CountText value={habits.p2pUnbalanced.length}/> }), detail: habits.p2pUnbalanced.map((item) => item.name).join(', '), onOpen: onOpenClients });
    }
    if (lowStock) {
        actionItems.push({ id: 'low-stock', tone: 'debt', icon: <DollarSignIcon className="h-4 w-4"/>, title: t('dashboard.lowStock') as string, detail: t('dashboard.lowStockBody') as string });
    }
    // Everything that needs attention goes to the bell (V11-4); the Home page keeps the figures.
    const notificationItems: NotificationItem[] = [];
    const addRow = (item: ActionItem, signature: string, urgent = false) => {
        const { id, ...row } = item;
        notificationItems.push({ entry: { id, signature, urgent }, row });
    };
    for (const item of actionItems)
        addRow(item, item.id === 'overdue-debts' ? String(overdueCount) : item.id === 'unexplained-movements' ? String(unexplainedMovementCount) : item.id === 'pending-deliveries' ? `${pendingDeliveries?.USDT}|${pendingDeliveries?.EUR}|${pendingDeliveries?.late ?? 0}` : item.id === 'supplier-receipts' ? String(suppliersWaiting) : item.id === 'p2p-unbalanced' ? JSON.stringify(habits?.p2pUnbalanced.map((p) => [p.id, Math.round(p.balance)])) : item.id === 'evening-count' ? new Date().toDateString() : 'on', item.id === 'overdue-debts' || item.id === 'uncovered-advances' || (item.id === 'pending-deliveries' && (pendingDeliveries?.late ?? 0) > 0));
    if (onInvestorTermReinvest && onInvestorTermWithdraw) {
        for (const term of investorTerms) {
            notificationItems.push({
                entry: { id: `investor-term-${term.investorId}`, signature: `${term.investorId}` },
                card: (<InvestorTermAlert term={term} onReinvest={() => onInvestorTermReinvest(term.investorId)} onWithdraw={() => onInvestorTermWithdraw(term.investorId)} onSnooze={onInvestorTermSnooze ? () => onInvestorTermSnooze(term) : undefined}/>),
            });
        }
    }
    if (inventoryReminder && onOpenTreasury && onInventoryReminderSnooze) {
        notificationItems.push({ entry: { id: 'inventory-reminder', signature: 'on' }, card: <InventoryReminderAlert reminder={inventoryReminder} onOpen={onOpenTreasury} onSnooze={onInventoryReminderSnooze}/> });
    }
    if (weeklyRecap)
        notificationItems.push({ entry: { id: 'weekly-recap', signature: weeklyRecap.weekKey }, card: <WeeklyRecapAlert recap={weeklyRecap} onDismiss={onDismissWeeklyRecap}/> });
    if (monthlyRecap)
        notificationItems.push({ entry: { id: 'monthly-recap', signature: monthlyRecap.monthKey }, card: <MonthlyRecapAlert recap={monthlyRecap} onDismiss={onDismissMonthlyRecap}/> });
    if (showNotificationPrompt && onEnableNotifications && onDismissNotificationPrompt)
        notificationItems.push({ entry: { id: 'notifications', signature: 'on' }, card: <NotificationPromptAlert onEnable={onEnableNotifications} onLater={onDismissNotificationPrompt}/> });
    const previousProfit = dailyOverview.previousProfit?.[profitPeriod];

    return (<div className="anim-page-in flex flex-col gap-3">
      <NotificationCenter items={notificationItems} initialOpen={initialNotificationsOpen}/>

      <HeroCard top={<SegmentedControl options={PROFIT_PERIODS.map((period) => ({ id: period, label: t(PROFIT_PERIOD_LABEL_KEYS[period].option) as string }))} value={profitPeriod} onChange={selectProfitPeriod} ariaLabel={t('dashboard.periodPicker') as string}/>} label={`${t('dashboard.profitSummary')} · ${t(PROFIT_PERIOD_LABEL_KEYS[profitPeriod].title)}`} value={salesProfit} semantic={salesProfit < 0 ? 'loss' : 'plain'} note={previousProfit === undefined ? undefined : <ProfitChange current={salesProfit} previous={previousProfit} period={profitPeriod}/>} secondary={{
            label: t('dashboard.ownerProfitSummary') as string,
            hint: t(profitSplit ? 'dashboard.ownerProfitSummaryTradingHint' : 'dashboard.ownerProfitSummaryHint') as string,
            value: ownerProfitByPeriod[profitPeriod],
            semantic: 'auto',
        }}/>

      {unexplainedMovementCount > 0 && onReviewMovements && (<button type="button" onClick={onReviewMovements} className="flex w-full items-center gap-3 rounded-card border border-financial-debt/30 bg-financial-debt-bg px-4 py-3 text-start">
          <AlertTriangleIcon aria-hidden="true" className="h-5 w-5 shrink-0 text-financial-debt"/>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-neutral-900">{fillTemplate(t('movementReview.homeTitle') as string, { count: <CountText value={unexplainedMovementCount}/> })}</span>
            <span className="mt-0.5 block text-xs text-neutral-600">{t('movementReview.homeBody')}</span>
          </span>
          <span className="shrink-0 text-sm font-bold text-financial-debt">{t('movementReview.homeAction')}</span>
        </button>)}

      {onQuickExpense && (<button type="button" onClick={onQuickExpense} className="flex min-h-touch w-full items-center gap-3 rounded-card border border-border bg-surface px-4 py-3 text-start transition-colors hover:bg-surface-muted">
          <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-financial-loss-bg text-financial-loss"><WalletIcon className="h-5 w-5"/></span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-neutral-900">{t('habits.quickExpense')}</span>
            <span className="block text-xs text-neutral-500">{t('habits.quickExpenseHint')}</span>
          </span>
          <ChevronRightIcon aria-hidden="true" className="h-5 w-5 shrink-0 text-neutral-400 rtl:-scale-x-100"/>
        </button>)}

      {habits && (habits.smallExpenses.budget > 0 || habits.lateRecordings > 0) && (<div className="space-y-2 rounded-card border border-border bg-surface px-4 py-3">
          {habits.smallExpenses.budget > 0 && (<div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xs font-semibold text-neutral-500">{t('habits.smallTitle')}</span>
                <bdi dir="ltr" className={`text-sm font-bold tabular-nums ${habits.smallExpenses.spent > habits.smallExpenses.budget ? 'text-financial-loss' : 'text-neutral-900'}`}>{Math.round(habits.smallExpenses.spent).toLocaleString('fr-FR')} / {Math.round(habits.smallExpenses.budget).toLocaleString('fr-FR')} DZD</bdi>
              </div>
              <span role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round((habits.smallExpenses.spent / habits.smallExpenses.budget) * 100))} className="mt-1.5 block h-2 w-full overflow-hidden rounded-full bg-surface-muted">
                <span className={`block h-full rounded-full ${habits.smallExpenses.spent > habits.smallExpenses.budget ? 'bg-financial-loss' : 'bg-financial-debt'}`} style={{ width: `${Math.min(100, (habits.smallExpenses.spent / habits.smallExpenses.budget) * 100)}%` }}/>
              </span>
            </div>)}
          {habits.lateRecordings > 0 && <p className="text-xs font-semibold text-financial-debt">{fillTemplate(t('habits.lateCount') as string, { count: <CountText value={habits.lateRecordings}/> })}</p>}
        </div>)}

      <GoalCard goal={monthlyGoal} profit={dailyOverview.monthToDateProfit} suggested={suggestedGoal} onSave={onSaveGoal}/>

      {serviceProfitCard}

      <StatTileGrid>
        <StatTile label={t('common.caisseBalance') as string} value={capitalSnapshot.caisseBalance} icon={<WalletIcon className="h-3.5 w-3.5"/>} tone="dzd"/>
        <StatTile label={t('common.baridiBalance') as string} value={capitalSnapshot.baridiBalance} icon={<LandmarkIcon className="h-3.5 w-3.5"/>} tone="dzd"/>
        <StatTile label={t('dashboard.usdtInStock') as string} value={usdtInStock} currency="USDT" decimals={2} icon={<DollarSignIcon className="h-3.5 w-3.5"/>} tone="usdt"/>
        {(showEur || eurInStock > 0) && <StatTile label={t('dashboard.eurInStock') as string} value={eurInStock} currency="EUR" decimals={2} icon={<EuroIcon className="h-3.5 w-3.5"/>} tone="eur"/>}
        {(showRmb || rmbInStock > 0) && <StatTile label={t('dashboard.rmbInStock') as string} value={rmbInStock} currency="RMB" decimals={2} icon={<span className="text-[11px] font-extrabold leading-none">¥</span>} tone="eur"/>}
        {/* V12-2: sold and not sent yet: still in the wallet, but not yours (not in the capital). */}
        {pendingDeliveries && pendingDeliveries.USDT > 0 && (<StatTile label={t('dashboard.clientsUsdt') as string} value={pendingDeliveries.USDT} currency="USDT" decimals={2} icon={<ArrowUpRightIcon className="h-3.5 w-3.5"/>} tone="debt"/>)}
        {pendingDeliveries && pendingDeliveries.EUR > 0 && (<StatTile label={t('dashboard.clientsEur') as string} value={pendingDeliveries.EUR} currency="EUR" decimals={2} icon={<ArrowUpRightIcon className="h-3.5 w-3.5"/>} tone="debt"/>)}
        {/* V12-8: paid and not received yet, the other way */}
        {(pendingDeliveries?.awaited?.USDT ?? 0) > 0 && (<StatTile label={t('dashboard.suppliersUsdt') as string} value={pendingDeliveries!.awaited!.USDT} currency="USDT" decimals={2} icon={<ArrowDownLeftIcon className="h-3.5 w-3.5"/>} tone="primary"/>)}
        {(pendingDeliveries?.awaited?.EUR ?? 0) > 0 && (<StatTile label={t('dashboard.suppliersEur') as string} value={pendingDeliveries!.awaited!.EUR} currency="EUR" decimals={2} icon={<ArrowDownLeftIcon className="h-3.5 w-3.5"/>} tone="primary"/>)}
      </StatTileGrid>

      <QuickSituationCard toReceive={totalDebt} toPay={quickPayable} liquidityGap={liquidityGap} onOpen={onOpenTreasury}/>

      {/* Same operation feed as Journal des Opérations, limited to the latest rows. */}
      {recentTransactionCount > 0 && (
        <SectionCard title={t('dashboard.lastOperations')} actionLabel={t('dashboard.seeAll') as string} onAction={onOpenTransactions} flush>
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
        </SectionCard>
      )}

    </div>);
}
