import { useMemo, useRef, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import type { ClientTransactionDzd, Tx } from '../../types';
import { buildClientActivityReport, defaultReportPeriod, listReportPeriods, type ReportKind, type ReportLang, type ReportPeriod } from '../../utils/clientActivityReport';
import { ShareIcon } from '../icons/ShareIcon';
import { Button } from '../ui/Button';
import { inBody } from '../ui/Dialog';
import { Modal, ModalContent, ModalHeader, ModalTitle } from '../ui/Modal';
import { OperationFooter } from '../ui/OperationFooter';
import { SegmentedControl } from '../ui/SegmentedControl';
import { Select } from '../ui/Select';
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

const pad2 = (value: number) => String(value).padStart(2, '0');

type SendState = 'idle' | 'busy' | 'ready' | 'downloaded' | 'error';

/**
 * Client activity report (weekly, monthly, yearly): choose, preview, send as a PDF from the phone.
 * Read-only: nothing is written anywhere.
 */
export function ClientActivityReportDialog({ onClose, clientId, clientName, clientRows, transactions, now: fixedNow }: ClientActivityReportDialogProps) {
    const { t, lang: appLang } = useLanguage();
    const appWords = REPORT_WORDS[appLang === 'ar' ? 'ar' : 'fr'];
    // Fixed while the window is open, so the list of periods and the PDF agree.
    const [now] = useState(() => fixedNow ?? Date.now());
    const ownRows = useMemo(() => clientRows.filter((row) => row.clientId === clientId), [clientRows, clientId]);
    const firstOperationAt = useMemo(() => (ownRows.length ? Math.min(...ownRows.map((row) => row.timestamp)) : null), [ownRows]);

    const [kind, setKind] = useState<ReportKind>('month');
    const periods = useMemo(() => listReportPeriods(kind, firstOperationAt, now), [kind, firstOperationAt, now]);
    const [periodKey, setPeriodKey] = useState<string | null>(null);
    const period = periods.find((item) => item.key === periodKey) ?? defaultReportPeriod(periods, ownRows, now);
    const [reportLang, setReportLang] = useState<ReportLang>(() => savedLanguage(clientId) ?? (appLang === 'ar' ? 'ar' : 'fr'));
    const [showBalance, setShowBalance] = useState(true);
    const [sendState, setSendState] = useState<SendState>('idle');
    const readyPdf = useRef<Blob | null>(null);
    const printHolder = useRef<HTMLDivElement | null>(null);

    const report = useMemo(() => buildClientActivityReport({ clientId, clientRows: ownRows, transactions, period, now }), [clientId, ownRows, transactions, period, now]);

    // Any change makes the prepared PDF stale.
    const changed = () => {
        readyPdf.current = null;
        setSendState('idle');
    };
    const periodLabel = (item: ReportPeriod) => {
        const days = item.kind === 'week' ? ` · ${pad2(item.firstDay)}–${pad2(item.lastDay)}/${pad2(item.month + 1)}` : '';
        return `${appWords.periodName(item)}${days}${item.to >= now ? ` (${appWords.soFar})` : ''}`;
    };
    const pdfTitle = `${REPORT_WORDS[reportLang].title[report.kind]} · ${clientName}`;
    const fileName = reportFileName(report.period);

    const afterShare = (outcome: ShareOutcome) => setSendState(outcome === 'needsTap' ? 'ready' : outcome === 'downloaded' ? 'downloaded' : 'idle');
    const handleSend = async () => {
        if (sendState === 'busy')
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
            <div className="flex flex-col gap-1.5">
              <p className="text-sm font-semibold leading-snug text-neutral-700">{t('clients.activityReportKind')}</p>
              <SegmentedControl<ReportKind> size="md" ariaLabel={t('clients.activityReportKind') as string} value={kind} onChange={(id) => { setKind(id); setPeriodKey(null); changed(); }} options={[
                { id: 'week', label: t('clients.activityReportWeek') },
                { id: 'month', label: t('clients.activityReportMonth') },
                { id: 'year', label: t('clients.activityReportYear') },
            ]}/>
            </div>
            <Select id="client-report-period" label={t('clients.activityReportPeriod') as string} value={period.key} onChange={(event) => { setPeriodKey(event.target.value); changed(); }}>
              {periods.map((item) => <option key={item.key} value={item.key}>{periodLabel(item)}</option>)}
            </Select>
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
            <section aria-label={t('clients.activityReportPreview') as string} className="flex flex-col gap-2">
              <p className="text-sm font-semibold leading-snug text-neutral-700">{t('clients.activityReportPreview')}</p>
              <div className="rounded-card bg-neutral-200/60 p-2">
                <ClientActivityReportSheet report={report} lang={reportLang} clientName={clientName} showBalance={showBalance} variant="screen"/>
              </div>
            </section>
          </>)}
      </ModalContent>
      {/* What happened to the PDF stays in sight above the buttons, however far the preview is scrolled. */}
      <OperationFooter reason={sendState === 'ready' ? t('clients.activityReportReady') : sendState === 'downloaded' ? t('clients.activityReportDownloaded') : sendState === 'error' ? t('clients.activityReportFailed') : undefined} reasonTone={sendState === 'error' ? 'fix' : 'missing'}>
        <Button variant="outline" onClick={onClose}>{t('common.close')}</Button>
        {hasOperations && (<Button onClick={handleSend} loading={sendState === 'busy'}>
            {sendState !== 'busy' && <ShareIcon aria-hidden="true" className="h-4 w-4 shrink-0"/>}
            <span className="min-w-0 truncate">{sendLabel}</span>
          </Button>)}
      </OperationFooter>
      {/* The A4 sheet the PDF is made from: laid out off screen, captured on « Envoyer ». */}
      {hasOperations && inBody(<div ref={printHolder} aria-hidden="true" className="pointer-events-none fixed top-0 -left-[20000px]">
          <ClientActivityReportSheet report={report} lang={reportLang} clientName={clientName} showBalance={showBalance} variant="print"/>
        </div>)}
    </Modal>);
}
