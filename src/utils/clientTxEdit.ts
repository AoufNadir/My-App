import type { ClientTransactionDzd } from '../types';
import { normalizeLedgerLabel } from './financialUx';

export type ClientTxPaymentStatus = 'credit' | 'cash' | 'baridi';

export const CLIENT_TX_PAYMENT_RECEIVED = 'Règlement Reçu';
export const CLIENT_TX_PAYMENT_MADE = 'Paiement Effectué';

export const normalizeClientTxType = (value: string) => {
    const normalized = normalizeLedgerLabel(value || '');
    if (normalized === CLIENT_TX_PAYMENT_RECEIVED)
        return CLIENT_TX_PAYMENT_RECEIVED;
    if (normalized === CLIENT_TX_PAYMENT_MADE)
        return CLIENT_TX_PAYMENT_MADE;
    return normalized;
};

/** Règlement Reçu / Paiement Effectué: the only client rows that move cash. */
export const isClientSettlementType = (type: string) => {
    const normalized = normalizeClientTxType(type);
    return normalized === CLIENT_TX_PAYMENT_RECEIVED || normalized === CLIENT_TX_PAYMENT_MADE;
};

/** Payment mode preselected when an existing client row is opened for editing. */
export const paymentStatusForExistingClientTx = (paymentMethod: string | undefined): ClientTxPaymentStatus => {
    if (paymentMethod === 'BaridiMob')
        return 'baridi';
    if (paymentMethod === 'Espèces' || paymentMethod === 'EspÃ¨ces')
        return 'cash';
    return 'credit';
};

/**
 * Amount prefilled in the edit form. Settlements are typed as positive amounts (the type
 * gives the direction); balance rows such as Solde Initial keep their sign.
 */
export const clientTxEditAmountInput = (tx: Pick<ClientTransactionDzd, 'type' | 'montant'>) => {
    const montant = Number(tx.montant || 0);
    return String(isClientSettlementType(tx.type) ? Math.abs(montant) : montant);
};

export type ClientTxSavePlan = {
    /** Signed montant stored on the client row. */
    montant: number;
    /** 'credit' means no treasury movement. */
    paymentStatus: ClientTxPaymentStatus;
    /** Editing a Solde Initial, Ajustement Solde or orphaned row: balance only, payment method kept. */
    isBalanceRowEdit: boolean;
};

/**
 * How a client row from the client operation form is saved. A settlement takes its sign from
 * its type and always goes through a wallet. Any other row can only be reached by editing it:
 * it keeps the sign typed in the form and never moves cash.
 */
export const planClientTxSave = ({ type, amount, selectedStatus, isEditing }: {
    type: string;
    amount: number;
    selectedStatus: ClientTxPaymentStatus;
    isEditing: boolean;
}): ClientTxSavePlan => {
    const normalized = normalizeClientTxType(type);
    if (normalized === CLIENT_TX_PAYMENT_RECEIVED || normalized === CLIENT_TX_PAYMENT_MADE) {
        return {
            montant: normalized === CLIENT_TX_PAYMENT_RECEIVED ? amount : -amount,
            paymentStatus: selectedStatus === 'credit' ? 'cash' : selectedStatus,
            isBalanceRowEdit: false,
        };
    }
    if (isEditing)
        return { montant: amount, paymentStatus: 'credit', isBalanceRowEdit: true };
    return { montant: -amount, paymentStatus: selectedStatus, isBalanceRowEdit: false };
};
