import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LanguageProvider } from '../../contexts/LanguageContext';
import { ClientConfirmationView } from './ClientConfirmation';
import { buildClientConfirmationData, type ClientConfirmation } from '../../utils/clientConfirmation';
import type { ClientDzd, ClientTransactionDzd } from '../../types';

// V5-3: « confirm the client's balance », the row on the client page and its window. Display only:
// the window compares what the client says with the app, lists the operations since they last
// agreed, and offers the transfer another client's opposite gap points to.

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
const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.now();
const stamp = (daysAgo: number) => {
    const timestamp = NOW - daysAgo * DAY;
    const d = new Date(timestamp);
    const p = (n: number) => String(n).padStart(2, '0');
    return { timestamp, date: `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`, time: `${p(d.getHours())}:${p(d.getMinutes())}` };
};
const client = (id: string, fullName: string) => ({ id, fullName, nom: fullName, isActive: true }) as unknown as ClientDzd;
const nadia = client('nadia', 'Nadia Cherif');
const sofiane = client('sofiane', 'Sofiane Brahimi');
const row = (id: string, clientId: string, daysAgo: number, montant: number, type: ClientTransactionDzd['type'], extra: Partial<ClientTransactionDzd> = {}) =>
    ({ id, clientId, montant, type, ...stamp(daysAgo), ...extra }) as ClientTransactionDzd;
const confirmation = (id: string, clientId: string, claimed: number, appBalance: number, daysAgo: number): ClientConfirmation =>
    ({ id, ...buildClientConfirmationData(clientId, claimed, appBalance, stamp(daysAgo))! });

const rows = [
    row('t1', 'nadia', 30, -85_000, 'Solde Initial'),
    row('t2', 'nadia', 6, -52_400, 'Vente USDT', { paymentMethod: 'Crédit' }),
    row('t3', 'nadia', 2, 12_000, 'Règlement Reçu', { paymentMethod: 'Espèces' }),
];
const render = (lang: Lang, props: Partial<React.ComponentProps<typeof ClientConfirmationView>> = {}) => {
    storage.set('app_lang', lang);
    return renderToStaticMarkup(<LanguageProvider><ClientConfirmationView confirmations={[]} onSave={noop} client={nadia} balance={-52_400} balances={new Map([['nadia', -52_400], ['sofiane', 0]])} clients={[nadia, sofiane]} getClientFullName={(c) => (c as unknown as { fullName: string }).fullName} clientTransactions={rows} onEditOperation={noop} onRecordTransfer={noop} {...props}/></LanguageProvider>);
};
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/[⁦⁩]/g, '').replace(/[\s  ]+/g, ' ');
const count = (html: string, needle: string) => html.split(needle).length - 1;

for (const lang of ['fr', 'ar'] as const) {
    const fr = lang === 'fr';

    // 1. The row on the client page: never confirmed, then with the last confirmation. The window stays closed.
    {
        const html = render(lang);
        assert.match(text(html), fr ? /Confirmer le solde avec le client/ : /أكّد العميل رصيده/, `${lang}: the row`);
        assert.match(text(html), fr ? /Comparez ce que dit le client/ : /قارن ما يقوله العميل/, `${lang}: hint when never confirmed`);
        assert.doesNotMatch(text(html), fr ? /Dans l’application/ : /في التطبيق/, `${lang}: window closed`);
        const withLast = render(lang, { confirmations: [confirmation('c1', 'nadia', -51_200, -52_400, 3)] });
        assert.match(text(withLast), fr ? /Dernière confirmation : \d\d\/\d\d\/\d{4}, écart de \+1 200 DZD/ : /آخر تأكيد: \d\d\/\d\d\/\d{4}، فرق \+1 200 DZD/, `${lang}: last confirmation with its gap`);
        const matched = render(lang, { confirmations: [confirmation('c1', 'nadia', -52_400, -52_400, 3)] });
        assert.match(text(matched), fr ? /tout concordait/ : /كان كل شيء متطابقاً/, `${lang}: last confirmation agreed`);
    }

    // 2. Open, nothing typed: the app's balance in words, the side already on « debt », nothing to save.
    {
        const html = render(lang, { defaultOpen: true });
        const out = text(html);
        assert.match(out, fr ? /Dans l’application : le client vous doit 52 400 DZD/ : /في التطبيق: العميل مدين لك بـ 52 400 DZD/, `${lang}: the app's balance in words`);
        assert.match(html, /aria-pressed="true"[^>]*>[^<]*(Il me doit|عليه لي)/, `${lang}: debt is chosen for a client who owes`);
        assert.match(html, new RegExp(`<button[^>]*\\sdisabled=""[^>]*>${fr ? 'Enregistrer la confirmation' : 'احفظ التأكيد'}</button>`), `${lang}: save is off until an amount is typed`);
        assert.doesNotMatch(out, fr ? /Écart/ : /الفرق/, `${lang}: no gap yet`);
    }

    // 3. The client says the same: agreement, no operations listed.
    {
        const out = text(render(lang, { defaultOpen: true, initialSide: 'debt', initialAmount: '52400' }));
        assert.match(out, fr ? /Le client et l’application sont d’accord/ : /العميل والتطبيق متفقان/, `${lang}: agreement`);
        assert.doesNotMatch(out, fr ? /opération\(s\)/ : /عملية مسّت/, `${lang}: nothing to look for`);
    }

    // 4. The client says 40 400: a gap of +12 000 and the operations that touched the balance since the last agreement.
    {
        const html = render(lang, { defaultOpen: true, initialSide: 'debt', initialAmount: '40400', confirmations: [confirmation('c0', 'nadia', -85_000, -85_000, 20)] });
        const out = text(html);
        assert.match(out, fr ? /Le client dit : le client vous doit 40 400 DZD\. L’application dit : le client vous doit 52 400 DZD\. Écart : \+12 000 DZD\./ : /العميل يقول: العميل مدين لك بـ 40 400 DZD\. التطبيق يقول: العميل مدين لك بـ 52 400 DZD\. الفرق: \+12 000 DZD\./, `${lang}: the gap in words`);
        assert.match(out, fr ? /2 opération\(s\) ont touché ce solde depuis le \d\d\/\d\d\/\d{4}, dernier accord/ : /2 عملية مسّت هذا الرصيد منذ \d\d\/\d\d\/\d{4}، آخر اتفاق/, `${lang}: two operations since the last agreement`);
        assert.equal(count(html, fr ? '>Modifier</button>' : '>عدّل</button>'), 2, `${lang}: an edit button for each`);
        assert.match(out, /\+12 000 DZD/);
        assert.match(out, /-52 400 DZD/, `${lang}: the sale's effect on the balance`);
        assert.doesNotMatch(html, new RegExp(`<button[^>]*\\sdisabled=""[^>]*>${fr ? 'Enregistrer la confirmation' : 'احفظ التأكيد'}</button>`), `${lang}: save is on`);
    }

    // 5. The other client says the opposite: a transfer is suggested, from the one who says more than the app.
    {
        const sofianeSaid = confirmation('s1', 'sofiane', -12_000, 0, 1);
        const html = render(lang, { defaultOpen: true, initialSide: 'debt', initialAmount: '40400', confirmations: [sofianeSaid] });
        const out = text(html);
        assert.match(out, fr ? /Un virement entre clients a peut-être été oublié/ : /ربما نُسي تحويل بين عميلين/, `${lang}: transfer suggestion`);
        assert.match(out, fr ? /Sofiane Brahimi a l’écart inverse \(-12 000 DZD\)\. De Nadia Cherif vers Sofiane Brahimi, 12 000 DZD\./ : /عند Sofiane Brahimi فرق معاكس \(-12 000 DZD\)\. من Nadia Cherif إلى Sofiane Brahimi، 12 000 DZD\./, `${lang}: from the client who says more, to the one who says less`);
        assert.equal(count(html, fr ? '>Enregistrer ce virement</button>' : '>سجّل هذا التحويل</button>'), 1);
        // Without the other client's gap, or when this one agrees, no suggestion.
        assert.doesNotMatch(text(render(lang, { defaultOpen: true, initialSide: 'debt', initialAmount: '40400' })), fr ? /virement entre clients/ : /تحويل بين عميلين/, `${lang}: nobody else has a gap`);
        assert.doesNotMatch(text(render(lang, { defaultOpen: true, initialSide: 'debt', initialAmount: '52400', confirmations: [sofianeSaid] })), fr ? /virement entre clients/ : /تحويل بين عميلين/, `${lang}: this client agrees`);
        // A gap Sofiane's balance has since closed is not offered.
        assert.doesNotMatch(text(render(lang, { defaultOpen: true, initialSide: 'debt', initialAmount: '40400', confirmations: [sofianeSaid], balances: new Map([['nadia', -52_400], ['sofiane', -12_000]]) })), fr ? /virement entre clients/ : /تحويل بين عميلين/, `${lang}: closed gap`);
    }

    // 6. Garbage typed is flagged and cannot be saved.
    {
        const html = render(lang, { defaultOpen: true, initialAmount: 'abc' });
        assert.match(text(html), fr ? /Saisissez un montant valide/ : /اكتب مبلغاً صحيحاً/, `${lang}: invalid flagged`);
        assert.match(html, new RegExp(`<button[^>]*\\sdisabled=""[^>]*>${fr ? 'Enregistrer la confirmation' : 'احفظ التأكيد'}</button>`), `${lang}: save is off`);
    }

    // 7. An advance client: the side starts on « I owe him ».
    {
        const html = render(lang, { defaultOpen: true, balance: 30_000, balances: new Map([['nadia', 30_000]]) });
        assert.match(text(html), fr ? /vous devez 30 000 DZD au client/ : /أنت مدين للعميل بـ 30 000 DZD/, `${lang}: advance in words`);
        assert.match(html, /aria-pressed="true"[^>]*>[^<]*(Je lui dois|له عندي)/, `${lang}: advance is chosen`);
    }
}

console.log('ClientConfirmation tests passed');
