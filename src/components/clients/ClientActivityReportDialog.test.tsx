import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { LanguageProvider } from '../../contexts/LanguageContext';
import type { ClientTransactionDzd, Tx } from '../../types';
import { ClientActivityReportDialog } from './ClientActivityReportDialog';

// The report window works like the investor report window: this month, this year, the whole
// history, or two dates. It opens on the report the owner usually sends (the last finished month
// with an operation), in the app's language, balance shown, shows the page the client will
// receive, and writes nothing.

const storage = new Map<string, string>();
(globalThis as { window?: unknown }).window = {
    localStorage: {
        getItem: (key: string) => (storage.has(key) ? storage.get(key)! : null),
        setItem: (key: string, value: string) => { storage.set(key, String(value)); },
        removeItem: (key: string) => { storage.delete(key); },
    },
    matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }),
};

const at = (month: number, day: number, hour = 12) => new Date(2026, month, day, hour).getTime();
const NOW = at(9, 3, 18);
const sale = (id: string, timestamp: number, quantity: number, sell: number): Tx => ({ id, type: 'sell', currency: 'USDT', quantity, sell, total: quantity * sell, price: 243.17, profit: 6891.55, date: '', time: '', timestamp } as Tx);
const transactions: Tx[] = [sale('tx1', at(7, 3), 1000, 250), sale('tx2', at(8, 2), 800, 249.5), sale('tx3', at(9, 2), 100, 251)];
const ledger = (id: string, tx: Tx): ClientTransactionDzd => ({ id, clientId: 'c1', timestamp: tx.timestamp, date: '', time: '', montant: -tx.quantity * (tx.sell || 0), type: 'Vente USDT', linkedTxId: tx.id, linkRole: 'primary', paymentMethod: 'Crédit', affectsBalance: true, notes: 'NOTE-SECRET' });
const rows = transactions.map((tx, index) => ledger(`r${index}`, tx));

const render = (lang: 'ar' | 'fr', clientRows: ClientTransactionDzd[], initialRange?: { start: string; end: string }) => {
    storage.set('app_lang', lang);
    return renderToStaticMarkup(<LanguageProvider>
      <ClientActivityReportDialog onClose={() => {}} clientId="c1" clientName="Client Test" clientRows={clientRows} transactions={transactions} initialRange={initialRange} now={NOW}/>
    </LanguageProvider>);
};
const dates = (html: string) => [...html.matchAll(/<input[^>]*id="client-report-(start|end)"[^>]*value="([^"]*)"/g)].map((match) => `${match[1]}=${match[2]}`);

for (const lang of ['ar', 'fr'] as const) {
    const html = render(lang, rows);
    assert.deepEqual(dates(html), ['start=01/09/2026', 'end=30/09/2026'], `${lang}: September, not the three days of October`);
    for (const word of lang === 'ar' ? ['الشهر الحالي', 'السنة الحالية', 'كل السجل', 'تاريخ البداية', 'تاريخ النهاية'] : ['Mois courant', 'Année courante', 'Tout l&#x27;historique', 'Date début', 'Date fin'])
        assert.ok(html.includes(word), `${lang}: ${word}`);
    assert.doesNotMatch(html, /<select/, `${lang}: no list of weeks, months, years any more`);
    const sheets = [...html.matchAll(/<article dir="(rtl|ltr)" lang="(ar|fr)"/g)];
    assert.equal(sheets.length, 2, `${lang}: the preview and the A4 sheet the PDF is made from`);
    assert.ok(sheets.every((sheet) => sheet[2] === lang), `${lang}: the report is in the app's language by default`);
    assert.match(html, lang === 'ar' ? /تقرير النشاط الشهري/ : /Rapport d’activité mensuel/, `${lang}: a whole month is a monthly report`);
    assert.match(html, /<input type="checkbox" id="client-report-balance"[^>]*checked=""/, `${lang}: the balance is shown by default`);
    assert.match(html, lang === 'ar' ? /إرسال PDF/ : /Envoyer le PDF/);
    assert.doesNotMatch(html, /243[.,]17|6[\s\u00A0\u202F]?891|NOTE-SECRET/, `${lang}: nothing of ours in the window either`);
}

// Opened from Analyse on a month, or on any two dates.
const fromAnalytics = render('fr', rows, { start: '2026-08-15', end: '2026-10-02' });
assert.deepEqual(dates(fromAnalytics), ['start=15/08/2026', 'end=02/10/2026']);
assert.match(fromAnalytics, /Rapport d’activité</, 'Any two dates: a report of that span');
assert.match(fromAnalytics, /Période · 49 jours/);

// Dates the wrong way round: a message, no report, nothing to send.
const inverted = render('ar', rows, { start: '2026-10-02', end: '2026-08-15' });
assert.match(inverted, /role="alert"[^>]*>يجب أن يكون تاريخ البداية قبل تاريخ النهاية/);
assert.doesNotMatch(inverted, /<article/);
assert.match(inverted, /<button[^>]*disabled=""[^>]*>[\s\S]*?إرسال PDF/, 'Send is disabled');
const missing = render('fr', rows, { start: '', end: '2026-09-30' });
assert.match(missing, /role="alert"[^>]*>Veuillez sélectionner les deux dates/);

const empty = render('ar', []);
assert.match(empty, /لا توجد أي عملية لهذا العميل/, 'A client without operations: a message, no report');
assert.doesNotMatch(empty, /إرسال PDF|<article/);

console.log('client activity report window tests passed');
