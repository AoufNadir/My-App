import assert from 'node:assert/strict';
import type { ClientDzd, ClientTransactionDzd, Tx } from '../types';
import {
    DEFAULT_PRICING_POLICY,
    buildPricingContext,
    monthKeyFor,
    quoteSale,
    type PricingMonthlyPlan,
} from './smartPricingEngine';

const DAY = 86_400_000;
const NOW = new Date('2026-07-10T12:00:00').getTime();

function tx(overrides: Partial<Tx> & Pick<Tx, 'id' | 'type' | 'timestamp'>): Tx {
    const d = new Date(overrides.timestamp);
    return {
        quantity: 100,
        currency: 'USDT',
        date: d.toLocaleDateString('fr-FR'),
        time: '12:00',
        ...overrides,
    } as Tx;
}

function baseTransactions(withNegotiation = false): Tx[] {
    const buys = [8, 6, 4, 2].map((days, index) => tx({
        id: `buy-${index}`, type: 'buy', timestamp: NOW - days * DAY,
        quantity: 500, price: 190,
    }));
    const sellDays = [40, 32, 20, 10, 3];
    const sells = sellDays.map((days, index) => tx({
        id: `sell-${index}`, type: 'sell', timestamp: NOW - days * DAY,
        quantity: 200, sell: 193, profit: 600,
        linkedClientId: 'c1', clientPaymentStatus: 'cash',
        ...(withNegotiation && index >= 2 ? { spTargetPrice: 194.5 } : {}),
    }));
    return [...sells, ...buys];
}

const client: ClientDzd = { id: 'c1', fullName: 'Client Test', creditLimit: 1_000_000 };
const plan: PricingMonthlyPlan = {
    schemaVersion: 1,
    monthKey: monthKeyFor(NOW), revision: 1,
    monthlyGoal: 0, minimumGoal: 0,
    expectedMonthlyVolume: { USDT: 10_000 },
};

function context(overrides: {
    transactions?: Tx[];
    client?: ClientDzd;
    clientTransactions?: ClientTransactionDzd[];
    plan?: PricingMonthlyPlan;
    policy?: typeof DEFAULT_PRICING_POLICY;
} = {}) {
    return buildPricingContext({
        transactions: overrides.transactions || baseTransactions(),
        clients: [overrides.client || client],
        clientTransactions: overrides.clientTransactions || [],
        currency: 'USDT', pam: 190, available: 20_000,
        plan: overrides.plan || plan,
        mtdProfit: 0,
        policy: overrides.policy || DEFAULT_PRICING_POLICY,
        now: NOW,
    });
}

{
    const quote = quoteSale(context(), {
        clientId: 'c1', quantity: 300, payment: { kind: 'cash' },
    });
    assert.equal(quote.status, 'ready');
    assert.ok(quote.openingPrice >= quote.targetPrice);
    assert.ok(quote.targetPrice >= quote.minimumAllowedPrice);
    assert.ok(quote.minimumAllowedPrice >= quote.pam);
    assert.ok(Number.isFinite(quote.targetPrice));
}

{
    const ctx = context();
    const cash = quoteSale(ctx, { clientId: 'c1', quantity: 300, payment: { kind: 'cash' } });
    const credit = quoteSale(ctx, {
        clientId: 'c1', quantity: 300,
        payment: { kind: 'credit', dueDate: '2026-08-09' },
    });
    assert.equal(credit.status, 'ready');
    assert.ok(credit.breakdown.financingPremium >= 3.7 && credit.breakdown.financingPremium <= 4.1);
    assert.ok(credit.targetPrice > cash.targetPrice);
}

{
    const pressuredPlan: PricingMonthlyPlan = {
        ...plan, monthlyGoal: 100_000, minimumGoal: 80_000,
        expectedMonthlyVolume: { USDT: 1_000 },
    };
    const quote = quoteSale(context({ plan: pressuredPlan }), {
        clientId: 'c1', quantity: 300, payment: { kind: 'cash' },
    });
    assert.ok(quote.targetPrice - quote.pam > 4, 'goal pressure must not be silently capped');
    assert.ok(quote.reasonCodes.includes('goal_above_market_range'));
}

{
    const missingVolumePlan: PricingMonthlyPlan = {
        ...plan, monthlyGoal: 20_000, expectedMonthlyVolume: {},
    };
    const shortHistory = baseTransactions().filter((row) => row.type === 'buy' || row.timestamp > NOW - 10 * DAY);
    const quote = quoteSale(context({ transactions: shortHistory, plan: missingVolumePlan }), {
        clientId: 'c1', quantity: 300, payment: { kind: 'cash' },
    });
    assert.equal(quote.goal.volumeMissing, true);
    assert.ok(quote.reasonCodes.includes('goal_volume_missing'));
}

{
    const quote = quoteSale(context(), {
        clientId: 'c1', quantity: 300, payment: { kind: 'cash' },
        marketOverride: { kind: 'market', currency: 'USDT', marketStatus: 'rising', scope: 'sale' },
        clientOverride: { kind: 'client', currency: 'USDT', clientId: 'c1', customerSegment: 'vip', scope: 'sale' },
    });
    assert.equal(quote.market.effective, 'rising');
    assert.equal(quote.client.effectiveSegment, 'vip');
    assert.equal(quote.market.overridden, true);
    assert.equal(quote.client.overridden, true);
}

{
    const withoutLearning = quoteSale(context({ transactions: baseTransactions(false) }), {
        clientId: 'c1', quantity: 300, payment: { kind: 'cash' },
        clientOverride: { kind: 'client', currency: 'USDT', clientId: 'c1', customerSegment: 'normal', scope: 'sale' },
    });
    const withLearning = quoteSale(context({ transactions: baseTransactions(true) }), {
        clientId: 'c1', quantity: 300, payment: { kind: 'cash' },
        clientOverride: { kind: 'client', currency: 'USDT', clientId: 'c1', customerSegment: 'normal', scope: 'sale' },
    });
    assert.equal(withLearning.targetPrice, withoutLearning.targetPrice, 'negotiation history must not lower/raise target');
    assert.ok(withLearning.openingPrice >= withoutLearning.openingPrice);
    assert.ok(withLearning.reasonCodes.includes('learned_opening_buffer'));
}

{
    const highLimit = quoteSale(context(), {
        clientId: 'c1', quantity: 10,
        payment: { kind: 'credit', dueDate: '2026-08-09' },
        clientOverride: { kind: 'client', currency: 'USDT', clientId: 'c1', customerSegment: 'weak', scope: 'sale' },
    });
    const exactTotal = highLimit.targetPrice * 10;
    const exact = quoteSale(context({ client: { ...client, creditLimit: exactTotal } }), {
        clientId: 'c1', quantity: 10,
        payment: { kind: 'credit', dueDate: '2026-08-09' },
        clientOverride: { kind: 'client', currency: 'USDT', clientId: 'c1', customerSegment: 'weak', scope: 'sale' },
    });
    assert.equal(exact.creditRisk.overLimit, false, 'exact credit limit is allowed');
    const over = quoteSale(context({ client: { ...client, creditLimit: exactTotal - 1 } }), {
        clientId: 'c1', quantity: 10,
        payment: { kind: 'credit', dueDate: '2026-08-09' },
        clientOverride: { kind: 'client', currency: 'USDT', clientId: 'c1', customerSegment: 'weak', scope: 'sale' },
    });
    assert.equal(over.creditRisk.overLimit, true);
    assert.equal(over.creditRisk.requiresAcknowledgement, true);
}

{
    const quote = quoteSale(context(), {
        clientId: 'c1', quantity: 300, payment: { kind: 'cash' }, actualUnitPrice: 189,
    });
    assert.equal(quote.actual.belowPam, true);
    assert.equal(quote.status, 'ready', 'manual price remains flexible');
}

{
    // Credit WITHOUT a due date: term falls back to the client's LEARNED
    // average repayment delay (credit sale settled 12 days later).
    const saleTs = NOW - 60 * DAY;
    const ledger: ClientTransactionDzd[] = [
        {
            id: 'ct1', clientId: 'c1', timestamp: saleTs,
            date: '11/05/2026', time: '12:00', montant: -100_000,
            type: 'Vente USDT', paymentMethod: 'Crédit',
        },
        {
            id: 'ct2', clientId: 'c1', timestamp: saleTs + 12 * DAY,
            date: '23/05/2026', time: '12:00', montant: 100_000,
            type: 'Règlement Reçu', paymentMethod: 'Espèces',
        },
    ];
    const ctx = context({ clientTransactions: ledger });
    assert.equal(ctx.debtByClientId.get('c1')?.avgSettleDays, 12);
    assert.equal(ctx.profiles.get('c1')?.avgSettleDays, 12);
    const learned = quoteSale(ctx, { clientId: 'c1', quantity: 300, payment: { kind: 'credit' } });
    assert.equal(learned.status, 'ready', 'missing due date never blocks the quote');
    assert.equal(learned.payment.termDays, 12);
    assert.equal(learned.payment.termSource, 'learned');
    assert.ok(learned.reasonCodes.includes('credit_term_estimated'));
    assert.ok(learned.breakdown.financingPremium > 0, 'learned term still prices financing');

    // No repayment history at all → policy default term.
    const fallback = quoteSale(context(), { clientId: 'c1', quantity: 300, payment: { kind: 'credit' } });
    assert.equal(fallback.status, 'ready');
    assert.equal(fallback.payment.termDays, DEFAULT_PRICING_POLICY.creditDefaultTermDays);
    assert.equal(fallback.payment.termSource, 'default');
    assert.ok(fallback.reasonCodes.includes('credit_term_estimated'));

    // Explicit due date wins and carries no "estimated" reason.
    const explicit = quoteSale(ctx, {
        clientId: 'c1', quantity: 300, payment: { kind: 'credit', dueDate: '2026-08-09' },
    });
    assert.equal(explicit.payment.termSource, 'explicit');
    assert.ok(explicit.payment.termDays > 12);
    assert.ok(!explicit.reasonCodes.includes('credit_term_estimated'));
}

console.log('smartPricingEngine tests passed');
