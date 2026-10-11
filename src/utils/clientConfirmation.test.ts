import assert from 'node:assert/strict';
import {
    CLIENT_CONFIRMATION_LIST_LIMIT,
    CLIENT_CONFIRMATION_MAX_AGE_DAYS,
    buildClientConfirmationData,
    clientOperationsSince,
    clientTransferSuggestions,
    isAgreement,
    lastAgreedConfirmation,
    latestConfirmationByClient,
    openClientGaps,
    parseClientConfirmation,
    type ClientConfirmation,
    type ClientOperationRow,
} from './clientConfirmation';

// V5-3: « confirm the client's balance ». The confirmation holds no money: it is compared with the
// app's balance, narrows the search, and two opposite gaps point to a client-to-client transfer.

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 10, 12);
const stamp = (daysAgo: number) => ({ timestamp: NOW - daysAgo * DAY, date: `d-${daysAgo}`, time: '10:00' });
const confirmation = (id: string, clientId: string, claimed: number, appBalance: number, daysAgo: number): ClientConfirmation =>
    ({ id, ...buildClientConfirmationData(clientId, claimed, appBalance, stamp(daysAgo))! });

// 1. Building: the gap is what the client says minus what the app says, to the cent; bad input is refused.
{
    const data = buildClientConfirmationData('a', -52_400, -52_000.1, stamp(0), '  par téléphone  ')!;
    assert.equal(data.gap, -399.9);
    assert.equal(data.claimed, -52_400);
    assert.equal(data.appBalance, -52_000.1);
    assert.equal(data.note, 'par téléphone');
    assert.equal('note' in buildClientConfirmationData('a', 0, 0, stamp(0))!, false, 'no empty note stored');
    assert.equal(buildClientConfirmationData('', 1, 1, stamp(0)), null);
    assert.equal(buildClientConfirmationData('a', Number.NaN, 1, stamp(0)), null);
    assert.equal(buildClientConfirmationData('a', 1, Number.POSITIVE_INFINITY, stamp(0)), null);
    // 0.1 + 0.2 style drift never reaches the stored gap.
    assert.equal(buildClientConfirmationData('a', 0.3, 0.1 + 0.2, stamp(0))!.gap, 0);
}

// 2. Reading a stored document: malformed ones are dropped, the gap is recomputed.
{
    const ok = parseClientConfirmation('x', { clientId: 'a', timestamp: 5, claimed: 100, appBalance: 40, gap: 9999, date: '01/10/2026', time: '09:00', note: ' n ' })!;
    assert.equal(ok.gap, 60, 'a stored gap is not trusted');
    assert.equal(ok.note, 'n');
    assert.equal(parseClientConfirmation('x', null), null);
    assert.equal(parseClientConfirmation('x', 'text'), null);
    assert.equal(parseClientConfirmation('x', { clientId: '', timestamp: 5, claimed: 1, appBalance: 1 }), null);
    assert.equal(parseClientConfirmation('x', { clientId: 'a', timestamp: '5', claimed: 1, appBalance: 1 }), null);
    assert.equal(parseClientConfirmation('x', { clientId: 'a', timestamp: 5, claimed: 1 }), null);
}

// 3. Agreement tolerance: one dinar.
{
    assert.equal(isAgreement(0), true);
    assert.equal(isAgreement(1), true);
    assert.equal(isAgreement(-1), true);
    assert.equal(isAgreement(1.01), false);
    assert.equal(isAgreement(-500), false);
}

// 4. Latest and last agreed.
{
    const list = [
        confirmation('1', 'a', 100, 100, 9),
        confirmation('2', 'a', 150, 100, 5),
        confirmation('3', 'a', 120, 100, 2),
        confirmation('4', 'b', 10, 10, 3),
    ];
    const latest = latestConfirmationByClient(list);
    assert.equal(latest.get('a')?.id, '3');
    assert.equal(latest.get('b')?.id, '4');
    assert.equal(lastAgreedConfirmation(list, 'a')?.id, '1', 'the last time a agreed was nine days ago');
    assert.equal(lastAgreedConfirmation(list, 'b')?.id, '4');
    assert.equal(lastAgreedConfirmation(list, 'zzz'), null);
    assert.equal(lastAgreedConfirmation([confirmation('9', 'c', 5, 1, 1)], 'c'), null, 'never agreed');
}

// 5. Open gaps: recent only, still different today, the app's figure of today.
{
    const list = [
        confirmation('a1', 'a', 12_000, 0, 3), // a says 12 000 more than the app said
        confirmation('b1', 'b', -12_000, 0, 3),
        confirmation('c1', 'c', 5_000, 0, CLIENT_CONFIRMATION_MAX_AGE_DAYS + 1), // too old
        confirmation('d1', 'd', 700, 0, 1), // the app has since caught up
        confirmation('e1', 'e', 300, 300, 1), // agreed
    ];
    const balances = new Map([['a', 0], ['b', 0], ['c', 0], ['d', 700], ['e', 300]]);
    const gaps = openClientGaps({ confirmations: list, balances, now: NOW });
    assert.deepEqual(gaps.map((g) => [g.clientId, g.gap]).sort(), [['a', 12_000], ['b', -12_000]]);
    // Only the active clients when asked.
    assert.deepEqual(openClientGaps({ confirmations: list, balances, now: NOW, clientIds: new Set(['a']) }).map((g) => g.clientId), ['a']);
    // A newer confirmation replaces the older one.
    const newer = [...list, confirmation('a2', 'a', 0, 0, 1)];
    assert.deepEqual(openClientGaps({ confirmations: newer, balances, now: NOW }).map((g) => g.clientId), ['b']);
    // A client the app does not know reads as zero.
    assert.equal(openClientGaps({ confirmations: [confirmation('z1', 'z', 40, 0, 1)], balances: new Map(), now: NOW })[0].gap, 40);
}

// 6. Transfer suggestion: equal and opposite gaps; the source is the one who says MORE than the app.
{
    const gaps = openClientGaps({
        confirmations: [confirmation('a1', 'a', 12_000, 0, 1), confirmation('b1', 'b', -12_000, 0, 1), confirmation('c1', 'c', 800, 0, 1)],
        balances: new Map([['a', 0], ['b', 0], ['c', 0]]),
        now: NOW,
    });
    const suggestions = clientTransferSuggestions(gaps);
    assert.deepEqual(suggestions, [{ fromClientId: 'a', toClientId: 'b', amount: 12_000 }]);
    // Within a dinar counts, beyond does not.
    const near = openClientGaps({ confirmations: [confirmation('a', 'a', 5_000, 0, 1), confirmation('b', 'b', -5_000.8, 0, 1)], balances: new Map(), now: NOW });
    assert.equal(clientTransferSuggestions(near).length, 1);
    const far = openClientGaps({ confirmations: [confirmation('a', 'a', 5_000, 0, 1), confirmation('b', 'b', -5_002, 0, 1)], balances: new Map(), now: NOW });
    assert.equal(clientTransferSuggestions(far).length, 0);
    // One to one: three clients, two equal sources and one destination: only one pair.
    const three = openClientGaps({ confirmations: [confirmation('a', 'a', 900, 0, 1), confirmation('b', 'b', 900, 0, 1), confirmation('c', 'c', -900, 0, 1)], balances: new Map(), now: NOW });
    assert.equal(clientTransferSuggestions(three).length, 1);
    // Two gaps with the same sign never pair.
    const same = openClientGaps({ confirmations: [confirmation('a', 'a', 900, 0, 1), confirmation('b', 'b', 900, 0, 1)], balances: new Map(), now: NOW });
    assert.deepEqual(clientTransferSuggestions(same), []);
}

// 7. The direction matches what the app's own transfer writes: recording the suggested transfer
//    (source +amount, destination -amount) closes both gaps.
{
    const list = [confirmation('a1', 'a', 12_000, 0, 1), confirmation('b1', 'b', -12_000, 0, 1)];
    const balances = new Map([['a', 0], ['b', 0]]);
    const [suggestion] = clientTransferSuggestions(openClientGaps({ confirmations: list, balances, now: NOW }));
    const after = new Map(balances);
    after.set(suggestion.fromClientId, (after.get(suggestion.fromClientId) ?? 0) + suggestion.amount);
    after.set(suggestion.toClientId, (after.get(suggestion.toClientId) ?? 0) - suggestion.amount);
    assert.deepEqual(openClientGaps({ confirmations: list, balances: after, now: NOW }), [], 'both gaps are closed by the suggested transfer');
}

// 8. Operations since the last agreement: only that client, only those that touch the balance, newest first, listed up to the limit.
{
    const row = (id: string, clientId: string, daysAgo: number, montant: number, extra: Partial<ClientOperationRow> = {}): ClientOperationRow =>
        ({ id, clientId, timestamp: NOW - daysAgo * DAY, date: `d${daysAgo}`, time: '10:00', type: 'Règlement Reçu', montant, ...extra });
    const rows = [
        row('r1', 'a', 20, 100),
        row('r2', 'a', 8, -500),
        row('r3', 'a', 4, 250, { affectsBalance: false }),
        row('r4', 'a', 2, 0),
        row('r5', 'a', 1, 900),
        row('r6', 'b', 1, 77),
    ];
    const since = clientOperationsSince(rows, 'a', NOW - 10 * DAY);
    assert.deepEqual(since.operations.map((op) => op.id), ['r5', 'r2'], 'newest first, spot-settled and zero rows left out');
    assert.equal(since.count, 2);
    assert.equal(since.operations[1].effect, -500);
    assert.equal(clientOperationsSince(rows, 'a', null).count, 3, 'never agreed: everything that touches the balance');
    const many = Array.from({ length: 20 }, (_, i) => row(`m${i}`, 'a', i + 1, 10 + i));
    const listed = clientOperationsSince(many, 'a', null);
    assert.equal(listed.count, 20);
    assert.equal(listed.operations.length, CLIENT_CONFIRMATION_LIST_LIMIT);
    assert.equal(listed.operations[0].id, 'm0');
    // The rows are not changed.
    assert.equal(many.length, 20);
}

console.log('clientConfirmation tests passed');
