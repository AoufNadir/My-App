import assert from 'node:assert/strict';
import {
    getClientOperationLabel,
    getClientTransferDetails,
    getManualClientNote,
    getPaymentMethodLabel
} from './transactionTerminology';

assert.equal(getClientOperationLabel('Transfert Entrant'), 'Transfert entrant');
assert.equal(getClientOperationLabel('Transfert Sortant'), 'Transfert sortant');
assert.equal(getClientOperationLabel('Règlement Reçu'), 'Encaissement client');
assert.equal(getClientOperationLabel('Paiement Effectué'), 'Décaissement client');

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

assert.equal(getPaymentMethodLabel('Crédit'), 'À crédit');
assert.equal(getPaymentMethodLabel('Espèces'), 'Caisse');

console.log('transactionTerminology tests passed');
