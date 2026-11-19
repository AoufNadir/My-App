import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSecondPress, expenseWarning, operationWarning } from './preSaveGuard';
import { translateAlert } from '../utils/alertMessages';
import { translations } from '../translations';

// V17-2: the guard before saving, on fake data.
const DAY = 86_400_000;
const NOW = new Date(2026, 10, 19, 12).getTime();
const usual = Array.from({ length: 8 }, (_, i) => ({ id: `e${i}`, origin: 'personal_expense', amount: 400, timestamp: NOW - (30 - i) * DAY }));

// Expenses: ordinary amount → nothing; ten times the usual → warning; the same amount again within 15 days → warning.
assert.equal(expenseWarning({ origin: 'personal_expense', amount: 450, timestamp: NOW, history: usual }), null);
assert.match(expenseWarning({ origin: 'personal_expense', amount: 39_500, timestamp: NOW, history: usual }) ?? '', /^Dépense de 39 500 DZD, d’habitude environ 400\./);
const withBig = [...usual, { id: 'big', origin: 'personal_expense', amount: 39_500, timestamp: NOW - 11 * DAY }];
assert.match(expenseWarning({ origin: 'personal_expense', amount: 39_500, timestamp: NOW, history: withBig }) ?? '', /^Même dépense de 39 500 DZD déjà enregistrée le /);
assert.equal(expenseWarning({ origin: 'personal_expense', amount: 39_500, timestamp: NOW, history: withBig, editingId: 'big' })?.startsWith('Même'), false, 'editing a line is not a repeat of itself');
assert.equal(expenseWarning({ origin: 'delivery_expense', amount: 39_500, timestamp: NOW, history: withBig }), null, 'another kind of expense, no history of its own');

// Operations: a zero too many, the same sale twice in minutes, an ordinary price.
const sells = Array.from({ length: 10 }, (_, i) => ({ id: `s${i}`, type: 'sell', currency: 'USDT', quantity: 100 + i, sell: 260 + (i % 3), timestamp: NOW - (20 - i) * DAY }));
assert.equal(operationWarning({ side: 'sell', currency: 'USDT', quantity: 300, price: 262, timestamp: NOW, history: sells }), null);
assert.match(operationWarning({ side: 'sell', currency: 'USDT', quantity: 300, price: 2620, timestamp: NOW, history: sells }) ?? '', /^Prix 2 620, loin de l’habitude \(261\)\./);
const justSold = [...sells, { id: 'j', type: 'sell', currency: 'USDT', quantity: 300, sell: 262, timestamp: NOW - 3 * 60_000, linkedClientId: 'c1' }];
assert.match(operationWarning({ side: 'sell', currency: 'USDT', quantity: 300, price: 262, timestamp: NOW, clientId: 'c1', history: justSold }) ?? '', /^Même opération/);
assert.equal(operationWarning({ side: 'sell', currency: 'USDT', quantity: 300, price: 262, timestamp: NOW, clientId: 'c2', history: justSold }), null, 'another client is another sale');
assert.equal(operationWarning({ side: 'buy', currency: 'USDT', quantity: 300, price: 2550, timestamp: NOW, history: sells }), null, 'no purchase history: nothing to compare');

// The second press: first press shows and stops, the same values go on, a change asks again, no warning goes on.
{
    const shown: string[] = [];
    const press = createSecondPress();
    assert.equal(press.check('W', 'a', (m) => shown.push(m)), false);
    assert.equal(press.check('W', 'a', (m) => shown.push(m)), true);
    assert.equal(press.check('W', 'a', (m) => shown.push(m)), false, 'after saving, the next one asks again');
    assert.equal(press.check('W', 'b', (m) => shown.push(m)), false, 'other values ask again');
    assert.equal(press.check(null, 'b', (m) => shown.push(m)), true);
    assert.deepEqual(shown, ['⚠️ W', '⚠️ W', '⚠️ W']);
}

// The messages read in Arabic, with their numbers.
const t = (key: string) => key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], (translations as Record<string, unknown>).ar);
for (const [message, expected] of [
    [`⚠️ ${expenseWarning({ origin: 'personal_expense', amount: 39_500, timestamp: NOW, history: withBig })}`, /^⚠️ مصروف بنفس المبلغ 39 500 DZD مسجّل يوم \d\d\/\d\d\./],
    [`⚠️ ${expenseWarning({ origin: 'personal_expense', amount: 39_500, timestamp: NOW, history: usual })}`, /^⚠️ مصروف 39 500 DZD، والمعتاد نحو 400\./],
    [`⚠️ ${operationWarning({ side: 'sell', currency: 'USDT', quantity: 300, price: 2620, timestamp: NOW, history: sells })}`, /^⚠️ السعر 2 620 بعيد عن المعتاد \(261\)\./],
    [`⚠️ ${operationWarning({ side: 'sell', currency: 'USDT', quantity: 300, price: 262, timestamp: NOW, clientId: 'c1', history: justSold })}`, /^⚠️ العملية نفسها سُجّلت قبل دقائق\./],
] as const)
    assert.match(translateAlert(message, 'ar', t), expected);

// Wired before every save: buy, sale, project expense, personal expense.
const handlers = readFileSync(new URL('../hooks/useTransactionHandlers.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
assert.match(handlers, /secondPress\.check\(buyWarning/);
assert.match(handlers, /secondPress\.check\(sellWarning/);
assert.match(handlers, /secondPress\.check\(expenseWarn/);
const investors = readFileSync(new URL('../hooks/useInvestorHandlers.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
assert.match(investors, /secondPress\.check\(personalWarn/);

console.log('pre-save guard tests passed');
