import assert from 'node:assert/strict';
import { DATE_PRESET_IDS, activeDatePreset, datePresetRange } from './datePresets';

// The shortcuts of the operations date filter mean the same days every time, in local time.
const now = new Date(2026, 10, 4, 15, 30); // 04/11/2026
assert.deepEqual(datePresetRange('today', now), { start: '2026-11-04', end: '2026-11-04' });
assert.deepEqual(datePresetRange('last7', now), { start: '2026-10-29', end: '2026-11-04' });
assert.deepEqual(datePresetRange('thisMonth', now), { start: '2026-11-01', end: '2026-11-04' });
assert.deepEqual(datePresetRange('lastMonth', now), { start: '2026-10-01', end: '2026-10-31' });
assert.deepEqual(datePresetRange('thisYear', now), { start: '2026-01-01', end: '2026-11-04' });
// January: last month is December of the year before.
assert.deepEqual(datePresetRange('lastMonth', new Date(2026, 0, 10)), { start: '2025-12-01', end: '2025-12-31' });
for (const id of DATE_PRESET_IDS) {
    const { start, end } = datePresetRange(id, now);
    assert.equal(activeDatePreset(start, end, now), id, `${id} lights itself`);
}
assert.equal(activeDatePreset('2026-10-05', '2026-10-20', now), null, 'hand-picked dates light nothing');
assert.equal(activeDatePreset('', '', now), null);
console.log('date presets tests passed');
