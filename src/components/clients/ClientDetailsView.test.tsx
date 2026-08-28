import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ClientDetailsView } from './ClientDetailsView';
import type { ClientDzd } from '../../types';

const sourceClient: ClientDzd = {
    id: 'client-source',
    fullName: 'Client Source',
};

const targetClient: ClientDzd = {
    id: 'client-target',
    fullName: 'Client Target',
};

const html = renderToStaticMarkup(
    <ClientDetailsView
        selectedClientId={sourceClient.id}
        selectedClient={sourceClient}
        selectedClientBalance={-500}
        groupedHistory={{}}
        clientTransactionsDzd={[]}
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

assert.match(html, /data-testid="client-transfer-button"/);
assert.match(html, /Transfert entre clients/);

console.log('ClientDetailsView UI tests passed');
