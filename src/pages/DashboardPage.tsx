import { useMemo, type ReactNode } from 'react';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { SectionHeading } from '../components/ui/SectionHeading';
import { CurrencyAmount, type AmountSemantic } from '../components/financial/CurrencyAmount';
import { HeroKpiCard } from '../components/ui/HeroKpiCard';
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
import type { OverdueDebtClient, TreasuryCard } from '../types';
import { computeCapitalSnapshot } from '../utils/capitalSnapshot';
import { useLanguage } from '../contexts/LanguageContext';
type DashboardPageProps = {
    dailyOverview: {
        caisse: number;
        baridi: number;
        activeClients: number;
        todayProfit: number;
        todaySellCount?: number;
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
        last7DaysProfit?: number[];
    };
    portfolioStats: any;
    treasuryStats: any;
    totals: any;
    treasuryCards: TreasuryCard[];
    investorLiability?: number;
    investorBreakdown?: { capital: number; profits: number; total: number };
    servicesSummary?: {
        netCapitalImpact?: number;
    };
    globalNetProfit: number;
    overdueDebtClients: OverdueDebtClient[];
    isDataSyncing?: boolean;
    onNewTransaction: () => void;
    onOpenClients: () => void;
    onOpenClient: (clientId: string) => void;
    onOpenClientDebts: () => void;
    onOpenTreasury: () => void;
    onOpenAnalytics: () => void;
    onOpenPersonalWithdrawal?: () => void;
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
        item: 'border border-danger/20 border-s-4 border-s-danger/70 bg-danger-bg text-neutral-900 shadow-sm dark:border-danger-light/20 dark:border-s-danger-light/70 dark:bg-surface-muted',
        title: 'text-danger dark:text-danger-light',
        body: 'text-neutral-700 dark:text-neutral-600',
        action: 'border border-danger/20 bg-surface text-danger dark:border-danger-light/25 dark:bg-danger-light/10 dark:text-danger-light',
    },
    warning: {
        item: 'border border-warning/25 bg-warning-bg text-neutral-900 shadow-sm',
        title: 'text-warning',
        body: 'text-neutral-700 dark:text-neutral-600',
        action: 'border border-warning/25 bg-surface text-warning dark:bg-surface-raised',
    },
    success: {
        item: 'border border-success/20 bg-success-bg text-neutral-900 shadow-sm',
        title: 'text-success dark:text-success-light',
        body: 'text-neutral-700 dark:text-neutral-600',
        action: 'border border-success/20 bg-surface text-success dark:bg-surface-raised dark:text-success-light',
    },
    info: {
        item: 'border border-info/20 bg-info-bg text-neutral-900 shadow-sm',
        title: 'text-info',
        body: 'text-neutral-700 dark:text-neutral-600',
        action: 'border border-info/20 bg-surface text-info dark:bg-surface-raised',
    },
};
function toneClasses(tone: Tone): typeof PRIORITY_TONE_CLASSES[Tone] {
    return PRIORITY_TONE_CLASSES[tone];
}
function renderDebtPriorityBody(template: string, amount: number, days: number, date: string) {
    return (<>
      {template.split(/(\{amount\}|\{days\}|\{date\})/g).map((part, index) => {
            if (part === '{amount}') {
                return <CurrencyAmount key={index} value={amount} currency="DZD" decimals={2} size="sm" className="font-semibold text-danger dark:text-danger-light"/>;
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
function TodaySummary({ title, items, last7DaysProfit, todaySellCount }: {
    title: string;
    items: Array<{
        label: string;
        value: number;
        semantic?: AmountSemantic;
        icon: ReactNode;
    }>;
    last7DaysProfit?: number[];
    todaySellCount?: number;
}) {
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
          {typeof todaySellCount === 'number' && todaySellCount > 0 && (
            <span className="shrink-0 text-xs font-semibold text-neutral-500">
              <span className="tabular-nums text-primary font-bold">{todaySellCount}</span> op{todaySellCount > 1 ? 's' : ''} auj.
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {items.map((item) => (<div key={item.label} className="rounded-xl border border-border bg-surface-muted p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-semibold text-neutral-500">{item.label}</p>
                <span className="text-neutral-400">{item.icon}</span>
              </div>
              <div className="mt-3">
                <CurrencyAmount value={item.value} currency="DZD" semantic={item.semantic ?? 'auto'} size="xl" decimals={0}/>
              </div>
            </div>))}
        </div>

        {days.length === 7 && days.some((v) => v !== 0) && (
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-neutral-400">7 derniers jours</p>
            <div className="flex items-end gap-1 h-10">
              {days.map((profit, i) => {
                const isToday = i === 6;
                const barH = profit === 0 ? 0 : Math.max(12, (Math.abs(profit) / maxAbs) * 40);
                const barColor = profit > 0 ? (isToday ? 'bg-financial-profit' : 'bg-financial-profit/50') : profit < 0 ? 'bg-financial-loss/60' : '';
                return (
                  <div key={i} className="flex flex-1 flex-col items-center gap-0.5">
                    <div className="flex w-full flex-1 items-end justify-center">
                      {profit !== 0 && (<div className={`w-full max-w-[20px] rounded-sm transition-all ${barColor}`} style={{ height: `${barH}px` }}/>)}
                    </div>
                    <span className={`text-[9px] font-semibold ${isToday ? 'text-primary' : 'text-neutral-400'}`}>
                      {dayLabels[i]}
                    </span>
                  </div>
                );
              })}
            </div>
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
function PortfolioStatusCard({ title, stockLabel, valueLabel, portfolioStats, stockValue, }: {
    title: string;
    stockLabel: string;
    valueLabel: string;
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
        <div className="text-right shrink-0">
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
                <div className="text-right shrink-0">
                  <p className="text-xs font-medium text-neutral-500">PAM</p>
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
function DashboardSyncState({ title, body, actions, }: {
    title: string;
    body: string;
    actions: Array<{
        label: string;
        icon: ReactNode;
        onClick: () => void;
        primary?: boolean;
    }>;
}) {
    return (<div className="anim-page-in space-y-5">
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ArrowRightLeftIcon className="h-5 w-5"/>
            </span>
            <div className="min-w-0">
              <p className="text-base font-semibold text-neutral-900">{title}</p>
              <p className="mt-1 text-sm leading-snug text-neutral-500">{body}</p>
            </div>
          </div>
          <div className="mt-4 grid gap-2">
            {[0, 1, 2].map((item) => (<div key={item} className="h-10 animate-pulse rounded-lg bg-neutral-100"/>))}
          </div>
        </CardContent>
      </Card>
      <ActionStrip actions={actions}/>
    </div>);
}
export function DashboardPage({ dailyOverview, portfolioStats, treasuryStats, totals, treasuryCards, investorLiability = 0, investorBreakdown, servicesSummary, overdueDebtClients, globalNetProfit, isDataSyncing = false, onNewTransaction, onOpenClients, onOpenClient, onOpenClientDebts, onOpenTreasury, onOpenAnalytics, onOpenPersonalWithdrawal, }: DashboardPageProps) {
    const { t } = useLanguage();
    const stockValue = Number(portfolioStats?.usdt?.available || 0) * Number(portfolioStats?.usdt?.avgBuy || 0)
        + Number(portfolioStats?.eur?.available || 0) * Number(portfolioStats?.eur?.avgBuy || 0);
    const servicesCapitalImpact = Number(servicesSummary?.netCapitalImpact || 0);
    const capitalSnapshot = useMemo(() => computeCapitalSnapshot({
        caisseBalance: Number(treasuryStats?.caisse || 0),
        baridiBalance: Number(treasuryStats?.baridi || 0),
        portfolioValue: stockValue,
        totalDettes: Number(totals?.totalDettes || 0),
        totalAvances: Number(totals?.totalAvances || 0),
        treasuryCards,
        investorLiability,
        servicesCapitalImpact,
    }), [treasuryStats, stockValue, totals, treasuryCards, investorLiability, servicesCapitalImpact]);
    const cashTotal = capitalSnapshot.cashTotal;
    const totalDebt = capitalSnapshot.receivables;
    const totalAdvances = capitalSnapshot.clientAdvances;
    const financialHealth = capitalSnapshot.totalCapital;
    const capitalSecondaryItems = [
        { label: t('finance.realCapital') as string, value: capitalSnapshot.netOwnedCapital, currency: 'DZD' as const, semantic: 'plain' as const },
        { label: 'Capital investisseurs', value: investorBreakdown?.capital ?? capitalSnapshot.investorLiability, currency: 'DZD' as const, semantic: 'loss' as const, hideWhenZero: true },
        { label: 'Profits non retirés', value: investorBreakdown?.profits ?? 0, currency: 'DZD' as const, semantic: 'loss' as const, hideWhenZero: true },
        { label: t('finance.liquidity') as string, value: cashTotal, currency: 'DZD' as const, semantic: 'plain' as const },
        { label: t('finance.stock') as string, value: stockValue, currency: 'DZD' as const, semantic: 'plain' as const, hideWhenZero: true },
        { label: t('finance.treasuryCards') as string, value: capitalSnapshot.treasuryCardsTotal, currency: 'DZD' as const, semantic: 'plain' as const, hideWhenZero: true },
        { label: t('nav.services') as string, value: capitalSnapshot.servicesCapitalImpact, currency: 'DZD' as const, semantic: 'auto' as const, hideWhenZero: true },
        { label: t('finance.netPosition') as string, value: capitalSnapshot.netClientPosition, currency: 'DZD' as const, semantic: 'auto' as const, hideWhenZero: true }
    ].filter((item) => !item.hideWhenZero || Math.abs(item.value) > 0.005);
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
    if (isDataSyncing) {
        return (<DashboardSyncState title={t('dashboard.syncingTitle') as string} body={t('dashboard.syncingBody') as string} actions={primaryActions}/>);
    }
    return (<div className="anim-page-in space-y-5">
      <HeroKpiCard accent="sky" icon={<LandmarkIcon className="w-5 h-5"/>} primaryLabel={t('dashboard.capitalTotal') as string} primaryValue={financialHealth} primaryCurrency="DZD" primarySemantic="plain" secondary={capitalSecondaryItems}/>

      <ActionStrip actions={primaryActions}/>

      {onOpenPersonalWithdrawal && (<Button onClick={onOpenPersonalWithdrawal} variant="outline" size="md" className="flex w-full items-center justify-center gap-2 border-primary/20 bg-primary/10 font-bold text-primary hover:bg-primary/20">
          <BanknotesIcon className="h-4 w-4"/>
          <span>Ma dépense du jour</span>
        </Button>)}

      <TodaySummary title={t('dashboard.profitSummary') as string} last7DaysProfit={dailyOverview.last7DaysProfit} todaySellCount={dailyOverview.todaySellCount} items={[
            { label: t('dashboard.profitYear') as string, value: dailyOverview.yearToDateProfit, semantic: 'auto', icon: <CalendarIcon className="h-4 w-4"/> },
            { label: t('dashboard.profitAllTime') as string, value: Number(dailyOverview.allTimeProfit ?? globalNetProfit), semantic: 'auto', icon: <TrendingUpIcon className="h-4 w-4"/> },
            { label: t('dashboard.profitMonth') as string, value: dailyOverview.monthToDateProfit, semantic: 'auto', icon: <CalendarIcon className="h-4 w-4"/> },
            { label: t('dashboard.profitToday') as string, value: dailyOverview.todayProfit, semantic: 'auto', icon: <BriefcaseIcon className="h-4 w-4"/> }
        ]}/>

      <PriorityList title={t('dashboard.attentionNeeded') as string} items={priorities} onTitleClick={onOpenClientDebts}/>

      <PortfolioStatusCard title={t('portfolio.currentStatus') as string} stockLabel={t('finance.stock') as string} valueLabel={t('transactions.value') as string} portfolioStats={portfolioStats} stockValue={stockValue}/>

      <MoneyMap title={t('dashboard.moneyMap') as string} rows={[
            { label: 'Caisse', value: Number(treasuryStats?.caisse || 0), icon: <WalletIcon className="h-4 w-4"/> },
            { label: 'BaridiMob', value: Number(treasuryStats?.baridi || 0), icon: <LandmarkIcon className="h-4 w-4"/> },
            { label: t('finance.stock') as string, value: stockValue, icon: <BriefcaseIcon className="h-4 w-4"/> },
            { label: t('finance.toReceive') as string, value: totalDebt, semantic: totalDebt > 0 ? 'profit' : 'plain', icon: <ArrowUpRightIcon className="h-4 w-4"/> },
            { label: t('finance.clientAdvance') as string, value: totalAdvances, semantic: totalAdvances > 0 ? 'loss' : 'plain', icon: <AlertTriangleIcon className="h-4 w-4"/> },
            { label: 'Capital investisseurs', value: investorBreakdown?.capital ?? capitalSnapshot.investorLiability, semantic: 'loss', icon: <UsersIcon className="h-4 w-4"/> },
            { label: 'Profits non retirés', value: investorBreakdown?.profits ?? 0, semantic: 'loss', icon: <UsersIcon className="h-4 w-4"/> }
        ]}/>
    </div>);
}
