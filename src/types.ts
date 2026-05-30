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
    currency: 'USDT' | 'EUR';
    linkedTxId?: string;
    linkedClientId?: string;
    linkedClientDzdId?: string;
    clientPaymentStatus?: 'credit' | 'baridi' | 'cash';
    paymentMethod?: 'Espèces' | 'BaridiMob' | 'Crédit';
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
    paymentSource?: 'Caisse' | 'BaridiMob';
    linkedTreasuryTxId?: string;
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
    type: 'Règlement Reçu' | 'Paiement Effectué' | 'Vente USDT' | 'Vente EUR' | 'Achat EUR' | 'Solde Initial' | 'Transfert Entrant' | 'Transfert Sortant' | 'Ajustement Solde';
    notes?: string;
    /** Free-form labels for filtering (shared with Tx tags). */
    tags?: string[];
    linkedTxId?: string; // ID of the USDT/EUR transaction if applicable
    linkRole?: 'primary' | 'dzd_receiver';
    paymentMethod?: 'Espèces' | 'BaridiMob' | 'Crédit';
    affectsBalance?: boolean; // false = history-only row that should not alter client balance
    origin?: 'adjustment';
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
    linkedTreasuryTxId?: string; // For personal_expense_return: links back to original advance
    origin?: 'manual_asset' | 'client_tx' | 'usdt_tx' | 'balance_edit' | 'delivery_expense' | 'investor_profit_withdrawal' | 'personal_expense' | 'personal_expense_return'; // Source of the transaction
    linkedAssetTxId?: string; // Link back to actifTransactions
    // Personal expense imprest system (origin === 'personal_expense' only)
    advanceState?: 'pending' | 'settled';
    settledAmount?: number; // Actual amount spent after reconciliation
    linkedReturnTxId?: string; // ID of the return TreasuryTx created during reconciliation
}
export interface TreasuryCard {
    id: string;
    name: string;
    value: number;
    notes?: string;
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
    };
    eur: {
        purchasedQty: number;
        costBasis: number;
        avgBuy: number;
        totalProfit: number;
        available: number;
    };
}
