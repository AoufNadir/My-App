import type { ExpensesPeriodKey, ExpensesReport } from '../../../utils/expensesReport';
import { COMMON_REPORT_WORDS, EXPENSES_REPORT_WORDS, monthNames, reportTranslator, weekdayNames } from '../documentWords';
import { formatAmount, formatDate, formatOneDecimal } from '../reportFormat';
import { DOT, REPORT_CELL, ReportCard, ReportCardGrid, ReportCardValue, ReportFooter, ReportHeader, ReportIdentity, ReportLead, ReportSection, ReportSheet, ReportTable, num, type ReportSheetLang } from '../ReportSheet';

export type ExpensesReportSheetProps = {
    report: ExpensesReport;
    lang: ReportSheetLang;
    /** The day the report is made */
    issuedAt: number;
    variant: 'screen' | 'print';
};

/** « octobre 2026 », « lundi 5 octobre 2026 », « Semaine du 5 oct. », « 2026 »: as the old report wrote them in French. */
export function expensesPeriodLabel(periodKey: ExpensesPeriodKey, periodStart: number, lang: ReportSheetLang): string {
    const start = new Date(periodStart);
    if (periodKey === 'year')
        return String(start.getFullYear());
    if (lang === 'fr') {
        if (periodKey === 'day')
            return start.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        if (periodKey === 'week')
            return `${EXPENSES_REPORT_WORDS.fr.weekOf} ${start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;
        return start.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    }
    const month = monthNames('ar')[start.getMonth()];
    if (periodKey === 'day')
        return `${weekdayNames('ar')[start.getDay()]} ${start.getDate()} ${month} ${start.getFullYear()}`;
    if (periodKey === 'week')
        return `${EXPENSES_REPORT_WORDS.ar.weekOf} ${start.getDate()} ${month}`;
    return `${month} ${start.getFullYear()}`;
}

// A share of the profit above 80% is a warning, under 50% is comfortable (as on the old report).
const profitTone = (percent: number) => (percent > 80 ? 'text-financial-loss' : percent > 50 ? '' : 'text-financial-profit');
const profitDot = (percent: number) => (percent > 80 ? 'bg-financial-loss' : percent > 50 ? 'bg-neutral-500' : 'bg-financial-profit');

/** The personal-expenses report on the shared report frame. */
export function ExpensesReportSheet({ report, lang, issuedAt, variant }: ExpensesReportSheetProps) {
    const w = EXPENSES_REPORT_WORDS[lang];
    const c = COMMON_REPORT_WORDS[lang];
    const t = reportTranslator(lang);
    const { th, td, tdNum } = REPORT_CELL;
    const kindWord = { day: w.day, week: w.week, month: w.month, year: w.year }[report.periodKey];
    const sourceName = (source: string) => (source === 'Caisse' ? t('transactions.cash') : source === 'BaridiMob' ? t('transactions.baridi') : source || '-');
    const versus = report.versusPrevious;

    return (<ReportSheet lang={lang} variant={variant}>
      <ReportHeader tagline={c.brandTagline} title={w.title} referenceLabel={c.reference} reference={report.reference} issuedLabel={c.issued} issued={formatDate(issuedAt)}/>

      <ReportIdentity whoLabel={c.period} who={`${expensesPeriodLabel(report.periodKey, report.periodStart, lang)}${DOT}${kindWord}`}/>

      <ReportLead>{versus === null ? w.noPreviousPeriod : <>{num(`${versus > 0 ? '+' : versus < 0 ? '−' : ''}${formatOneDecimal(Math.abs(versus))}%`)} {w.versusPrevious}</>}</ReportLead>

      <ReportSection title={w.summaryTitle}>
        <ReportCardGrid>
          <ReportCard dot="bg-financial-loss" title={w.totalSpent}>
            <ReportCardValue tone="text-financial-loss">{num(`−${formatAmount(report.total)} DZD`)}</ReportCardValue>
          </ReportCard>
          <ReportCard dot="bg-primary" title={w.operationCount}>
            <ReportCardValue>{num(String(report.operationCount))}</ReportCardValue>
          </ReportCard>
          <ReportCard dot="bg-neutral-500" title={w.averagePerDay}>
            <ReportCardValue>{num(`${formatAmount(report.dailyAverage)} DZD`)}</ReportCardValue>
          </ReportCard>
          <ReportCard dot={profitDot(report.profitPercent)} title={w.profitConsumed}>
            <ReportCardValue tone={profitTone(report.profitPercent)}>{num(`${formatOneDecimal(report.profitPercent)}%`)}</ReportCardValue>
          </ReportCard>
          <ReportCard dot="bg-secondary" title={w.profitToWithdraw}>
            <ReportCardValue>{num(`${formatAmount(report.managerProfitAvailable)} DZD`)}</ReportCardValue>
          </ReportCard>
          <ReportCard dot={versus !== null && versus > 0 ? 'bg-financial-loss' : versus !== null && versus < 0 ? 'bg-financial-profit' : 'bg-neutral-500'} title={w.previousPeriod}>
            <ReportCardValue>{num(`${formatAmount(report.previousPeriodTotal)} DZD`)}</ReportCardValue>
          </ReportCard>
        </ReportCardGrid>
      </ReportSection>

      <ReportSection title={w.biggestTitle}>
        {report.biggest === null ? (<p className="text-xs text-neutral-500">{w.noExpense}</p>) : (<p data-pdf-break="" className="rounded-lg bg-surface-muted px-3 py-2 text-[13px]">
            {report.biggest.date && <>{num(report.biggest.date)}{DOT}</>}<bdi>{report.biggest.notes || w.biggestFallback}</bdi>{DOT}<b>{num(`${formatAmount(report.biggest.amount)} DZD`)}</b>
          </p>)}
      </ReportSection>

      <ReportSection title={w.detailTitle}>
        {report.rows.length === 0 ? (<p className="text-xs text-neutral-500">{w.emptyPeriod}</p>) : (<ReportTable wide>
            <thead>
              <tr>
                <th className={th}>{w.colDate}</th>
                <th className={th}>{w.colTime}</th>
                <th className={th}>{w.colSource}</th>
                <th className={th}>{w.colNote}</th>
                <th className={`${th} text-end`}>{w.colAmount}</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row, index) => (<tr key={row.id} data-pdf-row="" data-pdf-break={index > 0 ? '' : undefined}>
                  <td className={td}>{row.date ? num(row.date) : '-'}</td>
                  <td className={td}>{row.time ? num(row.time) : '-'}</td>
                  <td className={td}>{sourceName(row.source)}</td>
                  <td className={td}><bdi>{row.notes || w.confirmedExpense}</bdi>{row.settled && <small className="ms-1 rounded bg-surface-muted px-1.5 py-0.5 text-[10.5px] text-neutral-500">{w.settled}</small>}</td>
                  <td className={`${tdNum} font-semibold text-financial-loss`}>{num(`−${formatAmount(row.amount)} DZD`)}</td>
                </tr>))}
            </tbody>
          </ReportTable>)}
      </ReportSection>

      <section data-pdf-break="" className="flex items-end justify-between gap-4 border-t border-border pt-3">
        <div className="flex min-w-0 flex-col">
          <small className="text-[11px] text-neutral-500">{w.finalTotal}</small>
          <b className="text-[19px] text-financial-loss">{num(`−${formatAmount(report.total)} DZD`)}</b>
        </div>
        <div className="flex h-16 w-44 items-start justify-center rounded-lg border border-dashed border-border-strong pt-1 text-[11px] text-neutral-500">{w.signature}</div>
      </section>

      <ReportFooter>{c.footer}</ReportFooter>
    </ReportSheet>);
}
