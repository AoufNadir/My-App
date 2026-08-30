import assert from 'node:assert/strict';

import { buildClientPdfReport } from './pdfReports';
import type { ClientDzd, ClientTransactionDzd, Tx } from '../types';

function timestamp(day: number, hour = 12, minute = 0, second = 0, millisecond = 0): number {
    return new Date(2026, 7, day, hour, minute, second, millisecond).getTime();
}

function clientTx(id: string, ts: number, amount: number, linkedTxId?: string): ClientTransactionDzd {
    const date = new Date(ts);
    return {
        id,
        clientId: 'client-1',
        timestamp: ts,
        date: date.toLocaleDateString('fr-FR'),
        time: date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        montant: amount,
        type: amount >= 0 ? 'Règlement Reçu' : 'Paiement Effectué',
        notes: id,
        linkedTxId,
    };
}

const client: ClientDzd = { id: 'client-1', fullName: 'Client Test' };
const startTs = timestamp(1, 0, 0, 0, 0);
const endTs = timestamp(30, 23, 59, 59, 999);
const transactions = [
    clientTx('outside-before', timestamp(31 - 31, 23, 59, 59, 999), 10),
    clientTx('outside-before-2', timestamp(31 - 31, 22, 59, 59, 999), 10),
    clientTx('outside-before-3', timestamp(31 - 31, 21, 59, 59, 999), 10),
    clientTx('outside-before-4', timestamp(31 - 31, 20, 59, 59, 999), 10),
    clientTx('outside-before-5', timestamp(31 - 31, 19, 59, 59, 999), 10),
    clientTx('start-boundary', startTs, 100),
    clientTx('in-range-linked', timestamp(2), -10, 'portfolio-sale'),
    ...Array.from({ length: 24 }, (_, index) => clientTx(`in-range-${index + 1}`, timestamp(index + 3), -10)),
    clientTx('end-boundary', endTs, 50),
    clientTx('outside-after', timestamp(31, 0, 0, 0, 0), 20),
];
const portfolioSale: Tx = {
    id: 'portfolio-sale',
    type: 'sell',
    quantity: 1,
    sell: 250,
    currency: 'USDT',
    date: '02/08/2026',
    time: '12:00',
    timestamp: timestamp(2),
};

function build(start: number, end: number) {
    return buildClientPdfReport({
        clientId: client.id,
        reportStartTs: start,
        reportEndTs: end,
        periodLabel: 'Du 01/08/2026 au 30/08/2026',
        clients: [client],
        clientTransactions: transactions,
        transactions: [portfolioSale],
        clientBalance: 0,
        getClientName: (item) => item.fullName,
    });
}

const report = build(startTs, endTs);
assert.ok(report, 'A client report should be generated for a non-empty period');
assert.equal(report.transactions.length, 27, 'PDF dataset must contain every in-range client transaction');
const renderedRows = report.html.match(/<tbody>[\s\S]*?<\/tbody>/)?.[0].match(/<tr>/g)?.length || 0;
assert.equal(renderedRows, report.transactions.length, 'Rendered PDF rows must match the report dataset');
for (const id of ['start-boundary', 'in-range-linked', ...Array.from({ length: 24 }, (_, index) => `in-range-${index + 1}`), 'end-boundary']) {
    assert.match(report.html, new RegExp(id));
}
assert.match(report.html, /Vente USDT/);
assert.doesNotMatch(report.html, /outside-before/);
assert.doesNotMatch(report.html, /outside-before-5/);
assert.doesNotMatch(report.html, /outside-after/);
assert.match(report.html, /Du 01\/08\/2026 au 30\/08\/2026/);
assert.ok(report.html.indexOf('end-boundary') < report.html.indexOf('start-boundary'), 'PDF rows should be newest first');
assert.equal(build(endTs, startTs), null, 'An inverted date range must be rejected');
assert.equal(build(timestamp(28), timestamp(29)), null, 'An empty period must not generate a misleading report');

console.log('client PDF date-range tests passed');
