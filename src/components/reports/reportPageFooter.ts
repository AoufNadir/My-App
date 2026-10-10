import { formatDate } from './reportFormat';
import type { PdfPageFooter } from './reportPdf';
import type { ReportSheetLang } from './ReportSheet';

const PAGE_WORDS: Record<ReportSheetLang, { page: (page: number, count: number) => string; issued: string; reference: string }> = {
    ar: { page: (page, count) => `صفحة ${page} من ${count}`, issued: 'صدر في', reference: 'رقم' },
    fr: { page: (page, count) => `Page ${page} sur ${count}`, issued: 'Émis le', reference: 'N°' },
};

/** Under every page of a long report: « صفحة 1 من 2 · صدر في 09/10/2026 · رقم R-202609-AB12 ». */
export function reportPageFooter(lang: ReportSheetLang, issuedAt: number, reference: string): PdfPageFooter {
    const words = PAGE_WORDS[lang];
    return { lang, text: (page, count) => `${words.page(page, count)} · ${words.issued} ${formatDate(issuedAt)} · ${words.reference} ${reference}` };
}
