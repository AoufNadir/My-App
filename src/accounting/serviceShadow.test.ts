import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import type { DigitalServiceTransaction } from '../types';
import {
    SERVICES_V2_READINESS,
    SERVICE_SHADOW_EXPECTED_FIXTURES,
    SERVICE_SHADOW_WRITERS,
    buildServiceShadowDraft,
    clearServiceShadowDiagnostics,
    compareServiceShadow,
    getServiceShadowDiagnostics,
    recordServiceShadow,
    reconcileLegacyServicesToShadow,
    validateAccountingOperation,
} from './index';

assert.equal(SERVICES_V2_READINESS, 'shadow', 'Services Shadow must not activate a V2 writer or closure.');
assert.ok(SERVICE_SHADOW_WRITERS.length >= 4, 'The service writer inventory must be explicit.');
for (const writer of SERVICE_SHADOW_WRITERS.filter((writer) => writer.v2Policy === 'shadow_observed')) {
    const source = readFileSync(new URL(`../${writer.file.replace(/^src\//, '')}`, import.meta.url), 'utf8');
    assert.match(source, /recordServiceShadow/, `${writer.id} must observe Legacy with the service Shadow builder.`);
    assert.doesNotMatch(source, /commitFinancialOperation|accounting_operations/, `${writer.id} must not activate V2 in Shadow.`);
}

const pureBuilderSource = readFileSync(new URL('./serviceShadow.ts', import.meta.url), 'utf8');
assert.doesNotMatch(pureBuilderSource, /firebase|recordServiceShadow|Date\.now|Math\.random/, 'Service Draft builders must be pure and Firestore-free.');
const diagnosticsSource = readFileSync(new URL('./serviceShadowDiagnostics.ts', import.meta.url), 'utf8');
assert.doesNotMatch(diagnosticsSource, /firebase|collection\(|\.set\(|\.update\(|\.delete\(/, 'Service diagnostics must never write Firebase.');

for (const fixture of SERVICE_SHADOW_EXPECTED_FIXTURES) {
    const result = compareServiceShadow(fixture.intent, fixture.legacyFacts);
    assert.equal(result.matches, true, fixture.label);
    assert.deepEqual(result.integrityErrors, [], `${fixture.label} must balance.`);
    assert.equal(result.ledgerEffects.serviceProfitDzd, fixture.legacyFacts.serviceProfitDzd, fixture.label);
    assert.deepEqual(
        result.draft.postings.map(({ account, side, amountDzd }) => ({ account, side, amountDzd })),
        fixture.expectedPostings,
        fixture.label,
    );
}

const cashFixture = SERVICE_SHADOW_EXPECTED_FIXTURES[0];
assert.equal(compareServiceShadow(cashFixture.intent).ledgerEffects.serviceProfitDzd, 50, 'A service purchase creates no profit; only its sale margin does.');
assert.equal(compareServiceShadow(SERVICE_SHADOW_EXPECTED_FIXTURES[1].intent).ledgerEffects.fxGainLossDzd, 10, 'PAM FX is distinct from service profit.');
assert.equal(compareServiceShadow(SERVICE_SHADOW_EXPECTED_FIXTURES[2].intent).ledgerEffects.clientReceivableDzd, 150, 'Sale on credit creates a receivable.');
assert.equal(compareServiceShadow(SERVICE_SHADOW_EXPECTED_FIXTURES[2].intent).ledgerEffects.supplierPayableDzd, 100, 'Purchase on credit creates a supplier payable.');

assert.throws(() => buildServiceShadowDraft({
    ...cashFixture.intent,
    operationId: 'fixture:service:bad-credit',
    sale: { wallet: 'Credit', amountDzd: 150, clientId: 'other-client' },
}), /belong to the operation client/i, 'Credit service sale cannot be posted to a different client.');

const readRows: DigitalServiceTransaction[] = [
    {
        id: 'service-cash', type: 'digital_service_sale', clientId: 'client-a', serviceName: 'A',
        purchaseWallet: 'Caisse', purchaseCurrency: 'DZD', purchaseAmount: 100, purchaseRateToDzd: 1, purchaseAmountDzd: 100,
        saleWallet: 'BaridiMob', saleCurrency: 'DZD', saleAmount: 150, saleRateToDzd: 1, saleAmountDzd: 150, profitDzd: 50,
        date: '', time: '', timestamp: 1,
    },
    {
        id: 'service-credit', type: 'digital_service_sale', clientId: 'client-b', serviceName: 'B',
        purchaseWallet: 'USDT', purchaseCurrency: 'USDT', purchaseAmount: 1, purchaseRateToDzd: 250, purchaseAmountDzd: 250,
        saleWallet: 'Credit', saleCurrency: 'DZD', saleAmount: 300, saleRateToDzd: 1, saleAmountDzd: 300, profitDzd: 50,
        date: '', time: '', timestamp: 2,
    },
];
const readReconciliation = reconcileLegacyServicesToShadow(readRows);
assert.equal(readReconciliation.ok, true, JSON.stringify(readReconciliation));
assert.deepEqual(readReconciliation.differences, {
    serviceRevenueDzd: 0, serviceCostDzd: 0, directFeesDzd: 0, serviceProfitDzd: 0,
    fxGainLossDzd: 0, clientReceivableDzd: 0, supplierPayableDzd: 0,
});

clearServiceShadowDiagnostics();
const originalWarn = console.warn;
const warnings: unknown[][] = [];
console.warn = (...args: unknown[]) => warnings.push(args);
try {
    const mismatch = recordServiceShadow(cashFixture.intent, { serviceProfitDzd: 49 });
    assert.equal(mismatch?.matches, false, 'Service mismatches are retained for review only.');
    assert.equal(getServiceShadowDiagnostics().length, 1);
    assert.doesNotThrow(() => recordServiceShadow({ ...cashFixture.intent, operationId: 'fixture:service:invalid', purchase: { wallet: 'Caisse', amountDzd: 0 } }), 'A service Shadow failure must not block Legacy.');
    assert.equal(getServiceShadowDiagnostics().length, 1);
}
finally {
    console.warn = originalWarn;
}
assert.equal(warnings.length, 2, 'Mismatch and builder failure are diagnostics only.');

console.log(`Services shadow tests passed (${SERVICE_SHADOW_EXPECTED_FIXTURES.length} independent service fixtures).`);
