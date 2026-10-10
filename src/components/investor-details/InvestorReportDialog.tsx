import { useDeferredValue, useMemo, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { dayKey, parseDayKey } from '../../utils/clientActivityReport';
import { buildInvestorReport, investorReportFileName, type InvestorReportDateRange, type PreparedInvestorReport } from '../../utils/investorReport';
import { Modal, ModalContent, ModalHeader, ModalTitle } from '../ui/Modal';
import { ReportLanguagePicker, ReportPreview, ReportPrintHolder, ReportRangePicker, ReportSendFooter, useReportLanguage, useReportSender } from '../reports/ReportDialogParts';
import { reportPageFooter } from '../reports/reportPageFooter';
import { InvestorReportSheet } from './InvestorReportSheet';
import { INVESTOR_REPORT_WORDS } from './investorReportText';

export type InvestorReportDialogProps = {
    onClose: () => void;
    investorId: string;
    investorName: string;
    /** The report's numbers for a period (useReportExports' prepareInvestorReport) */
    prepareReport: (investorId: string, range: InvestorReportDateRange) => PreparedInvestorReport;
    /** Days the window opens on (YYYY-MM-DD, either may be empty); this month to today otherwise */
    initialRange?: { start: string; end: string };
    /** For tests and screenshots; the time the window opened otherwise */
    now?: number;
};

/**
 * The investor report, from the investor page and from the investor's own portal: this month,
 * this year, the whole history or two dates (either may be left empty), the report's language,
 * preview, send as a PDF from the phone. Read-only: nothing is written anywhere.
 */
export function InvestorReportDialog({ onClose, investorId, investorName, prepareReport, initialRange, now: fixedNow }: InvestorReportDialogProps) {
    const { t, lang: appLang } = useLanguage();
    // Fixed while the window is open, so « today » and the PDF agree.
    const [now] = useState(() => fixedNow ?? Date.now());
    const today = dayKey(now);
    const firstOfMonth = dayKey(new Date(new Date(now).getFullYear(), new Date(now).getMonth(), 1).getTime());
    const [range, setRange] = useState(() => initialRange ?? { start: firstOfMonth, end: today });
    // No start: from the first operation; no end: to today (as the old report).
    const startTs = range.start ? parseDayKey(range.start, false) : null;
    const endTs = range.end ? parseDayKey(range.end, true) : null;
    const dateError = (range.start && startTs === null) || (range.end && endTs === null)
        ? t('investors.reportInvalidDate')
        : startTs !== null && endTs !== null && startTs > endTs ? t('clients.reportStartAfterEnd') : null;
    // Some investors read French, others Arabic: remembered per investor.
    const [reportLang, setReportLang] = useReportLanguage(`investor_report_lang_${investorId}`, appLang);

    // The numbers follow the dates a moment later, so the date fields answer at once on a slow
    // phone; until they catch up, the report shown is the previous one and cannot be sent.
    const shownStartTs = useDeferredValue(startTs);
    const shownEndTs = useDeferredValue(endTs);
    const shownError = useDeferredValue(dateError);
    const catchingUp = shownStartTs !== startTs || shownEndTs !== endTs || shownError !== dateError;
    const prepared = useMemo(() => (shownError ? null : prepareReport(investorId, { startTs: shownStartTs, endTs: shownEndTs })), [shownError, prepareReport, investorId, shownStartTs, shownEndTs]);
    const report = useMemo(() => (prepared?.ok ? buildInvestorReport(prepared.input, now) : null), [prepared, now]);
    const notFound = prepared && !prepared.ok ? t(prepared.reason === 'notFoundAtClose' ? 'investors.reportNotFoundAtClose' : 'investors.reportNotFound') : null;

    // Nothing is sent, or made ahead, while the report is catching up with the dates.
    const job = report && !catchingUp ? {
        fileName: investorReportFileName(report),
        title: `${INVESTOR_REPORT_WORDS[reportLang].title} · ${investorName}`,
        footer: reportPageFooter(reportLang, report.issuedAt, report.reference),
    } : null;
    // The PDF is made in the background once the report is on screen: « Envoyer » only shares it.
    const { sendState, printHolder, changed, send } = useReportSender(job);

    const choose = (start: string, end: string) => {
        setRange({ start, end });
        changed();
    };

    const handleSend = () => {
        if (job)
            void send(job);
    };

    return (<Modal isOpen onClose={onClose} className="max-w-lg bg-surface">
      <ModalHeader onClose={onClose}>
        <ModalTitle className="text-base sm:text-lg">{t('investors.reportTitle')}</ModalTitle>
        <p className="truncate text-[13px] text-neutral-500">{investorName}</p>
      </ModalHeader>
      <ModalContent className="flex flex-col gap-4 px-4 py-4 sm:px-5">
        <ReportRangePicker idPrefix="investor-report" start={range.start} end={range.end} onChange={choose} onThisMonth={() => choose(firstOfMonth, today)} onThisYear={() => choose(`${new Date(now).getFullYear()}-01-01`, today)} onAllHistory={() => choose('', '')} error={dateError}/>
        <ReportLanguagePicker value={reportLang} onChange={(id) => { setReportLang(id); changed(); }}/>
        {notFound && <p role="alert" className="text-sm font-semibold text-danger">{notFound}</p>}
        {report && (<ReportPreview label={t('investors.reportPreview') as string}>
            <InvestorReportSheet report={report} lang={reportLang} variant="screen"/>
          </ReportPreview>)}
      </ModalContent>
      <ReportSendFooter sendState={sendState} onClose={onClose} onSend={handleSend} showSend canSend={Boolean(report) && !catchingUp}/>
      {report && (<ReportPrintHolder holderRef={printHolder}>
          <InvestorReportSheet report={report} lang={reportLang} variant="print"/>
        </ReportPrintHolder>)}
    </Modal>);
}
