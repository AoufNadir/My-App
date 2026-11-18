import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// V14-3 (owner): after any operation with a client, in any currency, bought or sold, his page opens.
const app = readFileSync(new URL('../../MainApp.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const rmb = app.slice(app.indexOf('const saveRmbTrade = async ('), app.indexOf('const saveRmbTrade = async (') + 4000);
assert.ok(/setSelectedClientId\(clientId\); setView\('dzd'\)/.test(rmb), 'RMB and cross-currency operations open the client page');
const handlers = readFileSync(new URL('../../hooks/useTransactionHandlers.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
assert.ok((handlers.match(/setSelectedClientId\(linkedClientId\);\s*setView\('dzd'\);/g) || []).length >= 2, 'USDT / EUR purchase and sale too');
console.log('clientPageAfterTrade.test: every operation with a client opens his page');
