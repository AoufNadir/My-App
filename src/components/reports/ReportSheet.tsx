import type { ReactNode } from 'react';

// The frame every report sheet is built from (client activity, investor…): the same header,
// « for whom and which period » strip, cards, section titles, tables and footer. Always light,
// like paper, whatever the app theme (`report-sheet` resets the colour tokens). Elements marked
// data-pdf-break are where a PDF page may end; rows marked data-pdf-row are left out of the other
// pages' captures (see reportPdf.ts).

export type ReportSheetLang = 'ar' | 'fr';

// Unicode isolates keep a number and its unit in one piece inside an Arabic sentence.
export const isolate = (text: string) => `\u2066${text}\u2069`;
export const num = (text: ReactNode) => <bdi dir="ltr" className="whitespace-nowrap tabular-nums">{text}</bdi>;
// A no-break space before the dot keeps it at the end of a line when the text wraps.
export const DOT = '\u00A0· ';

const td = 'border-b border-border px-2 py-1.5 text-start align-top';
/** Cells of the report tables: header, text, number. */
export const REPORT_CELL = {
    th: 'border-b border-border bg-surface-muted px-2 py-1.5 text-start text-[11px] font-semibold text-neutral-500',
    td,
    tdNum: `${td} text-end`,
};

type ReportSheetProps = {
    lang: ReportSheetLang;
    /** « print »: the A4 sheet captured for the PDF (794px wide); « screen »: the preview in the window */
    variant: 'screen' | 'print';
    children?: ReactNode;
};

export function ReportSheet({ lang, variant, children }: ReportSheetProps) {
    return (<article dir={lang === 'ar' ? 'rtl' : 'ltr'} lang={lang} className={[
            'report-sheet @container flex flex-col gap-4 bg-surface text-[13px] leading-relaxed text-neutral-900',
            lang === 'ar' ? 'font-arabic' : 'font-latin',
            variant === 'print' ? 'w-[794px] px-11 pb-8 pt-10' : 'w-full rounded-md p-4 shadow-card',
        ].join(' ')}>{children}</article>);
}

type ReportHeaderProps = {
    tagline: string;
    title: string;
    referenceLabel: string;
    reference: string;
    issuedLabel: string;
    /** Already written as a date */
    issued: string;
};

/** Logo, ProDigital, the report's name, its reference and issue date. */
export function ReportHeader({ tagline, title, referenceLabel, reference, issuedLabel, issued }: ReportHeaderProps) {
    return (<header data-pdf-break="" className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-primary pb-3">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="" className="h-10 w-10 rounded-md border border-border object-cover"/>
          <div className="flex flex-col leading-tight">
            <b className="font-latin text-xl tracking-wide text-primary">ProDigital</b>
            <span className="text-xs text-neutral-500">{tagline}</span>
          </div>
        </div>
        <div className="flex flex-col gap-0.5 text-end text-xs text-neutral-500">
          <strong className="text-base text-neutral-900">{title}</strong>
          <span>{referenceLabel} {num(reference)} · {issuedLabel} {num(issued)}</span>
        </div>
      </header>);
}

type ReportIdentityProps = {
    whoLabel: ReactNode;
    who: string;
    periodLabel: ReactNode;
    period: ReactNode;
};

/** Who the report is for, and its period. */
export function ReportIdentity({ whoLabel, who, periodLabel, period }: ReportIdentityProps) {
    return (<div data-pdf-break="" className="flex flex-wrap justify-between gap-x-4 gap-y-2 rounded-lg bg-surface-muted px-3 py-2">
        <div className="flex min-w-0 flex-col">
          <small className="text-[11px] text-neutral-500">{whoLabel}</small>
          <b className="text-[13.5px]"><bdi>{who}</bdi></b>
        </div>
        <div className="flex min-w-0 flex-col">
          <small className="text-[11px] text-neutral-500">{periodLabel}</small>
          <b className="text-[13.5px]">{period}</b>
        </div>
      </div>);
}

/** The first sentence: what the period comes to. */
export function ReportLead({ children }: { children?: ReactNode }) {
    return <p data-pdf-break="" className="rounded-lg bg-primary/5 px-3 py-2 text-[13.5px] font-semibold text-neutral-900">{children}</p>;
}

/** Cards side by side on the A4 sheet, one under the other on a phone. */
export function ReportCardGrid({ children }: { children?: ReactNode }) {
    return <div data-pdf-break="" className="grid grid-cols-1 gap-2.5 @lg:grid-cols-2">{children}</div>;
}

type ReportCardProps = {
    /** Colour of the small square before the title (a Tailwind background class) */
    dot: string;
    title: ReactNode;
    children?: ReactNode;
};

export function ReportCard({ dot, title, children }: ReportCardProps) {
    return (<div className="flex min-w-0 flex-col gap-1 rounded-lg border border-border px-3 py-2.5">
        <span className="flex items-center gap-1.5 text-[11.5px] font-semibold text-neutral-500"><i aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-sm ${dot}`}/>{title}</span>
        {children}
      </div>);
}

/** The big number of a card. */
export function ReportCardValue({ tone = '', children }: { tone?: string; children?: ReactNode }) {
    return <span className={`self-start text-[19px] font-bold leading-tight ${tone || 'text-neutral-900'}`}>{children}</span>;
}

/** A titled part of the report; a PDF page may start at its top. */
export function ReportSection({ title, children }: { title: ReactNode; children?: ReactNode }) {
    return (<section data-pdf-break="" className="flex flex-col gap-2">
        <p className="text-[13.5px] font-bold">{title}</p>
        {children}
      </section>);
}

/** A table that scrolls sideways on a narrow phone rather than squeezing its columns. */
export function ReportTable({ children }: { children?: ReactNode }) {
    return (<div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[330px] border-collapse text-xs">{children}</table>
      </div>);
}

export function ReportFooter({ children }: { children?: ReactNode }) {
    return <footer data-pdf-break="" className="border-t border-border pt-2 text-[11px] text-neutral-500">{children}</footer>;
}
