import { dayKey, type ReportPeriod } from '../../utils/clientActivityReport';
import { buildImagePdf, type PdfImagePage } from '../../utils/imagePdf';

/** A4 at 96 CSS px per inch: the print sheet is this wide, a page this tall. */
export const PDF_PAGE_WIDTH_PX = 794;
export const PDF_PAGE_HEIGHT_PX = 1123;
/** White space at the bottom of every page and at the top of the next ones (the sheet has its own top padding). */
export const PDF_PAGE_MARGIN_PX = 36;

export type PdfSlice = { top: number; bottom: number };

/**
 * Cuts a sheet of `height` CSS px into pages, at the last break point that fits (the top of a
 * block or of a table row), so no line of text is cut in two. A block taller than a page is cut
 * where the page ends.
 */
export function planPdfPages(height: number, breaks: ReadonlyArray<number>, pageHeight = PDF_PAGE_HEIGHT_PX, margin = PDF_PAGE_MARGIN_PX): PdfSlice[] {
    const sorted = [...breaks].sort((a, b) => a - b);
    const slices: PdfSlice[] = [];
    let top = 0;
    while (height - top > 0.5) {
        const capacity = slices.length === 0 ? pageHeight - margin : pageHeight - 2 * margin;
        if (height - top <= capacity) {
            slices.push({ top, bottom: height });
            break;
        }
        const limit = top + capacity;
        // Not too early either: a page holds at least a quarter of its height.
        const fitting = sorted.filter((point) => point > top + capacity / 4 && point <= limit);
        const bottom = fitting.length ? fitting[fitting.length - 1] : limit;
        slices.push({ top, bottom });
        top = bottom;
    }
    return slices;
}

/** Where pages may end: the top of every element marked data-pdf-break, in px from the sheet's top. */
export function pdfBreakPoints(sheet: HTMLElement): number[] {
    const origin = sheet.getBoundingClientRect().top;
    return Array.from(sheet.querySelectorAll<HTMLElement>('[data-pdf-break]'))
        .map((element) => Math.round((element.getBoundingClientRect().top - origin) * 100) / 100)
        .filter((point) => point > 0);
}

export type PdfRowBox = { top: number; bottom: number };

/** The list rows (marked data-pdf-row), in px from the sheet's top. */
export function pdfRowBoxes(sheet: HTMLElement): Array<PdfRowBox & { element: HTMLElement }> {
    const origin = sheet.getBoundingClientRect().top;
    return Array.from(sheet.querySelectorAll<HTMLElement>('[data-pdf-row]')).map((element) => {
        const rect = element.getBoundingClientRect();
        return { element, top: rect.top - origin, bottom: rect.bottom - origin };
    });
}

/**
 * What the capture of one page leaves out: the list rows above and below the page (their indexes),
 * and how far up everything after them moves once the rows above are gone. A page of a long list
 * is captured without the hundreds of rows around it.
 */
export function pageRowWindow(rows: ReadonlyArray<PdfRowBox>, slice: PdfSlice): { skip: Set<number>; shift: number } {
    const skip = new Set<number>();
    let above = 0;
    rows.forEach((row, index) => {
        if (row.bottom <= slice.top + 0.5) {
            skip.add(index);
            above = index + 1;
        }
        else if (row.top >= slice.bottom - 0.5)
            skip.add(index);
    });
    // The first row kept takes the place of the first row left out.
    const shift = above === 0 ? 0 : (above < rows.length ? rows[above].top : rows[rows.length - 1].bottom) - rows[0].top;
    return { skip, shift };
}

const pad2 = (value: number) => String(value).padStart(2, '0');

/** File name the client sees in WhatsApp: ProDigital_2026-09.pdf, ProDigital_2026.pdf, ProDigital_2026-09-15_2026-10-14.pdf. */
export function reportFileName(period: ReportPeriod): string {
    if (period.kind === 'year')
        return `ProDigital_${period.year}.pdf`;
    if (period.kind === 'month')
        return `ProDigital_${period.year}-${pad2(period.month + 1)}.pdf`;
    return `ProDigital_${dayKey(period.from)}_${dayKey(period.to)}.pdf`;
}

const canvasToJpeg = (canvas: HTMLCanvasElement, quality: number) => new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('JPEG encoding failed'))), 'image/jpeg', quality);
});

type ToCanvas = typeof import('html-to-image').toCanvas;
type CaptureOptions = NonNullable<Parameters<ToCanvas>[1]>;

/** One capture, as sharp as the phone allows: twice the CSS pixels, then less if the canvas is refused. */
async function capture(toCanvas: ToCanvas, sheet: HTMLElement, options: CaptureOptions): Promise<HTMLCanvasElement> {
    for (const pixelRatio of [2, 1.5, 1]) {
        try {
            const canvas = await toCanvas(sheet, { ...options, pixelRatio });
            if (canvas.width > 0 && canvas.height > 0)
                return canvas;
        }
        catch (error) {
            console.warn(`Report capture failed at ratio ${pixelRatio}:`, error);
        }
    }
    throw new Error('Report capture failed');
}

/**
 * Gives the list's columns the widths they have with every row, until the returned undo: a page
 * laid out with only its own rows then keeps the same columns as the others.
 */
export function freezeListColumns(sheet: HTMLElement): () => void {
    const undo: Array<() => void> = [];
    sheet.querySelectorAll<HTMLTableElement>('table').forEach((table) => {
        if (!table.querySelector('[data-pdf-row]'))
            return;
        const headers = Array.from(table.querySelectorAll<HTMLElement>('thead th'));
        const widths = headers.map((cell) => cell.getBoundingClientRect().width);
        headers.forEach((cell, index) => {
            cell.style.width = `${widths[index]}px`;
            undo.push(() => cell.style.removeProperty('width'));
        });
        table.style.tableLayout = 'fixed';
        undo.push(() => table.style.removeProperty('table-layout'));
    });
    return () => undo.forEach((step) => step());
}

/**
 * Turns the print sheet (794px wide, laid out off screen) into a PDF: one capture and one JPEG per
 * A4 page. While a page is captured, the list rows of the other pages leave the layout (the capture
 * copies every element's laid-out height, so the list must really be that short), so a long report
 * needs no canvas taller than a page and each page costs about the same. Runs in the browser only.
 */
export async function renderReportPdf(sheet: HTMLElement, title: string): Promise<Blob> {
    if (document.fonts?.ready)
        await document.fonts.ready;
    const { toCanvas, getFontEmbedCSS } = await import('html-to-image');
    const unfreeze = freezeListColumns(sheet);
    try {
        const { width, slices, rows } = planSheetPages(sheet);
        // The fonts are read once for all the pages.
        let fontEmbedCSS: string | undefined;
        try {
            fontEmbedCSS = await getFontEmbedCSS(sheet, { cacheBust: false });
        }
        catch (error) {
            console.warn('Report fonts could not be read once:', error);
        }
        const pages: PdfImagePage[] = [];
        for (let index = 0; index < slices.length; index++)
            pages.push(await renderPage(toCanvas, sheet, { width, rows, slice: slices[index], index, count: slices.length, fontEmbedCSS }));
        return new Blob([buildImagePdf(pages, { title })], { type: 'application/pdf' });
    }
    finally {
        unfreeze();
    }
}

/**
 * The pages of the sheet as laid out now, and its list rows. The sheet's own bottom padding is
 * white space: the last page may end with the footer rather than start a page for it.
 */
export function planSheetPages(sheet: HTMLElement): { width: number; slices: PdfSlice[]; rows: Array<PdfRowBox & { element: HTMLElement }> } {
    const origin = sheet.getBoundingClientRect().top;
    const full = sheet.scrollHeight || sheet.offsetHeight;
    const contentBottom = Math.max(0, ...Array.from(sheet.children).map((child) => child.getBoundingClientRect().bottom - origin));
    const height = contentBottom > 0 ? Math.min(full, Math.ceil(contentBottom)) : full;
    return { width: sheet.offsetWidth || PDF_PAGE_WIDTH_PX, slices: planPdfPages(height, pdfBreakPoints(sheet)), rows: pdfRowBoxes(sheet) };
}

type PageJob = { width: number; rows: ReadonlyArray<PdfRowBox & { element: HTMLElement }>; slice: PdfSlice; index: number; count: number; fontEmbedCSS?: string };

/** One A4 page: its part of the sheet, drawn under the top margin (from page 2), with its number. */
async function renderPage(toCanvas: ToCanvas, sheet: HTMLElement, { width, rows, slice, index, count, fontEmbedCSS }: PageJob): Promise<PdfImagePage> {
    const { skip, shift } = pageRowWindow(rows, slice);
    const away = [...skip].map((row) => rows[row].element);
    const skipped = new Set<Node>(away);
    away.forEach((element) => {
        element.style.display = 'none';
    });
    let shot: HTMLCanvasElement;
    try {
        shot = await capture(toCanvas, sheet, {
            width,
            height: slice.bottom - slice.top,
            backgroundColor: '#ffffff',
            // The logo comes from the app's offline cache: no cache-busting query.
            cacheBust: false,
            ...(fontEmbedCSS ? { fontEmbedCSS } : {}),
            filter: (node) => !skipped.has(node),
            // Technical export override: the sheet keeps its own height and is moved up to the page's first line.
            style: { margin: '0', marginTop: `${-(slice.top - shift)}px`, height: 'auto', transform: 'none' },
        });
    }
    finally {
        away.forEach((element) => element.style.removeProperty('display'));
    }
    const scale = shot.width / width;
    const pageWidth = shot.width;
    const pageHeight = Math.round((pageWidth * PDF_PAGE_HEIGHT_PX) / PDF_PAGE_WIDTH_PX);
    const page = document.createElement('canvas');
    page.width = pageWidth;
    page.height = pageHeight;
    const context = page.getContext('2d');
    if (!context)
        throw new Error('Canvas unavailable');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, pageWidth, pageHeight);
    const targetTop = index === 0 ? 0 : Math.round(PDF_PAGE_MARGIN_PX * scale);
    context.drawImage(shot, 0, 0, shot.width, shot.height, 0, targetTop, pageWidth, shot.height);
    if (count > 1) {
        context.fillStyle = '#6B7280';
        context.font = `${Math.round(10 * scale)}px Inter, system-ui, sans-serif`;
        context.textAlign = 'center';
        context.fillText(`${index + 1} / ${count}`, pageWidth / 2, pageHeight - Math.round(14 * scale));
    }
    const jpeg = await canvasToJpeg(page, 0.92);
    const result = { jpeg: new Uint8Array(await jpeg.arrayBuffer()), widthPx: pageWidth, heightPx: pageHeight };
    // Free the memory at once: phones run out with several large canvases alive.
    page.width = 0;
    page.height = 0;
    shot.width = 0;
    shot.height = 0;
    return result;
}

export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled' | 'needsTap';

/**
 * Opens the phone's share sheet (WhatsApp, e-mail…) with the PDF, or downloads it where sharing
 * files is not possible. 'needsTap': the browser wants a fresh tap before sharing (preparing the
 * file took too long), the caller offers a button that calls this again.
 */
export async function shareOrDownloadPdf(blob: Blob, fileName: string, title: string): Promise<ShareOutcome> {
    if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare && typeof File !== 'undefined') {
        const file = new File([blob], fileName, { type: 'application/pdf' });
        if (navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({ files: [file], title });
                return 'shared';
            }
            catch (error) {
                const name = (error as { name?: string } | null)?.name;
                if (name === 'AbortError')
                    return 'cancelled';
                if (name === 'NotAllowedError')
                    return 'needsTap';
                console.warn('Sharing the report failed:', error);
            }
        }
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    return 'downloaded';
}
