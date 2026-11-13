import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { EXTRA_CURRENCY_CODES, TRADE_CURRENCIES, TRADE_CURRENCY_CODES, currencyKey } from './tradeCurrencies';
import { HIDEABLE_CURRENCIES } from '../utils/hiddenCurrencies';
import { DELIVERY_CURRENCIES, reservedForClients } from '../utils/deferredDelivery';
import { INVENTORY_ACCOUNTS, INVENTORY_TOLERANCE_CENTS, inventoryExpected } from '../utils/inventoryCheck';
import { SUBSCRIPTION_WALLETS } from '../utils/habits';
import { computePeriodStats } from '../utils/analyticsPeriod';
import { computePamLedger, APP_EXTRA_CURRENCIES } from '../utils/pamLedger';
import { FINANCIAL_WALLETS, walletBalancesOf } from '../components/ui/WalletPicker';

// V14-3 / V14-4: the guard of « a new currency is one line ». A currency added to TRADE_CURRENCIES must reach every
// place below; forgetting one makes this test fail and name it.
const stats = computePeriodStats([], computePamLedger([]), { from: 0, to: 1 }) as unknown as Record<string, unknown>;
const expected = inventoryExpected({ caisse: 0, baridi: 0, usdtAvailable: 0, eurAvailable: 0 }) as Record<string, number>;
const reserved = reservedForClients([]) as Record<string, number>;
const balances = walletBalancesOf({}, { usdt: {}, eur: {} }) as Record<string, number>;
for (const { code, symbol, name } of TRADE_CURRENCIES) {
    const key = currencyKey(code);
    assert.ok(symbol && name.fr && name.ar, `${code}: symbol and names`);
    assert.ok(HIDEABLE_CURRENCIES.includes(code), `${code}: can be hidden in the settings`);
    assert.ok(DELIVERY_CURRENCIES.includes(code) && code in reserved, `${code}: deferred delivery`);
    assert.ok(INVENTORY_ACCOUNTS.includes(key) && key in INVENTORY_TOLERANCE_CENTS && key in expected, `${code}: a wallet in the inventory`);
    assert.ok(SUBSCRIPTION_WALLETS.includes(code), `${code}: subscriptions`);
    assert.ok(FINANCIAL_WALLETS.includes(code) && code in balances, `${code}: wallet pickers and their balances`);
    assert.ok(stats[key], `${code}: Analyse volumes and margin`);
}
for (const code of EXTRA_CURRENCY_CODES)
    assert.ok(APP_EXTRA_CURRENCIES.includes(code), `${code}: the average-price engine knows it`);
assert.equal(new Set(TRADE_CURRENCY_CODES).size, TRADE_CURRENCY_CODES.length, 'no currency twice');

// No new code may name RMB by hand: the files below keep it only for compatibility (old props, RMB's own words).
const ALLOWED = new Set([
    'src/MainApp.tsx', 'src/components/main/MainTransactionDialog.tsx', 'src/components/main/RmbTradeDialog.tsx',
    'src/components/transactions/NewTransactionMenuDialog.tsx', 'src/contexts/CurrencyVisibilityContext.tsx', 'src/currency/tradeCurrencies.ts',
    'src/pages/DashboardPage.tsx', 'src/pages/PortfolioPage.tsx', 'src/utils/digitalServiceAccounting.ts', 'src/utils/inventoryCheck.ts', 'src/utils/rmbTrade.ts',
]);
const files: string[] = [];
const walk = (dir: string) => readdirSync(dir).forEach((entry) => { const path = join(dir, entry); if (statSync(path).isDirectory()) walk(path); else if (/\.tsx?$/.test(entry) && !/\.test\./.test(entry)) files.push(path); });
walk('src');
const offenders = files.filter((path) => !ALLOWED.has(path.replace(/\\/g, '/')) && !path.includes('translations') && readFileSync(path, 'utf8').includes("'RMB'"));
assert.deepEqual(offenders, [], 'these files name RMB by hand: read the currency list instead');
console.log(`tradeCurrencies.test: ${TRADE_CURRENCY_CODES.join(', ')} known everywhere; no new hand-written RMB`);
