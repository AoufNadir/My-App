import type { ReactNode } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { Modal, ModalContent, ModalHeader, ModalTitle } from '../ui/Modal';
import { ReportLanguagePicker, ReportPreview, ReportPrintHolder, ReportSendFooter, useReportLanguage, useReportSender } from './ReportDialogParts';
import type { ReportSheetLang } from './ReportSheet';
import { reportPageFooter } from './reportPageFooter';

export type ReportDocumentDialogProps = {
    onClose: () => void;
    /** The window's title and what it is about, in the app's language */
    title: string;
    subtitle?: string;
    /** Where the report's language is remembered (one per kind of report) */
    languageKey: string;
    /** Name of the PDF file */
    fileName: string;
    /** Name of the PDF in the share sheet, in the report's language */
    pdfTitle: (lang: ReportSheetLang) => string;
    /** For the line under every page of a long PDF */
    issuedAt: number;
    reference: string;
    /** The report's sheet in the language and for the place it is shown in (the preview or the A4 sheet the PDF is made from) */
    renderSheet: (lang: ReportSheetLang, variant: 'screen' | 'print') => ReactNode;
    /** Nothing to report: no send button */
    empty?: boolean;
    /** Choices above the language, when the report has some */
    children?: ReactNode;
};

/**
 * The window of the reports that have no dates to choose (monthly, expenses, treasury, lists): the
 * report's language, the preview as the reader will see it, and « Envoyer » that shares the PDF,
 * made in the background as soon as the window is open. Read-only: nothing is written anywhere.
 */
export function ReportDocumentDialog({ onClose, title, subtitle, languageKey, fileName, pdfTitle, issuedAt, reference, renderSheet, empty = false, children }: ReportDocumentDialogProps) {
    const { t, lang: appLang } = useLanguage();
    const [reportLang, setReportLang] = useReportLanguage(languageKey, appLang);
    const job = empty ? null : { fileName, title: pdfTitle(reportLang), footer: reportPageFooter(reportLang, issuedAt, reference) };
    const { sendState, progress, printHolder, changed, send } = useReportSender(job);
    const handleSend = () => {
        if (job)
            void send(job);
    };
    return (<Modal isOpen onClose={onClose} className="max-w-lg bg-surface">
      <ModalHeader onClose={onClose}>
        <ModalTitle className="text-base sm:text-lg">{title}</ModalTitle>
        {subtitle && <p className="truncate text-[13px] text-neutral-500">{subtitle}</p>}
      </ModalHeader>
      <ModalContent className="flex flex-col gap-4 px-4 py-4 sm:px-5">
        {children}
        <ReportLanguagePicker value={reportLang} onChange={(id) => { setReportLang(id); changed(); }}/>
        <ReportPreview label={t('reports.preview') as string}>
          {renderSheet(reportLang, 'screen')}
        </ReportPreview>
      </ModalContent>
      <ReportSendFooter sendState={sendState} progress={progress} onClose={onClose} onSend={handleSend} showSend canSend={!empty}/>
      <ReportPrintHolder holderRef={printHolder}>
        {renderSheet(reportLang, 'print')}
      </ReportPrintHolder>
    </Modal>);
}
