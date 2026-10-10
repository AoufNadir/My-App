import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { LanguageProvider } from '../../contexts/LanguageContext';
import type { Investor } from '../../types';
import type { InvestorReport, InvestorReportDateRange, InvestorReportOperation, PreparedInvestorReport } from '../../utils/investorReport';
import { InvestorReportDialog } from './InvestorReportDialog';
import { InvestorReportSheet } from './InvestorReportSheet';

// The investor report page and its window. The page is the client report's frame: in Arabic or
// French whatever the app's language, the manager's own names, cut into A4 pages between rows
// only. The window opens on this month, remembers the report's language per investor, and only
// reads: the numbers come from prepareReport, nothing is written.

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
const endOf = (year: number, month: number, day: number) => new Date(year, month - 1, day, 23, 59, 59, 999).getTime();
const NOW = at(2026, 10, 9, 15);

const operation = (id: string, kind: InvestorReportOperation['kind'], positive: boolean, amount: number, timestamp: number, source: InvestorReportOperation['source'] = null, notes = ''): InvestorReportOperation => ({ id, kind, positive, amount, timestamp, source, notes });
const base: InvestorReport = {
    investorId: 'inv-a', investorName: 'Sofiane Haddad', isManager: false,
    startTs: at(2026, 9, 1, 0), endTs: endOf(2026, 9, 30), issuedAt: NOW, reference: 'I-20260901-20260930-INVA',
    capital: 354_200, availableProfit: 2_419.71, estimatedValue: 356_619.71, sharePercent: 21.51, notes: 'Retraits le 1er du mois.',
    periodProfit: 8_742.3, yieldPct: 2.468, deposits: 0, capitalWithdrawals: 50_000, reinvested: 0, profitOut: 0, netMovement: -50_000,
    operations: [
        operation('o3', 'withdrawCapital', false, 50_000, at(2026, 9, 10, 10), 'Caisse', 'Retrait partiel'),
        operation('o2', 'distribution', true, 18_200, at(2026, 9, 5, 18)),
        operation('o1', 'withdrawProfit', false, 6_500.75, at(2026, 9, 1, 9, 5), 'BaridiMob'),
    ],
};
const manager: InvestorReport = {
    ...base, investorId: 'inv-m', investorName: 'Yacine Benali', isManager: true, reference: 'I-20260901-20260930-INVM', notes: '',
    capital: 1_267_521.75, availableProfit: 110_021.75, estimatedValue: 1_267_521.75, sharePercent: 71.2,
    deposits: 0, capitalWithdrawals: 0, reinvested: 49_300, profitOut: 25_000, netMovement: 0,
    operations: [
        operation('m7', 'personalExpenseCapital', false, 7_500, at(2026, 9, 27, 12)),
        operation('m5', 'personalExpense', false, 12_000, at(2026, 9, 20, 13)),
        operation('m3', 'retained', true, 15_000, at(2026, 9, 2, 18)),
    ],
};
const sheet = (report: InvestorReport, lang: 'ar' | 'fr', variant: 'screen' | 'print' = 'print') => renderToStaticMarkup(<InvestorReportSheet report={report} lang={lang} variant={variant}/>);

const FRENCH_WORDS = ['Rapport investisseur', 'Investisseur', 'Période', 'Situation au', 'Capital', 'Profit disponible', 'Valeur estimée', 'Part du fonds', 'Performance et mouvements', 'Mouvement net', 'Détail des opérations', 'Montant', 'Caisse', 'Retrait de capital'];
const ARABIC_LETTERS = /[؀-ۿ]/;

for (const lang of ['ar', 'fr'] as const) {
    const html = sheet(base, lang);
    assert.match(html, lang === 'ar' ? /<article dir="rtl" lang="ar"/ : /<article dir="ltr" lang="fr"/, `${lang}: direction and language of the page`);
    assert.match(html, /w-\[794px\]/, `${lang}: the A4 sheet the PDF is made from`);
    assert.match(sheet(base, lang, 'screen'), /shadow-card/, `${lang}: the preview`);
    for (const word of lang === 'ar'
        ? ['تقرير المستثمر', 'المستثمر', 'الفترة', 'الوضع في', 'رأس المال', 'الربح المتاح', 'القيمة التقديرية', 'الحصة من الصندوق', 'الأداء والحركات', 'صافي ربح الفترة', 'مردود الفترة', 'عدد الحركات', 'إضافات رأس المال', 'أعيد استثماره', 'سحب الأرباح', 'صافي الحركة', 'تفاصيل العمليات', 'المبلغ (DZD)', 'سحب رأس مال', 'توزيع ربح', 'سحب ربح', 'الصندوق', 'بريدي موب', 'راسلنا خلال 7 أيام']
        : [...FRENCH_WORDS, 'Ajouts capital', 'Réinvesti', 'Retraits bénéfices', 'Distribution de profit', 'Retrait de profit', 'BaridiMob', 'sous 7 jours'])
        assert.ok(html.includes(word), `${lang}: ${word}`);
    if (lang === 'ar') {
        for (const word of FRENCH_WORDS)
            assert.ok(!html.replace(/Retraits le 1er du mois\.|Retrait partiel/g, '').includes(word), `ar: no French word « ${word} » (notes stay as written)`);
    }
    else
        assert.doesNotMatch(html, ARABIC_LETTERS, 'fr: no Arabic word');

    // A4 pages end between blocks or between rows, never inside a row; every row can be left out
    // of the other pages' captures.
    assert.equal(html.match(/<tr data-pdf-row=""/g)?.length, base.operations.length, `${lang}: one row per operation`);
    assert.equal(html.match(/<tr data-pdf-row="" data-pdf-break=""/g)?.length, base.operations.length - 1, `${lang}: a page may end before any row but the first`);
    assert.ok((html.match(/<section data-pdf-break=""/g)?.length ?? 0) >= 3, `${lang}: each part may start a page`);
    assert.match(html, /<header data-pdf-break=""/);
    assert.match(html, /<footer data-pdf-break=""/);

    // Signs and colours as on the investor page: the old « profit_distribution » row is + (green).
    const rowOf = (id: number) => [...html.matchAll(/<tr data-pdf-row=""[\s\S]*?<\/tr>/g)][id][0];
    assert.match(rowOf(0), /text-financial-loss"><bdi[^>]*>−50\u00A0000,00</);
    assert.match(rowOf(1), /text-financial-profit"><bdi[^>]*>\+18\u00A0200,00</);
    assert.match(rowOf(2), /text-financial-loss"><bdi[^>]*>−6\u00A0500,75</);
    assert.match(rowOf(2), /<bdi[^>]*>09:05<\/bdi>/, `${lang}: the time under the date`);
    assert.match(html, /text-financial-loss"><bdi[^>]*>−50\u00A0000,00 DZD</, `${lang}: net movement`);
    assert.match(html, /text-financial-profit"><bdi[^>]*>\+2\u00A0419,71 DZD</, `${lang}: available profit`);
    assert.match(html, /<bdi[^>]*>\+2,47%<\/bdi>/, `${lang}: yield with two decimals`);
    assert.match(html, /<bdi[^>]*>21,51%<\/bdi>/, `${lang}: share of the fund`);
}

// The period, written in the report's language; the situation is that of the end date (today
// when the period has no end, or ends later).
const periodOf = (report: InvestorReport, lang: 'ar' | 'fr') => sheet(report, lang).replace(/<bdi[^>]*>([^<]*)<\/bdi>/g, '$1');
const PERIODS: Array<[string, Partial<InvestorReport>, string, string, string]> = [
    ['two dates', {}, 'من 01/09/2026 إلى 30/09/2026', 'Du 01/09/2026 au 30/09/2026', '30/09/2026'],
    ['a start only', { endTs: null }, 'منذ 01/09/2026', 'Depuis le 01/09/2026', '09/10/2026'],
    ['an end only', { startTs: null }, 'حتى 30/09/2026', 'Jusqu’au 30/09/2026', '30/09/2026'],
    ['the whole history', { startTs: null, endTs: null }, 'كل السجل', 'Tout l’historique', '09/10/2026'],
    ['an end after today', { endTs: endOf(2026, 12, 31) }, 'من 01/09/2026 إلى 31/12/2026', 'Du 01/09/2026 au 31/12/2026', '09/10/2026'],
];
for (const [name, fields, ar, fr, situation] of PERIODS) {
    assert.ok(periodOf({ ...base, ...fields }, 'ar').includes(ar), `ar: ${name}`);
    assert.ok(periodOf({ ...base, ...fields }, 'fr').includes(fr), `fr: ${name}`);
    assert.ok(periodOf({ ...base, ...fields }, 'ar').includes(`الوضع في ${situation}`), `ar: situation for ${name}`);
    assert.ok(periodOf({ ...base, ...fields }, 'fr').includes(`Situation au ${situation}`), `fr: situation for ${name}`);
}

// The manager: his own names, as on his page.
for (const lang of ['ar', 'fr'] as const) {
    const html = sheet(manager, lang);
    for (const word of lang === 'ar'
        ? ['المدير', 'الأرباح المحتفظ بها', 'المصاريف الشخصية', 'مصروف شخصي من رأس المال', 'مصروف شخصي', 'الأرباح المحتفظ بها داخل المشروع']
        : ['Gérant', 'Bénéfices conservés', 'Dépenses personnelles', 'Dépense personnelle (capital)', 'Dépense personnelle', 'Bénéfices conservés dans le projet'])
        assert.ok(html.includes(word), `${lang} manager: ${word}`);
    assert.ok(!html.includes(lang === 'ar' ? 'سحب الأرباح' : 'Retraits bénéfices'), `${lang} manager: personal expenses, not profit withdrawals`);
    assert.match(html, /text-financial-loss"><bdi[^>]*>−25\u00A0000,00 DZD</, `${lang} manager: personal expenses`);
    assert.doesNotMatch(html, lang === 'ar' ? /ملاحظات:/ : /Notes:/, `${lang}: no notes line without notes`);
}

// A period without any operation: the situation is still there, no table.
for (const lang of ['ar', 'fr'] as const) {
    const html = sheet({ ...base, operations: [], periodProfit: 0, yieldPct: null, netMovement: 0, capitalWithdrawals: 0 }, lang);
    assert.ok(html.includes(lang === 'ar' ? 'لا عملية في هذه الفترة.' : 'Aucune opération sur cette période.'));
    assert.ok(html.includes(lang === 'ar' ? 'لا حركة في هذه الفترة.' : 'Aucun mouvement sur cette période.'));
    assert.doesNotMatch(html, /<table|data-pdf-row/);
    assert.match(html, /<bdi[^>]*>—<\/bdi>/, `${lang}: no capital, no yield`);
    assert.match(html, /<bdi[^>]*>354\u00A0200,00 DZD<\/bdi>/, `${lang}: capital still shown`);
}

// ---- The window ----
type Call = { investorId: string; range: InvestorReportDateRange };
const prepared = (investor: Partial<Investor> = {}): PreparedInvestorReport => ({
    ok: true,
    input: {
        investor: { id: 'inv-a', name: 'Sofiane Haddad', entryDate: '2025-03-01', capitalInvested: 354_200, initialCapital: 300_000, sharePercentage: 0.2151, totalProfit: 8_742.3, withdrawnProfit: 0, availableProfit: 2_419.71, isActive: true, ...investor },
        investorTransactions: [{ id: 't1', investorId: 'inv-a', type: 'withdraw_capital', amount: 50_000, date: '', time: '', timestamp: at(2026, 10, 2, 10), paymentSource: 'Caisse' }],
        personalExpenses: [],
    },
});
const renderWindow = (appLang: 'ar' | 'fr', options: { initialRange?: { start: string; end: string }; answer?: PreparedInvestorReport } = {}) => {
    storage.set('app_lang', appLang);
    const calls: Call[] = [];
    const prepareReport = (investorId: string, range: InvestorReportDateRange) => {
        calls.push({ investorId, range });
        const answer = options.answer ?? prepared();
        return answer.ok ? { ...answer, input: { ...answer.input, reportStartTs: range.startTs, reportEndTs: range.endTs } } : answer;
    };
    const html = renderToStaticMarkup(<LanguageProvider>
      <InvestorReportDialog onClose={() => {}} investorId="inv-a" investorName="Sofiane Haddad" prepareReport={prepareReport} initialRange={options.initialRange} now={NOW}/>
    </LanguageProvider>);
    return { html, calls };
};
const dates = (html: string) => [...html.matchAll(/<input[^>]*id="investor-report-(start|end)"[^>]*value="([^"]*)"/g)].map((match) => `${match[1]}=${match[2]}`);

for (const lang of ['ar', 'fr'] as const) {
    storage.delete('investor_report_lang_inv-a');
    const { html, calls } = renderWindow(lang);
    assert.deepEqual(dates(html), ['start=01/10/2026', 'end=09/10/2026'], `${lang}: opens on this month, to today`);
    assert.deepEqual(calls, [{ investorId: 'inv-a', range: { startTs: at(2026, 10, 1, 0), endTs: endOf(2026, 10, 9) } }], `${lang}: one computation, for this month`);
    for (const word of lang === 'ar'
        ? ['إنشاء تقرير المستثمر', 'Sofiane Haddad', 'الشهر الحالي', 'السنة الحالية', 'كل السجل', 'لغة التقرير', 'معاينة التقرير', 'إرسال PDF']
        : ['Créer le rapport de l’investisseur', 'Sofiane Haddad', 'Mois courant', 'Année courante', 'Tout l&#x27;historique', 'Aperçu du rapport', 'Envoyer le PDF'])
        assert.ok(html.includes(word), `${lang} window: ${word}`);
    const sheets = [...html.matchAll(/<article dir="(rtl|ltr)" lang="(ar|fr)"/g)];
    assert.equal(sheets.length, 2, `${lang}: the preview and the A4 sheet the PDF is made from`);
    assert.ok(sheets.every((match) => match[2] === lang), `${lang}: the report is in the app's language by default`);
}

// The language chosen for this investor wins over the app's.
storage.set('investor_report_lang_inv-a', 'fr');
{
    const { html } = renderWindow('ar');
    assert.ok([...html.matchAll(/<article dir="(rtl|ltr)" lang="(ar|fr)"/g)].every((match) => match[2] === 'fr'), 'remembered per investor');
    assert.ok(html.includes('إنشاء تقرير المستثمر'), 'the window itself stays in the app\'s language');
}
storage.delete('investor_report_lang_inv-a');

// The whole history: no dates, as the old window.
{
    const { html, calls } = renderWindow('ar', { initialRange: { start: '', end: '' } });
    assert.deepEqual(dates(html), ['start=', 'end=']);
    assert.deepEqual(calls[0].range, { startTs: null, endTs: null });
    assert.ok(html.replace(/<bdi[^>]*>([^<]*)<\/bdi>/g, '$1').includes('الوضع في 09/10/2026'));
    assert.ok(html.includes('كل السجل'));
}
// Dates the wrong way round, or not a real day: a message, nothing computed, nothing to send.
for (const [range, message] of [
    [{ start: '2026-10-02', end: '2026-08-15' }, 'يجب أن يكون تاريخ البداية قبل تاريخ النهاية'],
    [{ start: '2026-02-31', end: '' }, 'تاريخ غير صالح.'],
] as const) {
    const { html, calls } = renderWindow('ar', { initialRange: range });
    assert.match(html, new RegExp(`role="alert"[^>]*>${message}`));
    assert.equal(calls.length, 0);
    assert.doesNotMatch(html, /<article/);
    assert.match(html, /<button[^>]*disabled=""[^>]*>[\s\S]*?إرسال PDF/, 'Send is disabled');
}
// An investor the data no longer has.
{
    const { html } = renderWindow('fr', { answer: { ok: false, reason: 'notFound' } });
    assert.match(html, /role="alert"[^>]*>Investisseur introuvable\./);
    assert.doesNotMatch(html, /<article/);
}

// Read-only: nothing the window loads can reach the database.
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
    walk(resolve(here, 'InvestorReportDialog.tsx'));
    // Paths below src with forward slashes, whatever the system (the folder holding the project is not tested).
    const srcRoot = resolve(here, '..', '..');
    const inSrc = (path: string) => (isAbsolute(path) ? relative(srcRoot, path) : path).split(sep).join('/');
    const reached = [...seen].map(inSrc).filter((path) => /firebase|firestore|transactionService|Handlers/i.test(path));
    assert.deepEqual(reached, [], 'no database module behind the report window');
    assert.ok(seen.size > 10, 'the walk followed the imports');
}

console.log('investor report page and window tests passed');
