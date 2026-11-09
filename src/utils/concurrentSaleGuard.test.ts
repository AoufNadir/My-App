import assert from 'node:assert/strict';
import { hasUnknownOperations, newestKnownTimestamp, stockChangedOnServer } from './concurrentSaleGuard';

// V13-6 (audit): a sale written by another tab after this one loaded is caught before this sale is written.
const known = [{ id: 'a', timestamp: 100 }, { id: 'b', timestamp: 300 }];
assert.equal(newestKnownTimestamp(known), 300);
assert.equal(hasUnknownOperations(['b'], new Set(['a', 'b'])), false);
assert.equal(hasUnknownOperations(['c'], new Set(['a', 'b'])), true);
const fake = (ids: string[]) => ({ where: (_f: string, _o: string, value: unknown) => ({ get: async () => { assert.equal(value, 300, 'only newer docs are read'); return { docs: ids.map((id) => ({ id })) }; } }) });
(async () => {
    assert.equal(await stockChangedOnServer(fake([]), known), false, 'nothing new: the sale goes on');
    assert.equal(await stockChangedOnServer(fake(['other-tab']), known), true, 'another tab sold meanwhile: refused');
    console.log('concurrentSaleGuard.test: two tabs cannot sell the same stock');
})();
