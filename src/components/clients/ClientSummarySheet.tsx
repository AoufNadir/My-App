import type { ReportEntry } from '../../utils/clientActivityReport';
import { CLIENT_SUMMARY_OPERATION_COUNT, summaryOperationAmountCents, type ClientSummary } from '../../utils/clientSummary';
import { REPORT_CELL, ReportFooter, ReportHeader, ReportIdentity, ReportSection, ReportSheet, isolate, num, type ReportSheetLang } from '../reports/ReportSheet';
import { REPORT_WORDS, currencyUnit, formatDate, formatDzdCents, formatEur, formatPrice, formatQuantity } from './clientActivityReportText';

/** Words of the summary picture, beside the client report's own (REPORT_WORDS). */
export const CLIENT_SUMMARY_WORDS: Record<ReportSheetLang, {
    title: string;
    situationOn: string;
    lastOperations: (count: number) => string;
    totalOperations: (count: number) => string;
    noOperation: string;
}> = {
    ar: {
        title: 'كشف حساب مختصر',
        situationOn: 'الوضع في',
        lastOperations: (count) => `آخر ${count} عمليات`,
        totalOperations: (count) => `${count} عملية في المجموع`,
        noOperation: 'لا توجد عمليات بعد.',
    },
    fr: {
        title: 'Relevé de compte',
        situationOn: 'Situation au',
        lastOperations: (count) => `Vos ${count} dernières opérations`,
        totalOperations: (count) => `${count} opération${count > 1 ? 's' : ''} au total`,
        noOperation: 'Aucune opération pour le moment.',
    },
};

/** « 900 USDT × 249,00 », or the euros the client paid, under the operation's name. */
export function summaryOperationDetail(entry: ReportEntry): string {
    if ((entry.kind !== 'buy' && entry.kind !== 'saleToUs') || !entry.quantity || !entry.currency)
        return '';
    const unit = currencyUnit(entry.currency);
    if (entry.dzdCents !== null && !(entry.eurAmount && !entry.affectsBalance))
        return isolate(`${formatQuantity(entry.quantity)} ${unit} × ${formatPrice(entry.dzdCents / 100 / entry.quantity)}`);
    if (entry.eurAmount)
        return isolate(`${formatQuantity(entry.quantity)} ${unit} · ${formatEur(entry.eurAmount)} €`);
    return isolate(`${formatQuantity(entry.quantity)} ${unit}`);
}

export function summaryAmountText(entry: ReportEntry, showCents: boolean): string {
    const { cents, sign } = summaryOperationAmountCents(entry);
    if (cents === null)
        return entry.eurAmount ? `${formatEur(entry.eurAmount)} €` : '—';
    return `${sign}${formatDzdCents(cents, showCents)}`;
}

export type ClientSummarySheetProps = {
    summary: ClientSummary;
    lang: ReportSheetLang;
    clientName: string;
};

/** The summary picture: always the 794px paper sheet, light whatever the app theme. */
export function ClientSummarySheet({ summary, lang, clientName }: ClientSummarySheetProps) {
    const w = REPORT_WORDS[lang];
    const s = CLIENT_SUMMARY_WORDS[lang];
    const { report, balanceCents, lastOperations, operationCount, showCents } = summary;
    const issued = formatDate(report.issuedAt);
    const owes = balanceCents < 0;
    const label = balanceCents === 0 ? w.balanceNow : owes ? w.remainingOwed : w.remainingCredit;
    const { th: reportTh, td: reportTd, tdNum: reportTdNum } = REPORT_CELL;
    return (<ReportSheet lang={lang} variant="print">
      <ReportHeader tagline={w.brandTagline} title={s.title} referenceLabel={w.reference} reference={report.reference} issuedLabel={w.issued} issued={issued}/>
      <ReportIdentity whoLabel={w.client} who={clientName} periodLabel={s.situationOn} period={num(issued)}/>
      <div data-pdf-break="" className={`rounded-lg border px-4 py-4 ${owes ? 'border-financial-debt/40 bg-financial-debt-bg' : 'border-border bg-surface-muted'}`}>
        <p className="text-[13px] font-semibold text-neutral-600">{label}</p>
        <p className={`mt-1 text-[40px] font-bold leading-tight ${balanceCents === 0 ? 'text-neutral-900' : owes ? 'text-financial-debt' : 'text-financial-profit'}`}>{num(`${formatDzdCents(balanceCents, showCents)} DZD`)}</p>
        <p className="mt-1 text-xs text-neutral-500">{s.totalOperations(operationCount)}</p>
      </div>

      <ReportSection title={s.lastOperations(Math.min(CLIENT_SUMMARY_OPERATION_COUNT, lastOperations.length) || CLIENT_SUMMARY_OPERATION_COUNT)}>
        {lastOperations.length === 0 ? (<p className="text-xs text-neutral-500">{s.noOperation}</p>) : (<div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  <th className={reportTh}>{w.colDate}</th>
                  <th className={reportTh}>{w.colOperation}</th>
                  <th className={`${reportTh} text-end`}>{w.colAmount}</th>
                </tr>
              </thead>
              <tbody>
                {lastOperations.map((entry) => {
                    const detail = summaryOperationDetail(entry);
                    const amount = summaryAmountText(entry, showCents);
                    return (<tr key={entry.id}>
                      <td className={reportTd}>{num(formatDate(entry.timestamp))}</td>
                      <td className={reportTd}>{w.operation(entry)}{detail && <small className="block text-[11px] text-neutral-500">{detail}</small>}</td>
                      <td className={`${reportTdNum} font-semibold ${amount.startsWith('+') ? 'text-financial-profit' : ''}`}>{num(amount)}</td>
                    </tr>);
                })}
              </tbody>
            </table>
          </div>)}
      </ReportSection>

      <ReportFooter>{w.footer}</ReportFooter>
    </ReportSheet>);
}

/** The same summary as a WhatsApp message (a WhatsApp link carries text only). */
export function clientSummaryMessage(summary: ClientSummary, lang: ReportSheetLang, clientName: string): string {
    const w = REPORT_WORDS[lang];
    const s = CLIENT_SUMMARY_WORDS[lang];
    const { balanceCents, lastOperations, showCents, report } = summary;
    const label = balanceCents === 0 ? w.balanceNow : balanceCents < 0 ? w.remainingOwed : w.remainingCredit;
    const lines = [
        `ProDigital · ${s.title}`,
        `${w.client}: ${clientName}`,
        `${s.situationOn} ${formatDate(report.issuedAt)}`,
        '',
        `${label}: ${formatDzdCents(balanceCents, showCents)} DZD`,
    ];
    if (lastOperations.length) {
        lines.push('', `${s.lastOperations(lastOperations.length)}:`);
        for (const entry of lastOperations) {
            const detail = summaryOperationDetail(entry);
            const amount = summaryAmountText(entry, showCents);
            lines.push(`• ${formatDate(entry.timestamp)} · ${w.operation(entry)}${detail ? ` (${detail})` : ''} · ${amount}${amount.endsWith('€') || amount === '—' ? '' : ' DZD'}`);
        }
    }
    return lines.join('\n').replace(/[⁦⁩]/g, '');
}
