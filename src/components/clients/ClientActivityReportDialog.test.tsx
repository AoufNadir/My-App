import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { LanguageProvider } from '../../contexts/LanguageContext';
import type { ClientTransactionDzd, Tx } from '../../types';
import { ClientActivityReportDialog } from './ClientActivityReportDialog';

// The report window opens on the report the owner usually sends: the last finished month with
// an operation, in the app's language, balance shown. It offers every month back to the
// client's first operation, shows the page the client will receive, and writes nothing.

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

const render = (lang: 'ar' | 'fr', clientRows: ClientTransactionDzd[]) => {
    storage.set('app_lang', lang);
    return renderToStaticMarkup(<LanguageProvider>
      <ClientActivityReportDialog onClose={() => {}} clientId="c1" clientName="Client Test" clientRows={clientRows} transactions={transactions} now={NOW}/>
    </LanguageProvider>);
};

for (const lang of ['ar', 'fr'] as const) {
    const html = render(lang, rows);
    const options = [...html.matchAll(/<option value="([^"]+)"( selected="")?>([^<]+)<\/option>/g)].map((match) => ({ key: match[1], selected: Boolean(match[2]), label: match[3] }));
    assert.deepEqual(options.map((option) => option.key), ['m-2026-10', 'm-2026-09', 'm-2026-08'], `${lang}: months from now back to the first operation, newest first`);
    assert.equal(options.find((option) => option.selected)?.key, 'm-2026-09', `${lang}: September is selected, not the three days of October`);
    assert.match(options[0].label, lang === 'ar' ? /أكتوبر 2026 \(حتى اليوم\)/ : /Octobre 2026 \(à aujourd’hui\)/, `${lang}: the running month says so`);
    const sheets = [...html.matchAll(/<article dir="(rtl|ltr)" lang="(ar|fr)"/g)];
    assert.equal(sheets.length, 2, `${lang}: the preview and the A4 sheet the PDF is made from`);
    assert.ok(sheets.every((sheet) => sheet[2] === lang), `${lang}: the report is in the app's language by default`);
    assert.match(html, /<input type="checkbox" id="client-report-balance"[^>]*checked=""/, `${lang}: the balance is shown by default`);
    assert.match(html, lang === 'ar' ? /إرسال PDF/ : /Envoyer le PDF/);
    assert.doesNotMatch(html, /243[.,]17|6[\s\u00A0\u202F]?891|NOTE-SECRET/, `${lang}: nothing of ours in the window either`);
}

const empty = render('ar', []);
assert.match(empty, /لا توجد أي عملية لهذا العميل/, 'A client without operations: a message, no report');
assert.doesNotMatch(empty, /إرسال PDF|<article/);

console.log('client activity report window tests passed');
