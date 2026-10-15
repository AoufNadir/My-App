import type { ReportSheetLang } from './ReportSheet';

// The language chosen for a person's documents is remembered on the device (`storageKey`), so the
// report windows and the WhatsApp messages of a client speak the language that client reads.

export function savedReportLanguage(storageKey: string): ReportSheetLang | null {
    try {
        const value = localStorage.getItem(storageKey);
        return value === 'ar' || value === 'fr' ? value : null;
    }
    catch {
        return null;
    }
}
export function saveReportLanguage(storageKey: string, lang: ReportSheetLang) {
    try {
        localStorage.setItem(storageKey, lang);
    }
    catch {
        // Private browsing: the choice is simply not remembered.
    }
}
/** One key per client, shared by the summary image, the activity report and the WhatsApp messages. */
export const clientReportLanguageKey = (clientId: string) => `client_report_lang_${clientId}`;
/**
 * What is sent to a client is in Arabic until that client has a remembered language, whatever
 * the language of the app: the owner may work in French while most clients read Arabic.
 */
export const CLIENT_DEFAULT_LANGUAGE: ReportSheetLang = 'ar';
export const clientReportLanguage = (clientId: string): ReportSheetLang => savedReportLanguage(clientReportLanguageKey(clientId)) ?? CLIENT_DEFAULT_LANGUAGE;
