import { fromCents, toCents } from '../utils/money';
import {
    buildClientPositionSnapshot,
    type ClientPositionSnapshot,
    type LegacyClientTransactionRow,
} from './clientShadow';

export type ClientReadReconciliationTotals = {
    /** Sum of signed client balances: advances/payables minus receivables. */
    netClientBalanceDzd: number;
    receivableDzd: number;
    /** Current Legacy model stores both advances and client payables as a positive client position. */
    advancesOrPayablesDzd: number;
};

export type ClientReadReconciliationRow = {
    clientId: string;
    legacyBalanceDzd: number;
    shadowBalanceDzd: number;
    receivableDzd: number;
    advancesOrPayablesDzd: number;
    differenceDzd: number;
};

export type ClientReadReconciliation = {
    clientCount: number;
    transactionCount: number;
    ignoredHistoryOnlyCount: number;
    ignoredInvalidAmountCount: number;
    legacy: ClientReadReconciliationTotals;
    shadow: ClientReadReconciliationTotals;
    differences: ClientReadReconciliationTotals;
    mismatches: ClientReadReconciliationRow[];
    ok: boolean;
};

const zeroTotals = (): ClientReadReconciliationTotals => ({
    netClientBalanceDzd: 0,
    receivableDzd: 0,
    advancesOrPayablesDzd: 0,
});

const money = (value: number) => fromCents(toCents(value));

function addToTotals(totals: ClientReadReconciliationTotals, position: ClientPositionSnapshot): void {
    totals.netClientBalanceDzd = money(totals.netClientBalanceDzd + position.balanceDzd);
    totals.receivableDzd = money(totals.receivableDzd + position.receivableDzd);
    totals.advancesOrPayablesDzd = money(totals.advancesOrPayablesDzd + position.advanceDzd);
}

function subtractTotals(left: ClientReadReconciliationTotals, right: ClientReadReconciliationTotals): ClientReadReconciliationTotals {
    return {
        netClientBalanceDzd: money(left.netClientBalanceDzd - right.netClientBalanceDzd),
        receivableDzd: money(left.receivableDzd - right.receivableDzd),
        advancesOrPayablesDzd: money(left.advancesOrPayablesDzd - right.advancesOrPayablesDzd),
    };
}

/**
 * Read-only Legacy-to-Clients-Shadow reconciliation. It uses the Legacy rows
 * already loaded by the app; it neither imports Firebase nor creates a V2
 * operation. Positive client positions remain deliberately grouped as
 * "advances/payables" until V2 is live and can distinguish their counterpart.
 */
export function reconcileLegacyClientsToShadow(
    rows: readonly LegacyClientTransactionRow[],
    clientIds: readonly string[] = [],
): ClientReadReconciliation {
    const rowsByClient = new Map<string, LegacyClientTransactionRow[]>();
    const ids = new Set(clientIds);
    let ignoredHistoryOnlyCount = 0;
    let ignoredInvalidAmountCount = 0;

    for (const row of rows) {
        ids.add(row.clientId);
        if (row.affectsBalance === false) {
            ignoredHistoryOnlyCount += 1;
            continue;
        }
        const amount = Number(row.montant || 0);
        if (!Number.isFinite(amount)) {
            ignoredInvalidAmountCount += 1;
            continue;
        }
        const current = rowsByClient.get(row.clientId) || [];
        current.push(row);
        rowsByClient.set(row.clientId, current);
    }

    const legacy = zeroTotals();
    const shadow = zeroTotals();
    const mismatches: ClientReadReconciliationRow[] = [];

    for (const clientId of [...ids].sort()) {
        const clientRows = rowsByClient.get(clientId) || [];
        const legacyBalanceDzd = money(clientRows.reduce((sum, row) => sum + Number(row.montant || 0), 0));
        const legacyPosition: ClientPositionSnapshot = {
            clientId,
            effectiveAt: Number.MAX_SAFE_INTEGER,
            balanceDzd: legacyBalanceDzd,
            receivableDzd: legacyBalanceDzd < 0 ? Math.abs(legacyBalanceDzd) : 0,
            advanceDzd: legacyBalanceDzd > 0 ? legacyBalanceDzd : 0,
            receivableLots: [],
            advanceLots: [],
        };
        const shadowPosition = buildClientPositionSnapshot(clientRows, clientId);
        addToTotals(legacy, legacyPosition);
        addToTotals(shadow, shadowPosition);
        const differenceDzd = money(legacyBalanceDzd - shadowPosition.balanceDzd);
        if (toCents(differenceDzd) !== 0
            || toCents(legacyPosition.receivableDzd) !== toCents(shadowPosition.receivableDzd)
            || toCents(legacyPosition.advanceDzd) !== toCents(shadowPosition.advanceDzd)) {
            mismatches.push({
                clientId,
                legacyBalanceDzd,
                shadowBalanceDzd: shadowPosition.balanceDzd,
                receivableDzd: shadowPosition.receivableDzd,
                advancesOrPayablesDzd: shadowPosition.advanceDzd,
                differenceDzd,
            });
        }
    }

    const differences = subtractTotals(legacy, shadow);
    return {
        clientCount: ids.size,
        transactionCount: rows.length,
        ignoredHistoryOnlyCount,
        ignoredInvalidAmountCount,
        legacy,
        shadow,
        differences,
        mismatches,
        ok: mismatches.length === 0
            && toCents(differences.netClientBalanceDzd) === 0
            && toCents(differences.receivableDzd) === 0
            && toCents(differences.advancesOrPayablesDzd) === 0,
    };
}
