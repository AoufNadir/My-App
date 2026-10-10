import type { TreasuryReport } from '../../../utils/treasuryReport';
import { COMMON_REPORT_WORDS, TREASURY_REPORT_WORDS, reportTranslator } from '../documentWords';
import { formatDate, formatWholeDzd } from '../reportFormat';
import { REPORT_CELL, ReportCard, ReportCardGrid, ReportCardValue, ReportFact, ReportFooter, ReportHeader, ReportIdentity, ReportSection, ReportSheet, ReportTable, num, type ReportSheetLang } from '../ReportSheet';

export type TreasuryReportSheetProps = {
    report: TreasuryReport;
    lang: ReportSheetLang;
    variant: 'screen' | 'print';
};

const MOVEMENT_WORD_KEYS: Record<string, string> = {
    'Ajout': 'treasury.inShort',
    'Retrait': 'treasury.outShort',
    'Adjustment (+)': 'treasury.adjustmentIn',
    'Adjustment (-)': 'treasury.adjustmentOut',
    'Transfer': 'ledger.internalTransfer',
};
const WALLET_WORD_KEYS: Record<string, string> = { Caisse: 'transactions.cash', BaridiMob: 'transactions.baridi' };

const signedWhole = (value: number) => `${value >= 0 ? '+' : '−'}${formatWholeDzd(Math.abs(value))} DZD`;
const flowTone = (value: number) => (value > 0 ? 'text-financial-profit' : value < 0 ? 'text-financial-loss' : '');

/** The treasury report (Caisse and BaridiMob) on the shared report frame. */
export function TreasuryReportSheet({ report, lang, variant }: TreasuryReportSheetProps) {
    const w = TREASURY_REPORT_WORDS[lang];
    const c = COMMON_REPORT_WORDS[lang];
    const t = reportTranslator(lang);
    const { th, td, tdNum } = REPORT_CELL;
    const typeName = (type: string) => (MOVEMENT_WORD_KEYS[type] ? t(MOVEMENT_WORD_KEYS[type]) : type);
    const walletName = (source: string) => (WALLET_WORD_KEYS[source] ? t(WALLET_WORD_KEYS[source]) : source);

    return (<ReportSheet lang={lang} variant={variant}>
      <ReportHeader tagline={c.brandTagline} title={w.title} referenceLabel={c.reference} reference={report.reference} issuedLabel={c.issued} issued={formatDate(report.issuedAt)}/>

      <ReportIdentity whoLabel={w.situationAt} who={formatDate(report.issuedAt)}/>

      <ReportSection title={w.balancesTitle}>
        <ReportCardGrid>
          <ReportCard dot="bg-primary" title={w.caisse}>
            <ReportCardValue>{num(`${formatWholeDzd(report.caisse)} DZD`)}</ReportCardValue>
          </ReportCard>
          <ReportCard dot="bg-primary" title={w.baridi}>
            <ReportCardValue>{num(`${formatWholeDzd(report.baridi)} DZD`)}</ReportCardValue>
          </ReportCard>
          <ReportCard dot={report.netFlow >= 0 ? 'bg-financial-profit' : 'bg-financial-loss'} title={w.netFlow}>
            <ReportCardValue tone={flowTone(report.netFlow)}>{num(signedWhole(report.netFlow))}</ReportCardValue>
          </ReportCard>
        </ReportCardGrid>
        <div data-pdf-break="" className="grid grid-cols-1 gap-2.5 @lg:grid-cols-3">
          <ReportFact label={w.totalIn} value={num(`+${formatWholeDzd(report.totalIn)} DZD`)} valueTone="text-financial-profit"/>
          <ReportFact label={w.totalOut} value={num(`−${formatWholeDzd(report.totalOut)} DZD`)} valueTone="text-financial-loss"/>
          <ReportFact label={w.movementCount} value={num(String(report.movementCount))}/>
        </div>
      </ReportSection>

      <ReportSection title={w.movementsTitle(report.movementCount)}>
        {report.rows.length === 0 ? (<p className="text-xs text-neutral-500">{w.empty}</p>) : (<ReportTable wide>
            <thead>
              <tr>
                <th className={th}>{w.colDate}</th>
                <th className={th}>{w.colTime}</th>
                <th className={th}>{w.colType}</th>
                <th className={th}>{w.colSource}</th>
                <th className={`${th} text-end`}>{w.colAmount}</th>
                <th className={th}>{w.colNotes}</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row, index) => {
                const amountTone = row.direction === 'in' ? 'text-financial-profit' : row.direction === 'out' ? 'text-financial-loss' : 'text-neutral-500';
                return (<tr key={`${row.date}-${row.time}-${index}`} data-pdf-row="" data-pdf-break={index > 0 ? '' : undefined}>
                    <td className={td}>{num(row.date)}</td>
                    <td className={td}>{num(row.time)}</td>
                    <td className={td}>{typeName(row.type)}</td>
                    <td className={td}>{walletName(row.source)}</td>
                    <td className={`${tdNum} font-semibold ${amountTone}`}>{num(`${row.direction === 'in' ? '+' : row.direction === 'out' ? '−' : ''}${formatWholeDzd(row.amount)}`)}</td>
                    <td className={td}><bdi>{row.notes}</bdi></td>
                  </tr>);
            })}
            </tbody>
          </ReportTable>)}
      </ReportSection>

      <ReportFooter>{c.footer}</ReportFooter>
    </ReportSheet>);
}
