/**
 * Minimal PDF writer: one JPEG image per page, drawn over the whole page.
 *
 * Enough for documents rendered to images in the browser (the client activity report), without a
 * PDF library. Page size is A4 portrait by default; each image is stretched to the page, so it
 * must have the page's proportions.
 */

export type PdfImagePage = {
    /** JPEG file bytes (baseline, RGB: what canvas.toBlob('image/jpeg') gives) */
    jpeg: Uint8Array;
    widthPx: number;
    heightPx: number;
};

export type ImagePdfOptions = {
    title?: string;
    /** Page size in PDF points (1/72 inch); A4 when omitted */
    pageWidthPt?: number;
    pageHeightPt?: number;
    /** For the document information; now when omitted */
    createdAt?: Date;
};

export const A4_WIDTH_PT = 595.28;
export const A4_HEIGHT_PT = 841.89;

const ascii = (text: string) => {
    const bytes = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++)
        bytes[i] = text.charCodeAt(i) & 0xff;
    return bytes;
};

/** A text string in UTF-16BE with a byte order mark, written in hex: any language, ASCII-safe. */
function pdfTextString(text: string): string {
    let hex = 'FEFF';
    for (let i = 0; i < text.length; i++)
        hex += text.charCodeAt(i).toString(16).padStart(4, '0').toUpperCase();
    return `<${hex}>`;
}

const pad2 = (value: number) => String(value).padStart(2, '0');
function pdfDate(date: Date): string {
    return `D:${date.getUTCFullYear()}${pad2(date.getUTCMonth() + 1)}${pad2(date.getUTCDate())}${pad2(date.getUTCHours())}${pad2(date.getUTCMinutes())}${pad2(date.getUTCSeconds())}Z`;
}

const pt = (value: number) => (Math.round(value * 100) / 100).toString();

export function buildImagePdf(pages: ReadonlyArray<PdfImagePage>, options: ImagePdfOptions = {}): Uint8Array {
    if (pages.length === 0)
        throw new Error('A PDF needs at least one page');
    const width = options.pageWidthPt ?? A4_WIDTH_PT;
    const height = options.pageHeightPt ?? A4_HEIGHT_PT;

    // Object numbers: 1 catalog, 2 page tree, then three per page (page, image, content), then info.
    const pageObject = (index: number) => 3 + index * 3;
    const infoObject = 3 + pages.length * 3;
    const objectCount = infoObject;

    const chunks: Uint8Array[] = [];
    const offsets: number[] = new Array(objectCount + 1).fill(0);
    let length = 0;
    const write = (part: string | Uint8Array) => {
        const bytes = typeof part === 'string' ? ascii(part) : part;
        chunks.push(bytes);
        length += bytes.length;
    };
    const object = (id: number, body: string) => {
        offsets[id] = length;
        write(`${id} 0 obj\n${body}\nendobj\n`);
    };
    const streamObject = (id: number, dictionary: string, data: Uint8Array) => {
        offsets[id] = length;
        write(`${id} 0 obj\n<< ${dictionary} /Length ${data.length} >>\nstream\n`);
        write(data);
        write('\nendstream\nendobj\n');
    };

    // Header; the second line's bytes above 127 mark the file as binary.
    write('%PDF-1.4\n');
    write(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

    object(1, '<< /Type /Catalog /Pages 2 0 R >>');
    object(2, `<< /Type /Pages /Kids [${pages.map((_, index) => `${pageObject(index)} 0 R`).join(' ')}] /Count ${pages.length} >>`);
    pages.forEach((page, index) => {
        const pageId = pageObject(index);
        const imageId = pageId + 1;
        const contentId = pageId + 2;
        object(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pt(width)} ${pt(height)}] /Resources << /XObject << /Im0 ${imageId} 0 R >> /ProcSet [/PDF /ImageC] >> /Contents ${contentId} 0 R >>`);
        streamObject(imageId, `/Type /XObject /Subtype /Image /Width ${Math.round(page.widthPx)} /Height ${Math.round(page.heightPx)} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`, page.jpeg);
        streamObject(contentId, '', ascii(`q ${pt(width)} 0 0 ${pt(height)} 0 0 cm /Im0 Do Q`));
    });
    const info = [`/Producer ${pdfTextString('ProDigital')}`, `/CreationDate (${pdfDate(options.createdAt ?? new Date())})`];
    if (options.title)
        info.unshift(`/Title ${pdfTextString(options.title)}`);
    object(infoObject, `<< ${info.join(' ')} >>`);

    // Cross-reference table: every entry is exactly 20 bytes.
    const xrefOffset = length;
    let xref = `xref\n0 ${objectCount + 1}\n0000000000 65535 f \n`;
    for (let id = 1; id <= objectCount; id++)
        xref += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
    write(xref);
    write(`trailer\n<< /Size ${objectCount + 1} /Root 1 0 R /Info ${infoObject} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

    const pdf = new Uint8Array(length);
    let position = 0;
    for (const chunk of chunks) {
        pdf.set(chunk, position);
        position += chunk.length;
    }
    return pdf;
}
