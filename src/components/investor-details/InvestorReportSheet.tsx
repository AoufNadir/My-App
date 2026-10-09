import { Fragment } from 'react';
import type { InvestorReport } from '../../utils/investorReport';
import { formatDate, formatPrice } from '../clients/clientActivityReportText';
import { DOT, ReportCard, ReportSection, ReportSheetFrame, num, reportTd, reportTdNum, reportTh, type ReportSheetLang, type ReportSheetVariant } from '../reports/ReportSheet';
import { INVESTOR_REPORT_WORDS } from './investorReportText';

export type InvestorReportSheetProps = {
    report: InvestorReport;
    lang: ReportSheetLang;
    investorName: string;
    reference: string;
    issuedAt: number;
    variant: ReportSheetVariant;
};

// Amounts keep two decimals, as in the report before V3-5.
const money = (value: number) => `${formatPrice(Math.abs(value))} DZD`;
const signedMoney = (value: number) => `${value > 0.005 ? '+' : value < -0.005 ? '−' : ''}${money(value)}`;
const signedPercent = (value: number) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${formatPrice(Math.abs(value))}%`;
const tone = (value: number) => (value > 0.005 ? 'text-financial-profit' : value < -0.005 ? 'text-financial-debt' : undefined);
const pad2 = (value: number) => String(value).padStart(2, '0');
const timeOf = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
};

/** The investor report on the shared sheet: situation at the end date, the period, its operations. */
export function InvestorReportSheet({ report, lang, investorName, reference, issuedAt, variant }: InvestorReportSheetProps) {
    const w = INVESTOR_REPORT_WORDS[lang];
    const issued = formatDate(issuedAt);
    const { isManager } = report;
    const movements = [
        { key: 'added', label: w.capitalAdded, value: report.capitalAdded, text: `${report.capitalAdded > 0 ? '+' : ''}${money(report.capitalAdded)}`, className: 'text-financial-profit' },
        { key: 'reinvested', label: isManager ? w.retained : w.reinvested, value: report.reinvested, text: `${report.reinvested > 0 ? '+' : ''}${money(report.reinvested)}`, className: 'text-financial-profit' },
        { key: 'out', label: isManager ? w.personalExpenses : w.profitOut, value: report.profitOut, text: `${report.profitOut > 0 ? '−' : ''}${money(report.profitOut)}`, className: 'text-financial-debt' },
        { key: 'net', label: w.netMovement, value: report.netCapitalMovement, text: signedMoney(report.netCapitalMovement), className: tone(report.netCapitalMovement) || 'text-neutral-900' },
    ];
    return (<ReportSheetFrame lang={lang} variant={variant} brandTagline={w.brandTagline} title={w.title} referenceLabel={w.reference} reference={reference} issuedLabel={w.issued} issued={issued}
        partyLabel={isManager ? w.manager : w.investor} partyName={investorName} periodCaption={w.period}
        period={w.periodText(report.startTs, report.endTs, (timestamp) => `⁦${formatDate(timestamp)}⁩`)} footer={w.footer}>
      <ReportSection title={w.situationTitle}>
        <div className="grid grid-cols-1 gap-2.5 @lg:grid-cols-2">
          <ReportCard label={w.capital} value={num(money(report.capital))} tone="primary"/>
          <ReportCard label={w.availableProfit} value={num(signedMoney(report.availableProfit))} tone={report.availableProfit < -0.005 ? 'danger' : 'success'} valueTone={tone(report.availableProfit)}/>
          <ReportCard label={w.estimatedValue} value={num(money(report.estimatedValue))} tone="secondary"/>
          <ReportCard label={w.share} value={num(`${formatPrice(report.sharePercent)}%`)} tone="neutral"/>
        </div>
        {report.notes && (<p className="rounded-lg bg-surface-muted px-3 py-2 text-xs text-neutral-700"><b>{w.notes}:</b> <bdi>{report.notes}</bdi></p>)}
      </ReportSection>

      <ReportSection title={w.performanceTitle}>
        <div className="grid grid-cols-1 gap-2.5 @lg:grid-cols-3">
          <ReportCard label={w.periodProfit} value={num(signedMoney(report.periodProfit))} tone={report.periodProfit < -0.005 ? 'danger' : 'success'} valueTone={tone(report.periodProfit)}/>
          <ReportCard label={w.yield} value={num(report.yieldPercent === null ? '—' : signedPercent(report.yieldPercent))} tone="neutral" valueTone={report.yieldPercent === null ? undefined : tone(report.yieldPercent)}/>
          <ReportCard label={w.movementCount} value={num(String(report.movementCount))} tone="neutral"/>
        </div>
        {report.movementCount === 0
            ? (<p className="text-xs text-neutral-500">{w.noMovement}</p>)
            : (<p className="rounded-lg bg-surface-muted px-3 py-2 text-xs text-neutral-700">
                {movements.map((item, index) => (<Fragment key={item.key}>{index > 0 && DOT}{item.label} <b className={item.className}>{num(item.text)}</b></Fragment>))}
              </p>)}
      </ReportSection>

      <ReportSection title={w.operationsTitle}>
        {report.rows.length === 0 ? (<p className="text-xs text-neutral-500">{w.noOperation}</p>) : (<div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[330px] border-collapse text-xs">
              <thead>
                <tr>
                  <th className={reportTh}>{w.colDate}</th>
                  <th className={reportTh}>{w.colType}</th>
                  <th className={`${reportTh} text-end`}>{w.colAmount}</th>
                  <th className={reportTh}>{w.colSource}</th>
                  <th className={reportTh}>{w.colNotes}</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row, index) => (<tr key={row.id} data-pdf-row="" data-pdf-break={index > 0 ? '' : undefined}>
                    <td className={reportTd}>{num(formatDate(row.timestamp))}<small className="block text-[10.5px] text-neutral-500">{num(timeOf(row.timestamp))}</small></td>
                    <td className={reportTd}>{w.kind[row.kind]}</td>
                    <td className={`${reportTdNum} font-semibold ${row.amount >= 0 ? 'text-financial-profit' : 'text-financial-debt'}`}>{num(`${row.amount >= 0 ? '+' : '−'}${money(row.amount)}`)}</td>
                    <td className={reportTd}>{row.source ? <bdi>{row.source}</bdi> : '—'}</td>
                    <td className={reportTd}>{row.notes ? <bdi>{row.notes}</bdi> : '—'}</td>
                  </tr>))}
              </tbody>
            </table>
          </div>)}
      </ReportSection>
    </ReportSheetFrame>);
}
