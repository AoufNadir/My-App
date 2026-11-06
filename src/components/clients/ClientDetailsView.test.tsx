import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ClientDetailsView } from './ClientDetailsView';
import type { ClientDzd, ClientTransactionDzd } from '../../types';

const sourceClient: ClientDzd = {
    id: 'client-source',
    fullName: 'Client Source',
    phone: '0550000000',
    redotpayId: '1704037642',
    binanceEmail: 'client@example.com',
    notes: 'Client note',
    creditLimit: 1000,
};

const targetClient: ClientDzd = {
    id: 'client-target',
    fullName: 'Client Target',
};

const firstTx: ClientTransactionDzd = {
    id: 'first-tx',
    clientId: sourceClient.id,
    timestamp: new Date('2026-02-14T09:00:00Z').getTime(),
    date: '14/02/2026',
    time: '09:00',
    montant: 100,
    type: 'Règlement Reçu',
};

const lastTx: ClientTransactionDzd = {
    id: 'last-tx',
    clientId: sourceClient.id,
    timestamp: new Date('2026-08-27T10:00:00Z').getTime(),
    date: '27/08/2026',
    time: '10:00',
    montant: -500,
    type: 'Paiement Effectué',
};

const html = renderToStaticMarkup(
    <ClientDetailsView
        selectedClientId={sourceClient.id}
        selectedClient={sourceClient}
        selectedClientBalance={-500}
        groupedHistory={{
            '27/08/2026': [lastTx],
            '14/02/2026': [firstTx],
        }}
        clientTransactionsDzd={[firstTx, lastTx]}
        clientsDzd={[sourceClient, targetClient]}
        setSelectedClientId={() => {}}
        getClientFullName={(client) => client.fullName}
        openClientSummary={() => {}}
        openClientModal={() => {}}
        copiedValue={null}
        handleCopy={() => {}}
        transactions={[]}
        profitByTxId={{}}
        handleEditClientTx={() => {}}
        handleDeleteClientTxClick={() => {}}
        openClientTxModal={() => {}}
        openClientToClientTransferModal={() => {}}
    />
);

assert.match(html, /Dossier client/);
assert.match(html, /Dernière opération/);
assert.match(html, /Première opération/);
assert.match(html, /Historique/);
assert.match(html, /data-testid="client-transfer-button"/);
assert.match(html, /Transférer/);
assert.doesNotMatch(html, /Activité du client/);
assert.doesNotMatch(html, /Vieillissement de la dette/);
assert.doesNotMatch(html, /Aperçu/);

// V2-5 order: balance and quick actions first, then the tabs, history before the client file.
const transferIndex = html.indexOf('data-testid="client-transfer-button"');
const historyTabIndex = html.indexOf('>Historique<');
const dossierTabIndex = html.indexOf('>Dossier client<');
const historyPanel = /<div role="tabpanel" aria-label="Historique"( hidden="")?/.exec(html);
const dossierPanel = /<div role="tabpanel" aria-label="Dossier client"( hidden="")?/.exec(html);
const lastOperationIndex = html.indexOf('Dernière opération');

assert.ok(transferIndex >= 0 && transferIndex < historyTabIndex, 'quick actions come before the tabs');
assert.ok(historyTabIndex < dossierTabIndex, 'Historique is the first tab');
assert.ok(historyPanel && !historyPanel[1], 'the history shows first');
assert.ok(dossierPanel && dossierPanel[1], 'the client file waits behind its tab');
assert.ok(lastOperationIndex > dossierPanel!.index, 'Dernière opération is inside the client file');
assert.ok(html.indexOf('Encaisser') < transferIndex && html.indexOf('Payer') < transferIndex, 'collect and pay next to transfer');
assert.match(html, /Rappel WhatsApp/, 'a client in debt gets the reminder button');

console.log('ClientDetailsView UI tests passed');

// V12-2/V12-8: the deliveries appear in the history as quiet lines, on their day, newest first; never before the
// oldest day shown, and nothing changes when there are none.
{
    const { mergeDeliveryLines } = await import('./ClientDetailsView');
    const row = (id: string, date: string, ts: number) => ({ id, originalId: id, timestamp: ts, date, time: '10:00', typeLabel: 'Vente', amountLabel: '1', amountColor: '', icon: null, details: '', category: 'client', rawTx: {}, sourceType: 'client_tx' }) as never;
    const groups: Array<[string, never[]]> = [['05/11/2026', [row('a', '05/11/2026', new Date(2026, 10, 5, 9).getTime())]], ['02/11/2026', [row('b', '02/11/2026', new Date(2026, 10, 2, 9).getTime())]]];
    const words = { sent: 'Envoyé au client', received: 'Reçu du fournisseur', noBalance: 'sans effet' };
    const docs = [
        { id: 'd1', kind: 'delivery' as const, clientId: 'c', currency: 'USDT' as const, quantity: 200, timestamp: new Date(2026, 10, 5, 12).getTime() },
        { id: 'd2', kind: 'delivery' as const, clientId: 'c', currency: 'USDT' as const, quantity: 50, timestamp: new Date(2026, 10, 6, 8).getTime() },
        { id: 'd3', kind: 'delivery' as const, clientId: 'c', currency: 'USDT' as const, quantity: 9, timestamp: new Date(2026, 9, 1, 8).getTime() },
        { id: 'k1', kind: 'commitment' as const, clientId: 'c', currency: 'USDT' as const, quantity: 3_906.25, timestamp: new Date(2026, 10, 5, 8).getTime() },
    ];
    const merged = mergeDeliveryLines(groups, docs, words);
    assert.deepEqual(merged.map(([key]) => key), ['06/11/2026', '05/11/2026', '02/11/2026'], 'a new day for a delivery after the newest one');
    assert.deepEqual(merged[1][1].map((tx) => tx.id), ['delivery:d1', 'a'], 'on its day, newest first');
    assert.equal(merged[1][1][0].typeLabel, 'Envoyé au client');
    assert.ok(!merged.flatMap(([, rows]) => rows).some((tx) => tx.id === 'delivery:d3'), 'nothing before the oldest day shown');
    assert.ok(!merged.flatMap(([, rows]) => rows).some((tx) => tx.id === 'delivery:k1'), 'the amount to send is not a history line');
    assert.equal(mergeDeliveryLines(groups, [], words), groups, 'no delivery: the history is unchanged');
    console.log('history delivery lines passed');
}
