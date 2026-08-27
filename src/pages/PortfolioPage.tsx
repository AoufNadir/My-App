import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { HeroKpiCard } from '../components/ui/HeroKpiCard';
import { IconButton } from '../components/ui/IconButton';
import { CurrencyAmount } from '../components/financial/CurrencyAmount';
import { PageHeader } from '../components/ui/PageHeader';
import { SectionHeading } from '../components/ui/SectionHeading';
import { BriefcaseIcon } from '../components/icons/BriefcaseIcon';
import { WalletIcon } from '../components/icons/WalletIcon';
import { PencilIcon } from '../components/icons/PencilIcon';
import { PamSimulatorCard } from '../components/portfolio/PamSimulatorCard';
import { useLanguage } from '../contexts/LanguageContext';
import { Tx, ClientDzd, ClientTransactionDzd } from '../types';
import { USDTStockCard } from './TresoreriePage';

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

type AssetRowProps = {
    symbol: 'USDT' | 'EUR';
    quantity: number;
    value: number;
    pam: number;
    suggestedSellPrice: number;
    onEdit?: () => void;
    sellLabel: string;
    pamLabel: string;
};

function AssetRow({ symbol, quantity, value, pam, suggestedSellPrice, onEdit, sellLabel, pamLabel }: AssetRowProps) {
    return (
        <div className="rounded-lg bg-surface-muted p-4">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-neutral-700">{symbol}</p>
                    <div className="mt-1">
                        <CurrencyAmount value={quantity} currency={symbol} semantic="plain" size="hero" decimals={2}/>
                    </div>
                    <p className="mt-1 text-xs text-neutral-500">
                        <CurrencyAmount value={value} currency="DZD" semantic="plain" size="sm" decimals={0}/>
                    </p>
                </div>
                {onEdit && (
                    <IconButton label={`Modifier ${symbol}`} variant="edit" size="sm" onClick={onEdit}>
                        <PencilIcon />
                    </IconButton>
                )}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
                <AssetMetric label={pamLabel} value={pam} />
                {suggestedSellPrice > 0 && <AssetMetric label={sellLabel} value={suggestedSellPrice} />}
            </div>
        </div>
    );
}

type AssetMetricProps = {
    label: string;
    value: number;
};

function AssetMetric({ label, value }: AssetMetricProps) {
    return (
        <div className="rounded-lg bg-surface px-3 py-2">
            <p className="text-xs font-medium text-neutral-500">{label}</p>
            <CurrencyAmount value={value} currency="DZD" semantic="plain" size="md" decimals={2}/>
        </div>
    );
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
    const normalizeNearZero = (value: number) => (Object.is(value, -0) || Math.abs(value) < 0.005 ? 0 : value);
    const usdtAvail = normalizeNearZero((portfolioStats.usdt.available || 0) + (portfolioStats.usdt.locked || 0));
    const eurAvail = normalizeNearZero((portfolioStats.eur.available || 0) + (portfolioStats.eur.locked || 0));
    const usdtValue = usdtAvail * Number(portfolioStats.usdt.avgBuy || 0);
    const eurValue = eurAvail * Number(portfolioStats.eur.avgBuy || 0);
    const stockValue = usdtValue + eurValue;

    return (
        <div className="anim-page-in space-y-4">
            <PageHeader
                title={t('finance.stock') as string}
                subtitle={t('portfolio.currentStatus') as string}
            />

            <HeroKpiCard
                accent="sky"
                icon={<WalletIcon className="h-5 w-5" />}
                primaryLabel={t('finance.stock') as string}
                primaryValue={stockValue}
                primaryCurrency="DZD"
                primarySemantic="plain"
                secondary={[
                    {
                        label: 'USDT',
                        value: usdtAvail,
                        currency: 'USDT',
                        display: <CurrencyAmount value={usdtAvail} currency="USDT" semantic="plain" size="xl" decimals={2}/>,
                    },
                    {
                        label: 'EUR',
                        value: eurAvail,
                        currency: 'EUR',
                        display: <CurrencyAmount value={eurAvail} currency="EUR" semantic="plain" size="xl" decimals={2}/>,
                    },
                ]}
            />

            <Card>
                <CardHeader className="p-4 pb-3">
                    <SectionHeading icon={<BriefcaseIcon className="h-4 w-4" />}>
                        {t('portfolio.currentStatus')}
                    </SectionHeading>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-3 p-4 pt-0 sm:grid-cols-2">
                    <AssetRow
                        symbol="USDT"
                        quantity={usdtAvail}
                        value={usdtValue}
                        pam={portfolioStats.usdt.avgBuy}
                        suggestedSellPrice={smartTargetUsdt}
                        onEdit={openPortfolioBalanceEditModal ? () => openPortfolioBalanceEditModal('USDT') : undefined}
                        sellLabel={t('transactions.sell') as string}
                        pamLabel={t('portfolio.currentPam') as string}
                    />
                    <AssetRow
                        symbol="EUR"
                        quantity={eurAvail}
                        value={eurValue}
                        pam={portfolioStats.eur.avgBuy}
                        suggestedSellPrice={smartTargetEur}
                        onEdit={openPortfolioBalanceEditModal ? () => openPortfolioBalanceEditModal('EUR') : undefined}
                        sellLabel={t('transactions.sell') as string}
                        pamLabel={t('portfolio.currentPam') as string}
                    />
                </CardContent>
            </Card>

            <PamSimulatorCard
                portfolioStats={portfolioStats}
                smartTargetUsdt={smartTargetUsdt}
                parseAndEvaluate={parseAndEvaluate}
            />

            <USDTStockCard transactions={transactions} portfolioStats={portfolioStats} />
        </div>
    );
}
