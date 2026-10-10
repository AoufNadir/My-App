import { useMemo, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import type { ClientTransactionDzd, Tx } from '../../types';
import { buildClientActivityReport, dayKey, defaultReportPeriod, listReportPeriods, parseDayKey, reportPeriodForDates } from '../../utils/clientActivityReport';
import { Modal, ModalContent, ModalHeader, ModalTitle } from '../ui/Modal';
import { ReportLanguagePicker, ReportPreview, ReportPrintHolder, ReportRangePicker, ReportSendFooter, useReportLanguage, useReportSender } from '../reports/ReportDialogParts';
import { reportPageFooter } from '../reports/reportPageFooter';
import { ClientActivityReportSheet } from './ClientActivityReportSheet';
import { reportFileName } from './clientActivityReportPdf';
import { REPORT_WORDS } from './clientActivityReportText';

export type ClientActivityReportDialogProps = {
    onClose: () => void;
    clientId: string;
    clientName: string;
    /** Ledger rows (other clients' rows are ignored) */
    clientRows: ReadonlyArray<ClientTransactionDzd>;
    transactions: ReadonlyArray<Tx>;
    /** Days the window opens on (YYYY-MM-DD); the last finished month with an operation otherwise */
    initialRange?: { start: string; end: string };
    /** For tests and screenshots; the time the window opened otherwise */
    now?: number;
};

/**
 * The client report, the only one sent to a client: two dates (or this month, this year, the whole
 * history), preview, send as a PDF from the phone. Read-only: nothing is written anywhere.
 */
export function ClientActivityReportDialog({ onClose, clientId, clientName, clientRows, transactions, initialRange, now: fixedNow }: ClientActivityReportDialogProps) {
    const { t, lang: appLang } = useLanguage();
    // Fixed while the window is open, so « today » and the PDF agree.
    const [now] = useState(() => fixedNow ?? Date.now());
    const ownRows = useMemo(() => clientRows.filter((row) => row.clientId === clientId), [clientRows, clientId]);
    const firstOperationAt = useMemo(() => (ownRows.length ? Math.min(...ownRows.map((row) => row.timestamp)) : null), [ownRows]);

    const [range, setRange] = useState(() => {
        if (initialRange)
            return initialRange;
        const month = defaultReportPeriod(listReportPeriods('month', firstOperationAt, now), ownRows, now);
        return { start: dayKey(month.from), end: dayKey(Math.min(month.to, now)) };
    });
    const from = parseDayKey(range.start, false);
    const to = parseDayKey(range.end, true);
    const dateError = from === null || to === null ? t('clients.reportPickBothDates') : from > to ? t('clients.reportStartAfterEnd') : null;
    const period = useMemo(() => (from !== null && to !== null && from <= to ? reportPeriodForDates(from, to, now) : null), [from, to, now]);
    // Some clients read French, others Arabic: remembered per client.
    const [reportLang, setReportLang] = useReportLanguage(`client_report_lang_${clientId}`, appLang);
    const [showBalance, setShowBalance] = useState(true);

    const report = useMemo(() => (period ? buildClientActivityReport({ clientId, clientRows: ownRows, transactions, period, now }) : null), [clientId, ownRows, transactions, period, now]);
    const job = report ? {
        fileName: reportFileName(report.period),
        title: `${REPORT_WORDS[reportLang].title[report.kind]} · ${clientName}`,
        footer: reportPageFooter(reportLang, report.issuedAt, report.reference),
    } : null;
    // The PDF is made in the background once the report is on screen: « Envoyer » only shares it.
    const { sendState, progress, printHolder, changed, send } = useReportSender(job);

    const choose = (start: string, end: string) => {
        setRange({ start, end });
        changed();
    };
    const today = dayKey(now);
    const thisMonth = () => choose(dayKey(new Date(new Date(now).getFullYear(), new Date(now).getMonth(), 1).getTime()), today);
    const thisYear = () => choose(`${new Date(now).getFullYear()}-01-01`, today);
    const allHistory = () => choose(dayKey(firstOperationAt ?? now), today);

    const handleSend = () => {
        if (job)
            void send(job);
    };

    const hasOperations = ownRows.length > 0;
    return (<Modal isOpen onClose={onClose} className="max-w-lg bg-surface">
      <ModalHeader onClose={onClose}>
        <ModalTitle className="text-base sm:text-lg">{t('clients.activityReport')}</ModalTitle>
        <p className="truncate text-[13px] text-neutral-500">{clientName}</p>
      </ModalHeader>
      <ModalContent className="flex flex-col gap-4 px-4 py-4 sm:px-5">
        {!hasOperations ? (<p className="rounded-card bg-surface-muted px-4 py-6 text-center text-sm text-neutral-600">{t('clients.activityReportNoOperation')}</p>) : (<>
            {/* Like the investor report window: this month, this year, the whole history, or two dates. */}
            <ReportRangePicker idPrefix="client-report" start={range.start} end={range.end} onChange={choose} onThisMonth={thisMonth} onThisYear={thisYear} onAllHistory={allHistory} error={dateError}/>
            <ReportLanguagePicker value={reportLang} onChange={(id) => { setReportLang(id); changed(); }}/>
            <label htmlFor="client-report-balance" className="flex min-h-touch cursor-pointer items-center gap-3 rounded-xl bg-surface-muted p-3 transition-colors hover:bg-neutral-100">
              <input type="checkbox" id="client-report-balance" checked={showBalance} onChange={(event) => { setShowBalance(event.target.checked); changed(); }} className="h-5 w-5 shrink-0 rounded accent-primary"/>
              <span className="text-sm font-medium select-none">
                <span>{t('clients.activityReportShowBalance')}</span>
                <span className="mt-0.5 block text-xs font-normal text-neutral-500">{t('clients.activityReportShowBalanceHint')}</span>
              </span>
            </label>
            {report && (<ReportPreview label={t('clients.activityReportPreview') as string}>
                <ClientActivityReportSheet report={report} lang={reportLang} clientName={clientName} showBalance={showBalance} variant="screen"/>
              </ReportPreview>)}
          </>)}
      </ModalContent>
      <ReportSendFooter sendState={sendState} progress={progress} onClose={onClose} onSend={handleSend} showSend={hasOperations} canSend={Boolean(report)}/>
      {hasOperations && report && (<ReportPrintHolder holderRef={printHolder}>
          <ClientActivityReportSheet report={report} lang={reportLang} clientName={clientName} showBalance={showBalance} variant="print"/>
        </ReportPrintHolder>)}
    </Modal>);
}
