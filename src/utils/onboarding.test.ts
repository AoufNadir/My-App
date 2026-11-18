import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { shouldShowOnboarding } from './onboarding';

const base = { setupDone: false as boolean | undefined, isDataLoaded: true, counts: [0, 0, 0, 0] };
assert.equal(shouldShowOnboarding(base), true, 'new empty account sees the setup');
assert.equal(shouldShowOnboarding({ ...base, setupDone: true }), false, 'finished setup never comes back');
assert.equal(shouldShowOnboarding({ ...base, setupDone: undefined }), false, 'not before the server answers');
assert.equal(shouldShowOnboarding({ ...base, isDataLoaded: false }), false, 'not before the data loads');
for (let i = 0; i < 4; i++) {
    const counts = [0, 0, 0, 0]; counts[i] = 1;
    assert.equal(shouldShowOnboarding({ ...base, counts }), false, 'an account with any data never sees it');
}
const main = readFileSync(new URL('../MainApp.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
assert.match(main, /counts: \[transactions\.length, clientsDzd\.length, treasuryTransactions\.length/);
const hook = readFileSync(new URL('../hooks/useSetupDone.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
assert.match(hook, /fromCache === false/, 'only the server answer opens the setup');
console.log('onboarding tests passed');
