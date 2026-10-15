import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { LanguageProvider } from '../../contexts/LanguageContext';
import { ClientWhatsAppDialog } from './ClientWhatsAppDialog';

// V8-1b: « Rappel WhatsApp » of the client page opens a window with the message as the client will
// read it and a choice Arabic / French. Arabic until a language is remembered for the client,
// whatever the app's language; a remembered language wins; the window says only the client's own
// balance.

const storage = new Map<string, string>();
const localStorage = {
    getItem: (key: string) => (storage.has(key) ? storage.get(key)! : null),
    setItem: (key: string, value: string) => { storage.set(key, String(value)); },
    removeItem: (key: string) => { storage.delete(key); },
};
(globalThis as { window?: unknown }).window = { localStorage, matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }) };
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: localStorage });

const NOW = new Date(2026, 9, 15, 10, 30);
const render = (appLang: 'ar' | 'fr', props: { phone?: string; balance?: number; clientId?: string } = {}) => {
    storage.set('app_lang', appLang);
    return renderToStaticMarkup(<LanguageProvider>
      <ClientWhatsAppDialog onClose={() => {}} clientId={props.clientId ?? 'c1'} clientName="Amine Kaci" balance={props.balance ?? -85_000} phone={props.phone === undefined ? '0555001122' : props.phone} now={NOW}/>
    </LanguageProvider>);
};
const message = (html: string) => (html.match(/data-testid="whatsapp-message"[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? '').replace(/&#x27;/g, '\'');
const pressed = (html: string) => html.match(/aria-pressed="true"[^>]*>(?:<span[^>]*>)?([^<]+)</)?.[1];

// No choice yet: Arabic, in a French app as in an Arabic one.
for (const appLang of ['fr', 'ar'] as const) {
    const html = render(appLang);
    assert.match(message(html), /^السلام عليكم Amine Kaci/, `${appLang} app: the message is in Arabic by default`);
    assert.match(html, /data-testid="whatsapp-message"[^>]*dir="rtl"|dir="rtl"[^>]*data-testid="whatsapp-message"/, `${appLang} app: the Arabic message reads right to left`);
    assert.equal(pressed(html), 'العربية', `${appLang} app: Arabic is the chosen language`);
    assert.match(html, appLang === 'fr' ? /Langue du message/ : /لغة الرسالة/, `${appLang} app: the window itself speaks the app language`);
    assert.match(html, appLang === 'fr' ? /Aperçu du message/ : /معاينة الرسالة/);
    assert.match(html, appLang === 'fr' ? />Envoyer</ : />إرسال</, `${appLang} app: a client with a number opens WhatsApp`);
    assert.match(message(html), /85[\s\u00A0\u202F]000,00 DZD/, 'the client\'s own balance');
}

// A remembered language wins, per client.
storage.set('client_report_lang_c1', 'fr');
const french = render('ar');
assert.match(message(french), /^Bonjour Amine Kaci/, 'the client reads French: French, even from an Arabic app');
assert.equal(pressed(french), 'Français');
assert.match(message(french), /Solde restant à régler : 85[\s\u00A0\u202F]000,00 DZD/);
assert.match(message(render('ar', { clientId: 'c2' })), /^السلام عليكم/, 'another client is still in Arabic');
storage.delete('client_report_lang_c1');

// No usable number: the message is copied or shared instead.
for (const phone of ['', '   ', 'N/A']) {
    const html = render('fr', { phone });
    assert.match(html, />Copier</, `no usable number (${JSON.stringify(phone)}): copy, not « open »`);
    assert.doesNotMatch(html, />Envoyer</);
}

// Only what belongs to the client.
for (const appLang of ['fr', 'ar'] as const) {
    const html = render(appLang, { balance: 12_500 });
    assert.doesNotMatch(html.replace(/<[^>]+>/g, ' '), /profit|PAM|ربح/i, 'nothing of ours');
    assert.match(message(html), /12[\s\u00A0\u202F]500,00 DZD/, 'a credit is a plain note with the amount');
}

console.log('client WhatsApp window tests passed');
