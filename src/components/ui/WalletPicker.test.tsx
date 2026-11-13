import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { CurrencyVisibilityProvider } from '../../contexts/CurrencyVisibilityContext';
import { FINANCIAL_WALLETS, WalletPicker, walletBalancesOf } from './WalletPicker';
import { assetWalletStats, computeProjectExpensePreview, getWalletRateToDzd, isAssetWallet, isLegacyAssetWallet } from '../../utils/digitalServiceAccounting';

// V13-5: the wallet list: one row per wallet with its balance, RMB included, nothing chosen for the owner,
// a hidden currency left out unless it is the one already saved.
const balances = walletBalancesOf({ caisse: 1_250_000, baridi: 480_000 }, { usdt: { available: 5_900 }, eur: { available: 1_200 }, rmb: { available: 6_600 } });
const render = (value: Parameters<typeof WalletPicker>[0]['value'], showEur = true, showRmb = true) => renderToStaticMarkup(<CurrencyVisibilityProvider hidden={[...(showEur ? [] : ["EUR"]), ...(showRmb ? [] : ["RMB"])]}>
  <WalletPicker value={value} onChange={() => undefined} wallets={FINANCIAL_WALLETS} labels={{ Caisse: 'Caisse', BaridiMob: 'BaridiMob' }} balances={balances} ariaLabel="Portefeuille" chooseLabel="Choisissez le portefeuille"/>
</CurrencyVisibilityProvider>);
const radios = (html: string) => (html.match(/role="radio"/g) || []).length;
const checked = (html: string) => (html.match(/aria-checked="true"/g) || []).length;

const none = render(null);
assert.equal(radios(none), 5, 'five wallets: cash box, BaridiMob, USDT, EUR, RMB');
assert.equal(checked(none), 0, 'nothing chosen for the owner');
assert.ok(none.includes('Choisissez le portefeuille'), 'asks to choose');
assert.ok(none.includes('6 600,00 RMB') || none.includes('6 600,00 RMB'), 'the RMB balance on its row');
assert.equal(checked(render('RMB')), 1);
assert.equal(radios(render(null, false, false)), 3, 'EUR and RMB hidden');
assert.equal(radios(render('EUR', false, false)), 4, 'a hidden currency already saved stays');

// RMB as a wallet: valued at its average price, like USDT and EUR; the diagnostics keep to USDT and EUR.
const rates = { usdtPma: 255, eurPma: 280, rmbPma: 36.5 };
assert.equal(getWalletRateToDzd('RMB', rates), 36.5);
assert.deepEqual(computeProjectExpensePreview({ wallet: 'RMB', amount: 200, rates }), { currency: 'RMB', rateToDzd: 36.5, amountDzd: 7_300 });
assert.equal(isAssetWallet('RMB'), true);
assert.equal(isLegacyAssetWallet('RMB'), false);
assert.deepEqual(assetWalletStats({ usdt: { available: 1 }, eur: { available: 2 }, rmb: { available: 3, avgBuy: 36.5 } }, 'RMB'), { available: 3, avgBuy: 36.5 });
assert.equal(computeProjectExpensePreview({ wallet: 'USDT', amount: 10, rates }).amountDzd, 2_550, 'USDT unchanged');
console.log('WalletPicker.test: one row per wallet with RMB, nothing chosen, hidden currencies, RMB valued at its PAM');
