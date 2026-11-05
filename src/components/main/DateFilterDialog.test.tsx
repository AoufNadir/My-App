import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { LanguageProvider } from '../../contexts/LanguageContext';
import { DateFilterDialog } from './MainDialogs';

// V9-7: the date filter of the operations offers shortcuts (the one the dates are on is lit) and
// cannot be applied until both dates are chosen.

const storage = new Map<string, string>();
(globalThis as { window?: unknown }).window = {
    localStorage: { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => { storage.set(k, String(v)); } },
    matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }),
};
(globalThis as { localStorage?: unknown }).localStorage = (globalThis as unknown as { window: { localStorage: unknown } }).window.localStorage;
const noop = () => {};
const render = (startDate: string, endDate: string) => renderToStaticMarkup(<LanguageProvider>
    <DateFilterDialog isOpen onClose={noop} startDate={startDate} setStartDate={noop} endDate={endDate} setEndDate={noop} onClear={noop} onApply={noop} title="Filtrer" startLabel="Date début" endLabel="Date fin" clearLabel="Effacer" applyLabel="Appliquer"/>
  </LanguageProvider>);

const empty = render('', '');
for (const word of ['Aujourd&#x27;hui', '7 derniers jours', 'Ce mois', 'Mois dernier', 'Cette année'])
    assert.ok(empty.includes(word) || empty.includes(word.replace('&#x27;', '’')) || empty.includes(word.replace('&#x27;', '&#x27;')), `shortcut: ${word}`);
assert.equal((empty.match(/aria-pressed="true"/g) || []).length, 0, 'no dates: no shortcut lit');
assert.match(empty, /<button[^>]*\sdisabled=""[^>]*>[^<]*Appliquer/, 'empty dates: Appliquer is disabled');
const today = new Date();
const pad = (n: number) => String(n).padStart(2, '0');
const day = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
const lit = render(day, day);
assert.equal((lit.match(/aria-pressed="true"/g) || []).length, 1, 'today to today lights one shortcut');
assert.doesNotMatch(lit, /<button[^>]*\sdisabled=""[^>]*>[^<]*Appliquer/, 'both dates: Appliquer is enabled');
console.log('date filter dialog tests passed');
