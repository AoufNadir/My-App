import { buildImagePdf, type PdfImagePage } from '../../utils/imagePdf';

// The PDF of every report: a print sheet laid out off screen (794px wide), cut into A4 pages
// between blocks and table rows, one image per page, then shared from the phone.

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
 * is captured without the hundreds of rows around it. A sheet may hold several lists (the monthly
 * report has four): only the rows themselves leave the layout, not the titles between the lists.
 */
export function pageRowWindow(rows: ReadonlyArray<PdfRowBox>, slice: PdfSlice): { skip: Set<number>; shift: number } {
    const skip = new Set<number>();
    let shift = 0;
    rows.forEach((row, index) => {
        if (row.bottom <= slice.top + 0.5) {
            skip.add(index);
            shift += row.bottom - row.top;
        }
        else if (row.top >= slice.bottom - 0.5)
            skip.add(index);
    });
    return { skip, shift };
}

const canvasToJpeg = (canvas: HTMLCanvasElement, quality: number) => new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('JPEG encoding failed'))), 'image/jpeg', quality);
});

type ToCanvas = typeof import('html-to-image').toCanvas;
type CaptureOptions = NonNullable<Parameters<ToCanvas>[1]>;

/**
 * The CSS properties the capture copies onto every element it draws. By default html-to-image
 * copies all of them (about 350 per element): a page of a long list became a 10 MB picture of
 * styles that took seconds to read back. The report sheets use only these, so a page is a third
 * of the size and about a third faster, with the very same pixels (checked on every report).
 */
export const CAPTURE_STYLE_PROPERTIES: ReadonlyArray<string> = [
    'display', 'position', 'top', 'right', 'bottom', 'left', 'float', 'clear', 'z-index', 'box-sizing', 'visibility',
    'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height', 'aspect-ratio',
    'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
    'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
    'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
    'border-top-left-radius', 'border-top-right-radius', 'border-bottom-left-radius', 'border-bottom-right-radius',
    'border-collapse', 'border-spacing', 'table-layout', 'caption-side', 'empty-cells', 'vertical-align',
    'color', 'background-color', 'background-image', 'background-size', 'background-position', 'background-repeat', 'opacity', 'box-shadow',
    'font-family', 'font-size', 'font-weight', 'font-style', 'font-variant-numeric', 'font-variant-ligatures', 'font-feature-settings', 'font-kerning', 'font-variation-settings',
    'line-height', 'letter-spacing', 'word-spacing', 'text-align', 'text-align-last', 'text-indent', 'text-transform',
    'text-decoration-line', 'text-decoration-color', 'text-decoration-style', 'text-overflow', 'text-wrap',
    'white-space', 'word-break', 'overflow-wrap', 'overflow-x', 'overflow-y', 'direction', 'unicode-bidi', 'writing-mode',
    'flex-direction', 'flex-wrap', 'flex-grow', 'flex-shrink', 'flex-basis', 'align-items', 'align-self', 'align-content',
    'justify-content', 'justify-items', 'justify-self', 'gap', 'row-gap', 'column-gap', 'order',
    'grid-template-columns', 'grid-template-rows', 'grid-column-start', 'grid-column-end', 'grid-row-start', 'grid-row-end', 'grid-auto-flow', 'grid-auto-columns', 'grid-auto-rows',
    'object-fit', 'list-style-type', 'list-style-position', 'transform', 'transform-origin', 'fill', 'stroke', 'stroke-width',
];

/** One capture, as sharp as the phone allows: twice the CSS pixels (or `ratios`), then less if the canvas is refused. */
async function capture(toCanvas: ToCanvas, sheet: HTMLElement, options: CaptureOptions, ratios: ReadonlyArray<number> = [2, 1.5, 1]): Promise<HTMLCanvasElement> {
    for (const pixelRatio of ratios) {
        try {
            const canvas = await toCanvas(sheet, { includeStyleProperties: [...CAPTURE_STYLE_PROPERTIES], ...options, pixelRatio });
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
 * The screen lets a wide table scroll inside its box. A capture has no scrollbar to show, but the
 * copy it draws can be a fraction of a pixel taller than the box and then draws one (and cuts the
 * last column and row). So during the capture a box that only differs by a hair clips the hair; a
 * table really wider than its box is left to show all of itself rather than be cut.
 */
export function releaseTableScroll(sheet: HTMLElement): () => void {
    const undo: Array<() => void> = [];
    sheet.querySelectorAll<HTMLTableElement>('table').forEach((table) => {
        const box = table.parentElement;
        if (!box)
            return;
        box.style.overflow = box.scrollWidth - box.clientWidth > 2 ? 'visible' : 'hidden';
        undo.push(() => box.style.removeProperty('overflow'));
    });
    return () => undo.forEach((step) => step());
}

/** The line under every page of a report longer than one page, in the report's language. */
export type PdfPageFooter = {
    lang: 'ar' | 'fr';
    /** « صفحة 1 من 2 · صدر في … · رقم … » */
    text: (page: number, count: number) => string;
};

/**
 * Turns the print sheet (794px wide, laid out off screen) into a PDF: one capture and one JPEG per
 * A4 page. While a page is captured, the list rows of the other pages leave the layout (the capture
 * copies every element's laid-out height, so the list must really be that short), so a long report
 * needs no canvas taller than a page and each page costs about the same. Runs in the browser only.
 */
export async function renderReportPdf(sheet: HTMLElement, title: string, footer?: PdfPageFooter, onProgress?: (done: number, count: number) => void): Promise<Blob> {
    if (document.fonts?.ready)
        await document.fonts.ready;
    const { toCanvas, getFontEmbedCSS } = await import('html-to-image');
    const unfreeze = freezeListColumns(sheet);
    const unrelease = releaseTableScroll(sheet);
    let away = rowsAway([]);
    try {
        const { width, slices, rows } = planSheetPages(sheet);
        away = rowsAway(rows);
        // The fonts are read once for all the pages.
        let fontEmbedCSS: string | undefined;
        try {
            fontEmbedCSS = await getFontEmbedCSS(sheet, { cacheBust: false });
        }
        catch (error) {
            console.warn('Report fonts could not be read once:', error);
        }
        const pages: PdfImagePage[] = [];
        for (let index = 0; index < slices.length; index++) {
            pages.push(await renderPage(toCanvas, sheet, { width, rows, slice: slices[index], index, count: slices.length, fontEmbedCSS, footer, away }));
            onProgress?.(index + 1, slices.length);
        }
        return new Blob([buildImagePdf(pages, { title })], { type: 'application/pdf' });
    }
    finally {
        away.restore();
        unrelease();
        unfreeze();
    }
}

/**
 * The list rows that are out of the layout while a page is captured. A page shows and hides only
 * the rows that change from the page before, and all come back at the end: laying a table of
 * a thousand rows out again on every page cost more than half a second each time.
 */
export function rowsAway(rows: ReadonlyArray<{ element: HTMLElement }>) {
    const hidden = new Set<number>();
    return {
        /** Hides exactly these rows, and returns their elements (what the capture must leave out). */
        set(skip: ReadonlySet<number>): Set<Node> {
            for (const row of [...hidden]) {
                if (!skip.has(row)) {
                    rows[row].element.style.removeProperty('display');
                    hidden.delete(row);
                }
            }
            for (const row of skip) {
                if (!hidden.has(row)) {
                    rows[row].element.style.display = 'none';
                    hidden.add(row);
                }
            }
            return new Set<Node>([...hidden].map((row) => rows[row].element));
        },
        restore() {
            this.set(new Set());
        },
    };
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

type PageJob = { width: number; rows: ReadonlyArray<PdfRowBox & { element: HTMLElement }>; slice: PdfSlice; index: number; count: number; fontEmbedCSS?: string; footer?: PdfPageFooter; away: ReturnType<typeof rowsAway> };

/** What is written under a page: its number, and with the report's words its issue date and reference. */
export function pdfPageFooterText(index: number, count: number, footer?: PdfPageFooter): string {
    return footer ? footer.text(index + 1, count) : `${index + 1} / ${count}`;
}

/** One A4 page: its part of the sheet, drawn under the top margin (from page 2), with its number. */
async function renderPage(toCanvas: ToCanvas, sheet: HTMLElement, { width, rows, slice, index, count, fontEmbedCSS, footer, away }: PageJob): Promise<PdfImagePage> {
    const { skip, shift } = pageRowWindow(rows, slice);
    const skipped = away.set(skip);
    const shot = await capture(toCanvas, sheet, {
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
        // The sheet's own fonts: Cairo for Arabic, Inter for the numbers and French.
        context.font = `${Math.round(10 * scale)}px ${footer?.lang === 'ar' ? 'Cairo, ' : ''}Inter, system-ui, sans-serif`;
        context.direction = footer?.lang === 'ar' ? 'rtl' : 'ltr';
        context.textAlign = 'center';
        context.fillText(pdfPageFooterText(index, count, footer), pageWidth / 2, pageHeight - Math.round(14 * scale));
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

/**
 * A short sheet (the client summary) as one PNG picture, at three times its CSS size: 1.26
 * thousand pixels wide for the 420px phone sheet, as sharp as a phone screen and light to send.
 * Runs in the browser only.
 */
export async function renderSheetImage(sheet: HTMLElement): Promise<Blob> {
    if (document.fonts?.ready)
        await document.fonts.ready;
    const { toCanvas } = await import('html-to-image');
    const canvas = await capture(toCanvas, sheet, {
        width: sheet.offsetWidth || PDF_PAGE_WIDTH_PX,
        height: sheet.scrollHeight || sheet.offsetHeight,
        backgroundColor: '#ffffff',
        // The logo comes from the app's offline cache: no cache-busting query.
        cacheBust: false,
        style: { margin: '0', transform: 'none' },
    }, [3, 2, 1]);
    const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((png) => (png ? resolve(png) : reject(new Error('PNG encoding failed'))), 'image/png');
    });
    canvas.width = 0;
    canvas.height = 0;
    return blob;
}

export type ShareOutcome ='shared' | 'downloaded' | 'cancelled' | 'needsTap';

/**
 * Opens the phone's share sheet (WhatsApp, e-mail…) with the PDF, or downloads it where sharing
 * files is not possible. 'needsTap': the browser wants a fresh tap before sharing (preparing the
 * file took too long), the caller offers a button that calls this again.
 */
export async function shareOrDownloadPdf(blob: Blob, fileName: string, title: string): Promise<ShareOutcome> {
    return shareOrDownloadFile(blob, fileName, title, 'application/pdf');
}

/** The same for any file, a PDF or a picture. */
export async function shareOrDownloadFile(blob: Blob, fileName: string, title: string, type: string): Promise<ShareOutcome> {
    if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare && typeof File !== 'undefined') {
        const file = new File([blob], fileName, { type });
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
