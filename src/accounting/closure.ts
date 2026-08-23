export const HISTORICAL_CLOSING_BASELINE_DZD = 362_288;
export const HISTORICAL_CLOSING_PREVIOUS_BASELINE_DZD = 365_350;
export const HISTORICAL_CLOSING_ADJUSTMENT_DZD = -3_062;

export type AccountingV2Status = {
    mode: 'prepared' | 'active';
    closureAt: number | null;
    reason?: 'missing_closure_at' | 'invalid_closure_at';
};

export class AccountingV2PreparedError extends Error {
    readonly code = 'ACCOUNTING_V2_PREPARED';

    constructor() {
        super('Accounting V2 is prepared but not activated for production writes.');
        this.name = 'AccountingV2PreparedError';
    }
}

function configuredClosureAt(): string | undefined {
    const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
    return env?.VITE_ACCOUNTING_CLOSURE_AT;
}

/**
 * Core Ledger deliberately remains prepared until the first migrated writer is
 * released with a single immutable production closure timestamp.
 */
export function getAccountingV2Status(value = configuredClosureAt()): AccountingV2Status {
    if (!value) {
        return { mode: 'prepared', closureAt: null, reason: 'missing_closure_at' };
    }
    const closureAt = Date.parse(value);
    if (!Number.isFinite(closureAt)) {
        return { mode: 'prepared', closureAt: null, reason: 'invalid_closure_at' };
    }
    return { mode: 'active', closureAt };
}

export function assertAccountingV2WriteEnabled(status = getAccountingV2Status()): number {
    if (status.mode !== 'active' || status.closureAt === null) {
        throw new AccountingV2PreparedError();
    }
    return status.closureAt;
}
