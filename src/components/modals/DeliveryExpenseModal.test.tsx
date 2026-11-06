import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { LanguageProvider } from '../../contexts/LanguageContext';
import { DeliveryExpenseModal } from './DeliveryExpenseModal';

// V12-12: a project expense needs who was paid; Save stays off until it is written.
const storage = new Map<string, string>([['app_lang', 'fr']]);
(globalThis as { window?: unknown }).window = { localStorage: { getItem: (k: string) => storage.get(k) ?? null, setItem() {}, removeItem() {} }, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) };
(globalThis as unknown as { localStorage: unknown }).localStorage = (globalThis as unknown as { window: { localStorage: unknown } }).window.localStorage;
(globalThis as { document?: unknown }).document = undefined;
const noop = () => undefined;
const render = (payee: string) => renderToStaticMarkup(<LanguageProvider><DeliveryExpenseModal isOpen onClose={noop} isSaving={false} amount="2500" setAmount={noop} method="Caisse" setMethod={noop} date="" setDate={noop} note="" setNote={noop} payee={payee} setPayee={noop} treasuryStats={{ caisse: 100_000, baridi: 0 } as never} portfolioStats={{ usdt: { available: 0 }, eur: { available: 0 } } as never} preview={null} onSave={noop}/></LanguageProvider>);
const saveOff = (html: string) => /<button[^>]*disabled=""[^>]*>[^<]*Enregistrer/.test(html);
assert.ok(render('').includes('Payé à'), 'asks who was paid');
assert.equal(saveOff(render('')), true, 'no payee: Save off');
assert.equal(saveOff(render('Yalidine')), false, 'payee written: Save on');
console.log('DeliveryExpenseModal tests passed');
