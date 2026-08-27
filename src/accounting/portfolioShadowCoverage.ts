import type { PortfolioShadowKind } from './portfolioShadow';

export type PortfolioShadowV2Policy = 'shadow_observed' | 'prepared_no_legacy_writer' | 'lifecycle_prepared' | 'dev_admin_only_pre_cutover';

/** Readiness tracking only. It never enables a V2 writer or a global closure. */
export const PORTFOLIO_V2_READINESS = 'ready' as const;

export type PortfolioShadowWriter = {
    id: string;
    file: string;
    legacyWrite: string;
    shadowKinds: PortfolioShadowKind[];
    v2Policy: PortfolioShadowV2Policy;
};

/**
 * Inventory of every known USDT/EUR writer. `prepared_no_legacy_writer` is
 * intentional: it prevents a future writer from silently bypassing V2 while
 * accurately stating that no present Legacy path exists to observe.
 */
export const PORTFOLIO_SHADOW_WRITERS: readonly PortfolioShadowWriter[] = [
    { id: 'portfolio.currency-buy-cash', file: 'src/hooks/useTransactionHandlers.ts', legacyWrite: 'usdt_txs buy + treasury_txs Retrait', shadowKinds: ['portfolio_purchase_cash'], v2Policy: 'shadow_observed' },
    { id: 'portfolio.currency-buy-credit', file: 'src/hooks/useTransactionHandlers.ts', legacyWrite: 'usdt_txs buy + dzd_client_txs payable', shadowKinds: ['portfolio_purchase_credit'], v2Policy: 'shadow_observed' },
    { id: 'portfolio.currency-sell-cash', file: 'src/hooks/useTransactionHandlers.ts', legacyWrite: 'usdt_txs sell + treasury_txs Ajout', shadowKinds: ['portfolio_sale_cash'], v2Policy: 'shadow_observed' },
    { id: 'portfolio.currency-sell-credit', file: 'src/hooks/useTransactionHandlers.ts', legacyWrite: 'usdt_txs sell + dzd_client_txs receivable', shadowKinds: ['portfolio_sale_credit'], v2Policy: 'shadow_observed' },
    { id: 'portfolio.exchange-eur-to-usdt', file: 'src/hooks/useTransactionHandlers.ts', legacyWrite: 'EUR Retrait Manuel + USDT buy', shadowKinds: ['portfolio_exchange_eur_to_usdt'], v2Policy: 'shadow_observed' },
    { id: 'portfolio.exchange-usdt-to-eur', file: 'src/hooks/useTransactionHandlers.ts', legacyWrite: 'USDT sell + EUR buy', shadowKinds: ['portfolio_exchange_usdt_to_eur'], v2Policy: 'shadow_observed' },
    { id: 'portfolio.manual-adjustment', file: 'src/hooks/useTransactionHandlers.ts', legacyWrite: 'usdt_txs Ajout/Retrait Manuel', shadowKinds: ['portfolio_manual_add', 'portfolio_manual_remove'], v2Policy: 'shadow_observed' },
    { id: 'portfolio.balance-edit', file: 'src/MainApp.tsx', legacyWrite: 'usdt_txs Ajout/Retrait Manuel', shadowKinds: ['portfolio_manual_add', 'portfolio_manual_remove'], v2Policy: 'shadow_observed' },
    { id: 'portfolio.project-expense-asset', file: 'src/hooks/useTransactionHandlers.ts', legacyWrite: 'usdt_txs Retrait Manuel', shadowKinds: ['portfolio_project_expense_asset'], v2Policy: 'shadow_observed' },
    { id: 'portfolio.personal-expense-asset', file: 'src/hooks/useInvestorHandlers.ts', legacyWrite: 'usdt_txs Retrait Manuel', shadowKinds: ['portfolio_personal_advance_asset', 'portfolio_personal_expense_asset', 'portfolio_personal_advance_return_asset'], v2Policy: 'shadow_observed' },
    { id: 'portfolio.digital-service-asset', file: 'src/hooks/useDigitalServiceHandlers.ts', legacyWrite: 'usdt_txs Retrait/Ajout Manuel', shadowKinds: ['portfolio_digital_service_purchase_asset', 'portfolio_digital_service_sale_asset'], v2Policy: 'shadow_observed' },
    { id: 'portfolio.purchase-order-completion', file: 'src/hooks/usePoOrderHandlers.ts', legacyWrite: 'usdt_txs sell + treasury/client settlement', shadowKinds: ['portfolio_order_sale_cash', 'portfolio_order_sale_credit'], v2Policy: 'shadow_observed' },
    { id: 'portfolio.transaction-lifecycle', file: 'src/transactionService.ts', legacyWrite: 'legacy delete/update linked transaction recreation', shadowKinds: [], v2Policy: 'lifecycle_prepared' },
    { id: 'portfolio.same-currency-transfer', file: 'not-yet-present', legacyWrite: 'no Legacy writer exists', shadowKinds: ['portfolio_asset_transfer'], v2Policy: 'prepared_no_legacy_writer' },
    { id: 'portfolio.trading-fees', file: 'not-yet-present', legacyWrite: 'no Legacy writer exists', shadowKinds: ['portfolio_fee_cash', 'portfolio_fee_asset'], v2Policy: 'prepared_no_legacy_writer' },
    { id: 'main.global-reset', file: 'src/MainApp.tsx', legacyWrite: 'bulk delete across financial collections', shadowKinds: [], v2Policy: 'dev_admin_only_pre_cutover' },
];

export const PORTFOLIO_SHADOW_KINDS = new Set(
    PORTFOLIO_SHADOW_WRITERS.flatMap((writer) => writer.shadowKinds),
);
