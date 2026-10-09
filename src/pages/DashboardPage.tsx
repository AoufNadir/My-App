import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { CurrencyAmount, type AmountSemantic } from '../components/financial/CurrencyAmount';
import { AlertCard, AlertStack, HeroCard, ListRow, SectionCard, StatTile, StatTileGrid, type AlertStackItem } from '../components/cards';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { Button } from '../components/ui/Button';
import { BellIcon } from '../components/icons/BellIcon';
import { ChevronRightIcon } from '../components/icons/ChevronRightIcon';
import { DollarSignIcon } from '../components/icons/DollarSignIcon';
import { EuroIcon } from '../components/icons/EuroIcon';
import { LandmarkIcon } from '../components/icons/LandmarkIcon';
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
import type { FinancialAuditData } from '../components/financial/OwnerProfitSummary';
import type { WeeklyRecap } from '../hooks/useWeeklyRecap';
import type { MonthlyRecap } from '../hooks/useMonthlyRecap';
import type { InvestorTerm } from '../utils/investorTerms';
import { InvestorTermAlert } from '../components/investors/InvestorTermAlert';
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
    onOpenMonthPlan?: () => void;
    monthlyGoal?: number;
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
};
type ProfitPeriod = 'today' | 'week' | 'month' | 'year';
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
    capitalSnapshot,
    investorBreakdown,
    overdueDebtClients,
    overdueDebtClientCount,
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
    onOpenMonthPlan,
    monthlyGoal = 0,
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
    const ownerProfitByPeriod: Record<ProfitPeriod, number> = {
        today: dailyOverview.ownerProfitToday,
        week: dailyOverview.ownerProfitWeek,
        month: dailyOverview.ownerProfitMonth,
        year: dailyOverview.ownerProfitYear,
    };
    const salesProfit = salesProfitByPeriod[profitPeriod];

    // Most urgent first; the stack shows two and folds the rest.
    const alerts: AlertStackItem[] = [];
    // The read model sends only the first overdue clients: their count comes separately,
    // and their total is shown only when every overdue client is in the list.
    const overdueCount = Math.max(overdueDebtClientCount ?? 0, overdueDebtClients.length);
    if (overdueCount > 0) {
        const overdueDebtTotal = overdueDebtClients.reduce((sum, client) => sum + getClientDebtAmount(client), 0);
        const hasEveryOverdueClient = overdueDebtClients.length >= overdueCount;
        alerts.push({
            id: 'overdue-debts',
            element: (<AlertCard tone="danger" title={overdueCount === 1
                    ? t('dashboard.overdueClientsOne') as string
                    : fillTemplate(t('dashboard.overdueClientsMany') as string, { count: <CountText value={overdueCount}/> })} detail={hasEveryOverdueClient
                    ? fillTemplate(t('dashboard.overdueClientsDebt') as string, { amount: <CurrencyAmount value={overdueDebtTotal} currency="DZD" decimals={2} size="sm" className="font-bold"/> })
                    : undefined} onAction={onOpenClientDebts} actionLabel={t('dashboard.viewAction') as string}/>),
        });
    }
    if (cashTotal < totalAdvances && totalAdvances > 0) {
        alerts.push({
            id: 'uncovered-advances',
            element: (<AlertCard tone="warning" title={t('dashboard.uncoveredAdvances') as string} detail={t('dashboard.uncoveredAdvancesBody') as string} onAction={onOpenTreasury} actionLabel={t('dashboard.viewAction') as string}/>),
        });
    }
    // One card per investor whose three months come up: the buttons open that investor's page with the window on top.
    if (onInvestorTermReinvest && onInvestorTermWithdraw) {
        for (const term of investorTerms) {
            alerts.push({
                id: `investor-term-${term.investorId}`,
                element: (<InvestorTermAlert term={term} onReinvest={() => onInvestorTermReinvest(term.investorId)} onWithdraw={() => onInvestorTermWithdraw(term.investorId)} onSnooze={onInvestorTermSnooze ? () => onInvestorTermSnooze(term) : undefined}/>),
            });
        }
    }
    if (weeklyRecap) {
        alerts.push({ id: 'weekly-recap', element: <WeeklyRecapAlert recap={weeklyRecap} onDismiss={onDismissWeeklyRecap}/> });
    }
    if (monthlyRecap) {
        alerts.push({ id: 'monthly-recap', element: <MonthlyRecapAlert recap={monthlyRecap} onDismiss={onDismissMonthlyRecap}/> });
    }
    if (lowStock) {
        alerts.push({
            id: 'low-stock',
            element: <AlertCard tone="warning" title={t('dashboard.lowStock') as string} detail={t('dashboard.lowStockBody') as string}/>,
        });
    }
    if (showNotificationPrompt && onEnableNotifications && onDismissNotificationPrompt) {
        alerts.push({ id: 'notifications', element: <NotificationPromptAlert onEnable={onEnableNotifications} onLater={onDismissNotificationPrompt}/> });
    }

    return (<div className="anim-page-in flex flex-col gap-3">
      <AlertStack items={alerts} moreLabel={(count) => String(t('dashboard.moreAlerts')).replace('{count}', String(count))} lessLabel={t('dashboard.fewerAlerts') as string}/>

      <HeroCard top={<SegmentedControl options={PROFIT_PERIODS.map((period) => ({ id: period, label: t(PROFIT_PERIOD_LABEL_KEYS[period].option) as string }))} value={profitPeriod} onChange={selectProfitPeriod} ariaLabel={t('dashboard.periodPicker') as string}/>} label={`${t('dashboard.profitSummary')} · ${t(PROFIT_PERIOD_LABEL_KEYS[profitPeriod].title)}`} value={salesProfit} semantic={salesProfit < 0 ? 'loss' : 'plain'} secondary={{
            label: t('dashboard.ownerProfitSummary') as string,
            hint: t('dashboard.ownerProfitSummaryHint') as string,
            value: ownerProfitByPeriod[profitPeriod],
            semantic: 'auto',
        }}/>

      <StatTileGrid>
        <StatTile label={t('common.caisseBalance') as string} value={capitalSnapshot.caisseBalance} icon={<WalletIcon className="h-3.5 w-3.5"/>} tone="dzd"/>
        <StatTile label={t('common.baridiBalance') as string} value={capitalSnapshot.baridiBalance} icon={<LandmarkIcon className="h-3.5 w-3.5"/>} tone="dzd"/>
        <StatTile label={t('dashboard.usdtInStock') as string} value={usdtInStock} currency="USDT" decimals={2} icon={<DollarSignIcon className="h-3.5 w-3.5"/>} tone="usdt"/>
        <StatTile label={t('dashboard.eurInStock') as string} value={eurInStock} currency="EUR" decimals={2} icon={<EuroIcon className="h-3.5 w-3.5"/>} tone="eur"/>
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

      {/* Month plan — entry to the smart pricing hub; without a goal it invites to set one. */}
      {onOpenMonthPlan && (
        <ListRow standalone icon={<SparklesIcon className="h-5 w-5"/>} tone="primary" title={t(monthlyGoal > 0 ? 'smartPricing.monthPlan' : 'smartPricing.title') as string} subtitle={t(monthlyGoal > 0 ? 'smartPricing.title' : 'smartPricing.subtitle') as string} onClick={onOpenMonthPlan}/>
      )}
    </div>);
}
