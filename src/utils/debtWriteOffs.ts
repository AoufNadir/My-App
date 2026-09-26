import type { ClientTransactionDzd } from '../types';

// "Solder" on a client who owes us clears the debt with no money coming in: the project
// loses that amount. Such write-offs are saved with `countsAsLoss` and are charged to the
// project profit like a project expense. Rows saved before this rule have no flag and
// keep their old effect (none on profit).
export const DEBT_WRITE_OFF_TYPE = 'Remise solde';

export type DebtWriteOff = {
    id: string;
    clientId: string;
    /** Debt cleared, in DZD (positive). */
    amountDzd: number;
    timestamp: number;
};

export function collectDebtWriteOffs(clientTransactions: readonly ClientTransactionDzd[]): DebtWriteOff[] {
    const writeOffs: DebtWriteOff[] = [];
    for (const tx of clientTransactions) {
        if (tx.type !== DEBT_WRITE_OFF_TYPE || tx.countsAsLoss !== true || tx.affectsBalance === false)
            continue;
        // montant is what the write-off added back to the client's balance (the debt cleared).
        const amountDzd = Number(tx.montant);
        const timestamp = Number(tx.timestamp);
        if (!Number.isFinite(amountDzd) || amountDzd <= 0 || !Number.isFinite(timestamp))
            continue;
        writeOffs.push({ id: tx.id, clientId: tx.clientId, amountDzd, timestamp });
    }
    return writeOffs;
}
