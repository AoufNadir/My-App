import type { ReactNode } from 'react';
import type { MonthlyClientRef, MonthlyReport } from '../../../utils/monthlyReport';
import { getClientOperationLabel, getClientTransferDetails, getManualClientNote, getPortfolioOperationLabel } from '../../../utils/transactionTerminology';
import { COMMON_REPORT_WORDS, MONTHLY_REPORT_WORDS, monthNames, reportTranslator } from '../documentWords';
import { formatAmount, formatDate, formatQuantity, formatTime } from '../reportFormat';
import { REPORT_CELL, ReportCard, ReportCardGrid, ReportCardValue, ReportFact, ReportFooter, ReportHeader, ReportIdentity, ReportSection, ReportSheet, ReportTable, num, type ReportSheetLang } from '../ReportSheet';

export type MonthlyReportSheetProps = {
    report: MonthlyReport;
    lang: ReportSheetLang;
    /** The day the report is made */
    issuedAt: number;
    variant: 'screen' | 'print';
};

// As on the client and investor reports: under half a centime is neither a gain nor a loss.
const tone = (value: number) => (value > 0.005 ? 'text-financial-profit' : value < -0.005 ? 'text-financial-loss' : '');
const sign = (value: number) => (value >= 0 ? '+' : '−');
const signedDzd = (value: number) => `${value >= 0 ? '+' : '−'}${formatAmount(Math.abs(value))} DZD`;

/** The date of a row, the time under it. */
function When({ timestamp }: { timestamp: number }) {
    return (<>{num(formatDate(timestamp))}<small className="block text-[10.5px] text-neutral-500">{num(formatTime(timestamp))}</small></>);
}

/** The monthly report on the shared report frame. */
export function MonthlyReportSheet({ report, lang, issuedAt, variant }: MonthlyReportSheetProps) {
    const w = MONTHLY_REPORT_WORDS[lang];
    const c = COMMON_REPORT_WORDS[lang];
    const t = reportTranslator(lang);
    const { th, td, tdNum } = REPORT_CELL;
    const clientName = (client: MonthlyClientRef): string => (client === 'unlinked' ? c.notLinked : client === 'unknown' ? c.unknownClient : client.name);
    const { portfolio, uncosted } = report;

    return (<ReportSheet lang={lang} variant={variant}>
      <ReportHeader tagline={c.brandTagline} title={w.title} referenceLabel={c.reference} reference={report.reference} issuedLabel={c.issued} issued={formatDate(issuedAt)}/>

      <ReportIdentity whoLabel={c.period} who={`${monthNames(lang)[report.month]} ${report.year}`}/>

      <ReportSection title={w.summaryTitle}>
        <ReportCardGrid>
          <ReportCard dot={report.realizedProfit < 0 ? 'bg-financial-loss' : 'bg-financial-profit'} title={w.realizedProfit}>
            <ReportCardValue tone={tone(report.realizedProfit)}>{num(signedDzd(report.realizedProfit))}</ReportCardValue>
          </ReportCard>
          <ReportCard dot="bg-primary" title={w.operations}>
            <ReportCardValue>{num(String(report.operationCount))}</ReportCardValue>
          </ReportCard>
          <ReportCard dot="bg-secondary" title={w.topClient}>
            <ReportCardValue>{report.topProfitableClient === null ? '-' : <bdi>{report.topProfitableClient === 'unknown' ? c.unknownClient : report.topProfitableClient.name}</bdi>}</ReportCardValue>
          </ReportCard>
          <ReportCard dot="bg-neutral-500" title={w.usdtBoughtSold}>
            <ReportCardValue>{num(`${formatAmount(report.usdtBought)} / ${formatAmount(report.usdtSold)}`)}</ReportCardValue>
          </ReportCard>
          <ReportCard dot="bg-neutral-500" title={w.eurBoughtSold}>
            <ReportCardValue>{num(`${formatAmount(report.eurBought)} / ${formatAmount(report.eurSold)}`)}</ReportCardValue>
          </ReportCard>
          <ReportCard dot={report.cumulativeProfit < 0 ? 'bg-financial-loss' : 'bg-financial-profit'} title={w.cumulativeProfit}>
            <ReportCardValue tone={tone(report.cumulativeProfit)}>{num(signedDzd(report.cumulativeProfit))}</ReportCardValue>
          </ReportCard>
        </ReportCardGrid>
        <div data-pdf-break="" className="grid grid-cols-1 gap-2.5 @lg:grid-cols-3">
          <ReportFact label={w.buys} value={num(String(report.buyCount))}/>
          <ReportFact label={w.sells} value={num(String(report.sellCount))}/>
          <ReportFact label={w.clientMovements} value={num(String(report.clientMovementCount))}/>
        </div>
      </ReportSection>

      <ReportSection title={w.portfolioTitle}>
        <ReportCardGrid>
          <ReportCard dot="bg-primary" title={w.usdtAvailable}>
            <ReportCardValue>{num(`${formatAmount(portfolio.usdtAvailable)} USDT`)}</ReportCardValue>
            <small className="text-[11px] text-neutral-500">{w.avgBuy}: {num(`${formatAmount(portfolio.usdtAvgBuy)} DZD`)}</small>
          </ReportCard>
          <ReportCard dot="bg-primary" title={w.eurAvailable}>
            <ReportCardValue>{num(`${formatAmount(portfolio.eurAvailable)} EUR`)}</ReportCardValue>
            <small className="text-[11px] text-neutral-500">{w.avgBuy}: {num(`${formatAmount(portfolio.eurAvgBuy)} DZD`)}</small>
          </ReportCard>
        </ReportCardGrid>
      </ReportSection>

      {uncosted && (<ReportSection title={w.uncostedTitle}>
          <div data-pdf-break="" className="grid grid-cols-1 gap-2.5 @lg:grid-cols-2">
            <ReportFact label={w.uncostedCount} value={num(String(uncosted.count))}/>
            <ReportFact label={w.uncostedQuantity} value={num(`${formatQuantity(uncosted.quantityWithoutCostBasis)} ${uncosted.currency}`)}/>
          </div>
          <ReportTable wide>
            <thead>
              <tr>
                <th className={th}>{w.colDate}</th>
                <th className={th}>{w.colOperation}</th>
                <th className={th}>{w.colCurrency}</th>
                <th className={`${th} text-end`}>{w.colSoldQuantity}</th>
                <th className={`${th} text-end`}>{w.colWithoutCost}</th>
                <th className={`${th} text-end`}>{w.colDerivedProfit}</th>
              </tr>
            </thead>
            <tbody>
              {uncosted.rows.map((row, index) => (<tr key={row.txId} data-pdf-row="" data-pdf-break={index > 0 ? '' : undefined}>
                  <td className={td}><When timestamp={row.timestamp}/></td>
                  <td className={td}><bdi>{row.txId}</bdi></td>
                  <td className={td}>{row.currency}</td>
                  <td className={tdNum}>{num(formatQuantity(row.quantity))}</td>
                  <td className={`${tdNum} text-financial-loss`}>{num(formatQuantity(row.quantityWithoutCostBasis))}</td>
                  <td className={`${tdNum} ${tone(row.derivedProfit)}`}>{num(signedDzd(row.derivedProfit))}</td>
                </tr>))}
            </tbody>
          </ReportTable>
          {uncosted.hidden > 0 && <p data-pdf-break="" className="text-xs text-neutral-500">{w.uncostedHidden(uncosted.hidden)}</p>}
          <p data-pdf-break="" className="text-xs text-neutral-500">{w.uncostedNote}</p>
        </ReportSection>)}

      <ReportSection title={w.rankingTitle(report.ranking.rows.length)}>
        {report.ranking.rows.length === 0 ? (<p className="text-xs text-neutral-500">{w.rankingEmpty}</p>) : (<>
            <ReportTable wide>
              <thead>
                <tr>
                  <th className={th}>{w.colRank}</th>
                  <th className={th}>{w.colClient}</th>
                  <th className={`${th} text-end`}>{w.colUsdtBuys}</th>
                  <th className={`${th} text-end`}>{w.colUsdtSales}</th>
                  <th className={`${th} text-end`}>{w.colVolume}</th>
                  <th className={`${th} text-end`}>{w.colProfit}</th>
                  <th className={`${th} text-end`}>{w.colOps}</th>
                </tr>
              </thead>
              <tbody>
                {report.ranking.rows.map((row, index) => (<tr key={row.clientId} data-pdf-row="" data-pdf-break={index > 0 ? '' : undefined}>
                    <td className={td}>{num(String(index + 1))}</td>
                    <td className={td}><bdi>{clientName(row.client)}</bdi></td>
                    <td className={tdNum}>{num(formatAmount(row.buyVolumeUsdt))}</td>
                    <td className={tdNum}>{num(formatAmount(row.sellVolumeUsdt))}</td>
                    <td className={`${tdNum} font-semibold`}>{num(formatAmount(row.totalVolumeUsdt))}</td>
                    <td className={`${tdNum} ${tone(row.realizedProfit)}`}>{num(signedDzd(row.realizedProfit))}</td>
                    <td className={tdNum}>{num(String(row.txCount))}</td>
                  </tr>))}
              </tbody>
            </ReportTable>
            {report.ranking.hidden > 0 && <p data-pdf-break="" className="text-xs text-neutral-500">{w.rankingHidden(report.ranking.hidden)}</p>}
          </>)}
      </ReportSection>

      <ReportSection title={w.operationsTitle(report.portfolioOperations.rows.length)}>
        {report.portfolioOperations.rows.length === 0 ? (<p className="text-xs text-neutral-500">{w.operationsEmpty}</p>) : (<>
            <ReportTable wide>
              <thead>
                <tr>
                  <th className={th}>{w.colDate}</th>
                  <th className={th}>{w.colType}</th>
                  <th className={th}>{w.colClient}</th>
                  <th className={`${th} text-end`}>{w.colQuantity}</th>
                  <th className={`${th} text-end`}>{w.colUnitPrice}</th>
                  <th className={`${th} text-end`}>{w.colTotal}</th>
                  <th className={`${th} text-end`}>{w.colProfit}</th>
                  <th className={th}>{w.colNotes}</th>
                </tr>
              </thead>
              <tbody>
                {report.portfolioOperations.rows.map((row, index) => {
                const typeLabel = row.usdtSaleSettledInEur ? t('ledger.sellUsdtEur') : getPortfolioOperationLabel(row.type, row.currency, t);
                const notes: ReactNode = row.euroSettlement
                    ? `${row.notes || '-'} | ${formatAmount(row.euroSettlement.saleValueEur)} EUR x ${formatAmount(row.euroSettlement.eurToDzdRate)} DZD`
                    : row.notes || '-';
                return (<tr key={row.id} data-pdf-row="" data-pdf-break={index > 0 ? '' : undefined}>
                    <td className={td}><When timestamp={row.timestamp}/></td>
                    <td className={td}>{typeLabel}</td>
                    <td className={td}><bdi>{clientName(row.client)}</bdi></td>
                    <td className={tdNum}>{num(formatQuantity(row.quantity))}</td>
                    <td className={tdNum}>{num(row.usdtSaleSettledInEur ? `${formatAmount(row.unitPrice)} EUR` : formatAmount(row.unitPrice))}</td>
                    <td className={tdNum}>{num(formatAmount(row.total))}</td>
                    <td className={`${tdNum} ${row.profit === null ? '' : tone(row.profit)}`}>{row.profit === null ? '-' : num(`${sign(row.profit)}${formatAmount(Math.abs(row.profit))}`)}</td>
                    <td className={td}><bdi>{notes}</bdi></td>
                  </tr>);
            })}
              </tbody>
            </ReportTable>
            {report.portfolioOperations.hidden > 0 && <p data-pdf-break="" className="text-xs text-neutral-500">{w.operationsHidden(report.portfolioOperations.hidden)}</p>}
          </>)}
      </ReportSection>

      <ReportSection title={w.movementsTitle(report.clientMovements.rows.length)}>
        {report.clientMovements.rows.length === 0 ? (<p className="text-xs text-neutral-500">{w.movementsEmpty}</p>) : (<>
            <ReportTable wide>
              <thead>
                <tr>
                  <th className={th}>{w.colDate}</th>
                  <th className={th}>{w.colClient}</th>
                  <th className={th}>{w.colType}</th>
                  <th className={`${th} text-end`}>{w.colAmount}</th>
                  <th className={th}>{w.colNotes}</th>
                </tr>
              </thead>
              <tbody>
                {report.clientMovements.rows.map((row, index) => {
                const notes = row.type === 'Transfert Entrant' || row.type === 'Transfert Sortant'
                    ? getClientTransferDetails(row, row.counterpartName, t)
                    : getManualClientNote(row.notes);
                return (<tr key={row.id} data-pdf-row="" data-pdf-break={index > 0 ? '' : undefined}>
                    <td className={td}><When timestamp={row.timestamp}/></td>
                    <td className={td}><bdi>{clientName(row.client)}</bdi></td>
                    <td className={td}>{getClientOperationLabel(row.type, t)}</td>
                    <td className={`${tdNum} ${row.amount >= 0 ? 'text-financial-profit' : 'text-financial-loss'}`}>{num(`${sign(row.amount)}${formatAmount(Math.abs(row.amount))}`)}</td>
                    <td className={td}><bdi>{notes || '-'}</bdi></td>
                  </tr>);
            })}
              </tbody>
            </ReportTable>
            {report.clientMovements.hidden > 0 && <p data-pdf-break="" className="text-xs text-neutral-500">{w.movementsHidden(report.clientMovements.hidden)}</p>}
          </>)}
      </ReportSection>

      <ReportFooter>{c.footer}</ReportFooter>
    </ReportSheet>);
}
