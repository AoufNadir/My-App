import assert from 'node:assert/strict';

import { saleStatusAfterClientPick, USUAL_CHANNELS, usualChannelDiffers, usualChannelOf, usualChannelToSave } from './usualChannel';

assert.deepEqual([...USUAL_CHANNELS], ['cash', 'baridi']);

// Reading a client: only the two channels count; anything else is « none ».
assert.equal(usualChannelOf({ usualChannel: 'cash' }), 'cash');
assert.equal(usualChannelOf({ usualChannel: 'baridi' }), 'baridi');
assert.equal(usualChannelOf({ usualChannel: 'credit' }), null);
assert.equal(usualChannelOf({ usualChannel: null }), null);
assert.equal(usualChannelOf({ usualChannel: 42 }), null);
assert.equal(usualChannelOf({}), null);
assert.equal(usualChannelOf(null), null);
assert.equal(usualChannelOf(undefined), null);

// Saving: the window gives '' for « none ».
assert.equal(usualChannelToSave('cash'), 'cash');
assert.equal(usualChannelToSave('baridi'), 'baridi');
assert.equal(usualChannelToSave(''), null);
assert.equal(usualChannelToSave('credit'), null);
assert.equal(usualChannelToSave(null), null);
assert.equal(usualChannelToSave(undefined), null);

// The warning: only when the chosen channel is the other cash/baridi one.
assert.equal(usualChannelDiffers('baridi', 'cash'), 'baridi');
assert.equal(usualChannelDiffers('cash', 'baridi'), 'cash');
assert.equal(usualChannelDiffers('cash', 'cash'), null);
assert.equal(usualChannelDiffers('baridi', 'baridi'), null);
// Credit is not a channel: no warning.
assert.equal(usualChannelDiffers('baridi', 'credit'), null);
assert.equal(usualChannelDiffers('cash', 'credit'), null);
// No usual channel, or nothing chosen: no warning.
assert.equal(usualChannelDiffers(null, 'cash'), null);
assert.equal(usualChannelDiffers('cash', null), null);
assert.equal(usualChannelDiffers('cash', undefined), null);
assert.equal(usualChannelDiffers('cash', ''), null);

// A new sale: picking a client with a habit starts on it; the user's own choice is never overridden.
const fresh = { touched: false, editing: false, fromClient: false };
assert.deepEqual(saleStatusAfterClientPick({ ...fresh, usual: 'baridi' }), { status: 'baridi', fromClient: true });
assert.deepEqual(saleStatusAfterClientPick({ ...fresh, usual: 'cash' }), { status: 'cash', fromClient: true });
// A client without a habit changes nothing...
assert.deepEqual(saleStatusAfterClientPick({ ...fresh, usual: null }), { status: null, fromClient: false });
// ...except that a status which only came from the previous client goes back to cash.
assert.deepEqual(saleStatusAfterClientPick({ ...fresh, usual: null, fromClient: true }), { status: 'cash', fromClient: false });
// Switching from one client with a habit to another follows the new one.
assert.deepEqual(saleStatusAfterClientPick({ ...fresh, usual: 'cash', fromClient: true }), { status: 'cash', fromClient: true });
// Pressed by hand: kept, whatever the client.
assert.deepEqual(saleStatusAfterClientPick({ ...fresh, usual: 'baridi', touched: true }), { status: null, fromClient: false });
assert.deepEqual(saleStatusAfterClientPick({ ...fresh, usual: null, touched: true }), { status: null, fromClient: false });
// Editing a saved sale: never touched.
assert.deepEqual(saleStatusAfterClientPick({ ...fresh, usual: 'baridi', editing: true }), { status: null, fromClient: false });

console.log('usualChannel tests passed');
