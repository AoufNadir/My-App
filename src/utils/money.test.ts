import assert from 'node:assert/strict';

import { allocateRoundedDzd } from './money';

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

console.log('money rounding tests passed');
