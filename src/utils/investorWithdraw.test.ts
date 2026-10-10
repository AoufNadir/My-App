import assert from 'node:assert/strict';

import { investorWithdrawLimit } from './investorWithdraw';

// The box holds more than the investor is owed: the button writes what is owed.
assert.deepEqual(investorWithdrawLimit({ entitlement: 84300, sourceBalance: 480000 }), { max: 84300, limitedBySource: false });

// The box holds less: the button stops at the box and says so.
assert.deepEqual(investorWithdrawLimit({ entitlement: 84300, sourceBalance: 50000 }), { max: 50000, limitedBySource: true });

// Equal amounts are not « limited by the box ».
assert.deepEqual(investorWithdrawLimit({ entitlement: 1000, sourceBalance: 1000 }), { max: 1000, limitedBySource: false });

// Cents are kept, and a half cent is dropped so the amount never exceeds what is owed.
assert.equal(investorWithdrawLimit({ entitlement: 1234.56, sourceBalance: 5000 }).max, 1234.56);
assert.equal(investorWithdrawLimit({ entitlement: 1234.565, sourceBalance: 5000 }).max, 1234.56);
assert.ok(investorWithdrawLimit({ entitlement: 1234.565, sourceBalance: 5000 }).max <= 1234.565);

// Nothing owed, a negative profit, an empty or negative box, or garbage: 0, so the button is disabled.
assert.equal(investorWithdrawLimit({ entitlement: 0, sourceBalance: 5000 }).max, 0);
assert.equal(investorWithdrawLimit({ entitlement: -300, sourceBalance: 5000 }).max, 0);
assert.equal(investorWithdrawLimit({ entitlement: 5000, sourceBalance: 0 }).max, 0);
assert.equal(investorWithdrawLimit({ entitlement: 5000, sourceBalance: -20 }).max, 0);
assert.equal(investorWithdrawLimit({ entitlement: Number.NaN, sourceBalance: 5000 }).max, 0);
assert.equal(investorWithdrawLimit({ entitlement: 5000, sourceBalance: Number.NaN }).max, 0);

console.log('investor withdraw limit tests passed');
