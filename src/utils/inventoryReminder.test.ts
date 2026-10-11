import assert from 'node:assert/strict';

import { inventoryReminder, REMINDER_FROM_HOUR } from './inventoryReminder';

// Local times throughout, so the test gives the same result in any time zone.
const at = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute).getTime();
const base = { snoozedDay: null, ready: true } as const;

assert.equal(REMINDER_FROM_HOUR, 17);

// Counted today: nothing to remind, early or late.
assert.equal(inventoryReminder({ ...base, lastTimestamp: at(11, 9), now: at(11, 20) }), null);
assert.equal(inventoryReminder({ ...base, lastTimestamp: at(11, 23, 59), now: at(11, 23, 59) }), null);

// Counted yesterday: the reminder opens at 17:00, not before.
assert.equal(inventoryReminder({ ...base, lastTimestamp: at(10, 18), now: at(11, 8) }), null);
assert.equal(inventoryReminder({ ...base, lastTimestamp: at(10, 18), now: at(11, 16, 59) }), null);
assert.deepEqual(
    inventoryReminder({ ...base, lastTimestamp: at(10, 18), now: at(11, 17) }),
    { daysSince: 1, lastTimestamp: at(10, 18) },
);
assert.equal(inventoryReminder({ ...base, lastTimestamp: at(10, 23, 59), now: at(11, 21) })?.daysSince, 1);
// The day counts by calendar day, not by 24-hour distance.
assert.equal(inventoryReminder({ ...base, lastTimestamp: at(10, 23, 50), now: at(11, 17, 5) })?.daysSince, 1);

// Two days or more: it shows at any hour.
assert.deepEqual(
    inventoryReminder({ ...base, lastTimestamp: at(9, 10), now: at(11, 7) }),
    { daysSince: 2, lastTimestamp: at(9, 10) },
);
assert.equal(inventoryReminder({ ...base, lastTimestamp: at(1, 10), now: at(11, 7) })?.daysSince, 10);

// Never counted: it shows at once, with no count of days.
assert.deepEqual(
    inventoryReminder({ ...base, lastTimestamp: null, now: at(11, 8) }),
    { daysSince: null, lastTimestamp: null },
);
assert.deepEqual(
    inventoryReminder({ ...base, lastTimestamp: Number.NaN, now: at(11, 8) }),
    { daysSince: null, lastTimestamp: null },
);

// « Remind me tomorrow » hides it for the rest of that day only.
assert.equal(inventoryReminder({ ...base, snoozedDay: '2026-10-11', lastTimestamp: null, now: at(11, 8) }), null);
assert.equal(inventoryReminder({ ...base, snoozedDay: '2026-10-11', lastTimestamp: at(5, 9), now: at(11, 23) }), null);
assert.equal(inventoryReminder({ ...base, snoozedDay: '2026-10-11', lastTimestamp: at(5, 9), now: at(12, 8) })?.daysSince, 7);
// A snooze from an earlier day does nothing.
assert.equal(inventoryReminder({ ...base, snoozedDay: '2026-10-09', lastTimestamp: null, now: at(11, 8) })?.daysSince, null);

// An empty cache is not « never counted »: nothing until the saved counts were really received.
assert.equal(inventoryReminder({ snoozedDay: null, ready: false, lastTimestamp: null, now: at(11, 8) }), null);
assert.equal(inventoryReminder({ snoozedDay: null, ready: false, lastTimestamp: at(1, 9), now: at(11, 8) }), null);

// A clock behind the last count (a count dated in the future) never reminds.
assert.equal(inventoryReminder({ ...base, lastTimestamp: at(15, 9), now: at(11, 20) }), null);

// Across a month end and a year end.
assert.equal(
    inventoryReminder({ ...base, lastTimestamp: new Date(2026, 11, 31, 10).getTime(), now: new Date(2027, 0, 2, 9).getTime() })?.daysSince,
    2,
);

console.log('inventoryReminder tests passed');
