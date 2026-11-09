import assert from 'node:assert/strict';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LanguageProvider } from '../../contexts/LanguageContext';
import { CurrencyVisibilityProvider } from '../../contexts/CurrencyVisibilityContext';
import { RmbTradeDialog } from './RmbTradeDialog';
import { NewTransactionMenuDialog } from '../transactions/NewTransactionMenuDialog';
import { isRmbOperation } from '../../utils/rmbTrade';
import type { ClientDzd } from '../../types';

// V13-3: the RMB window opens on its source (dinars, EUR, USDT), like the USDT one; with dinars the payment is never
// chosen for the owner; with EUR or USDT there is no payment to choose (a conversion). EUR hidden: not offered.

const storage = new Map<string, string>();
(globalThis as { window?: unknown }).window = {
    localStorage: { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => { storage.set(k, v); }, removeItem: (k: string) => { storage.delete(k); } },
    matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }),
};
(globalThis as unknown as { localStorage: unknown }).localStorage = (globalThis as unknown as { window: { localStorage: unknown } }).window.localStorage;
const render = (lang: 'fr' | 'ar', node: ReactElement, showEur = true) => {
    storage.set('app_lang', lang);
    return renderToStaticMarkup(<LanguageProvider><CurrencyVisibilityProvider showEur={showEur}>{node}</CurrencyVisibilityProvider></LanguageProvider>);
};
const noop = () => undefined;
const holdings = { RMB: { available: 6_600, avgBuy: 36.6 }, USDT: { available: 200, avgBuy: 256.2 }, EUR: { available: 0, avgBuy: 0 } };
const clients = [{ id: 'c1', fullName: 'Client test' }] as unknown as ClientDzd[];
const dialog = (kind: 'buy' | 'sell', initialSource: 'DZD' | 'EUR' | 'USDT' | null = null) => <RmbTradeDialog kind={kind} onClose={noop} onSwitch={noop} holdings={holdings} clientsDzd={clients} openClientModal={noop} fieldBase="" onSave={async () => true} parseAndEvaluate={(v) => Number(v)} initialSource={initialSource}/>;

for (const lang of ['fr', 'ar'] as const) {
    const buy = render(lang, dialog('buy'));
    for (const label of lang === 'fr' ? ['Achat avec DZD', 'Achat avec EUR', 'Achat avec USDT'] : ['شراء بالدينار', 'شراء باليورو', 'شراء بالـ USDT'])
        assert.ok(buy.includes(label), `${lang}: buy source ${label}`);
    assert.ok(!buy.includes('>USDT</button>') && buy.includes(lang === 'fr' ? 'Achat RMB' : 'شراء RMB'), `${lang}: no currency switch, the title says Buy RMB`);
    assert.ok(buy.includes('6 600,00 RMB') || buy.includes('6 600,00 RMB'), `${lang}: the RMB balance`);
    const sell = render(lang, dialog('sell'));
    for (const label of lang === 'fr' ? ['Vente avec DZD', 'Vente avec EUR', 'Vente avec USDT'] : ['بيع بالدينار', 'بيع مقابل يورو', 'بيع مقابل USDT'])
        assert.ok(sell.includes(label), `${lang}: sell source ${label}`);
    const noEur = render(lang, dialog('buy'), false);
    assert.ok(!noEur.includes(lang === 'fr' ? 'Achat avec EUR' : 'شراء باليورو'), `${lang}: EUR hidden, not a source`);
}
// With dinars: no payment chosen (needs a client first: the cards show once one is picked, as in the USDT window).
const dzd = render('fr', dialog('sell', 'DZD'));
assert.ok(dzd.includes('Prix de 1 RMB (DZD)') && dzd.includes('Montant total (DZD)'), 'with dinars: the price and the total');
assert.ok(dzd.includes('Choisissez le client'), 'the client first');
const usdt = render('fr', dialog('buy', 'USDT'));
assert.ok(usdt.includes('Montant payé (USDT)'), 'with USDT: what was paid');
assert.ok(!usdt.includes('role="radio"'), 'a conversion has no payment to choose');

// V13-4: EUR bought with USDT: the three linked fields (quantity, rate, amount paid), no payment to choose.
const eurWithUsdt = render('fr', <RmbTradeDialog kind="buy" currency="EUR" initialSource="USDT" onClose={noop} onSwitch={noop} holdings={holdings} clientsDzd={clients} openClientModal={noop} fieldBase="" onSave={async () => true} parseAndEvaluate={(v) => Number(v)}/>);
for (const label of ['Quantité (EUR)', 'Taux : 1 USDT = ? EUR', 'Montant payé (USDT)'])
    assert.ok(eurWithUsdt.includes(label), `three fields: ${label}`);
assert.ok(!eurWithUsdt.includes('role="radio"'), 'a conversion has no payment to choose');
const rmbDzd = render('ar', dialog('buy', 'DZD'));
for (const label of ['الكمية (RMB)', 'سعر 1 RMB (دج)', 'المبلغ الكلي (دج)'])
    assert.ok(rmbDzd.includes(label), `dinars: ${label}`);

// The menu: RMB tiles unless hidden.
const menu = (showRmb: boolean) => renderToStaticMarkup(<NewTransactionMenuDialog isOpen onClose={noop} t={(k) => k} openForm={noop} openWalletTransferModal={noop} openTransferModal={noop} openAdjustmentModal={noop} openDeliveryExpenseModal={noop} showRmb={showRmb} openRmb={noop}/>);
assert.equal(menu(true).split('>RMB</p>').length - 1, 1, 'one RMB row (buy and sell)');
assert.equal(menu(false).split('>RMB</p>').length - 1, 0, 'RMB hidden');

// Editing: RMB operations are not opened in the USDT / EUR window.
assert.equal(isRmbOperation({ currency: 'RMB' }), true);
assert.equal(isRmbOperation({ currency: 'USDT', conversionFrom: 'RMB' }), true, 'USDT received for RMB');
assert.equal(isRmbOperation({ currency: 'USDT' }), false);
assert.equal(isRmbOperation({ currency: 'USDT', purchaseFundingCurrency: 'EUR' } as never), false, 'the old USDT bought with EUR stays editable');
console.log('RmbTradeDialog.test: sources, payment never chosen, EUR and RMB hiding, edit guard');
