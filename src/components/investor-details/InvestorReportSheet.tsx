import type { ReactNode } from 'react';
import type { InvestorReport } from '../../utils/investorReport';
import { formatAmount, formatDate, formatTime } from '../reports/reportFormat';
import { DOT, REPORT_CELL, ReportCard, ReportCardGrid, ReportCardValue, ReportFact, ReportFooter, ReportHeader, ReportIdentity, ReportSection, ReportSheet, ReportTable, num, type ReportSheetLang } from '../reports/ReportSheet';
import { INVESTOR_REPORT_WORDS } from './investorReportText';

export type InvestorReportSheetProps = {
    report: InvestorReport;
    lang: ReportSheetLang;
    /** « print »: the A4 sheet captured for the PDF (794px wide); « screen »: the preview in the window */
    variant: 'screen' | 'print';
};

// As on the old printed report: under half a centime is neither a gain nor a loss.
const tone = (value: number) => (value > 0.005 ? 'text-financial-profit' : value < -0.005 ? 'text-financial-loss' : '');
const sign = (value: number) => (value > 0 ? '+' : value < 0 ? '−' : '');
const signedDzd = (value: number) => `${sign(value)}${formatAmount(Math.abs(value))} DZD`;
const plainDzd = (value: number) => `${value < 0 ? '−' : ''}${formatAmount(Math.abs(value))} DZD`;

/** The investor report on the shared report frame: his situation at the end date, the period, the operations. */
export function InvestorReportSheet({ report, lang, variant }: InvestorReportSheetProps) {
    const w = INVESTOR_REPORT_WORDS[lang];
    const { startTs, endTs, operations, isManager } = report;

    const periodText: ReactNode = startTs != null && endTs != null
        ? <>{w.from} {num(formatDate(startTs))} {w.to} {num(formatDate(endTs))}</>
        : startTs != null ? <>{w.since} {num(formatDate(startTs))}</>
            : endTs != null ? <>{w.until} {num(formatDate(endTs))}</>
                : w.allHistory;
    // Capital, profit and share are those of the end date; today when the period has no end or ends later.
    const situationDate = endTs != null && endTs < report.issuedAt ? endTs : report.issuedAt;

    const movementRows: Array<{ key: string; label: string; value: string; valueTone: string }> = [
        { key: 'deposits', label: w.deposits, value: `${report.deposits > 0 ? '+' : report.deposits < 0 ? '−' : ''}${formatAmount(Math.abs(report.deposits))} DZD`, valueTone: report.deposits > 0 ? 'text-financial-profit' : '' },
        { key: 'reinvested', label: isManager ? w.retained : w.reinvested, value: `${report.reinvested > 0 ? '+' : report.reinvested < 0 ? '−' : ''}${formatAmount(Math.abs(report.reinvested))} DZD`, valueTone: report.reinvested > 0 ? 'text-financial-profit' : '' },
        { key: 'profitOut', label: isManager ? w.personalExpenses : w.profitOut, value: `${report.profitOut > 0 ? '−' : ''}${formatAmount(Math.abs(report.profitOut))} DZD`, valueTone: report.profitOut > 0 ? 'text-financial-loss' : '' },
        { key: 'net', label: w.netMovement, value: signedDzd(report.netMovement), valueTone: tone(report.netMovement) },
    ];

    const { th, td, tdNum } = REPORT_CELL;

    return (<ReportSheet lang={lang} variant={variant}>
      <ReportHeader tagline={w.brandTagline} title={w.title} referenceLabel={w.reference} reference={report.reference} issuedLabel={w.issued} issued={formatDate(report.issuedAt)}/>

      <ReportIdentity whoLabel={isManager ? w.manager : w.investor} who={report.investorName} periodLabel={w.period} period={periodText}/>

      <ReportSection title={<>{w.situationAt} {num(formatDate(situationDate))}</>}>
        <ReportCardGrid>
          <ReportCard dot="bg-primary" title={w.capital}>
            <ReportCardValue>{num(plainDzd(report.capital))}</ReportCardValue>
          </ReportCard>
          <ReportCard dot="bg-financial-profit" title={w.availableProfit}>
            <ReportCardValue tone={tone(report.availableProfit)}>{num(signedDzd(report.availableProfit))}</ReportCardValue>
          </ReportCard>
          <ReportCard dot="bg-secondary" title={w.estimatedValue}>
            <ReportCardValue>{num(plainDzd(report.estimatedValue))}</ReportCardValue>
          </ReportCard>
          <ReportCard dot="bg-neutral-500" title={w.fundShare}>
            <ReportCardValue>{num(`${formatAmount(report.sharePercent)}%`)}</ReportCardValue>
          </ReportCard>
        </ReportCardGrid>
        {report.notes && (<p data-pdf-break="" className="rounded-lg bg-surface-muted px-3 py-2 text-xs text-neutral-700"><b>{w.notes}:</b> <bdi>{report.notes}</bdi></p>)}
      </ReportSection>

      <ReportSection title={w.performanceTitle}>
        <div data-pdf-break="" className="grid grid-cols-1 gap-2.5 @lg:grid-cols-3">
          <ReportFact label={w.periodProfit} value={num(signedDzd(report.periodProfit))} valueTone={tone(report.periodProfit)}/>
          <ReportFact label={w.periodYield} value={num(report.yieldPct === null ? '—' : `${sign(report.yieldPct)}${formatAmount(Math.abs(report.yieldPct))}%`)} valueTone={report.yieldPct === null ? '' : tone(report.yieldPct)}/>
          <ReportFact label={w.movementCount} value={num(String(operations.length))}/>
        </div>
        {operations.length === 0 ? (<p data-pdf-break="" className="text-xs text-neutral-500">{w.noMovement}</p>) : (<div data-pdf-break="" className="flex flex-col rounded-lg border border-border px-3 py-1.5 text-[12.5px] text-neutral-700">
            {movementRows.map((row) => (<div key={row.key} className="flex items-baseline justify-between gap-3 py-1">
                <span className="min-w-0">{row.label}</span>
                <span className={`shrink-0 font-semibold ${row.valueTone || 'text-neutral-900'}`}>{num(row.value)}</span>
              </div>))}
          </div>)}
      </ReportSection>

      <ReportSection title={w.operationsTitle}>
        {operations.length === 0 ? (<p className="text-xs text-neutral-500">{w.noOperation}</p>) : (<ReportTable>
            <thead>
              <tr>
                <th className={th}>{w.colDate}</th>
                <th className={th}>{w.colOperation}</th>
                <th className={`${th} text-end`}>{w.colAmount}</th>
              </tr>
            </thead>
            <tbody>
              {operations.map((operation, index) => {
                const detail = [operation.source ? w.source[operation.source] : '', operation.notes].filter(Boolean).join(DOT);
                return (<tr key={operation.id} data-pdf-row="" data-pdf-break={index > 0 ? '' : undefined}>
                    <td className={td}>{num(formatDate(operation.timestamp))}<small className="block text-[10.5px] text-neutral-500">{num(formatTime(operation.timestamp))}</small></td>
                    <td className={td}>{w.operation[operation.kind]}{detail && <small className="block text-[10.5px] text-neutral-500"><bdi>{detail}</bdi></small>}</td>
                    <td className={`${tdNum} font-semibold ${operation.positive ? 'text-financial-profit' : 'text-financial-loss'}`}>{num(`${operation.positive ? '+' : '−'}${formatAmount(operation.amount)}`)}</td>
                  </tr>);
            })}
            </tbody>
          </ReportTable>)}
      </ReportSection>

      <ReportFooter>{w.footer}</ReportFooter>
    </ReportSheet>);
}
