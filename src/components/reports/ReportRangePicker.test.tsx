import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { LanguageProvider } from '../../contexts/LanguageContext';
import { ReportRangePicker } from './ReportDialogParts';

// The period shortcuts read as a choice: the one the dates are on is lit, and one line says which dates the report covers.

const storage = new Map<string, string>();
(globalThis as { window?: unknown }).window = {
    localStorage: {
        getItem: (key: string) => (storage.has(key) ? storage.get(key)! : null),
        setItem: (key: string, value: string) => { storage.set(key, String(value)); },
        removeItem: (key: string) => { storage.delete(key); },
    },
    matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }),
};
(globalThis as { localStorage?: unknown }).localStorage = (globalThis as unknown as { window: { localStorage: unknown } }).window.localStorage;

const NOW = new Date(2026, 10, 4, 12).getTime();
const noop = () => {};
const render = (start: string, end: string, extra: { allHistoryStart?: string } = {}) => renderToStaticMarkup(
    <LanguageProvider><ReportRangePicker idPrefix="t" start={start} end={end} onChange={noop} onThisMonth={noop} onThisYear={noop} onAllHistory={noop} now={NOW} {...extra}/></LanguageProvider>);
const lit = (html: string) => (html.match(/aria-pressed="true"[^>]*>(.*?)<\/button>/) ?? [])[1]?.replace('&#x27;', "'");

assert.equal(lit(render('2026-11-01', '2026-11-04')), 'Mois courant');
assert.equal(lit(render('2026-01-01', '2026-11-04')), 'Année courante');
assert.equal(lit(render('', '')), 'Tout l\'historique');
assert.equal(lit(render('2025-03-02', '2026-11-04', { allHistoryStart: '2025-03-02' })), 'Tout l\'historique');
assert.equal(lit(render('2026-10-05', '2026-10-20')), undefined, 'hand-picked dates light no shortcut');
assert.ok(render('2026-11-01', '2026-11-04').includes('Du 01/11/2026 au 04/11/2026'));
assert.ok(render('2026-10-05', '2026-10-20').includes('Dates choisies à la main'));
console.log('report range picker tests passed');
