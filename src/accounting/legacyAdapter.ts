import type { ClientTransactionDzd, DigitalServiceTransaction, InvestorTransaction, ManualAssetTransaction, TreasuryTx, Tx } from '../types';
import type { LegacyLedgerOperation, LegacyLedgerRecord } from './types';

export type LegacyLedgerInput = {
    transactions?: Tx[];
    treasuryTransactions?: TreasuryTx[];
    clientTransactions?: ClientTransactionDzd[];
    investorTransactions?: InvestorTransaction[];
    digitalServiceTransactions?: DigitalServiceTransaction[];
    manualAssetTransactions?: ManualAssetTransaction[];
};

function timestampOf(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (value && typeof (value as { toMillis?: () => number }).toMillis === 'function') {
        return (value as { toMillis: () => number }).toMillis();
    }
    const parsed = Date.parse(String(value || ''));
    return Number.isFinite(parsed) ? parsed : 0;
}

function linkedIds(row: Record<string, unknown>): string[] {
    return [
        row.linkedTxId,
        row.linkedTreasuryTxId,
        row.linkedInvestorTxId,
        row.linkedCapitalInvestorTxId,
        row.linkedDigitalServiceTxId,
        row.linkedProjectExpenseTxId,
        row.linkedPersonalExpenseTxId,
        row.linkedAssetTxId,
    ].filter((value): value is string => typeof value === 'string' && value.length > 0);
}

function groupKey(collection: string, row: Record<string, unknown>): string {
    const linked = linkedIds(row)[0];
    // Primary rows are grouped by their own id; counterpart rows point to that
    // id through a link. This keeps a legacy sale and its cash/client effects
    // together without writing or changing any historic record.
    const anchor = linked || String(row.id || '');
    return `legacy:linked:${anchor || collection}`;
}

function addRows(
    groups: Map<string, LegacyLedgerOperation>,
    collection: string,
    rows: Array<Record<string, unknown>>,
): void {
    rows.forEach((row) => {
        const key = groupKey(collection, row);
        const record: LegacyLedgerRecord = {
            collection,
            id: String(row.id || ''),
            timestamp: timestampOf(row.timestamp),
            linkedTransactionIds: linkedIds(row),
        };
        const existing = groups.get(key);
        if (existing) {
            existing.records.push(record);
            existing.effectiveAt = Math.min(existing.effectiveAt || record.timestamp, record.timestamp || existing.effectiveAt);
            return;
        }
        groups.set(key, {
            operationId: key,
            accountingVersion: 1,
            effectiveAt: record.timestamp,
            records: [record],
        });
    });
}

/**
 * Read-only bridge for current data. It creates no Firebase documents and does
 * not pretend legacy records are fully balanced double-entry operations.
 */
export function buildLegacyLedgerIndex(input: LegacyLedgerInput): LegacyLedgerOperation[] {
    const groups = new Map<string, LegacyLedgerOperation>();
    addRows(groups, 'usdt_txs', (input.transactions || []) as unknown as Array<Record<string, unknown>>);
    addRows(groups, 'treasury_txs', (input.treasuryTransactions || []) as unknown as Array<Record<string, unknown>>);
    addRows(groups, 'dzd_client_txs', (input.clientTransactions || []) as unknown as Array<Record<string, unknown>>);
    addRows(groups, 'investor_transactions', (input.investorTransactions || []) as unknown as Array<Record<string, unknown>>);
    addRows(groups, 'digital_service_txs', (input.digitalServiceTransactions || []) as unknown as Array<Record<string, unknown>>);
    addRows(groups, 'actifTransactions', (input.manualAssetTransactions || []) as unknown as Array<Record<string, unknown>>);
    return Array.from(groups.values()).sort((a, b) => a.effectiveAt - b.effectiveAt || a.operationId.localeCompare(b.operationId));
}
