import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// V13-2 fix: the app's Firestore wrapper takes (onNext, options, onError). Passing the error handler second made
// Firebase read it as the listener, so the switch saved but never showed the new value. Same order as usePeriodLock.
const source = readFileSync(new URL('./useHiddenCurrencies.ts', import.meta.url), 'utf8');
assert.ok(/onSnapshot\(\(snapshot\) => \{[\s\S]*?\}, undefined, \(error\) =>/.test(source), 'onSnapshot(onNext, undefined, onError)');
console.log('useHiddenCurrencies.test: listener arguments in the wrapper order');
