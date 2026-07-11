import { useMemo } from 'react';
import { ClientDzd, ClientTransactionDzd, OverdueDebtClient } from '../types';
import { computeClientDebtState } from '../utils/clientDebt';
type UseOverdueDebtClientsArgs = {
    clients: ClientDzd[];
    clientTransactions: ClientTransactionDzd[];
    clientBalances: Map<string, number>;
    getClientFullName: (client: ClientDzd) => string;
    minDays?: number;
};
const EPSILON = 0.005;
export function useOverdueDebtClients({ clients, clientTransactions, clientBalances, getClientFullName, minDays = 7 }: UseOverdueDebtClientsArgs) {
    return useMemo<OverdueDebtClient[]>(() => {
        const nowTs = Date.now();
        const txByClient = new Map<string, ClientTransactionDzd[]>();
        for (const tx of clientTransactions) {
            if (tx.affectsBalance === false)
                continue;
            const current = txByClient.get(tx.clientId) || [];
            current.push(tx);
            txByClient.set(tx.clientId, current);
        }
        const results: OverdueDebtClient[] = [];
        for (const client of clients) {
            const currentBalance = clientBalances.get(client.id) || 0;
            if (currentBalance >= -EPSILON)
                continue;
            const clientTxs = txByClient.get(client.id) || [];
            if (clientTxs.length === 0)
                continue;
            // New rows age from their explicit due date; legacy rows use the
            // caller's historical grace period.
            const debtState = computeClientDebtState(clientTxs, nowTs, Math.max(0, minDays));
            const overdueLots = debtState.openLots.filter((lot) => nowTs > lot.dueTimestamp);
            if (overdueLots.length === 0)
                continue;
            const overdueRemainingSum = overdueLots.reduce((sum, lot) => sum + lot.remaining, 0);
            const overdueAmount = Number(overdueRemainingSum.toFixed(2));
            if (overdueAmount <= EPSILON)
                continue;
            const oldestUnpaidTimestamp = overdueLots.reduce((min, lot) => Math.min(min, lot.timestamp), overdueLots[0].timestamp);
            const oldestDueTimestamp = overdueLots.reduce((min, lot) => Math.min(min, lot.dueTimestamp), overdueLots[0].dueTimestamp);
            const daysOverdue = Math.max(0, Math.floor((nowTs - oldestDueTimestamp) / 86_400_000));
            results.push({
                clientId: client.id,
                fullName: getClientFullName(client),
                phone: client.phone,
                overdueAmount,
                daysOverdue,
                oldestUnpaidTimestamp,
                oldestUnpaidDate: new Date(oldestUnpaidTimestamp).toLocaleDateString('fr-FR'),
                lastPaymentTimestamp: debtState.lastPaymentTimestamp,
                balance: currentBalance
            });
        }
        return results.sort((a, b) => {
            if (b.overdueAmount !== a.overdueAmount)
                return b.overdueAmount - a.overdueAmount;
            if (b.daysOverdue !== a.daysOverdue)
                return b.daysOverdue - a.daysOverdue;
            return a.fullName.localeCompare(b.fullName);
        });
    }, [clients, clientTransactions, clientBalances, getClientFullName, minDays]);
}
