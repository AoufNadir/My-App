import type { ClientTransactionDzd } from '../types';

const DAY_MS = 86_400_000;
const EPSILON = 0.005;

export type OpenDebtLot = {
    sourceTxId: string;
    timestamp: number;
    dueTimestamp: number;
    remaining: number;
    dueDate?: string;
    /** True when the lot originates from a credit sale (not adjustments/initial balances). */
    isCreditSale: boolean;
};

export type ClientDebtState = {
    balance: number;
    debt: number;
    openLots: OpenDebtLot[];
    overdueAmount: number;
    oldestOverdueDays: number;
    oldestOverdueTimestamp: number | null;
    lastPaymentTimestamp: number | null;
    /** Amount-weighted mean days between a credit sale and the payments that
     *  settled it. Null until at least one settlement exists. */
    avgSettleDays: number | null;
    /** Credit-sale lots fully repaid (drives confidence in avgSettleDays). */
    settledLotCount: number;
};

const CREDIT_SALE_TYPES = new Set(['Vente USDT', 'Vente EUR']);

function parseDueTimestamp(value: string | undefined, fallbackTimestamp: number, legacyGraceDays: number) {
    if (value) {
        const parsed = Date.parse(`${value}T23:59:59`);
        if (Number.isFinite(parsed)) return parsed;
    }
    return fallbackTimestamp + Math.max(0, legacyGraceDays) * DAY_MS;
}

/**
 * Pure FIFO debt ageing shared by client alerts and smart pricing.
 * Positive rows settle the oldest debt first; any surplus becomes an advance
 * that offsets later debt rows. New credit rows use their explicit due date,
 * while legacy rows keep the app's historical grace-period behavior.
 */
export function computeClientDebtState(
    transactions: ClientTransactionDzd[],
    now = Date.now(),
    legacyGraceDays = 7,
): ClientDebtState {
    const sorted = [...transactions]
        .filter((tx) => tx.affectsBalance !== false)
        .sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id));

    const lots: OpenDebtLot[] = [];
    let advance = 0;
    let balance = 0;
    let lastPaymentTimestamp: number | null = null;
    // Repayment-behavior telemetry (credit-sale lots only; balance math untouched).
    let settledWeight = 0;
    let settledDayWeight = 0;
    let settledLotCount = 0;

    for (const tx of sorted) {
        const amount = Number(tx.montant || 0);
        if (!Number.isFinite(amount) || Math.abs(amount) <= EPSILON) continue;
        balance += amount;

        if (amount < 0) {
            let incomingDebt = Math.abs(amount);
            if (advance > EPSILON) {
                const consumed = Math.min(advance, incomingDebt);
                advance -= consumed;
                incomingDebt -= consumed;
            }
            if (incomingDebt > EPSILON) {
                lots.push({
                    sourceTxId: tx.id,
                    timestamp: tx.timestamp,
                    dueTimestamp: parseDueTimestamp(tx.creditDueDate, tx.timestamp, legacyGraceDays),
                    dueDate: tx.creditDueDate,
                    remaining: incomingDebt,
                    isCreditSale: tx.paymentMethod === 'Crédit' && CREDIT_SALE_TYPES.has(tx.type),
                });
            }
            continue;
        }

        lastPaymentTimestamp = Math.max(lastPaymentTimestamp || 0, tx.timestamp);
        let payment = amount;
        while (payment > EPSILON && lots.length > 0) {
            const oldest = lots[0];
            const consumed = Math.min(payment, oldest.remaining);
            oldest.remaining -= consumed;
            payment -= consumed;
            if (oldest.isCreditSale) {
                settledWeight += consumed;
                settledDayWeight += consumed * Math.max(0, (tx.timestamp - oldest.timestamp) / DAY_MS);
            }
            if (oldest.remaining <= EPSILON) {
                if (oldest.isCreditSale) settledLotCount++;
                lots.shift();
            }
        }
        if (payment > EPSILON) advance += payment;
    }

    const openLots = lots.filter((lot) => lot.remaining > EPSILON);
    const overdueLots = openLots.filter((lot) => now > lot.dueTimestamp);
    const overdueAmount = overdueLots.reduce((sum, lot) => sum + lot.remaining, 0);
    const oldestOverdueTimestamp = overdueLots.length > 0
        ? Math.min(...overdueLots.map((lot) => lot.dueTimestamp))
        : null;
    const oldestOverdueDays = oldestOverdueTimestamp === null
        ? 0
        : Math.max(0, Math.floor((now - oldestOverdueTimestamp) / DAY_MS));

    return {
        balance: Math.abs(balance) <= EPSILON ? 0 : Number(balance.toFixed(2)),
        debt: Math.max(0, -balance),
        openLots,
        overdueAmount: Number(overdueAmount.toFixed(2)),
        oldestOverdueDays,
        oldestOverdueTimestamp,
        lastPaymentTimestamp,
        avgSettleDays: settledWeight > EPSILON ? settledDayWeight / settledWeight : null,
        settledLotCount,
    };
}

export function projectCreditExposure(currentBalance: number, saleTotalDzd: number) {
    const projectedBalance = Number(currentBalance || 0) - Math.max(0, Number(saleTotalDzd) || 0);
    return {
        projectedBalance,
        projectedDebt: Math.max(0, -projectedBalance),
    };
}

