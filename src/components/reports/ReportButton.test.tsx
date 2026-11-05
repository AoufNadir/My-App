import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { LanguageProvider } from '../../contexts/LanguageContext';
import { ReportButton } from './ReportButton';

// The one way to open a report window (V9-6): the same words and icon on every page.

const storage = new Map<string, string>();
(globalThis as { window?: unknown }).window = {
    localStorage: { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => { storage.set(k, String(v)); } },
    matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }),
};
(globalThis as { localStorage?: unknown }).localStorage = (globalThis as unknown as { window: { localStorage: unknown } }).window.localStorage;
const noop = () => {};
const render = (variant: 'inline' | 'header' | 'section') => renderToStaticMarkup(<LanguageProvider><ReportButton variant={variant} onClick={noop}/></LanguageProvider>);

const inline = render('inline');
assert.ok(inline.includes('Rapport PDF') && inline.includes('<svg'), 'inline: the words and the icon');
for (const variant of ['header', 'section'] as const) {
    const html = render(variant);
    assert.ok(html.includes('aria-label="Rapport PDF"') && html.includes('title="Rapport PDF"') && !html.includes('<span>'), `${variant}: an icon named for screen readers, no text`);
}
assert.ok(render('header').includes('h-11 w-11') && render('section').includes('h-touch w-touch'), 'sizes: header 44px, card corner touch size');
console.log('report button tests passed');
