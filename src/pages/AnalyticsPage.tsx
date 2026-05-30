import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { PageHeader } from '../components/ui/PageHeader';
import { HeroKpiCard } from '../components/ui/HeroKpiCard';
import { SectionHeading } from '../components/ui/SectionHeading';
import { CurrencyAmount } from '../components/financial/CurrencyAmount';
import { TrendingUpIcon } from '../components/icons/TrendingUpIcon';
import { CalendarIcon } from '../components/icons/CalendarIcon';
import { UsersIcon } from '../components/icons/UsersIcon';
import { SparklesIcon } from '../components/icons/SparklesIcon';
import { useLanguage } from '../contexts/LanguageContext';
import { AnalyticsReportCard } from '../components/analytics/AnalyticsReportCard';
import { AnalyticsPageProps } from '../components/analytics/analyticsTypes';
import { useAnalyticsViewModel } from '../components/analytics/useAnalyticsViewModel';

const MONTH_LABELS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

export function AnalyticsPage(props: AnalyticsPageProps) {
    const { t } = useLanguage();
    const { calculatedStats, heatmapData, monthlyClientRanking, allTimeClientRanking, annualStats, allTimeStats } = useAnalyticsViewModel({
        transactions: props.transactions,
        usdtReportMonth: props.usdtReportMonth,
        usdtReportYear: props.usdtReportYear,
        clientTransactionsDzd: props.clientTransactionsDzd,
        clientsDzd: props.clientsDzd,
        getClientFullName: props.getClientFullName,
        t: t as (key: string) => string,
    });
    const monthOptions = props.reportMonths(props.usdtReportYear);
    const selectedMonthLabel = monthOptions[props.usdtReportMonth] || `${props.usdtReportMonth + 1}`;
    const analyticsReportCardProps = { ...props, t, calculatedStats, monthlyClientRanking, heatmapData };

    // Trend display
    const trendColor = annualStats.trend === null ? 'text-neutral-500'
        : annualStats.trend > 0 ? 'text-financial-profit' : 'text-financial-loss';
    const trendLabel = annualStats.trend === null ? '—'
        : `${annualStats.trend > 0 ? '+' : ''}${annualStats.trend.toFixed(1)}% vs mois précédent`;

    return (
        <div className="anim-page-in space-y-4">
            <PageHeader
                title={t('nav.analytics') as string}
                subtitle={`${selectedMonthLabel} ${props.usdtReportYear}`}
            />

            <HeroKpiCard
                accent="emerald"
                icon={<TrendingUpIcon className="h-5 w-5" />}
                primaryLabel={t('portfolio.realizedProfit') as string}
                primaryValue={calculatedStats.realizedProfit}
                primaryCurrency="DZD"
                primarySemantic="auto"
                secondary={[
                    { label: t('portfolio.usdtSold') as string, value: calculatedStats.volUsdtSold, currency: 'USDT', semantic: 'plain' },
                    { label: t('portfolio.eurSold') as string, value: calculatedStats.volEurSold, currency: 'EUR', semantic: 'plain' },
                    { label: 'Tendance', value: 0, display: <span className={`text-base font-semibold ${trendColor}`}>{trendLabel}</span> },
                ]}
            />

            {/* Performance du mois */}
            {calculatedStats.sellCount > 0 && (
                <Card>
                    <CardHeader className="p-4 pb-3">
                        <SectionHeading icon={<SparklesIcon className="w-4 h-4" />}>
                            Performance — {selectedMonthLabel}
                        </SectionHeading>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            {/* Win rate */}
                            <div className="rounded-xl border border-border bg-surface-muted p-3">
                                <p className="text-[11px] font-bold uppercase text-neutral-500">Win rate</p>
                                <div className="mt-2 flex items-baseline gap-1">
                                    <span className={`text-2xl font-extrabold tabular-nums ${(calculatedStats.winRate ?? 0) >= 80 ? 'text-financial-profit' : (calculatedStats.winRate ?? 0) >= 50 ? 'text-warning' : 'text-financial-loss'}`}>
                                        {calculatedStats.winRate !== null ? Math.round(calculatedStats.winRate) : '—'}
                                    </span>
                                    {calculatedStats.winRate !== null && <span className="text-sm text-neutral-500">%</span>}
                                </div>
                                <p className="mt-1 text-[10px] text-neutral-400">{calculatedStats.sellCount} vente{calculatedStats.sellCount > 1 ? 's' : ''}</p>
                            </div>
                            {/* Avg profit per sell */}
                            <div className="rounded-xl border border-border bg-surface-muted p-3">
                                <p className="text-[11px] font-bold uppercase text-neutral-500">Moy. / vente</p>
                                <div className="mt-2">
                                    {calculatedStats.avgProfitPerSell !== null
                                        ? <CurrencyAmount value={calculatedStats.avgProfitPerSell} currency="DZD" semantic="auto" size="lg" decimals={0}/>
                                        : <span className="text-neutral-400">—</span>}
                                </div>
                                <p className="mt-1 text-[10px] text-neutral-400">profit moyen</p>
                            </div>
                            {/* Best sell */}
                            <div className="rounded-xl border border-border bg-surface-muted p-3">
                                <p className="text-[11px] font-bold uppercase text-neutral-500">Meilleure vente</p>
                                <div className="mt-2">
                                    {calculatedStats.bestSellProfit > 0
                                        ? <CurrencyAmount value={calculatedStats.bestSellProfit} currency="DZD" semantic="profit" size="lg" decimals={0}/>
                                        : <span className="text-neutral-400">—</span>}
                                </div>
                                <p className="mt-1 text-[10px] text-neutral-400">transaction unique</p>
                            </div>
                            {/* USDT volume */}
                            <div className="rounded-xl border border-border bg-surface-muted p-3">
                                <p className="text-[11px] font-bold uppercase text-neutral-500">Volume USDT</p>
                                <div className="mt-2">
                                    <CurrencyAmount value={calculatedStats.volUsdtSold} currency="USDT" semantic="plain" size="lg" decimals={0}/>
                                </div>
                                <p className="mt-1 text-[10px] text-neutral-400">vendus ce mois</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Bilan annuel */}
            <Card>
                <CardHeader className="p-4 pb-3">
                    <SectionHeading icon={<CalendarIcon className="w-4 h-4" />}>
                        Bilan {props.usdtReportYear}
                    </SectionHeading>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-3">
                    {/* YTD + best month */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl border border-border bg-surface-muted p-3">
                            <p className="text-[11px] font-bold uppercase text-neutral-500">Profit YTD</p>
                            <div className="mt-1">
                                <CurrencyAmount value={annualStats.ytdProfit} currency="DZD" semantic="auto" size="lg" decimals={0}/>
                            </div>
                            <p className="mt-1 text-[10px] text-neutral-400">Jan → {MONTH_LABELS_FR[props.usdtReportMonth]}</p>
                        </div>
                        <div className="rounded-xl border border-border bg-surface-muted p-3">
                            <p className="text-[11px] font-bold uppercase text-neutral-500">Meilleur mois</p>
                            <div className="mt-1">
                                {annualStats.bestMonth >= 0
                                    ? <CurrencyAmount value={annualStats.bestMonthProfit} currency="DZD" semantic="profit" size="lg" decimals={0}/>
                                    : <span className="text-neutral-400 text-sm">—</span>}
                            </div>
                            <p className="mt-1 text-[10px] text-neutral-400">
                                {annualStats.bestMonth >= 0 ? MONTH_LABELS_FR[annualStats.bestMonth] : '—'}
                            </p>
                        </div>
                    </div>

                    {/* Monthly bars (last 12 months) */}
                    <div>
                        <p className="mb-2 text-[11px] font-bold uppercase text-neutral-400">Profit mensuel</p>
                        <div className="space-y-1.5">
                            {annualStats.byMonth.map((profit, m) => {
                                const isActive = m === props.usdtReportMonth;
                                const maxProfit = Math.max(...annualStats.byMonth.filter((v) => v > 0), 1);
                                const barPct = profit > 0 ? Math.max(4, (profit / maxProfit) * 100) : 0;
                                return (<div key={m} className={`flex items-center gap-2 rounded-lg px-2 py-1 transition-colors ${isActive ? 'bg-primary/5 ring-1 ring-primary/20' : ''}`}>
                                    <span className={`w-8 text-[10px] font-semibold shrink-0 ${isActive ? 'text-primary' : 'text-neutral-400'}`}>
                                        {MONTH_LABELS_FR[m]}
                                    </span>
                                    <div className="flex-1 rounded-full bg-neutral-100 h-2">
                                        {profit !== 0 && (<div className={`h-2 rounded-full transition-all ${profit > 0 ? 'bg-financial-profit' : 'bg-financial-loss'}`} style={{ width: `${profit > 0 ? barPct : Math.min(barPct, 30)}%` }}/>)}
                                    </div>
                                    <div className="w-24 text-right shrink-0">
                                        {profit !== 0
                                            ? <CurrencyAmount value={profit} currency="DZD" semantic="auto" size="sm" decimals={0} showSign/>
                                            : <span className="text-[10px] text-neutral-300">—</span>}
                                    </div>
                                </div>);
                            })}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* All-time top clients */}
            {(allTimeClientRanking.byVolume.length > 0 || allTimeClientRanking.byProfit.length > 0) && (
                <Card>
                    <CardHeader className="p-4 pb-3">
                        <SectionHeading icon={<UsersIcon className="w-4 h-4" />}>
                            Top Clients — Tout temps
                        </SectionHeading>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 space-y-4">
                        {/* By volume */}
                        {allTimeClientRanking.byVolume.length > 0 && (() => {
                            const maxVol = Math.max(...allTimeClientRanking.byVolume.map((r) => r.totalVolumeUsdt), 1);
                            return (
                                <div>
                                    <p className="mb-2 text-[11px] font-bold uppercase text-neutral-400">Volume USDT échangé</p>
                                    <div className="space-y-2">
                                        {allTimeClientRanking.byVolume.map((row, i) => (
                                            <div key={row.clientId} className="flex items-center gap-2">
                                                <span className="w-4 text-[10px] font-bold text-neutral-400 shrink-0">{i + 1}</span>
                                                <span className="w-24 text-xs font-semibold truncate shrink-0">{row.clientName}</span>
                                                <div className="flex-1 rounded-full bg-neutral-100 h-1.5">
                                                    <div className="h-1.5 rounded-full bg-primary/60" style={{ width: `${(row.totalVolumeUsdt / maxVol) * 100}%` }}/>
                                                </div>
                                                <span dir="ltr" className="text-[11px] font-semibold text-neutral-600 shrink-0 w-20 text-right tabular-nums">
                                                    {row.totalVolumeUsdt.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} U
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })()}

                        {/* By profit */}
                        {allTimeClientRanking.byProfit.length > 0 && (() => {
                            const maxP = Math.max(...allTimeClientRanking.byProfit.map((r) => r.realizedProfit), 1);
                            return (
                                <div>
                                    <p className="mb-2 text-[11px] font-bold uppercase text-neutral-400">Profit généré (DZD)</p>
                                    <div className="space-y-2">
                                        {allTimeClientRanking.byProfit.map((row, i) => (
                                            <div key={row.clientId} className="flex items-center gap-2">
                                                <span className="w-4 text-[10px] font-bold text-neutral-400 shrink-0">{i + 1}</span>
                                                <span className="w-24 text-xs font-semibold truncate shrink-0">{row.clientName}</span>
                                                <div className="flex-1 rounded-full bg-neutral-100 h-1.5">
                                                    <div className={`h-1.5 rounded-full ${row.realizedProfit >= 0 ? 'bg-financial-profit/70' : 'bg-financial-loss/70'}`} style={{ width: `${(Math.abs(row.realizedProfit) / maxP) * 100}%` }}/>
                                                </div>
                                                <div className="shrink-0 w-24 text-right">
                                                    <CurrencyAmount value={row.realizedProfit} currency="DZD" semantic="auto" size="sm" decimals={0} showSign/>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })()}
                    </CardContent>
                </Card>
            )}

            {/* All-time stats */}
            {allTimeStats.totalSells > 0 && (
                <Card>
                    <CardHeader className="p-4 pb-3">
                        <SectionHeading icon={<TrendingUpIcon className="w-4 h-4" />}>
                            Depuis le début
                        </SectionHeading>
                    </CardHeader>
                    <CardContent className="p-0 divide-y divide-neutral-100">
                        <div className="flex items-center justify-between gap-3 px-4 py-3">
                            <span className="text-sm text-neutral-500">Profit total</span>
                            <CurrencyAmount value={allTimeStats.totalProfit} currency="DZD" semantic="auto" size="lg" decimals={0}/>
                        </div>
                        <div className="flex items-center justify-between gap-3 px-4 py-3">
                            <span className="text-sm text-neutral-500">Win rate global</span>
                            <span className={`text-base font-bold tabular-nums ${(allTimeStats.winRate ?? 0) >= 80 ? 'text-financial-profit' : (allTimeStats.winRate ?? 0) >= 50 ? 'text-warning' : 'text-financial-loss'}`}>
                                {allTimeStats.winRate !== null ? `${Math.round(allTimeStats.winRate)}%` : '—'}
                                <span className="ms-1 text-xs font-normal text-neutral-400">sur {allTimeStats.totalSells} ventes</span>
                            </span>
                        </div>
                        <div className="flex items-center justify-between gap-3 px-4 py-3">
                            <span className="text-sm text-neutral-500">Meilleure vente</span>
                            <CurrencyAmount value={allTimeStats.bestSellProfit} currency="DZD" semantic="profit" size="md" decimals={0}/>
                        </div>
                        {allTimeStats.bestMonthKey && (
                            <div className="flex items-center justify-between gap-3 px-4 py-3">
                                <span className="text-sm text-neutral-500">Meilleur mois</span>
                                <div className="text-end">
                                    <CurrencyAmount value={allTimeStats.bestMonthProfit} currency="DZD" semantic="profit" size="md" decimals={0}/>
                                    <p className="text-[10px] text-neutral-400">{allTimeStats.bestMonthKey}</p>
                                </div>
                            </div>
                        )}
                        <div className="flex items-center justify-between gap-3 px-4 py-3">
                            <span className="text-sm text-neutral-500">Volume total</span>
                            <div className="text-end text-sm font-semibold text-neutral-700">
                                <span dir="ltr">{allTimeStats.usdtTotal.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} USDT</span>
                                {allTimeStats.eurTotal > 0 && <span dir="ltr" className="ms-2">{allTimeStats.eurTotal.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} EUR</span>}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            <AnalyticsReportCard {...analyticsReportCardProps} />
        </div>
    );
}
