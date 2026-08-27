export const ACCOUNTING_V2 = 2 as const;
export const ACCOUNTING_TOLERANCE_DZD = 0.01;

export type LedgerAccount =
    | `asset.${string}`
    | `liability.${string}`
    | `equity.${string}`
    | `income.${string}`
    | `expense.${string}`;

export type LedgerPostingSide = 'debit' | 'credit';

export type FinancialOperationKind =
    | 'portfolio_buy'
    | 'portfolio_sell'
    | 'portfolio_exchange'
    | 'portfolio_adjustment'
    | 'portfolio_non_sale_removal'
    | 'portfolio_fee'
    | 'treasury_transfer'
    | 'client_settlement'
    | 'client_transfer'
    | 'client_write_off'
    | 'investor_capital_deposit'
    | 'investor_capital_withdrawal'
    | 'investor_profit_withdrawal'
    | 'investor_profit_reinvestment'
    | 'investor_profit_allocation'
    | 'personal_expense'
    | 'project_expense'
    | 'digital_service_sale'
    | 'manual_asset_transaction'
    | 'order_completion'
    | 'manager_fee_change'
    | 'correction'
    | 'reversal';

export type ProjectionReference = {
    collection: string;
    id: string;
};

/** A debit or credit is always a positive amount. The side carries the sign. */
export type LedgerPosting = {
    id: string;
    account: LedgerAccount;
    side: LedgerPostingSide;
    amountDzd: number;
    currency?: 'DZD' | 'USDT' | 'EUR';
    quantity?: number;
    unitRateDzd?: number;
    investorId?: string;
    clientId?: string;
    linkedTransactionId?: string;
    description?: string;
};

export type ExternalInvestorProfitShare = {
    investorId: string;
    amountDzd: number;
};

/**
 * Snapshot saved with a profit event. It prevents later fee, entry-date, or
 * capital changes from altering the allocation that was valid at the event.
 */
export type ProfitAllocationSnapshot = {
    projectProfitDzd: number;
    managerFeeDzd: number;
    managerCapitalDzd: number;
    externalInvestorShares: ExternalInvestorProfitShare[];
    managerFeePercentage: number;
    eligibleInvestorCapital: Array<{ investorId: string; capitalDzd: number }>;
};

export type AccountingOperationStatus = 'posted' | 'reversal';

export type AccountingOperationDraft = {
    operationId: string;
    accountingVersion: typeof ACCOUNTING_V2;
    kind: FinancialOperationKind;
    status: AccountingOperationStatus;
    effectiveAt: number;
    actorUid: string;
    reason?: string;
    reversalOf?: string;
    postings: LedgerPosting[];
    projections: ProjectionReference[];
    profitAllocation?: ProfitAllocationSnapshot;
    metadata?: Record<string, unknown>;
};

export type AccountingOperation = AccountingOperationDraft & {
    /** Written only by Firestore serverTimestamp() when v2 becomes active. */
    createdAt?: unknown;
    idempotencyPayload: string;
};

export type AccountingCheckpoint = {
    accountingVersion: typeof ACCOUNTING_V2;
    revision: number;
    lastOperationId: string;
    updatedAt?: unknown;
};

export type InvariantResult = {
    code: string;
    differenceDzd: number;
    operationIds: string[];
    message: string;
};

export type AccountingIntegrityReport = {
    ok: boolean;
    toleranceDzd: number;
    assetsDzd: number;
    liabilitiesDzd: number;
    ownerEquityDzd: number;
    projectProfitDzd: number;
    managerFeeDzd: number;
    managerCapitalDzd: number;
    externalInvestorProfitDzd: number;
    failures: InvariantResult[];
};

export type LegacyLedgerRecord = {
    collection: string;
    id: string;
    timestamp: number;
    linkedTransactionIds: string[];
};

export type LegacyLedgerOperation = {
    operationId: string;
    accountingVersion: 1;
    effectiveAt: number;
    records: LegacyLedgerRecord[];
};
