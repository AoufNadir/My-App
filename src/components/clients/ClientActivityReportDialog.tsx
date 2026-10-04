import { useMemo, useRef, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import type { ClientTransactionDzd, Tx } from '../../types';
import { buildClientActivityReport, dayKey, defaultReportPeriod, listReportPeriods, parseDayKey, reportPeriodForDates, type ReportLang } from '../../utils/clientActivityReport';
import { ShareIcon } from '../icons/ShareIcon';
import { Button } from '../ui/Button';
import { DatePicker } from '../ui/DatePicker';
import { inBody } from '../ui/Dialog';
import { Label } from '../ui/Label';
import { Modal, ModalContent, ModalHeader, ModalTitle } from '../ui/Modal';
import { OperationFooter } from '../ui/OperationFooter';
import { SegmentedControl } from '../ui/SegmentedControl';
import { ClientActivityReportSheet } from './ClientActivityReportSheet';
import { renderReportPdf, reportFileName, shareOrDownloadPdf, type ShareOutcome } from './clientActivityReportPdf';
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

// The report language is remembered per client: some clients read French, others Arabic.
const languageKey = (clientId: string) => `client_report_lang_${clientId}`;
function savedLanguage(clientId: string): ReportLang | null {
    try {
        const value = localStorage.getItem(languageKey(clientId));
        return value === 'ar' || value === 'fr' ? value : null;
    }
    catch {
        return null;
    }
}
function saveLanguage(clientId: string, lang: ReportLang) {
    try {
        localStorage.setItem(languageKey(clientId), lang);
    }
    catch {
        // Private browsing: the choice is simply not remembered.
    }
}

type SendState = 'idle' | 'busy' | 'ready' | 'downloaded' | 'error';

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
    const [reportLang, setReportLang] = useState<ReportLang>(() => savedLanguage(clientId) ?? (appLang === 'ar' ? 'ar' : 'fr'));
    const [showBalance, setShowBalance] = useState(true);
    const [sendState, setSendState] = useState<SendState>('idle');
    const readyPdf = useRef<Blob | null>(null);
    const printHolder = useRef<HTMLDivElement | null>(null);

    const report = useMemo(() => (period ? buildClientActivityReport({ clientId, clientRows: ownRows, transactions, period, now }) : null), [clientId, ownRows, transactions, period, now]);

    // Any change makes the prepared PDF stale.
    const changed = () => {
        readyPdf.current = null;
        setSendState('idle');
    };
    const choose = (start: string, end: string) => {
        setRange({ start, end });
        changed();
    };
    const today = dayKey(now);
    const thisMonth = () => choose(dayKey(new Date(new Date(now).getFullYear(), new Date(now).getMonth(), 1).getTime()), today);
    const thisYear = () => choose(`${new Date(now).getFullYear()}-01-01`, today);
    const allHistory = () => choose(dayKey(firstOperationAt ?? now), today);
    const pdfTitle = report ? `${REPORT_WORDS[reportLang].title[report.kind]} · ${clientName}` : '';
    const fileName = report ? reportFileName(report.period) : '';

    const afterShare = (outcome: ShareOutcome) => setSendState(outcome === 'needsTap' ? 'ready' : outcome === 'downloaded' ? 'downloaded' : 'idle');
    const handleSend = async () => {
        if (sendState === 'busy' || !report)
            return;
        // Prepared already (the browser asked for a fresh tap, or the same report again): share at once.
        if (readyPdf.current) {
            afterShare(await shareOrDownloadPdf(readyPdf.current, fileName, pdfTitle));
            return;
        }
        const sheet = printHolder.current?.firstElementChild;
        if (!(sheet instanceof HTMLElement))
            return;
        setSendState('busy');
        try {
            // Let the button show its busy state before the capture holds the page.
            await new Promise((resolve) => setTimeout(resolve, 40));
            readyPdf.current = await renderReportPdf(sheet, pdfTitle);
            afterShare(await shareOrDownloadPdf(readyPdf.current, fileName, pdfTitle));
        }
        catch (error) {
            console.error(error);
            readyPdf.current = null;
            setSendState('error');
        }
    };

    const hasOperations = ownRows.length > 0;
    const sendLabel = sendState === 'busy' ? t('clients.activityReportPreparing') : t('clients.activityReportSend');
    return (<Modal isOpen onClose={onClose} className="max-w-lg bg-surface">
      <ModalHeader onClose={onClose}>
        <ModalTitle className="text-base sm:text-lg">{t('clients.activityReport')}</ModalTitle>
        <p className="truncate text-[13px] text-neutral-500">{clientName}</p>
      </ModalHeader>
      <ModalContent className="flex flex-col gap-4 px-4 py-4 sm:px-5">
        {!hasOperations ? (<p className="rounded-card bg-surface-muted px-4 py-6 text-center text-sm text-neutral-600">{t('clients.activityReportNoOperation')}</p>) : (<>
            {/* Like the investor report window: this month, this year, the whole history, or two dates. */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Button onClick={thisMonth} variant="outline" className="font-bold">{t('clients.reportThisMonth')}</Button>
              <Button onClick={thisYear} variant="outline" className="font-bold">{t('clients.reportThisYear')}</Button>
              <Button onClick={allHistory} variant="outline" className="col-span-2 font-bold sm:col-span-1">{t('clients.reportAllHistory')}</Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="client-report-start">{t('transactions.startDate')}</Label>
                <DatePicker id="client-report-start" value={range.start} max={range.end || undefined} onChange={(iso) => choose(iso, range.end)} className="mt-1"/>
              </div>
              <div>
                <Label htmlFor="client-report-end">{t('transactions.endDate')}</Label>
                <DatePicker id="client-report-end" value={range.end} min={range.start || undefined} onChange={(iso) => choose(range.start, iso)} className="mt-1"/>
              </div>
            </div>
            {dateError && <p role="alert" className="text-sm font-semibold text-danger">{dateError}</p>}
            <div className="flex flex-col gap-1.5">
              <p className="text-sm font-semibold leading-snug text-neutral-700">{t('clients.activityReportLanguage')}</p>
              <SegmentedControl<ReportLang> size="md" ariaLabel={t('clients.activityReportLanguage') as string} value={reportLang} onChange={(id) => { setReportLang(id); saveLanguage(clientId, id); changed(); }} options={[
                { id: 'ar', label: <span lang="ar" className="font-arabic">العربية</span> },
                { id: 'fr', label: <span lang="fr" className="font-latin">Français</span> },
            ]}/>
            </div>
            <label htmlFor="client-report-balance" className="flex min-h-touch cursor-pointer items-center gap-3 rounded-xl bg-surface-muted p-3 transition-colors hover:bg-neutral-100">
              <input type="checkbox" id="client-report-balance" checked={showBalance} onChange={(event) => { setShowBalance(event.target.checked); changed(); }} className="h-5 w-5 shrink-0 rounded accent-primary"/>
              <span className="text-sm font-medium select-none">
                <span>{t('clients.activityReportShowBalance')}</span>
                <span className="mt-0.5 block text-xs font-normal text-neutral-500">{t('clients.activityReportShowBalanceHint')}</span>
              </span>
            </label>
            {report && (<section aria-label={t('clients.activityReportPreview') as string} className="flex flex-col gap-2">
                <p className="text-sm font-semibold leading-snug text-neutral-700">{t('clients.activityReportPreview')}</p>
                <div className="rounded-card bg-neutral-200/60 p-2">
                  <ClientActivityReportSheet report={report} lang={reportLang} clientName={clientName} showBalance={showBalance} variant="screen"/>
                </div>
              </section>)}
          </>)}
      </ModalContent>
      {/* What happened to the PDF stays in sight above the buttons, however far the preview is scrolled. */}
      <OperationFooter reason={sendState === 'ready' ? t('clients.activityReportReady') : sendState === 'downloaded' ? t('clients.activityReportDownloaded') : sendState === 'error' ? t('clients.activityReportFailed') : undefined} reasonTone={sendState === 'error' ? 'fix' : 'missing'}>
        <Button variant="outline" onClick={onClose}>{t('common.close')}</Button>
        {hasOperations && (<Button onClick={handleSend} loading={sendState === 'busy'} disabled={!report}>
            {sendState !== 'busy' && <ShareIcon aria-hidden="true" className="h-4 w-4 shrink-0"/>}
            <span className="min-w-0 truncate">{sendLabel}</span>
          </Button>)}
      </OperationFooter>
      {/* The A4 sheet the PDF is made from: laid out off screen, captured on « Envoyer ». */}
      {hasOperations && report && inBody(<div ref={printHolder} aria-hidden="true" className="pointer-events-none fixed top-0 -left-[20000px]">
          <ClientActivityReportSheet report={report} lang={reportLang} clientName={clientName} showBalance={showBalance} variant="print"/>
        </div>)}
    </Modal>);
}
