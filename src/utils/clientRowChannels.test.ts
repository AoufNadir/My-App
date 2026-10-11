import assert from 'node:assert/strict';
import type { ClientTransactionDzd, TreasuryTx } from '../types';
import { buildClientSummary } from './clientSummary';
import { buildClientActivityReport, rangePeriod } from './clientActivityReport';
import { adjustmentChannelOf, withAdjustmentChannels } from './clientRowChannels';
import { summaryRowText } from '../components/clients/clientSummaryText';

// V7-1: a payment recorded from the treasury adjustment window with a client picked must read in the
// client reports exactly like the same payment recorded from the client page.

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date(2026, 9, 11, 12, 0, 0, 0).getTime();
const stamp = (daysAgo: number) => ({ timestamp: NOW - daysAgo * DAY, date: '01/10/2026', time: '10:00' });
const row = (id: string, montant: number, type: ClientTransactionDzd['type'], daysAgo: number, extra: Partial<ClientTransactionDzd> = {}): ClientTransactionDzd =>
    ({ id, clientId: 'karim', montant, type, ...stamp(daysAgo), ...extra }) as ClientTransactionDzd;
const treasury = (id: string, source: TreasuryTx['source'], type: TreasuryTx['type'], amount: number): Pick<TreasuryTx, 'id' | 'source'> & { type: TreasuryTx['type']; amount: number } => ({ id, source, type, amount });

// Two payments to the client by BaridiMob and two from him, each pair recorded the two ways.
const rows: ClientTransactionDzd[] = [
    row('open', -20_000, 'Solde Initial', 40),
    // We paid him: from the client page, then from the adjustment window.
    row('page-out', -5_000, 'Paiement Effectué', 6, { paymentMethod: 'BaridiMob', linkedTxId: 'tr-page-out', notes: '' }),
    row('adj-out', -7_000, 'Paiement Effectué', 5, { origin: 'adjustment', linkedTxId: 'tr-adj-out', notes: 'Ajustement Trésorerie (BaridiMob)' }),
    // He paid us.
    row('page-in', 9_000, 'Règlement Reçu', 4, { paymentMethod: 'Espèces', linkedTxId: 'tr-page-in', notes: '' }),
    row('adj-in', 11_000, 'Règlement Reçu', 3, { origin: 'adjustment', linkedTxId: 'tr-adj-in', notes: 'Ajustement Trésorerie (Caisse)' }),
];
const treasuryRows = [
    treasury('tr-page-out', 'BaridiMob', 'Retrait', 5_000),
    treasury('tr-adj-out', 'BaridiMob', 'Retrait', 7_000),
    treasury('tr-page-in', 'Caisse', 'Ajout', 9_000),
    treasury('tr-adj-in', 'Caisse', 'Ajout', 11_000),
];

// 1. The channel read back for the older rows: the treasury row first, the note as a fallback.
{
    const byId = new Map(treasuryRows.map((tx) => [tx.id, tx] as const));
    assert.equal(adjustmentChannelOf(rows[2], byId), 'BaridiMob');
    assert.equal(adjustmentChannelOf(rows[4], byId), 'Espèces', 'Caisse is cash');
    assert.equal(adjustmentChannelOf(rows[1], byId), undefined, 'a row that already has its channel is left alone');
    assert.equal(adjustmentChannelOf(rows[0], byId), undefined, 'an opening balance has no channel');
    assert.equal(adjustmentChannelOf(row('x', -1, 'Paiement Effectué', 1, { origin: 'adjustment', linkedTxId: 'gone', notes: 'x (BaridiMob)' }), byId), 'BaridiMob', 'the treasury row is gone: the note says it');
    assert.equal(adjustmentChannelOf(row('y', -1, 'Paiement Effectué', 1, { origin: 'adjustment', linkedTxId: 'gone', notes: 'BaridiMob transfer to him' }), byId), undefined, 'a channel named elsewhere in a free note is not read');
    assert.equal(adjustmentChannelOf(row('z', -1, 'Paiement Effectué', 1, { linkedTxId: 'tr-adj-out' }), byId), undefined, 'only adjustment rows are read this way');
    assert.equal(adjustmentChannelOf(row('t', -1, 'Ajustement Solde', 1, { origin: 'adjustment', linkedTxId: 'tr-adj-out' }), byId), undefined, 'a balance correction is not a settlement');
}

// 2. Nothing but the channel is added, and the input is left alone.
{
    const snapshot = JSON.stringify(rows);
    const enriched = withAdjustmentChannels(rows, treasuryRows);
    assert.equal(JSON.stringify(rows), snapshot, 'input untouched');
    assert.equal(enriched.length, rows.length);
    enriched.forEach((after, index) => {
        const { paymentMethod: _after, ...restAfter } = after;
        const { paymentMethod: _before, ...restBefore } = rows[index];
        assert.deepEqual(restAfter, restBefore, `${after.id}: only paymentMethod can differ`);
    });
    assert.equal(enriched[2].paymentMethod, 'BaridiMob');
    assert.equal(enriched[4].paymentMethod, 'Espèces');
    assert.equal(withAdjustmentChannels(enriched, treasuryRows), enriched, 'nothing left to read: the same array comes back');
    assert.equal(withAdjustmentChannels([rows[0], rows[1]], treasuryRows).length, 2);
}

// 3. In the reports, the two ways give the same wording and the same numbers.
for (const lang of ['ar', 'fr'] as const) {
    const enriched = withAdjustmentChannels(rows, treasuryRows);
    const summary = buildClientSummary({ clientId: 'karim', clientRows: enriched, transactions: [], now: NOW });
    const titleOf = (id: string) => {
        const found = summary.lastRows.find((candidate) => candidate.entry.id === id);
        assert.ok(found, `${id} is in the summary`);
        return summaryRowText(found.entry, found.context, lang).title;
    };
    assert.equal(titleOf('adj-out'), titleOf('page-out'), `${lang}: paid to him by BaridiMob reads the same`);
    assert.equal(titleOf('adj-in'), titleOf('page-in'), `${lang}: paid by him in cash reads the same`);
    assert.match(titleOf('adj-out'), lang === 'ar' ? /BaridiMob/ : /BaridiMob/, `${lang}: the channel is named`);
    // Before V7-1 the adjustment rows lost their channel: that is what this fixes.
    const before = buildClientSummary({ clientId: 'karim', clientRows: rows, transactions: [], now: NOW });
    const vague = before.lastRows.find((candidate) => candidate.entry.id === 'adj-out');
    assert.ok(vague && !/BaridiMob/.test(summaryRowText(vague.entry, vague.context, lang).title), `${lang}: without the fix the channel was missing`);
}

// 4. The numbers do not move: balance, operations and every total are identical with or without the channels.
{
    const plain = buildClientSummary({ clientId: 'karim', clientRows: rows, transactions: [], now: NOW });
    const enriched = buildClientSummary({ clientId: 'karim', clientRows: withAdjustmentChannels(rows, treasuryRows), transactions: [], now: NOW });
    assert.equal(enriched.balanceCents, plain.balanceCents);
    assert.deepEqual(enriched.lastRows.map((item) => [item.entry.id, item.entry.kind, item.entry.dzdCents, item.entry.balanceCents, item.balanceAfterCents]), plain.lastRows.map((item) => [item.entry.id, item.entry.kind, item.entry.dzdCents, item.entry.balanceCents, item.balanceAfterCents]));
    const period = rangePeriod(NOW - 45 * DAY, NOW);
    const a = buildClientActivityReport({ clientId: 'karim', clientRows: rows, transactions: [], period, now: NOW });
    const b = buildClientActivityReport({ clientId: 'karim', clientRows: withAdjustmentChannels(rows, treasuryRows), transactions: [], period, now: NOW });
    const { paymentsByMethod: paymentsBefore, ...balanceBefore } = a.balance;
    const { paymentsByMethod: paymentsAfter, ...balanceAfter } = b.balance;
    assert.deepEqual(balanceAfter, balanceBefore, 'opening, closing and every balance line');
    assert.equal(paymentsAfter.reduce((sum, item) => sum + item.cents, 0), paymentsBefore.reduce((sum, item) => sum + item.cents, 0), 'the same amount received, only grouped by its channel');
    assert.deepEqual(paymentsBefore, [{ method: 'cash', cents: 900_000 }, { method: 'other', cents: 1_100_000 }]);
    assert.deepEqual(paymentsAfter, [{ method: 'cash', cents: 2_000_000 }], 'the cash received from the adjustment window joins the cash line');
    assert.deepEqual(b.totals, a.totals, 'the period totals');
    assert.equal(b.operations.length, a.operations.length);
    // The report groups payments by channel: the adjustment ones now join their channel instead of « other ».
    const channels = (report: typeof a) => report.operations.filter((item) => item.entry.kind === 'payment' || item.entry.kind === 'withdrawal').map((item) => item.entry.method);
    assert.deepEqual(channels(a), ['baridi', 'other', 'cash', 'other']);
    assert.deepEqual(channels(b), ['baridi', 'baridi', 'cash', 'cash']);
}

console.log('clientRowChannels tests passed');
