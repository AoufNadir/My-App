import type { TreasuryShadowKind } from './treasuryShadow';

export type TreasuryShadowV2Policy =
    | 'financial_transaction'
    | 'archive_entity'
    | 'dev_admin_only_pre_cutover';

export type TreasuryShadowWriter = {
    id: string;
    file: string;
    legacyWrite: string;
    shadowKinds: TreasuryShadowKind[];
    v2Policy: TreasuryShadowV2Policy;
};

export const FINANCIAL_TRANSACTION_V2_POLICY: TreasuryShadowV2Policy = 'financial_transaction';

/** A reset is an administrative development tool, never a V2 financial reversal. */
export const GLOBAL_RESET_V2_POLICY: TreasuryShadowV2Policy = 'dev_admin_only_pre_cutover';

/** A completed PO is a customer sale; cash exists only for an already-paid order. */
export const PO_ORDER_CASH_FLOW = 'customer_sale_receipt_only_when_prepaid' as const;

/**
 * Complete current inventory of paths that can change Caisse or BaridiMob.
 * Entity removal is listed separately so V2 can archive it without inventing
 * a financial reversal. This inventory is code-owned and regression-tested
 * before any global V2 cutover.
 */
export const TREASURY_SHADOW_WRITERS: readonly TreasuryShadowWriter[] = [
    { id: 'main.treasury-balance-edit', file: 'src/MainApp.tsx', legacyWrite: 'treasury_txs add/update/delete', shadowKinds: ['treasury_adjustment_in', 'treasury_adjustment_out'], v2Policy: FINANCIAL_TRANSACTION_V2_POLICY },
    { id: 'main.wallet-transfer', file: 'src/MainApp.tsx', legacyWrite: 'treasury_txs add/update', shadowKinds: ['treasury_transfer'], v2Policy: FINANCIAL_TRANSACTION_V2_POLICY },
    { id: 'main.manual-asset-transaction', file: 'src/MainApp.tsx', legacyWrite: 'linked treasury_txs set/update/delete', shadowKinds: ['manual_asset_receipt_cash', 'manual_asset_payout_cash'], v2Policy: FINANCIAL_TRANSACTION_V2_POLICY },
    { id: 'main.investor-linked-transaction-delete', file: 'src/MainApp.tsx', legacyWrite: 'linked treasury_txs delete', shadowKinds: ['investor_capital_withdrawal_cash', 'investor_profit_withdrawal_cash'], v2Policy: FINANCIAL_TRANSACTION_V2_POLICY },
    {
        id: 'main.global-reset',
        file: 'src/MainApp.tsx',
        legacyWrite: 'bulk delete across financial collections',
        shadowKinds: [],
        v2Policy: GLOBAL_RESET_V2_POLICY,
    },
    { id: 'portfolio.buy-cash', file: 'src/hooks/useTransactionHandlers.ts', legacyWrite: 'treasury_txs Retrait', shadowKinds: ['portfolio_purchase_cash'], v2Policy: FINANCIAL_TRANSACTION_V2_POLICY },
    { id: 'portfolio.sell-cash', file: 'src/hooks/useTransactionHandlers.ts', legacyWrite: 'treasury_txs Ajout', shadowKinds: ['portfolio_sale_cash'], v2Policy: FINANCIAL_TRANSACTION_V2_POLICY },
    { id: 'treasury.manual-adjustment', file: 'src/hooks/useTransactionHandlers.ts', legacyWrite: 'treasury_txs Ajout/Retrait', shadowKinds: ['treasury_adjustment_in', 'treasury_adjustment_out'], v2Policy: FINANCIAL_TRANSACTION_V2_POLICY },
    { id: 'treasury.project-expense', file: 'src/hooks/useTransactionHandlers.ts', legacyWrite: 'treasury_txs Retrait', shadowKinds: ['project_expense_cash'], v2Policy: FINANCIAL_TRANSACTION_V2_POLICY },
    { id: 'clients.cash-settlement', file: 'src/hooks/useClientHandlers.ts', legacyWrite: 'treasury_txs Ajout/Retrait', shadowKinds: ['client_receipt_cash', 'client_payout_cash'], v2Policy: FINANCIAL_TRANSACTION_V2_POLICY },
    { id: 'investors.personal-expense', file: 'src/hooks/useInvestorHandlers.ts', legacyWrite: 'treasury_txs Retrait', shadowKinds: ['personal_advance_cash', 'personal_expense_cash'], v2Policy: FINANCIAL_TRANSACTION_V2_POLICY },
    { id: 'investors.personal-advance-return', file: 'src/hooks/useInvestorHandlers.ts', legacyWrite: 'treasury_txs Ajout', shadowKinds: ['personal_advance_return_cash'], v2Policy: FINANCIAL_TRANSACTION_V2_POLICY },
    { id: 'investors.capital-profit-movements', file: 'src/hooks/useInvestorHandlers.ts', legacyWrite: 'treasury_txs Ajout/Retrait', shadowKinds: ['investor_capital_deposit_cash', 'investor_capital_withdrawal_cash', 'investor_profit_withdrawal_cash'], v2Policy: FINANCIAL_TRANSACTION_V2_POLICY },
    { id: 'investors.group-profit-distribution', file: 'src/components/investors/ProfitDistributionSheet.tsx', legacyWrite: 'treasury_txs Retrait', shadowKinds: ['investor_profit_withdrawal_cash'], v2Policy: FINANCIAL_TRANSACTION_V2_POLICY },
    { id: 'services.digital-service', file: 'src/hooks/useDigitalServiceHandlers.ts', legacyWrite: 'treasury_txs Ajout/Retrait/delete', shadowKinds: ['digital_service_purchase_cash', 'digital_service_sale_cash'], v2Policy: FINANCIAL_TRANSACTION_V2_POLICY },
    { id: 'assets.manual-asset-transaction', file: 'src/hooks/useAssetHandlers.ts', legacyWrite: 'treasury_txs Ajout/Retrait/delete', shadowKinds: ['manual_asset_receipt_cash', 'manual_asset_payout_cash'], v2Policy: FINANCIAL_TRANSACTION_V2_POLICY },
    { id: 'orders.complete-order', file: 'src/hooks/usePoOrderHandlers.ts', legacyWrite: 'prepaid treasury_txs Ajout only', shadowKinds: ['po_order_sale_receipt_cash'], v2Policy: FINANCIAL_TRANSACTION_V2_POLICY },
    { id: 'shared.transaction-lifecycle', file: 'src/transactionService.ts', legacyWrite: 'linked treasury_txs recreate/delete', shadowKinds: ['portfolio_purchase_cash', 'portfolio_sale_cash'], v2Policy: FINANCIAL_TRANSACTION_V2_POLICY },
    {
        id: 'clients.entity-delete',
        file: 'src/hooks/useClientHandlers.ts',
        legacyWrite: 'client and linked-history delete',
        shadowKinds: [],
        v2Policy: 'archive_entity',
    },
    {
        id: 'investors.entity-delete',
        file: 'src/hooks/useInvestorHandlers.ts',
        legacyWrite: 'investor and linked-history delete',
        shadowKinds: [],
        v2Policy: 'archive_entity',
    },
    {
        id: 'assets.entity-delete',
        file: 'src/hooks/useAssetHandlers.ts',
        legacyWrite: 'manual asset client and linked-history delete',
        shadowKinds: [],
        v2Policy: 'archive_entity',
    },
];

export const TREASURY_SHADOW_KINDS = new Set(
    TREASURY_SHADOW_WRITERS.flatMap((writer) => writer.shadowKinds),
);
