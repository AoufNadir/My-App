import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LanguageProvider, useLanguage } from '../../contexts/LanguageContext';
import type { ClientDzd, TreasuryTx, Tx } from '../../types';
import { MainClientOperationsDialogs } from './MainClientOperationsDialogs';
import { MovementReviewSection } from '../treasury/MovementReviewSection';
import { buildMovementReasonData, parseMovementReason } from '../../utils/movementReason';

// V7-2: the treasury adjustment window asks « why this movement? » before anything else, for the
// four wallets, and the Treasury page lists the movements that nothing explains. Display only:
// what the window saves is checked in the browser, scenario by scenario, against V7-1.

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
type T = (key: string) => string;
function render(node: React.ReactElement, lang: Lang) {
    storage.set('app_lang', lang);
    return renderToStaticMarkup(<LanguageProvider>{node}</LanguageProvider>);
}
function WithT({ children }: { children: (t: T) => React.ReactElement }) {
    const { t } = useLanguage();
    return children(t as T);
}
const noop = () => undefined;
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/[\u2066\u2069]/g, '').replace(/[\s  ]+/g, ' ');
const count = (html: string, needle: string) => html.split(needle).length - 1;

const clientsDzd: ClientDzd[] = [
    { id: 'c1', fullName: 'Karim Belkacem' },
    { id: 'c4', fullName: 'Salima Hadj' },
];
const clientBalances = new Map<string, number>([['c1', 0], ['c4', -12_500]]);
const portfolioStats = { usdt: { available: 1_500, avgBuy: 244 }, eur: { available: 90, avgBuy: 251 } };
const treasuryStats = { caisse: 1_250_000, baridi: 480_000 };
const getClientFullName = (client: ClientDzd) => client.fullName || '';

function adjustmentWindow(lang: Lang, state: Record<string, unknown>) {
    return render(<WithT>{(t) => <MainClientOperationsDialogs {...{
        isClientTxModalOpen: false, setIsClientTxModalOpen: noop, editingClientTx: null, t, clientTxType: 'Règlement Reçu', setClientTxType: noop, fieldBase: '',
        clientTxUsdtAmount: '', setClientTxUsdtAmount: noop, clientTxSellPrice: '', setClientTxSellPrice: noop, clientTxEurAmount: '', setClientTxEurAmount: noop,
        clientTxEurPrice: '', setClientTxEurPrice: noop, clientTxAmount: '', setClientTxAmount: noop, clientTxNotes: '', setClientTxNotes: noop,
        clientTxPaymentStatus: 'cash', setClientTxPaymentStatus: noop, clientTxLinkedClientId: 'none', clientTxReceiverClientId: 'none', setClientTxReceiverClientId: noop,
        handleSaveClientTx: noop, selectedClientId: 'c1',
        isAdjustmentModalOpen: true, setIsAdjustmentModalOpen: noop, editingTreasuryTx: null,
        adjustmentTab: 'subtract', setAdjustmentTab: noop, adjustmentAsset: 'DZD-Baridi', setAdjustmentAsset: noop, adjustmentAmount: '3000', setAdjustmentAmount: noop,
        adjustmentClientId: '', adjustmentReason: '', setAdjustmentReason: noop, onAdjustmentRedirect: noop, clientBalances, portfolioStats, treasuryStats, clientsDzd, getClientFullName,
        setAdjustmentClientId: noop, adjustmentPrice: '', setAdjustmentPrice: noop, adjustmentNote: '', setAdjustmentNote: noop, treasuryCards: [], handleGlobalAdjustment: noop, isSaving: false,
        ...state,
    }}/>}</WithT>, lang);
}
/** The Confirm button of the window and whether it is off. */
const confirmOff = (html: string, lang: Lang) => {
    const label = lang === 'fr' ? 'Confirmer' : 'تأكيد';
    const match = html.match(new RegExp(`<button[^>]*>\\s*${label}\\s*</button>`));
    assert.ok(match, `${lang}: the Confirm button is there`);
    return /\sdisabled=""/.test(match![0]);
};
const radios = (html: string) => (html.match(/role="radio"/g) || []).length;

const FR = {
    pick: 'Choisissez la raison du mouvement.', client: 'Choisissez le client.', note: 'Écrivez la raison dans les notes.',
    title: 'Pourquoi ce mouvement ?', clientOut: 'J’ai payé un client', clientIn: 'Un client m’a payé', other: 'Correction ou autre raison',
};
const AR = {
    pick: 'اختر سبب الحركة.', client: 'اختر العميل.', note: 'اكتب السبب في الملاحظات.',
    title: 'لماذا هذه الحركة؟', clientOut: 'دفعتُ لعميل', clientIn: 'عميل دفع لي', other: 'تصحيح أو سبب آخر',
};

for (const lang of ['fr', 'ar'] as const) {
    const w = lang === 'fr' ? FR : AR;

    // 1. Nothing chosen yet: the question is the first thing, Save is off and says why.
    {
        const html = adjustmentWindow(lang, {});
        const out = text(html);
        assert.ok(out.includes(w.title), `${lang}: the question is asked`);
        assert.equal(radios(html), 5, `${lang}: BaridiMob exit offers five reasons`);
        assert.equal(count(html, 'aria-checked="true"'), 0, `${lang}: none is chosen for the user`);
        assert.ok(out.includes(w.pick), `${lang}: the bar says to choose a reason`);
        assert.equal(confirmOff(html, lang), true, `${lang}: Save is off without a reason`);
        assert.ok(out.includes(w.clientOut) && out.includes(w.other));
        assert.equal(count(html, 'adjustment_reason_note'), 0, `${lang}: no reason box until « other » is chosen`);
    }

    // 2. A client reason without a client: the client is asked for, right under the reason.
    {
        const html = adjustmentWindow(lang, { adjustmentReason: 'client' });
        const out = text(html);
        assert.equal(count(html, 'aria-checked="true"'), 1);
        assert.ok(out.includes(w.client), `${lang}: the bar asks for the client`);
        assert.equal(confirmOff(html, lang), true);
        const reasonAt = html.indexOf('aria-checked="true"');
        const selectAt = html.indexOf('role="combobox"');
        assert.ok(selectAt > reasonAt, `${lang}: the client field sits under the chosen reason`);
        assert.ok(selectAt < html.indexOf('placeholder="0.00"'), `${lang}: and above the amount`);
    }

    // 3. A client reason with a client: Save is on, and the client's balance before and after is said.
    {
        const html = adjustmentWindow(lang, { adjustmentReason: 'client', adjustmentClientId: 'c4', adjustmentTab: 'add', adjustmentAsset: 'DZD-Caisse', adjustmentAmount: '30000' });
        const out = text(html);
        assert.equal(confirmOff(html, lang), false, `${lang}: Save is on`);
        assert.match(out, /-12 500,00/, `${lang}: balance before`);
        assert.match(out, /17 500,00/, `${lang}: balance after (-12 500 + 30 000)`);
        assert.ok(out.includes(w.clientIn));
        assert.equal(radios(html), 3, `${lang}: money entering the Caisse offers three reasons`);
    }

    // 4. « Other » asks for the reason in words, in its own box; the optional note box goes away.
    {
        const html = adjustmentWindow(lang, { adjustmentReason: 'other' });
        assert.equal(count(html, 'id="adjustment_reason_note"'), 1);
        assert.equal(count(html, 'id="adjustment_notes"'), 0, `${lang}: one note box, not two`);
        assert.ok(text(html).includes(w.note), `${lang}: asks for the reason in words`);
        assert.equal(confirmOff(html, lang), true);
        const written = adjustmentWindow(lang, { adjustmentReason: 'other', adjustmentNote: 'erreur de saisie' });
        assert.equal(confirmOff(written, lang), false, `${lang}: Save is on once the reason is written`);
        const dflt = adjustmentWindow(lang, { adjustmentReason: 'other', adjustmentNote: 'Ajustement Trésorerie' });
        assert.equal(confirmOff(dflt, lang), true, `${lang}: the default note is not a reason`);
    }

    // 5. USDT and EUR: a purchase or a sale, or « other »; never a client.
    {
        const usdtIn = adjustmentWindow(lang, { adjustmentAsset: 'USDT', adjustmentTab: 'add', adjustmentAmount: '10' });
        assert.equal(radios(usdtIn), 2);
        assert.equal(count(usdtIn, lang === 'fr' ? '>Un achat<' : '>شراء<'), 1, `${lang}: a purchase is offered`);
        const eurOut = adjustmentWindow(lang, { adjustmentAsset: 'EUR', adjustmentTab: 'subtract', adjustmentAmount: '10' });
        assert.equal(radios(eurOut), 4);
        assert.ok(!text(eurOut).includes(w.clientOut), `${lang}: no client reason for EUR`);
        assert.equal(confirmOff(eurOut, lang), true);
        const eurOther = adjustmentWindow(lang, { adjustmentAsset: 'EUR', adjustmentTab: 'subtract', adjustmentAmount: '10', adjustmentReason: 'other', adjustmentNote: 'don offert' });
        assert.equal(confirmOff(eurOther, lang), false, `${lang}: EUR with a written reason can be saved`);
        const stale = adjustmentWindow(lang, { adjustmentAsset: 'USDT', adjustmentTab: 'add', adjustmentAmount: '10', adjustmentReason: 'client', adjustmentClientId: 'c4' });
        assert.equal(confirmOff(stale, lang), true, `${lang}: a reason the wallet does not offer cannot be saved`);
    }

    // 6. Editing a movement that exists: it stays an adjustment, so only the reasons that keep it one.
    {
        const edit = adjustmentWindow(lang, { editingTreasuryTx: { id: 't1', type: 'Retrait', source: 'BaridiMob', amount: 3000, timestamp: 1, date: '01/10/2026', time: '10:00' }, adjustmentReason: 'client', adjustmentClientId: 'c4' });
        assert.equal(radios(edit), 2, `${lang}: client or other`);
        assert.equal(confirmOff(edit, lang), false);
    }
}

// ---- The review list ----
const stamp = (n: number) => ({ timestamp: Date.UTC(2026, 9, n, 10), date: `${String(n).padStart(2, '0')}/10/2026`, time: '10:00' });
const treasury = (id: string, n: number, extra: Partial<TreasuryTx> = {}): TreasuryTx => ({ id, type: 'Retrait', source: 'BaridiMob', amount: 3_000, notes: 'Ajustement Trésorerie', ...stamp(n), ...extra }) as TreasuryTx;
const crypto = (id: string, n: number, extra: Partial<Tx> = {}): Tx => ({ id, type: 'Ajout Manuel', currency: 'EUR', quantity: 4.5, notes: 'Ajustement Manuel', ...stamp(n), ...extra }) as Tx;
const reviewRows = [
    treasury('t1', 2), treasury('t2', 3, { type: 'Ajout', source: 'Caisse', amount: 12_000 }), treasury('t3', 4, { notes: 'virement de Karim' }),
    treasury('t4', 5), treasury('t5', 6), treasury('t6', 7), treasury('t-client', 8), treasury('t-sale', 9, { linkedTxId: 'sale-1' }),
];
const reviewCrypto = [crypto('c1', 10), crypto('c-linked', 11, { linkedTxId: 'x' })];
const reviewReasons = [parseMovementReason('treasury_t1', buildMovementReasonData('treasury', 't1', 'erreur de saisie', 1_000, 'review'))!];
const reviewSection = (lang: Lang, props: Partial<React.ComponentProps<typeof MovementReviewSection>> = {}) => render(
    <MovementReviewSection treasuryTransactions={reviewRows} portfolioTransactions={reviewCrypto} clientRows={[{ linkedTxId: 't-client' }]} reasons={reviewReasons} ready onWriteReason={() => true} onLinkClient={noop} {...props}/>, lang);

for (const lang of ['fr', 'ar'] as const) {
    const fr = lang === 'fr';
    // Eight movements typed by hand: one has a client row, one belongs to a sale, one has a written reason,
    // so five treasury ones and one EUR one are left (t2..t6 and c1), the newest first, five shown.
    {
        const html = reviewSection(lang);
        const out = text(html);
        assert.match(out, fr ? /6 mouvement\(s\) sans raison/ : /6 حركة بلا سبب/, `${lang}: the count`);
        assert.equal(count(html, '<li '), 5, `${lang}: five rows, then « see all »`);
        assert.match(out, fr ? /Voir tout \(6\)/ : /عرض الكل \(6\)/);
        assert.match(out, fr ? /Entrée/ : /دخول/);
        assert.equal(count(html, fr ? '>Rattacher à un client</button>' : '>اربطها بعميل</button>'), 4, `${lang}: a cash row can be attached to a client`);
        assert.equal(count(html, fr ? '>Écrire la raison</button>' : '>اكتب السبب</button>'), 5);
        assert.match(out, /4,50/, `${lang}: the EUR movement keeps its decimals`);
        assert.doesNotMatch(out, /erreur de saisie/, `${lang}: the explained one is kept apart, closed`);
        assert.match(out, fr ? /Mouvements expliqués par une raison écrite · 1 mouvement\(s\) à relire/ : /حركات سببها مكتوب · 1 حركة للمراجعة/);
    }
    {
        const all = reviewSection(lang, { defaultOpenAll: true });
        assert.equal(count(all, '<li '), 6, `${lang}: all six`);
        assert.match(text(all), fr ? /Note saisie : virement de Karim/ : /الملاحظة عند التسجيل: virement de Karim/, `${lang}: a note that says something is shown`);
    }
    // Nothing left to explain: a quiet line.
    {
        const html = reviewSection(lang, { treasuryTransactions: [treasury('t-client', 8)], portfolioTransactions: [], reasons: [] });
        assert.match(text(html), fr ? /Aucun mouvement sans raison/ : /لا توجد حركات بلا سبب/);
        assert.equal(count(html, '<li '), 0);
    }
    // Cached figures: nothing is shown until the server answered.
    assert.equal(reviewSection(lang, { ready: false }), '', `${lang}: not shown from the cache`);
}

console.log('adjustmentReason tests passed');
