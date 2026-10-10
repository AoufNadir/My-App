import { useEffect, useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { ShareIcon } from '../icons/ShareIcon';
import { Button } from '../ui/Button';
import { DatePicker } from '../ui/DatePicker';
import { inBody } from '../ui/Dialog';
import { Label } from '../ui/Label';
import { OperationFooter } from '../ui/OperationFooter';
import { SegmentedControl } from '../ui/SegmentedControl';
import { createPdfPreparer, sheetFingerprint } from './pdfPreparer';
import type { ReportSheetLang } from './ReportSheet';
import { renderReportPdf, shareOrDownloadPdf, type PdfPageFooter, type ShareOutcome } from './reportPdf';

// The parts every report window shares: the dates, the report's language, the preview, the
// send button with what happened to the PDF, and the hidden A4 sheet the PDF is made from.

function savedLanguage(storageKey: string): ReportSheetLang | null {
    try {
        const value = localStorage.getItem(storageKey);
        return value === 'ar' || value === 'fr' ? value : null;
    }
    catch {
        return null;
    }
}
function saveLanguage(storageKey: string, lang: ReportSheetLang) {
    try {
        localStorage.setItem(storageKey, lang);
    }
    catch {
        // Private browsing: the choice is simply not remembered.
    }
}

/**
 * The language of the report, remembered per person (`storageKey`): some read French, others
 * Arabic, whatever the app's language. The app's language until a choice is made.
 */
export function useReportLanguage(storageKey: string, appLang: string): [ReportSheetLang, (lang: ReportSheetLang) => void] {
    const [lang, setLang] = useState<ReportSheetLang>(() => savedLanguage(storageKey) ?? (appLang === 'ar' ? 'ar' : 'fr'));
    const choose = (next: ReportSheetLang) => {
        setLang(next);
        saveLanguage(storageKey, next);
    };
    return [lang, choose];
}

export type ReportSendState = 'idle' | 'busy' | 'ready' | 'downloaded' | 'error';

export type ReportPdfJob = { fileName: string; title: string; footer?: PdfPageFooter };

/**
 * How long the report must stay as it is before its PDF is made in the background: a moment when
 * the window has just opened, longer once the dates or the language are being changed (each
 * change would start a capture that holds the page).
 */
const FIRST_PREPARE_DELAY_MS = 400;
const PREPARE_DELAY_MS = 1000;

/**
 * Makes the PDF from the hidden A4 sheet and shares it (or downloads it).
 *
 * `job` is the report as it is now (null: nothing to send yet). The PDF is made in the background
 * a moment after the report appears or changes, so « Envoyer » shares it at once: the browser
 * only opens the share sheet within a few seconds of the tap, and on a slow phone making the PDF
 * takes longer than that. A tap before it is ready simply waits for it. `changed()` forgets the PDF.
 */
export function useReportSender(job: ReportPdfJob | null = null) {
    const [sendState, setSendState] = useState<ReportSendState>('idle');
    const [preparer] = useState(createPdfPreparer);
    const printHolder = useRef<HTMLDivElement | null>(null);
    const latestJob = useRef(job);
    latestJob.current = job;
    const seenSheet = useRef<string | null>(null);
    const timer = useRef<number | null>(null);

    // Any change makes the prepared PDF stale.
    const changed = () => {
        preparer.invalidate();
        setSendState('idle');
    };
    const render = (sheet: HTMLElement, current: ReportPdfJob) => () => renderReportPdf(sheet, current.title, current.footer);
    const afterShare = (outcome: ShareOutcome) => setSendState(outcome === 'needsTap' ? 'ready' : outcome === 'downloaded' ? 'downloaded' : 'idle');

    // After every render: when the sheet shows something new (other dates, language, data that
    // arrived), the PDF made before is out of date, and a new one is made once it stays put.
    useEffect(() => {
        const sheet = printHolder.current?.firstElementChild;
        if (!job || !(sheet instanceof HTMLElement))
            return;
        const fingerprint = sheetFingerprint(job.fileName, job.title, sheet.textContent);
        if (fingerprint === seenSheet.current)
            return;
        const delay = seenSheet.current === null ? FIRST_PREPARE_DELAY_MS : PREPARE_DELAY_MS;
        seenSheet.current = fingerprint;
        preparer.invalidate();
        if (timer.current !== null)
            window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => {
            timer.current = null;
            const current = latestJob.current;
            const printed = printHolder.current?.firstElementChild;
            if (!current || !(printed instanceof HTMLElement))
                return;
            preparer.make(render(printed, current)).catch((error) => console.warn('The report PDF could not be prepared ahead:', error));
        }, delay);
    });
    useEffect(() => () => {
        if (timer.current !== null)
            window.clearTimeout(timer.current);
        // The window closed: a PDF still being made is not wanted.
        preparer.invalidate();
    }, [preparer]);

    const send = async (current: ReportPdfJob) => {
        if (sendState === 'busy')
            return;
        // Made already (in the background, or the browser asked for a fresh tap): share at once.
        const prepared = preparer.ready();
        if (prepared) {
            afterShare(await shareOrDownloadPdf(prepared, current.fileName, current.title));
            return;
        }
        const sheet = printHolder.current?.firstElementChild;
        if (!(sheet instanceof HTMLElement))
            return;
        setSendState('busy');
        try {
            // Let the button show its busy state before the capture holds the page.
            await new Promise((resolve) => setTimeout(resolve, 40));
            const pdf = await preparer.make(render(sheet, current));
            // null: the report changed while it was being made, nothing to share.
            if (!pdf) {
                setSendState('idle');
                return;
            }
            afterShare(await shareOrDownloadPdf(pdf, current.fileName, current.title));
        }
        catch (error) {
            console.error(error);
            setSendState('error');
        }
    };
    return { sendState, printHolder, changed, send };
}

type ReportRangePickerProps = {
    /** Ids of the two date fields: `${idPrefix}-start`, `${idPrefix}-end` */
    idPrefix: string;
    start: string;
    end: string;
    onChange: (start: string, end: string) => void;
    onThisMonth: () => void;
    onThisYear: () => void;
    onAllHistory: () => void;
    error?: string | null;
};

/** This month, this year, the whole history, or two dates. */
export function ReportRangePicker({ idPrefix, start, end, onChange, onThisMonth, onThisYear, onAllHistory, error }: ReportRangePickerProps) {
    const { t } = useLanguage();
    return (<>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Button onClick={onThisMonth} variant="outline" className="font-bold">{t('clients.reportThisMonth')}</Button>
          <Button onClick={onThisYear} variant="outline" className="font-bold">{t('clients.reportThisYear')}</Button>
          <Button onClick={onAllHistory} variant="outline" className="col-span-2 font-bold sm:col-span-1">{t('clients.reportAllHistory')}</Button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor={`${idPrefix}-start`}>{t('transactions.startDate')}</Label>
            <DatePicker id={`${idPrefix}-start`} value={start} max={end || undefined} onChange={(iso) => onChange(iso, end)} className="mt-1"/>
          </div>
          <div>
            <Label htmlFor={`${idPrefix}-end`}>{t('transactions.endDate')}</Label>
            <DatePicker id={`${idPrefix}-end`} value={end} min={start || undefined} onChange={(iso) => onChange(start, iso)} className="mt-1"/>
          </div>
        </div>
        {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}
      </>);
}

/** Arabic or French, whatever the app's language. */
export function ReportLanguagePicker({ value, onChange }: { value: ReportSheetLang; onChange: (lang: ReportSheetLang) => void }) {
    const { t } = useLanguage();
    return (<div className="flex flex-col gap-1.5">
        <p className="text-sm font-semibold leading-snug text-neutral-700">{t('clients.activityReportLanguage')}</p>
        <SegmentedControl<ReportSheetLang> size="md" ariaLabel={t('clients.activityReportLanguage') as string} value={value} onChange={onChange} options={[
            { id: 'ar', label: <span lang="ar" className="font-arabic">العربية</span> },
            { id: 'fr', label: <span lang="fr" className="font-latin">Français</span> },
        ]}/>
      </div>);
}

/** The page the reader will receive, as it will look. */
export function ReportPreview({ label, children }: { label: string; children?: ReactNode }) {
    return (<section aria-label={label} className="flex flex-col gap-2">
        <p className="text-sm font-semibold leading-snug text-neutral-700">{label}</p>
        <div className="rounded-card bg-neutral-200/60 p-2">
          {children}
        </div>
      </section>);
}

type ReportSendFooterProps = {
    sendState: ReportSendState;
    onClose: () => void;
    onSend: () => void;
    /** No send button at all (nothing to report) */
    showSend: boolean;
    /** The button is there but greyed (the dates are wrong) */
    canSend: boolean;
};

/** What happened to the PDF stays in sight above the buttons, however far the preview is scrolled. */
export function ReportSendFooter({ sendState, onClose, onSend, showSend, canSend }: ReportSendFooterProps) {
    const { t } = useLanguage();
    const sendLabel = sendState === 'busy' ? t('clients.activityReportPreparing') : t('clients.activityReportSend');
    return (<OperationFooter reason={sendState === 'ready' ? t('clients.activityReportReady') : sendState === 'downloaded' ? t('clients.activityReportDownloaded') : sendState === 'error' ? t('clients.activityReportFailed') : undefined} reasonTone={sendState === 'error' ? 'fix' : 'missing'}>
        <Button variant="outline" onClick={onClose}>{t('common.close')}</Button>
        {showSend && (<Button onClick={onSend} loading={sendState === 'busy'} disabled={!canSend}>
            {sendState !== 'busy' && <ShareIcon aria-hidden="true" className="h-4 w-4 shrink-0"/>}
            <span className="min-w-0 truncate">{sendLabel}</span>
          </Button>)}
      </OperationFooter>);
}

/** The A4 sheet the PDF is made from: laid out off screen, captured on « Envoyer ». */
export function ReportPrintHolder({ holderRef, children }: { holderRef: MutableRefObject<HTMLDivElement | null>; children?: ReactNode }) {
    return inBody(<div ref={holderRef} aria-hidden="true" className="pointer-events-none fixed top-0 -left-[20000px]">
        {children}
      </div>);
}
