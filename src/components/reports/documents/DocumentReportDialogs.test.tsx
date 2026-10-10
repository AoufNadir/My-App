import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { LanguageProvider } from '../../../contexts/LanguageContext';
import type { ClientDzd, TreasuryTx, Tx } from '../../../types';
import { buildMonthlyReport } from '../../../utils/monthlyReport';
import { computePamLedger } from '../../../utils/pamLedger';
import { EXPENSES_REPORT_WORDS, MONTHLY_REPORT_WORDS, TREASURY_REPORT_WORDS } from '../documentWords';
import { ExpensesReportDialog, MonthlyReportDialog, TreasuryReportDialog } from './DocumentReportDialogs';
import { MonthlyReportSheet } from './MonthlyReportSheet';

// The windows of the monthly, personal-expenses and treasury reports (V3-6): the report's language
// (the app's until a choice is made, remembered per kind of report), the preview and the A4 sheet
// the PDF is made from, a send button, and nothing that can write.

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

const at = (year: number, month: number, day: number, hour = 12, minute = 0) => new Date(year, month - 1, day, hour, minute).getTime();
const NOW = at(2026, 10, 9, 15);
const dayOf = (ts: number) => { const d = new Date(ts); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`; };
const timeOf = (ts: number) => { const d = new Date(ts); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

const clients: ClientDzd[] = [{ id: 'c1', fullName: 'Sofiane Haddad' }];
const transactions: Tx[] = [
    { id: 'b1', type: 'buy', currency: 'USDT', quantity: 1_000, price: 240, total: 240_000, date: dayOf(at(2026, 10, 2)), time: '10:00', timestamp: at(2026, 10, 2, 10) } as Tx,
    { id: 's1', type: 'sell', currency: 'USDT', quantity: 400, sell: 255, total: 102_000, date: dayOf(at(2026, 10, 5)), time: '11:00', timestamp: at(2026, 10, 5, 11) } as Tx,
];
const pamLedger = computePamLedger(transactions);
const monthlyInput = { month: 9, year: 2026, transactions, clientTransactions: [], clients, getClientName: (client: ClientDzd) => client.fullName, portfolioStats: pamLedger.portfolioStats, pamLedger };
const expenses: TreasuryTx[] = [
    { id: 'e1', timestamp: at(2026, 10, 3, 12), date: dayOf(at(2026, 10, 3, 12)), time: timeOf(at(2026, 10, 3, 12)), type: 'Retrait', origin: 'personal_expense', source: 'Caisse', amount: 4_000, notes: 'Courses' },
];
const treasuryRows = [{ date: '03/10/2026', time: '12:00', type: 'Ajout', source: 'Caisse', amount: 100_000, notes: 'Règlement client' }];

// The sheets speak one language only (the words of the other one never appear).
{
    const report = buildMonthlyReport(monthlyInput);
    const fr = renderToStaticMarkup(<MonthlyReportSheet report={report} lang="fr" issuedAt={NOW} variant="print"/>);
    const ar = renderToStaticMarkup(<MonthlyReportSheet report={report} lang="ar" issuedAt={NOW} variant="print"/>);
    for (const word of [MONTHLY_REPORT_WORDS.fr.summaryTitle, MONTHLY_REPORT_WORDS.fr.portfolioTitle, 'Octobre 2026'])
        assert.ok(fr.includes(word) && !ar.includes(word), `French only: ${word}`);
    for (const word of [MONTHLY_REPORT_WORDS.ar.summaryTitle, MONTHLY_REPORT_WORDS.ar.portfolioTitle, 'أكتوبر 2026'])
        assert.ok(ar.includes(word) && !fr.includes(word), `Arabic only: ${word}`);
    assert.ok(fr.includes('dir="ltr"') && ar.includes('dir="rtl"'));
}

const windows = [
    { name: 'monthly', key: 'monthly_report_lang', open: (appLang: string) => { storage.set('app_lang', appLang); return renderToStaticMarkup(<LanguageProvider><MonthlyReportDialog onClose={() => {}} input={monthlyInput} now={NOW}/></LanguageProvider>); }, ar: [MONTHLY_REPORT_WORDS.ar.summaryTitle], fr: [MONTHLY_REPORT_WORDS.fr.summaryTitle], title: { ar: 'التقرير الشهري', fr: 'Rapport mensuel' } },
    { name: 'expenses', key: 'expenses_report_lang', open: (appLang: string) => { storage.set('app_lang', appLang); return renderToStaticMarkup(<LanguageProvider><ExpensesReportDialog onClose={() => {}} periodKey="month" expenses={expenses} managerProfitAvailable={50_000} now={NOW}/></LanguageProvider>); }, ar: [EXPENSES_REPORT_WORDS.ar.summaryTitle], fr: [EXPENSES_REPORT_WORDS.fr.summaryTitle], title: { ar: 'تقرير المصاريف', fr: 'Rapport de dépenses' } },
    { name: 'treasury', key: 'treasury_report_lang', open: (appLang: string) => { storage.set('app_lang', appLang); return renderToStaticMarkup(<LanguageProvider><TreasuryReportDialog onClose={() => {}} rows={treasuryRows} balances={{ caisse: 100_000, baridi: 0 }} now={NOW}/></LanguageProvider>); }, ar: [TREASURY_REPORT_WORDS.ar.balancesTitle], fr: [TREASURY_REPORT_WORDS.fr.balancesTitle], title: { ar: 'تقرير الخزينة', fr: 'Rapport de trésorerie' } },
];
for (const window of windows) {
    for (const lang of ['ar', 'fr'] as const) {
        storage.delete(window.key);
        const html = window.open(lang);
        const what = `${window.name} window in ${lang}`;
        assert.ok(html.includes(window.title[lang]), `${what}: its title`);
        for (const word of lang === 'ar' ? ['لغة التقرير', 'معاينة التقرير', 'إرسال PDF'] : ['Aperçu du rapport', 'Envoyer le PDF'])
            assert.ok(html.includes(word), `${what}: ${word}`);
        for (const word of window[lang])
            assert.ok(html.includes(word), `${what}: the report in ${lang}`);
        const sheets = [...html.matchAll(/<article dir="(rtl|ltr)" lang="(ar|fr)"/g)];
        assert.equal(sheets.length, 2, `${what}: the preview and the A4 sheet the PDF is made from`);
        assert.ok(sheets.every((match) => match[2] === lang), `${what}: the report is in the app's language by default`);
        assert.doesNotMatch(html, /<button[^>]*disabled=""[^>]*>[\s\S]*?(إرسال PDF|Envoyer le PDF)/, `${what}: Send is available`);
    }
    // The language chosen for this kind of report wins over the app's.
    storage.set(window.key, 'fr');
    const remembered = window.open('ar');
    assert.ok([...remembered.matchAll(/<article dir="(rtl|ltr)" lang="(ar|fr)"/g)].every((match) => match[2] === 'fr'), `${window.name}: the report's language is remembered`);
    assert.ok(remembered.includes(window.title.ar), `${window.name}: the window itself stays in the app's language`);
    storage.delete(window.key);
}

// Read-only: nothing the windows load can reach the database.
{
    const here = dirname(fileURLToPath(import.meta.url));
    const seen = new Set<string>();
    const walk = (file: string) => {
        if (seen.has(file))
            return;
        seen.add(file);
        for (const match of readFileSync(file, 'utf8').matchAll(/(?:from\s+|import\()'([^']+)'/g)) {
            const spec = match[1];
            if (!spec.startsWith('.')) {
                seen.add(spec);
                continue;
            }
            const target = ['.ts', '.tsx', '/index.ts', '/index.tsx', ''].map((ext) => resolve(dirname(file), spec) + ext).find((path) => {
                try {
                    return statSync(path).isFile();
                }
                catch {
                    return false;
                }
            });
            assert.ok(target, `${file}: ${spec}`);
            walk(target);
        }
    };
    walk(resolve(here, 'DocumentReportDialogs.tsx'));
    const srcRoot = resolve(here, '..', '..', '..');
    const inSrc = (path: string) => (isAbsolute(path) ? relative(srcRoot, path) : path).split(sep).join('/');
    const reached = [...seen].map(inSrc).filter((path) => /firebase|firestore|transactionService|Handlers/i.test(path));
    assert.deepEqual(reached, [], 'no database module behind the report windows');
    assert.ok(seen.size > 10, 'the walk followed the imports');
}

console.log('monthly, expenses and treasury report windows tests passed');
