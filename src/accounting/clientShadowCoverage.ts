import type { ClientShadowKind } from './clientShadow';

export type ClientShadowV2Policy = 'shadow_observed' | 'lifecycle_prepared' | 'archive_entity' | 'dev_admin_only_pre_cutover';

/** Tracking only. This never enables a V2 writer, a closure, or a Rule. */
export const CLIENTS_V2_READINESS = 'shadow' as const;

export type ClientShadowWriter = {
    id: string;
    file: string;
    legacyWrite: string;
    shadowKinds: ClientShadowKind[];
    v2Policy: ClientShadowV2Policy;
};

/** Every current writer that changes client balances or client-linked financial history. */
export const CLIENT_SHADOW_WRITERS: readonly ClientShadowWriter[] = [
    { id: 'clients.client-create-initial-balance', file: 'src/hooks/useClientHandlers.ts', legacyWrite: 'dzd_client_txs Solde Initial', shadowKinds: ['client_initial_balance'], v2Policy: 'shadow_observed' },
    { id: 'clients.client-balance-adjustment', file: 'src/hooks/useClientHandlers.ts', legacyWrite: 'dzd_client_txs Ajustement Solde', shadowKinds: ['client_balance_adjustment'], v2Policy: 'shadow_observed' },
    { id: 'clients.manual-cash-settlement', file: 'src/hooks/useClientHandlers.ts', legacyWrite: 'dzd_client_txs + linked treasury_txs', shadowKinds: ['client_cash_receipt', 'client_cash_payout'], v2Policy: 'shadow_observed' },
    { id: 'clients.manual-receiver-transfer', file: 'src/hooks/useClientHandlers.ts', legacyWrite: 'paired Transfert Sortant/Entrant', shadowKinds: ['client_receivable_transfer', 'client_advance_transfer'], v2Policy: 'shadow_observed' },
    { id: 'clients.zero-out-balance', file: 'src/hooks/useClientHandlers.ts', legacyWrite: 'dzd_client_txs Remise solde', shadowKinds: ['client_write_off_receivable', 'client_advance_cancellation'], v2Policy: 'shadow_observed' },
    { id: 'transactions.currency-buy-client', file: 'src/hooks/useTransactionHandlers.ts', legacyWrite: 'linked client credit purchase/collector row', shadowKinds: ['client_credit_purchase', 'client_balance_adjustment'], v2Policy: 'shadow_observed' },
    { id: 'transactions.currency-sell-client', file: 'src/hooks/useTransactionHandlers.ts', legacyWrite: 'linked client credit sale/collector row', shadowKinds: ['client_credit_sale'], v2Policy: 'shadow_observed' },
    { id: 'transactions.dzd-adjustment-client', file: 'src/hooks/useTransactionHandlers.ts', legacyWrite: 'linked client Règlement/Paiement + treasury adjustment', shadowKinds: ['client_cash_receipt', 'client_cash_payout'], v2Policy: 'shadow_observed' },
    { id: 'transactions.client-transfer', file: 'src/hooks/useTransactionHandlers.ts', legacyWrite: 'paired Transfert Sortant/Entrant', shadowKinds: ['client_advance_transfer'], v2Policy: 'shadow_observed' },
    { id: 'services.digital-service-client', file: 'src/hooks/useDigitalServiceHandlers.ts', legacyWrite: 'dzd_client_txs Vente service numérique', shadowKinds: ['client_service_credit_sale'], v2Policy: 'shadow_observed' },
    { id: 'orders.complete-order-client', file: 'src/hooks/usePoOrderHandlers.ts', legacyWrite: 'dzd_client_txs Vente USDT/EUR', shadowKinds: ['client_order_credit_sale'], v2Policy: 'shadow_observed' },
    { id: 'main.csv-client-import', file: 'src/MainApp.tsx', legacyWrite: 'dzd_client_txs Solde Initial', shadowKinds: ['client_initial_balance'], v2Policy: 'shadow_observed' },
    { id: 'main.client-transfer-delete', file: 'src/MainApp.tsx', legacyWrite: 'paired transfer delete', shadowKinds: [], v2Policy: 'lifecycle_prepared' },
    { id: 'shared.transaction-lifecycle', file: 'src/transactionService.ts', legacyWrite: 'legacy delete/update linked client transaction', shadowKinds: [], v2Policy: 'lifecycle_prepared' },
    { id: 'clients.entity-delete', file: 'src/hooks/useClientHandlers.ts', legacyWrite: 'client and history delete', shadowKinds: [], v2Policy: 'archive_entity' },
    { id: 'main.global-reset', file: 'src/MainApp.tsx', legacyWrite: 'bulk delete across financial collections', shadowKinds: [], v2Policy: 'dev_admin_only_pre_cutover' },
];

export const CLIENT_SHADOW_KINDS = new Set(CLIENT_SHADOW_WRITERS.flatMap((writer) => writer.shadowKinds));
