import assert from 'node:assert/strict';

import type { ClientDzd, ClientTransactionDzd, Tx } from '../types';
import { buildClientActivityReport, parseDayKey, reportPeriodForDates } from './clientActivityReport';
import { toCents } from './money';
import { buildClientPdfReport } from './pdfReports';

// Since V3-3 the client report is the only report sent to a client: it replaced the old statement
// (« Relevé client »). This compares their numbers on the same client and the same dates, the old
// ones read from the old statement's own page:
// - a client who only buys on credit: opening balance, closing balance, number of operations,
//   total received, total paid and every amount are the same, to the cent;
// - a client who also pays on the spot: the old statement added those payments made on the spot
//   (history-only rows) to the balance, so its balance was not the client page balance. The new
//   report's is, and the gap is exactly those rows.

const at = (month: number, day: number, hour = 12) => new Date(2026, month, day, hour).getTime();
const NOW = at(9, 3, 18);
let seq = 0;
const rows: ClientTransactionDzd[] = [];
const transactions: Tx[] = [];
const row = (clientId: string, timestamp: number, montant: number, type: ClientTransactionDzd['type'], extra: Partial<ClientTransactionDzd> = {}) => {
    seq += 1;
    rows.push({ id: `r${String(seq).padStart(3, '0')}`, clientId, timestamp, date: '', time: '', montant, type, notes: 'note interne', ...extra });
};
const sale = (clientId: string, timestamp: number, currency: 'USDT' | 'EUR', quantity: number, sell: number, credit: boolean) => {
    const tx = { id: `tx${transactions.length + 1}`, type: 'sell', currency, quantity, sell, total: quantity * sell, price: 241.3, profit: 5000, date: '', time: '', timestamp } as Tx;
    transactions.push(tx);
    row(clientId, timestamp, -Math.round(quantity * sell * 100) / 100, currency === 'USDT' ? 'Vente USDT' : 'Vente EUR', { linkedTxId: tx.id, linkRole: 'primary', paymentMethod: credit ? 'Crédit' : 'Espèces', affectsBalance: credit });
};

// c1 only buys on credit, and every other row moves its balance too.
row('c1', at(6, 1, 9), -50000, 'Solde Initial', { paymentMethod: 'Crédit' });
sale('c1', at(6, 5), 'USDT', 1000, 249.75, true);
row('c1', at(6, 20), 120000, 'Règlement Reçu', { paymentMethod: 'Espèces' });
sale('c1', at(7, 3), 'EUR', 200, 262.4, true);
row('c1', at(7, 10), -15000, 'Paiement Effectué', { paymentMethod: 'BaridiMob' });
row('c1', at(7, 18), 200000.5, 'Règlement Reçu', { paymentMethod: 'BaridiMob' });
row('c1', at(7, 26), -12000, 'Transfert Entrant', { paymentMethod: 'Crédit' });
row('c1', at(8, 4), -9500, 'Vente service numérique', { paymentMethod: 'Crédit', affectsBalance: true, origin: 'digital_service_sale' });
const buyTx = { id: 'tx-buy', type: 'buy', currency: 'USDT', quantity: 300, price: 246, total: 73800, date: '', time: '', timestamp: at(8, 12) } as Tx;
transactions.push(buyTx);
row('c1', at(8, 12), 73800, 'Règlement Reçu', { linkedTxId: 'tx-buy', linkRole: 'primary', paymentMethod: 'Crédit', affectsBalance: true });
sale('c1', at(8, 20), 'USDT', 640.5, 250.1, true);
row('c1', at(8, 28), 2500, 'Remise solde', { paymentMethod: 'Crédit', countsAsLoss: true });
row('c1', at(9, 2), 1000.25, 'Ajustement Solde', { paymentMethod: 'Crédit' });

// c2 pays some purchases on the spot: those rows are history only.
sale('c2', at(7, 5), 'USDT', 500, 250, false);
sale('c2', at(7, 9), 'USDT', 300, 249, true);
row('c2', at(7, 15), 74700, 'Règlement Reçu', { paymentMethod: 'Espèces' });
sale('c2', at(8, 3), 'EUR', 100, 263, false);
sale('c2', at(8, 22), 'USDT', 800, 250.5, true);
row('c2', at(8, 30), 100000, 'Règlement Reçu', { paymentMethod: 'BaridiMob' });

const clients: ClientDzd[] = [{ id: 'c1', fullName: 'Client Un' }, { id: 'c2', fullName: 'Client Deux' }];
const amount = (text: string) => Number(text.replace(/[\s  ]/g, '').replace(',', '.'));
function oldStatement(clientId: string, from: number, to: number) {
    const report = buildClientPdfReport({ clientId, reportStartTs: from, reportEndTs: to, periodLabel: 'période', clients, clientTransactions: rows, transactions, clientBalance: 0, getClientName: (client) => client.fullName || '' });
    if (!report)
        return null;
    const cell = (label: string) => {
        const match = new RegExp(`client-summary-label">${label}</div>\\s*<div class="client-summary-value[^"]*">([^<]+?)(?: DZD)?</div>`).exec(report.html);
        assert.ok(match, `the old statement shows « ${label} »`);
        return amount(match[1]);
    };
    return {
        openingCents: toCents(cell('Solde ouverture')),
        closingCents: toCents(cell('Solde clôture')),
        receivedCents: toCents(cell('Total reçu')),
        paidCents: toCents(-cell('Total payé')),
        count: cell('Opérations'),
        rowCents: report.transactions.map((item) => toCents(item.montant)).sort((a, b) => a - b),
        html: report.html,
    };
}

const RANGES: Array<[string, string]> = [
    ['2026-08-01', '2026-08-31'],
    ['2026-07-15', '2026-09-15'],
    ['2026-09-01', '2026-10-03'],
    ['2026-01-01', '2026-10-03'],
    ['2026-06-01', '2026-10-10'],
    ['2026-08-11', '2026-08-14'],
];
const report = (clientId: string, start: string, end: string) => {
    const from = parseDayKey(start, false)!;
    const to = parseDayKey(end, true)!;
    return { from, to, report: buildClientActivityReport({ clientId, clientRows: rows, transactions, period: reportPeriodForDates(from, to, NOW), now: NOW }) };
};

let compared = 0;
for (const [start, end] of RANGES) {
    const { from, to, report: next } = report('c1', start, end);
    const old = oldStatement('c1', from, to);
    if (!old) {
        assert.equal(next.operations.length, 0, `${start}…${end}: no operation in either report`);
        continue;
    }
    const where = `c1 ${start}…${end}`;
    assert.equal(next.balance.openingCents, old.openingCents, `${where}: same opening balance`);
    assert.equal(next.balance.closingCents, old.closingCents, `${where}: same closing balance`);
    assert.equal(next.operations.length, old.count, `${where}: same number of operations`);
    assert.equal(next.operations.reduce((sum, item) => sum + Math.max(0, item.entry.balanceCents), 0), old.receivedCents, `${where}: same total received`);
    assert.equal(next.operations.reduce((sum, item) => sum + Math.max(0, -item.entry.balanceCents), 0), old.paidCents, `${where}: same total paid`);
    assert.deepEqual(next.operations.map((item) => item.entry.balanceCents).sort((a, b) => a - b), old.rowCents, `${where}: the same amounts, row by row`);
    compared += 1;
}
assert.ok(compared >= 5, `the credit-only client is compared on ${compared} spans of dates`);

const historyOnlyCents = (clientId: string, before: number) => rows
    .filter((item) => item.clientId === clientId && item.affectsBalance === false && item.timestamp < before)
    .reduce((sum, item) => sum + toCents(item.montant), 0);
const pageBalanceCents = (clientId: string, until: number) => rows
    .filter((item) => item.clientId === clientId && item.affectsBalance !== false && item.timestamp <= until)
    .reduce((sum, item) => sum + toCents(item.montant), 0);
let differences = 0;
for (const [start, end] of RANGES) {
    const { from, to, report: next } = report('c2', start, end);
    const old = oldStatement('c2', from, to);
    if (!old)
        continue;
    const where = `c2 ${start}…${end}`;
    assert.equal(next.balance.closingCents, pageBalanceCents('c2', to), `${where}: the new report ends on the client page balance`);
    assert.equal(old.closingCents - next.balance.closingCents, historyOnlyCents('c2', to + 1), `${where}: the old statement's closing balance was off by the purchases paid on the spot`);
    assert.equal(old.openingCents - next.balance.openingCents, historyOnlyCents('c2', from), `${where}: and its opening balance by those before the first day`);
    assert.equal(next.operations.length, old.count, `${where}: both list every operation`);
    if (old.closingCents !== next.balance.closingCents)
        differences += 1;
    // What the old statement showed and the new report never does.
    assert.match(old.html, /note interne/, `${where}: the old statement showed the internal notes`);
}
assert.ok(differences >= 3, `the old statement was wrong for a client who pays on the spot (${differences} spans)`);

console.log('client report vs old statement tests passed');
