import assert from 'node:assert/strict';

import { reportPageFooter } from './reportPageFooter';
import { pdfPageFooterText } from './reportPdf';

// Under every page of a report longer than one page: its number, the issue date and the report's
// reference, in the report's language (V3-5; it was « 1 / 2 »).

const issuedAt = new Date(2026, 9, 9, 15).getTime();

const arabic = reportPageFooter('ar', issuedAt, 'I-20260901-20260930-INVA');
assert.equal(arabic.lang, 'ar', 'drawn right to left, in the Arabic font');
assert.equal(pdfPageFooterText(0, 2, arabic), 'صفحة 1 من 2 · صدر في 09/10/2026 · رقم I-20260901-20260930-INVA');
assert.equal(pdfPageFooterText(1, 2, arabic), 'صفحة 2 من 2 · صدر في 09/10/2026 · رقم I-20260901-20260930-INVA');

const french = reportPageFooter('fr', issuedAt, 'R-202609-AB12');
assert.equal(french.lang, 'fr');
assert.equal(pdfPageFooterText(2, 3, french), 'Page 3 sur 3 · Émis le 09/10/2026 · N° R-202609-AB12');

// A report without its own footer keeps the plain page number.
assert.equal(pdfPageFooterText(0, 4), '1 / 4');

console.log('report page footer tests passed');
