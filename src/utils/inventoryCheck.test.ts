import assert from 'node:assert/strict';

import {
    buildInventoryCheckData,
    compareInventory,
    correctionEntryFor,
    inventoryExpected,
    inventoryMonths,
    isCheckClean,
    lastCleanCheck,
    lastMatchingCheck,
    listBalanceCorrections,
    monthKeyOf,
    type InventoryCheck,
} from './inventoryCheck';

const expected = inventoryExpected({ caisse: 482_500, baridi: 120_000.4, usdtAvailable: 1_200.5, usdtLocked: 300, eurAvailable: 90.25 });

// The books: USDT counts the part still locked for 24 hours, a missing locked part is zero.
assert.deepEqual(expected, { caisse: 482_500, baridi: 120_000.4, usdt: 1_500.5, eur: 90.25 });
assert.deepEqual(inventoryExpected({ caisse: Number.NaN, baridi: -0, usdtAvailable: Number.NaN, eurAvailable: 0 }), { caisse: 0, baridi: 0, usdt: 0, eur: 0 });

// An account that was not counted is left out; it is never read as zero.
{
    const rows = compareInventory(expected, { caisse: 482_500, usdt: undefined, eur: null, baridi: Number.NaN });
    assert.deepEqual(rows.map((r) => r.account), ['caisse']);
    assert.equal(compareInventory(expected, {}).length, 0);
}

// Same, short (real below the books) and over (real above the books).
{
    const rows = compareInventory(expected, { caisse: 482_500, baridi: 118_000, usdt: 1_520.5, eur: 90.25 });
    const by = Object.fromEntries(rows.map((r) => [r.account, r]));
    assert.equal(by.caisse.status, 'match');
    assert.equal(by.caisse.gap, 0);
    assert.equal(by.baridi.status, 'short');
    assert.equal(by.baridi.gap, -2_000.4);
    assert.equal(by.usdt.status, 'over');
    assert.equal(by.usdt.gap, 20);
    assert.equal(by.eur.status, 'match');
}

// Tolerance: under one dinar for cash, one cent for USDT and EUR; cents are exact, no float noise.
{
    const near = compareInventory(expected, { baridi: 120_000, usdt: 1_500.49, eur: 90.27 });
    const by = Object.fromEntries(near.map((r) => [r.account, r]));
    assert.equal(by.baridi.status, 'match', '0.40 DA is under one dinar');
    assert.equal(by.usdt.status, 'match', 'one cent of USDT');
    assert.equal(by.eur.status, 'over', 'two cents of EUR is a gap');
    assert.equal(compareInventory(expected, { baridi: 119_999 }).find((r) => r.account === 'baridi')?.status, 'short', '1.40 DA is a gap');
    assert.equal(compareInventory(expected, { usdt: 1_500.5 + 0.1 + 0.2 - 0.3 })[0].gap, 0, 'float drift never shows as a gap');
}

// The saved document holds only the counted accounts, with the stamp and a trimmed note.
const stamp = (timestamp: number) => ({ date: '10/10/2026', time: '20:00', timestamp });
{
    assert.equal(buildInventoryCheckData(expected, {}, stamp(1)), null, 'nothing counted, nothing to save');
    const data = buildInventoryCheckData(expected, { caisse: 482_500, usdt: 1_400 }, stamp(1_000), '  fin de journée  ');
    assert.ok(data);
    assert.equal(data!.timestamp, 1_000);
    assert.equal(data!.note, 'fin de journée');
    assert.deepEqual(data!.rows.map((r) => [r.account, r.status]), [['caisse', 'match'], ['usdt', 'short']]);
    assert.equal('note' in buildInventoryCheckData(expected, { caisse: 1 }, stamp(1), '   ')!, false, 'an empty note is not stored');
    assert.equal(isCheckClean({ rows: data!.rows }), false);
    assert.equal(isCheckClean({ rows: [] }), false, 'an empty check proves nothing');
}

// « Last matching check »: per account, and for a check where everything matched.
{
    const check = (id: string, timestamp: number, counts: Parameters<typeof compareInventory>[1]): InventoryCheck => ({ id, ...buildInventoryCheckData(expected, counts, stamp(timestamp))! });
    const checks: InventoryCheck[] = [
        check('a', 100, { caisse: 482_500, baridi: 120_000, usdt: 1_500.5, eur: 90.25 }),
        check('b', 200, { caisse: 482_500, baridi: 110_000 }),
        check('c', 300, { caisse: 470_000, usdt: 1_500.5 }),
    ];
    assert.equal(lastMatchingCheck(checks, 'caisse')?.id, 'b', 'c did not match for the cash box, b did');
    assert.equal(lastMatchingCheck(checks, 'baridi')?.id, 'a');
    assert.equal(lastMatchingCheck(checks, 'usdt')?.id, 'c');
    assert.equal(lastMatchingCheck(checks, 'eur')?.id, 'a');
    assert.equal(lastMatchingCheck([checks[1]], 'usdt'), null, 'never counted');
    assert.equal(lastMatchingCheck([checks[2]], 'caisse'), null, 'counted but never matched');
    assert.equal(lastCleanCheck(checks)?.id, 'a');
    assert.equal(lastCleanCheck([checks[2], checks[1]]), null);
    assert.equal(lastCleanCheck([]), null);
}

// Corrections already made with the « edit balance » windows, signed; other rows are ignored.
const correctionRows = () => listBalanceCorrections(
    [
        { type: 'Retrait', source: 'Caisse', amount: 1_200, origin: 'balance_edit', timestamp: Date.UTC(2026, 9, 5, 12) },
        { type: 'Ajout', source: 'BaridiMob', amount: 500, origin: 'balance_edit', timestamp: Date.UTC(2026, 9, 6, 12) },
        { type: 'Ajout', source: 'Caisse', amount: 99_999, origin: 'client_tx', timestamp: Date.UTC(2026, 9, 6, 12) },
        { type: 'Transfer', source: 'Caisse', amount: 7, origin: 'balance_edit', timestamp: Date.UTC(2026, 9, 6, 12) },
        { type: 'Retrait', source: 'Caisse', amount: 300, origin: 'balance_edit', timestamp: Date.UTC(2026, 8, 20, 12) },
    ],
    [
        { type: 'Retrait Manuel', currency: 'USDT', quantity: 12.5, origin: 'balance_edit', timestamp: Date.UTC(2026, 9, 7, 12) },
        { type: 'Ajout Manuel', currency: 'EUR', quantity: 3, origin: 'balance_edit', timestamp: Date.UTC(2026, 9, 7, 13) },
        { type: 'Ajout Manuel', currency: 'USDT', quantity: 1_000, timestamp: Date.UTC(2026, 9, 7, 13) },
    ],
);
{
    const rows = correctionRows();
    assert.equal(rows.length, 5);
    assert.deepEqual(rows.map((r) => [r.account, r.amount]), [['eur', 3], ['usdt', -12.5], ['baridi', 500], ['caisse', -1_200], ['caisse', -300]], 'newest first, signed');
}

// The monthly list: checks and absorbed gaps per month, newest month first, empty months absent.
{
    const octCheck: InventoryCheck = { id: 'o', ...buildInventoryCheckData(expected, { caisse: 480_000 }, stamp(Date.UTC(2026, 9, 9, 12)))! };
    const sepCheck: InventoryCheck = { id: 's', ...buildInventoryCheckData(expected, { caisse: 482_500 }, stamp(Date.UTC(2026, 8, 28, 12)))! };
    const months = inventoryMonths([sepCheck, octCheck], correctionRows());
    assert.deepEqual(months.map((m) => m.month), ['2026-10', '2026-09']);
    const oct = months[0];
    assert.deepEqual(oct.checks.map((c) => c.id), ['o']);
    assert.deepEqual(oct.corrections, { caisse: -1_200, baridi: 500, usdt: -12.5, eur: 3 });
    assert.equal(oct.correctionCount, 4);
    assert.deepEqual(months[1].corrections, { caisse: -300, baridi: 0, usdt: 0, eur: 0 });
    assert.deepEqual(inventoryMonths([], []), []);
    assert.equal(monthKeyOf(new Date(2026, 0, 31, 23, 30).getTime()), '2026-01');
}

// What to type in the existing correction window: whole dinars for cash, a signed amount for stock.
{
    const row = (account: 'caisse' | 'baridi' | 'usdt' | 'eur', counted: number, gap: number) => ({ account, counted, gap });
    assert.equal(correctionEntryFor(row('caisse', 480_000.4, -2_500)), '480000');
    assert.equal(correctionEntryFor(row('baridi', 119_999.6, -0.8)), '120000');
    assert.equal(correctionEntryFor(row('usdt', 1_480.5, -20)), '-20.00');
    assert.equal(correctionEntryFor(row('eur', 93.25, 3)), '+3.00');
    assert.equal(correctionEntryFor(row('usdt', 1, 0.1 + 0.2)), '+0.30');
}

console.log('inventory check tests passed');
