import { lazy, Suspense, useState } from 'react';
import type { InvestorReportDateRange, PreparedInvestorReport } from '../../utils/investorReport';

export type { InvestorReportDateRange };

// Loaded on the first tap: the report, its PDF writer and html-to-image stay out of the page.
const InvestorReportDialog = lazy(() => import('./InvestorReportDialog').then((module) => ({ default: module.InvestorReportDialog })));

type UseInvestorReportDialogArgs = {
    investorId: string;
    investorName: string;
    /** The report's numbers for a period; without it the window does not open */
    prepareReport?: (investorId: string, range: InvestorReportDateRange) => PreparedInvestorReport;
};

/**
 * The investor report window, shared by the investor page and the investor's own portal:
 * this month, this year, the whole history or two dates, then a preview and a PDF to send.
 */
export function useInvestorReportDialog({ investorId, investorName, prepareReport }: UseInvestorReportDialogArgs) {
    const [isOpen, setIsOpen] = useState(false);
    const open = () => setIsOpen(true);
    const dialog = isOpen && prepareReport
        ? (<Suspense fallback={null}>
            <InvestorReportDialog onClose={() => setIsOpen(false)} investorId={investorId} investorName={investorName} prepareReport={prepareReport}/>
          </Suspense>)
        : null;
    return { open, dialog };
}
