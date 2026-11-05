import assert from 'node:assert/strict';
import { checkSetup, effectiveAccounts, LEGACY_ACCOUNTS, LEGACY_SETTINGS, needsSetup, readAccounts, readBusinessSettings, setupDocuments } from './businessSettings';

// A business made before M2 reads exactly as the app has always worked.
assert.deepEqual(readBusinessSettings(undefined), LEGACY_SETTINGS);
assert.deepEqual(readBusinessSettings('broken'), LEGACY_SETTINGS);
assert.deepEqual(effectiveAccounts([]), LEGACY_ACCOUNTS, 'no account created: the cash box and BaridiMob');
// Reading cleans what it gets.
const read = readBusinessSettings({ baseCurrency: 'eur', currencies: ['usdt', 'EUR', 'gbp', 'GBP', '???'], businessName: '  Shop  ', logo: 'javascript:x', setupDone: true });
assert.deepEqual(read, { baseCurrency: 'EUR', currencies: ['USDT', 'GBP'], businessName: 'Shop', logo: null, setupDone: true }, 'codes normalised, base and duplicates removed, bad logo dropped');
assert.deepEqual(readAccounts([{ id: 'a', data: { name: ' Revolut ', kind: 'online' } }, { id: 'b', data: { name: '', kind: 'cash' } }, { id: 'c', data: { name: 'X', kind: 'weird', archived: true } }]), [
    { id: 'a', name: 'Revolut', kind: 'online', archived: false },
    { id: 'c', name: 'X', kind: 'cash', archived: true },
]);
assert.deepEqual(effectiveAccounts([{ id: 'a', name: 'Revolut', kind: 'online' }, { id: 'c', name: 'X', kind: 'cash', archived: true }]).map((a) => a.id), ['a'], 'archived accounts are left out');
// The setup is for an empty business only: never for the owner, who has data.
assert.equal(needsSetup({ businessRaw: undefined, hasAnyData: true }), false);
assert.equal(needsSetup({ businessRaw: undefined, hasAnyData: false }), true);
assert.equal(needsSetup({ businessRaw: { setupDone: true }, hasAnyData: false }), false);
// Checks before saving.
const draft = { baseCurrency: 'EUR', currencies: ['USDT', 'EUR'], accounts: [{ name: 'Revolut', kind: 'online' as const }], businessName: 'Shop', logo: null };
assert.deepEqual(checkSetup(draft), { ok: true });
assert.deepEqual(checkSetup({ ...draft, currencies: ['EUR'] }), { ok: false, reason: 'no_currency' }, 'the base currency alone is not traded');
assert.deepEqual(checkSetup({ ...draft, accounts: [{ name: ' ', kind: 'cash' }] }), { ok: false, reason: 'no_account' });
assert.deepEqual(checkSetup({ ...draft, logo: `data:image/png;base64,${'a'.repeat(200_000)}` }), { ok: false, reason: 'logo_too_big' });
assert.deepEqual(setupDocuments(draft), {
    business: { baseCurrency: 'EUR', currencies: ['USDT'], businessName: 'Shop', logo: null, setupDone: true },
    accounts: [{ name: 'Revolut', kind: 'online', archived: false }],
});
console.log('businessSettings tests passed');
