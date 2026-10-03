import assert from 'node:assert/strict';

import { A4_HEIGHT_PT, A4_WIDTH_PT, buildImagePdf } from './imagePdf';

// Image bytes cover every byte value, so a byte that looks like PDF syntax cannot break the file.
const fakeJpeg = (seed: number, size: number) => Uint8Array.from({ length: size }, (_, index) => (index * 7 + seed) % 256);
const pages = [
    { jpeg: fakeJpeg(1, 1000), widthPx: 1588, heightPx: 2246 },
    { jpeg: fakeJpeg(2, 777), widthPx: 1588, heightPx: 2246 },
];
const title = 'تقرير النشاط الشهري · Atlas';
const pdf = buildImagePdf(pages, { title, createdAt: new Date(Date.UTC(2026, 9, 3, 17, 0, 0)) });
const text = Buffer.from(pdf).toString('latin1');

assert.ok(text.startsWith('%PDF-1.4\n'), 'PDF header');
assert.ok(text.endsWith('%%EOF\n'), 'PDF trailer');

// startxref points at the cross-reference table, and every entry points at its object.
const startxref = Number(/startxref\n(\d+)\n%%EOF\n$/.exec(text)?.[1]);
assert.equal(text.slice(startxref, startxref + 5), 'xref\n', 'startxref points at the xref table');
const size = Number(/\/Size (\d+)/.exec(text)?.[1]);
assert.equal(size, 1 + 2 + pages.length * 3 + 1, 'catalog, page tree, three objects per page, info, and the free entry');
const header = `xref\n0 ${size}\n`;
assert.equal(text.slice(startxref, startxref + header.length), header);
const entries = text.slice(startxref + header.length, startxref + header.length + size * 20);
assert.equal(entries.slice(0, 20), '0000000000 65535 f \n', 'Entry 0 is the free head');
for (let id = 1; id < size; id++) {
    const entry = entries.slice(id * 20, id * 20 + 20);
    assert.match(entry, /^\d{10} 00000 n \n$/, `xref entry ${id} is 20 bytes`);
    const offset = Number(entry.slice(0, 10));
    assert.equal(text.slice(offset, offset + `${id} 0 obj`.length), `${id} 0 obj`, `xref entry ${id} points at object ${id}`);
}

// Pages, images and their bytes.
assert.match(text, /\/Type \/Pages \/Kids \[3 0 R 6 0 R\] \/Count 2/);
assert.equal((text.match(/\/Type \/Page /g) || []).length, 2);
assert.ok(text.includes(`/MediaBox [0 0 ${A4_WIDTH_PT} ${A4_HEIGHT_PT}]`), 'A4 portrait');
pages.forEach((page, index) => {
    const imageId = 4 + index * 3;
    const start = text.indexOf(`${imageId} 0 obj\n`);
    const dictionary = text.slice(start, text.indexOf('stream\n', start));
    assert.ok(dictionary.includes('/Subtype /Image') && dictionary.includes('/Filter /DCTDecode'), 'JPEG image object');
    assert.ok(dictionary.includes(`/Width ${page.widthPx} /Height ${page.heightPx}`));
    assert.ok(dictionary.includes(`/Length ${page.jpeg.length}`), 'The stream length is the JPEG size');
    const dataStart = text.indexOf('stream\n', start) + 'stream\n'.length;
    assert.deepEqual(pdf.slice(dataStart, dataStart + page.jpeg.length), page.jpeg, 'The JPEG bytes are copied as they are');
    assert.equal(text.slice(dataStart + page.jpeg.length, dataStart + page.jpeg.length + '\nendstream'.length), '\nendstream');
});
assert.ok(text.includes(`q ${A4_WIDTH_PT} 0 0 ${A4_HEIGHT_PT} 0 0 cm /Im0 Do Q`), 'The image covers the whole page');

// The title is UTF-16BE: Arabic survives.
const hex = /\/Title <FEFF([0-9A-F]+)>/.exec(text)?.[1] || '';
const decoded = String.fromCharCode(...(hex.match(/.{4}/g) || []).map((unit) => parseInt(unit, 16)));
assert.equal(decoded, title);
assert.ok(text.includes('/CreationDate (D:20261003170000Z)'));

assert.throws(() => buildImagePdf([]), /at least one page/);

console.log('image PDF writer tests passed');
