import { useState, type ReactNode } from 'react';
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
    handleExportClientReport: (clientId: string, month: number, year: number) => void;
    openPortfolioBalanceEditModal?: (asset: 'USDT' | 'EUR') => void;
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

export function PortfolioPage(props: PortfolioPageProps) {
    const {
        portfolioStats,
        smartTargetUsdt = 0,
        smartTargetEur = 0,
        parseAndEvaluate,
        openPortfolioBalanceEditModal,
        transactions,
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

      <AssetCard symbol="EUR" icon={<EuroIcon className="h-5 w-5"/>} tone="eur" quantity={eurAvail} value={eurValue} metrics={priceMetrics(portfolioStats.eur.avgBuy, smartTargetEur)} onEdit={openPortfolioBalanceEditModal ? () => openPortfolioBalanceEditModal('EUR') : undefined} editLabel={t('common.edit') as string}/>

      <EurFundedCostImpactCard transactions={transactions}/>

      <ListRow standalone icon={<RefreshCwIcon className="h-5 w-5"/>} tone="primary" title={t('portfolio.pamSimulatorShort') as string} subtitle={t('portfolio.pamSimulatorHint') as string} wrapSubtitle onClick={() => setSimulatorOpen(true)}/>

      <BottomSheet isOpen={simulatorOpen} onClose={() => setSimulatorOpen(false)} title={t('portfolio.pamPriceSimulator') as string}>
        <div className="p-4 sm:px-5">
          <PamSimulator portfolioStats={portfolioStats} smartTargetUsdt={smartTargetUsdt} parseAndEvaluate={parseAndEvaluate}/>
        </div>
      </BottomSheet>
    </div>);
}
