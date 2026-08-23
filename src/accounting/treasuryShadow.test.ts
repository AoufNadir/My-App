import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
    GLOBAL_RESET_V2_POLICY,
    PO_ORDER_CASH_FLOW,
    TREASURY_SHADOW_EXPECTED_FIXTURES,
    TREASURY_SHADOW_KINDS,
    TREASURY_SHADOW_WRITERS,
    buildTreasuryShadowDraft,
    clearTreasuryShadowDiagnostics,
    compareTreasuryShadow,
    getTreasuryShadowDiagnostics,
    recordTreasuryLegacyDeletionShadow,
    recordTreasuryShadow,
} from './index';

assert.deepEqual(
    [...TREASURY_SHADOW_KINDS].sort(),
    [...TREASURY_SHADOW_EXPECTED_FIXTURES.map((fixture) => fixture.intent.kind)].sort(),
    'The writer inventory must cover every independently specified Treasury movement.',
);
assert.ok(TREASURY_SHADOW_WRITERS.length >= 21, 'The current Treasury writer inventory must stay explicit.');
assert.ok(TREASURY_SHADOW_WRITERS.every((writer) => Boolean(writer.v2Policy)), 'Every Treasury path must declare its future V2 policy.');
for (const writer of TREASURY_SHADOW_WRITERS.filter((writer) => writer.shadowKinds.length > 0)) {
    const source = readFileSync(new URL(`../${writer.file.replace(/^src\//, '')}`, import.meta.url), 'utf8');
    assert.match(source, /recordTreasuryShadow/, `${writer.id} must invoke the non-blocking Shadow observer.`);
}

const globalReset = TREASURY_SHADOW_WRITERS.find((writer) => writer.id === 'main.global-reset');
assert.deepEqual(globalReset?.shadowKinds, [], 'Global Reset must never become a V2 financial reversal.');
assert.equal(globalReset?.v2Policy, GLOBAL_RESET_V2_POLICY);
assert.equal(GLOBAL_RESET_V2_POLICY, 'dev_admin_only_pre_cutover');
const mainAppSource = readFileSync(new URL('../MainApp.tsx', import.meta.url), 'utf8');
assert.doesNotMatch(mainAppSource, /shadow:global-reset/, 'Global Reset must not emit a financial-reversal Shadow draft.');
for (const id of ['clients.entity-delete', 'investors.entity-delete', 'assets.entity-delete']) {
    const entityDeletion = TREASURY_SHADOW_WRITERS.find((writer) => writer.id === id);
    assert.deepEqual(entityDeletion?.shadowKinds, [], `${id} must not reverse financial history.`);
    assert.equal(entityDeletion?.v2Policy, 'archive_entity', `${id} must archive/inactivate in V2.`);
}
assert.doesNotMatch(readFileSync(new URL('../hooks/useClientHandlers.ts', import.meta.url), 'utf8'), /shadow:client-delete/);
assert.doesNotMatch(readFileSync(new URL('../hooks/useInvestorHandlers.ts', import.meta.url), 'utf8'), /shadow:investor-delete|shadow:investor-return-delete/);
assert.doesNotMatch(readFileSync(new URL('../hooks/useAssetHandlers.ts', import.meta.url), 'utf8'), /shadow:manual-asset-client-delete/);

const poHandlerSource = readFileSync(new URL('../hooks/usePoOrderHandlers.ts', import.meta.url), 'utf8');
assert.equal(PO_ORDER_CASH_FLOW, 'customer_sale_receipt_only_when_prepaid');
assert.match(poHandlerSource, /ctx\.clientPaymentStatus !== 'credit'/, 'A credit PO order must not create a cash receipt.');

const pureBuilderSource = readFileSync(new URL('./treasuryShadow.ts', import.meta.url), 'utf8');
assert.doesNotMatch(pureBuilderSource, /firebase|recordTreasuryShadow|Date\.now/, 'Treasury Draft builders must remain pure and Firestore-free.');

for (const fixture of TREASURY_SHADOW_EXPECTED_FIXTURES) {
    const result = compareTreasuryShadow(fixture.intent, fixture.legacyRows);
    assert.equal(result.matches, true, `${fixture.label} must match the Legacy cash effect.`);
    assert.deepEqual(result.integrityErrors, [], `${fixture.label} Draft must be balanced and structurally valid.`);
    assert.equal(result.draft.kind, fixture.expectedKind, `${fixture.label} must use the specified V2 operation kind.`);
    assert.deepEqual(
        result.draft.postings.map(({ account, side, amountDzd }) => ({ account, side, amountDzd })),
        fixture.expectedPostings,
        `${fixture.label} must match its independent accounting posting fixture.`,
    );
}

const transferFixture = TREASURY_SHADOW_EXPECTED_FIXTURES.find((fixture) => fixture.intent.kind === 'treasury_transfer');
assert.ok(transferFixture, 'The transfer fixture must exist.');
const transferDraft = buildTreasuryShadowDraft(transferFixture.intent);
assert.deepEqual(transferDraft.postings.map((row) => [row.account, row.side, row.amountDzd]), [
    ['asset.cash.baridimob', 'debit', 103],
    ['asset.cash.caisse', 'credit', 103],
]);

const portfolioPurchaseFixture = TREASURY_SHADOW_EXPECTED_FIXTURES.find((fixture) => fixture.intent.kind === 'portfolio_purchase_cash');
assert.ok(portfolioPurchaseFixture, 'The portfolio-purchase fixture must exist.');
const mismatch = compareTreasuryShadow(
    portfolioPurchaseFixture.intent,
    [{ type: 'Ajout', source: 'Caisse', amount: 105 }],
);
assert.equal(mismatch.matches, false, 'A Legacy direction mismatch must be reported.');
assert.match(mismatch.mismatches.join(' '), /Caisse/);

clearTreasuryShadowDiagnostics();
const originalWarn = console.warn;
const warnings: unknown[][] = [];
console.warn = (...args: unknown[]) => warnings.push(args);
try {
    const nonBlocking = recordTreasuryShadow(
        portfolioPurchaseFixture.intent,
        [{ type: 'Ajout', source: 'Caisse', amount: 105 }],
    );
    assert.equal(nonBlocking?.matches, false, 'The observer must retain mismatches for review.');
    assert.equal(getTreasuryShadowDiagnostics().length, 1);

    assert.doesNotThrow(() => recordTreasuryShadow(
        { ...portfolioPurchaseFixture.intent, amountDzd: 0 },
        [{ type: 'Retrait', source: 'Caisse', amount: 105 }],
    ), 'A Shadow builder failure must never block an existing Legacy writer.');
    assert.equal(getTreasuryShadowDiagnostics().length, 1, 'Builder failures are logged but do not create a financial record.');

    const deletion = recordTreasuryLegacyDeletionShadow({
        operationId: 'shadow:delete:cash-in',
        actorUid: 'owner',
        effectiveAt: Date.parse('2026-08-22T12:00:00.000Z'),
        row: { type: 'Ajout', source: 'Caisse', amount: 100 },
    });
    assert.equal(deletion?.matches, true, 'A transaction delete must be represented as its inverse cash effect.');
}
finally {
    console.warn = originalWarn;
}
assert.equal(warnings.length, 2, 'Shadow issues must be logged for review without escaping to the Legacy writer.');

console.log(`Treasury shadow tests passed (${TREASURY_SHADOW_EXPECTED_FIXTURES.length} independent movement fixtures).`);
