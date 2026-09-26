import assert from 'node:assert/strict';
import type { ClientTransactionDzd } from '../types';
import { parseAndEvaluate } from '../utils';
import { clientTxEditAmountInput, paymentStatusForExistingClientTx, planClientTxSave } from './clientTxEdit';
import { operationStamp, stampAt } from './editStamp';

const soldeInitial: ClientTransactionDzd = {
    id: 's1', clientId: 'c1', timestamp: Date.parse('2026-03-01T09:30:00'),
    date: '01/03/2026', time: '09:30', montant: 50_000,
    type: 'Solde Initial', notes: 'Solde initial', paymentMethod: 'Crédit',
};

// Bug 1: opening a Solde Initial (+50 000, we owe the client) and saving it unchanged
// used to store -50 000 and withdraw 50 000 from the Caisse.
{
    const input = clientTxEditAmountInput(soldeInitial);
    assert.equal(input, '50000');
    const selectedStatus = paymentStatusForExistingClientTx(soldeInitial.paymentMethod);
    assert.equal(selectedStatus, 'credit');
    const plan = planClientTxSave({ type: soldeInitial.type, amount: parseAndEvaluate(input), selectedStatus, isEditing: true });
    assert.equal(plan.montant, 50_000);
    assert.equal(plan.paymentStatus, 'credit'); // no treasury row
    assert.equal(plan.isBalanceRowEdit, true);
}

// A negative balance row (client owes us) keeps its sign too, and a corrected amount is saved as typed.
{
    const debtAdjustment: ClientTransactionDzd = { ...soldeInitial, id: 'a1', type: 'Ajustement Solde', montant: -12_500 };
    const input = clientTxEditAmountInput(debtAdjustment);
    assert.equal(input, '-12500');
    assert.equal(planClientTxSave({ type: debtAdjustment.type, amount: parseAndEvaluate(input), selectedStatus: 'credit', isEditing: true }).montant, -12_500);
    assert.equal(planClientTxSave({ type: debtAdjustment.type, amount: parseAndEvaluate('-10000'), selectedStatus: 'credit', isEditing: true }).montant, -10_000);
}

// A balance row never moves cash, even if its stored payment method is cash or missing.
{
    for (const paymentMethod of ['Espèces', 'BaridiMob', undefined] as const) {
        const plan = planClientTxSave({ type: 'Ajustement Solde', amount: 1000, selectedStatus: paymentStatusForExistingClientTx(paymentMethod), isEditing: true });
        assert.equal(plan.paymentStatus, 'credit');
        assert.equal(plan.isBalanceRowEdit, true);
    }
}

// Settlements keep their existing behaviour: sign from the type, always through a wallet.
{
    const received: ClientTransactionDzd = { ...soldeInitial, id: 'r1', type: 'Règlement Reçu', montant: 20_000, paymentMethod: 'BaridiMob' };
    const made: ClientTransactionDzd = { ...soldeInitial, id: 'p1', type: 'Paiement Effectué', montant: -20_000, paymentMethod: 'Espèces' };
    assert.equal(clientTxEditAmountInput(received), '20000');
    assert.equal(clientTxEditAmountInput(made), '20000');
    assert.deepEqual(planClientTxSave({ type: received.type, amount: 20_000, selectedStatus: 'baridi', isEditing: true }), { montant: 20_000, paymentStatus: 'baridi', isBalanceRowEdit: false });
    assert.deepEqual(planClientTxSave({ type: made.type, amount: 20_000, selectedStatus: 'cash', isEditing: true }), { montant: -20_000, paymentStatus: 'cash', isBalanceRowEdit: false });
    assert.deepEqual(planClientTxSave({ type: 'Règlement Reçu', amount: 5_000, selectedStatus: 'credit', isEditing: false }), { montant: 5_000, paymentStatus: 'cash', isBalanceRowEdit: false });
    // Mis-encoded legacy labels are still recognised.
    assert.equal(planClientTxSave({ type: 'RÃ¨glement ReÃ§u', amount: 5_000, selectedStatus: 'cash', isEditing: true }).montant, 5_000);
    assert.equal(paymentStatusForExistingClientTx('EspÃ¨ces'), 'cash');
    assert.equal(paymentStatusForExistingClientTx('CrÃ©dit'), 'credit');
}

// Bug 2: an edited operation keeps its original date; only a new one is stamped now.
{
    const sale = { timestamp: Date.parse('2026-08-01T14:05:00'), date: '01/08/2026', time: '14:05' };
    assert.deepEqual(operationStamp(sale), sale);

    const legacyWithoutLabels = { timestamp: sale.timestamp };
    assert.deepEqual(operationStamp(legacyWithoutLabels), stampAt(sale.timestamp));
    assert.equal(stampAt(sale.timestamp).date, '01/08/2026');

    const before = Date.now();
    const fresh = operationStamp(null);
    assert.ok(fresh.timestamp >= before && fresh.timestamp <= Date.now());
    assert.ok(operationStamp({ timestamp: 0 }).timestamp >= before);
}

console.log('clientTxEdit tests passed');
