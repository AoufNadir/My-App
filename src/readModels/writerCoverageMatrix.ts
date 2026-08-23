import type { ReadModelName } from './dashboardReadModels';
import { READ_MODEL_APPLIED_OPS_PATH } from './readModelDeltas';

export type SummaryAtomicMechanism =
    | 'single_firestore_transaction'
    | 'single_firestore_batch_with_preallocated_refs'
    | 'requires_operation_index_before_write_mode'
    | 'dev_admin_only_block_before_read_mode';

export type DashboardSummaryField =
    | 'capitalSnapshot'
    | 'dailyOverview'
    | 'financialAudit'
    | 'money.caisseBalance'
    | 'money.baridiBalance'
    | 'money.liquidities'
    | 'money.treasuryCardsTotal'
    | 'money.clientReceivables'
    | 'money.clientAdvances'
    | 'money.serviceReceivables'
    | 'money.serviceAdvances'
    | 'money.investorCapital'
    | 'money.investorProfits'
    | 'money.investorLiability'
    | 'money.netOwnedCapital'
    | 'money.totalCapital'
    | 'portfolio.costValueDzd'
    | 'portfolio.positions'
    | 'portfolio.tradingProfit'
    | 'portfolio.soldQuantity'
    | 'clients.activeClientsToday'
    | 'clients.topOverdueClients'
    | 'investors.investorBreakdown'
    | 'investors.managerProfitBreakdown'
    | 'services'
    | 'recentOperations';

export type WriterCoverageRow = {
    id: string;
    writer: string;
    files: readonly string[];
    legacyWrites: readonly string[];
    domainSummaries: readonly ReadModelName[];
    dashboardFields: readonly DashboardSummaryField[];
    incrementalDelta: string;
    atomicMechanism: SummaryAtomicMechanism;
    idempotencyPath: typeof READ_MODEL_APPLIED_OPS_PATH;
    tests: readonly string[];
    risk?: string;
};

const DASHBOARD_SUMMARY = 'dashboard_summary' as const;
const FINANCIAL_SUMMARY = 'financial_summary' as const;

export const WRITER_COVERAGE_MATRIX: readonly WriterCoverageRow[] = [
    {
        id: 'portfolio.buy-cash',
        writer: 'Buy USDT/EUR funded by Caisse or BaridiMob',
        files: ['src/hooks/useTransactionHandlers.ts'],
        legacyWrites: ['usdt_txs buy', 'treasury_txs Retrait'],
        domainSummaries: [DASHBOARD_SUMMARY, 'portfolio_summary', 'treasury_summary', FINANCIAL_SUMMARY],
        dashboardFields: ['portfolio.positions', 'portfolio.costValueDzd', 'money.caisseBalance', 'money.baridiBalance', 'money.liquidities', 'money.totalCapital', 'money.netOwnedCapital', 'recentOperations'],
        incrementalDelta: 'currency quantity +, costBasis +, wallet -amount; no profit delta',
        atomicMechanism: 'single_firestore_transaction',
        idempotencyPath: READ_MODEL_APPLIED_OPS_PATH,
        tests: ['buy cash updates stock and wallet once', 'retry with same operationId is idempotent'],
    },
    {
        id: 'portfolio.buy-credit',
        writer: 'Buy USDT/EUR funded by client credit or collector client',
        files: ['src/hooks/useTransactionHandlers.ts'],
        legacyWrites: ['usdt_txs buy', 'dzd_client_txs Règlement/Ajustement'],
        domainSummaries: [DASHBOARD_SUMMARY, 'portfolio_summary', 'clients_summary', FINANCIAL_SUMMARY],
        dashboardFields: ['portfolio.positions', 'portfolio.costValueDzd', 'money.clientAdvances', 'money.clientReceivables', 'clients.activeClientsToday', 'money.totalCapital', 'money.netOwnedCapital', 'recentOperations'],
        incrementalDelta: 'currency quantity +, costBasis +, client balance transition; no cash and no profit',
        atomicMechanism: 'single_firestore_transaction',
        idempotencyPath: READ_MODEL_APPLIED_OPS_PATH,
        tests: ['credit purchase creates payable/advance delta', 'collector client balance transition is signed correctly'],
    },
    {
        id: 'portfolio.sell-cash',
        writer: 'Sell USDT/EUR paid cash or BaridiMob',
        files: ['src/hooks/useTransactionHandlers.ts'],
        legacyWrites: ['usdt_txs sell', 'treasury_txs Ajout'],
        domainSummaries: [DASHBOARD_SUMMARY, 'portfolio_summary', 'treasury_summary', 'investors_summary', FINANCIAL_SUMMARY],
        dashboardFields: ['portfolio.positions', 'portfolio.costValueDzd', 'portfolio.tradingProfit', 'portfolio.soldQuantity', 'dailyOverview', 'investors.managerProfitBreakdown', 'money.investorProfits', 'money.investorLiability', 'money.caisseBalance', 'money.baridiBalance', 'money.totalCapital', 'money.netOwnedCapital', 'recentOperations'],
        incrementalDelta: 'currency quantity -, sold costBasis -, wallet +revenue, realized profit allocated with historical fee/capital state',
        atomicMechanism: 'single_firestore_transaction',
        idempotencyPath: READ_MODEL_APPLIED_OPS_PATH,
        tests: ['sale cash updates realized profit periods', 'manager fee at effectiveAt is used by delta input'],
    },
    {
        id: 'portfolio.sell-credit',
        writer: 'Sell USDT/EUR on client credit or received by another client',
        files: ['src/hooks/useTransactionHandlers.ts'],
        legacyWrites: ['usdt_txs sell', 'dzd_client_txs Vente/Paiement receiver'],
        domainSummaries: [DASHBOARD_SUMMARY, 'portfolio_summary', 'clients_summary', 'investors_summary', FINANCIAL_SUMMARY],
        dashboardFields: ['portfolio.positions', 'portfolio.costValueDzd', 'portfolio.tradingProfit', 'portfolio.soldQuantity', 'dailyOverview', 'money.clientReceivables', 'money.clientAdvances', 'clients.activeClientsToday', 'clients.topOverdueClients', 'investors.managerProfitBreakdown', 'money.investorProfits', 'money.investorLiability', 'recentOperations'],
        incrementalDelta: 'sold quantity/cost/profit + signed client balance transition; no cash delta',
        atomicMechanism: 'single_firestore_transaction',
        idempotencyPath: READ_MODEL_APPLIED_OPS_PATH,
        tests: ['credit sale increases receivables', 'receiver client transfer does not change cash'],
    },
    {
        id: 'portfolio.exchange',
        writer: 'USDT ↔ EUR exchange',
        files: ['src/hooks/useTransactionHandlers.ts'],
        legacyWrites: ['paired usdt_txs rows'],
        domainSummaries: [DASHBOARD_SUMMARY, 'portfolio_summary', FINANCIAL_SUMMARY],
        dashboardFields: ['portfolio.positions', 'portfolio.costValueDzd', 'money.totalCapital', 'money.netOwnedCapital', 'recentOperations'],
        incrementalDelta: 'source quantity/costBasis removed by PAM, target quantity/costBasis added by exchangeValueDzd; no trading profit',
        atomicMechanism: 'single_firestore_transaction',
        idempotencyPath: READ_MODEL_APPLIED_OPS_PATH,
        tests: ['exchange preserves economic value within tolerance', 'no realized profit is added'],
    },
    {
        id: 'portfolio.manual-adjustment',
        writer: 'Portfolio manual add/remove and balance edit',
        files: ['src/hooks/useTransactionHandlers.ts', 'src/MainApp.tsx'],
        legacyWrites: ['usdt_txs Ajout Manuel/Retrait Manuel'],
        domainSummaries: [DASHBOARD_SUMMARY, 'portfolio_summary', FINANCIAL_SUMMARY],
        dashboardFields: ['portfolio.positions', 'portfolio.costValueDzd', 'money.totalCapital', 'money.netOwnedCapital', 'recentOperations'],
        incrementalDelta: 'manual add: quantity/cost +; manual remove: quantity/cost - by PAM; no trading profit',
        atomicMechanism: 'single_firestore_transaction',
        idempotencyPath: READ_MODEL_APPLIED_OPS_PATH,
        tests: ['manual add with value updates cost', 'manual removal closes cost basis to zero'],
    },
    {
        id: 'treasury.adjustment',
        writer: 'Treasury ajout/retrait and balance correction',
        files: ['src/hooks/useTransactionHandlers.ts', 'src/MainApp.tsx'],
        legacyWrites: ['treasury_txs Ajout/Retrait'],
        domainSummaries: [DASHBOARD_SUMMARY, 'treasury_summary', FINANCIAL_SUMMARY],
        dashboardFields: ['money.caisseBalance', 'money.baridiBalance', 'money.liquidities', 'money.totalCapital', 'money.netOwnedCapital', 'recentOperations'],
        incrementalDelta: 'wallet +/- amount; balance correction remains equity/correction semantics and is never auto-classified as income/expense',
        atomicMechanism: 'single_firestore_transaction',
        idempotencyPath: READ_MODEL_APPLIED_OPS_PATH,
        tests: ['treasury add/retrait moves cash only', 'balance correction does not change profit'],
    },
    {
        id: 'treasury.transfer',
        writer: 'Internal transfer Caisse ↔ BaridiMob',
        files: ['src/MainApp.tsx'],
        legacyWrites: ['treasury_txs Transfer'],
        domainSummaries: [DASHBOARD_SUMMARY, 'treasury_summary'],
        dashboardFields: ['money.caisseBalance', 'money.baridiBalance', 'money.liquidities', 'recentOperations'],
        incrementalDelta: 'source wallet -amount, destination wallet +amount; cashTotal unchanged',
        atomicMechanism: 'single_firestore_transaction',
        idempotencyPath: READ_MODEL_APPLIED_OPS_PATH,
        tests: ['transfer preserves total liquidities'],
    },
    {
        id: 'treasury.cards',
        writer: 'Treasury card add/update/delete',
        files: ['src/MainApp.tsx'],
        legacyWrites: ['treasury_cards add/update/delete'],
        domainSummaries: [DASHBOARD_SUMMARY, 'treasury_summary', FINANCIAL_SUMMARY],
        dashboardFields: ['money.treasuryCardsTotal', 'money.totalCapital', 'money.netOwnedCapital'],
        incrementalDelta: 'treasuryCardsTotal += newValue - oldValue',
        atomicMechanism: 'single_firestore_transaction',
        idempotencyPath: READ_MODEL_APPLIED_OPS_PATH,
        tests: ['card add/update/delete applies value delta'],
    },
    {
        id: 'clients.settlement',
        writer: 'Client encaissement/décaissement cash, BaridiMob or credit',
        files: ['src/hooks/useClientHandlers.ts'],
        legacyWrites: ['dzd_client_txs', 'optional treasury_txs'],
        domainSummaries: [DASHBOARD_SUMMARY, 'clients_summary', 'treasury_summary', FINANCIAL_SUMMARY],
        dashboardFields: ['money.clientReceivables', 'money.clientAdvances', 'clients.activeClientsToday', 'clients.topOverdueClients', 'money.caisseBalance', 'money.baridiBalance', 'money.totalCapital', 'money.netOwnedCapital', 'recentOperations'],
        incrementalDelta: 'client balance before/after transition plus optional wallet delta',
        atomicMechanism: 'single_firestore_transaction',
        idempotencyPath: READ_MODEL_APPLIED_OPS_PATH,
        tests: ['encaissement reduces receivable and adds cash', 'décaissement reduces advance/payable and removes cash'],
    },
    {
        id: 'clients.transfer',
        writer: 'Client-to-client receivable/advance transfer',
        files: ['src/hooks/useClientHandlers.ts', 'src/hooks/useTransactionHandlers.ts'],
        legacyWrites: ['paired dzd_client_txs Transfert Sortant/Entrant'],
        domainSummaries: [DASHBOARD_SUMMARY, 'clients_summary', FINANCIAL_SUMMARY],
        dashboardFields: ['money.clientReceivables', 'money.clientAdvances', 'clients.topOverdueClients', 'recentOperations'],
        incrementalDelta: 'two client balance transitions; project net position unchanged except rounding',
        atomicMechanism: 'single_firestore_transaction',
        idempotencyPath: READ_MODEL_APPLIED_OPS_PATH,
        tests: ['paired transfer leaves aggregate unchanged when appropriate', 'same client is rejected by writer before delta'],
    },
    {
        id: 'clients.initial-adjustment-remise',
        writer: 'Client initial balance, manual adjustment, remise solde',
        files: ['src/hooks/useClientHandlers.ts', 'src/MainApp.tsx'],
        legacyWrites: ['dzd_client_txs Solde Initial/Ajustement/Remise solde'],
        domainSummaries: [DASHBOARD_SUMMARY, 'clients_summary', FINANCIAL_SUMMARY],
        dashboardFields: ['money.clientReceivables', 'money.clientAdvances', 'clients.activeClientsToday', 'clients.topOverdueClients', 'money.totalCapital', 'money.netOwnedCapital', 'recentOperations'],
        incrementalDelta: 'client balance transition; write-off/cancellation counterpart remains explicit in writer facts',
        atomicMechanism: 'single_firestore_transaction',
        idempotencyPath: READ_MODEL_APPLIED_OPS_PATH,
        tests: ['initial debt creates receivable', 'remise clears receivable or advance without cash'],
    },
    {
        id: 'investors.capital',
        writer: 'Investor initial capital, top-up and withdrawal',
        files: ['src/hooks/useInvestorHandlers.ts'],
        legacyWrites: ['investors', 'investor_transactions deposit/withdraw_capital', 'optional treasury_txs'],
        domainSummaries: [DASHBOARD_SUMMARY, 'investors_summary', 'treasury_summary', FINANCIAL_SUMMARY],
        dashboardFields: ['money.investorCapital', 'money.investorLiability', 'investors.investorBreakdown', 'money.caisseBalance', 'money.baridiBalance', 'money.totalCapital', 'money.netOwnedCapital', 'recentOperations'],
        incrementalDelta: 'external investor capital +/- amount; optional wallet +/- amount; no profit allocation rewrite',
        atomicMechanism: 'single_firestore_transaction',
        idempotencyPath: READ_MODEL_APPLIED_OPS_PATH,
        tests: ['top-up changes only future capital state', 'withdraw capital decreases liability and cash'],
    },
    {
        id: 'investors.profit-payout',
        writer: 'Investor profit payout and group distribution',
        files: ['src/hooks/useInvestorHandlers.ts', 'src/components/investors/ProfitDistributionSheet.tsx'],
        legacyWrites: ['investor_transactions withdraw_profit', 'treasury_txs Retrait'],
        domainSummaries: [DASHBOARD_SUMMARY, 'investors_summary', 'treasury_summary', FINANCIAL_SUMMARY],
        dashboardFields: ['money.investorProfits', 'money.investorLiability', 'investors.investorBreakdown', 'money.caisseBalance', 'money.baridiBalance', 'money.totalCapital', 'money.netOwnedCapital', 'recentOperations'],
        incrementalDelta: 'available profit liability -amount, wallet -amount; total historical profit unchanged',
        atomicMechanism: 'single_firestore_transaction',
        idempotencyPath: READ_MODEL_APPLIED_OPS_PATH,
        tests: ['partial payout preserves total profit concept', 'group payout applies each row once'],
    },
    {
        id: 'investors.reinvest-profit',
        writer: 'Investor reinvest profit',
        files: ['src/hooks/useInvestorHandlers.ts'],
        legacyWrites: ['investor_transactions reinvest_profit'],
        domainSummaries: [DASHBOARD_SUMMARY, 'investors_summary', FINANCIAL_SUMMARY],
        dashboardFields: ['money.investorCapital', 'money.investorProfits', 'money.investorLiability', 'investors.investorBreakdown', 'recentOperations'],
        incrementalDelta: 'capital +amount, available profit -amount, no cash movement and no liability double count',
        atomicMechanism: 'single_firestore_transaction',
        idempotencyPath: READ_MODEL_APPLIED_OPS_PATH,
        tests: ['reinvestment cannot exceed available profit', 'liability total remains stable'],
    },
    {
        id: 'investors.personal-expenses',
        writer: 'Manager personal advances, expenses and advance reconciliation',
        files: ['src/hooks/useInvestorHandlers.ts'],
        legacyWrites: ['treasury_txs personal_expense/return', 'investor_transactions linked rows', 'optional usdt_txs'],
        domainSummaries: [DASHBOARD_SUMMARY, 'investors_summary', 'treasury_summary', 'portfolio_summary', FINANCIAL_SUMMARY],
        dashboardFields: ['financialAudit', 'investors.managerProfitBreakdown', 'money.caisseBalance', 'money.baridiBalance', 'portfolio.positions', 'portfolio.costValueDzd', 'money.totalCapital', 'money.netOwnedCapital', 'recentOperations'],
        incrementalDelta: 'pending advance, settled expense, capital/profit funding split, optional return wallet/asset delta',
        atomicMechanism: 'single_firestore_transaction',
        idempotencyPath: READ_MODEL_APPLIED_OPS_PATH,
        tests: ['advance pending does not consume profit', 'reconcile return and spent amount are split once'],
    },
    {
        id: 'project.delivery-expense',
        writer: 'Delivery/project expense from cash or asset',
        files: ['src/hooks/useTransactionHandlers.ts'],
        legacyWrites: ['treasury_txs Retrait or usdt_txs Retrait Manuel'],
        domainSummaries: [DASHBOARD_SUMMARY, 'treasury_summary', 'portfolio_summary', 'investors_summary', FINANCIAL_SUMMARY],
        dashboardFields: ['financialAudit', 'money.caisseBalance', 'money.baridiBalance', 'portfolio.positions', 'portfolio.costValueDzd', 'investors.managerProfitBreakdown', 'money.investorProfits', 'money.investorLiability', 'money.totalCapital', 'money.netOwnedCapital', 'recentOperations'],
        incrementalDelta: 'wallet/asset decrease plus profit allocation expense burden using historical state at effectiveAt',
        atomicMechanism: 'single_firestore_transaction',
        idempotencyPath: READ_MODEL_APPLIED_OPS_PATH,
        tests: ['delivery expense keeps historical manager fee burden', 'asset expense removes cost basis without trading profit'],
    },
    {
        id: 'services.digital',
        writer: 'Digital service sale',
        files: ['src/hooks/useDigitalServiceHandlers.ts'],
        legacyWrites: ['digital_service_txs', 'linked treasury/usdt/client rows'],
        domainSummaries: [DASHBOARD_SUMMARY, 'services_summary', 'treasury_summary', 'portfolio_summary', 'clients_summary', 'investors_summary', FINANCIAL_SUMMARY],
        dashboardFields: ['services', 'money.serviceReceivables', 'money.serviceAdvances', 'money.clientReceivables', 'money.caisseBalance', 'money.baridiBalance', 'portfolio.positions', 'portfolio.costValueDzd', 'investors.managerProfitBreakdown', 'dailyOverview', 'money.totalCapital', 'money.netOwnedCapital', 'recentOperations'],
        incrementalDelta: 'service revenue/cost/profit plus payment side; service profit separate from FX gain/loss',
        atomicMechanism: 'single_firestore_transaction',
        idempotencyPath: READ_MODEL_APPLIED_OPS_PATH,
        tests: ['cash digital service updates service profit and cash', 'credit digital service updates receivable without cash'],
    },
    {
        id: 'services.manual-assets',
        writer: 'Manual asset/service transactions',
        files: ['src/hooks/useAssetHandlers.ts', 'src/MainApp.tsx'],
        legacyWrites: ['actifTransactions', 'optional treasury_txs'],
        domainSummaries: [DASHBOARD_SUMMARY, 'services_summary', 'treasury_summary', FINANCIAL_SUMMARY],
        dashboardFields: ['services', 'money.serviceReceivables', 'money.serviceAdvances', 'money.caisseBalance', 'money.baridiBalance', 'money.totalCapital', 'money.netOwnedCapital', 'recentOperations'],
        incrementalDelta: 'asset-client balance transition plus optional payment wallet delta',
        atomicMechanism: 'single_firestore_transaction',
        idempotencyPath: READ_MODEL_APPLIED_OPS_PATH,
        tests: ['manual service increases service receivable/revenue', 'payment received lowers receivable and adds cash'],
    },
    {
        id: 'orders.complete-order',
        writer: 'PO order completion that delivers USDT/EUR',
        files: ['src/hooks/usePoOrderHandlers.ts'],
        legacyWrites: ['po_orders update', 'usdt_txs sell', 'optional treasury_txs', 'optional dzd_client_txs'],
        domainSummaries: [DASHBOARD_SUMMARY, 'portfolio_summary', 'treasury_summary', 'clients_summary', 'investors_summary', FINANCIAL_SUMMARY],
        dashboardFields: ['portfolio.positions', 'portfolio.costValueDzd', 'portfolio.tradingProfit', 'dailyOverview', 'money.caisseBalance', 'money.baridiBalance', 'money.clientReceivables', 'clients.activeClientsToday', 'money.investorProfits', 'money.investorLiability', 'money.totalCapital', 'money.netOwnedCapital', 'recentOperations'],
        incrementalDelta: 'same as portfolio sale; prepaid creates cash delta, credit creates receivable delta',
        atomicMechanism: 'single_firestore_transaction',
        idempotencyPath: READ_MODEL_APPLIED_OPS_PATH,
        tests: ['PO prepaid is cash sale', 'PO credit is receivable sale', 'linkedUsdtTxId guard is transactional'],
        risk: 'Current guard is checked before batch; must be moved inside a transaction before write mode.',
    },
    {
        id: 'legacy.edit-delete',
        writer: 'Current legacy edit/delete of existing financial rows',
        files: ['src/transactionService.ts', 'src/MainApp.tsx', 'src/hooks/useDigitalServiceHandlers.ts', 'src/hooks/useInvestorHandlers.ts'],
        legacyWrites: ['delete/update main and linked legacy rows'],
        domainSummaries: [DASHBOARD_SUMMARY, 'portfolio_summary', 'treasury_summary', 'clients_summary', 'investors_summary', 'services_summary', FINANCIAL_SUMMARY],
        dashboardFields: ['capitalSnapshot', 'dailyOverview', 'financialAudit', 'portfolio.positions', 'money.caisseBalance', 'money.baridiBalance', 'money.clientReceivables', 'money.clientAdvances', 'money.investorLiability', 'services', 'recentOperations'],
        incrementalDelta: 'inverse old operation projection plus corrected new operation projection; never linked-query dependent in write mode',
        atomicMechanism: 'requires_operation_index_before_write_mode',
        idempotencyPath: READ_MODEL_APPLIED_OPS_PATH,
        tests: ['delete uses operation index not linked query', 'edit applies inverse old plus new once'],
        risk: 'Current Legacy paths discover linked rows with queries. Read-model writes must wait for deterministic ids or operation index.',
    },
    {
        id: 'entity.archive-only',
        writer: 'Client/Investor/Asset deletion after read-model mode',
        files: ['src/hooks/useClientHandlers.ts', 'src/hooks/useInvestorHandlers.ts', 'src/hooks/useAssetHandlers.ts'],
        legacyWrites: ['currently deletes entities and sometimes linked history'],
        domainSummaries: [DASHBOARD_SUMMARY, 'clients_summary', 'investors_summary', 'services_summary'],
        dashboardFields: ['clients.topOverdueClients', 'investors.investorBreakdown', 'services'],
        incrementalDelta: 'archive/inactive flag only; no historical financial delta',
        atomicMechanism: 'requires_operation_index_before_write_mode',
        idempotencyPath: READ_MODEL_APPLIED_OPS_PATH,
        tests: ['entity archive does not alter financial history'],
        risk: 'Current delete paths can remove history. They must be converted to archive-only before read mode.',
    },
    {
        id: 'main.global-reset',
        writer: 'Global reset',
        files: ['src/MainApp.tsx'],
        legacyWrites: ['bulk deletes across financial collections'],
        domainSummaries: [],
        dashboardFields: [],
        incrementalDelta: 'not supported as financial operation',
        atomicMechanism: 'dev_admin_only_block_before_read_mode',
        idempotencyPath: READ_MODEL_APPLIED_OPS_PATH,
        tests: ['reset is unavailable after read model mode'],
        risk: 'Must remain dev/admin-only before production read-mode.',
    },
];

export const WRITER_COVERAGE_NON_ATOMIC_RISKS = WRITER_COVERAGE_MATRIX.filter(
    (row) => row.atomicMechanism === 'requires_operation_index_before_write_mode'
        || row.atomicMechanism === 'dev_admin_only_block_before_read_mode'
);

export function findWriterCoverageById(id: string): WriterCoverageRow | undefined {
    return WRITER_COVERAGE_MATRIX.find((row) => row.id === id);
}
