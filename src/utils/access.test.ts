import assert from 'node:assert/strict';
import { accessState, canWriteWith, daysLeft, extendedUntil, readAccess, DAY_MS } from './access';

const now = Date.UTC(2026, 10, 22);
const st = (access: unknown, extra: Partial<{ isOperator: boolean; loaded: boolean }> = {}) => accessState({ isOperator: false, loaded: true, access: readAccess(access), now, ...extra });
assert.equal(st(null, { isOperator: true }), 'operator');
assert.equal(st(null, { loaded: false }), 'loading');
assert.equal(st(null), 'pending');
assert.equal(st({ until: 'x' }), 'pending');
assert.equal(st({ until: now + 30 * DAY_MS }), 'active');
assert.equal(st({ until: now + 7 * DAY_MS }), 'expiring');
assert.equal(st({ until: now }), 'expired');
assert.equal(st({ until: now - 1 }), 'expired');
assert.deepEqual(['operator', 'active', 'expiring', 'expired', 'pending', 'loading'].map((s) => canWriteWith(s as never)), [true, true, true, false, false, false]);
assert.equal(daysLeft(now + 2.5 * DAY_MS, now), 3);
assert.equal(daysLeft(now - DAY_MS, now), 0);
// Extending a running subscription adds to its end; an ended one starts again from now.
assert.equal(extendedUntil(now + 5 * DAY_MS, 30, now), now + 35 * DAY_MS);
assert.equal(extendedUntil(now - 5 * DAY_MS, 30, now), now + 30 * DAY_MS);
assert.equal(extendedUntil(null, 14, now), now + 14 * DAY_MS);
console.log('access: ok');
