import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LanguageProvider } from '../../contexts/LanguageContext';
import { expectedCashCount } from '../../utils/cashCount';
import { CashCountDialog, CashCountSection } from './CashCountSection';

// V5-2: the count window shows what the app expects for each account, in French and Arabic,
// and says it changes nothing; the Trésorerie card invites a first count.

const storage = new Map<string, string>();
(globalThis as { window?: unknown }).window = {
    localStorage: {
        getItem: (key: string) => (storage.has(key) ? storage.get(key)! : null),
        setItem: (key: string, value: string) => { storage.set(key, String(value)); },
        removeItem: (key: string) => { storage.delete(key); },
    },
    matchMedia: () => ({ matches: false }),
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
};
const render = (lang: 'fr' | 'ar', node: React.ReactElement) => {
    storage.set('app_lang', lang);
    return renderToStaticMarkup(<LanguageProvider>{node}</LanguageProvider>);
};
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/[\s  ]+/g, ' ');
const expected = expectedCashCount({ caisse: 152_340, baridi: 48_000, usdt: { available: 1_200, locked: 300 }, eur: { available: 410 } });

for (const lang of ['fr', 'ar'] as const) {
    const dialog = text(render(lang, <CashCountDialog expected={expected} onClose={() => undefined} onSave={async () => undefined}/>));
    for (const amount of ['152 340', '48 000', '1 500', '410'])
        assert.ok(dialog.includes(amount), `${lang}: the expected ${amount} shows before anything is typed`);
    assert.match(dialog, lang === 'fr' ? /ne change aucun solde/ : /لا يغيّر أي رصيد/, `${lang}: the count says it changes nothing`);
    if (lang === 'ar')
        assert.doesNotMatch(dialog, /Comptage|Attendu|Enregistrer|Caisse \(/, 'no French left in the Arabic window');

    const card = text(render(lang, <CashCountSection userDocRef={null} expected={expected}/>));
    assert.match(card, lang === 'fr' ? /Aucun comptage pour le moment/ : /لا يوجد جرد بعد/, `${lang}: the card invites a first count`);
}

console.log('cash count screen tests passed');
