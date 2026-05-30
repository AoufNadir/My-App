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
const FULL_MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function buildCalendarGrid(year: number, month: number, heatmapData: Map<number, number>) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDow = new Date(year, month, 1).getDay(); // 0=Sun
    const startOffset = firstDow === 0 ? 6 : firstDow - 1; // Mon=0 offset
    const cells: Array<{ day: number | null; profit: number }> = [];
    for (let i = 0; i < startOffset; i++) cells.push({ day: null, profit: 0 });
    for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, profit: heatmapData.get(d) || 0 });
    while (cells.length % 7 !== 0) cells.push({ day: null, profit: 0 });
    return cells;
}

function pctChange(current: number | null, prev: number | null): { value: number; label: string; cls: string } | null {
    if (current === null || prev === null || prev === 0) return null;
    const pct = ((current - prev) / Math.abs(prev)) * 100;
    const isUp = pct >= 0;
    return {
        value: pct,
        label: `${isUp ? '▲' : '▼'} ${Math.abs(pct).toFixed(1)}%`,
        cls: isUp ? 'text-financial-profit' : 'text-financial-loss',
    };
}

function profitCellClass(profit: number, maxProfit: number): string {
    if (profit === 0) return 'bg-neutral-100 text-neutral-400';
    if (profit < 0) return 'bg-financial-loss/25 text-financial-loss';
    const ratio = maxProfit > 0 ? profit / maxProfit : 0;
    if (ratio < 0.25) return 'bg-financial-profit/20 text-financial-profit';
    if (ratio < 0.55) return 'bg-financial-profit/45 text-financial-profit';
    if (ratio < 0.80) return 'bg-financial-profit/70 text-white';
    return 'bg-financial-profit text-white';
}

export function AnalyticsPage(props: AnalyticsPageProps) {
    const { t } = useLanguage();
    const { calculatedStats, heatmapData, monthlyClientRanking, allTimeClientRanking, annualStats, allTimeStats, prevMonthStats } = useAnalyticsViewModel({
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
                    { label: 'Ventes', value: calculatedStats.sellCount, currency: null, semantic: 'plain' },
                ]}
            />

            {/* Performance du mois */}
            {calculatedStats.sellCount > 0 && (
                <Card>
                    <CardHeader className="p-4 pb-3">
                        <div className="flex items-center justify-between gap-2">
                            <SectionHeading icon={<SparklesIcon className="w-4 h-4" />}>
                                Performance — {selectedMonthLabel}
                            </SectionHeading>
                            {prevMonthStats.sellCount > 0 && (
                                <span className="shrink-0 text-[10px] font-semibold text-neutral-400">
                                    vs {MONTH_LABELS_FR[props.usdtReportMonth === 0 ? 11 : props.usdtReportMonth - 1]}
                                </span>
                            )}
                        </div>
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
                                {(() => { const c = pctChange(calculatedStats.winRate, prevMonthStats.winRate); return c ? <p className={`mt-0.5 text-[10px] font-bold ${c.cls}`}>{c.label}</p> : null; })()}
                            </div>
                            {/* Avg profit per sell */}
                            <div className="rounded-xl border border-border bg-surface-muted p-3">
                                <p className="text-[11px] font-bold uppercase text-neutral-500">Moy. / vente</p>
                                <div className="mt-2">
                                    {calculatedStats.avgProfitPerSell !== null
                                        ? <CurrencyAmount value={calculatedStats.avgProfitPerSell} currency="DZD" semantic="auto" size="lg" decimals={0}/>
                                        : <span className="text-neutral-400">—</span>}
                                </div>
                                {(() => { const c = pctChange(calculatedStats.avgProfitPerSell, prevMonthStats.avgProfitPerSell); return c ? <p className={`mt-0.5 text-[10px] font-bold ${c.cls}`}>{c.label}</p> : null; })()}
                            </div>
                            {/* Best sell */}
                            <div className="rounded-xl border border-border bg-surface-muted p-3">
                                <p className="text-[11px] font-bold uppercase text-neutral-500">Meilleure vente</p>
                                <div className="mt-2">
                                    {calculatedStats.bestSellProfit > 0
                                        ? <CurrencyAmount value={calculatedStats.bestSellProfit} currency="DZD" semantic="profit" size="lg" decimals={0}/>
                                        : <span className="text-neutral-400 text-lg font-bold">—</span>}
                                </div>
                                <p className="mt-1 text-[10px] text-neutral-400">transaction unique</p>
                            </div>
                            {/* Sell count */}
                            <div className="rounded-xl border border-border bg-surface-muted p-3">
                                <p className="text-[11px] font-bold uppercase text-neutral-500">Nb ventes</p>
                                <div className="mt-2">
                                    <span className="text-2xl font-extrabold tabular-nums text-neutral-800">{calculatedStats.sellCount}</span>
                                </div>
                                {(() => { const c = pctChange(calculatedStats.sellCount, prevMonthStats.sellCount); return c ? <p className={`mt-0.5 text-[10px] font-bold ${c.cls}`}>{c.label}</p> : null; })()}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Calendrier du mois */}
            {(() => {
                const cells = buildCalendarGrid(props.usdtReportYear, props.usdtReportMonth, heatmapData);
                const vals = Array.from(heatmapData.values()) as number[];
                const maxProfit = Math.max(...vals.filter(v => v > 0), 1);
                const totalDaysWithActivity = vals.filter(v => v !== 0).length;
                const monthProfit = vals.reduce((s, v) => s + v, 0);
                if (totalDaysWithActivity === 0) return null;
                return (
                    <Card>
                        <CardHeader className="p-4 pb-3">
                            <div className="flex items-center justify-between gap-2">
                                <SectionHeading icon={<CalendarIcon className="w-4 h-4" />}>
                                    {FULL_MONTHS_FR[props.usdtReportMonth]} {props.usdtReportYear}
                                </SectionHeading>
                                <div className="text-end shrink-0">
                                    <p className="text-[10px] font-bold uppercase text-neutral-400">{totalDaysWithActivity} jours actifs</p>
                                    <CurrencyAmount value={monthProfit} currency="DZD" semantic="auto" size="sm" decimals={0} showSign/>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="px-4 pb-4 pt-0">
                            {/* Weekday headers */}
                            <div className="grid grid-cols-7 gap-1 mb-1">
                                {DAY_LABELS.map((d, i) => (
                                    <div key={i} className="text-center text-[10px] font-bold text-neutral-400 py-0.5">{d}</div>
                                ))}
                            </div>
                            {/* Calendar cells */}
                            <div className="grid grid-cols-7 gap-1">
                                {cells.map((cell, i) => (
                                    <div
                                        key={i}
                                        title={cell.day && cell.profit !== 0 ? `${cell.day}: ${cell.profit >= 0 ? '+' : ''}${Math.round(cell.profit).toLocaleString('fr-FR')} DZD` : undefined}
                                        className={`aspect-square rounded-md flex flex-col items-center justify-center text-[11px] font-bold transition-colors ${cell.day ? profitCellClass(cell.profit, maxProfit) : 'bg-transparent'}`}
                                    >
                                        {cell.day && (
                                            <>
                                                <span>{cell.day}</span>
                                                {cell.profit !== 0 && (
                                                    <span className="text-[8px] font-semibold opacity-80 leading-none">
                                                        {cell.profit > 0 ? '+' : ''}
                                                        {Math.abs(cell.profit) >= 1000
                                                            ? `${(Math.abs(cell.profit) / 1000).toFixed(0)}k`
                                                            : Math.round(Math.abs(cell.profit))}
                                                    </span>
                                                )}
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                            {/* Legend */}
                            <div className="mt-3 flex items-center justify-end gap-2">
                                <span className="text-[10px] text-neutral-400">Moins</span>
                                {['bg-neutral-100', 'bg-financial-profit/20', 'bg-financial-profit/45', 'bg-financial-profit/70', 'bg-financial-profit'].map((cls, i) => (
                                    <div key={i} className={`h-3 w-3 rounded-sm ${cls}`}/>
                                ))}
                                <span className="text-[10px] text-neutral-400">Plus</span>
                                <div className="h-3 w-3 rounded-sm bg-financial-loss/25 ml-1"/>
                                <span className="text-[10px] text-neutral-400">Perte</span>
                            </div>
                        </CardContent>
                    </Card>
                );
            })()}

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
                        {/* By sell volume (sales only) */}
                        {allTimeClientRanking.byVolume.length > 0 && (() => {
                            const maxVol = Math.max(...allTimeClientRanking.byVolume.map((r) => r.sellVolumeUsdt), 1);
                            return (
                                <div>
                                    <p className="mb-2 text-[11px] font-bold uppercase text-neutral-400">Volume USDT vendu</p>
                                    <div className="space-y-2">
                                        {allTimeClientRanking.byVolume.map((row, i) => (
                                            <div key={row.clientId} className="flex items-center gap-2">
                                                <span className="w-4 text-[10px] font-bold text-neutral-400 shrink-0">{i + 1}</span>
                                                <span className="w-24 text-xs font-semibold truncate shrink-0">{row.clientName}</span>
                                                <div className="flex-1 rounded-full bg-neutral-100 h-1.5">
                                                    <div className="h-1.5 rounded-full bg-primary/60" style={{ width: `${(row.sellVolumeUsdt / maxVol) * 100}%` }}/>
                                                </div>
                                                <span dir="ltr" className="text-[11px] font-semibold text-neutral-600 shrink-0 w-20 text-right tabular-nums">
                                                    {row.sellVolumeUsdt.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} U
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
