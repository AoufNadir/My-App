import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
    PORTFOLIO_QUANTITY_SCALE,
    PORTFOLIO_SHADOW_EXPECTED_FIXTURES,
    PORTFOLIO_SHADOW_EXPECTED_KINDS,
    PORTFOLIO_SHADOW_KINDS,
    PORTFOLIO_SHADOW_WRITERS,
    PORTFOLIO_V2_READINESS,
    applyPortfolioInventoryEffects,
    areReversalPostingsExact,
    buildPortfolioShadowDraft,
    buildPortfolioShadowReversalDraft,
    clearPortfolioShadowDiagnostics,
    comparePortfolioShadow,
    createPortfolioOpeningSnapshot,
    getPortfolioPamBefore,
    getPortfolioShadowDiagnostics,
    recordPortfolioShadow,
    validateAccountingOperation,
} from './index';

assert.deepEqual(
    [...PORTFOLIO_SHADOW_KINDS].sort(),
    [...PORTFOLIO_SHADOW_EXPECTED_KINDS].sort(),
    'The explicit writer inventory must cover every independently specified Portfolio movement.',
);
assert.ok(PORTFOLIO_SHADOW_WRITERS.length >= 16, 'Every present or prepared Portfolio writer must remain explicit.');
assert.ok(PORTFOLIO_SHADOW_WRITERS.every((writer) => Boolean(writer.v2Policy)));
assert.equal(PORTFOLIO_V2_READINESS, 'ready', 'Portfolio readiness is tracking-only until the global V2 cutover.');
for (const writer of PORTFOLIO_SHADOW_WRITERS.filter((writer) => writer.v2Policy === 'shadow_observed')) {
    const source = readFileSync(new URL(`../${writer.file.replace(/^src\//, '')}`, import.meta.url), 'utf8');
    assert.match(source, /recordPortfolioShadow/, `${writer.id} must invoke the non-blocking Portfolio Shadow observer.`);
    assert.doesNotMatch(source, /commitFinancialOperation|accounting_operations/, `${writer.id} must not activate a V2 writer in Shadow.`);
}

const pureBuilderSource = readFileSync(new URL('./portfolioShadow.ts', import.meta.url), 'utf8');
assert.doesNotMatch(pureBuilderSource, /firebase|recordPortfolioShadow|Date\.now|Math\.random/, 'Portfolio Draft builders must stay pure and Firestore-free.');
const diagnosticsSource = readFileSync(new URL('./portfolioShadowDiagnostics.ts', import.meta.url), 'utf8');
assert.doesNotMatch(diagnosticsSource, /firebase|collection\(|\.set\(|\.update\(|\.delete\(/, 'Portfolio diagnostics must not write Firebase.');

for (const fixture of PORTFOLIO_SHADOW_EXPECTED_FIXTURES) {
    const result = comparePortfolioShadow(fixture.intent, fixture.legacyFacts);
    assert.equal(result.matches, true, `${fixture.label} must match its independently supplied Legacy facts.`);
    assert.deepEqual(result.integrityErrors, [], `${fixture.label} must produce balanced postings.`);
    assert.equal(result.draft.kind, fixture.expectedKind, `${fixture.label} must use its required V2 operation kind.`);
    assert.deepEqual(
        result.draft.postings.map(({ account, side, amountDzd }) => ({ account, side, amountDzd })),
        fixture.expectedPostings,
        `${fixture.label} must match its independent accounting postings.`,
    );
    assert.deepEqual(result.ledgerEffects, fixture.expectedEffects, `${fixture.label} must match its independent effects fixture.`);
}

const cashPurchase = PORTFOLIO_SHADOW_EXPECTED_FIXTURES.find((fixture) => fixture.intent.kind === 'portfolio_purchase_cash');
assert.ok(cashPurchase);
const precisionDraft = buildPortfolioShadowDraft(cashPurchase.intent);
assert.equal(precisionDraft.postings[0].quantity, 1.23456789, 'V2 must preserve 8-decimal asset quantity.');
assert.equal(PORTFOLIO_QUANTITY_SCALE, 100_000_000);
assert.equal(getPortfolioPamBefore({ quantity: 10, costedQuantity: 10, costBasisDzd: 2_000 }), 200);
const openingSnapshot = createPortfolioOpeningSnapshot({ quantity: 12.34567891, costedQuantity: 12.34567891, costBasisDzd: 2_469.14 });
assert.equal(openingSnapshot.quantity, 12.34567891);
assert.equal(openingSnapshot.costBasisDzd, 2_469.14);
assert.equal(openingSnapshot.pamBeforeDzd, 2_469.14 / 12.34567891);
assert.notEqual(openingSnapshot.pamBeforeDzd, 200, 'PAM must retain accounting precision instead of being rounded for display.');

assert.throws(() => buildPortfolioShadowDraft({
    operationId: 'fixture:oversell',
    actorUid: 'owner',
    effectiveAt: Date.parse('2026-08-22T12:15:00.000Z'),
    kind: 'portfolio_sale_cash',
    currency: 'USDT',
    quantity: 10.00000001,
    inventoryBefore: { quantity: 10, costedQuantity: 10, costBasisDzd: 2_000 },
    wallet: 'Caisse',
    proceedsDzd: 2_500,
}), /exceeds physical inventory/i, 'An oversell must be rejected before a V2 draft exists.');
assert.throws(() => buildPortfolioShadowDraft({
    operationId: 'fixture:uncosted-oversell',
    actorUid: 'owner',
    effectiveAt: Date.parse('2026-08-22T12:16:00.000Z'),
    kind: 'portfolio_manual_remove',
    currency: 'EUR',
    quantity: 5,
    inventoryBefore: { quantity: 6, costedQuantity: 4, costBasisDzd: 800 },
}), /exceeds costed inventory/i, 'A V2 non-sale removal cannot create negative costed inventory from Legacy uncosted stock.');

const cashSale = PORTFOLIO_SHADOW_EXPECTED_FIXTURES.find((fixture) => fixture.intent.kind === 'portfolio_sale_cash');
assert.ok(cashSale);
const partialSale = buildPortfolioShadowDraft(cashSale.intent);
assert.deepEqual(partialSale.postings.map(({ account, amountDzd }) => ({ account, amountDzd })), [
    { account: 'asset.cash.baridimob', amountDzd: 550 },
    { account: 'asset.portfolio.usdt', amountDzd: 500 },
    { account: 'income.portfolio_sale', amountDzd: 50 },
], 'A partial sale must remove only its pre-sale PAM cost.');
const lossSale = buildPortfolioShadowDraft({
    operationId: 'fixture:portfolio-sale-loss',
    actorUid: 'owner',
    effectiveAt: Date.parse('2026-08-22T12:30:00.000Z'),
    kind: 'portfolio_sale_cash',
    currency: 'USDT',
    quantity: 1,
    inventoryBefore: { quantity: 10, costedQuantity: 10, costBasisDzd: 2_000 },
    wallet: 'Caisse',
    proceedsDzd: 150,
});
assert.deepEqual(lossSale.postings.map(({ account, side, amountDzd }) => ({ account, side, amountDzd })), [
    { account: 'asset.cash.caisse', side: 'debit', amountDzd: 150 },
    { account: 'asset.portfolio.usdt', side: 'credit', amountDzd: 200 },
    { account: 'expense.portfolio_sale_loss', side: 'debit', amountDzd: 50 },
], 'A trading loss must be explicit and must not change cost basis beyond the sold quantity.');
const fullLiquidation = comparePortfolioShadow({
    operationId: 'fixture:portfolio-full-liquidation',
    actorUid: 'owner',
    effectiveAt: Date.parse('2026-08-22T12:45:00.000Z'),
    kind: 'portfolio_sale_cash',
    currency: 'USDT',
    quantity: 10,
    inventoryBefore: { quantity: 10, costedQuantity: 10, costBasisDzd: 2_000 },
    wallet: 'Caisse',
    proceedsDzd: 2_500,
});
assert.deepEqual(
    applyPortfolioInventoryEffects(
        { quantity: 10, costedQuantity: 10, costBasisDzd: 2_000 },
        fullLiquidation.ledgerEffects,
        'USDT',
    ),
    { quantity: 0, costedQuantity: 0, costBasisDzd: 0 },
    'Full liquidation must close quantity and cost basis exactly to zero.',
);

const nonSaleRemovalKinds = new Set([
    'portfolio_manual_remove',
    'portfolio_project_expense_asset',
    'portfolio_personal_advance_asset',
    'portfolio_personal_expense_asset',
    'portfolio_digital_service_purchase_asset',
    'portfolio_fee_asset',
]);
for (const fixture of PORTFOLIO_SHADOW_EXPECTED_FIXTURES.filter((fixture) => nonSaleRemovalKinds.has(fixture.intent.kind))) {
    const result = comparePortfolioShadow(fixture.intent, fixture.legacyFacts);
    assert.equal(result.ledgerEffects.realizedTradingProfitDzd, 0, `${fixture.label} must never create trading profit.`);
}

const exchange = PORTFOLIO_SHADOW_EXPECTED_FIXTURES.find((fixture) => fixture.intent.kind === 'portfolio_exchange_eur_to_usdt');
if (!exchange || exchange.intent.kind !== 'portfolio_exchange_eur_to_usdt') throw new Error('EUR to USDT exchange fixture is required.');
const exchangeIntent = exchange.intent;
const exchangeResult = comparePortfolioShadow(exchangeIntent, exchange.legacyFacts);
assert.equal(exchangeResult.ledgerEffects.realizedTradingProfitDzd, 0, 'An FX conversion must not create trading profit.');
assert.equal(exchangeResult.ledgerEffects.fxGainLossDzd, 30, 'Any conversion difference must be separate FX gain/loss.');
assert.throws(() => buildPortfolioShadowDraft({ ...exchangeIntent, toQuotedValueDzd: 331 }), /exchange quotes differ/i, 'A mismatched exchange quote must be rejected by the pure builder.');

const creditPurchase = PORTFOLIO_SHADOW_EXPECTED_FIXTURES.find((fixture) => fixture.intent.kind === 'portfolio_purchase_credit');
const creditSale = PORTFOLIO_SHADOW_EXPECTED_FIXTURES.find((fixture) => fixture.intent.kind === 'portfolio_sale_credit');
assert.ok(creditPurchase && creditSale);
assert.equal(comparePortfolioShadow(creditPurchase.intent, creditPurchase.legacyFacts).ledgerEffects.clientPayableDzd, 150, 'Purchase on credit must create payable, not cash.');
assert.equal(comparePortfolioShadow(creditSale.intent, creditSale.legacyFacts).ledgerEffects.clientReceivableDzd, 560, 'Sale on credit must create receivable, not cash.');

// Opening + Purchases + In - Sales - Out = closing. Quantities here retain all
// eight fractional digits, unlike Legacy presentation/compare rounding.
const openingUsdt = 10;
const activity = [
    cashPurchase.intent,
    cashSale.intent,
    PORTFOLIO_SHADOW_EXPECTED_FIXTURES.find((fixture) => fixture.intent.kind === 'portfolio_manual_remove')!.intent,
];
const closingUsdt = activity.reduce((quantity, intent) => quantity + comparePortfolioShadow(intent).ledgerEffects.quantityDeltas.USDT, openingUsdt);
assert.equal(Math.round(closingUsdt * PORTFOLIO_QUANTITY_SCALE), 773_456_789);

const reversal = buildPortfolioShadowReversalDraft(partialSale, {
    operationId: 'fixture:portfolio-sale-cash:reversal',
    actorUid: 'owner',
    effectiveAt: Date.parse('2026-08-23T12:00:00.000Z'),
});
assert.equal(reversal.reversalOf, partialSale.operationId);
assert.equal(reversal.status, 'reversal');
assert.deepEqual(validateAccountingOperation(reversal), []);
assert.equal(areReversalPostingsExact(
    { ...partialSale, idempotencyPayload: 'fixture' },
    reversal,
), true, 'A reversal must be an exact immutable opposite with reversalOf.');

clearPortfolioShadowDiagnostics();
const originalWarn = console.warn;
const warnings: unknown[][] = [];
console.warn = (...args: unknown[]) => warnings.push(args);
try {
    const mismatch = recordPortfolioShadow(cashPurchase.intent, {
        ...cashPurchase.legacyFacts,
        cashDeltasDzd: { Caisse: 247.9, BaridiMob: 0 },
    });
    assert.equal(mismatch?.matches, false, 'A Legacy direction mismatch must be retained for review.');
    assert.equal(getPortfolioShadowDiagnostics().length, 1);
    assert.doesNotThrow(() => recordPortfolioShadow({ ...exchangeIntent, toQuotedValueDzd: 331 }), 'A Shadow build failure must never block Legacy.');
    assert.equal(getPortfolioShadowDiagnostics().length, 1, 'Failed drafts must be logged but never recorded as financial operations.');
}
finally {
    console.warn = originalWarn;
}
assert.equal(warnings.length, 2, 'Both mismatch and rejected draft must log without escaping to the Legacy caller.');

console.log(`Portfolio shadow tests passed (${PORTFOLIO_SHADOW_EXPECTED_FIXTURES.length} independent movement fixtures).`);
