// M5: the name and logo printed at the top of every report. A business that set its own (settings > business)
// gets them; any other keeps ProDigital and the app logo, as before.
export type ReportIdentity = { name: string; logo: string };
export const DEFAULT_REPORT_IDENTITY: ReportIdentity = { name: 'ProDigital', logo: '/logo.png' };
let current: ReportIdentity = DEFAULT_REPORT_IDENTITY;

export function setReportIdentity(input: { businessName?: string | null; logo?: string | null } | null): void {
    current = {
        name: input?.businessName?.trim() || DEFAULT_REPORT_IDENTITY.name,
        logo: input?.logo || DEFAULT_REPORT_IDENTITY.logo,
    };
}
export const reportIdentity = (): ReportIdentity => current;
