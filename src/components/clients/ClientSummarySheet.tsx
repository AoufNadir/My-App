import { Fragment } from 'react';
import { CLIENT_SUMMARY_OPERATION_COUNT, summaryAmountOf, type ClientSummary, type SummaryRow } from '../../utils/clientSummary';
import { ReportFooter, ReportHeader, ReportIdentity, ReportSection, ReportSheet, num, type ReportSheetLang } from '../reports/ReportSheet';
import { REPORT_WORDS, formatDate, formatDzdCents, formatEur } from './clientActivityReportText';
import { summaryRowText } from './clientSummaryText';

/** Words of the summary picture, beside the client report's own (REPORT_WORDS). */
export const CLIENT_SUMMARY_WORDS: Record<ReportSheetLang, {
    title: string;
    situationOn: string;
    lastOperations: (count: number) => string;
    totalOperations: (count: number) => string;
    noOperation: string;
    /** Under the big balance: what it means for the client */
    balanceMeaning: { owes: string; credit: string; zero: string };
    /** Before the balance after each operation */
    balanceAfter: string;
    /** How to read the signs: the sign (none for « settled on the spot ») and what it means */
    legend: Array<{ sign: '+' | '−' | ''; text: string }>;
}> = {
    ar: {
        title: 'كشف حساب مختصر',
        situationOn: 'الوضع في',
        lastOperations: (count) => `آخر ${count} عمليات`,
        totalOperations: (count) => `${count} عملية في المجموع`,
        noOperation: 'لا توجد عمليات بعد.',
        balanceMeaning: { owes: 'هذا المبلغ عليك لـ ProDigital', credit: 'هذا المبلغ لك عند ProDigital', zero: 'لا يوجد أي مبلغ مستحق بيننا' },
        balanceAfter: 'الرصيد بعدها',
        legend: [
            { sign: '+', text: 'لصالحك: يزيد رصيدك' },
            { sign: '−', text: 'عليك: ينقص رصيدك' },
            { sign: '', text: 'بلا إشارة: دُفع في حينه، ولا يتغيّر رصيدك' },
        ],
    },
    fr: {
        title: 'Relevé de compte',
        situationOn: 'Situation au',
        lastOperations: (count) => `Vos ${count} dernières opérations`,
        totalOperations: (count) => `${count} opération${count > 1 ? 's' : ''} au total`,
        noOperation: 'Aucune opération pour le moment.',
        balanceMeaning: { owes: 'Montant que vous devez à ProDigital', credit: 'Montant que ProDigital vous doit', zero: 'Aucun montant dû de part et d’autre' },
        balanceAfter: 'Solde après',
        legend: [
            { sign: '+', text: 'en votre faveur : augmente votre solde' },
            { sign: '−', text: 'à votre charge : diminue votre solde' },
            { sign: '', text: 'sans signe : payé sur le moment, le solde ne change pas' },
        ],
    },
};

const TONE = { '+': 'text-financial-profit', '−': 'text-financial-debt', '': 'text-neutral-900' } as const;
/** The same width for the amount and the balance after it, so their digits end on one line down the sheet. */
const NUMBER_BLOCK = 'inline-block min-w-[112px] whitespace-nowrap text-right tabular-nums';

/** The amount of an operation, always with two decimals: « −52 400,00 », or the euros when that is all there is. */
export function summaryAmountText(entry: SummaryRow['entry']): string {
    const { cents, sign } = summaryAmountOf(entry);
    if (cents === null)
        return entry.eurAmount ? `${formatEur(entry.eurAmount)} €` : '—';
    return `${sign}${formatDzdCents(cents, true)}`;
}

/** The balance after an operation, signed like the amounts: + in the client's favour, − against. */
export function summaryBalanceText(balanceCents: number): { text: string; sign: '+' | '−' | '' } {
    const sign = balanceCents > 0 ? '+' : balanceCents < 0 ? '−' : '';
    return { text: `${sign}${formatDzdCents(balanceCents, true)}`, sign };
}

export type ClientSummarySheetProps = {
    summary: ClientSummary;
    lang: ReportSheetLang;
    clientName: string;
};

function OperationRow({ row, lang }: { row: SummaryRow; lang: ReportSheetLang }) {
    const s = CLIENT_SUMMARY_WORDS[lang];
    const text = summaryRowText(row.entry, row.context, lang);
    const { sign } = summaryAmountOf(row.entry);
    const after = summaryBalanceText(row.balanceAfterCents);
    return (<li className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 border-b border-border px-3 py-2.5 last:border-b-0">
      <p className="text-[13.5px] font-semibold leading-snug"><bdi>{text.title}</bdi></p>
      <span dir="ltr" className={`${NUMBER_BLOCK} text-[14px] font-bold leading-snug ${TONE[sign]}`}>{summaryAmountText(row.entry)}</span>
      <div className="col-span-2 flex items-baseline justify-between gap-3 text-[11.5px] leading-snug text-neutral-500">
        <span>{num(formatDate(row.entry.timestamp))}</span>
        <span className="flex items-baseline gap-1.5 whitespace-nowrap">
          <span>{s.balanceAfter}</span>
          <span dir="ltr" className={`${NUMBER_BLOCK} font-semibold ${after.sign ? TONE[after.sign] : 'text-neutral-600'}`}>{after.text}</span>
        </span>
      </div>
      {text.details.map((detail) => (<p key={detail} className="col-span-2 text-[11.5px] leading-snug text-neutral-600"><bdi>{detail}</bdi></p>))}
    </li>);
}

/** The summary picture: a phone-wide sheet (420px), light whatever the app theme, so it reads on a phone without zooming. */
export function ClientSummarySheet({ summary, lang, clientName }: ClientSummarySheetProps) {
    const w = REPORT_WORDS[lang];
    const s = CLIENT_SUMMARY_WORDS[lang];
    const { report, balanceCents, lastRows, operationCount } = summary;
    const issued = formatDate(report.issuedAt);
    const owes = balanceCents < 0;
    const label = balanceCents === 0 ? w.balanceNow : owes ? w.remainingOwed : w.remainingCredit;
    const meaning = balanceCents === 0 ? s.balanceMeaning.zero : owes ? s.balanceMeaning.owes : s.balanceMeaning.credit;
    return (<ReportSheet lang={lang} variant="image">
      <ReportHeader tagline={w.brandTagline} title={s.title} referenceLabel={w.reference} reference={report.reference} issuedLabel={w.issued} issued={issued} narrow/>
      <ReportIdentity whoLabel={w.client} who={clientName} periodLabel={s.situationOn} period={num(issued)}/>
      <div data-pdf-break="" className={`rounded-lg border px-4 py-4 ${owes ? 'border-financial-debt/40 bg-financial-debt-bg' : 'border-border bg-surface-muted'}`}>
        <p className="text-[13px] font-semibold text-neutral-600">{label}</p>
        <p className={`mt-1 text-[34px] font-bold leading-tight ${balanceCents === 0 ? 'text-neutral-900' : owes ? 'text-financial-debt' : 'text-financial-profit'}`}>{num(`${formatDzdCents(balanceCents, true)} DZD`)}</p>
        <p className="mt-1 text-[13px] font-medium text-neutral-700">{meaning}</p>
      </div>

      <ReportSection title={<span className="flex flex-wrap items-baseline justify-between gap-x-3">
          <span>{s.lastOperations(Math.min(CLIENT_SUMMARY_OPERATION_COUNT, lastRows.length) || CLIENT_SUMMARY_OPERATION_COUNT)}</span>
          <span className="text-xs font-normal text-neutral-500">{s.totalOperations(operationCount)}</span>
        </span>}>
        {lastRows.length === 0 ? (<p className="text-xs text-neutral-500">{s.noOperation}</p>) : (<>
            <ol className="overflow-hidden rounded-lg border border-border">
              {lastRows.map((row) => (<Fragment key={row.entry.id}><OperationRow row={row} lang={lang}/></Fragment>))}
            </ol>
            <ul className="flex flex-col gap-0.5 text-[11px] leading-snug text-neutral-500">
              {s.legend.map((item) => (<li key={item.text} className="flex items-baseline gap-1.5">
                  <b dir="ltr" className={`inline-block w-3 shrink-0 text-center text-[12px] ${TONE[item.sign]}`}>{item.sign || '·'}</b>
                  <span>{item.text}</span>
                </li>))}
            </ul>
          </>)}
      </ReportSection>

      <ReportFooter>{w.footer}</ReportFooter>
    </ReportSheet>);
}

/** The same summary as a WhatsApp message (a WhatsApp link carries text only). */
export function clientSummaryMessage(summary: ClientSummary, lang: ReportSheetLang, clientName: string): string {
    const w = REPORT_WORDS[lang];
    const s = CLIENT_SUMMARY_WORDS[lang];
    const { balanceCents, lastRows, report } = summary;
    const label = balanceCents === 0 ? w.balanceNow : balanceCents < 0 ? w.remainingOwed : w.remainingCredit;
    const meaning = balanceCents === 0 ? s.balanceMeaning.zero : balanceCents < 0 ? s.balanceMeaning.owes : s.balanceMeaning.credit;
    const lines = [
        `ProDigital · ${s.title}`,
        `${w.client}: ${clientName}`,
        `${s.situationOn} ${formatDate(report.issuedAt)}`,
        '',
        `${label}: ${formatDzdCents(balanceCents, true)} DZD`,
        meaning,
    ];
    if (lastRows.length) {
        lines.push('', `${s.lastOperations(lastRows.length)}:`);
        for (const row of lastRows) {
            const text = summaryRowText(row.entry, row.context, lang);
            const amount = summaryAmountText(row.entry);
            const unit = amount.endsWith('€') || amount === '—' ? '' : ' DZD';
            lines.push(`• ${formatDate(row.entry.timestamp)} · ${text.title}${text.details.length ? ` (${text.details.join(' · ')})` : ''} · ${amount}${unit}`);
        }
    }
    return lines.join('\n').replace(/[⁦⁩]/g, '');
}
