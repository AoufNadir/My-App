import assert from 'node:assert/strict';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LanguageProvider } from '../../contexts/LanguageContext';
import { ClientDeliveries, deliveryMessage } from './ClientDeliveries';
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
console.log('ClientDeliveries tests passed');
