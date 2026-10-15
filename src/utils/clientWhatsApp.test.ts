import assert from 'node:assert/strict';

import { clientReportLanguage } from '../components/reports/reportLanguage';
import { clientWhatsAppMessage, clientWhatsAppMessageFor, openClientWhatsApp } from './clientWhatsApp';
import { openWhatsAppChooser, openWhatsAppMessenger } from './whatsapp';

// V8-1: a WhatsApp button on every client row, and a gentler reminder in the client page. The
// message greets first, then says the state of the client's own account, in the language that
// client reads. This test pins the words, the amounts, the language choice and the links opened.

const NB = ' ';
const morning = new Date(2026, 9, 15, 10, 30);
const evening = new Date(2026, 9, 15, 19, 0);

// ---- Arabic: owes / credit / settled ----
assert.equal(
    clientWhatsAppMessage({ name: 'Amine Kaci', balance: -85_000, lang: 'ar', now: morning }),
    [
        'السلام عليكم Amine Kaci 🌹',
        'نتمنى أن تكونوا بأفضل حال.',
        '',
        'تذكير لطيف بحسابكم لدينا بتاريخ 15/10/2026:',
        `المبلغ المتبقي في ذمتكم: 85${NB}000,00 DZD`,
        '',
        'يمكنكم تسويته في الوقت المناسب لكم، ونبقى في خدمتكم دائماً.',
        'شكراً لثقتكم 🙏',
    ].join('\n'),
);
assert.equal(
    clientWhatsAppMessage({ name: 'Sara Belkacem', balance: 15_000.5, lang: 'ar', now: morning }),
    [
        'السلام عليكم Sara Belkacem 🌹',
        'نتمنى أن تكونوا بأفضل حال.',
        '',
        'للعلم، حسابكم لدينا بتاريخ 15/10/2026 في صالحكم:',
        `الرصيد المتوفر لكم: 15${NB}000,50 DZD`,
        '',
        'نبقى في خدمتكم متى شئتم.',
        'شكراً لثقتكم 🙏',
    ].join('\n'),
);
assert.equal(
    clientWhatsAppMessage({ name: 'Yacine Mansouri', balance: 0, lang: 'ar', now: morning }),
    [
        'السلام عليكم Yacine Mansouri 🌹',
        'نتمنى أن تكونوا بأفضل حال.',
        '',
        'حسابكم لدينا مسوّى بتاريخ 15/10/2026، ولا شيء مستحق.',
        '',
        'نبقى في خدمتكم متى شئتم.',
        'شكراً لثقتكم 🙏',
    ].join('\n'),
);

// ---- French: owes / credit / settled, Bonsoir after 18:00 ----
assert.equal(
    clientWhatsAppMessage({ name: 'Amine Kaci', balance: -85_000, lang: 'fr', now: morning }),
    [
        'Bonjour Amine Kaci 🌹',
        "J'espère que vous allez bien.",
        '',
        'Petit rappel amical concernant votre compte chez nous au 15/10/2026 :',
        `Solde restant à régler : 85${NB}000,00 DZD`,
        '',
        'Vous pouvez le régulariser quand cela vous convient, nous restons à votre disposition.',
        'Merci pour votre confiance 🙏',
    ].join('\n'),
);
assert.equal(
    clientWhatsAppMessage({ name: 'Sara Belkacem', balance: 2_500.5, lang: 'fr', now: evening }),
    [
        'Bonsoir Sara Belkacem 🌹',
        "J'espère que vous allez bien.",
        '',
        'Pour information, votre compte chez nous au 15/10/2026 est en votre faveur :',
        `Solde disponible pour vous : 2${NB}500,50 DZD`,
        '',
        'Nous restons à votre disposition.',
        'Merci pour votre confiance 🙏',
    ].join('\n'),
);
assert.equal(
    clientWhatsAppMessage({ name: 'Yacine Mansouri', balance: 0, lang: 'fr', now: morning }),
    [
        'Bonjour Yacine Mansouri 🌹',
        "J'espère que vous allez bien.",
        '',
        'Votre compte chez nous est à jour au 15/10/2026 : rien à régler.',
        '',
        'Nous restons à votre disposition.',
        'Merci pour votre confiance 🙏',
    ].join('\n'),
);

// ---- The account is read in cents, like every balance in the app ----
for (const lang of ['ar', 'fr'] as const) {
    const dust = clientWhatsAppMessage({ name: 'X', balance: -0.004, lang, now: morning });
    assert.equal(dust, clientWhatsAppMessage({ name: 'X', balance: 0, lang, now: morning }), 'less than half a centime is a settled account');
    assert.ok(!/DZD/.test(dust), 'a settled account carries no amount');
    const cent = clientWhatsAppMessage({ name: 'X', balance: -0.01, lang, now: morning });
    assert.match(cent, /0,01 DZD/, 'one centime owed is still owed');
    assert.equal(clientWhatsAppMessage({ name: 'X', balance: Number.NaN, lang, now: morning }), dust, 'a broken balance never prints NaN');
}
assert.ok(clientWhatsAppMessage({ name: '  Amine Kaci  ', balance: -10, lang: 'fr', now: morning }).startsWith('Bonjour Amine Kaci 🌹'), 'the name is trimmed');
// Only the client's own balance: nothing about us (price, profit, notes) and no one else.
for (const lang of ['ar', 'fr'] as const) {
    const text = clientWhatsAppMessage({ name: 'Amine Kaci', balance: -85_000, lang, now: morning });
    assert.ok(!/profit|ربح|PAM|USDT|EUR/i.test(text));
    assert.equal(text.split('\n').filter((line) => /DZD/.test(line)).length, 1, 'one amount, the balance');
}

// ---- The message's language: the one remembered for the client, else Arabic (whatever the app's language) ----
const store = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (key: string) => (store.has(key) ? store.get(key)! : null), setItem: (key: string, value: string) => { store.set(key, value); } },
});
const target = { clientId: 'c1', name: 'Amine Kaci', balance: -85_000 };
assert.match(clientWhatsAppMessageFor(target, morning), /^السلام عليكم/, 'no choice yet: Arabic');
assert.equal(clientReportLanguage('c1'), 'ar', 'the default language of a client is Arabic');
store.set('client_report_lang_c1', 'fr');
assert.match(clientWhatsAppMessageFor(target, morning), /^Bonjour/, 'the client reads French: French');
assert.equal(clientReportLanguage('c1'), 'fr');
store.set('client_report_lang_c1', 'ar');
assert.match(clientWhatsAppMessageFor(target, morning), /^السلام عليكم/, 'the client reads Arabic: Arabic');
assert.match(clientWhatsAppMessageFor({ ...target, clientId: 'c2' }, morning), /^السلام عليكم/, 'the choice is per client: another client is still in Arabic');
store.set('client_report_lang_c2', 'fr');
assert.match(clientWhatsAppMessageFor({ ...target, clientId: 'c2' }, morning), /^Bonjour/, 'and c2 can read French on his own');
store.set('client_report_lang_c1', 'xx');
assert.match(clientWhatsAppMessageFor(target, morning), /^السلام عليكم/, 'an unknown saved value is ignored: Arabic');
store.delete('client_report_lang_c1');
store.delete('client_report_lang_c2');

// ---- The links that open ----
function withDevice(userAgent: string, run: (opened: string[], navigated: () => string) => void) {
    const opened: string[] = [];
    const location = { href: '' };
    (globalThis as { window?: unknown }).window = { open: (url: string) => { opened.push(url); }, location };
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { userAgent } });
    run(opened, () => location.href);
}
const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/120 Mobile';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1';
const text = clientWhatsAppMessageFor({ ...target }, morning);
const encoded = encodeURIComponent(text);

withDevice(DESKTOP, (opened) => {
    openClientWhatsApp({ ...target, phone: '0555 00 11 22' }, morning);
    assert.deepEqual(opened, [`https://wa.me/213555001122?text=${encoded}`], 'desktop: the client\'s chat on WhatsApp Web, number in international form');
});
withDevice(DESKTOP, (opened) => {
    openClientWhatsApp({ ...target, phone: '+213 661 22 33 44' }, morning);
    assert.deepEqual(opened, [`https://wa.me/213661223344?text=${encoded}`], 'an international number keeps its digits');
});
withDevice(ANDROID, (opened, navigated) => {
    openClientWhatsApp({ ...target, phone: '0555001122' }, morning);
    assert.equal(navigated(), `intent://send?phone=213555001122&text=${encoded}#Intent;scheme=whatsapp;package=com.whatsapp;end`);
    assert.deepEqual(opened, []);
});
withDevice(IPHONE, (_opened, navigated) => {
    openClientWhatsApp({ ...target, phone: '0555001122' }, morning);
    assert.equal(navigated(), `whatsapp://send?phone=213555001122&text=${encoded}`);
});
// No phone saved (or digits-free): WhatsApp asks which contact, the text is ready.
for (const phone of [undefined, '', '   ', 'N/A']) {
    withDevice(DESKTOP, (opened) => {
        openClientWhatsApp({ ...target, phone }, morning);
        assert.deepEqual(opened, [`https://wa.me/?text=${encoded}`], `no usable number (${String(phone)}): contact chooser on the web`);
    });
}
withDevice(ANDROID, (_opened, navigated) => {
    openClientWhatsApp({ ...target }, morning);
    assert.equal(navigated(), `intent://send?text=${encoded}#Intent;scheme=whatsapp;package=com.whatsapp;end`);
});
withDevice(IPHONE, (_opened, navigated) => {
    openClientWhatsApp({ ...target }, morning);
    assert.equal(navigated(), `whatsapp://send?text=${encoded}`);
});
// The older entry points keep working as before (the phone line of the client page, the summary).
withDevice(DESKTOP, (opened) => {
    openWhatsAppMessenger('0555001122');
    assert.deepEqual(opened, ['https://wa.me/213555001122'], 'a chat without text');
    openWhatsAppMessenger('', 'salut');
    assert.equal(opened.length, 1, 'no number: nothing opens');
    openWhatsAppChooser('salut');
    assert.equal(opened[1], 'https://wa.me/?text=salut');
});
withDevice(ANDROID, (_opened, navigated) => {
    openWhatsAppMessenger('0555001122');
    assert.equal(navigated(), 'intent://send?phone=213555001122#Intent;scheme=whatsapp;package=com.whatsapp;end', 'without text the link is the one it always was');
});

console.log('client WhatsApp message tests passed');
