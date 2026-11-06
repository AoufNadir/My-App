import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { ReportHeader } from './ReportSheet';
import { DEFAULT_REPORT_IDENTITY, reportIdentity, setReportIdentity } from './reportIdentity';

const header = () => renderToStaticMarkup(createElement(ReportHeader, { tagline: 't', title: 'T', referenceLabel: 'R', reference: '1', issuedLabel: 'I', issued: 'd' }));
assert.deepEqual(reportIdentity(), DEFAULT_REPORT_IDENTITY);
assert.ok(header().includes('ProDigital') && header().includes('/logo.png'), 'unchanged without settings');
setReportIdentity({ businessName: 'Change Test', logo: 'data:image/png;base64,AAA' });
assert.ok(header().includes('Change Test') && header().includes('data:image/png;base64,AAA'));
setReportIdentity({ businessName: '  ', logo: null });
assert.deepEqual(reportIdentity(), DEFAULT_REPORT_IDENTITY, 'blank falls back');
console.log('reportIdentity: ok');
