import { getTransactionTagLabel } from '../../../utils/transactionTerminology';
import type { TransactionListReport } from '../../../utils/listReports';
import { COMMON_REPORT_WORDS, TRANSACTION_LIST_WORDS, reportTranslator } from '../documentWords';
import { formatDate, formatLoggedPrice, formatLoggedQuantity, formatWholeDzd } from '../reportFormat';
import { REPORT_CELL, ReportCard, ReportCardGrid, ReportCardValue, ReportFooter, ReportHeader, ReportIdentity, ReportSection, ReportSheet, ReportTable, num, type ReportSheetLang } from '../ReportSheet';

export type TransactionListSheetProps = {
    report: TransactionListReport;
    lang: ReportSheetLang;
    variant: 'screen' | 'print';
};

/**
 * The operations log on the shared report frame (the old « Journal des opérations » print page).
 * Seven columns instead of eleven so it reads on a phone: the time under the date, the category
 * under the type, the currency under the quantity and the tags under the notes.
 */
export function TransactionListSheet({ report, lang, variant }: TransactionListSheetProps) {
    const w = TRANSACTION_LIST_WORDS[lang];
    const c = COMMON_REPORT_WORDS[lang];
    const t = reportTranslator(lang);
    const { th, td, tdNum } = REPORT_CELL;

    return (<ReportSheet lang={lang} variant={variant}>
      <ReportHeader tagline={c.brandTagline} title={w.title} referenceLabel={c.reference} reference={report.reference} issuedLabel={c.issued} issued={formatDate(report.issuedAt)}/>

      <ReportIdentity whoLabel={w.situationAt} who={formatDate(report.issuedAt)}/>

      <ReportSection title={w.summaryTitle}>
        <ReportCardGrid>
          <ReportCard dot="bg-primary" title={w.totalOperations}>
            <ReportCardValue>{num(String(report.operationCount))}</ReportCardValue>
          </ReportCard>
          <ReportCard dot="bg-financial-profit" title={w.portfolioBuys}>
            <ReportCardValue tone="text-financial-profit">{num(String(report.buyCount))}</ReportCardValue>
          </ReportCard>
          <ReportCard dot="bg-financial-loss" title={w.portfolioSales}>
            <ReportCardValue tone="text-financial-loss">{num(String(report.sellCount))}</ReportCardValue>
          </ReportCard>
        </ReportCardGrid>
      </ReportSection>

      <ReportSection title={w.listTitle(report.operationCount)}>
        {report.rows.length === 0 ? (<p className="text-xs text-neutral-500">{w.empty}</p>) : (<ReportTable wide>
            <thead>
              <tr>
                <th className={th}>{w.colDate}</th>
                <th className={th}>{w.colType}</th>
                <th className={`${th} text-end`}>{w.colQuantity}</th>
                <th className={`${th} text-end`}>{w.colPrice}</th>
                <th className={`${th} text-end`}>{w.colTotal}</th>
                <th className={th}>{w.colClient}</th>
                <th className={th}>{w.colNotes}</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row, index) => (<tr key={`${row.date}-${row.time}-${index}`} data-pdf-row="" data-pdf-break={index > 0 ? '' : undefined}>
                  <td className={td}>
                    <span className="block">{num(row.date)}</span>
                    <small className="block text-[11px] text-neutral-500">{num(row.time)}</small>
                  </td>
                  <td className={td}>
                    <b className="block"><bdi>{row.type}</bdi></b>
                    <small className="block text-[11px] text-neutral-500">{w.categories[row.category]}</small>
                  </td>
                  <td className={tdNum}>
                    {row.quantity !== null && (<span className="block">{num(formatLoggedQuantity(row.quantity))}</span>)}
                    <small className="block text-[11px] text-neutral-500">{row.currency}</small>
                  </td>
                  <td className={tdNum}>{row.price !== null ? num(formatLoggedPrice(row.price)) : '—'}</td>
                  <td className={`${tdNum} font-semibold`}>{num(formatWholeDzd(row.totalDzd))}</td>
                  <td className={`${td} text-neutral-600`}>{row.client ? <bdi>{row.client}</bdi> : '—'}</td>
                  <td className={`${td} text-neutral-600`}>
                    {row.notes ? <bdi className="block break-words text-[11px]">{row.notes}</bdi> : '—'}
                    {row.tags.length > 0 && (<span className="mt-0.5 flex flex-wrap gap-1">
                        {row.tags.map((tag) => (<small key={tag} className="rounded bg-surface-muted px-1.5 py-px text-[10.5px] text-neutral-600">{getTransactionTagLabel(tag, t)}</small>))}
                      </span>)}
                  </td>
                </tr>))}
            </tbody>
          </ReportTable>)}
      </ReportSection>

      <ReportFooter>{c.footer}</ReportFooter>
    </ReportSheet>);
}
