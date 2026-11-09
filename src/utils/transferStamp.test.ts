import assert from 'node:assert/strict';
import { transferStamp } from './transferStamp';

// V13-6 (audit): the date typed when editing a transfer is read in both formats and kept with its time.
const a = transferStamp('2027-03-05', '14:30');
assert.equal(a?.date, '05/03/2027');
assert.equal(a?.time, '14:30');
assert.equal(a?.timestamp, new Date(2027, 2, 5, 14, 30).getTime());
assert.equal(transferStamp('05/03/2027', '')?.timestamp, new Date(2027, 2, 5).getTime());
assert.equal(transferStamp('', '10:00'), null, 'nothing typed: keep the old date');
assert.equal(transferStamp('hier', ''), null);
console.log('transferStamp.test: the edited transfer date is saved');
