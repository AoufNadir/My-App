import type { ClientListReport } from '../../../utils/listReports';
import { CLIENT_LIST_WORDS, COMMON_REPORT_WORDS } from '../documentWords';
import { formatDate, formatWholeDzd } from '../reportFormat';
import { REPORT_CELL, ReportCard, ReportCardGrid, ReportCardValue, ReportFact, ReportFooter, ReportHeader, ReportIdentity, ReportSection, ReportSheet, ReportTable, num, type ReportSheetLang } from '../ReportSheet';

export type ClientListSheetProps = {
    report: ClientListReport;
    lang: ReportSheetLang;
    variant: 'screen' | 'print';
};

/** An e-mail address reads left to right and may break anywhere in a narrow column. */
const ltrBreakable = (text: string) => <bdi dir="ltr" className="break-all">{text}</bdi>;
/** A phone number or an id reads left to right and is never cut in two: the column takes the width it needs. */
const ltrWhole = (text: string) => <bdi dir="ltr" className="whitespace-nowrap">{text}</bdi>;

const SIDE_TONE = { debt: 'text-financial-loss', advance: 'text-financial-profit', zero: 'text-neutral-500' } as const;

/** The client list on the shared report frame (the old « Liste des clients » print page). */
export function ClientListSheet({ report, lang, variant }: ClientListSheetProps) {
    const w = CLIENT_LIST_WORDS[lang];
    const c = COMMON_REPORT_WORDS[lang];
    const { th, td, tdNum } = REPORT_CELL;
    const sideWord = { debt: w.debt, advance: w.advance, zero: w.zero };

    return (<ReportSheet lang={lang} variant={variant}>
      <ReportHeader tagline={c.brandTagline} title={w.title} referenceLabel={c.reference} reference={report.reference} issuedLabel={c.issued} issued={formatDate(report.issuedAt)}/>

      <ReportIdentity whoLabel={w.situationAt} who={formatDate(report.issuedAt)}/>

      <ReportSection title={w.summaryTitle}>
        <ReportCardGrid>
          <ReportCard dot="bg-financial-loss" title={w.toCollect}>
            <ReportCardValue tone="text-financial-loss">{num(`${formatWholeDzd(report.totalDebt)} DZD`)}</ReportCardValue>
            <small className="text-[11px] text-neutral-500">{w.clientsCount(report.debtCount)}</small>
          </ReportCard>
          <ReportCard dot="bg-financial-profit" title={w.inTheirFavour}>
            <ReportCardValue tone="text-financial-profit">{num(`${formatWholeDzd(report.totalAdvance)} DZD`)}</ReportCardValue>
            <small className="text-[11px] text-neutral-500">{w.clientsCount(report.advanceCount)}</small>
          </ReportCard>
        </ReportCardGrid>
        <div data-pdf-break="" className="grid grid-cols-1 gap-2.5">
          <ReportFact label={w.totalClients} value={num(String(report.clientCount))}/>
        </div>
      </ReportSection>

      <ReportSection title={w.listTitle(report.clientCount)}>
        {report.rows.length === 0 ? (<p className="text-xs text-neutral-500">{w.empty}</p>) : (<ReportTable wide>
            <thead>
              <tr>
                <th className={th}>#</th>
                <th className={th}>{w.colName}</th>
                <th className={th}>{w.colPhone}</th>
                <th className={th}>{w.colEmail}</th>
                <th className={th}>{w.colRedotpay}</th>
                <th className={`${th} text-end`}>{w.colBalance}</th>
                <th className={th}>{w.colStatus}</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row, index) => (<tr key={`${row.index}-${row.name}`} data-pdf-row="" data-pdf-break={index > 0 ? '' : undefined}>
                  <td className={`${td} text-neutral-500`}>{num(String(row.index))}</td>
                  <td className={`${td} font-semibold`}><bdi>{row.name}</bdi></td>
                  <td className={`${td} text-neutral-600`}>{row.phone ? ltrWhole(row.phone) : '—'}</td>
                  <td className={`${td} text-neutral-600`}>{row.email ? ltrBreakable(row.email) : '—'}</td>
                  <td className={`${td} text-neutral-600`}>{row.redotpay ? ltrWhole(row.redotpay) : '—'}</td>
                  <td className={`${tdNum} font-semibold ${SIDE_TONE[row.side]}`}>{num(`${row.balance !== 0 ? `${row.balance > 0 ? '+' : ''}${formatWholeDzd(row.balance)}` : '0'}`)}</td>
                  <td className={`${td} font-semibold ${SIDE_TONE[row.side]}`}>{sideWord[row.side]}</td>
                </tr>))}
            </tbody>
          </ReportTable>)}
      </ReportSection>

      <ReportFooter>{c.footer}</ReportFooter>
    </ReportSheet>);
}
