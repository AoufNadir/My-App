import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LanguageProvider } from '../../contexts/LanguageContext';
import { InventorySection } from './InventorySection';
import { buildInventoryCheckData, listBalanceCorrections, type InventoryCheck } from '../../utils/inventoryCheck';

// V5-2: the inventory card on the Treasury page and its count window. Display only: the window
// compares what is typed with the books and offers the existing correction window per gap.

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
type Lang = 'fr' | 'ar';
const noop = () => undefined;
const expected = { caisse: 482_500, baridi: 120_000.4, usdt: 1_500.5, eur: 90.25 };
const stamp = (timestamp: number, date: string) => ({ date, time: '20:00', timestamp });
const check = (id: string, timestamp: number, date: string, counted: Parameters<typeof buildInventoryCheckData>[1]): InventoryCheck =>
    ({ id, ...buildInventoryCheckData(expected, counted, stamp(timestamp, date))! });
const render = (lang: Lang, props: Partial<React.ComponentProps<typeof InventorySection>> = {}) => {
    storage.set('app_lang', lang);
    return renderToStaticMarkup(<LanguageProvider><InventorySection expected={expected} checks={[]} corrections={[]} ready onSave={noop} onDelete={noop} onCorrect={noop} {...props}/></LanguageProvider>);
};
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/[\s  ]+/g, ' ');
const count = (html: string, needle: string) => html.split(needle).length - 1;

for (const lang of ['fr', 'ar'] as const) {
    const fr = lang === 'fr';

    // 1. The card with nothing saved: says so, offers to start. The window stays closed.
    {
        const html = render(lang);
        assert.match(text(html), fr ? /Aucun inventaire enregistré/ : /لم يُسجَّل أي جرد بعد/, `${lang}: nothing saved yet`);
        assert.match(text(html), fr ? /Faire l’inventaire/ : /ابدأ الجرد/);
        assert.doesNotMatch(text(html), fr ? /Dans l’application/ : /في التطبيق/, `${lang}: window closed`);
    }

    // 2. Window open, nothing typed: the four books amounts shown, no gap, nothing to save.
    {
        const html = render(lang, { defaultOpen: true });
        const out = text(html);
        assert.equal(count(out, fr ? 'Dans l’application' : 'في التطبيق'), 4, `${lang}: one books line per account`);
        assert.match(out, /482 500/);
        assert.match(out, /1 500,50/);
        assert.match(out, /120 000,40/, 'cents shown as two decimals');
        assert.equal(count(html, fr ? '>Corriger le solde</button>' : '>صحّح الرصيد</button>'), 0, `${lang}: no fix button without a gap`);
        assert.match(html, /<button[^>]*\sdisabled=""[^>]*>[^<]*(Enregistrer l’inventaire|احفظ الجرد)/, `${lang}: save is off until something is typed`);
    }

    // 3. Typed: cash short, USDT over, EUR equal, Baridi not counted.
    {
        const html = render(lang, { defaultOpen: true, initialDraft: { caisse: '480000', usdt: '1520.5', eur: '90.25' } });
        const out = text(html);
        assert.match(out, fr ? /Il manque 2 500 DZD/ : /ينقص 2 500 DZD/, `${lang}: cash short`);
        assert.match(out, fr ? /Il y a 20,00 USDT en trop/ : /يزيد 20,00 USDT/, `${lang}: USDT over`);
        assert.equal(count(out, fr ? 'Conforme' : 'مطابق'), 1, `${lang}: only EUR matches`);
        assert.equal(count(html, fr ? '>Corriger le solde</button>' : '>صحّح الرصيد</button>'), 2, `${lang}: a fix button for each of the two gaps`);
        assert.doesNotMatch(html, /<button[^>]*\sdisabled=""[^>]*>[^<]*(Enregistrer l’inventaire|احفظ الجرد)/, `${lang}: save is on`);
    }

    // 4. Garbage typed is flagged and blocks saving; the other fields still compare.
    {
        const html = render(lang, { defaultOpen: true, initialDraft: { caisse: 'abc', eur: '90.25' } });
        const out = text(html);
        assert.match(out, fr ? /Montant invalide|invalide/i : /غير صالح|مبلغ/, `${lang}: invalid amount flagged`);
        assert.match(html, /<button[^>]*\sdisabled=""[^>]*>[^<]*(Enregistrer l’inventaire|احفظ الجرد)/, `${lang}: save is off`);
    }

    // 5. Figures still from the cache: a warning, and saving is off even with good entries.
    {
        const html = render(lang, { defaultOpen: true, ready: false, initialDraft: { eur: '90.25' } });
        assert.match(text(html), fr ? /Synchronisation en cours/ : /المزامنة جارية/);
        assert.match(html, /<button[^>]*\sdisabled=""[^>]*>[^<]*(Enregistrer l’inventaire|احفظ الجرد)/);
        // A gap measured against cached figures is not a gap to correct yet.
        const stale = render(lang, { defaultOpen: true, ready: false, initialDraft: { caisse: '1000' } });
        assert.match(stale, /<button[^>]*\sdisabled=""[^>]*>(Corriger le solde|صحّح الرصيد)/, `${lang}: fix is off while syncing`);
    }

    // 6. With history: last check, last clean check, gaps, the month, and its corrections.
    {
        const clean = check('a', Date.UTC(2026, 8, 20, 12), '20/09/2026', { caisse: 482_500, baridi: 120_000, usdt: 1_500.5, eur: 90.25 });
        const gap = check('b', Date.UTC(2026, 9, 8, 12), '08/10/2026', { caisse: 481_300, eur: 90.25 });
        const corrections = listBalanceCorrections(
            [{ type: 'Retrait', source: 'Caisse', amount: 1_200, origin: 'balance_edit', timestamp: Date.UTC(2026, 9, 9, 12) }],
            [],
        );
        const html = render(lang, { defaultOpen: true, checks: [clean, gap], corrections });
        const out = text(html);
        assert.match(out, fr ? /Dernier inventaire : 08\/10\/2026/ : /آخر جرد: 08\/10\/2026/, `${lang}: latest check`);
        assert.match(out, fr ? /Dernier inventaire sans écart : 20\/09\/2026/ : /آخر جرد بلا فروق: 20\/09\/2026/, `${lang}: last clean check`);
        assert.match(out, fr ? /Écarts au dernier inventaire : 1/ : /الفروق في آخر جرد: 1/, `${lang}: gaps in the latest`);
        assert.match(out, fr ? /Octobre 2026/ : /أكتوبر 2026/, `${lang}: month heading`);
        assert.match(out, fr ? /Septembre 2026/ : /سبتمبر 2026/);
        assert.match(out, fr ? /Corrections de solde du mois\s*:\s*Caisse \(espèces\)\s*-1 200/ : /تصحيحات الرصيد في هذا الشهر\s*:\s*الصندوق \(كاش\)\s*-1 200/, `${lang}: month corrections`);
        assert.match(out, fr ? /Aucune correction de solde ce mois-ci/ : /لا تصحيحات للرصيد في هذا الشهر/, `${lang}: september had none`);
        assert.equal(count(out, fr ? 'Supprimer' : 'حذف'), 2, `${lang}: a delete button per saved check`);
    }
}

console.log('InventorySection tests passed');
