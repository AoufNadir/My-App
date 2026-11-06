import assert from 'node:assert/strict';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LanguageProvider } from '../../contexts/LanguageContext';
import { ClientDeliveries, deliveryMessage, statementMessage } from './ClientDeliveries';
import type { DeliveryDoc } from '../../utils/deferredDelivery';

// V12-2 on the client's page: sold, delivered and left, and the WhatsApp message after a delivery.
const storage = new Map<string, string>();
(globalThis as { window?: unknown }).window = { localStorage: { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => { storage.set(k, v); }, removeItem() {} }, matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }) };
(globalThis as unknown as { localStorage: unknown }).localStorage = (globalThis as unknown as { window: { localStorage: unknown } }).window.localStorage;
const render = (lang: 'fr' | 'ar', node: ReactElement) => { storage.set('app_lang', lang); return renderToStaticMarkup(<LanguageProvider>{node}</LanguageProvider>); };
const docs: DeliveryDoc[] = [
    { id: 'a', kind: 'commitment', clientId: 'c1', currency: 'USDT', quantity: 3_906.25, timestamp: 1, saleTxId: 's1' },
    { id: 'b', kind: 'delivery', clientId: 'c1', currency: 'USDT', quantity: 200, timestamp: 2 },
    { id: 'c', kind: 'commitment', clientId: 'c2', currency: 'USDT', quantity: 50, timestamp: 1 },
];
for (const lang of ['fr', 'ar'] as const) {
    const html = render(lang, <ClientDeliveries clientId="c1" clientName="Client Test" docs={docs} saleIds={new Set(['s1'])} onRecord={() => undefined}/>);
    for (const shown of ['3 906,25', '200,00', '3 706,25'])
        assert.ok(html.replace(/ | /g, ' ').includes(shown), `${lang}: ${shown}`);
    assert.ok(!html.includes('>50,00<'), `${lang}: another client's sale is not shown`);
}
const fr = deliveryMessage('fr', 'Client Test', { committed: 3_906.25, delivered: 500, remaining: 3_406.25, currency: 'USDT' }, 300).replace(/ | /g, ' ');
assert.ok(fr.includes('300,00 USDT') && fr.includes('500,00 USDT') && fr.includes('3 406,25 USDT'), 'the message says what was sent, in total, and what is left');
assert.ok(deliveryMessage('ar', 'Client Test', { committed: 10, delivered: 10, remaining: 0, currency: 'EUR' }, 10).includes('الباقي'));
// Each line can be removed (a trash button per line), the labels say « to send / sent / left ».
{
    const html = render('fr', <ClientDeliveries clientId="c1" clientName="X" docs={docs} saleIds={new Set(['s1'])} onRecord={() => undefined} onRemove={() => undefined}/>);
    assert.equal((html.match(/aria-label="Supprimer"/g) || []).length, 2, 'one trash button per line');
    for (const label of ['À envoyer au total', 'Envoyé', 'Reste à envoyer'])
        assert.ok(html.includes(label), label);
    assert.ok(html.includes('+ Ajouter une autre quantité à envoyer'), 'more can be added');
}
// Adding: the client's sales are offered, newest first, without the one already followed; the send field is hidden meanwhile.
{
    const sales = [
        { id: 's9', currency: 'USDT' as const, quantity: 3_906.25, timestamp: Date.UTC(2026, 10, 2) },
        { id: 's1', currency: 'USDT' as const, quantity: 5_088.06, timestamp: Date.UTC(2026, 9, 27) },
    ];
    const html = render('fr', <ClientDeliveries clientId="c1" clientName="X" docs={docs} saleIds={new Set(['s1', 's9'])} onRecord={() => undefined} sales={sales} defaultOpen/>);
    assert.ok(html.includes('Quelle vente n’est pas encore envoyée ?'));
    assert.ok(html.replace(/\u202f|\u00a0/g, ' ').includes('3 906,25 USDT'), 'the sale not followed yet is offered');
    assert.ok(!html.replace(/\u202f|\u00a0/g, ' ').includes('5 088,06 USDT'), 'the sale already followed is not offered again');
    assert.ok(!html.includes('Quantité envoyée'), 'one action at a time: no send field while adding');
}
// The statement at any time: just sold, part sent, all sent.
{
    const clean = (text: string) => text.replace(/\u202f|\u00a0|\u2066|\u2069/g, ' ').replace(/ +/g, ' ');
    assert.ok(clean(statementMessage('fr', 'X', { committed: 3_906.25, delivered: 0, remaining: 3_906.25, currency: 'USDT' })).includes('réservé'), 'just sold: held for the client');
    const part = clean(statementMessage('ar', 'X', { committed: 3_906.25, delivered: 500, remaining: 3_406.25, currency: 'USDT' }));
    assert.ok(part.includes('500,00') && part.includes('3 406,25'), 'part sent: sent and left');
    assert.ok(clean(statementMessage('fr', 'X', { committed: 10, delivered: 10, remaining: 0, currency: 'EUR' })).includes('Plus rien'), 'all sent');
    const html = render('fr', <ClientDeliveries clientId="c1" clientName="X" docs={docs} saleIds={new Set(['s1'])} onRecord={() => undefined}/>);
    assert.ok(html.includes('Envoyer le relevé sur WhatsApp'), 'the statement button is always there');
}
console.log('ClientDeliveries tests passed');
