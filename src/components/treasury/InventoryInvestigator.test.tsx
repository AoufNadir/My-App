import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LanguageProvider } from '../../contexts/LanguageContext';
import { InventorySection } from './InventorySection';
import type { InvestigatorPortfolioTx, InvestigatorTreasuryTx } from '../../utils/inventoryInvestigator';

// V5-3: the investigator's suggestions inside the count window. Display only: the buttons hand an
// action to the app, which opens a window that already exists; nothing is saved from here.

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
const expected = { caisse: 482_500, baridi: 120_000, usdt: 1_500.5, eur: 90.25 };
const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.now();
const stamp = (daysAgo: number) => {
    const timestamp = NOW - daysAgo * DAY;
    const d = new Date(timestamp);
    const p = (n: number) => String(n).padStart(2, '0');
    return { timestamp, date: `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`, time: `${p(d.getHours())}:${p(d.getMinutes())}` };
};
const render = (lang: Lang, props: Partial<React.ComponentProps<typeof InventorySection>> = {}) => {
    storage.set('app_lang', lang);
    return renderToStaticMarkup(<LanguageProvider><InventorySection expected={expected} checks={[]} corrections={[]} ready onSave={noop} onDelete={noop} onCorrect={noop} onInvestigate={noop} defaultOpen {...props}/></LanguageProvider>);
};
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/[\u2066\u2069]/g, '').replace(/[\s  ]+/g, ' ');
const count = (html: string, needle: string) => html.split(needle).length - 1;

// A sale of 20 USDT at 250 that went into Baridi but was recorded in the Caisse.
const treasury: InvestigatorTreasuryTx[] = [
    { id: 'tt-wrong', ...stamp(1), type: 'Ajout', source: 'Caisse', amount: 5_000, origin: 'usdt_tx', linkedTxId: 'px-sale' },
    { id: 'tt-other', ...stamp(2), type: 'Retrait', source: 'Caisse', amount: 800 },
];
const portfolio: InvestigatorPortfolioTx[] = [
    { id: 'px-sale', ...stamp(1), type: 'sell', currency: 'USDT', quantity: 20, sell: 250 },
    { id: 'px-1', ...stamp(5), type: 'sell', currency: 'USDT', quantity: 100, sell: 249.5 },
    { id: 'px-2', ...stamp(7), type: 'sell', currency: 'USDT', quantity: 80, sell: 250.5 },
    { id: 'px-3', ...stamp(9), type: 'sell', currency: 'USDT', quantity: 60, sell: 251 },
];

for (const lang of ['fr', 'ar'] as const) {
    const fr = lang === 'fr';

    // 1. Nothing counted, or everything matching: no investigator panel at all.
    {
        assert.doesNotMatch(text(render(lang)), fr ? /Pistes de l’enquêteur/ : /اقتراحات المحقّق/, `${lang}: nothing typed`);
        const matching = render(lang, { initialDraft: { caisse: '482500', baridi: '120000', usdt: '1500.5', eur: '90.25' }, treasuryTransactions: treasury, portfolioTransactions: portfolio });
        assert.doesNotMatch(text(matching), fr ? /Pistes de l’enquêteur/ : /اقتراحات المحقّق/, `${lang}: all match`);
    }

    // 2. Without the callback (older screens) the panel is not offered.
    {
        const html = render(lang, { onInvestigate: undefined, initialDraft: { caisse: '477500', baridi: '125000' }, treasuryTransactions: treasury, portfolioTransactions: portfolio });
        assert.doesNotMatch(text(html), fr ? /Pistes de l’enquêteur/ : /اقتراحات المحقّق/, `${lang}: no callback, no panel`);
    }

    // 3. One box too high and the other too low by the same amount: the operation in the wrong box.
    {
        const html = render(lang, { initialDraft: { caisse: '477500', baridi: '125000' }, treasuryTransactions: treasury, portfolioTransactions: portfolio });
        const out = text(html);
        assert.match(out, fr ? /Pistes de l’enquêteur/ : /اقتراحات المحقّق/, `${lang}: title`);
        assert.match(out, fr ? /Ce sont des suggestions/ : /اقتراحات فقط/, `${lang}: says it only suggests`);
        assert.match(out, fr ? /Une opération de 5 000 DZD est peut-être dans la mauvaise caisse/ : /ربما عملية بقيمة 5 000 DZD سُجّلت في الصندوق الخطأ/, `${lang}: wrong box headline`);
        assert.match(out, fr ? /Saisie dans la Caisse : elle devrait être dans BaridiMob/ : /سُجّلت في الصندوق وكان يجب أن تكون في BaridiMob/, `${lang}: recorded in the Caisse, should be in Baridi`);
        assert.match(out, fr ? /Liée à une vente de 20 USDT/ : /مرتبطة بعملية بيع 20 USDT/, `${lang}: linked to the USDT sale`);
        assert.equal(count(out, fr ? '800 DZD' : '800 DZD'), 0, `${lang}: an operation of another amount is not listed`);
        assert.equal(count(html, fr ? '>Modifier</button>' : '>عدّل</button>'), 1, `${lang}: one edit button for the one candidate`);
        assert.equal(count(html, fr ? '>Enregistrer ce virement</button>' : '>سجّل هذا التحويل</button>'), 1, `${lang}: the forgotten transfer is offered too`);
    }

    // 4. A USDT gap that the cash answers: a sale never recorded, at a believable price.
    {
        const html = render(lang, { initialDraft: { caisse: '487500', usdt: '1480.5' }, treasuryTransactions: [], portfolioTransactions: portfolio });
        const out = text(html);
        assert.match(out, fr ? /Une vente de 20,00 USDT a peut-être été oubliée/ : /ربما بيع 20,00 USDT لم يُسجَّل/, `${lang}: sale headline`);
        assert.match(out, fr ? /à 250,00 DZD pièce/ : /بسعر 250,00 DZD للوحدة/, `${lang}: price per unit`);
        assert.match(out, fr ? /Ce prix est cohérent avec vos 4 dernières opérations/ : /السعر قريب من آخر 4 عمليات/, `${lang}: price fits`);
        assert.equal(count(html, fr ? '>Enregistrer cette vente</button>' : '>سجّل هذا البيع</button>'), 1, `${lang}: record button`);
    }

    // 5. Same sale at a price far from the recent ones: warns, still allows.
    {
        const html = render(lang, { initialDraft: { caisse: '492500', usdt: '1480.5' }, treasuryTransactions: [], portfolioTransactions: portfolio });
        assert.match(text(html), fr ? /Attention : ce prix est loin de vos 4 dernières opérations/ : /انتبه: السعر بعيد عن آخر 4 عمليات/, `${lang}: price warning`);
    }

    // 6. A gap nothing explains: the operations since the account last matched.
    {
        const html = render(lang, { initialDraft: { caisse: '481700' }, treasuryTransactions: treasury, portfolioTransactions: portfolio });
        const out = text(html);
        assert.match(out, fr ? /Écart de Caisse \(espèces\) : -800 DZD/ : /فرق في الصندوق \(كاش\): -800 DZD/, `${lang}: unexplained headline`);
        assert.match(out, fr ? /2 opération\(s\) touchent ce compte depuis le début/ : /2 عملية تمسّ هذا الحساب منذ البداية/, `${lang}: count of operations`);
        assert.equal(count(html, fr ? '>Modifier</button>' : '>عدّل</button>'), 2, `${lang}: an edit button for each listed operation`);
    }

    // 7. Figures still from the cache: every investigator button is off.
    {
        const html = render(lang, { ready: false, initialDraft: { caisse: '477500', baridi: '125000' }, treasuryTransactions: treasury, portfolioTransactions: portfolio });
        assert.match(html, new RegExp(`<button[^>]*\\sdisabled=""[^>]*>${fr ? 'Modifier' : 'عدّل'}</button>`), `${lang}: edit is off while syncing`);
        assert.match(html, new RegExp(`<button[^>]*\\sdisabled=""[^>]*>${fr ? 'Enregistrer ce virement' : 'سجّل هذا التحويل'}</button>`), `${lang}: transfer is off while syncing`);
    }
}

console.log('InventoryInvestigator tests passed');
