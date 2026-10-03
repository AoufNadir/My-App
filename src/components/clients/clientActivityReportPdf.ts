import type { ReportPeriod } from '../../utils/clientActivityReport';
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

/** File name the client sees in WhatsApp: ProDigital_2026-09.pdf, ProDigital_2026-09_S3.pdf, ProDigital_2026.pdf. */
export function reportFileName(period: ReportPeriod): string {
    const month = String(period.month + 1).padStart(2, '0');
    if (period.kind === 'year')
        return `ProDigital_${period.year}.pdf`;
    return period.kind === 'month' ? `ProDigital_${period.year}-${month}.pdf` : `ProDigital_${period.year}-${month}_S${period.week}.pdf`;
}

const canvasToJpeg = (canvas: HTMLCanvasElement, quality: number) => new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('JPEG encoding failed'))), 'image/jpeg', quality);
});

/**
 * Turns the print sheet (794px wide, laid out in the page) into a PDF: one capture of the whole
 * sheet, then one JPEG per A4 page. Runs in the browser only.
 */
export async function renderReportPdf(sheet: HTMLElement, title: string): Promise<Blob> {
    if (document.fonts?.ready)
        await document.fonts.ready;
    const { toCanvas } = await import('html-to-image');
    const width = sheet.offsetWidth || PDF_PAGE_WIDTH_PX;
    const height = sheet.scrollHeight || sheet.offsetHeight;
    // Phones refuse very large canvases: stay under their limit, sharper where there is room.
    const isMobile = /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent || '');
    const maxPixels = isMobile ? 14000000 : 24000000;
    const best = Math.min(2, Math.sqrt(maxPixels / Math.max(1, width * height)));
    const ratios = [...new Set([Number(best.toFixed(2)), 1.5, 1])].filter((ratio) => ratio <= best || ratio === 1).sort((a, b) => b - a);
    let capture: HTMLCanvasElement | null = null;
    for (const pixelRatio of ratios) {
        try {
            const canvas = await toCanvas(sheet, {
                pixelRatio,
                width,
                height,
                backgroundColor: '#ffffff',
                // The logo comes from the app's offline cache: no cache-busting query.
                cacheBust: false,
                // Technical export override: the sheet is captured where it is laid out, without offsets.
                style: { margin: '0', transform: 'none' },
            });
            if (canvas.width > 0 && canvas.height > 0) {
                capture = canvas;
                break;
            }
        }
        catch (error) {
            console.warn(`Report capture failed at ratio ${pixelRatio}:`, error);
        }
    }
    if (!capture)
        throw new Error('Report capture failed');

    const scale = capture.width / width;
    const slices = planPdfPages(height, pdfBreakPoints(sheet));
    const pageWidth = capture.width;
    const pageHeight = Math.round((pageWidth * PDF_PAGE_HEIGHT_PX) / PDF_PAGE_WIDTH_PX);
    const pages: PdfImagePage[] = [];
    for (let index = 0; index < slices.length; index++) {
        const slice = slices[index];
        const page = document.createElement('canvas');
        page.width = pageWidth;
        page.height = pageHeight;
        const context = page.getContext('2d');
        if (!context)
            throw new Error('Canvas unavailable');
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, pageWidth, pageHeight);
        const sourceTop = Math.round(slice.top * scale);
        const sourceHeight = Math.min(capture.height - sourceTop, Math.round((slice.bottom - slice.top) * scale));
        const targetTop = index === 0 ? 0 : Math.round(PDF_PAGE_MARGIN_PX * scale);
        if (sourceHeight > 0)
            context.drawImage(capture, 0, sourceTop, capture.width, sourceHeight, 0, targetTop, pageWidth, sourceHeight);
        if (slices.length > 1) {
            context.fillStyle = '#6B7280';
            context.font = `${Math.round(10 * scale)}px Inter, system-ui, sans-serif`;
            context.textAlign = 'center';
            context.fillText(`${index + 1} / ${slices.length}`, pageWidth / 2, pageHeight - Math.round(14 * scale));
        }
        const jpeg = await canvasToJpeg(page, 0.92);
        pages.push({ jpeg: new Uint8Array(await jpeg.arrayBuffer()), widthPx: pageWidth, heightPx: pageHeight });
        // Free the page's memory at once: phones run out with several large canvases alive.
        page.width = 0;
        page.height = 0;
    }
    capture.width = 0;
    capture.height = 0;
    return new Blob([buildImagePdf(pages, { title })], { type: 'application/pdf' });
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
