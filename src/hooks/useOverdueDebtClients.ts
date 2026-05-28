import { useMemo } from 'react';
import { ClientDzd, ClientTransactionDzd, OverdueDebtClient } from '../types';
type UseOverdueDebtClientsArgs = {
    clients: ClientDzd[];
    clientTransactions: ClientTransactionDzd[];
    clientBalances: Map<string, number>;
    getClientFullName: (client: ClientDzd) => string;
    minDays?: number;
};
const DAY_MS = 24 * 60 * 60 * 1000;
const EPSILON = 0.005;
type DebtLot = {
    timestamp: number;
    date: string;
    remaining: number;
};
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
            const debtQueue: DebtLot[] = [];
            let availableCredit = 0;
            let lastPaymentTimestamp: number | null = null;
            for (const tx of clientTxs) {
                const amount = Number(tx.montant || 0);
                if (!Number.isFinite(amount) || Math.abs(amount) <= EPSILON)
                    continue;
                if (amount < 0) {
                    let incomingDebt = Math.abs(amount);
                    // Positive balance built before a debt should reduce that debt immediately.
                    if (availableCredit > EPSILON) {
                        const consumedCredit = Math.min(availableCredit, incomingDebt);
                        availableCredit -= consumedCredit;
                        incomingDebt -= consumedCredit;
                    }
                    if (incomingDebt > EPSILON) {
                        debtQueue.push({
                            timestamp: tx.timestamp,
                            date: tx.date,
                            remaining: incomingDebt
                        });
                    }
                    continue;
                }
                if (lastPaymentTimestamp === null || tx.timestamp > lastPaymentTimestamp) {
                    lastPaymentTimestamp = tx.timestamp;
                }
                let remainingPayment = amount;
                while (remainingPayment > EPSILON && debtQueue.length > 0) {
                    const oldestDebt = debtQueue[0];
                    const consumed = Math.min(remainingPayment, oldestDebt.remaining);
                    oldestDebt.remaining -= consumed;
                    remainingPayment -= consumed;
                    if (oldestDebt.remaining <= EPSILON) {
                        debtQueue.shift();
                    }
                }
                // Remaining positive amount becomes advance and can offset future debts.
                if (remainingPayment > EPSILON) {
                    availableCredit += remainingPayment;
                }
            }
            const overdueLots = debtQueue.filter((lot) => {
                if (lot.remaining <= EPSILON)
                    return false;
                const days = Math.floor((nowTs - lot.timestamp) / DAY_MS);
                return days > minDays;
            });
            if (overdueLots.length === 0)
                continue;
            // FIX-4 (Q5): show only the actually-overdue lots (>minDays old), not the full negative
            // balance. Recent debts inside the grace window stay hidden from the overdue total.
            const overdueRemainingSum = overdueLots.reduce((sum, lot) => sum + lot.remaining, 0);
            const overdueAmount = Number(overdueRemainingSum.toFixed(2));
            if (overdueAmount <= EPSILON)
                continue;
            const oldestUnpaidTimestamp = overdueLots.reduce((min, lot) => Math.min(min, lot.timestamp), overdueLots[0].timestamp);
            const daysOverdue = Math.floor((nowTs - oldestUnpaidTimestamp) / DAY_MS);
            results.push({
                clientId: client.id,
                fullName: getClientFullName(client),
                phone: client.phone,
                overdueAmount,
                daysOverdue,
                oldestUnpaidTimestamp,
                oldestUnpaidDate: new Date(oldestUnpaidTimestamp).toLocaleDateString('fr-FR'),
                lastPaymentTimestamp,
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
