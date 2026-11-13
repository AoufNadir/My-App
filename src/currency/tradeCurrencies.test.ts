import assert from 'node:assert/strict';
import { TRADE_CURRENCIES, TRADE_CURRENCY_CODES } from './tradeCurrencies';
import { HIDEABLE_CURRENCIES } from '../utils/hiddenCurrencies';
import { DELIVERY_CURRENCIES } from '../utils/deferredDelivery';
import { INVENTORY_ACCOUNTS } from '../utils/inventoryCheck';
import { SUBSCRIPTION_WALLETS } from '../utils/habits';
import { computePeriodStats } from '../utils/analyticsPeriod';
import { computePamLedger } from '../utils/pamLedger';

// V14-3: the guard of « a new currency is one line ». Every place that lists currencies must know each one of the
// list; adding a currency to TRADE_CURRENCIES and forgetting a place makes this test fail and name the place.
for (const { code, symbol, name } of TRADE_CURRENCIES) {
    assert.ok(symbol && name.fr && name.ar, `${code}: symbol and names`);
    assert.ok(HIDEABLE_CURRENCIES.includes(code), `${code}: can be hidden in the settings`);
    assert.ok((DELIVERY_CURRENCIES as string[]).includes(code), `${code}: deferred delivery`);
    assert.ok((INVENTORY_ACCOUNTS as readonly string[]).includes(code.toLowerCase()), `${code}: a wallet in the inventory`);
    assert.ok(SUBSCRIPTION_WALLETS.includes(code), `${code}: subscriptions`);
    const stats = computePeriodStats([], computePamLedger([]), { from: 0, to: 1 }) as unknown as Record<string, unknown>;
    assert.ok(stats[code.toLowerCase()], `${code}: Analyse volumes and margin`);
}
assert.equal(new Set(TRADE_CURRENCY_CODES).size, TRADE_CURRENCY_CODES.length, 'no currency twice');
console.log(`tradeCurrencies.test: ${TRADE_CURRENCY_CODES.join(', ')} known everywhere`);
