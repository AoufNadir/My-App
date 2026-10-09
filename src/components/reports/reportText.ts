import type { ReportSheetLang } from './ReportSheet';

/**
 * Under each page of a multi-page PDF, in the report's language (V3-5):
 * « Page 1 sur 2 · Émis le 03/10/2026 · Réf. R-202609-AB12 ».
 */
export function reportPageLabel(lang: ReportSheetLang, page: number, count: number, issued: string, reference: string): string {
    return lang === 'ar'
        ? `صفحة ${page} من ${count} · صدر في ⁦${issued}⁩ · المرجع ⁦${reference}⁩`
        : `Page ${page} sur ${count} · Émis le ${issued} · Réf. ${reference}`;
}
