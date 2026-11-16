import assert from 'node:assert/strict';
import type { ClientDzd, ClientTransactionDzd, Tx } from '../types';
import { DEFAULT_PRICING_POLICY, buildCustomerProfiles, buildPricingContext, monthKeyFor, paysOnTime, prepaidShare, quoteSale, type PricingMonthlyPlan } from './smartPricingEngine';

// P1 (owner): a client is judged by their monthly volume, an advance is not credit, a good payer stays good.
const DAY = 86_400_000;
const NOW = new Date('2026-07-10T12:00:00').getTime();
const VIP = DEFAULT_PRICING_POLICY.vipVolumeThreshold;
const sell = (id: string, client: string, daysAgo: number, quantity: number, extra: Partial<Tx> = {}): Tx => ({ id, type: 'sell', timestamp: NOW - daysAgo * DAY, quantity, sell: 200, profit: quantity * 2, currency: 'USDT', linkedClientId: client, clientPaymentStatus: 'cash', date: '', time: '', ...extra } as Tx);

// 1. One purchase of a big amount a month weighs like many small ones of the same total.
const once = [sell('o1', 'big', 5, VIP)];
const many = [1, 4, 8, 12, 16, 20].map((d, i) => sell(`m${i}`, 'small', d, VIP / 6));
const profiles = buildCustomerProfiles([...once, ...many], VIP, NOW);
assert.ok(profiles.get('big')!.score >= profiles.get('small')!.score, 'one big purchase a month is not ranked below many small ones');
assert.equal(profiles.get('big')!.segment, profiles.get('small')!.segment, 'same monthly volume, same segment');

// 2. The monthly volume looks at three months, not only the last thirty days.
const steady = [35, 65, 85].map((d, i) => sell(`s${i}`, 'steady', d, VIP));
assert.ok(buildCustomerProfiles(steady, VIP, NOW).get('steady')!.monthlyVolume >= VIP * 0.99, 'a client who bought last months keeps their monthly volume');

// 3. A sale « on account » paid from the client's advance is not credit.
const advanceRows: ClientTransactionDzd[] = [{ id: 'a', clientId: 'pre', timestamp: NOW - 6 * DAY, montant: 1_000_000, type: 'Règlement Reçu', affectsBalance: true } as ClientTransactionDzd];
const prepaidSales = [sell('p1', 'pre', 5, 1000, { clientPaymentStatus: 'credit' })];
assert.equal(buildCustomerProfiles(prepaidSales, VIP, NOW, undefined, 'USDT', advanceRows).get('pre')!.creditRatio90d, 0, 'covered by the advance: no credit');
assert.equal(buildCustomerProfiles(prepaidSales, VIP, NOW).get('pre')!.creditRatio90d, 1, 'without the ledger it was counted as credit (the old behaviour)');
const halfRows: ClientTransactionDzd[] = [{ ...advanceRows[0], montant: 100_000 }];
assert.equal(buildCustomerProfiles(prepaidSales, VIP, NOW, undefined, 'USDT', halfRows).get('pre')!.creditRatio90d, 0.5, 'half covered: half credit');

assert.equal(prepaidShare(300_000, 200_000), 1);
assert.equal(prepaidShare(50_000, 200_000), 0.25);
assert.equal(prepaidShare(-10_000, 200_000), 0, 'a debt covers nothing');

// 4. In the quote: on account with enough advance = no financing cost and no credit warnings.
const client: ClientDzd = { id: 'pre', fullName: 'Pre', creditLimit: 0 };
const plan: PricingMonthlyPlan = { schemaVersion: 1, monthKey: monthKeyFor(NOW), revision: 1, monthlyGoal: 0, minimumGoal: 0, expectedMonthlyVolume: { USDT: 10_000 } };
const ctxFor = (rows: ClientTransactionDzd[]) => buildPricingContext({ transactions: prepaidSales, clients: [client], clientTransactions: rows, currency: 'USDT', pam: 190, available: 20_000, plan, now: NOW } as never);
const withAdvance = quoteSale(ctxFor(advanceRows), { currency: 'USDT', clientId: 'pre', quantity: 1000, payment: { kind: 'credit' } } as never);
const noAdvance = quoteSale(ctxFor([]), { currency: 'USDT', clientId: 'pre', quantity: 1000, payment: { kind: 'credit' } } as never);
const cash = quoteSale(ctxFor(advanceRows), { currency: 'USDT', clientId: 'pre', quantity: 1000, payment: { kind: 'cash' } } as never);
assert.ok(withAdvance.reasonCodes.includes('prepaid_from_balance'));
assert.ok(!withAdvance.reasonCodes.includes('credit_financing_cost'), 'no financing on money already received');
assert.equal(withAdvance.corridor.targetPrice, cash.corridor.targetPrice, 'priced like cash');
assert.ok(noAdvance.corridor.targetPrice >= withAdvance.corridor.targetPrice, 'real credit is never cheaper than prepaid');

// 5. A good payer.
assert.equal(paysOnTime(5, 3, { creditDefaultTermDays: 7 }), true);
assert.equal(paysOnTime(12, 3, { creditDefaultTermDays: 7 }), false);
assert.equal(paysOnTime(3, 1, { creditDefaultTermDays: 7 }), false, 'one settled credit is not a habit');
// 6. A loyal client (monthly volume ≥ the regular threshold) keeps their price on a small purchase.
const loyalSales = [1, 6, 11, 16, 21, 26].map((d, i) => sell(`l${i}`, 'loyal', d, VIP / 5));
const loyalCtx = buildPricingContext({ transactions: loyalSales, clients: [{ id: 'loyal', fullName: 'L' }], clientTransactions: [], currency: 'USDT', pam: 190, available: 20_000, plan, now: NOW } as never);
const small = quoteSale(loyalCtx, { currency: 'USDT', clientId: 'loyal', quantity: 50, payment: { kind: 'cash' } } as never);
assert.ok(small.reasonCodes.includes('loyal_small_qty') && !small.reasonCodes.includes('small_qty_no_vip') && !small.reasonCodes.includes('small_qty_premium'), 'no small-quantity penalty for a loyal client');
console.log('smart pricing P1 tests passed');
