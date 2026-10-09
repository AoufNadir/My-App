import { dayKey, type ReportPeriod } from '../../utils/clientActivityReport';

// The PDF engine is shared by every report since V3-5; the client report only names its file.
export * from '../reports/reportPdf';

const pad2 = (value: number) => String(value).padStart(2, '0');

/** File name the client sees in WhatsApp: ProDigital_2026-09.pdf, ProDigital_2026.pdf, ProDigital_2026-09-15_2026-10-14.pdf. */
export function reportFileName(period: ReportPeriod): string {
    if (period.kind === 'year')
        return `ProDigital_${period.year}.pdf`;
    if (period.kind === 'month')
        return `ProDigital_${period.year}-${pad2(period.month + 1)}.pdf`;
    return `ProDigital_${dayKey(period.from)}_${dayKey(period.to)}.pdf`;
}
