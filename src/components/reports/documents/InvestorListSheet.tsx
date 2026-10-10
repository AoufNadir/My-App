import { investorEntryDay, type InvestorListReport } from '../../../utils/listReports';
import { COMMON_REPORT_WORDS, INVESTOR_LIST_WORDS } from '../documentWords';
import { formatAmount, formatDate, formatWholeDzd } from '../reportFormat';
import { REPORT_CELL, ReportCard, ReportCardGrid, ReportCardValue, ReportFooter, ReportHeader, ReportIdentity, ReportSection, ReportSheet, ReportTable, num, type ReportSheetLang } from '../ReportSheet';

export type InvestorListSheetProps = {
    report: InvestorListReport;
    lang: ReportSheetLang;
    variant: 'screen' | 'print';
};

const signedWhole = (value: number) => `${value >= 0 ? '+' : '−'}${formatWholeDzd(Math.abs(value))} DZD`;

/** The investor list on the shared report frame (the old « Liste des investisseurs » print page). */
export function InvestorListSheet({ report, lang, variant }: InvestorListSheetProps) {
    const w = INVESTOR_LIST_WORDS[lang];
    const c = COMMON_REPORT_WORDS[lang];
    const { th, td, tdNum } = REPORT_CELL;

    return (<ReportSheet lang={lang} variant={variant}>
      <ReportHeader tagline={c.brandTagline} title={w.title} referenceLabel={c.reference} reference={report.reference} issuedLabel={c.issued} issued={formatDate(report.issuedAt)}/>

      <ReportIdentity whoLabel={w.situationAt} who={formatDate(report.issuedAt)}/>

      <ReportSection title={w.summaryTitle}>
        <ReportCardGrid>
          <ReportCard dot="bg-primary" title={w.capital}>
            <ReportCardValue>{num(`${formatWholeDzd(report.totalCapital)} DZD`)}</ReportCardValue>
            <small className="text-[11px] text-neutral-500">{w.investorsCount(report.activeCount)}</small>
          </ReportCard>
          <ReportCard dot="bg-financial-profit" title={w.availableProfits}>
            <ReportCardValue tone="text-financial-profit">{num(signedWhole(report.totalAvailable))}</ReportCardValue>
          </ReportCard>
          <ReportCard dot="bg-financial-profit" title={w.totalProfit}>
            <ReportCardValue tone="text-financial-profit">{num(signedWhole(report.totalGain))}</ReportCardValue>
          </ReportCard>
        </ReportCardGrid>
      </ReportSection>

      <ReportSection title={w.listTitle(report.investorCount)}>
        {report.rows.length === 0 ? (<p className="text-xs text-neutral-500">{w.empty}</p>) : (<ReportTable wide>
            <thead>
              <tr>
                <th className={th}>#</th>
                <th className={th}>{w.colName}</th>
                <th className={`${th} text-end`}>{w.colCapital}</th>
                <th className={`${th} text-end`}>{w.colAvailable}</th>
                <th className={`${th} text-end`}>{w.colWithdrawn}</th>
                <th className={`${th} text-end`}>{w.colTotalProfit}</th>
                <th className={`${th} text-end`}>{w.colRoi}</th>
                <th className={th}>{w.colEntry}</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row, index) => {
                const entryDay = investorEntryDay(row.entryDate);
                const roiTone = row.roi === null ? '' : row.roi > 0 ? 'text-financial-profit' : row.roi < 0 ? 'text-financial-loss' : '';
                return (<tr key={`${row.index}-${row.name}`} data-pdf-row="" data-pdf-break={index > 0 ? '' : undefined}>
                    <td className={`${td} text-neutral-500`}>{num(String(row.index))}</td>
                    <td className={td}>
                      <b className="block"><bdi>{row.name}</bdi></b>
                      <small className="block text-[11px] text-neutral-500">{row.isManager ? w.manager : w.investor} · {row.isActive ? w.active : w.inactive}</small>
                    </td>
                    <td className={tdNum}>{num(`${formatWholeDzd(row.capitalInvested)} DZD`)}</td>
                    <td className={`${tdNum} text-financial-profit`}>{num(`${formatWholeDzd(row.availableProfit)} DZD`)}</td>
                    <td className={`${tdNum} text-neutral-500`}>{num(`${formatWholeDzd(row.withdrawnProfit)} DZD`)}</td>
                    <td className={`${tdNum} text-financial-profit`}>{num(`${formatWholeDzd(row.totalProfit)} DZD`)}</td>
                    <td className={`${tdNum} ${roiTone}`}>{row.roi !== null ? num(`${row.roi > 0 ? '+' : ''}${formatAmount(row.roi)} %`) : '—'}</td>
                    <td className={`${td} text-neutral-600`}>{entryDay ? num(entryDay) : '—'}</td>
                  </tr>);
            })}
            </tbody>
          </ReportTable>)}
      </ReportSection>

      <ReportFooter>{c.footer}</ReportFooter>
    </ReportSheet>);
}
