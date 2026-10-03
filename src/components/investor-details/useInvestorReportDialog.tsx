import { useState } from 'react';
import { Button } from '../ui/Button';
import { Modal, ModalContent, ModalFooter, ModalHeader, ModalTitle } from '../ui/Modal';
import { Label } from '../ui/Label';
import { DatePicker } from '../ui/DatePicker';
import { useLanguage } from '../../contexts/LanguageContext';

export type InvestorReportDateRange = {
    startTs?: number | null;
    endTs?: number | null;
};

const parseDateBoundary = (value: string, endOfDay: boolean) => {
    if (!value) return null;
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) return null;
    const date = new Date(year, month - 1, day);
    date.setHours(endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
    return date.getTime();
};
const toInputDate = (date: Date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

/**
 * The investor PDF report window, shared by the investor page and the investor's own portal:
 * current month, current year, two dates, or the whole history (no dates).
 */
export function useInvestorReportDialog(onExportReport?: (range: InvestorReportDateRange) => void) {
    const { t } = useLanguage();
    const [isOpen, setIsOpen] = useState(false);
    const [reportStartDate, setReportStartDate] = useState('');
    const [reportEndDate, setReportEndDate] = useState('');
    const [reportDateError, setReportDateError] = useState('');
    const setCurrentMonthRange = () => {
        const now = new Date();
        setReportStartDate(toInputDate(new Date(now.getFullYear(), now.getMonth(), 1)));
        setReportEndDate(toInputDate(now));
        setReportDateError('');
    };
    const setCurrentYearRange = () => {
        const now = new Date();
        setReportStartDate(`${now.getFullYear()}-01-01`);
        setReportEndDate(`${now.getFullYear()}-12-31`);
        setReportDateError('');
    };
    const clearReportRange = () => {
        setReportStartDate('');
        setReportEndDate('');
        setReportDateError('');
    };
    const open = () => {
        if (!reportStartDate && !reportEndDate) setCurrentMonthRange();
        setReportDateError('');
        setIsOpen(true);
    };
    const handleCreateReport = () => {
        const startTs = parseDateBoundary(reportStartDate, false);
        const endTs = parseDateBoundary(reportEndDate, true);
        if ((reportStartDate && startTs === null) || (reportEndDate && endTs === null)) {
            setReportDateError(t('investors.reportInvalidDate') as string);
            return;
        }
        if (startTs !== null && endTs !== null && startTs > endTs) {
            setReportDateError(t('clients.reportStartAfterEnd') as string);
            return;
        }
        onExportReport?.({ startTs, endTs });
        setIsOpen(false);
    };
    const dialog = (<Modal isOpen={isOpen} onClose={() => setIsOpen(false)} className="max-w-md bg-surface">
        <ModalHeader onClose={() => setIsOpen(false)}>
          <ModalTitle className="text-base sm:text-lg">{t('investors.reportTitle')}</ModalTitle>
        </ModalHeader>
        <ModalContent className="space-y-4 px-4 py-4 sm:px-5">
          <div className="grid grid-cols-2 gap-3">
            <Button onClick={setCurrentMonthRange} variant="outline" className="font-bold">
              {t('clients.reportThisMonth')}
            </Button>
            <Button onClick={setCurrentYearRange} variant="outline" className="font-bold">
              {t('clients.reportThisYear')}
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>{t('transactions.startDate')}</Label>
              <DatePicker value={reportStartDate} onChange={(iso) => { setReportStartDate(iso); setReportDateError(''); }} className="mt-1"/>
            </div>
            <div>
              <Label>{t('transactions.endDate')}</Label>
              <DatePicker value={reportEndDate} onChange={(iso) => { setReportEndDate(iso); setReportDateError(''); }} className="mt-1"/>
            </div>
          </div>
          {reportDateError && <p role="alert" className="text-sm font-semibold text-danger">{reportDateError}</p>}
        </ModalContent>
        <ModalFooter>
          <Button onClick={clearReportRange} variant="outline">
            {t('clients.reportAllHistory')}
          </Button>
          <Button onClick={handleCreateReport}>{t('clients.reportCreatePdf')}</Button>
        </ModalFooter>
      </Modal>);
    return { open, dialog };
}
