export interface Tx {
    id: string;
    type: 'buy' | 'sell' | 'Ajout Manuel' | 'Retrait Manuel';
    quantity: number;
    price?: number;
    sell?: number;
    total?: number;
    profit?: number;
    settlementCurrency?: 'DZD' | 'EUR';
    sellPriceEur?: number;
    saleValueEur?: number;
    eurToDzdRateAtSale?: number;
    purchaseFundingCurrency?: 'DZD' | 'EUR';
    purchaseAmountEur?: number;
    eurToDzdRateAtPurchase?: number;
    eurPerUsdtAtPurchase?: number;
    date: string;
    time: string;
    timestamp: number;
    notes?: string;
    /** Free-form labels, e.g. "OTC", "Urgent", "Wholesale". Filterable. */
    tags?: string[];
    origin?: 'digital_service_sale' | 'delivery_expense' | 'personal_expense' | 'personal_expense_return';
    linkedDigitalServiceTxId?: string;
    linkedProjectExpenseTxId?: string;
    linkedPersonalExpenseTxId?: string;
    linkedTreasuryTxId?: string;
    currency: 'USDT' | 'EUR';
    linkedTxId?: string;
    linkedClientId?: string;
    linkedClientDzdId?: string;
    clientPaymentStatus?: 'credit' | 'baridi' | 'cash';
    paymentMethod?: 'Espèces' | 'BaridiMob' | 'Crédit';
    /** ISO yyyy-mm-dd. Required for new credit sales; legacy credit rows may omit it. */
    creditDueDate?: string;
    /** Unix ms timestamp after which this purchase becomes available for sale (24h restriction). */
    lockedUntil?: number;
    // ── Smart Pricing snapshot (sell only) — what the engine suggested at
    //    sale time. Actual price lives in `sell`; the delta is the
    //    negotiation loss. See services/smartPricingEngine.ts.
    spOpeningPrice?: number;
    spTargetPrice?: number;
    spMinPrice?: number;
    spMarketStatus?: 'rising' | 'falling' | 'stable' | 'volatile' | 'unknown';
    spSegment?: 'vip' | 'good' | 'normal' | 'weak' | 'risky' | 'new';
    spScore?: number;
    /** Versioned, auditable recommendation used for this sale. */
    spSnapshot?: SmartPricingSnapshot;
}

export type PricingMarketStatus = 'rising' | 'falling' | 'stable' | 'volatile' | 'unknown';
export type PricingCustomerSegment = 'vip' | 'good' | 'normal' | 'weak' | 'risky' | 'new';
export type PricingPaymentKind = 'cash' | 'baridi' | 'credit';

export interface SmartPricingSnapshot {
    modelVersion: string;
    quotedAt: number;
    currency: 'USDT' | 'EUR';
    clientId: string | null;
    quantity: number;
    pam: number;
    payment: {
        kind: PricingPaymentKind;
        dueDate?: string;
        termDays: number;
        /** How termDays was derived: promised date, learned behavior, or policy default. */
        termSource?: 'explicit' | 'learned' | 'default';
    };
    corridor: {
        openingPrice: number;
        targetPrice: number;
        floorPrice: number;
    };
    market: {
        automatic: PricingMarketStatus;
        effective: PricingMarketStatus;
        overridden: boolean;
    };
    client: {
        automaticSegment: PricingCustomerSegment;
        effectiveSegment: PricingCustomerSegment;
        pricedAs: PricingCustomerSegment;
        score: number | null;
        overridden: boolean;
    };
    breakdown: {
        marketBand: [number, number];
        quantityAdjustment: number;
        financingPremium: number;
        targetGoalShift: number;
        floorGoalShift: number;
        negotiationBuffer: number;
    };
    goal: {
        remainingGoal: number;
        expectedProfit: number;
        coveragePct: number | null;
        feasible: boolean;
    };
    creditRisk: {
        projectedDebt: number;
        creditLimit: number;
        utilizationPct: number | null;
        oldestOverdueDays: number;
        requiresAcknowledgement: boolean;
        acknowledged: boolean;
        acknowledgedAt?: number;
        reasons: string[];
    };
    actual: {
        source: 'opening' | 'target' | 'floor' | 'manual';
        unitPrice: number;
        deviationPerUnit: number;
        negotiationLoss: number;
        belowFloor: boolean;
        belowPam: boolean;
    };
    reasonCodes: string[];
    configRevision?: number;
    planRevision?: number;
    overrideIds?: string[];
}

export interface LockedBatch {
    txId: string;
    quantity: number;
    lockedUntil: number;
}
export interface Investor {
    id: string;
    name: string;
    entryDate: string; // ISO Date
    capitalInvested: number;
    initialCapital: number;
    sharePercentage: number;
    totalProfit: number;
    withdrawnProfit: number;
    availableProfit: number;
    isActive: boolean;
    notes?: string;
    email?: string;
    phone?: string;
    password?: string; // For simple auth simulation if needed
    isManager?: boolean;
}
export interface InvestorTransaction {
    id: string;
    investorId: string;
    type: 'deposit_capital' | 'withdraw_capital' | 'profit_distribution' | 'withdraw_profit' | 'reinvest_profit';
    amount: number;
    paymentSource?: 'Caisse' | 'BaridiMob' | 'USDT' | 'EUR';
    linkedTreasuryTxId?: string;
    /** Accounting source for profit movements. Legacy rows are inferred from the linked treasury row/notes. */
    origin?: 'personal_expense' | 'profit_withdrawal' | 'profit_distribution' | 'reinvestment' | 'capital_movement';
    date: string;
    time: string;
    timestamp: number;
    notes?: string;
}
export interface ClientDzd {
    id: string;
    fullName: string;
    phone?: string;
    redotpayId?: string;
    binanceEmail?: string;
    notes?: string;
    creditLimit?: number;
    group?: string;
    isFournisseur?: boolean;
    nom?: string; // Legacy support
    prenom?: string; // Legacy support
}
export interface ClientTransactionDzd {
    id: string;
    clientId: string;
    timestamp: number;
    date: string;
    time: string;
    montant: number; // Positive = Credit (Advance), Negative = Debt
    type: 'Règlement Reçu' | 'Paiement Effectué' | 'Vente USDT' | 'Vente EUR' | 'Achat EUR' | 'Vente service numérique' | 'Solde Initial' | 'Transfert Entrant' | 'Transfert Sortant' | 'Ajustement Solde';
    notes?: string;
    /** Free-form labels for filtering (shared with Tx tags). */
    tags?: string[];
    linkedTxId?: string; // ID of the USDT/EUR transaction if applicable
    linkRole?: 'primary' | 'dzd_receiver';
    paymentMethod?: 'Espèces' | 'BaridiMob' | 'Crédit' | 'USDT' | 'EUR';
    /** ISO yyyy-mm-dd due date for credit debt lots. */
    creditDueDate?: string;
    affectsBalance?: boolean; // false = history-only row that should not alter client balance
    origin?: 'adjustment' | 'digital_service_sale';
    linkedDigitalServiceTxId?: string;
}
export interface TreasuryTx {
    id: string;
    timestamp: number;
    date: string;
    time: string;
    type: 'Ajout' | 'Retrait' | 'Adjustment (+)' | 'Adjustment (-)' | 'Transfer';
    source?: 'Caisse' | 'BaridiMob';
    destination?: 'Caisse' | 'BaridiMob';
    asset?: string;
    amount: number;
    notes?: string;
    linkedTxId?: string; // ID of the USDT/EUR transaction if applicable
    linkedInvestorTxId?: string;
    linkedCapitalInvestorTxId?: string;
    linkedTreasuryTxId?: string; // For personal_expense_return: links back to original advance
    origin?: 'manual_asset' | 'client_tx' | 'usdt_tx' | 'balance_edit' | 'delivery_expense' | 'digital_service_sale' | 'investor_profit_withdrawal' | 'investor_capital_deposit' | 'investor_capital_withdrawal' | 'personal_expense' | 'personal_expense_return'; // Source of the transaction
    /** Missing means a recorded tracked expense; use historical only for explicit pre-tracking adjustments. */
    trackingPhase?: 'historical' | 'current';
    linkedAssetTxId?: string; // Link back to actifTransactions
    linkedDigitalServiceTxId?: string;
    linkedProjectExpenseTxId?: string;
    expenseWallet?: 'Caisse' | 'BaridiMob' | 'USDT' | 'EUR';
    expenseCurrency?: 'DZD' | 'USDT' | 'EUR';
    originalAmount?: number;
    conversionRateToDzd?: number;
    amountDzd?: number;
    // Personal expense imprest system (origin === 'personal_expense' only)
    advanceState?: 'pending' | 'settled';
    settledAmount?: number; // Actual amount spent after reconciliation
    profitAmountDzd?: number; // Portion charged to manager profit
    capitalAmountDzd?: number; // Portion charged to manager capital
    spentDescription?: string; // What the settled advance was spent on
    linkedReturnTxId?: string; // ID of the return TreasuryTx created during reconciliation
}
export interface TreasuryCard {
    id: string;
    name: string;
    value: number;
    notes?: string;
}
export interface DigitalServiceTransaction {
    id: string;
    type: 'digital_service_sale';
    clientId: string;
    serviceName: string;
    purchaseWallet: 'Caisse' | 'BaridiMob' | 'USDT' | 'EUR';
    purchaseCurrency: 'DZD' | 'USDT' | 'EUR';
    purchaseAmount: number;
    purchaseRateToDzd: number;
    purchaseAmountDzd: number;
    saleWallet: 'Caisse' | 'BaridiMob' | 'USDT' | 'EUR' | 'Credit';
    saleCurrency: 'DZD' | 'USDT' | 'EUR';
    saleAmount: number;
    saleRateToDzd: number;
    saleAmountDzd: number;
    profitDzd: number;
    date: string;
    time: string;
    timestamp: number;
    notes?: string;
    linkedTreasuryTxIds?: string[];
    linkedPortfolioTxIds?: string[];
    linkedClientTxId?: string;
}
// ===== Manual Assets System =====
export interface ManualAsset {
    id: string;
    name: string; // "Conception", "Printing", etc.
    description?: string;
    createdAt: number;
    updatedAt: number;
    archived?: boolean;
}
export interface ManualAssetClient {
    id: string;
    assetId: string; // Foreign key to manual_assets
    fullName: string;
    phone?: string;
    email?: string;
    notes?: string;
    createdAt: number;
    updatedAt: number;
}
export type ManualAssetTransactionType = 'service' | 'payment_received' | 'payment_made' | 'adjustment' | 'invoice';
export interface ManualAssetTransaction {
    id: string;
    actifId: string; // Foreign key to manual_assets
    clientId: string; // Foreign key to manual_asset_clients
    type: ManualAssetTransactionType;
    serviceType?: string; // "Design", "Impression", "Branding", etc. (when type = 'service')
    amount: number; // Positive for income, negative for expense
    date: string; // DD/MM/YYYY
    time: string; // HH:MM
    timestamp: number;
    notes?: string;
    paymentMethod?: 'cash' | 'baridi' | 'credit';
    runningBalance?: number; // Balance after this transaction (for client within asset)
    linkedTreasuryTxId?: string; // Link to treasury_txs (when payment_received with cash/baridi)
}
export interface OverdueDebtClient {
    clientId: string;
    fullName: string;
    phone?: string;
    overdueAmount: number;
    daysOverdue: number;
    oldestUnpaidTimestamp: number;
    oldestUnpaidDate: string;
    lastPaymentTimestamp: number | null;
    balance: number;
}
export interface Notification {
    id: string;
    title: string;
    message: string;
    timestamp: number;
    type: string;
    read: boolean;
    priority?: number;
    color?: string;
    data?: any;
}
export interface PortfolioStats {
    usdt: {
        purchasedQty: number;
        costBasis: number;
        avgBuy: number;
        totalProfit: number;
        available: number;
        locked: number;
        lockedBatches: LockedBatch[];
    };
    eur: {
        purchasedQty: number;
        costBasis: number;
        avgBuy: number;
        totalProfit: number;
        available: number;
        locked: number;
        lockedBatches: LockedBatch[];
    };
}

// ===== Order System (Pro Digital Orders) =====
// New top-level Firestore collections (po_*) layered on top of the existing
// single-operator app. These power the client-facing order flow, the agent
// cash-handover flow, and admin order management. See plan: RBAC foundation.

export type PoRole = 'admin' | 'client' | 'agent';
export type PoUserStatus = 'pending' | 'approved' | 'blocked';

/** Profile / role doc. Doc id === Firebase Auth uid. Collection: po_users. */
export interface PoUser {
    uid: string;
    role: PoRole;
    status: PoUserStatus;
    email: string;
    displayName?: string;
    phone?: string;
    operatorUid: string;
    /** Clients: link to an existing ClientDzd (users/{operatorUid}/dzd_clients). */
    linkedClientId?: string;
    /** Agents: stable agent id + the cash location they may confirm for. */
    agentId?: string;
    assignedCashLocationId?: string;
    /** Per-client debt POLICY (the balance itself is derived from the ledger). */
    debtEnabled?: boolean;
    debtLimitDzd?: number;
    createdAt: number;
    approvedAt?: number;
    approvedBy?: string;
}

export type PoOrderStatus =
    | 'NEW'
    | 'WAITING_PAYMENT'
    | 'PAYMENT_PROOF_SUBMITTED'
    | 'WAITING_ADMIN_CONFIRMATION'
    | 'PAYMENT_CONFIRMED'
    | 'WAITING_DELIVERY'
    | 'DELIVERED'
    | 'CANCELLED'
    | 'REJECTED'
    | 'DEBT_ACTIVE'
    | 'DEBT_PAID';

export type PoPaymentType = 'prepaid' | 'debt';

/** Crypto network the client's wallet address is on (USDT orders only). */
export type PoDeliveryNetwork = 'TRC20' | 'BEP20' | 'ERC20' | 'TON' | 'other';

/** Collection: po_orders. */
export interface PoOrder {
    id: string;
    /** Display-only code, e.g. "PD-4821". The Firestore doc id is the real key. */
    orderCode: string;
    operatorUid: string;
    /** Auth uid of the ordering client (authorization key). */
    clientUid: string;
    /** ClientDzd id, linked/confirmed by the admin. */
    clientId?: string;
    currencyId: string;
    quantity: number;
    /** Snapshotted at quote time — never recomputed from live tiers. */
    unitPriceDzd: number;
    totalDzd: number;
    pricingTierId?: string;
    quoteCreatedAt: number;
    quoteExpiresAt: number;
    status: PoOrderStatus;
    paymentType: PoPaymentType;
    paymentMethodId?: string;
    cashLocationId?: string;
    agentId?: string;
    proofUrl?: string;
    /** Where the admin must deliver the purchased currency — wallet address
     * (crypto) or bank/RIP details (EUR). Required at order creation. */
    deliveryAddress: string;
    /** Network of deliveryAddress, only meaningful for crypto currencies. */
    deliveryNetwork?: PoDeliveryNetwork;
    clientNote?: string;
    adminNote?: string;
    /** Set on admin completion → links to the generated ledger rows (idempotency). */
    linkedUsdtTxId?: string;
    linkedClientTxId?: string;
    createdAt: number;
    updatedAt: number;
}

export type PoCurrencyCode = 'USDT' | 'EUR';

/** Collection: po_currencies. Code matches real inventory (PRD "USD" → USDT). */
export interface PoCurrency {
    id: string;
    code: PoCurrencyCode;
    label: string;
    active: boolean;
    minOrder: number;
    maxOrder: number;
    /** Admin escape hatch; otherwise availability is derived from PortfolioStats. */
    manualAvailableOverride?: number | null;
    operatorUid: string;
}

/** Collection: po_pricing_tiers. */
export interface PoPricingTier {
    id: string;
    currencyId: string;
    minQty: number;
    maxQty: number;
    unitPriceDzd: number;
    requiresAdminApproval: boolean;
    active: boolean;
    operatorUid: string;
    pricingModelVersion?: string;
    pricingConfigRevision?: number;
    pricingPlanRevision?: number;
    publishedAt?: number;
    publishedBy?: string;
}

export type PoPaymentMethodType = 'baridimob' | 'cash' | 'bank_transfer' | 'other';

/** Collection: po_payment_methods. */
export interface PoPaymentMethod {
    id: string;
    type: PoPaymentMethodType;
    label: string;
    /** Serialized method-specific fields (RIP/CCP, beneficiary, bank details...). */
    detailsJson?: string;
    active: boolean;
    operatorUid: string;
}

/** Collection: po_cash_locations. */
export interface PoCashLocation {
    id: string;
    label: string;
    address?: string;
    agentId?: string;
    instructions?: string;
    active: boolean;
    operatorUid: string;
}

/** Collection: po_agent_confirmations. Agent confirm ≠ final; admin must confirm. */
export interface PoAgentConfirmation {
    id: string;
    orderId: string;
    agentUid: string;
    cashLocationId: string;
    amountDzd: number;
    confirmedByAdmin: boolean;
    notes?: string;
    createdAt: number;
}

export type PoAuditAction =
    | 'order_created'
    | 'proof_submitted'
    | 'agent_confirmed'
    | 'admin_approved_user'
    | 'admin_blocked_user'
    | 'admin_confirmed_payment'
    | 'admin_marked_delivered'
    | 'order_cancelled'
    | 'order_rejected'
    | 'debt_activated'
    | 'debt_paid'
    | 'catalog_generated';

/** Collection: po_audit_logs. Append-only (immutable). */
export interface PoAuditLog {
    id: string;
    action: PoAuditAction;
    actorUid: string;
    targetType: 'order' | 'user' | 'confirmation' | 'catalog';
    targetId: string;
    detailsJson?: string;
    createdAt: number;
}
