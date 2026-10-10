import assert from 'node:assert/strict';

import { allocateRoundedDzd, floorM, roundM } from './money';

const rounded = allocateRoundedDzd([
    { id: 'a', value: 38832.6 },
    { id: 'b', value: 1198.6 },
    { id: 'c', value: 193.6 },
    { id: 'd', value: 20469.6 },
    { id: 'e', value: 5903.4 },
]);

const visibleSum = Array.from(rounded.values()).reduce((sum, value) => sum + value, 0);
assert.equal(visibleSum, 66598, 'Visible investor rows must add up to the visible total');
assert.equal(rounded.get('a'), 38833);
assert.equal(rounded.get('b'), 1199);
assert.equal(rounded.get('c'), 194);
assert.equal(rounded.get('d'), 20469, 'One row absorbs the display-only rounding remainder');
assert.equal(rounded.get('e'), 5903);

// floorM never goes above the true amount (the « max » buttons rely on it); roundM would.
assert.equal(roundM(1234.565), 1234.57, 'roundM rounds half up, which is why a max button cannot use it');
assert.equal(floorM(1234.565), 1234.56);
assert.equal(floorM(0.29), 0.29, 'float drift (0.29 * 100 = 28.999999999999996) must not lose a cent');
assert.equal(floorM(0.285), 0.28);
assert.equal(floorM(0.1 + 0.2), 0.3);
assert.equal(floorM(84300), 84300);
assert.equal(floorM(0.004), 0);
assert.equal(floorM(-5), 0, 'a negative amount gives 0');
assert.equal(floorM(Number.NaN), 0);
assert.equal(floorM(Number.POSITIVE_INFINITY), 0);

console.log('money rounding tests passed');
