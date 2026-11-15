import assert from 'node:assert/strict';
import { checkCustomCurrency, EXTRA_CURRENCY_CODES, isExtraCurrency, readCustomCurrencies, setCustomCurrencies, TRADE_CURRENCY_CODES } from './tradeCurrencies';
import { INVENTORY_ACCOUNTS, INVENTORY_TOLERANCE_CENTS } from '../utils/inventoryCheck';
import { FINANCIAL_WALLETS } from '../components/ui/WalletPicker';
import { SUBSCRIPTION_WALLETS } from '../utils/habits';
import { DELIVERY_CURRENCIES } from '../utils/deferredDelivery';
import { APP_EXTRA_CURRENCIES, computePamLedger } from '../utils/pamLedger';


// V15-1 (owner): a currency added from the settings joins every list at once, and works like RMB.
// 1. What the owner may type.
assert.deepEqual(checkCustomCurrency({ code: 'gbp', symbol: '£', nameFr: 'la livre', nameAr: 'الجنيه' }), { ok: true, currency: { code: 'GBP', symbol: '£', name: { fr: 'la livre', ar: 'الجنيه' }, custom: true } });
assert.equal((checkCustomCurrency({ code: 'G1', symbol: '£', nameFr: 'la livre', nameAr: 'الجنيه' }) as { reason: string }).reason, 'code');
assert.equal((checkCustomCurrency({ code: 'USDT', symbol: '$', nameFr: 'x y', nameAr: 'س ص' }) as { reason: string }).reason, 'taken');
assert.equal((checkCustomCurrency({ code: 'DZD', symbol: 'DA', nameFr: 'dinar', nameAr: 'دينار' }) as { reason: string }).reason, 'taken', 'the dinar is the base, never a traded currency');
assert.equal((checkCustomCurrency({ code: 'GBP', symbol: '', nameFr: 'la livre', nameAr: 'الجنيه' }) as { reason: string }).reason, 'symbol');
assert.equal((checkCustomCurrency({ code: 'GBP', symbol: '£', nameFr: 'la livre', nameAr: '' }) as { reason: string }).reason, 'name', 'no empty field (rule 11)');
// The user document read safely: a malformed entry or a duplicate is left out.
assert.deepEqual(readCustomCurrencies([{ code: 'GBP', symbol: '£', name: { fr: 'la livre', ar: 'الجنيه' } }, { code: 'GBP', symbol: '£', name: { fr: 'x', ar: 'y' } }, 'junk', null]).map((c) => c.code), ['GBP']);
assert.deepEqual(readCustomCurrencies(undefined), []);

// 2. Added: every list follows, the same arrays (the screens already hold them).
const accountsBefore = INVENTORY_ACCOUNTS;
assert.equal(setCustomCurrencies(readCustomCurrencies([{ code: 'GBP', symbol: '£', name: { fr: 'la livre', ar: 'الجنيه' } }])), true);
assert.equal(setCustomCurrencies(readCustomCurrencies([{ code: 'GBP', symbol: '£', name: { fr: 'la livre', ar: 'الجنيه' } }])), false, 'the same list twice: nothing to redraw');
assert.deepEqual(TRADE_CURRENCY_CODES, ['USDT', 'EUR', 'RMB', 'GBP']);
assert.deepEqual(EXTRA_CURRENCY_CODES, ['RMB', 'GBP']);
assert.ok(isExtraCurrency('GBP'), 'handled like RMB');
assert.equal(INVENTORY_ACCOUNTS, accountsBefore);
assert.ok(INVENTORY_ACCOUNTS.includes('gbp') && INVENTORY_TOLERANCE_CENTS.gbp === 1, 'counted in the inventory');
assert.ok(FINANCIAL_WALLETS.includes('GBP') && SUBSCRIPTION_WALLETS.includes('GBP') && DELIVERY_CURRENCIES.includes('GBP'), 'a wallet everywhere');
assert.ok(APP_EXTRA_CURRENCIES.includes('GBP'));
// The ledger keeps its own stock: never read as USDT.
const T = Date.UTC(2026, 10, 15);
const ledger = computePamLedger([
    { id: 'u', type: 'buy', currency: 'USDT', quantity: 10, price: 250, total: 2500, timestamp: T },
    { id: 'g', type: 'buy', currency: 'GBP', quantity: 100, price: 300, total: 30000, timestamp: T + 1 },
    { id: 's', type: 'sell', currency: 'GBP', quantity: 40, sell: 310, total: 12400, timestamp: T + 2 },
] as never, { nowMs: T + 10 });
assert.equal(ledger.portfolioStats.usdt.available, 10, 'USDT untouched');
assert.equal(ledger.holdings.GBP.available, 60);
assert.equal(ledger.holdings.GBP.avgBuy, 300);
assert.equal(ledger.profitByTxId.s.derivedProfit, 400);



// 3. Removed from the document (or another account): back to the built-in list.
assert.equal(setCustomCurrencies([]), true);
assert.deepEqual(TRADE_CURRENCY_CODES, ['USDT', 'EUR', 'RMB']);
assert.ok(!INVENTORY_ACCOUNTS.includes('gbp') && !FINANCIAL_WALLETS.includes('GBP'));
console.log('customCurrencies.test: a currency added in the settings joins every list and works like RMB');
