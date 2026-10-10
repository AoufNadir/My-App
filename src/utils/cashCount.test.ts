import assert from 'node:assert/strict';
import { cashCountAgrees, cashCountRecord, compareCashCount, expectedCashCount, lastAgreeingCount, type CashCount } from './cashCount';

// V5-2: the count compares what is really there with what the app expects, and only reads.

const expected = expectedCashCount({ caisse: 152_340.5, baridi: 48_000, usdt: { available: 1_200.25, locked: 300 }, eur: { available: 410 } });
assert.deepEqual(expected, { caisse: 152_340.5, baridi: 48_000, usdt: 1_500.25, eur: 410 }, 'USDT and EUR include the 24h-locked stock');

// A sale paid by BaridiMob saved as cash: the Caisse has 20 000 less, BaridiMob 20 000 more.
{
    const lines = compareCashCount(expected, { caisse: 132_340.5, baridi: 68_000 });
    assert.equal(lines.find((line) => line.account === 'caisse')!.difference, -20_000);
    assert.equal(lines.find((line) => line.account === 'baridi')!.difference, 20_000);
    assert.equal(lines.find((line) => line.account === 'usdt')!.difference, null, 'an account left empty is not counted');
    assert.equal(cashCountAgrees(lines), false);
}

// An unrecorded sale of 500 USDT: 500 USDT missing, the cash it brought is extra.
{
    const lines = compareCashCount(expected, { usdt: 1_000.25, caisse: 152_340.5 + 500 * 250 });
    assert.equal(lines.find((line) => line.account === 'usdt')!.difference, -500);
    assert.equal(lines.find((line) => line.account === 'caisse')!.difference, 125_000);
}

// Within the tolerance it agrees: under a dinar, under a cent of USDT or EUR.
{
    const lines = compareCashCount(expected, { caisse: 152_341, baridi: 47_999.5, usdt: 1_500.255, eur: 410 });
    assert.equal(cashCountAgrees(lines), true);
}
assert.equal(cashCountAgrees(compareCashCount(expected, {})), false, 'nothing counted is not a count that agrees');

// Saved: only what was counted, the note trimmed; never an empty note.
assert.deepEqual(cashCountRecord(1000, expected, { caisse: 10, baridi: null, usdt: NaN }, '  soir  '), { timestamp: 1000, expected, counted: { caisse: 10 }, note: 'soir' });
assert.equal('note' in cashCountRecord(1000, expected, { caisse: 10 }, '   '), false);

// The last count that agreed: a mistake found later happened after it.
{
    const count = (id: string, timestamp: number, caisse: number): CashCount => ({ id, timestamp, expected, counted: { caisse } });
    const counts = [count('a', 1, 152_340.5), count('b', 2, 152_340.5), count('c', 3, 100)];
    assert.equal(lastAgreeingCount(counts)?.id, 'b');
    assert.equal(lastAgreeingCount([count('c', 3, 100)]), null);
}

console.log('cash count tests passed');
