import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildGoalCoach, type CoachRow } from './goalCoach';
import { GoalCoachLines } from '../components/dashboard/GoalCoachLines';
import { LanguageProvider } from '../contexts/LanguageContext';

const storage = new Map<string, string>();
(globalThis as { window?: unknown }).window = {
    localStorage: { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => { storage.set(k, String(v)); }, removeItem: (k: string) => { storage.delete(k); } },
    matchMedia: () => ({ matches: false }),
};
// P3: one decision with a number, from this month against the same days of the last three months.
const NOW = new Date('2026-07-10T12:00:00').getTime();
const deal = (y: number, m: number, d: number, qty: number, margin: number): CoachRow => ({ timestamp: new Date(y, m, d, 12).getTime(), quantity: qty, derivedProfit: qty * margin, currency: 'USDT' });
// Usual months (April, May, June): 300 USDT a day at 15 DZD.
const usual = [3, 4, 5].flatMap((m) => Array.from({ length: 28 }, (_, i) => deal(2026, m, i + 1, 300, 15)));
const goal = { minimum: 100_000, target: 140_000, stretch: 161_000 };

// quantity problem: half the usual quantity at the usual margin
const lowQty = buildGoalCoach({ rows: [...usual, ...Array.from({ length: 10 }, (_, i) => deal(2026, 6, i + 1, 150, 15))], goal, now: NOW });
assert.equal(lowQty.qtyUsual, 3000);
assert.equal(lowQty.qtyNow, 1500);
assert.equal(lowQty.advice.kind, 'quantity');
assert.ok(lowQty.advice.kind === 'quantity' && lowQty.advice.extraQtyPerWeek > 0, 'says how many USDT more per week');

// price problem: the usual quantity at a thin margin
const lowMargin = buildGoalCoach({ rows: [...usual, ...Array.from({ length: 10 }, (_, i) => deal(2026, 6, i + 1, 300, 8))], goal, now: NOW });
assert.equal(lowMargin.advice.kind, 'price');
assert.ok(lowMargin.advice.kind === 'price' && lowMargin.advice.extraPerUnit > 0, 'says how many DZD more per USDT');

// both low
const bothLow = buildGoalCoach({ rows: [...usual, ...Array.from({ length: 10 }, (_, i) => deal(2026, 6, i + 1, 150, 8))], goal, now: NOW });
assert.equal(bothLow.advice.kind, 'both');

// on track: keep going
const fine = buildGoalCoach({ rows: [...usual, ...Array.from({ length: 10 }, (_, i) => deal(2026, 6, i + 1, 300, 15))], goal, now: NOW });
assert.equal(fine.advice.kind, 'keep');

// the three lines, short, in both languages
for (const lang of ['ar', 'fr'] as const) {
    storage.set('app_lang', lang);
    const html = renderToStaticMarkup(React.createElement(LanguageProvider, null, React.createElement(GoalCoachLines, { coach: lowQty, minimum: goal.minimum })));
    assert.match(html, lang === 'ar' ? /زِد الكمية/ : /Vendez plus/);
    assert.match(html, /data-testid="goal-coach"/);
    assert.match(html, /USDT/);
}
console.log('goal coach tests passed');
