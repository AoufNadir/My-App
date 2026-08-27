import assert from 'node:assert/strict';
import {
    getClientOperationLabel,
    getClientTransferDetails,
    getManualClientNote,
    getPaymentMethodLabel,
    getTransactionTagLabel
} from './transactionTerminology';

assert.equal(getClientOperationLabel('Transfert Entrant'), 'Transfert entrant');
assert.equal(getClientOperationLabel('Transfert Sortant'), 'Transfert sortant');
assert.equal(getClientOperationLabel('Règlement Reçu'), 'Encaissement du client');
assert.equal(getClientOperationLabel('Paiement Effectué'), 'Remboursement au client');

assert.equal(getManualClientNote('Transfert de Omar'), '');
assert.equal(getManualClientNote('Reçu de Omar'), '');
assert.equal(getManualClientNote('note saisie manuellement'), 'note saisie manuellement');

assert.equal(
    getClientTransferDetails({ type: 'Transfert Entrant', notes: 'Transfert de Omar' }, 'Omar'),
    'De Omar'
);
assert.equal(
    getClientTransferDetails({ type: 'Transfert Sortant', notes: 'note manuelle' }, 'Omar'),
    'Vers Omar - note manuelle'
);

assert.equal(getPaymentMethodLabel('Crédit'), 'Paiement différé');
assert.equal(getPaymentMethodLabel('Espèces'), 'Caisse');
assert.equal(getTransactionTagLabel('Crédit'), 'Paiement différé');
assert.equal(getTransactionTagLabel('Urgent'), 'Urgent');

console.log('transactionTerminology tests passed');
