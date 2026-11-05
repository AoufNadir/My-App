import { lazy, Suspense, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconButton } from '../components/ui/IconButton';
import { Select } from '../components/ui/Select';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { ReportButton } from '../components/reports/ReportButton';
import { ChevronLeftIcon } from '../components/icons/ChevronLeftIcon';
import { ChevronRightIcon } from '../components/icons/ChevronRightIcon';
import { useLanguage } from '../contexts/LanguageContext';
import { useHeaderActionsSlot } from '../components/main/headerActionsSlot';
import { AnalyticsExportSheet } from '../components/analytics/AnalyticsExportSheet';
import { AnalyticsOverview } from '../components/analytics/AnalyticsOverview';
import { AnalyticsPageProps } from '../components/analytics/analyticsTypes';
import { dayKey, monthPeriod } from '../utils/clientActivityReport';
import { analyticsWindow, computePeriodStats, hasActivity, profitSeries, type AnalyticsPeriodKind } from '../utils/analyticsPeriod';
import { computePamLedger } from '../utils/pamLedger';

// The client report (the same window as on the client page), loaded on first use.
const ClientActivityReportDialog = lazy(() => import('../components/clients/ClientActivityReportDialog').then((module) => ({ default: module.ClientActivityReportDialog })));

/**
 * Analyse (V10-1): one page for a month, a year or everything. The choice of period is the only thing that
 * changes: the blocks below are the same (profit, why it moved, volumes and margin, calendar, clients).
 */
export function AnalyticsPage({ initialKind = 'month', ...props }: AnalyticsPageProps & { initialKind?: AnalyticsPeriodKind }) {
    const { t } = useLanguage();
    const [kind, setKind] = useState<AnalyticsPeriodKind>(initialKind);
    const [isExportOpen, setIsExportOpen] = useState(false);
    const [clientReport, setClientReport] = useState<{ clientId: string; start: string; end: string } | null>(null);
    const headerActionsSlot = useHeaderActionsSlot();
    const month = props.usdtReportMonth;
    const year = props.usdtReportYear;
    const monthOptions = props.reportMonths(year);
    const selectedMonthLabel = monthOptions[month] || `${month + 1}`;
    const ledger = useMemo(() => computePamLedger(props.transactions), [props.transactions]);

    // The « Exporter » window is about the month chosen, whatever the period shown.
    const monthStats = useMemo(() => computePeriodStats(props.transactions, ledger, analyticsWindow('month', year, month, Date.now()).current), [props.transactions, ledger, year, month]);
    const monthlyHasData = hasActivity(monthStats) || profitSeries('month', year, month, Date.now(), props.transactions, ledger).activeCount > 0;

    // The arrows walk the same months and years as the two lists.
    const yearIndex = props.reportYears.indexOf(year);
    const prevMonth = month > 0 ? { month: month - 1, year } : yearIndex > 0 ? { month: 11, year: props.reportYears[yearIndex - 1] } : null;
    const nextMonth = month < monthOptions.length - 1 ? { month: month + 1, year } : yearIndex >= 0 && yearIndex < props.reportYears.length - 1 ? { month: 0, year: props.reportYears[yearIndex + 1] } : null;
    const prevYear = yearIndex > 0 ? { month, year: props.reportYears[yearIndex - 1] } : null;
    const nextYear = yearIndex >= 0 && yearIndex < props.reportYears.length - 1 ? { month, year: props.reportYears[yearIndex + 1] } : null;
    const [prevTarget, nextTarget] = kind === 'year' ? [prevYear, nextYear] : [prevMonth, nextMonth];
    const goTo = (target: { month: number; year: number } | null) => {
        if (!target) return;
        if (target.year !== year) props.setUsdtReportYear(target.year);
        props.setUsdtReportMonth(target.month);
    };
    const picker = kind === 'all' ? null : (<div className="mt-3 flex items-center gap-1">
        <IconButton label={t(kind === 'year' ? 'portfolio.year' : 'portfolio.prevMonth') as string} variant="ghost" onClick={() => goTo(prevTarget)} disabled={!prevTarget}>
          <ChevronLeftIcon className="rtl:-scale-x-100"/>
        </IconButton>
        {kind === 'month' && (<div className="min-w-0 flex-1">
            <Select aria-label={t('portfolio.month') as string} value={month} onChange={(event) => props.setUsdtReportMonth(Number(event.target.value))} className="font-semibold">
              {monthOptions.map((monthName, index) => <option key={monthName} value={index}>{monthName}</option>)}
            </Select>
          </div>)}
        <div className={kind === 'month' ? 'w-[5.5rem] shrink-0' : 'min-w-0 flex-1'}>
          <Select aria-label={t('portfolio.year') as string} value={year} onChange={(event) => props.setUsdtReportYear(Number(event.target.value))} className="font-semibold">
            {props.reportYears.map((option) => <option key={option} value={option}>{option}</option>)}
          </Select>
        </div>
        <IconButton label={t(kind === 'year' ? 'portfolio.year' : 'portfolio.nextMonth') as string} variant="ghost" onClick={() => goTo(nextTarget)} disabled={!nextTarget}>
          <ChevronRightIcon className="rtl:-scale-x-100"/>
        </IconButton>
        <div className="ms-auto hidden shrink-0 sm:block">
          <ReportButton onClick={() => setIsExportOpen(true)}/>
        </div>
      </div>);

    // The client chosen in « Exporter » opens on the month chosen there; its dates can then be changed.
    const openClientReport = (clientId: string, reportMonth: number, reportYear: number) => {
        const chosen = monthPeriod(reportYear, reportMonth);
        setClientReport({ clientId, start: dayKey(chosen.from), end: dayKey(Math.min(chosen.to, Date.now())) });
    };
    const reportedClient = clientReport ? props.clientsDzd.find((client) => client.id === clientReport.clientId) : undefined;
    return (<div className="anim-page-in flex flex-col gap-3">
      {headerActionsSlot && createPortal(<ReportButton variant="header" onClick={() => setIsExportOpen(true)}/>, headerActionsSlot)}

      <section className="rounded-card border border-border bg-surface p-3">
        <SegmentedControl<AnalyticsPeriodKind> size="md" ariaLabel={t('portfolio.tabPeriod') as string} value={kind} onChange={setKind} options={[
            { id: 'month', label: t('portfolio.month') as string },
            { id: 'year', label: t('portfolio.year') as string },
            { id: 'all', label: t('portfolio.anSegAll') as string },
        ]}/>
        {picker}
      </section>

      <AnalyticsOverview transactions={props.transactions} ledger={ledger} clientTransactionsDzd={props.clientTransactionsDzd} clientsDzd={props.clientsDzd} getClientFullName={props.getClientFullName} kind={kind} year={year} month={month} monthNames={monthOptions}/>

      <AnalyticsExportSheet isOpen={isExportOpen} onClose={() => setIsExportOpen(false)} monthLabel={selectedMonthLabel} year={year} realizedProfit={monthStats.profit} monthlyHasData={monthlyHasData} onExportMonthly={props.handleExportUsdtReport} reportClient={props.reportClient} reportMonth={props.reportMonth} reportYear={props.reportYear} reportMonths={props.reportMonths} reportYears={props.reportYears} clientsDzd={props.clientsDzd} getClientFullName={props.getClientFullName} onExportClient={openClientReport}/>
      {reportedClient && clientReport && (<Suspense fallback={null}>
          <ClientActivityReportDialog onClose={() => setClientReport(null)} clientId={reportedClient.id} clientName={props.getClientFullName(reportedClient)} clientRows={props.reportClientRows ?? props.clientTransactionsDzd} transactions={props.transactions} initialRange={{ start: clientReport.start, end: clientReport.end }}/>
        </Suspense>)}
    </div>);
}
