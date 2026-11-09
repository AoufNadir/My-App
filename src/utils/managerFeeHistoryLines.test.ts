import assert from 'node:assert/strict';
import { managerFeeHistoryLines } from './managerFeeHistoryLines';

const d1 = Date.UTC(2026, 8, 15), d2 = Date.UTC(2026, 10, 1);
assert.deepEqual(managerFeeHistoryLines([]), [], 'no change recorded: nothing to explain');
assert.deepEqual(managerFeeHistoryLines([{ percentage: 20, effectiveFrom: d1 }]), [{ from: d1, percentage: 20 }, { from: null, percentage: 30 }]);
assert.deepEqual(managerFeeHistoryLines([{ percentage: 25, effectiveFrom: d2 }, { percentage: 20, effectiveFrom: d1 }]), [{ from: d2, percentage: 25 }, { from: d1, percentage: 20 }, { from: null, percentage: 30 }]);
assert.deepEqual(managerFeeHistoryLines([{ percentage: 30, effectiveFrom: d1 }]), [{ from: null, percentage: 30 }], 'same rate: one line');
console.log('managerFeeHistoryLines.test: each rate from its date, the past keeps its own');
