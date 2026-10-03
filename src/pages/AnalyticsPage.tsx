import { Fragment, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { HeroCard, ListRow, SectionCard, StatTile } from '../components/cards';
import { CurrencyAmount } from '../components/financial/CurrencyAmount';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { IconButton } from '../components/ui/IconButton';
import { Select } from '../components/ui/Select';
import { Tabs, type Tab } from '../components/ui/Tabs';
import { CalendarIcon } from '../components/icons/CalendarIcon';
import { ChevronLeftIcon } from '../components/icons/ChevronLeftIcon';
import { ChevronRightIcon } from '../components/icons/ChevronRightIcon';
import { DownloadCloudIcon } from '../components/icons/DownloadCloudIcon';
import { TrendingUpIcon } from '../components/icons/TrendingUpIcon';
import { UsersIcon } from '../components/icons/UsersIcon';
import { useLanguage } from '../contexts/LanguageContext';
import { useHeaderActionsSlot } from '../components/main/headerActionsSlot';
import { AnalyticsExportSheet } from '../components/analytics/AnalyticsExportSheet';
import { AnalyticsPageProps } from '../components/analytics/analyticsTypes';
import { useAnalyticsViewModel } from '../components/analytics/useAnalyticsViewModel';

const MONTH_LABELS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

export type AnalyticsTab = 'month' | 'year' | 'alltime' | 'clients';

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

const winRateClass = (winRate: number | null) => ((winRate ?? 0) >= 80 ? 'text-financial-profit' : (winRate ?? 0) >= 50 ? 'text-warning' : 'text-financial-loss');

function Change({ change }: { change: { label: string; cls: string } | null }) {
    return change ? <span dir="ltr" className={`font-bold ${change.cls}`}>{change.label}</span> : null;
}
/** « ▲ 12.5% » under a tile, or nothing when there is no previous month to compare with. */
const changeHint = (change: { label: string; cls: string } | null) => (change ? <Change change={change}/> : undefined);

/** A day of the month and its profit, e.g. « 7 / 8 031 DZD »; « - » when there is none. */
function DayProfitValue({ entry }: { entry: [number, number] | null }) {
    if (!entry) return <span className="text-sm font-bold text-neutral-500">-</span>;
    return (<span className="flex flex-wrap items-center gap-1 text-sm font-bold text-neutral-900">
      <span dir="ltr">{entry[0]}</span>
      <span>/</span>
      <CurrencyAmount value={entry[1]} currency="DZD" semantic="auto" size="sm" decimals={0}/>
    </span>);
}

/** A ranked bar: position, client, bar, figure (top clients of all time). */
function RankBar({ rank, name, ratio, barClass, children }: { rank: number; name: string; ratio: number; barClass: string; children: ReactNode }) {
    return (<div className="flex items-center gap-2">
      <span className="w-3.5 shrink-0 text-xs font-bold text-neutral-400">{rank}</span>
      <span className="w-24 shrink-0 truncate text-xs font-semibold text-neutral-700">{name}</span>
      <div className="h-1.5 flex-1 rounded-full bg-neutral-100">
        <div className={`h-1.5 rounded-full ${barClass}`} style={{ width: `${ratio * 100}%` }}/>
      </div>
      {children}
    </div>);
}

export function AnalyticsPage({ initialTab = 'month', ...props }: AnalyticsPageProps & { initialTab?: AnalyticsTab }) {
    const { t, lang } = useLanguage();
    const [activeTab, setActiveTab] = useState<AnalyticsTab>(initialTab);
    const [isExportOpen, setIsExportOpen] = useState(false);
    const headerActionsSlot = useHeaderActionsSlot();
    const { calculatedStats, heatmapData, monthlyClientRanking, allTimeClientRanking, annualStats, allTimeStats, prevMonthStats, priceHistory } = useAnalyticsViewModel({
        transactions: props.transactions,
        usdtReportMonth: props.usdtReportMonth,
        usdtReportYear: props.usdtReportYear,
        clientTransactionsDzd: props.clientTransactionsDzd,
        clientsDzd: props.clientsDzd,
        getClientFullName: props.getClientFullName,
        t: t as (key: string) => string,
    });
    const month = props.usdtReportMonth;
    const year = props.usdtReportYear;
    const monthOptions = props.reportMonths(year);
    const selectedMonthLabel = monthOptions[month] || `${month + 1}`;
    const longMonths = t('common.months') as unknown as string[];
    const shortMonth = (index: number) => (lang === 'ar' ? longMonths[index] : MONTH_LABELS_FR[index]) ?? '';
    const vsPrevMonth = String(t('portfolio.vsMonth')).replace('{month}', shortMonth(month === 0 ? 11 : month - 1));
    const salesCount = (count: number) => `${count} ${t(count > 1 ? 'portfolio.saleMany' : 'portfolio.saleOne')}`;

    const monthlyHasData = Boolean(calculatedStats.volUsdtBought || calculatedStats.volUsdtSold
        || calculatedStats.volEurBought || calculatedStats.volEurSold
        || calculatedStats.realizedProfit || heatmapData.size);
    const bestHeatmapDay = [...heatmapData.entries()].sort((l, r) => r[1] - l[1])[0] || null;
    const worstHeatmapDay = [...heatmapData.entries()].sort((l, r) => l[1] - r[1])[0] || null;
    const heatmapValues = Array.from(heatmapData.values()) as number[];
    const activeDays = heatmapValues.filter((v) => v !== 0).length;
    const winningDays = heatmapValues.filter((v) => v > 0).length;
    const topProfitableRows = [...monthlyClientRanking.rankedRows]
        .filter((row) => row.sellCount > 0)
        .sort((a, b) => {
            if (b.realizedProfit !== a.realizedProfit) return b.realizedProfit - a.realizedProfit;
            if (b.totalVolumeUsdt !== a.totalVolumeUsdt) return b.totalVolumeUsdt - a.totalVolumeUsdt;
            return a.clientName.localeCompare(b.clientName, 'fr');
        })
        .slice(0, 5);

    // Month picker: the arrows walk the same months and years as the two lists.
    const yearIndex = props.reportYears.indexOf(year);
    const prevTarget = month > 0 ? { month: month - 1, year } : yearIndex > 0 ? { month: 11, year: props.reportYears[yearIndex - 1] } : null;
    const nextTarget = month < monthOptions.length - 1 ? { month: month + 1, year } : yearIndex >= 0 && yearIndex < props.reportYears.length - 1 ? { month: 0, year: props.reportYears[yearIndex + 1] } : null;
    const goTo = (target: { month: number; year: number } | null) => {
        if (!target) return;
        if (target.year !== year) props.setUsdtReportYear(target.year);
        props.setUsdtReportMonth(target.month);
    };
    const exportLabel = t('treasury.exportPdf') as string;
    const picker = (<div className="flex items-center gap-1.5">
        <IconButton label={t('portfolio.prevMonth') as string} variant="ghost" onClick={() => goTo(prevTarget)} disabled={!prevTarget}>
          <ChevronLeftIcon className="rtl:-scale-x-100"/>
        </IconButton>
        <div className="min-w-0 flex-1 sm:w-56 sm:flex-none">
          <Select aria-label={t('portfolio.month') as string} value={month} onChange={(event) => props.setUsdtReportMonth(Number(event.target.value))} className="font-semibold">
            {monthOptions.map((monthName, index) => <option key={monthName} value={index}>{monthName}</option>)}
          </Select>
        </div>
        <div className="w-24 shrink-0">
          <Select aria-label={t('portfolio.year') as string} value={year} onChange={(event) => props.setUsdtReportYear(Number(event.target.value))} className="font-semibold">
            {props.reportYears.map((option) => <option key={option} value={option}>{option}</option>)}
          </Select>
        </div>
        <IconButton label={t('portfolio.nextMonth') as string} variant="ghost" onClick={() => goTo(nextTarget)} disabled={!nextTarget}>
          <ChevronRightIcon className="rtl:-scale-x-100"/>
        </IconButton>
        <div className="ms-auto hidden shrink-0 sm:block">
          <Button type="button" variant="outline" size="sm" onClick={() => setIsExportOpen(true)} className="gap-1.5 font-semibold" title={exportLabel}>
            <DownloadCloudIcon className="h-4 w-4"/>
            PDF
          </Button>
        </div>
      </div>);

    const profitChange = pctChange(calculatedStats.realizedProfit, prevMonthStats.realizedProfit);
    const heroNote = profitChange || prevMonthStats.sellCount > 0 ? (<p className="flex flex-wrap items-center gap-x-2 text-xs">
        <Change change={profitChange}/>
        {prevMonthStats.sellCount > 0 && <span className="font-semibold text-neutral-500">{vsPrevMonth}</span>}
      </p>) : undefined;
    const volumes: ReactNode[] = [];
    if (calculatedStats.volUsdtSold > 0)
        volumes.push(<span key="usdt"><CurrencyAmount value={calculatedStats.volUsdtSold} currency="USDT" semantic="plain" size="sm" decimals={0}/> {t('portfolio.soldSuffix')}</span>);
    if (calculatedStats.volEurSold > 0)
        volumes.push(<span key="eur"><CurrencyAmount value={calculatedStats.volEurSold} currency="EUR" semantic="plain" size="sm" decimals={0}/> {t('portfolio.soldSuffix')}</span>);
    if (calculatedStats.sellCount > 0)
        volumes.push(<span key="count">{salesCount(calculatedStats.sellCount)}</span>);

    const tabs: Tab[] = [
        { id: 'month', label: t('portfolio.month') as string },
        { id: 'year', label: t('portfolio.year') as string },
        { id: 'alltime', label: t('portfolio.allTime') as string },
        { id: 'clients', label: t('portfolio.tabClients') as string, badge: topProfitableRows.length },
    ];

    const monthTab = !monthlyHasData ? (<EmptyState icon={<CalendarIcon className="h-5 w-5"/>} title={t('portfolio.noMonthlyActivity') as string} subtitle={t('portfolio.emptyPeriod') as string} className="rounded-card border border-border bg-surface"/>) : (<>
        <SectionCard title={t('portfolio.profitHeatmap')} actions={activeDays > 0 ? (<div className="pe-2 text-end">
              <p className="text-xs font-semibold text-neutral-500">{activeDays} {t('portfolio.activeDays')}</p>
              <CurrencyAmount value={heatmapValues.reduce((s, v) => s + v, 0)} currency="DZD" semantic="auto" size="sm" decimals={0} showSign/>
            </div>) : undefined}>
          {activeDays > 0 && (() => {
              const cells = buildCalendarGrid(year, month, heatmapData);
              const maxProfit = Math.max(...heatmapValues.filter((v) => v > 0), 1);
              const weekdays = t('common.weekdaysNarrow') as unknown as string[];
              return (<div className="mb-3 border-b border-border pb-3">
                <div className="sm:mx-auto sm:max-w-md">
                  <div className="mb-1 grid grid-cols-7 gap-1">
                    {weekdays.map((d, i) => <div key={i} className="py-0.5 text-center text-xs font-bold text-neutral-400">{d}</div>)}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {cells.map((cell, i) => (<div key={i} title={cell.day && cell.profit !== 0 ? `${cell.day}: ${cell.profit >= 0 ? '+' : ''}${Math.round(cell.profit).toLocaleString('fr-FR')} DZD` : undefined} className={`flex aspect-square flex-col items-center justify-center rounded-md text-xs font-bold ${cell.day ? profitCellClass(cell.profit, maxProfit) : 'bg-transparent'}`}>
                        {cell.day && (<>
                            <span>{cell.day}</span>
                            {cell.profit !== 0 && (<span dir="ltr" className="text-xs font-semibold leading-none opacity-80">
                                {cell.profit > 0 ? '+' : ''}
                                {Math.abs(cell.profit) >= 1000 ? `${(Math.abs(cell.profit) / 1000).toFixed(0)}k` : Math.round(Math.abs(cell.profit))}
                              </span>)}
                          </>)}
                      </div>))}
                  </div>
                  <div className="mt-3 flex items-center justify-end gap-2">
                    <span className="text-xs text-neutral-500">{t('portfolio.legendLess')}</span>
                    {['bg-neutral-100', 'bg-financial-profit/20', 'bg-financial-profit/45', 'bg-financial-profit/70', 'bg-financial-profit'].map((cls) => <div key={cls} className={`h-3 w-3 rounded-sm ${cls}`}/>)}
                    <span className="text-xs text-neutral-500">{t('portfolio.legendMore')}</span>
                    <div className="ms-1 h-3 w-3 rounded-sm bg-financial-loss/25"/>
                    <span className="text-xs text-neutral-500">{t('portfolio.legendLoss')}</span>
                  </div>
                </div>
              </div>);
          })()}
          <dl className="grid grid-cols-2 gap-2">
            <div className="min-w-0 rounded-button bg-surface-muted px-3 py-2">
              <dt className="text-xs font-semibold text-neutral-500">{t('portfolio.bestDay')}</dt>
              <dd className="mt-1"><DayProfitValue entry={bestHeatmapDay}/></dd>
            </div>
            <div className="min-w-0 rounded-button bg-surface-muted px-3 py-2">
              <dt className="text-xs font-semibold text-neutral-500">{t('portfolio.worstDay')}</dt>
              <dd className="mt-1"><DayProfitValue entry={worstHeatmapDay}/></dd>
            </div>
          </dl>
        </SectionCard>

        {priceHistory.current && (<SectionCard title={t('portfolio.salesPriceUsdt')} actions={priceHistory.prev ? <span className="pe-2 text-xs font-semibold text-neutral-500">{vsPrevMonth}</span> : undefined}>
            <div className="grid grid-cols-3 gap-2">
              <div className="min-w-0 rounded-button bg-surface-muted p-3">
                <p className="mb-1 text-xs font-semibold text-neutral-500">{t('portfolio.avgSalesPrice')}</p>
                <p dir="ltr" className="text-lg font-extrabold tabular-nums text-neutral-900">{priceHistory.current.avgSell.toFixed(2)}</p>
                <p className="text-xs text-neutral-500">DZD/USDT</p>
                {priceHistory.prev && <p className="mt-0.5 text-xs"><Change change={pctChange(priceHistory.current.avgSell, priceHistory.prev.avgSell)}/></p>}
              </div>
              <div className="min-w-0 rounded-button bg-surface-muted p-3">
                <p className="mb-1 text-xs font-semibold text-neutral-500">{t('portfolio.avgMargin')}</p>
                <p dir="ltr" className={`text-lg font-extrabold tabular-nums ${priceHistory.current.avgMargin >= 0 ? 'text-financial-profit' : 'text-financial-loss'}`}>
                  {priceHistory.current.avgMargin >= 0 ? '+' : ''}{priceHistory.current.avgMargin.toFixed(2)}
                </p>
                <p className="text-xs text-neutral-500">DZD/USDT</p>
                {priceHistory.prev && <p className="mt-0.5 text-xs"><Change change={pctChange(priceHistory.current.avgMargin, priceHistory.prev.avgMargin)}/></p>}
              </div>
              <div className="min-w-0 rounded-button bg-surface-muted p-3">
                <p className="mb-1 text-xs font-semibold text-neutral-500">{t('portfolio.marginPercent')}</p>
                <p dir="ltr" className={`text-lg font-extrabold tabular-nums ${priceHistory.current.avgMargin >= 0 ? 'text-financial-profit' : 'text-financial-loss'}`}>
                  {priceHistory.current.avgSell > 0
                    ? `${priceHistory.current.avgMargin >= 0 ? '+' : ''}${((priceHistory.current.avgMargin / priceHistory.current.avgSell) * 100).toFixed(2)}%`
                    : '—'}
                </p>
                <p className="text-xs text-neutral-500">{t('portfolio.marginOnPrice')}</p>
              </div>
            </div>

            {priceHistory.trend.some((item) => item.data !== null) && (<div className="mt-4">
                <p className="mb-2 text-xs font-semibold text-neutral-500">{t('portfolio.marginTrend')}</p>
                <div className="space-y-1">
                  {priceHistory.trend.map((item, i) => {
                    const isActive = item.monthIdx === month && item.year === year;
                    if (!item.data) return (<div key={i} className="flex items-center gap-2 px-1 py-0.5">
                        <span className={`w-12 shrink-0 truncate text-xs font-semibold ${isActive ? 'text-primary' : 'text-neutral-400'}`}>{shortMonth(item.monthIdx)}</span>
                        <div className="h-2 flex-1 rounded-full bg-neutral-100"/>
                        <div className="w-20 shrink-0 text-end text-xs text-neutral-400">—</div>
                      </div>);
                    const maxMargin = Math.max(...priceHistory.trend.filter((entry) => entry.data).map((entry) => Math.abs(entry.data!.avgMargin)), 1);
                    const barPct = Math.max(4, (Math.abs(item.data.avgMargin) / maxMargin) * 100);
                    return (<div key={i} className={`flex items-center gap-2 rounded-lg px-1 py-0.5 ${isActive ? 'bg-primary/5 ring-1 ring-primary/20' : ''}`}>
                        <span className={`w-12 shrink-0 truncate text-xs font-semibold ${isActive ? 'text-primary' : 'text-neutral-500'}`}>{shortMonth(item.monthIdx)}</span>
                        <div className="h-2 flex-1 rounded-full bg-neutral-100">
                          <div className={`h-2 rounded-full ${item.data.avgMargin >= 0 ? 'bg-financial-profit' : 'bg-financial-loss'}`} style={{ width: `${barPct}%` }}/>
                        </div>
                        <div className="w-20 shrink-0 text-end">
                          <span dir="ltr" className={`text-xs font-semibold tabular-nums ${item.data.avgMargin >= 0 ? 'text-financial-profit' : 'text-financial-loss'}`}>
                            {item.data.avgMargin >= 0 ? '+' : ''}{item.data.avgMargin.toFixed(2)} DZD
                          </span>
                        </div>
                      </div>);
                  })}
                </div>
                <p className="mt-2 text-end text-xs text-neutral-500">{t('portfolio.marginFormula')}</p>
              </div>)}
          </SectionCard>)}
      </>);

    const maxYearProfit = Math.max(...annualStats.byMonth.filter((v) => v > 0), 1);
    const yearTab = (<>
        <div className="grid grid-cols-2 gap-2">
          <StatTile label={t('portfolio.salesProfitYtd') as string} value={annualStats.ytdProfit} semantic="auto" hint={`${shortMonth(0)} → ${shortMonth(month)}`}/>
          <StatTile label={`${t('portfolio.bestMonth')} ${year}`} value={annualStats.bestMonthProfit} semantic="profit" display={annualStats.bestMonth >= 0 ? undefined : <span className="text-sm text-neutral-500">—</span>} hint={annualStats.bestMonth >= 0 ? shortMonth(annualStats.bestMonth) : '—'}/>
        </div>
        <SectionCard title={String(t('portfolio.yearSummary')).replace('{year}', String(year))}>
          <p className="mb-2 text-xs font-semibold text-neutral-500">{t('portfolio.monthlySalesProfit')}</p>
          <div className="space-y-1">
            {annualStats.byMonth.map((profit, m) => {
              const isActive = m === month;
              const barPct = profit > 0 ? Math.max(4, (profit / maxYearProfit) * 100) : 0;
              return (<div key={m} className={`flex items-center gap-2 rounded-lg px-2 py-1 ${isActive ? 'bg-primary/5 ring-1 ring-primary/20' : ''}`}>
                  <span className={`w-12 shrink-0 truncate text-xs font-semibold ${isActive ? 'text-primary' : 'text-neutral-500'}`}>{shortMonth(m)}</span>
                  <div className="h-2 flex-1 rounded-full bg-neutral-100">
                    {profit !== 0 && <div className={`h-2 rounded-full ${profit > 0 ? 'bg-financial-profit' : 'bg-financial-loss'}`} style={{ width: `${profit > 0 ? barPct : Math.min(barPct, 30)}%` }}/>}
                  </div>
                  <div className="w-24 shrink-0 text-end">
                    {profit !== 0
                      ? <CurrencyAmount value={profit} currency="DZD" semantic="auto" size="sm" decimals={0} showSign/>
                      : <span className="text-xs text-neutral-400">—</span>}
                  </div>
                </div>);
            })}
          </div>
        </SectionCard>
      </>);

    const allTimeTab = allTimeStats.totalSells === 0 ? (<EmptyState icon={<TrendingUpIcon className="h-5 w-5"/>} title={t('portfolio.noSalesYet') as string} className="rounded-card border border-border bg-surface"/>) : (<>
        <div className="grid grid-cols-2 gap-2">
          <StatTile label={t('portfolio.totalSalesProfit') as string} value={allTimeStats.totalProfit} semantic="auto"/>
          <StatTile label={t('portfolio.winRate') as string} value={allTimeStats.winRate ?? 0} display={<span className={`text-lg font-extrabold tabular-nums ${winRateClass(allTimeStats.winRate)}`}>{allTimeStats.winRate !== null ? `${Math.round(allTimeStats.winRate)}%` : '—'}</span>} hint={salesCount(allTimeStats.totalSells)}/>
          <StatTile label={t('portfolio.bestSale') as string} value={allTimeStats.bestSellProfit} semantic="profit" hint={t('portfolio.allTimeRecord') as string}/>
          <StatTile label={t('portfolio.bestMonth') as string} value={allTimeStats.bestMonthProfit} semantic="profit" display={allTimeStats.bestMonthKey ? undefined : <span className="text-sm text-neutral-500">—</span>} hint={allTimeStats.bestMonthKey || undefined}/>
        </div>
        {(allTimeStats.usdtTotal > 0 || allTimeStats.eurTotal > 0) && (<div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-card border border-border bg-surface px-4 py-3">
            <span className="text-xs font-semibold text-neutral-500">{t('portfolio.totalVolume')}</span>
            <span className="flex flex-wrap items-center gap-3 text-sm font-semibold text-neutral-800">
              {allTimeStats.usdtTotal > 0 && <span dir="ltr">{allTimeStats.usdtTotal.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} USDT</span>}
              {allTimeStats.eurTotal > 0 && <span dir="ltr">{allTimeStats.eurTotal.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} EUR</span>}
            </span>
          </div>)}
        {(allTimeClientRanking.byProfit.length > 0 || allTimeClientRanking.byVolume.length > 0) && (<SectionCard title={t('portfolio.topClients')}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {allTimeClientRanking.byProfit.length > 0 && (() => {
                const maxP = Math.max(...allTimeClientRanking.byProfit.map((r) => r.realizedProfit), 1);
                return (<div>
                    <p className="mb-2 text-xs font-semibold text-neutral-500">{t('portfolio.realizedProfit')}</p>
                    <div className="space-y-1.5">
                      {allTimeClientRanking.byProfit.map((row, i) => (<Fragment key={row.clientId}>
                          <RankBar rank={i + 1} name={row.clientName} ratio={Math.abs(row.realizedProfit) / maxP} barClass="bg-financial-profit/60">
                            <CurrencyAmount value={row.realizedProfit} currency="DZD" semantic="auto" size="sm" decimals={0} showSign/>
                          </RankBar>
                        </Fragment>))}
                    </div>
                  </div>);
              })()}
              {allTimeClientRanking.byVolume.length > 0 && (() => {
                const maxVol = Math.max(...allTimeClientRanking.byVolume.map((r) => r.sellVolumeUsdt), 1);
                return (<div>
                    <p className="mb-2 text-xs font-semibold text-neutral-500">{t('portfolio.bySoldVolume')}</p>
                    <div className="space-y-1.5">
                      {allTimeClientRanking.byVolume.map((row, i) => (<Fragment key={row.clientId}>
                          <RankBar rank={i + 1} name={row.clientName} ratio={row.sellVolumeUsdt / maxVol} barClass="bg-primary/50">
                            <span dir="ltr" className="w-14 shrink-0 text-end text-xs font-semibold tabular-nums text-neutral-600">
                              {row.sellVolumeUsdt.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} U
                            </span>
                          </RankBar>
                        </Fragment>))}
                    </div>
                  </div>);
              })()}
            </div>
          </SectionCard>)}
      </>);

    const { topTradedClient, topProfitableClient } = monthlyClientRanking;
    const clientsTab = (<>
        <div className="grid grid-cols-2 gap-2">
          <StatTile label={t('portfolio.topTradedClient') as string} value={topTradedClient?.sellVolumeUsdt ?? 0} display={topTradedClient ? (<>
                <span className="block truncate text-sm font-bold text-neutral-900">{topTradedClient.clientName}</span>
                <CurrencyAmount value={topTradedClient.sellVolumeUsdt} currency="USDT" semantic="plain" size="sm" decimals={0}/>
              </>) : <span className="text-sm text-neutral-500">—</span>} hint={topTradedClient ? salesCount(topTradedClient.sellCount) : undefined}/>
          <StatTile label={t('portfolio.topProfitableClient') as string} value={topProfitableClient?.realizedProfit ?? 0} display={topProfitableClient ? (<>
                <span className="block truncate text-sm font-bold text-neutral-900">{topProfitableClient.clientName}</span>
                <CurrencyAmount value={topProfitableClient.realizedProfit} currency="DZD" semantic="auto" showSign size="sm" decimals={0}/>
              </>) : <span className="text-sm text-neutral-500">—</span>} hint={topProfitableClient ? salesCount(topProfitableClient.sellCount) : undefined}/>
        </div>
        {topProfitableRows.length > 0 ? (<SectionCard title={t('portfolio.topFiveProfit')} flush>
            {topProfitableRows.map((row, index) => (<Fragment key={row.clientId}>
                <ListRow icon={<span className="text-sm font-bold">{index + 1}</span>} tone="neutral" title={row.clientName} subtitle={(<>
                    {t('portfolio.sellVolumeUsdt')} · <CurrencyAmount value={row.sellVolumeUsdt} currency="USDT" semantic="plain" size="sm" decimals={0}/>
                  </>)} trailing={<CurrencyAmount value={row.realizedProfit} currency="DZD" semantic="auto" showSign size="md" decimals={0}/>}/>
              </Fragment>))}
          </SectionCard>) : (<EmptyState icon={<UsersIcon className="h-5 w-5"/>} title={t('portfolio.noClientMonthlyData') as string} subtitle={t('portfolio.emptyPeriod') as string} className="rounded-card border border-border bg-surface"/>)}
      </>);

    return (<div className="anim-page-in flex flex-col gap-3">
      {headerActionsSlot && createPortal(<button type="button" onClick={() => setIsExportOpen(true)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-neutral-700 transition-colors hover:bg-neutral-100 active:scale-95" title={exportLabel} aria-label={exportLabel}>
          <DownloadCloudIcon className="h-[22px] w-[22px]"/>
        </button>, headerActionsSlot)}

      <HeroCard top={picker} label={`${t('portfolio.realizedProfit')} · ${selectedMonthLabel}`} value={calculatedStats.realizedProfit} semantic="auto" showSign note={heroNote} footer={volumes.length > 0 ? <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-neutral-500">{volumes}</p> : undefined}/>

      {calculatedStats.sellCount > 0 && (<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatTile label={t('portfolio.winRate') as string} value={calculatedStats.winRate ?? 0} display={<span className={`text-lg font-extrabold tabular-nums ${winRateClass(calculatedStats.winRate)}`}>{calculatedStats.winRate !== null ? `${Math.round(calculatedStats.winRate)}%` : '—'}</span>} hint={changeHint(pctChange(calculatedStats.winRate, prevMonthStats.winRate))}/>
          <StatTile label={t('portfolio.avgProfitPerSale') as string} value={calculatedStats.avgProfitPerSell ?? 0} semantic="auto" display={calculatedStats.avgProfitPerSell === null ? <span className="text-neutral-500">—</span> : undefined} hint={changeHint(pctChange(calculatedStats.avgProfitPerSell, prevMonthStats.avgProfitPerSell))}/>
          <StatTile label={t('portfolio.bestSale') as string} value={calculatedStats.bestSellProfit} semantic="profit" display={calculatedStats.bestSellProfit > 0 ? undefined : <span className="text-neutral-500">—</span>} hint={t('portfolio.thisMonthShort') as string}/>
          <StatTile label={t('portfolio.winningDays') as string} value={winningDays} display={<span className="text-lg font-extrabold tabular-nums text-neutral-900">{winningDays}</span>}/>
        </div>)}

      <Tabs tabs={tabs} activeTab={activeTab} onChange={(next) => setActiveTab(next as AnalyticsTab)} variant="pills"/>

      {activeTab === 'month' && monthTab}
      {activeTab === 'year' && yearTab}
      {activeTab === 'alltime' && allTimeTab}
      {activeTab === 'clients' && clientsTab}

      <AnalyticsExportSheet isOpen={isExportOpen} onClose={() => setIsExportOpen(false)} monthLabel={selectedMonthLabel} year={year} realizedProfit={calculatedStats.realizedProfit} monthlyHasData={monthlyHasData} onExportMonthly={props.handleExportUsdtReport} reportClient={props.reportClient} reportMonth={props.reportMonth} reportYear={props.reportYear} reportMonths={props.reportMonths} reportYears={props.reportYears} clientsDzd={props.clientsDzd} getClientFullName={props.getClientFullName} onExportClient={props.handleExportClientReport}/>
    </div>);
}
