import assert from 'node:assert/strict';

import type { ClientTransactionDzd } from '../../types';
import { buildClientTransferIndex, findClientTransferCounterpart } from './clientTransferIndex';

// Reference: the linear lookup useTransactionsViewModel used before the index (copied verbatim).
function referenceFindClientTransferCounterpart(tx: ClientTransactionDzd, clientTransactionsDzd: ClientTransactionDzd[]) {
    if (tx.type !== 'Transfert Sortant' && tx.type !== 'Transfert Entrant')
        return null;
    if (tx.linkedTxId) {
        const linked = clientTransactionsDzd.find((candidate) => candidate.id === tx.linkedTxId);
        if (linked)
            return linked;
    }
    const counterpartType = tx.type === 'Transfert Sortant' ? 'Transfert Entrant' : 'Transfert Sortant';
    const counterpartAmount = -Number(tx.montant || 0);
    return clientTransactionsDzd
        .filter((candidate) => candidate.id !== tx.id
        && candidate.clientId !== tx.clientId
        && candidate.type === counterpartType
        && candidate.date === tx.date
        && candidate.time === tx.time
        && Math.abs(Number(candidate.montant || 0) - counterpartAmount) <= 0.01
        && Math.abs(Number(candidate.timestamp || 0) - Number(tx.timestamp || 0)) <= 2000)
        .sort((left, right) => Math.abs(Number(left.timestamp || 0) - Number(tx.timestamp || 0))
        - Math.abs(Number(right.timestamp || 0) - Number(tx.timestamp || 0)))[0] || null;
}

// The rows the reference fallback considers, in array order (used only to measure coverage).
function referenceFallbackCandidates(tx: ClientTransactionDzd, rows: ClientTransactionDzd[]) {
    const counterpartType = tx.type === 'Transfert Sortant' ? 'Transfert Entrant' : 'Transfert Sortant';
    const counterpartAmount = -Number(tx.montant || 0);
    return rows.filter((candidate) => candidate.id !== tx.id
        && candidate.clientId !== tx.clientId
        && candidate.type === counterpartType
        && candidate.date === tx.date
        && candidate.time === tx.time
        && Math.abs(Number(candidate.montant || 0) - counterpartAmount) <= 0.01
        && Math.abs(Number(candidate.timestamp || 0) - Number(tx.timestamp || 0)) <= 2000);
}

function row(input: Partial<ClientTransactionDzd> & Pick<ClientTransactionDzd, 'id'>): ClientTransactionDzd {
    return {
        clientId: 'a',
        timestamp: 1_000_000,
        date: '01/09/2026',
        time: '10:00',
        montant: 0,
        type: 'Transfert Sortant',
        ...input,
    } as ClientTransactionDzd;
}

function assertSameAsReference(rows: ClientTransactionDzd[], label: string) {
    const before = rows.slice();
    const index = buildClientTransferIndex(rows);
    const describe = (tx: ClientTransactionDzd | null) => (tx === null ? 'null' : `row #${rows.indexOf(tx)} (${String(tx.id)})`);
    rows.forEach((tx, position) => {
        const expected = referenceFindClientTransferCounterpart(tx, rows);
        const actual = findClientTransferCounterpart(tx, index);
        assert.ok(actual === expected, `${label}: row #${position} (${String(tx.id)}) got ${describe(actual)}, expected ${describe(expected)}`);
    });
    assert.ok(rows.length === before.length && rows.every((tx, position) => tx === before[position]), `${label}: input array must not change`);
}

// Targeted cases.
{
    // Real shape: the incoming row links to the outgoing one; the outgoing one is found by matching.
    const outgoing = row({ id: 'out', clientId: 'a', montant: 500, type: 'Transfert Sortant' });
    const incoming = row({ id: 'in', clientId: 'b', montant: -500, timestamp: 1_000_001, type: 'Transfert Entrant', linkedTxId: 'out' });
    const rows = [outgoing, incoming, row({ id: 'pay', type: 'Paiement Effectué', montant: 500, clientId: 'c' })];
    const index = buildClientTransferIndex(rows);
    assert.equal(findClientTransferCounterpart(incoming, index), outgoing);
    assert.equal(findClientTransferCounterpart(outgoing, index), incoming);
    assert.equal(findClientTransferCounterpart(rows[2], index), null);
    assertSameAsReference(rows, 'real shape');
}
{
    // linkedTxId returns the FIRST row with that id, whatever its type.
    const first = row({ id: 'dup', type: 'Règlement Reçu', clientId: 'x' });
    const second = row({ id: 'dup', type: 'Transfert Sortant', clientId: 'y' });
    const incoming = row({ id: 'in', type: 'Transfert Entrant', linkedTxId: 'dup', clientId: 'b' });
    const rows = [first, second, incoming];
    assert.equal(findClientTransferCounterpart(incoming, buildClientTransferIndex(rows)), first);
    assertSameAsReference(rows, 'duplicate id');
}
{
    // A linkedTxId pointing to a missing row falls back to matching.
    const outgoing = row({ id: 'out', clientId: 'a', montant: 500 });
    const incoming = row({ id: 'in', clientId: 'b', montant: -500, type: 'Transfert Entrant', linkedTxId: 'deleted' });
    const rows = [outgoing, incoming];
    assert.equal(findClientTransferCounterpart(incoming, buildClientTransferIndex(rows)), outgoing);
    assertSameAsReference(rows, 'missing link');
}
{
    // Equal timestamp distance: the earlier row in the array wins, in both orders.
    const outgoing = row({ id: 'out', clientId: 'a', montant: 500, timestamp: 1_000_000 });
    const early = row({ id: 'early', clientId: 'b', montant: -500, timestamp: 999_500, type: 'Transfert Entrant' });
    const late = row({ id: 'late', clientId: 'c', montant: -500, timestamp: 1_000_500, type: 'Transfert Entrant' });
    const closer = row({ id: 'closer', clientId: 'd', montant: -500, timestamp: 1_000_499, type: 'Transfert Entrant' });
    assert.equal(findClientTransferCounterpart(outgoing, buildClientTransferIndex([outgoing, early, late])), early);
    assert.equal(findClientTransferCounterpart(outgoing, buildClientTransferIndex([outgoing, late, early])), late);
    assert.equal(findClientTransferCounterpart(outgoing, buildClientTransferIndex([late, early, closer, outgoing])), closer);
    assertSameAsReference([outgoing, early, late], 'tie a');
    assertSameAsReference([outgoing, late, early], 'tie b');
    assertSameAsReference([late, early, closer, outgoing], 'closer wins');
}
{
    // Boundaries: 2000 ms matches and 2001 ms does not; amounts compare with the same float math.
    const outgoing = row({ id: 'out', clientId: 'a', montant: 100 });
    const rows = [
        outgoing,
        row({ id: 'far', clientId: 'b', montant: -100, timestamp: 1_002_001, type: 'Transfert Entrant' }),
        row({ id: 'edge', clientId: 'c', montant: -100, timestamp: 1_002_000, type: 'Transfert Entrant' }),
        row({ id: 'amount-over', clientId: 'd', montant: -99.99, timestamp: 1_000_000, type: 'Transfert Entrant' }),
        row({ id: 'amount-in', clientId: 'e', montant: -99.995, timestamp: 1_000_001, type: 'Transfert Entrant' }),
        row({ id: 'same-client', clientId: 'a', montant: -100, timestamp: 1_000_000, type: 'Transfert Entrant' }),
        row({ id: 'other-time', clientId: 'f', montant: -100, timestamp: 1_000_000, time: '10:01', type: 'Transfert Entrant' }),
    ];
    assert.equal(findClientTransferCounterpart(outgoing, buildClientTransferIndex(rows))?.id, 'amount-in');
    assertSameAsReference(rows, 'boundaries');
    assertSameAsReference(rows.filter((tx) => tx.id !== 'amount-in'), 'boundaries without best');
}
{
    // Same string form, different values: strict equality keeps them apart.
    const outgoing = row({ id: 'out', clientId: 'a', montant: 100, date: 1 as unknown as string });
    const stringDate = row({ id: 'string-date', clientId: 'b', montant: -100, date: '1', type: 'Transfert Entrant' });
    const numberDate = row({ id: 'number-date', clientId: 'c', montant: -100, date: 1 as unknown as string, timestamp: 1_001_000, type: 'Transfert Entrant' });
    const nanDate = row({ id: 'nan-date', clientId: 'd', montant: -100, date: NaN as unknown as string, type: 'Transfert Entrant' });
    const rows = [stringDate, nanDate, outgoing, numberDate, row({ id: 'nan-out', clientId: 'e', montant: 100, date: NaN as unknown as string })];
    assert.equal(findClientTransferCounterpart(outgoing, buildClientTransferIndex(rows)), numberDate);
    assertSameAsReference(rows, 'strict keys');
}

// Seeded pseudo-random data.
function mulberry32(seed: number) {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const OTHER_TYPES = ['Règlement Reçu', 'Paiement Effectué', 'Ajustement Solde', 'Solde Initial', 'Vente USDT'] as const;
const TRANSFER_TYPES = ['Transfert Entrant', 'Transfert Sortant'] as const;

function generateRows(seed: number, targetRows: number, shuffle: boolean): ClientTransactionDzd[] {
    const random = mulberry32(seed);
    const pick = <T,>(items: readonly T[]): T => items[Math.floor(random() * items.length)];
    const chance = (probability: number) => random() < probability;
    const dates = ['01/09/2026', '02/09/2026', '03/09/2026'];
    const times = ['09:00', '09:01', '14:30'];
    const clients = ['c0', 'c1', 'c2', 'c3', 'c4', 'c5'];
    const amounts = [100, 2500.5, 1000, 0.01, 0.3, 0.1 + 0.2, 99999.99, 12345.675];
    const amountNoise = [0, 0, 0, 0.005, -0.005, 0.01, -0.01, 0.0099999, -0.0099999, 0.0100001, -0.0100001, 0.011, 0.02];
    const offsets = [0, 0, 1, -1, 2, 500, -500, 1000, -1000, 1999, -1999, 2000, -2000, 2001, -2001, 2500];
    const rows: ClientTransactionDzd[] = [];
    let nextId = 0;
    const slot = () => {
        const dateIndex = Math.floor(random() * dates.length);
        const timeIndex = Math.floor(random() * times.length);
        return { date: dates[dateIndex], time: times[timeIndex], base: 1_756_710_000_000 + dateIndex * 86_400_000 + timeIndex * 60_000 };
    };
    const linkFor = (targetId: string) => {
        const roll = random();
        if (roll < 0.55)
            return targetId;
        if (roll < 0.7)
            return `missing-${nextId}`;
        if (roll < 0.78)
            return '';
        if (roll < 0.85 && rows.length > 0)
            return pick(rows).id;
        return undefined;
    };
    while (rows.length < targetRows) {
        const kind = random();
        const { date, time, base } = slot();
        if (kind < 0.35) {
            // A transfer pair written the way the app writes it, with noise on amount, time and link.
            const amount = pick(amounts);
            const from = pick(clients);
            const to = chance(0.1) ? from : pick(clients);
            const outgoingId = `tx${nextId++}`;
            const incomingId = `tx${nextId++}`;
            const outgoingTimestamp = base + pick(offsets);
            rows.push({ id: outgoingId, clientId: from, timestamp: outgoingTimestamp, date, time, montant: amount, type: 'Transfert Sortant', linkedTxId: chance(0.1) ? linkFor(incomingId) : undefined } as ClientTransactionDzd);
            rows.push({ id: incomingId, clientId: to, timestamp: outgoingTimestamp + (chance(0.6) ? 1 : pick(offsets)), date, time, montant: -amount + pick(amountNoise), type: 'Transfert Entrant', linkedTxId: linkFor(outgoingId) } as ClientTransactionDzd);
        }
        else if (kind < 0.55) {
            // Unlinked transfer rows that compete with each other in a shared date/time slot.
            const amount = pick(amounts);
            const type = pick(TRANSFER_TYPES);
            rows.push({ id: `tx${nextId++}`, clientId: pick(clients), timestamp: base + pick(offsets), date, time, montant: (type === 'Transfert Sortant' ? amount : -amount) + pick(amountNoise), type } as ClientTransactionDzd);
        }
        else if (kind < 0.65) {
            // Exact ties: two candidates at the same distance from one row, or at the same timestamp.
            const amount = pick(amounts);
            const center = base + pick(offsets);
            const distance = pick([0, 1, 500, 2000]);
            const centerType = pick(TRANSFER_TYPES);
            const otherType = centerType === 'Transfert Sortant' ? 'Transfert Entrant' : 'Transfert Sortant';
            const sign = centerType === 'Transfert Sortant' ? 1 : -1;
            rows.push({ id: `tx${nextId++}`, clientId: pick(clients), timestamp: center, date, time, montant: sign * amount, type: centerType } as ClientTransactionDzd);
            rows.push({ id: `tx${nextId++}`, clientId: pick(clients), timestamp: center - distance, date, time, montant: -sign * amount, type: otherType } as ClientTransactionDzd);
            rows.push({ id: `tx${nextId++}`, clientId: pick(clients), timestamp: chance(0.5) ? center + distance : center - distance, date, time, montant: -sign * amount + pick([0, 0.005, -0.0099999]), type: otherType } as ClientTransactionDzd);
        }
        else if (kind < 0.85) {
            // Non-transfer rows in the same slots, sometimes linked to a transfer.
            rows.push({ id: `tx${nextId++}`, clientId: pick(clients), timestamp: base + pick(offsets), date, time, montant: pick([-1, 1]) * pick(amounts), type: pick(OTHER_TYPES), linkedTxId: chance(0.3) && rows.length > 0 ? pick(rows).id : undefined } as ClientTransactionDzd);
        }
        else if (kind < 0.93 && rows.length > 0) {
            // A row reusing an existing id.
            const source = pick(rows);
            rows.push({ ...source, id: source.id, clientId: pick(clients), type: chance(0.7) ? pick(TRANSFER_TYPES) : pick(OTHER_TYPES), timestamp: base + pick(offsets), date, time } as ClientTransactionDzd);
        }
        else {
            // Legacy / malformed values.
            const type = pick(TRANSFER_TYPES);
            rows.push({
                id: chance(0.2) ? (undefined as unknown as string) : `tx${nextId++}`,
                clientId: chance(0.2) ? (undefined as unknown as string) : pick(clients),
                timestamp: pick([undefined, 0, NaN, String(base), base, base + 1, Infinity]) as number,
                date: pick([date, date, undefined, null, 1, NaN]) as string,
                time: pick([time, time, undefined, '']) as string,
                montant: pick([undefined, null, NaN, 0, -0, '100', '-100', 100, -100, '1e2', 'abc']) as number,
                type,
                linkedTxId: pick([undefined, '', 'missing', rows.length > 0 ? pick(rows).id : undefined]),
            } as ClientTransactionDzd);
        }
    }
    if (shuffle) {
        for (let position = rows.length - 1; position > 0; position -= 1) {
            const other = Math.floor(random() * (position + 1));
            [rows[position], rows[other]] = [rows[other], rows[position]];
        }
    }
    return rows;
}

const coverage = { rows: 0, transfers: 0, linkedHits: 0, linkedToDuplicateId: 0, linkedMissing: 0, fallbackMatches: 0, multipleCandidates: 0, ties: 0, laterCloserWins: 0, noCounterpart: 0 };
const scenarios: [number, number, boolean][] = [[1, 500, true], [2, 2000, true], [3, 3000, true], [4, 3000, false], [5, 4000, true]];
for (const [seed, size, shuffle] of scenarios) {
    const rows = generateRows(seed, size, shuffle);
    assertSameAsReference(rows, `seed ${seed}`);
    const idCounts = new Map<unknown, number>();
    for (const tx of rows)
        idCounts.set(tx.id, (idCounts.get(tx.id) || 0) + 1);
    for (const tx of rows) {
        coverage.rows += 1;
        if (tx.type !== 'Transfert Entrant' && tx.type !== 'Transfert Sortant')
            continue;
        coverage.transfers += 1;
        if (tx.linkedTxId && idCounts.has(tx.linkedTxId)) {
            coverage.linkedHits += 1;
            if ((idCounts.get(tx.linkedTxId) || 0) > 1)
                coverage.linkedToDuplicateId += 1;
            continue;
        }
        if (tx.linkedTxId)
            coverage.linkedMissing += 1;
        const candidates = referenceFallbackCandidates(tx, rows);
        if (candidates.length === 0) {
            coverage.noCounterpart += 1;
            continue;
        }
        coverage.fallbackMatches += 1;
        const distances = candidates.map((candidate) => Math.abs(Number(candidate.timestamp || 0) - Number(tx.timestamp || 0)));
        const best = Math.min(...distances);
        if (candidates.length > 1)
            coverage.multipleCandidates += 1;
        if (distances.filter((distance) => distance === best).length > 1)
            coverage.ties += 1;
        if (distances[0] !== best)
            coverage.laterCloserWins += 1;
    }
}
// The generated data must actually exercise every path.
for (const [name, count] of Object.entries(coverage))
    assert.ok(count >= 20, `coverage ${name} too low: ${count}`);

console.log(`clientTransferIndex tests passed (${JSON.stringify(coverage)})`);
