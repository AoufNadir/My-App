import { useState, type ReactNode } from 'react';
import { ChevronRightIcon } from '../components/icons/ChevronRightIcon';
import { ArrowUpRightIcon } from '../components/icons/ArrowUpRightIcon';
import { CARD_TONE_CLASS, HeroCard, ListRow, type CardTone } from '../components/cards';
import { BottomSheet } from '../components/ui/BottomSheet';
import { IconButton } from '../components/ui/IconButton';
import { CurrencyAmount, type CurrencyCode } from '../components/financial/CurrencyAmount';
import { DollarSignIcon } from '../components/icons/DollarSignIcon';
import { EuroIcon } from '../components/icons/EuroIcon';
import { PencilIcon } from '../components/icons/PencilIcon';
import { RefreshCwIcon } from '../components/icons/RefreshCwIcon';
import { PamSimulator } from '../components/portfolio/PamSimulator';
import { EurFundedCostImpactCard } from '../components/portfolio/EurFundedCostImpactCard';
import { UsdtLockDetails, usdtLockState } from '../components/portfolio/UsdtLockDetails';
import { useLanguage } from '../contexts/LanguageContext';
import { Tx, ClientDzd, ClientTransactionDzd } from '../types';

type PortfolioPageProps = {
    statsView: 'usdt' | 'clients';
    setStatsView: (view: 'usdt' | 'clients') => void;
    setIsSettingsModalOpen: (isOpen: boolean) => void;
    portfolioStats: any;
    totalPortfolioValue: number;
    /** V12-2: USDT/EUR sold and not sent yet: in the wallets, but the clients' */
    pendingDeliveries?: { clients: number; USDT: number; EUR: number; awaited?: { USDT: number; EUR: number }; supplierList?: ReadonlyArray<{ clientId: string; name: string; currency: 'USDT' | 'EUR'; remaining: number; since: number; late: boolean }>; list?: ReadonlyArray<{ clientId: string; name: string; currency: 'USDT' | 'EUR'; remaining: number; since: number; late: boolean }> };
    onOpenClient?: (clientId: string) => void;
    /** Smart-engine reference sell prices (target for a normal cash deal). */
    smartTargetUsdt?: number;
    smartTargetEur?: number;
    parseAndEvaluate: (expr: string) => number;
    usdtReportMonth: number;
    setUsdtReportMonth: (month: number) => void;
    usdtReportYear: number;
    setUsdtReportYear: (year: number) => void;
    reportMonths: (year: number) => string[];
    reportYears: number[];
    monthlyStats: any;
    transactions: Tx[];
    selectedHeatmapDay: {
        day: number;
        profit: number;
    } | null;
    setSelectedHeatmapDay: (day: {
        day: number;
        profit: number;
    } | null) => void;
    handleExportUsdtReport: () => void;
    dzdDashboardStats: any;
    reportClient: string;
    setReportClient: (id: string) => void;
    clientsDzd: ClientDzd[];
    clientTransactionsDzd: ClientTransactionDzd[];
    getClientFullName: (client: ClientDzd) => string;
    reportMonth: number;
    setReportMonth: (month: number) => void;
    reportYear: number;
    setReportYear: (year: number) => void;
    openPortfolioBalanceEditModal?: (asset: 'USDT' | 'EUR') => void;
    /** V13-2: EUR hidden in the settings (its stock still counts in the total) */
    showEur?: boolean;
};

type Metric = { label: string; value: number; currency: CurrencyCode; decimals: number };

type AssetCardProps = {
    symbol: 'USDT' | 'EUR';
    icon: ReactNode;
    tone: CardTone;
    quantity: number;
    value: number;
    metrics: Metric[];
    onEdit?: () => void;
    editLabel: string;
    children?: ReactNode;
};

/** One currency of the stock: the quantity, what it is worth at its PAM, then its prices. */
function AssetCard({ symbol, icon, tone, quantity, value, metrics, onEdit, editLabel, children }: AssetCardProps) {
    return (<section aria-label={symbol} className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${CARD_TONE_CLASS[tone]}`}>{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-neutral-500">{symbol}</p>
          <CurrencyAmount value={quantity} currency={symbol} semantic="plain" size="xl" decimals={2} className="mt-0.5 block"/>
          <CurrencyAmount value={value} currency="DZD" semantic="plain" size="sm" decimals={0} className="mt-0.5 block text-neutral-500"/>
        </div>
        {onEdit && (<IconButton label={`${editLabel} : ${symbol}`} variant="edit" size="md" onClick={onEdit} className="-me-2 -mt-1">
            <PencilIcon />
          </IconButton>)}
      </div>
      <dl className="grid grid-cols-2 gap-2">
        {metrics.map((metric) => (<div key={metric.label} className="min-w-0 rounded-button bg-surface-muted px-3 py-2">
            <dt className="text-xs font-semibold leading-snug text-neutral-500">{metric.label}</dt>
            <dd className="mt-0.5"><CurrencyAmount value={metric.value} currency={metric.currency} semantic="plain" size="md" decimals={metric.decimals}/></dd>
          </div>))}
      </dl>
      {children}
    </section>);
}

/**
 * V12-2: the clients' money still in the wallets (sold, not sent yet). Not yours and not in the stock value above:
 * kept apart so the real wallets read « yours + the clients' ».
 */
function ClientFundsCard({ owed, mine, onOpenClient }: { owed: NonNullable<PortfolioPageProps['pendingDeliveries']>; mine: { USDT: number; EUR: number }; onOpenClient?: (clientId: string) => void }) {
    const { t } = useLanguage();
    const n = (value: number) => value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (<section className="rounded-card border border-financial-debt/30 bg-surface p-4">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-financial-debt-bg text-financial-debt"><ArrowUpRightIcon className="h-5 w-5"/></span>
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-neutral-900">{t('portfolio.clientFundsTitle')}</h2>
          <p className="mt-0.5 text-xs text-neutral-500">{t('portfolio.clientFundsHint')}</p>
        </div>
      </div>
      {(['USDT', 'EUR'] as const).filter((code) => owed[code] > 0 || (owed.awaited?.[code] ?? 0) > 0).map((code) => (<div key={code} className="mt-3 space-y-1.5 rounded-button bg-surface-muted p-3 text-sm">
          <div className="flex justify-between gap-3"><span className="text-neutral-600">{t('portfolio.clientFundsYours')}</span><bdi dir="ltr" className="font-semibold tabular-nums">{n(mine[code])} {code}</bdi></div>
          <div className="flex justify-between gap-3"><span className="text-neutral-600">{t('portfolio.clientFundsTheirs')}</span><bdi dir="ltr" className="font-semibold tabular-nums text-financial-debt">{n(owed[code])} {code}</bdi></div>
          {(owed.awaited?.[code] ?? 0) > 0 && <div className="flex justify-between gap-3"><span className="text-neutral-600">{t('portfolio.supplierAwaitedTitle')}</span><bdi dir="ltr" className="font-semibold tabular-nums text-primary">−{n(owed.awaited![code])} {code}</bdi></div>}
          <div className="flex justify-between gap-3 border-t border-border pt-1.5"><span className="font-semibold text-neutral-800">{t('portfolio.clientFundsReal')}</span><bdi dir="ltr" className="font-bold tabular-nums">{n(mine[code] + owed[code] - (owed.awaited?.[code] ?? 0))} {code}</bdi></div>
        </div>))}
      {owed.list && owed.list.length > 0 && <p className="mt-3 text-xs font-semibold text-neutral-600">{t('portfolio.clientFundsTheirs')}</p>}
      {owed.list && owed.list.length > 0 && (<ul className="mt-1.5 divide-y divide-border overflow-hidden rounded-button border border-border">
          {owed.list.map((item) => {
            const days = Math.max(0, Math.floor((Date.now() - item.since) / 86_400_000));
            const row = (<>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-neutral-900">{item.name}</span>
                <span className={`block text-xs ${item.late ? 'font-semibold text-financial-loss' : 'text-neutral-500'}`}>{String(t('portfolio.clientFundsSince')).replace('{days}', String(days))}</span>
              </span>
              <bdi dir="ltr" className="shrink-0 text-sm font-bold tabular-nums text-financial-debt">{n(item.remaining)} {item.currency}</bdi>
              {onOpenClient && <ChevronRightIcon aria-hidden="true" className="h-5 w-5 shrink-0 text-neutral-400 rtl:-scale-x-100"/>}
            </>);
            return (<li key={`${item.clientId}-${item.currency}`}>
                {onOpenClient
                    ? <button type="button" onClick={() => onOpenClient(item.clientId)} className="flex min-h-touch w-full items-center gap-3 px-3 py-2 text-start transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary">{row}</button>
                    : <div className="flex min-h-touch items-center gap-3 px-3 py-2">{row}</div>}
              </li>);
        })}
        </ul>)}
    </section>);
}

/** V12-8: bought and paid, not received yet: in the stock of the books, not in the wallets yet. */
function SupplierAwaitedCard({ list, onOpenClient }: { list: NonNullable<NonNullable<PortfolioPageProps['pendingDeliveries']>['supplierList']>; onOpenClient?: (clientId: string) => void }) {
    const { t } = useLanguage();
    const n = (value: number) => value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (<section className="rounded-card border border-primary/25 bg-surface p-4">
      <h2 className="text-sm font-bold text-neutral-900">{t('portfolio.supplierAwaitedTitle')}</h2>
      <p className="mt-0.5 text-xs text-neutral-500">{t('portfolio.supplierAwaitedHint')}</p>
      <ul className="mt-3 divide-y divide-border overflow-hidden rounded-button border border-border">
        {list.map((item) => {
            const days = Math.max(0, Math.floor((Date.now() - item.since) / 86_400_000));
            const row = (<>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-neutral-900">{item.name}</span>
                <span className={`block text-xs ${item.late ? 'font-semibold text-financial-loss' : 'text-neutral-500'}`}>{String(t('portfolio.clientFundsSince')).replace('{days}', String(days))}</span>
              </span>
              <bdi dir="ltr" className="shrink-0 text-sm font-bold tabular-nums text-primary">{n(item.remaining)} {item.currency}</bdi>
              {onOpenClient && <ChevronRightIcon aria-hidden="true" className="h-5 w-5 shrink-0 text-neutral-400 rtl:-scale-x-100"/>}
            </>);
            return (<li key={`${item.clientId}-${item.currency}`}>
                {onOpenClient
                    ? <button type="button" onClick={() => onOpenClient(item.clientId)} className="flex min-h-touch w-full items-center gap-3 px-3 py-2 text-start transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary">{row}</button>
                    : <div className="flex min-h-touch items-center gap-3 px-3 py-2">{row}</div>}
              </li>);
        })}
      </ul>
    </section>);
}

export function PortfolioPage(props: PortfolioPageProps) {
    const {
        portfolioStats,
        smartTargetUsdt = 0,
        smartTargetEur = 0,
        parseAndEvaluate,
        openPortfolioBalanceEditModal,
        transactions,
        pendingDeliveries,
        onOpenClient,
        showEur = true,
    } = props;
    const { t } = useLanguage();
    const [simulatorOpen, setSimulatorOpen] = useState(false);
    const normalizeNearZero = (value: number) => (Object.is(value, -0) || Math.abs(value) < 0.005 ? 0 : value);
    const usdtAvail = normalizeNearZero((portfolioStats.usdt.available || 0) + (portfolioStats.usdt.locked || 0));
    const eurAvail = normalizeNearZero((portfolioStats.eur.available || 0) + (portfolioStats.eur.locked || 0));
    const usdtValue = usdtAvail * Number(portfolioStats.usdt.avgBuy || 0);
    const eurValue = eurAvail * Number(portfolioStats.eur.avgBuy || 0);
    const stockValue = usdtValue + eurValue;
    const lockState = usdtLockState(portfolioStats, Date.now());

    const priceMetrics = (pam: number, suggestedSellPrice: number): Metric[] => [
        { label: t('portfolio.currentPam') as string, value: pam, currency: 'DZD', decimals: 2 },
        ...(suggestedSellPrice > 0 ? [{ label: t('portfolio.suggestedSellPrice') as string, value: suggestedSellPrice, currency: 'DZD' as const, decimals: 2 }] : []),
    ];
    const usdtMetrics: Metric[] = [
        ...priceMetrics(portfolioStats.usdt.avgBuy, smartTargetUsdt),
        ...(lockState.total >= 0.005 ? [
            { label: t('treasury.available') as string, value: lockState.available, currency: 'USDT' as const, decimals: 2 },
            { label: t('treasury.locked') as string, value: lockState.locked, currency: 'USDT' as const, decimals: 2 },
        ] : []),
    ];

    return (<div className="anim-page-in flex flex-col gap-3">
      <HeroCard label={t('finance.stock')} value={stockValue}/>

      <AssetCard symbol="USDT" icon={<DollarSignIcon className="h-5 w-5"/>} tone="usdt" quantity={usdtAvail} value={usdtValue} metrics={usdtMetrics} onEdit={openPortfolioBalanceEditModal ? () => openPortfolioBalanceEditModal('USDT') : undefined} editLabel={t('common.edit') as string}>
        <UsdtLockDetails portfolioStats={portfolioStats}/>
      </AssetCard>

{showEur ? (
            <AssetCard symbol="EUR" icon={<EuroIcon className="h-5 w-5"/>} tone="eur" quantity={eurAvail} value={eurValue} metrics={priceMetrics(portfolioStats.eur.avgBuy, smartTargetEur)} onEdit={openPortfolioBalanceEditModal ? () => openPortfolioBalanceEditModal('EUR') : undefined} editLabel={t('common.edit') as string}/>
      ) : eurAvail > 0 ? (<p className="rounded-button bg-surface-muted px-3 py-2 text-xs text-neutral-600">{(t('portfolio.eurHiddenStock') as string).replace('{amount}', eurAvail.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}</p>) : null}

      {pendingDeliveries && (pendingDeliveries.USDT > 0 || pendingDeliveries.EUR > 0 || (pendingDeliveries.awaited?.USDT ?? 0) > 0 || (pendingDeliveries.awaited?.EUR ?? 0) > 0) && (<ClientFundsCard owed={pendingDeliveries} mine={{ USDT: usdtAvail, EUR: eurAvail }} onOpenClient={onOpenClient}/>)}
      {pendingDeliveries?.supplierList && pendingDeliveries.supplierList.length > 0 && (<SupplierAwaitedCard list={pendingDeliveries.supplierList} onOpenClient={onOpenClient}/>)}

      <EurFundedCostImpactCard transactions={transactions}/>

      <ListRow standalone icon={<RefreshCwIcon className="h-5 w-5"/>} tone="primary" title={t('portfolio.pamSimulatorShort') as string} subtitle={t('portfolio.pamSimulatorHint') as string} wrapSubtitle onClick={() => setSimulatorOpen(true)}/>

      <BottomSheet isOpen={simulatorOpen} onClose={() => setSimulatorOpen(false)} title={t('portfolio.pamPriceSimulator') as string}>
        <div className="p-4 sm:px-5">
          <PamSimulator portfolioStats={portfolioStats} smartTargetUsdt={smartTargetUsdt} parseAndEvaluate={parseAndEvaluate}/>
        </div>
      </BottomSheet>
    </div>);
}
