import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { PageHeader } from '../components/ui/PageHeader';
import { SectionHeading } from '../components/ui/SectionHeading';
import { CurrencyAmount } from '../components/financial/CurrencyAmount';
import { TrendingUpIcon } from '../components/icons/TrendingUpIcon';
import { CalendarIcon } from '../components/icons/CalendarIcon';
import { UsersIcon } from '../components/icons/UsersIcon';
import { useLanguage } from '../contexts/LanguageContext';
import { AnalyticsReportCard } from '../components/analytics/AnalyticsReportCard';
import { AnalyticsPageProps } from '../components/analytics/analyticsTypes';
import { useAnalyticsViewModel } from '../components/analytics/useAnalyticsViewModel';

const MONTH_LABELS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
const FULL_MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function buildCalendarGrid(year: number, month: number, heatmapData: Map<number, number>) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDow = new Date(year, month, 1).getDay();
    const startOffset = firstDow === 0 ? 6 : firstDow - 1;
    const cells: Array<{ day: number | null; profit: number }> = [];
    for (let i = 0; i < startOffset; i++) cells.push({ day: null, profit: 0 });
    for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, profit: heatmapData.get(d) || 0 });
    while (cells.length % 7 !== 0) cells.push({ day: null, profit: 0 });
    return cells;
}

function pctChange(current: number | null, prev: number | null): { label: string; cls: string } | null {
    if (current === null || prev === null || prev === 0) return null;
    const pct = ((current - prev) / Math.abs(prev)) * 100;
    return {
        label: `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(1)}%`,
        cls: pct >= 0 ? 'text-financial-profit' : 'text-financial-loss',
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
    const { calculatedStats, heatmapData, monthlyClientRanking, allTimeClientRanking, annualStats, allTimeStats, prevMonthStats, priceHistory } = useAnalyticsViewModel({
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
    const prevMonthIdx = props.usdtReportMonth === 0 ? 11 : props.usdtReportMonth - 1;
    const analyticsReportCardProps = { ...props, t, calculatedStats, monthlyClientRanking, heatmapData };

    return (
        <div className="anim-page-in space-y-4">
            <PageHeader
                title={t('nav.analytics') as string}
                subtitle={`${selectedMonthLabel} ${props.usdtReportYear}`}
            />

            {/* ═══════════════════════════════════════════
                ZONE 1 — CE MOIS (Profit + Performance fusionnés)
            ═══════════════════════════════════════════ */}
            <Card>
                <CardContent className="p-4 space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <TrendingUpIcon className="w-4 h-4 text-financial-profit"/>
                            <span className="text-sm font-bold text-neutral-700">
                                {t('portfolio.realizedProfit')} — {selectedMonthLabel}
                            </span>
                        </div>
                        {prevMonthStats.sellCount > 0 && (
                            <span className="text-[10px] font-semibold text-neutral-400">
                                vs {MONTH_LABELS_FR[prevMonthIdx]}
                            </span>
                        )}
                    </div>

                    {/* Primary value */}
                    <div>
                        <CurrencyAmount
                            value={calculatedStats.realizedProfit}
                            currency="DZD"
                            semantic="auto"
                            size="xl"
                            decimals={0}
                            showSign
                        />
                        {(() => { const c = pctChange(calculatedStats.realizedProfit, prevMonthStats.realizedProfit); return c ? <span className={`ms-2 text-xs font-bold ${c.cls}`}>{c.label}</span> : null; })()}
                    </div>

                    {/* Volume row */}
                    <div className="flex items-center gap-4 flex-wrap text-sm">
                        {calculatedStats.volUsdtSold > 0 && (
                            <span className="text-neutral-500">
                                <CurrencyAmount value={calculatedStats.volUsdtSold} currency="USDT" semantic="plain" size="sm" decimals={0}/>
                                {' '}<span className="text-neutral-400">vendus</span>
                            </span>
                        )}
                        {calculatedStats.volEurSold > 0 && (
                            <span className="text-neutral-500">
                                <CurrencyAmount value={calculatedStats.volEurSold} currency="EUR" semantic="plain" size="sm" decimals={0}/>
                                {' '}<span className="text-neutral-400">vendus</span>
                            </span>
                        )}
                        {calculatedStats.sellCount > 0 && (
                            <span className="text-neutral-400 text-[12px]">
                                {calculatedStats.sellCount} vente{calculatedStats.sellCount > 1 ? 's' : ''}
                            </span>
                        )}
                    </div>

                    {/* Performance strip (only if sells exist) */}
                    {calculatedStats.sellCount > 0 && (<>
                        <div className="border-t border-border"/>
                        <div className="grid grid-cols-3 gap-3">
                            {/* Win rate */}
                            <div>
                                <p className="text-[10px] font-bold uppercase text-neutral-400 mb-1">{t('portfolio.winRate')}</p>
                                <span className={`text-lg font-extrabold tabular-nums ${(calculatedStats.winRate ?? 0) >= 80 ? 'text-financial-profit' : (calculatedStats.winRate ?? 0) >= 50 ? 'text-warning' : 'text-financial-loss'}`}>
                                    {calculatedStats.winRate !== null ? `${Math.round(calculatedStats.winRate)}%` : '—'}
                                </span>
                                {(() => { const c = pctChange(calculatedStats.winRate, prevMonthStats.winRate); return c ? <p className={`text-[10px] font-bold ${c.cls}`}>{c.label}</p> : null; })()}
                            </div>
                            {/* Avg profit per sell */}
                            <div>
                                <p className="text-[10px] font-bold uppercase text-neutral-400 mb-1">{t('portfolio.avgProfitPerSale')}</p>
                                {calculatedStats.avgProfitPerSell !== null
                                    ? <CurrencyAmount value={calculatedStats.avgProfitPerSell} currency="DZD" semantic="auto" size="md" decimals={0}/>
                                    : <span className="text-neutral-400">—</span>}
                                {(() => { const c = pctChange(calculatedStats.avgProfitPerSell, prevMonthStats.avgProfitPerSell); return c ? <p className={`text-[10px] font-bold ${c.cls}`}>{c.label}</p> : null; })()}
                            </div>
                            {/* Best sell of the month */}
                            <div>
                                <p className="text-[10px] font-bold uppercase text-neutral-400 mb-1">{t('portfolio.bestSale')}</p>
                                {calculatedStats.bestSellProfit > 0
                                    ? <CurrencyAmount value={calculatedStats.bestSellProfit} currency="DZD" semantic="profit" size="md" decimals={0}/>
                                    : <span className="text-neutral-400">—</span>}
                                <p className="text-[9px] text-neutral-300 mt-0.5">ce mois</p>
                            </div>
                        </div>
                    </>)}
                </CardContent>
            </Card>

            {/* ═══════════════════════════════════════════
                ZONE 2 — CALENDRIER DU MOIS
            ═══════════════════════════════════════════ */}
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
                                    <p className="text-[10px] font-bold uppercase text-neutral-400">{totalDaysWithActivity} {t('portfolio.activeDays')}</p>
                                    <CurrencyAmount value={monthProfit} currency="DZD" semantic="auto" size="sm" decimals={0} showSign/>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="px-4 pb-4 pt-0">
                            <div className="grid grid-cols-7 gap-1 mb-1">
                                {DAY_LABELS.map((d, i) => (
                                    <div key={i} className="text-center text-[10px] font-bold text-neutral-400 py-0.5">{d}</div>
                                ))}
                            </div>
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
                            <div className="mt-3 flex items-center justify-end gap-2">
                                <span className="text-[10px] text-neutral-400">Moins</span>
                                {['bg-neutral-100', 'bg-financial-profit/20', 'bg-financial-profit/45', 'bg-financial-profit/70', 'bg-financial-profit'].map((cls, i) => (
                                    <div key={i} className={`h-3 w-3 rounded-sm ${cls}`}/>
                                ))}
                                <span className="text-[10px] text-neutral-400">Plus</span>
                                <div className="h-3 w-3 rounded-sm bg-financial-loss/25 ms-1"/>
                                <span className="text-[10px] text-neutral-400">Perte</span>
                            </div>
                        </CardContent>
                    </Card>
                );
            })()}

            {/* ═══════════════════════════════════════════
                ZONE 2b — PRIX DE VENTE (Trend des marges)
            ═══════════════════════════════════════════ */}
            {priceHistory.current && (
                <Card>
                    <CardHeader className="p-4 pb-3">
                        <div className="flex items-center justify-between gap-2">
                            <SectionHeading icon={<TrendingUpIcon className="w-4 h-4" />}>
                                {t('portfolio.salesPriceUsdt')}
                            </SectionHeading>
                            {priceHistory.prev && (
                                <span className="text-[10px] font-semibold text-neutral-400">
                                    vs {MONTH_LABELS_FR[props.usdtReportMonth === 0 ? 11 : props.usdtReportMonth - 1]}
                                </span>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 space-y-4">
                        {/* KPIs row */}
                        <div className="grid grid-cols-3 gap-2">
                            <div className="rounded-xl border border-border bg-surface-muted p-3">
                                <p className="text-[10px] font-bold uppercase text-neutral-400 mb-1">{t('portfolio.avgSalesPrice')}</p>
                                <p dir="ltr" className="text-lg font-extrabold tabular-nums text-neutral-800">
                                    {priceHistory.current.avgSell.toFixed(2)}
                                </p>
                                <p className="text-[9px] text-neutral-400">DZD/USDT</p>
                                {priceHistory.prev && (() => {
                                    const c = pctChange(priceHistory.current!.avgSell, priceHistory.prev!.avgSell);
                                    return c ? <p className={`text-[10px] font-bold mt-0.5 ${c.cls}`}>{c.label}</p> : null;
                                })()}
                            </div>
                            <div className="rounded-xl border border-border bg-surface-muted p-3">
                                <p className="text-[10px] font-bold uppercase text-neutral-400 mb-1">{t('portfolio.avgMargin')}</p>
                                <p dir="ltr" className={`text-lg font-extrabold tabular-nums ${priceHistory.current.avgMargin >= 0 ? 'text-financial-profit' : 'text-financial-loss'}`}>
                                    {priceHistory.current.avgMargin >= 0 ? '+' : ''}{priceHistory.current.avgMargin.toFixed(2)}
                                </p>
                                <p className="text-[9px] text-neutral-400">DZD/USDT</p>
                                {priceHistory.prev && (() => {
                                    const c = pctChange(priceHistory.current!.avgMargin, priceHistory.prev!.avgMargin);
                                    return c ? <p className={`text-[10px] font-bold mt-0.5 ${c.cls}`}>{c.label}</p> : null;
                                })()}
                            </div>
                            <div className="rounded-xl border border-border bg-surface-muted p-3">
                                <p className="text-[10px] font-bold uppercase text-neutral-400 mb-1">Marge %</p>
                                <p className={`text-lg font-extrabold tabular-nums ${priceHistory.current.avgMargin >= 0 ? 'text-financial-profit' : 'text-financial-loss'}`}>
                                    {priceHistory.current.avgSell > 0
                                        ? `${priceHistory.current.avgMargin >= 0 ? '+' : ''}${((priceHistory.current.avgMargin / priceHistory.current.avgSell) * 100).toFixed(2)}%`
                                        : '—'}
                                </p>
                                <p className="text-[9px] text-neutral-400">{t('portfolio.marginOnPrice')}</p>
                            </div>
                        </div>

                        {/* 6-month mini bar chart */}
                        {priceHistory.trend.some(t => t.data !== null) && (
                            <div>
                                <p className="mb-2 text-[10px] font-bold uppercase text-neutral-400">{t('portfolio.marginTrend')}</p>
                                <div className="space-y-1">
                                    {priceHistory.trend.map((item, i) => {
                                        if (!item.data) return (
                                            <div key={i} className="flex items-center gap-2">
                                                <span className={`w-8 text-[10px] font-semibold shrink-0 ${item.monthIdx === props.usdtReportMonth && item.year === props.usdtReportYear ? 'text-primary' : 'text-neutral-300'}`}>
                                                    {MONTH_LABELS_FR[item.monthIdx]}
                                                </span>
                                                <div className="flex-1 rounded-full bg-neutral-100 h-2"/>
                                                <div className="w-20 text-end shrink-0 text-[10px] text-neutral-300">—</div>
                                            </div>
                                        );
                                        const maxMargin = Math.max(...priceHistory.trend.filter(t => t.data).map(t => Math.abs(t.data!.avgMargin)), 1);
                                        const isActive = item.monthIdx === props.usdtReportMonth && item.year === props.usdtReportYear;
                                        const barPct = Math.max(4, (Math.abs(item.data.avgMargin) / maxMargin) * 100);
                                        return (
                                            <div key={i} className={`flex items-center gap-2 rounded-lg px-1 py-0.5 ${isActive ? 'bg-primary/5 ring-1 ring-primary/20' : ''}`}>
                                                <span className={`w-8 text-[10px] font-semibold shrink-0 ${isActive ? 'text-primary' : 'text-neutral-400'}`}>
                                                    {MONTH_LABELS_FR[item.monthIdx]}
                                                </span>
                                                <div className="flex-1 rounded-full bg-neutral-100 h-2">
                                                    <div
                                                        className={`h-2 rounded-full ${item.data.avgMargin >= 0 ? 'bg-financial-profit' : 'bg-financial-loss'}`}
                                                        style={{ width: `${barPct}%` }}
                                                    />
                                                </div>
                                                <div className="w-20 text-end shrink-0">
                                                    <span dir="ltr" className={`text-[11px] font-semibold tabular-nums ${item.data.avgMargin >= 0 ? 'text-financial-profit' : 'text-financial-loss'}`}>
                                                        {item.data.avgMargin >= 0 ? '+' : ''}{item.data.avgMargin.toFixed(2)} DZD
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <p className="mt-2 text-[9px] text-neutral-400 text-end">{t('portfolio.marginFormula')}</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* ═══════════════════════════════════════════
                ZONE 3 — BILAN ANNUEL
            ═══════════════════════════════════════════ */}
            <Card>
                <CardHeader className="p-4 pb-3">
                    <SectionHeading icon={<CalendarIcon className="w-4 h-4" />}>
                        Bilan {props.usdtReportYear}
                    </SectionHeading>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl border border-border bg-surface-muted p-3">
                            <p className="text-[11px] font-bold uppercase text-neutral-500">{t('portfolio.salesProfitYtd')}</p>
                            <div className="mt-1">
                                <CurrencyAmount value={annualStats.ytdProfit} currency="DZD" semantic="auto" size="lg" decimals={0}/>
                            </div>
                            <p className="mt-1 text-[10px] text-neutral-400">Jan → {MONTH_LABELS_FR[props.usdtReportMonth]}</p>
                        </div>
                        <div className="rounded-xl border border-border bg-surface-muted p-3">
                            <p className="text-[11px] font-bold uppercase text-neutral-500">{t('portfolio.bestMonth')} {props.usdtReportYear}</p>
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
                    <div>
                        <p className="mb-2 text-[11px] font-bold uppercase text-neutral-400">{t('portfolio.monthlySalesProfit')}</p>
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
                                    <div className="w-24 text-end shrink-0">
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

            {/* ═══════════════════════════════════════════
                ZONE 4 — TOUT TEMPS (Stats all-time + Top clients fusionnés)
            ═══════════════════════════════════════════ */}
            {allTimeStats.totalSells > 0 && (
                <Card>
                    <CardHeader className="p-4 pb-3">
                        <SectionHeading icon={<TrendingUpIcon className="w-4 h-4" />}>
                            Tout temps
                        </SectionHeading>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 space-y-4">
                        {/* All-time KPIs — 4 compact stats */}
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            <div className="rounded-xl border border-border bg-surface-muted p-3">
                                <p className="text-[10px] font-bold uppercase text-neutral-400 mb-1">{t('portfolio.totalSalesProfit')}</p>
                                <CurrencyAmount value={allTimeStats.totalProfit} currency="DZD" semantic="auto" size="md" decimals={0}/>
                            </div>
                            <div className="rounded-xl border border-border bg-surface-muted p-3">
                                <p className="text-[10px] font-bold uppercase text-neutral-400 mb-1">{t('portfolio.winRate')}</p>
                                <span className={`text-base font-extrabold tabular-nums ${(allTimeStats.winRate ?? 0) >= 80 ? 'text-financial-profit' : (allTimeStats.winRate ?? 0) >= 50 ? 'text-warning' : 'text-financial-loss'}`}>
                                    {allTimeStats.winRate !== null ? `${Math.round(allTimeStats.winRate)}%` : '—'}
                                </span>
                                <p className="text-[9px] text-neutral-400 mt-0.5">{allTimeStats.totalSells} ventes</p>
                            </div>
                            <div className="rounded-xl border border-border bg-surface-muted p-3">
                                <p className="text-[10px] font-bold uppercase text-neutral-400 mb-1">{t('portfolio.bestSale')}</p>
                                <CurrencyAmount value={allTimeStats.bestSellProfit} currency="DZD" semantic="profit" size="md" decimals={0}/>
                                <p className="text-[9px] text-neutral-400 mt-0.5">record absolu</p>
                            </div>
                            <div className="rounded-xl border border-border bg-surface-muted p-3">
                                <p className="text-[10px] font-bold uppercase text-neutral-400 mb-1">{t('portfolio.bestMonth')}</p>
                                {allTimeStats.bestMonthKey
                                    ? <><CurrencyAmount value={allTimeStats.bestMonthProfit} currency="DZD" semantic="profit" size="md" decimals={0}/>
                                       <p className="text-[9px] text-neutral-400 mt-0.5">{allTimeStats.bestMonthKey}</p></>
                                    : <span className="text-neutral-400">—</span>}
                            </div>
                        </div>

                        {/* Volume row */}
                        {(allTimeStats.usdtTotal > 0 || allTimeStats.eurTotal > 0) && (
                            <div className="flex items-center gap-3 text-xs text-neutral-500 border-t border-border pt-3">
                                <span className="text-[10px] font-bold uppercase text-neutral-400">Volume total :</span>
                                {allTimeStats.usdtTotal > 0 && (
                                    <span dir="ltr" className="font-semibold text-neutral-700">
                                        {allTimeStats.usdtTotal.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} USDT
                                    </span>
                                )}
                                {allTimeStats.eurTotal > 0 && (
                                    <span dir="ltr" className="font-semibold text-neutral-700">
                                        {allTimeStats.eurTotal.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} EUR
                                    </span>
                                )}
                            </div>
                        )}

                        {/* Top clients — two columns side by side */}
                        {(allTimeClientRanking.byProfit.length > 0 || allTimeClientRanking.byVolume.length > 0) && (
                            <div className="border-t border-border pt-3">
                                <p className="mb-3 text-[10px] font-bold uppercase text-neutral-400 flex items-center gap-1">
                                    <UsersIcon className="w-3 h-3"/> Top clients
                                </p>
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    {/* By profit */}
                                    {allTimeClientRanking.byProfit.length > 0 && (() => {
                                        const maxP = Math.max(...allTimeClientRanking.byProfit.map((r) => r.realizedProfit), 1);
                                        return (
                                            <div>
                                                <p className="mb-2 text-[10px] font-semibold text-neutral-400">{t('portfolio.realizedProfit')}</p>
                                                <div className="space-y-1.5">
                                                    {allTimeClientRanking.byProfit.map((row, i) => (
                                                        <div key={row.clientId} className="flex items-center gap-2">
                                                            <span className="w-3.5 text-[10px] font-bold text-neutral-300 shrink-0">{i + 1}</span>
                                                            <span className="w-20 text-xs font-semibold truncate shrink-0 text-neutral-700">{row.clientName}</span>
                                                            <div className="flex-1 rounded-full bg-neutral-100 h-1.5">
                                                                <div className="h-1.5 rounded-full bg-financial-profit/60" style={{ width: `${(Math.abs(row.realizedProfit) / maxP) * 100}%` }}/>
                                                            </div>
                                                            <CurrencyAmount value={row.realizedProfit} currency="DZD" semantic="auto" size="sm" decimals={0} showSign/>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                    {/* By sell volume */}
                                    {allTimeClientRanking.byVolume.length > 0 && (() => {
                                        const maxVol = Math.max(...allTimeClientRanking.byVolume.map((r) => r.sellVolumeUsdt), 1);
                                        return (
                                            <div>
                                                <p className="mb-2 text-[10px] font-semibold text-neutral-400">Par volume vendu</p>
                                                <div className="space-y-1.5">
                                                    {allTimeClientRanking.byVolume.map((row, i) => (
                                                        <div key={row.clientId} className="flex items-center gap-2">
                                                            <span className="w-3.5 text-[10px] font-bold text-neutral-300 shrink-0">{i + 1}</span>
                                                            <span className="w-20 text-xs font-semibold truncate shrink-0 text-neutral-700">{row.clientName}</span>
                                                            <div className="flex-1 rounded-full bg-neutral-100 h-1.5">
                                                                <div className="h-1.5 rounded-full bg-primary/50" style={{ width: `${(row.sellVolumeUsdt / maxVol) * 100}%` }}/>
                                                            </div>
                                                            <span dir="ltr" className="text-[11px] font-semibold text-neutral-600 shrink-0 w-14 text-end tabular-nums">
                                                                {row.sellVolumeUsdt.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} U
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* ═══════════════════════════════════════════
                ZONE 5 — RAPPORT DÉTAILLÉ (mensuel)
            ═══════════════════════════════════════════ */}
            <AnalyticsReportCard {...analyticsReportCardProps} />
        </div>
    );
}
