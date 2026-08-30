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
        handleTouchStart={() => {}}
        openClientModal={() => {}}
        copiedValue={null}
        handleCopy={() => {}}
        transactions={[]}
        profitByTxId={{}}
        handleEditClientTx={() => {}}
        handleDeleteClientTxClick={() => {}}
        openClientTxModal={() => {}}
        openClientToClientTransferModal={() => {}}
        handleExportClientReport={() => {}}
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

const dossierIndex = html.indexOf('Dossier client');
const lastOperationIndex = html.indexOf('Dernière opération');
const actionsIndex = html.indexOf('Actions');
const historyIndex = html.indexOf('Historique');

assert.ok(dossierIndex >= 0 && dossierIndex < actionsIndex, 'Dossier client should appear before Actions');
assert.ok(lastOperationIndex > dossierIndex && lastOperationIndex < actionsIndex, 'Dernière opération should be inside Dossier client');
assert.ok(actionsIndex >= 0 && actionsIndex < historyIndex, 'Historique should appear directly after Actions');

console.log('ClientDetailsView UI tests passed');
