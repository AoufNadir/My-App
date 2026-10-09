import type { ReactNode } from 'react';

/**
 * The look every PDF report shares since V3-5, taken from the client activity report: the paper
 * sheet, its header (logo, ProDigital, title, reference, issue date), the « for whom and when »
 * bar, cards, table cells, section titles and the footer. Elements marked data-pdf-break are where
 * a PDF page may end; table rows marked data-pdf-row are left out of the other pages' captures.
 */

export type ReportSheetLang = 'ar' | 'fr';
export type ReportSheetVariant = 'screen' | 'print';

// Unicode isolates keep a number and its unit in one piece inside an Arabic sentence.
export const isolate = (text: string) => `⁦${text}⁩`;
export const num = (text: ReactNode) => <bdi dir="ltr" className="whitespace-nowrap tabular-nums">{text}</bdi>;
// A no-break space before the dot keeps it at the end of a line when the text wraps.
export const DOT = ' · ';

/** Table cells: header, cell, number cell. */
export const reportTh = 'border-b border-border bg-surface-muted px-2 py-1.5 text-start text-[11px] font-semibold text-neutral-500';
export const reportTd = 'border-b border-border px-2 py-1.5 text-start align-top';
export const reportTdNum = `${reportTd} text-end`;

export type ReportSheetFrameProps = {
    lang: ReportSheetLang;
    /** « print »: the A4 sheet captured for the PDF (794px wide); « screen »: the preview in the window */
    variant: ReportSheetVariant;
    brandTagline: ReactNode;
    title: ReactNode;
    referenceLabel: ReactNode;
    reference: string;
    issuedLabel: ReactNode;
    issued: string;
    /** « Client », « Investisseur »… and the name under it */
    partyLabel: ReactNode;
    partyName: string;
    /** Small line above the period, and the period itself */
    periodCaption: ReactNode;
    period: ReactNode;
    footer: ReactNode;
    children: ReactNode;
};

/** Always light, like paper, whatever the app theme (`report-sheet` resets the colour tokens). */
export function ReportSheetFrame({ lang, variant, brandTagline, title, referenceLabel, reference, issuedLabel, issued, partyLabel, partyName, periodCaption, period, footer, children }: ReportSheetFrameProps) {
    const isPrint = variant === 'print';
    return (<article dir={lang === 'ar' ? 'rtl' : 'ltr'} lang={lang} className={[
            'report-sheet @container flex flex-col gap-4 bg-surface text-[13px] leading-relaxed text-neutral-900',
            lang === 'ar' ? 'font-arabic' : 'font-latin',
            isPrint ? 'w-[794px] px-11 pb-8 pt-10' : 'w-full rounded-md p-4 shadow-card',
        ].join(' ')}>
      <header data-pdf-break="" className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-primary pb-3">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="" className="h-10 w-10 rounded-md border border-border object-cover"/>
          <div className="flex flex-col leading-tight">
            <b className="font-latin text-xl tracking-wide text-primary">ProDigital</b>
            <span className="text-xs text-neutral-500">{brandTagline}</span>
          </div>
        </div>
        <div className="flex flex-col gap-0.5 text-end text-xs text-neutral-500">
          <strong className="text-base text-neutral-900">{title}</strong>
          <span>{referenceLabel} {num(reference)} · {issuedLabel} {num(issued)}</span>
        </div>
      </header>

      <div data-pdf-break="" className="flex flex-wrap justify-between gap-x-4 gap-y-2 rounded-lg bg-surface-muted px-3 py-2">
        <div className="flex min-w-0 flex-col">
          <small className="text-[11px] text-neutral-500">{partyLabel}</small>
          <b className="text-[13.5px]"><bdi>{partyName}</bdi></b>
        </div>
        <div className="flex min-w-0 flex-col">
          <small className="text-[11px] text-neutral-500">{periodCaption}</small>
          <b className="text-[13.5px]">{period}</b>
        </div>
      </div>

      {children}

      <footer data-pdf-break="" className="border-t border-border pt-2 text-[11px] text-neutral-500">{footer}</footer>
    </article>);
}

/** A section with its title, where a PDF page may end. */
export function ReportSection({ title, children }: { title: ReactNode; children: ReactNode }) {
    return (<section data-pdf-break="" className="flex flex-col gap-2">
      <p className="text-[13.5px] font-bold">{title}</p>
      {children}
    </section>);
}

export type ReportCardTone = 'primary' | 'secondary' | 'success' | 'danger' | 'neutral';
const CARD_DOT: Record<ReportCardTone, string> = {
    primary: 'bg-primary',
    secondary: 'bg-secondary',
    success: 'bg-success',
    danger: 'bg-financial-debt',
    neutral: 'bg-neutral-500',
};

/** A summary card: coloured mark and label, the big figure, then optional lines under it. */
export function ReportCard({ label, value, tone = 'neutral', valueTone, children }: { label: ReactNode; value: ReactNode; tone?: ReportCardTone; valueTone?: string; children?: ReactNode }) {
    return (<div className="flex min-w-0 flex-col gap-1 rounded-lg border border-border px-3 py-2.5">
      <span className="flex items-center gap-1.5 text-[11.5px] font-semibold text-neutral-500"><i aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-sm ${CARD_DOT[tone]}`}/>{label}</span>
      <span className={`self-start text-[19px] font-bold leading-tight ${valueTone || 'text-neutral-900'}`}>{value}</span>
      {children}
    </div>);
}
