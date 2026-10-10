import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { ClientTransactionDzd, Tx } from '../../types';
import { toCents } from '../../utils/money';
import { buildClientSummary, CLIENT_SUMMARY_OPERATION_COUNT } from '../../utils/clientSummary';
import { ClientSummarySheet, clientSummaryMessage } from './ClientSummarySheet';
import { formatDzdCents } from './clientActivityReportText';

// V4-4: the client summary picture and its WhatsApp message. Like the client report they go to
// the client: our buy price, profit, notes and another client's name never show; the balance is
// the client page balance; the last operations come newest first.

const at = (month: number, day: number, hour = 12) => new Date(2026, month, day, hour).getTime();
const NOW = at(9, 10, 9);
let seq = 0;
const row = (clientId: string, timestamp: number, montant: number, type: ClientTransactionDzd['type'], extra: Partial<ClientTransactionDzd> = {}): ClientTransactionDzd => {
    seq += 1;
    return { id: `r${seq}`, clientId, timestamp, date: '', time: '', montant, type, notes: 'NOTE-SECRET', ...extra };
};
const secret = { price: 243.17, profit: 6891.55, notes: 'NOTE-SECRET' } as Partial<Tx>;
const transactions: Tx[] = [];
const rows: ClientTransactionDzd[] = [];
function sale(clientId: string, timestamp: number, quantity: number, sell: number, credit: boolean) {
    const tx = { id: `tx${transactions.length + 1}`, type: 'sell', currency: 'USDT', quantity, sell, total: quantity * sell, date: '', time: '', timestamp, ...secret } as Tx;
    transactions.push(tx);
    rows.push(row(clientId, timestamp, -quantity * sell, 'Vente USDT', { linkedTxId: tx.id, linkRole: 'primary', paymentMethod: credit ? 'Crédit' : 'Espèces', affectsBalance: credit }));
}
rows.push(row('c1', at(8, 1, 9), -20000, 'Solde Initial', { paymentMethod: 'Crédit' }));
sale('c1', at(8, 3), 1000, 250, true);
rows.push(row('c1', at(8, 10), 150000, 'Règlement Reçu', { paymentMethod: 'Espèces' }));
sale('c1', at(8, 20), 300, 251.5, false);
sale('c1', at(9, 1), 800, 249.5, true);
rows.push(row('c2', at(9, 2), 15000, 'Transfert Sortant', { paymentMethod: 'Crédit', notes: 'Transfert vers SECRETNAME' }));
rows.push(row('c1', at(9, 2, 13), -15000, 'Transfert Entrant', { paymentMethod: 'Crédit', notes: 'Transfert de SECRETNAME' }));
sale('c1', at(9, 5), 400, 252, true);
sale('c2', at(9, 6), 999, 271.11, true);

const summary = buildClientSummary({ clientId: 'c1', clientRows: rows, transactions, now: NOW });
const pageBalanceCents = rows.filter((item) => item.clientId === 'c1' && item.affectsBalance !== false).reduce((sum, item) => sum + toCents(item.montant), 0);
assert.equal(summary.balanceCents, pageBalanceCents, 'the summary ends on the client page balance');
assert.equal(summary.operationCount, 7, 'every row of the client, and only theirs');
assert.equal(summary.lastOperations.length, CLIENT_SUMMARY_OPERATION_COUNT, 'five operations');
assert.deepEqual(summary.lastOperations.map((entry) => entry.timestamp), [...summary.lastOperations.map((entry) => entry.timestamp)].sort((a, b) => b - a), 'newest first');
assert.equal(summary.lastOperations[0].timestamp, at(9, 5), 'the latest operation leads');

const text = (html: string) => html.replace(/<[^>]+>/g, ' ');
const FORBIDDEN: Array<[RegExp, string]> = [
    [/243[.,]17/, 'our buy price'],
    [/6[\s  ]?891/, 'our profit'],
    [/NOTE-SECRET/, 'notes'],
    [/SECRETNAME/, 'another client\'s name'],
    [/271[.,]11|999/, 'another client\'s operations'],
];
for (const lang of ['ar', 'fr'] as const) {
    const picture = text(renderToStaticMarkup(<ClientSummarySheet summary={summary} lang={lang} clientName="Client Test"/>));
    const message = clientSummaryMessage(summary, lang, 'Client Test');
    for (const [pattern, what] of FORBIDDEN) {
        assert.doesNotMatch(picture, pattern, `${lang} picture: ${what} is never shown`);
        assert.doesNotMatch(message, pattern, `${lang} message: ${what} is never sent`);
    }
    const balance = `${formatDzdCents(pageBalanceCents, summary.showCents)} DZD`;
    assert.ok(picture.includes(balance), `${lang} picture shows the balance (${balance})`);
    assert.ok(message.includes(balance), `${lang} message gives the balance`);
    assert.match(message, lang === 'ar' ? /الباقي عليك/ : /Reste à payer/, `${lang}: the side of the balance is said`);
    assert.equal(message.split('\n').filter((line) => line.startsWith('• ')).length, CLIENT_SUMMARY_OPERATION_COUNT, `${lang}: five operations in the message`);
    assert.doesNotMatch(message, /[⁦⁩]/, `${lang}: no invisible isolate characters in a WhatsApp message`);
}

// The picture is phone-wide (420px), not the A4 sheet: its text stays readable in a chat without zooming.
const wide = renderToStaticMarkup(<ClientSummarySheet summary={summary} lang="fr" clientName="Client Test"/>);
assert.match(wide, /w-\[420px\]/, 'the picture is phone-wide');
assert.doesNotMatch(wide, /w-\[794px\]/, 'and not the A4 sheet');

// A client without any operation still gets a picture and a message.
const empty = buildClientSummary({ clientId: 'none', clientRows: rows, transactions, now: NOW });
assert.equal(empty.balanceCents, 0);
assert.equal(empty.lastOperations.length, 0);
assert.match(text(renderToStaticMarkup(<ClientSummarySheet summary={empty} lang="fr" clientName="Nouveau"/>)), /Aucune opération/);

console.log('client summary picture tests passed');
