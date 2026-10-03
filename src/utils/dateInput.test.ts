// Algeria: the user's time zone, one hour ahead of UTC. Set before any date is built.
process.env.TZ = 'Africa/Algiers';

import assert from 'node:assert/strict';
import { formatDayLabel, fromDateInputValue, toDateInputValue } from './dateInput';

assert.equal(new Date(2026, 8, 10).getTimezoneOffset(), -60, 'the test runs on Algeria time');

// The period 10/09 to 13/09, as the date filter stores it.
const start = fromDateInputValue('2026-09-10');
start.setHours(0, 0, 0, 0);
const end = fromDateInputValue('2026-09-13');
end.setHours(23, 59, 59, 999);
assert.equal(start.getTime(), new Date(2026, 8, 10, 0, 0, 0, 0).getTime());
assert.equal(end.getTime(), new Date(2026, 8, 13, 23, 59, 59, 999).getTime());

// Reopening the filter shows the same two days. The old code gave the day before for the start.
assert.equal(start.toISOString().split('T')[0], '2026-09-09', 'the old way was one day early');
assert.equal(toDateInputValue(start), '2026-09-10');
assert.equal(toDateInputValue(end), '2026-09-13');

// Applying it again keeps the same period.
assert.equal(fromDateInputValue(toDateInputValue(start)).getTime(), start.getTime());

// The chip shows the days as the operations write them.
assert.equal(formatDayLabel(start), '10/09/2026');
assert.equal(formatDayLabel(end), '13/09/2026');
assert.equal(formatDayLabel(new Date(2026, 0, 5, 23, 30)), '05/01/2026');

console.log('dateInput tests passed');
