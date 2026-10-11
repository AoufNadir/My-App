import assert from 'node:assert/strict';

import { CHANNEL_TONE, channelSentenceKey, settlementChannel, tradeChannel } from './channelSummary';

// A sale paid in cash enters the Caisse; BaridiMob enters BaridiMob.
assert.deepEqual(
    tradeChannel({ operation: 'sell', status: 'cash', amount: 150_000 }),
    { kind: 'cash', wallet: 'Caisse', flow: 'in', amount: 150_000, accountClientId: null },
);
assert.deepEqual(
    tradeChannel({ operation: 'sell', status: 'baridi', amount: 80_000 }),
    { kind: 'baridi', wallet: 'BaridiMob', flow: 'in', amount: 80_000, accountClientId: null },
);

// A purchase leaves the wallet.
assert.deepEqual(
    tradeChannel({ operation: 'buy', status: 'cash', amount: 90_000 }),
    { kind: 'cash', wallet: 'Caisse', flow: 'out', amount: 90_000, accountClientId: null },
);
assert.equal(tradeChannel({ operation: 'buy', status: 'baridi', amount: 90_000 })?.wallet, 'BaridiMob');

// Credit moves no wallet and stays on the primary client's account.
assert.deepEqual(
    tradeChannel({ operation: 'sell', status: 'credit', primaryClientId: 'c1', amount: 40_000 }),
    { kind: 'credit', wallet: null, flow: 'in', amount: 40_000, accountClientId: 'c1' },
);
assert.equal(tradeChannel({ operation: 'buy', status: 'credit', amount: 40_000 })?.accountClientId, null);
assert.equal(tradeChannel({ operation: 'buy', status: 'credit', primaryClientId: 'none', amount: 40_000 })?.accountClientId, null);

// An amount taken by another client moves no wallet: for a sale, in cash or BaridiMob; for a purchase, only in cash.
assert.deepEqual(
    tradeChannel({ operation: 'sell', status: 'cash', otherClientId: 'c2', amount: 10_000 }),
    { kind: 'client', wallet: null, flow: 'in', amount: 10_000, accountClientId: 'c2' },
);
assert.equal(tradeChannel({ operation: 'sell', status: 'baridi', otherClientId: 'c2', amount: 10_000 })?.kind, 'client');
assert.equal(tradeChannel({ operation: 'buy', status: 'cash', otherClientId: 'c2', amount: 10_000 })?.kind, 'client');
assert.equal(tradeChannel({ operation: 'buy', status: 'cash', otherClientId: 'c2', amount: 10_000 })?.flow, 'out');
assert.equal(tradeChannel({ operation: 'buy', status: 'baridi', otherClientId: 'c2', amount: 10_000 })?.kind, 'baridi');
// Credit ignores the other client.
assert.equal(tradeChannel({ operation: 'sell', status: 'credit', otherClientId: 'c2', amount: 10_000 })?.kind, 'credit');
// '' and 'none' mean no client.
assert.equal(tradeChannel({ operation: 'sell', status: 'cash', otherClientId: '', amount: 10_000 })?.kind, 'cash');
assert.equal(tradeChannel({ operation: 'sell', status: 'cash', otherClientId: 'none', amount: 10_000 })?.kind, 'cash');

// No amount, nothing to say.
assert.equal(tradeChannel({ operation: 'sell', status: 'cash', amount: 0 }), null);
assert.equal(tradeChannel({ operation: 'sell', status: 'cash', amount: -5 }), null);
assert.equal(tradeChannel({ operation: 'sell', status: 'cash', amount: Number.NaN }), null);
assert.equal(tradeChannel({ operation: 'sell', status: 'cash', amount: Number.POSITIVE_INFINITY }), null);

// A payment from the client page.
assert.deepEqual(
    settlementChannel({ received: true, status: 'baridi', amount: 25_000 }),
    { kind: 'baridi', wallet: 'BaridiMob', flow: 'in', amount: 25_000, accountClientId: null },
);
assert.deepEqual(
    settlementChannel({ received: false, status: 'cash', amount: 25_000 }),
    { kind: 'cash', wallet: 'Caisse', flow: 'out', amount: 25_000, accountClientId: null },
);
assert.deepEqual(
    settlementChannel({ received: true, status: 'cash', receiverClientId: 'c3', amount: 25_000 }),
    { kind: 'client', wallet: null, flow: 'in', amount: 25_000, accountClientId: 'c3' },
);
assert.equal(settlementChannel({ received: false, status: 'cash', receiverClientId: 'none', amount: 25_000 })?.kind, 'cash');
assert.equal(settlementChannel({ received: true, status: 'cash', amount: 0 }), null);

// Colours: cash green, BaridiMob blue, credit orange; a client takes no colour of its own.
assert.deepEqual(CHANNEL_TONE, { cash: 'profit', baridi: 'primary', credit: 'debt', client: 'neutral' });

// Sentences.
const cashIn = tradeChannel({ operation: 'sell', status: 'cash', amount: 1 })!;
const baridiIn = tradeChannel({ operation: 'sell', status: 'baridi', amount: 1 })!;
const cashOut = tradeChannel({ operation: 'buy', status: 'cash', amount: 1 })!;
const baridiOut = tradeChannel({ operation: 'buy', status: 'baridi', amount: 1 })!;
assert.equal(channelSentenceKey(cashIn, 'sell'), 'channelStrip.inCaisse');
assert.equal(channelSentenceKey(baridiIn, 'sell'), 'channelStrip.inBaridi');
assert.equal(channelSentenceKey(cashOut, 'buy'), 'channelStrip.outCaisse');
assert.equal(channelSentenceKey(baridiOut, 'buy'), 'channelStrip.outBaridi');
assert.equal(channelSentenceKey(tradeChannel({ operation: 'sell', status: 'credit', amount: 1 })!, 'sell'), 'channelStrip.creditSell');
assert.equal(channelSentenceKey(tradeChannel({ operation: 'buy', status: 'credit', amount: 1 })!, 'buy'), 'channelStrip.creditBuy');
assert.equal(channelSentenceKey(tradeChannel({ operation: 'sell', status: 'cash', otherClientId: 'c2', amount: 1 })!, 'sell'), 'channelStrip.clientIn');
assert.equal(channelSentenceKey(tradeChannel({ operation: 'buy', status: 'cash', otherClientId: 'c2', amount: 1 })!, 'buy'), 'channelStrip.clientOut');
assert.equal(channelSentenceKey(settlementChannel({ received: true, status: 'baridi', amount: 1 })!, 'settlement'), 'channelStrip.inBaridi');
assert.equal(channelSentenceKey(settlementChannel({ received: false, status: 'cash', amount: 1 })!, 'settlement'), 'channelStrip.outCaisse');

console.log('channelSummary tests passed');
