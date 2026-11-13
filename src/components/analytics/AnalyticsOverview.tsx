import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { HeroCard, ListRow, SectionCard } from '../cards';
import { CurrencyAmount } from '../financial/CurrencyAmount';
import { EmptyState } from '../ui/EmptyState';
import { SegmentedControl } from '../ui/SegmentedControl';
import { CalendarIcon } from '../icons/CalendarIcon';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatNumber } from '../../pages/shared/pageFormat';
import type { ClientDzd, ClientTransactionDzd, Tx } from '../../types';
import { analyticsWindow, computePeriodStats, hasActivity, percentChange, profitEffects, profitSeries, rankClients, type AnalyticsPeriodKind, type PeriodStats, type ProfitSeries } from '../../utils/analyticsPeriod';
import type { PamLedgerResult } from '../../utils/pamLedger';

// The Analyse page's body (V10-1): the same five blocks whether the period is a month, a year or everything.
//   1. the profit of the period and how it moves against the one before
//   2. why it moved: the volume sold and the margin, in dinars
//   3. volumes and margin per currency, against the period before
//   4. the calendar of profits (days, months or years)
//   5. the best clients, and a « more details » fold with the rest

const MONTH_LABELS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

type Props = {
    transactions: ReadonlyArray<Tx>;
    /** The profit of every sale (computePamLedger), computed once by the page */
    ledger: PamLedgerResult;
    clientTransactionsDzd: ReadonlyArray<ClientTransactionDzd>;
    clientsDzd: ReadonlyArray<ClientDzd>;
    getClientFullName: (client: ClientDzd) => string;
    kind: AnalyticsPeriodKind;
    year: number;
    month: number;
    /** « Octobre » for the month chosen; the names of the months of that year */
    monthNames: ReadonlyArray<string>;
    /** For tests and screenshots; the time the page opened otherwise */
    now?: number;
};

const fill = (template: string, values: Record<string, string | number>) => Object.entries(values).reduce((text, [name, value]) => text.split(`{${name}}`).join(String(value)), template);
const count = (value: number) => formatNumber(value, { min: 0, max: 0 });
/** Kept in one piece, left to right, inside an Arabic sentence (« 538 → 337 DZD ») */
const ltr = (text: string) => `\u2066${text}\u2069`;
const pad2 = (n: number) => String(n).padStart(2, '0');
const dayMonth = (timestamp: number) => { const d = new Date(timestamp); return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`; };
const fullDate = (timestamp: number) => `${dayMonth(timestamp)}/${new Date(timestamp).getFullYear()}`;
/** « +24k », « −3k », « +850 » */
const compact = (profit: number) => `${profit > 0 ? '+' : profit < 0 ? '−' : ''}${Math.abs(profit) >= 1000 ? `${Math.round(Math.abs(profit) / 1000)}k` : Math.round(Math.abs(profit))}`;

function Change({ change, good }: { change: number | null; good?: boolean }) {
    if (change === null)
        return <span className="text-neutral-400">—</span>;
    const up = change >= 0;
    const positive = good ?? up;
    return <span dir="ltr" className={`whitespace-nowrap font-bold ${positive ? 'text-financial-profit' : 'text-financial-loss'}`}>{up ? '▲' : '▼'} {Math.abs(change).toFixed(change !== 0 && Math.abs(change) < 10 ? 1 : 0)} %</span>;
}

function cellClass(profit: number, maxProfit: number): string {
    if (profit === 0) return 'bg-neutral-100 text-neutral-500';
    if (profit < 0) return 'bg-financial-loss/20 text-financial-loss';
    const ratio = maxProfit > 0 ? profit / maxProfit : 0;
    if (ratio < 0.25) return 'bg-financial-profit/20 text-neutral-800';
    if (ratio < 0.55) return 'bg-financial-profit/45 text-neutral-900';
    if (ratio < 0.8) return 'bg-financial-profit/70 text-white';
    return 'bg-financial-profit text-white';
}

/** Days of the month (weeks as rows), months of the year, or years: the same cells, the one we are in ringed. */
function ProfitCalendar({ series, kind, year, month, shortMonth, weekdays }: { series: ProfitSeries; kind: AnalyticsPeriodKind; year: number; month: number; shortMonth: (index: number) => string; weekdays: ReadonlyArray<string> }) {
    const maxProfit = Math.max(...series.buckets.map((bucket) => bucket.profit).filter((value) => value > 0), 1);
    const cell = (key: string | number, label: string, bucket: { profit: number; isCurrent: boolean }, tall = false) => (<div key={key} title={bucket.profit ? `${label}: ${compact(bucket.profit)}` : undefined} className={`flex ${tall ? 'h-14' : 'h-11'} flex-col items-center justify-center rounded-lg text-xs font-semibold leading-tight ${cellClass(bucket.profit, maxProfit)} ${bucket.isCurrent ? 'ring-2 ring-primary' : ''}`}>
        <span>{label}</span>
        {bucket.profit !== 0 && <span dir="ltr" className="text-[11px] font-bold opacity-90">{compact(bucket.profit)}</span>}
      </div>);
    if (kind === 'month') {
        const offset = (new Date(year, month, 1).getDay() + 6) % 7;
        return (<div className="grid grid-cols-7 gap-1">
          {weekdays.map((day, index) => <div key={`w${index}`} className="py-0.5 text-center text-xs font-bold text-neutral-400">{day}</div>)}
          {Array.from({ length: offset }, (_, index) => <div key={`o${index}`}/>)}
          {series.buckets.map((bucket) => cell(bucket.index, String(bucket.index), bucket))}
        </div>);
    }
    if (kind === 'year')
        return <div className="grid grid-cols-4 gap-1">{series.buckets.map((bucket) => cell(bucket.index, shortMonth(bucket.index), bucket, true))}</div>;
    return <div className={`grid gap-1 ${series.buckets.length === 1 ? 'grid-cols-1' : series.buckets.length === 2 ? 'grid-cols-2' : 'grid-cols-4'}`}>{series.buckets.map((bucket) => cell(bucket.index, String(bucket.index), bucket, true))}</div>;
}

export function AnalyticsOverview({ transactions, ledger, clientTransactionsDzd, clientsDzd, getClientFullName, kind, year, month, monthNames, now: fixedNow }: Props) {
    const { t, lang } = useLanguage();
    const [now] = useState(() => fixedNow ?? Date.now());
    const [clientSort, setClientSort] = useState<'volume' | 'profit'>('volume');
    const firstTimestamp = useMemo(() => (transactions.length ? Math.min(...transactions.map((tx) => tx.timestamp)) : null), [transactions]);
    const window = useMemo(() => analyticsWindow(kind, year, month, now, firstTimestamp), [kind, year, month, now, firstTimestamp]);
    const stats = useMemo(() => computePeriodStats(transactions, ledger, window.current), [transactions, ledger, window]);
    const previous = useMemo<PeriodStats | null>(() => {
        if (!window.previous)
            return null;
        const result = computePeriodStats(transactions, ledger, window.previous);
        return hasActivity(result) ? result : null;
    }, [transactions, ledger, window]);
    const series = useMemo(() => profitSeries(kind, year, month, now, transactions, ledger), [kind, year, month, now, transactions, ledger]);
    const clientNameById = useMemo(() => new Map(clientsDzd.map((client) => [client.id, getClientFullName(client)] as const)), [clientsDzd, getClientFullName]);
    const ranking = useMemo(() => rankClients({ transactions, clientTransactions: clientTransactionsDzd, ledger, clientNameById, unknownName: t('portfolio.unknownClient') as string, range: window.current }), [transactions, clientTransactionsDzd, ledger, clientNameById, window, t]);

    const longMonths = t('common.months') as unknown as string[];
    const shortMonth = (index: number) => (lang === 'ar' ? longMonths[index] : MONTH_LABELS_FR[index]) ?? '';
    const weekdays = t('common.weekdaysNarrow') as unknown as string[];
    const label = (key: string, values: Record<string, string | number> = {}) => fill(t(`portfolio.${key}`) as string, values);
    const monthName = monthNames[month] ?? '';
    const periodName = (k: AnalyticsPeriodKind, y: number, m: number) => (k === 'month' ? `${(new Intl.DateTimeFormat(lang === 'ar' ? 'ar-DZ' : 'fr-FR', { month: 'long' }).format(new Date(y, m, 1)))} ${y}` : k === 'year' ? String(y) : label('anAllPeriod'));
    const currentName = kind === 'month' ? `${monthName} ${year}` : kind === 'year' ? String(year) : label('anAllPeriod');
    const previousName = kind === 'month' ? periodName('month', month === 0 ? year - 1 : year, (month + 11) % 12) : kind === 'year' ? String(year - 1) : '';

    const monthlyHasData = hasActivity(stats) || series.activeCount > 0;
    if (!monthlyHasData)
        return <EmptyState icon={<CalendarIcon className="h-5 w-5"/>} title={t('portfolio.noMonthlyActivity') as string} subtitle={t('portfolio.emptyPeriod') as string} className="rounded-card border border-border bg-surface"/>;

    const profitChange = previous ? percentChange(stats.profit, previous.profit) : null;
    const comparedWith = previous && window.previous ? (window.inProgress && kind !== 'all' ? label('anUntil', { period: previousName, date: dayMonth(window.previous.to) }) : previousName) : '';
    const heroNote = previous ? (<p className="flex flex-wrap items-center gap-x-2 text-xs">
        <Change change={profitChange}/>
        <span className="font-semibold text-neutral-500">{label('anVs', { period: comparedWith })}</span>
      </p>) : undefined;

    // 2. Why the profit moved
    const rawEffects = previous ? profitEffects(stats, previous) : null;
    const material = (value: number) => Math.abs(value) >= 0.5;
    // Whole dinars that add up to the headline: the last line takes the rounding.
    const effects = rawEffects ? (() => {
        const total = Math.round(rawEffects.total);
        const volume = Math.round(rawEffects.volume);
        const other = material(rawEffects.other) ? Math.round(rawEffects.other) : 0;
        return { total, volume, other, margin: total - volume - other };
    })() : null;
    const effectRow = (key: string, title: string, value: number) => (<Fragment key={key}><ListRow title={title} trailing={<CurrencyAmount value={value} currency="DZD" semantic="auto" size="md" decimals={0} showSign/>}/></Fragment>);
    const marginMoves = previous ? (['usdt', 'eur', 'rmb'] as const)
        .filter((key) => stats[key] && previous[key] && stats[key].marginPer100 !== null && previous[key].marginPer100 !== null)
        .map((key) => label('anMarginMove', { currency: key.toUpperCase(), range: ltr(`${count(previous[key].marginPer100!)} → ${count(stats[key].marginPer100!)} DZD`) })) : [];
    const summary = effects && material(effects.total) ? (<SectionCard flush title={label(effects.total > 0 ? 'anSummaryUp' : 'anSummaryDown', { amount: ltr(`${count(Math.abs(effects.total))} DZD`) })}>
        {material(effects.volume) && effectRow('volume', label('anEffectVolume'), effects.volume)}
        {material(effects.margin) && effectRow('margin', label('anEffectMargin'), effects.margin)}
        {material(effects.other) && effectRow('other', label('anEffectOther'), effects.other)}
        {marginMoves.length > 0 && <div className="border-t border-border px-4 py-3 text-[13px] leading-snug text-neutral-600">{marginMoves.map((line) => <p key={line} dir="auto">{line}</p>)}</div>}
      </SectionCard>) : null;

    // 3. Volumes and margin
    const rows: Array<{ key: string; title: string; now: string; before: string | null; change: number | null }> = [];
    const qty = (value: number) => count(value);
    const volumeRow = (key: 'usdt' | 'eur' | 'rmb') => {
        if (!stats[key] || (stats[key].sold === 0 && !(previous && previous[key]?.sold > 0)))
            return;
        const code = key.toUpperCase();
        rows.push({ key: `${key}-sold`, title: label('anSoldOf', { currency: code }), now: qty(stats[key].sold), before: previous ? qty(previous[key].sold) : null, change: previous ? percentChange(stats[key].sold, previous[key].sold) : null });
    };
    volumeRow('usdt');
    volumeRow('eur');
    volumeRow('rmb'); // V14-2: only when RMB was sold in either period
    for (const key of ['usdt', 'eur', 'rmb'] as const)
        if (stats[key] && stats[key].marginPer100 !== null)
            rows.push({ key: `${key}-margin`, title: label('anMarginOf', { currency: key.toUpperCase() }), now: count(stats[key].marginPer100!), before: previous && previous[key] && previous[key].marginPer100 !== null ? count(previous[key].marginPer100!) : null, change: previous ? percentChange(stats[key].marginPer100, previous[key].marginPer100) : null });
    const table = (<SectionCard title={label('anVolumesMargin')}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <thead><tr className="text-xs font-semibold text-neutral-500">
              <th className="pb-1.5 text-start font-semibold"/>
              <th className="pb-1.5 ps-3 text-end font-semibold">{kind === 'all' ? '' : kind === 'year' ? String(year) : (shortMonth(month))}</th>
              {previous && <th className="pb-1.5 ps-3 text-end font-semibold">{kind === 'year' ? String(year - 1) : shortMonth((month + 11) % 12)}</th>}
              {previous && <th className="pb-1.5 ps-3 text-end font-semibold">{label('anGap')}</th>}
            </tr></thead>
            <tbody>{rows.map((row) => (<tr key={row.key} className="border-t border-border">
                <td className="py-2 text-start text-neutral-700">{row.title}</td>
                <td className="py-2 ps-3 text-end font-bold text-neutral-900" dir="ltr">{row.now}</td>
                {previous && <td className="py-2 ps-3 text-end text-neutral-600" dir="ltr">{row.before ?? '—'}</td>}
                {previous && <td className="py-2 ps-3 text-end"><Change change={row.change}/></td>}
              </tr>))}</tbody>
          </table>
        </div>
        {previous && window.inProgress && kind !== 'all' && <p className="mt-2 text-xs text-neutral-500">{label('anPartial')}</p>}
      </SectionCard>);

    // 4. Calendar
    const currentLine = series.current && kind !== 'all' ? (kind === 'month' ? label('anToday', { date: dayMonth(now) }) : label('anThisMonth', { month: shortMonth(series.current.index) }))
        : kind === 'all' && series.current ? label('anThisYear', { year: series.current.index }) : null;
    const activeKey = kind === 'month' ? 'anActiveDays' : kind === 'year' ? 'anActiveMonths' : 'anActiveYears';
    const activeText = label(series.activeCount === 1 ? `${activeKey}One` : activeKey, { count: series.activeCount });
    const bucketName = (index: number) => (kind === 'month' ? `${pad2(index)}/${pad2(month + 1)}` : kind === 'year' ? shortMonth(index) : String(index));
    const calendar = (<SectionCard title={t('portfolio.profitHeatmap') as string} actions={<span className="pe-2 text-xs font-semibold text-neutral-500">{activeText}</span>}>
        {currentLine && series.current && (<p className="mb-3 flex items-baseline justify-between gap-3 text-sm"><span className="font-semibold text-neutral-600">{currentLine}</span><CurrencyAmount value={series.current.profit} currency="DZD" semantic="auto" size="md" decimals={0} showSign/></p>)}
        <ProfitCalendar series={series} kind={kind} year={year} month={month} shortMonth={shortMonth} weekdays={weekdays}/>
        <dl className="mt-3 grid grid-cols-2 gap-2">
          {series.best && (<div className="min-w-0 rounded-button bg-surface-muted px-3 py-2"><dt className="text-xs font-semibold text-neutral-500">{label('anBest', { label: bucketName(series.best.index) })}</dt><dd className="mt-1"><CurrencyAmount value={series.best.profit} currency="DZD" semantic="auto" size="sm" decimals={0} showSign/></dd></div>)}
          {series.worst && series.worst.index !== series.best?.index && (<div className="min-w-0 rounded-button bg-surface-muted px-3 py-2"><dt className="text-xs font-semibold text-neutral-500">{label('anWorst', { label: bucketName(series.worst.index) })}</dt><dd className="mt-1"><CurrencyAmount value={series.worst.profit} currency="DZD" semantic="auto" size="sm" decimals={0} showSign/></dd></div>)}
        </dl>
      </SectionCard>);

    // 5. Clients and the fold
    const clientRows = clientSort === 'volume' ? ranking.byVolume : ranking.byProfit;
    const clients = (<SectionCard title={t('portfolio.topClients') as string}>
        {ranking.byVolume.length === 0 && ranking.byProfit.length === 0
            ? <p className="text-sm text-neutral-500">{t('portfolio.noClientMonthlyData')}</p>
            : (<div className="flex flex-col gap-2">
                <SegmentedControl<'volume' | 'profit'> ariaLabel={t('portfolio.topClients') as string} value={clientSort} onChange={setClientSort} options={[{ id: 'volume', label: label('anByVolume') }, { id: 'profit', label: label('anByProfit') }]}/>
                <div>{clientRows.map((row, index) => (<Fragment key={row.clientId}><ListRow icon={<span className="text-sm font-bold">{index + 1}</span>} tone="neutral" title={row.clientName} trailing={clientSort === 'volume'
                    ? <span dir="ltr" className="text-sm font-bold tabular-nums text-neutral-900">{count(row.sellVolumeUsdt)} USDT</span>
                    : <CurrencyAmount value={row.realizedProfit} currency="DZD" semantic="auto" size="md" decimals={0} showSign/>}/></Fragment>))}</div>
                {ranking.topThreeShare !== null && ranking.byVolume.length >= 2 && <p className="text-xs leading-snug text-neutral-500">{label('anConcentration', { pct: Math.round(ranking.topThreeShare) })}</p>}
              </div>)}
      </SectionCard>);
    const detailRow = (title: string, value: ReactNode) => (<div key={title} className="flex items-baseline justify-between gap-3 border-t border-border py-2 first:border-t-0 text-sm"><span className="text-neutral-600">{title}</span><span className="font-bold tabular-nums text-neutral-900">{value}</span></div>);
    const details = (<details className="group rounded-card border border-border bg-surface">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-[15px] font-bold text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary [&::-webkit-details-marker]:hidden">
          {label('anDetails')}<span aria-hidden="true" className="text-neutral-400 transition-transform group-open:rotate-180">⌄</span>
        </summary>
        <div className="px-4 pb-3">
          {detailRow(label('anSalesCount'), stats.sellCount)}
          {detailRow(t('portfolio.winRate') as string, stats.winRate !== null ? `${Math.round(stats.winRate)} %` : '—')}
          {detailRow(t('portfolio.avgProfitPerSale') as string, stats.avgProfitPerSell !== null ? <CurrencyAmount value={stats.avgProfitPerSell} currency="DZD" semantic="auto" size="sm" decimals={0} showSign/> : '—')}
          {detailRow(t('portfolio.bestSale') as string, stats.bestSellProfit > 0 ? <CurrencyAmount value={stats.bestSellProfit} currency="DZD" semantic="profit" size="sm" decimals={0} showSign/> : '—')}
          {detailRow(`${t('portfolio.avgSalesPrice')} USDT`, stats.avgSellPriceUsdt !== null ? `${formatNumber(stats.avgSellPriceUsdt, { min: 2, max: 2 })} DZD` : '—')}
          {detailRow(`${label('anBought')} USDT`, count(stats.usdt.bought))}
          {detailRow(`${label('anBought')} EUR`, count(stats.eur.bought))}
          {(stats.rmb?.bought ?? 0) > 0 && detailRow(`${label('anBought')} RMB`, count(stats.rmb.bought))}
        </div>
      </details>);

    return (<>
      <HeroCard label={label('anProfitOf', { period: currentName })} value={stats.profit} semantic="auto" showSign note={heroNote}/>
      {summary}
      {table}
      {calendar}
      {clients}
      {details}
    </>);
}
