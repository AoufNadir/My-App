import React, { Suspense, startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Tx, ClientDzd, ClientTransactionDzd, TreasuryTx, TreasuryCard, ManualAsset, ManualAssetClient, ManualAssetTransaction, Investor, InvestorTransaction, DigitalServiceTransaction } from './types';
import { useLanguage } from './contexts/LanguageContext';
import { signOut } from 'firebase/auth';
import { auth, type AppUser } from './firebaseAuth';
import { db, fieldValueDelete, setFinancialWriteGate } from './firebase';
import { recordTreasuryLegacyDeletionShadow, recordTreasuryShadow } from './accounting/treasuryShadowDiagnostics';
import { recordPortfolioShadow } from './accounting/portfolioShadowDiagnostics';
import { inventoryFromLegacyPortfolioStats } from './accounting/portfolioShadowLegacyAdapter';
import { recordClientShadow } from './accounting/clientShadowDiagnostics';
import { clientPositionFromLegacyRows } from './accounting/clientShadowLegacyAdapter';
import { reconcileLegacyClientsToShadow } from './accounting/clientShadowReadReconciliation';
import { reconcileLegacyInvestorsToShadow } from './accounting/investorShadowReadReconciliation';
import { reconcileLegacyServicesToShadow } from './accounting/serviceShadowReadReconciliation';
import { AlertTriangleIcon } from './components/icons/AlertTriangleIcon';
import { Trash2Icon } from './components/icons/Trash2Icon';
import { ArrowDownIcon } from './components/icons/ArrowDownIcon';
import { UserIcon } from './components/icons/UserIcon';
import { PlusCircleIcon } from './components/icons/PlusCircleIcon';
import { MinusIcon } from './components/icons/MinusIcon';
import { DownloadCloudIcon } from './components/icons/DownloadCloudIcon';
import { CopyIcon } from './components/icons/CopyIcon';
import { CheckIcon } from './components/icons/CheckIcon';
import { CameraIcon } from './components/icons/CameraIcon';
import { ArrowRightLeftIcon } from './components/icons/ArrowRightLeftIcon';
import { RotateCcwIcon } from './components/icons/RotateCcwIcon';
import { AppBottomNav } from './components/main/AppNavigation';
import { NewTransactionMenuDialog } from './components/transactions/NewTransactionMenuDialog';
import { MainHeaderBar } from './components/main/MainHeaderBar';
import { MainContentArea } from './components/main/MainContentArea';
import type { TransactionFilterMode } from './components/transactions/transactionsTypes';
import { fromDateInputValue, toDateInputValue } from './utils/dateInput';
import { OfflineBanner } from './components/ui/OfflineBanner';
import { useMonthlyRecap } from './hooks/useMonthlyRecap';
import { useNotifications } from './hooks/useNotifications';
import { useWeeklyRecap } from './hooks/useWeeklyRecap';
import { useInvestorTerms } from './hooks/useInvestorTerms';
// Custom Hooks
import { useAppData } from './hooks/useAppData';
import { useDashboardSummaryReadModel } from './hooks/useDashboardSummaryReadModel';
import { useSettings } from './hooks/useSettings';
import { usePeriodLock } from './hooks/usePeriodLock';
import { useSmartPricingPlan } from './hooks/useSmartPricingPlan';
import { useTransactionHandlers, type PrefillSell } from './hooks/useTransactionHandlers';
import { useDigitalServiceHandlers } from './hooks/useDigitalServiceHandlers';
import { useClientHandlers } from './hooks/useClientHandlers';
import { useAssetHandlers } from './hooks/useAssetHandlers';
import { useGlobalSearch } from './hooks/useGlobalSearch';
import { useInvestorHandlers } from './hooks/useInvestorHandlers';
import { deriveInvestorEconomics, getManagerProfitBreakdown, reconcileManagerProfitBreakdown, type InvestorEconomicsResult } from './hooks/useInvestorEconomics';
import { useMainNavigation } from './hooks/useMainNavigation';
import { useBackHandler } from './hooks/useBackHandler';
import { closeTopOverlay } from './components/ui/overlayStack';
import { useOverdueDebtClients } from './hooks/useOverdueDebtClients';
import { useReportExports } from './hooks/useReportExports';
// Shared Utils
import { now, parseAndEvaluate } from './utils';
import { computePamLedger } from './utils/pamLedger';
import { collectDebtWriteOffs } from './utils/debtWriteOffs';
import { findPeriodLockViolation, formatLockDate, isInLockedPeriod, savedTimestampFrom } from './utils/periodLock';
import { operationStamp } from './utils/editStamp';
import { calculateInvestorLiability, calculateInvestorBreakdown, calculateServicesCapitalImpact, computeCapitalSnapshot } from './utils/capitalSnapshot';
import { summarizePersonalExpenseTotals } from './utils/financialAudit';
import { buildDashboardReadModelShadowFromLegacy, getReadModelsMode, reconcileDashboardReadModelsWithLegacy, type DashboardReadModelShadowDiagnostic } from './readModels/dashboardReadModels';
import { shouldUseDashboardSummaryForView } from './readModels/readModelActivation';
import { mustPrepareWriterReadModelDelta } from './readModels/preparedWriterDeltas';
import { commitLegacyWithReadModelDeltas } from './readModels/productionSummaryWriter';
import { transitionClientBalanceDelta, type ReadModelDelta } from './readModels/readModelDeltas';
import { HISTORICAL_CLOSING_BASELINE_DZD } from './accounting/closure';
import { formatNumber } from './pages/shared/pageFormat';
const TransactionsPage = React.lazy(() => import('./pages/TransactionsPage').then((module) => ({ default: module.TransactionsPage })));
const PortfolioPage = React.lazy(() => import('./pages/PortfolioPage').then((module) => ({ default: module.PortfolioPage })));
const AnalyticsPage = React.lazy(() => import('./pages/AnalyticsPage').then((module) => ({ default: module.AnalyticsPage })));
const PersonalExpensesPage = React.lazy(() => import('./pages/PersonalExpensesPage').then((module) => ({ default: module.PersonalExpensesPage })));
const ClientsPage = React.lazy(() => import('./pages/ClientsPage').then((module) => ({ default: module.ClientsPage })));
const TresoreriePage = React.lazy(() => import('./pages/TresoreriePage').then((module) => ({ default: module.TresoreriePage })));
const ServicesPage = React.lazy(() => import('./pages/ServicesPage').then((module) => ({ default: module.ServicesPage })));
const ManualAssetPage = React.lazy(() => import('./pages/ManualAssetPage').then((module) => ({ default: module.ManualAssetPage })));
const ManualClientPage = React.lazy(() => import('./pages/ManualClientPage').then((module) => ({ default: module.ManualClientPage })));
const InvestorsPage = React.lazy(() => import('./pages/InvestorsPage').then((module) => ({ default: module.InvestorsPage })));
const InvestorDetailsPage = React.lazy(() => import('./pages/InvestorDetailsPage').then((module) => ({ default: module.InvestorDetailsPage })));
const InvestorDashboardPage = React.lazy(() => import('./pages/InvestorDashboardPage').then((module) => ({ default: module.InvestorDashboardPage })));
const DashboardPage = React.lazy(() => import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })));
const GlobalSearchDialog = React.lazy(() => import('./components/main/MainDialogs').then((module) => ({ default: module.GlobalSearchDialog })));
const MainAppDialogs = React.lazy(() => import('./components/main/MainAppDialogs').then((module) => ({ default: module.MainAppDialogs })));
const MonthPlanSheet = React.lazy(() => import('./components/calculator/MonthPlanSheet').then((module) => ({ default: module.MonthPlanSheet })));
const loadPdfReports = () => import('./utils/pdfReports');
const EMPTY_TRANSACTIONS: Tx[] = [];
const EMPTY_CLIENTS_DZD: ClientDzd[] = [];
const EMPTY_CLIENT_TRANSACTIONS_DZD: ClientTransactionDzd[] = [];
const EMPTY_TREASURY_TRANSACTIONS: TreasuryTx[] = [];
const EMPTY_PROFIT_BY_TX_ID = new Map<string, number>();
const CORE_DATA_KEYS = ['transactions', 'clients', 'clientTransactions', 'treasuryTransactions', 'digitalServiceTransactions'] as const;
const OWNER_OPENING_CAPITAL = 2_000_000;
// Historical accounting closure: 365 350 - 3 062 = 362 288 DZD.
// This is a locked baseline, never an automatic reconciliation bucket.
const OWNER_PRE_TRACKING_EXPENSES = HISTORICAL_CLOSING_BASELINE_DZD;
const EMPTY_INVESTOR_ECONOMICS: InvestorEconomicsResult = {
    derivedInvestors: [],
    warnings: [],
    totals: {
        derivedProfit: 0,
        managerShare: 0,
        investorShare: 0,
        reconciliationDifference: 0,
        totalDeliveryExpenses: 0,
        totalDebtWriteOffs: 0,
        netDistributableProfit: 0,
    },
};
type ClientSortMode = 'all' | 'advances' | 'debts' | 'debts_oldest_highest' | 'zero_balance';
import { reorderClientName, nameMatchesQuery } from './utils/nameUtils';
import { clientNameKey, clientPhoneKey, isClientActive, selectableClients } from './utils/clientRegistry';
import { investorResetForDeletedRow } from './utils/managerCapital';
import { buildPricingContext, quoteSale, type SmartSaleSnapshot } from './services/smartPricingEngine';
import { alertToastDurationMs, detectAlertTone } from './utils/alertTone';
import { AppToast } from './components/ui/AppToast';
import { translateAlert } from './utils/alertMessages';

/** True from the first render where `value` is true, and stays true afterwards. */
function useLatchedFlag(value: boolean): boolean {
    const [latched, setLatched] = useState(value);
    if (value && !latched)
        setLatched(true);
    return latched || value;
}
function getClientDisplayName(client: ClientDzd) {
    const raw = client.fullName || (client.prenom ? `${client.nom} ${client.prenom}` : client.nom) || '';
    return reorderClientName(raw);
}
export default function MainApp({ user }: {
    user: AppUser;
}) {
    // PWA Install Prompt
    const [installPrompt, setInstallPrompt] = useState<any>(null);
    useEffect(() => {
        const handler = (e: Event) => {
            e.preventDefault();
            setInstallPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);
    const handleInstallClick = () => {
        if (!installPrompt)
            return;
        installPrompt.prompt();
        installPrompt.userChoice.then((choiceResult: {
            outcome: string;
        }) => {
            setInstallPrompt(null);
        });
    };
    // --- 1. CORE DATA & SETTINGS ---
    const { t, lang } = useLanguage();
    const readModelsMode = getReadModelsMode();
    // The shadow comparisons below recompute the whole dashboard, the PAM ledger
    // and the investor economics a second time purely for console diagnostics.
    // Run them only when explicitly requested with VITE_READ_MODELS_MODE=shadow.
    const shadowDiagnosticsEnabled = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_READ_MODELS_MODE === 'shadow';
    const [refreshKey, setRefreshKey] = useState(0);
    const [alert, setAlert] = useState('');
    // The undo offered with a message belongs to that message only: a newer message drops it.
    const [alertUndo, setAlertUndo] = useState<{ message: string; run: () => void } | null>(null);
    const notifyWithUndo = useCallback((message: string, run: () => void) => {
        setAlertUndo({ message, run });
        setAlert(message);
    }, []);
    const { investorIdFromUrl, isInvestorRoute, navigateToView, selectedClientId, setSelectedClientId, setView, view } = useMainNavigation();
    const shouldUseDashboardReadModel = shouldUseDashboardSummaryForView({ readModelsMode, view });
    const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
    const [selectedAssetClientId, setSelectedAssetClientId] = useState<string | null>(null);
    const shouldSubscribeManualAssets = view === 'services'
        || view === 'dashboard'
        || view === 'investors'
        || view === 'tresorerie'
        || selectedAssetId !== null
        || selectedAssetClientId !== null;
    const shouldSubscribeInvestors = view === 'investors' || view === 'dashboard' || view === 'tresorerie' || view === 'dzd' || view === 'transactions' || view === 'expenses' || isInvestorRoute;
    const shouldSubscribeTreasuryCards = view === 'dashboard' || view === 'investors' || view === 'tresorerie' || view === 'transactions';
    // Once a collection has been subscribed, keep its listener for the whole
    // session. Dropping it on page change threw the data away, and coming back
    // re-downloaded it and blocked the page until the server answered again.
    const keepManualAssetsSubscribed = useLatchedFlag(shouldSubscribeManualAssets);
    const keepInvestorsSubscribed = useLatchedFlag(shouldSubscribeInvestors);
    const keepTreasuryCardsSubscribed = useLatchedFlag(shouldSubscribeTreasuryCards);
    const shouldRequireManualAssets = view === 'services' || selectedAssetId !== null || selectedAssetClientId !== null;
    const shouldRequireInvestors = view === 'investors' || view === 'expenses' || view === 'tresorerie' || isInvestorRoute;
    const shouldRequireTreasuryCards = view === 'tresorerie';
    // 1.1 App Data (Provides userDocRef)
    const { userDocRef, transactions, clientsDzd, clientTransactionsDzd, treasuryTransactions, digitalServiceTransactions, treasuryCards, manualAssets, manualAssetClients, manualAssetTransactions, treasuryStats, clientBalances, assetClientBalances, assetBalances, totals, investorTransactions, investors, isDataLoaded, dataStatus } = useAppData(user, refreshKey, {
        subscribeCoreFinancial: !shouldUseDashboardReadModel,
        subscribeManualAssets: !shouldUseDashboardReadModel && keepManualAssetsSubscribed,
        subscribeInvestors: !shouldUseDashboardReadModel && keepInvestorsSubscribed,
        subscribeTreasuryCards: !shouldUseDashboardReadModel && keepTreasuryCardsSubscribed,
        requireManualAssets: shouldRequireManualAssets,
        requireInvestors: shouldRequireInvestors,
        requireTreasuryCards: shouldRequireTreasuryCards
    });
    const dashboardSummaryRead = useDashboardSummaryReadModel(userDocRef, readModelsMode);
    // 1.2 Settings
    const { managerFeePercentage, managerFeeHistory, saveManagerFeePercentage, isSettingsLoaded } = useSettings(userDocRef);
    // Closed months (utils/periodLock): their operations can be neither edited nor deleted.
    const periodLock = usePeriodLock(userDocRef);
    const periodLockRef = useRef(periodLock);
    periodLockRef.current = periodLock;
    const tRef = useRef(t);
    tRef.current = t;
    const savedOperationsRef = useRef<Record<string, readonly { id: string; timestamp?: unknown }[]>>({});
    savedOperationsRef.current = {
        usdt_txs: transactions,
        dzd_client_txs: clientTransactionsDzd,
        treasury_txs: treasuryTransactions,
        digital_service_txs: digitalServiceTransactions,
        actifTransactions: manualAssetTransactions,
        investor_transactions: investorTransactions,
    };
    const periodLockRefusal = (timestamp: number, lockedThrough: number) => String(tRef.current('periodLock.refused'))
        .replace('{date}', formatLockDate(timestamp))
        .replace('{lockedThrough}', formatLockDate(lockedThrough));
    // Refuses right away to open an edit or delete of an operation in a closed month. The
    // write gate below refuses the save anyway; this only spares filling a form for nothing.
    const refuseIfClosedMonth = (timestamp: unknown): boolean => {
        const { lockedThrough } = periodLockRef.current;
        if (lockedThrough === null || !isInLockedPeriod(timestamp, lockedThrough))
            return false;
        setAlert(periodLockRefusal(Number(timestamp), lockedThrough));
        return true;
    };
    const periodLockProps = useMemo(() => ({
        lockedThrough: periodLock.lockedThrough,
        reason: periodLock.reason,
        updatedAt: periodLock.updatedAt,
        isLoaded: periodLock.isLoaded,
        saveLockedThrough: periodLock.saveLockedThrough,
    }), [periodLock.lockedThrough, periodLock.reason, periodLock.updatedAt, periodLock.isLoaded, periodLock.saveLockedThrough]);
    const pricingPlanSync = useSmartPricingPlan(userDocRef);
    // Open instantly from the IndexedDB cache when it holds a previous session's
    // data. An empty cache (first open on this device) still waits for the
    // server, so the app never flashes zero balances.
    const hasUsableLocalCache = isDataLoaded && transactions.length > 0;
    const canUseFinancialData = shouldUseDashboardReadModel
        ? (dashboardSummaryRead.hasServerSynced
            || (dashboardSummaryRead.isDashboardSummaryReady && typeof navigator !== 'undefined' && navigator.onLine === false))
        : (dataStatus.hasServerSynced
            || (isDataLoaded && typeof navigator !== 'undefined' && navigator.onLine === false)
            || hasUsableLocalCache);
    const isFinancialDataReady = canUseFinancialData && isSettingsLoaded;
    // Load the Opérations page code while the app is idle, so the first tap on it does not wait
    // for the download (after an update the phone has not fetched it yet). Offline, or if the
    // download fails, nothing changes: opening the page imports it as before.
    useEffect(() => {
        if (!isFinancialDataReady || typeof window === 'undefined' || navigator.onLine === false)
            return;
        const preload = () => { import('./pages/TransactionsPage').catch(() => { }); };
        if (typeof window.requestIdleCallback === 'function') {
            const idleId = window.requestIdleCallback(preload, { timeout: 5000 });
            return () => window.cancelIdleCallback(idleId);
        }
        const timeoutId = window.setTimeout(preload, 2000);
        return () => window.clearTimeout(timeoutId);
    }, [isFinancialDataReady]);
    // Figures come from the phone's cache until the server has answered once;
    // financial writes stay locked during that window (see setFinancialWriteGate).
    const isAwaitingServerSync = !shouldUseDashboardReadModel && isFinancialDataReady && !dataStatus.hasServerSynced
        && !(typeof navigator !== 'undefined' && navigator.onLine === false);
    const isAwaitingServerSyncRef = useRef(isAwaitingServerSync);
    isAwaitingServerSyncRef.current = isAwaitingServerSync;
    useEffect(() => {
        setFinancialWriteGate({
            // Also wait for the closed months, so a write cannot slip into one before they are known.
            blockedReason: () => (isAwaitingServerSyncRef.current || !periodLockRef.current.isLoaded
                ? '⏳ Synchronisation en cours. Réessayez dans un instant.'
                : null),
            refusedWritesReason: (writes) => {
                const { lockedThrough } = periodLockRef.current;
                const violation = findPeriodLockViolation({
                    lockedThrough,
                    writes,
                    savedTimestamp: savedTimestampFrom(savedOperationsRef.current),
                });
                return violation && lockedThrough !== null ? periodLockRefusal(violation.timestamp, lockedThrough) : null;
            },
            onBlocked: (reason) => setAlert(reason),
        });
        return () => setFinancialWriteGate(null);
    }, []);
    const clientShadowReadReconciliation = useMemo(() => {
        if (!shadowDiagnosticsEnabled || !isFinancialDataReady || shouldUseDashboardReadModel) return null;
        return reconcileLegacyClientsToShadow(clientTransactionsDzd, clientsDzd.map((client) => client.id));
    }, [isFinancialDataReady, shouldUseDashboardReadModel, clientTransactionsDzd, clientsDzd]);
    const clientShadowReconciliationFingerprint = useRef('');
    useEffect(() => {
        if (!clientShadowReadReconciliation) return;
        const fingerprint = JSON.stringify({
            clients: clientShadowReadReconciliation.clientCount,
            transactions: clientShadowReadReconciliation.transactionCount,
            differences: clientShadowReadReconciliation.differences,
            mismatchCount: clientShadowReadReconciliation.mismatches.length,
        });
        if (clientShadowReconciliationFingerprint.current === fingerprint) return;
        clientShadowReconciliationFingerprint.current = fingerprint;
        const label = '[clientsV2 read reconciliation]';
        if (clientShadowReadReconciliation.ok) console.info(label, clientShadowReadReconciliation);
        else console.warn(label, clientShadowReadReconciliation);
    }, [clientShadowReadReconciliation]);
    // 1.3 Derived Data
    // Keep one canonical ledger result. Deferring it made financial cards render
    // an older snapshot for a frame before switching to the current values.
    const coreCollectionStates = dataStatus.collectionState;
    const hasCurrentCoreData = CORE_DATA_KEYS
        .every((key) => coreCollectionStates[key]?.serverSynced)
        || ((hasUsableLocalCache || (typeof navigator !== 'undefined' && navigator.onLine === false))
            && CORE_DATA_KEYS.every((key) => coreCollectionStates[key]?.received));
    const ledgerTransactions = hasCurrentCoreData ? transactions : EMPTY_TRANSACTIONS;
    // 24h-locked buys become available at `lockedUntil`. The ledger only reads
    // the clock when it recomputes, so schedule a recompute at the next unlock;
    // otherwise the stock stays "locked" until some unrelated transaction arrives.
    const [lockReleaseTick, setLockReleaseTick] = useState(0);
    const pamLedger = useMemo(() => computePamLedger(ledgerTransactions), [ledgerTransactions, lockReleaseTick]);
    useEffect(() => {
        const nowMs = Date.now();
        const nextUnlock = [...pamLedger.portfolioStats.usdt.lockedBatches, ...pamLedger.portfolioStats.eur.lockedBatches]
            .map((batch) => Number(batch.lockedUntil))
            .filter((lockedUntil) => Number.isFinite(lockedUntil) && lockedUntil > nowMs)
            .reduce((min, lockedUntil) => Math.min(min, lockedUntil), Number.POSITIVE_INFINITY);
        if (!Number.isFinite(nextUnlock))
            return;
        // setTimeout overflows above ~24.8 days; re-arm in steps if needed.
        const timer = window.setTimeout(() => setLockReleaseTick((tick) => tick + 1), Math.min(nextUnlock - nowMs + 1000, 2_000_000_000));
        return () => window.clearTimeout(timer);
    }, [pamLedger]);
    const portfolioStats = pamLedger.portfolioStats;
    const deliveryExpenses = useMemo(() => treasuryTransactions.filter((tx) => tx.origin === 'delivery_expense'), [treasuryTransactions]);
    const personalExpenses = useMemo(() => treasuryTransactions.filter((tx) => tx.origin === 'personal_expense'), [treasuryTransactions]);
    const debtWriteOffs = useMemo(() => collectDebtWriteOffs(clientTransactionsDzd), [clientTransactionsDzd]);
    const investorEconomics = useMemo(() => {
        if (!isFinancialDataReady)
            return EMPTY_INVESTOR_ECONOMICS;
        return deriveInvestorEconomics({
            investors,
            investorTransactions,
            transactions,
            managerFeePercentage,
            managerFeeHistory,
            pamLedger,
            deliveryExpenses,
            debtWriteOffs,
            treasuryTransactions,
            personalExpenses
        });
    }, [isFinancialDataReady, investors, investorTransactions, managerFeePercentage, managerFeeHistory, transactions, pamLedger, deliveryExpenses, debtWriteOffs, treasuryTransactions, personalExpenses]);
    const derivedInvestors = investorEconomics.derivedInvestors;
    // Quarterly investor terms (utils/investorTerms): read only once the investors and their whole
    // history are in, since a missing history would show every term as still to decide.
    const investorCollections = dataStatus.collectionState;
    const investorTermsReady = isFinancialDataReady
        && Boolean(investorCollections.investors?.received && investorCollections.investorTransactions?.received);
    const investorTermsSynced = investorTermsReady
        && Boolean(investorCollections.investors?.serverSynced && investorCollections.investorTransactions?.serverSynced);
    const investorTerms = useInvestorTerms(derivedInvestors, investorTransactions, investorTermsReady);
    const investorShadowReadReconciliation = useMemo(() => {
        if (!shadowDiagnosticsEnabled || !isFinancialDataReady || shouldUseDashboardReadModel) return null;
        return reconcileLegacyInvestorsToShadow({
            investors,
            investorTransactions,
            transactions,
            deliveryExpenses,
            debtWriteOffs,
            treasuryTransactions,
            personalExpenses,
            managerFeeHistory,
            legacyDerivedInvestors: derivedInvestors,
            legacyManagerShareDzd: investorEconomics.totals.managerShare,
        });
    }, [isFinancialDataReady, shouldUseDashboardReadModel, investors, investorTransactions, transactions, deliveryExpenses, debtWriteOffs, treasuryTransactions, personalExpenses, managerFeeHistory, derivedInvestors, investorEconomics.totals.managerShare]);
    const investorShadowReconciliationFingerprint = useRef('');
    useEffect(() => {
        if (!investorShadowReadReconciliation) return;
        const fingerprint = JSON.stringify({
            investors: investorShadowReadReconciliation.investorCount,
            events: investorShadowReadReconciliation.allocationEventCount,
            errors: investorShadowReadReconciliation.errors,
            differences: investorShadowReadReconciliation.totals,
        });
        if (investorShadowReconciliationFingerprint.current === fingerprint) return;
        investorShadowReconciliationFingerprint.current = fingerprint;
        const label = '[investorsV2 read reconciliation]';
        if (investorShadowReadReconciliation.ok) console.info(label, investorShadowReadReconciliation);
        else console.warn(label, investorShadowReadReconciliation);
    }, [investorShadowReadReconciliation]);
    const serviceShadowReadReconciliation = useMemo(() => {
        if (!shadowDiagnosticsEnabled || !isFinancialDataReady || shouldUseDashboardReadModel) return null;
        return reconcileLegacyServicesToShadow(digitalServiceTransactions);
    }, [isFinancialDataReady, shouldUseDashboardReadModel, digitalServiceTransactions]);
    const serviceShadowReconciliationFingerprint = useRef('');
    useEffect(() => {
        if (!serviceShadowReadReconciliation) return;
        const fingerprint = JSON.stringify({
            transactions: serviceShadowReadReconciliation.transactionCount,
            differences: serviceShadowReadReconciliation.differences,
            mismatchCount: serviceShadowReadReconciliation.mismatches.length,
        });
        if (serviceShadowReconciliationFingerprint.current === fingerprint) return;
        serviceShadowReconciliationFingerprint.current = fingerprint;
        const label = '[servicesV2 read reconciliation]';
        if (serviceShadowReadReconciliation.ok) console.info(label, serviceShadowReadReconciliation);
        else console.warn(label, serviceShadowReadReconciliation);
    }, [serviceShadowReadReconciliation]);

    const monthlyGoalState = pricingPlanSync.plan.monthlyGoal;
    const minimumGoalState = pricingPlanSync.plan.minimumGoal;
    const tierThresholds = React.useMemo(() => ({
        vip: pricingPlanSync.policy.vipVolumeThreshold,
        regular: pricingPlanSync.policy.regularVolumeThreshold,
        petit: pricingPlanSync.policy.smallVolumeThreshold,
    }), [pricingPlanSync.policy.vipVolumeThreshold, pricingPlanSync.policy.regularVolumeThreshold, pricingPlanSync.policy.smallVolumeThreshold]);

    // Rolling history normalized by the actual observed calendar span. Short
    // histories stay low-confidence and are not extrapolated into a fake plan.
    const salesHistory90 = React.useMemo(() => {
        const ninetyDaysAgo = Date.now() - 90 * 86_400_000;
        const rows = pamLedger.sellProfitRows
            .filter((row) => row.timestamp >= ninetyDaysAgo && row.currency === 'USDT')
            .sort((a, b) => a.timestamp - b.timestamp);
        let totalProfit = 0;
        let totalQty = 0;
        for (const row of rows) {
            totalProfit += row.derivedProfit || 0;
            totalQty    += Number(row.quantity || 0);
        }
        const observedDays = rows.length > 0
            ? Math.min(90, Math.max(1, Math.ceil((Date.now() - rows[0].timestamp) / 86_400_000)))
            : 0;
        const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
        const historyReady = observedDays >= pricingPlanSync.policy.minHistoryDays
            && rows.length >= pricingPlanSync.policy.minHistoryDeals;
        return {
            avgMonthlyVol: historyReady ? totalQty / observedDays * daysInMonth : 0,
            avgMonthlyProfit: historyReady ? totalProfit / observedDays * daysInMonth : 0,
            observedDays,
            dealCount: rows.length,
        };
    }, [pamLedger, pricingPlanSync.policy.minHistoryDays, pricingPlanSync.policy.minHistoryDeals]);

    // Client tier by rolling 30-day USDT sell volume (via transaction.linkedClientId)
    const earlyClientLoyaltyMap = React.useMemo<Map<string, 'vip' | 'regular' | 'petit' | 'new' | 'inactive' | 'fournisseur'>>(() => {
        const now = new Date();
        const rollingStart  = now.getTime() - 30 * 86_400_000; // last 30 days
        const inactifCutoff = now.getTime() - 45 * 86_400_000; // 45 days = inactive

        const volumeByClient = new Map<string, number>();
        for (const tx of transactions) {
            if (tx.type !== 'sell' || tx.currency !== 'USDT') continue;
            if (!tx.linkedClientId) continue;
            if (tx.timestamp < rollingStart) continue;
            volumeByClient.set(tx.linkedClientId, (volumeByClient.get(tx.linkedClientId) || 0) + Number(tx.quantity || 0));
        }

        const lastActivityByClient = new Map<string, number>();
        for (const tx of clientTransactionsDzd) {
            const prev = lastActivityByClient.get(tx.clientId) || 0;
            if (tx.timestamp > prev) lastActivityByClient.set(tx.clientId, tx.timestamp);
        }

        const everSoldClients = new Set<string>();
        const everBoughtFromClients = new Set<string>();
        for (const tx of transactions) {
            if (tx.type === 'sell' && tx.linkedClientId) everSoldClients.add(tx.linkedClientId);
            if (tx.type === 'buy'  && tx.linkedClientId) everBoughtFromClients.add(tx.linkedClientId);
        }

        const result = new Map<string, 'vip' | 'regular' | 'petit' | 'new' | 'inactive' | 'fournisseur'>();
        for (const client of clientsDzd) {
            const lastActivity = lastActivityByClient.get(client.id) || 0;
            const volume = volumeByClient.get(client.id) || 0;
            const everSold = everSoldClients.has(client.id);
            // Auto-detect supplier: linked to buy transactions but never to sell transactions
            // Manual fournisseur flag overrides all classification
            if ((client as any).isFournisseur) { result.set(client.id, 'fournisseur'); continue; }
            // Auto-detect: linked to buy transactions but never to sell transactions
            if (everBoughtFromClients.has(client.id) && !everSold) { result.set(client.id, 'fournisseur'); continue; }

            // No history at all → Nouveau
            if (!everSold && lastActivity === 0) { result.set(client.id, 'new'); continue; }
            // No activity in 45 days → Inactif (treated as Nouveau for pricing)
            if (lastActivity < inactifCutoff && lastActivity > 0) { result.set(client.id, 'inactive'); continue; }
            // Classify by previous month volume (user-editable thresholds)
            if (volume >= tierThresholds.vip)     { result.set(client.id, 'vip');     continue; }
            if (volume >= tierThresholds.regular) { result.set(client.id, 'regular'); continue; }
            if (volume >= tierThresholds.petit)   { result.set(client.id, 'petit');   continue; }
            // Had some history but not in previous month
            result.set(client.id, 'inactive');
        }
        return result;
    }, [transactions, clientTransactionsDzd, clientsDzd, tierThresholds]);

    // Rolling 30-day USDT volume sold per client (for client card display)
    const earlyClientPrevMonthVolumeMap = React.useMemo(() => {
        const rollingStart = Date.now() - 30 * 86_400_000;
        const map = new Map<string, number>();
        for (const tx of transactions) {
            if (tx.type !== 'sell' || tx.currency !== 'USDT' || !tx.linkedClientId) continue;
            if (tx.timestamp < rollingStart) continue;
            map.set(tx.linkedClientId, (map.get(tx.linkedClientId) || 0) + Number(tx.quantity || 0));
        }
        return map;
    }, [transactions]);

    const monthPlanClients = React.useMemo(
        () => clientsDzd
            .filter((client) => isClientActive(client) && earlyClientLoyaltyMap.get(client.id) !== 'fournisseur')
            .map((client) => ({ id: client.id, name: getClientDisplayName(client) })),
        [clientsDzd, earlyClientLoyaltyMap],
    );

    // Last USDT sell date per client
    const earlyClientLastSellDateMap = React.useMemo(() => {
        const map = new Map<string, number>();
        for (const tx of transactions) {
            if (tx.type !== 'sell' || !tx.linkedClientId) continue;
            const prev = map.get(tx.linkedClientId) || 0;
            if (tx.timestamp > prev) map.set(tx.linkedClientId, tx.timestamp);
        }
        return map;
    }, [transactions]);

    // --- 2. BUSINESS LOGIC HOOKS ---
    // Live smart-pricing quote of the open sell form — persisted on the Tx
    // by handleSell as the sp* snapshot (negotiation-loss tracking).
    const smartQuoteRef = React.useRef<SmartSaleSnapshot | null>(null);
    const { isSaving, setIsSaving, mode, setMode, editingTx, setEditingTx, isTotalManual, setIsTotalManual, buyUsdtAmount, setBuyUsdtAmount, buyUsdtPrice, setBuyUsdtPrice, buyUsdtTotal, setBuyUsdtTotal, buyEurAmount, setBuyEurAmount, buyEurPrice, setBuyEurPrice, buyEurTotal, setBuyEurTotal, sellAmount, setSellAmount, sellPrice, setSellPrice, sellTotal, setSellTotal, sellSettlementCurrency, setSellSettlementCurrency, sellEurToDzdRate, setSellEurToDzdRate, buyUsdtMode, setBuyUsdtMode, buyEurForUsdtAmount, setBuyEurForUsdtAmount, eurDzdPrice, setEurDzdPrice, eurUsdtRate, setEurUsdtRate, linkedClientId, setLinkedClientId, linkedClientDzdId, setLinkedClientDzdId, clientPaymentStatus, setClientPaymentStatus, creditDueDate, setCreditDueDate, pendingCreditRisk, confirmCreditRisk, cancelCreditRisk, notes, setNotes, txTags, setTxTags, profitPercent, setProfitPercent, isAdjustmentModalOpen, setIsAdjustmentModalOpen, adjustmentTab, setAdjustmentTab, adjustmentAsset, setAdjustmentAsset, adjustmentAmount, setAdjustmentAmount, adjustmentPrice, setAdjustmentPrice, adjustmentNote, setAdjustmentNote, adjustmentClientId, setAdjustmentClientId, editingTreasuryTx, usdtFromEurCalc, formValidation, openForm, closeForm, handleBuy, handleSell, handleGlobalAdjustment, handleDeleteTx, openAdjustmentModal, isDeliveryExpenseModalOpen, deliveryExpenseAmount, setDeliveryExpenseAmount, deliveryExpenseMethod, setDeliveryExpenseMethod, deliveryExpenseDate, setDeliveryExpenseDate, deliveryExpenseNote, setDeliveryExpenseNote, deliveryExpensePreview, openDeliveryExpenseModal, closeDeliveryExpenseModal, handleSaveDeliveryExpense, txToDelete, setTxToDelete, handleConfirmDeleteTx, isTransferModalOpen, setIsTransferModalOpen, transferAmount, setTransferAmount, transferFromClientId, setTransferFromClientId, transferToClientId, setTransferToClientId, transferNotes, setTransferNotes, transferDate, setTransferDate, transferTime, setTransferTime, editingTransferTx, openTransferModal, closeTransferModal, handleSaveTransfer, handleApplyLock24hToRecentBuys, buyRestriction, setBuyRestriction, realPurchaseTime, setRealPurchaseTime } = useTransactionHandlers({
        userDocRef, portfolioStats, transactions, clientsDzd, clientTransactionsDzd,
        investors, investorTransactions, managerFeePercentage, managerFeeHistory, treasuryTransactions, personalExpenses, treasuryStats,
        setAlert, setSelectedClientId: (id: string | null) => setSelectedClientId(id), setView: (v: string) => setView(v),
        smartQuoteRef,
    });
    const { isDigitalServiceModalOpen, isDigitalServiceSaving, editingDigitalServiceTx, digitalServiceClientId, setDigitalServiceClientId, digitalServiceName, setDigitalServiceName, digitalServicePurchaseWallet, setDigitalServicePurchaseWallet, digitalServicePurchaseAmount, setDigitalServicePurchaseAmount, digitalServiceSaleWallet, setDigitalServiceSaleWallet, digitalServiceSaleAmount, setDigitalServiceSaleAmount, digitalServiceDate, setDigitalServiceDate, digitalServiceNote, setDigitalServiceNote, digitalServicePreview, openDigitalServiceModal, closeDigitalServiceModal, handleSaveDigitalService, handleDeleteDigitalService } = useDigitalServiceHandlers({
        userDocRef,
        clientsDzd,
        clientTransactionsDzd,
        portfolioStats,
        treasuryStats,
        setAlert,
    });
    const { isSaving: isClientSaving, isClientModalOpen, setIsClientModalOpen, editingClient, setEditingClient, clientToDelete, clientDeleteMode, clientFullName, setClientFullName, clientPhone, setClientPhone, initialBalance, setInitialBalance, clientRedotpayId, setClientRedotpayId, clientBinanceEmail, setClientBinanceEmail, clientNotes, setClientNotes, clientCreditLimit, setClientCreditLimit, clientGroup, setClientGroup, clientIsFournisseur, setClientIsFournisseur, openClientModal, closeClientModal, requestClientDelete, closeClientDeleteDialog, handleSaveClient, clientDuplicateMatches, confirmSaveClientDespiteDuplicates, cancelClientDuplicateWarning, restoreArchivedClient, handleDeleteClient, handleZeroOutBalance, isClientTxModalOpen, setIsClientTxModalOpen, editingClientTx, setEditingClientTx, clientTxToDelete, setClientTxToDelete, clientTxAmount, setClientTxAmount, clientTxType, setClientTxType, clientTxNotes, setClientTxNotes, clientTxSource, setClientTxSource, clientPaymentStatus: clientTxPaymentStatus, setClientPaymentStatus: setClientTxPaymentStatus, linkedClientId: clientTxLinkedClientId, clientTxReceiverClientId, setClientTxReceiverClientId, openClientTxModal, handleSaveClientTx, handleDeleteClientTx, clientTxUsdtAmount, setClientTxUsdtAmount, clientTxSellPrice, setClientTxSellPrice, clientTxEurAmount, setClientTxEurAmount, clientTxEurPrice, setClientTxEurPrice, handleClientToClientTransfer, getClientTransferableAmount } = useClientHandlers(userDocRef, clientsDzd, clientTransactionsDzd, clientBalances, treasuryTransactions, treasuryStats, investors, setAlert, { investorTransactions, managerFeePercentage, managerFeeHistory }, notifyWithUndo);
    const { isInvestorModalOpen, setIsInvestorModalOpen, editingInvestor, setEditingInvestor, investorToDelete, setInvestorToDelete, isInvestorTxModalOpen, setIsInvestorTxModalOpen, investorName, setInvestorName, investorInitialCapital, setInvestorInitialCapital, investorInitialCapitalSource, setInvestorInitialCapitalSource, investorNotes, setInvestorNotes, isManager, setIsManager, investorTxType, setInvestorTxType, investorTxAmount, setInvestorTxAmount, investorTxNotes, setInvestorTxNotes, investorTxPaymentSource, setInvestorTxPaymentSource, investorTxToDelete, setInvestorTxToDelete, isReinvestModalOpen, setIsReinvestModalOpen, reinvestInput, setReinvestInput, selectedInvestorId, setSelectedInvestorId, handleSaveInvestor, handleSaveInvestorTx, handleReinvestProfit, handleDeleteInvestor, openInvestorModal, closeInvestorModal,
    // Personal withdrawal (manager's daily personal expense)
    isPersonalWithdrawalModalOpen, setIsPersonalWithdrawalModalOpen, personalWithdrawalAmount, setPersonalWithdrawalAmount, personalWithdrawalMethod, setPersonalWithdrawalMethod, personalWithdrawalDate, setPersonalWithdrawalDate, personalWithdrawalNote, setPersonalWithdrawalNote, personalWithdrawalMode, setPersonalWithdrawalMode, personalWithdrawalPreview, editingPersonalExpenseTx, personalExpenseToDelete, setPersonalExpenseToDelete, openEditPersonalExpense, openPersonalWithdrawalModal, closePersonalWithdrawalModal, handleSavePersonalWithdrawal, handleDeletePersonalExpense, managerAvailableProfit, managerCapitalInvested, managerExists,
    // Reconcile advance
    isReconcileAdvanceModalOpen, reconcileAdvanceTx, reconcileActualAmount, setReconcileActualAmount, reconcileSpentDescription, setReconcileSpentDescription, openReconcileAdvanceModal, closeReconcileAdvanceModal, handleReconcilePersonalAdvance } = useInvestorHandlers(userDocRef, derivedInvestors, treasuryStats, portfolioStats, setAlert);
    const { isAssetModalOpen, setIsAssetModalOpen, editingAsset, setEditingAsset, isAssetClientModalOpen, setIsAssetClientModalOpen, editingAssetClient, setEditingAssetClient, isCreateAssetModalOpen, setIsCreateAssetModalOpen, newAssetName, setNewAssetName, newAssetDescription, setNewAssetDescription, assetClientBalance, setAssetClientBalance, handleCreateAsset, handleDeleteAsset, openAssetClientModal, closeAssetClientModal, handleCreateAssetClient, handleUpdateAssetClient, handleDeleteAssetClient, handleCreateAssetTransaction } = useAssetHandlers(userDocRef, manualAssets, manualAssetClients, assetClientBalances, setAlert);
    // --- 3. LOCAL UI STATE ---
    const [isNewOperationMenuOpen, setIsNewOperationMenuOpen] = useState(false);
    const [isMonthPlanOpen, setIsMonthPlanOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    // Stable, so the memoized header and bottom bar don't re-render with every page update.
    const openNewOperationMenu = useCallback(() => setIsNewOperationMenuOpen(true), []);
    const closeNewOperationMenu = useCallback(() => setIsNewOperationMenuOpen(false), []);
    const openSettingsModal = useCallback(() => setIsSettingsModalOpen(true), []);
    const handleSignOut = useCallback(() => { void signOut(auth); }, []);
    const [isResetModalOpen, setIsResetModalOpen] = useState(false);
    const [isTreasuryCardModalOpen, setIsTreasuryCardModalOpen] = useState(false);
    const [isTreasuryBalanceEditModalOpen, setIsTreasuryBalanceEditModalOpen] = useState(false);
    const [isPortfolioBalanceEditModalOpen, setIsPortfolioBalanceEditModalOpen] = useState(false);
    const [statsView, setStatsView] = useState<'overview' | 'historical' | 'simulator' | 'dzd' | 'investors'>('overview');
    const [selectedHeatmapDay, setSelectedHeatmapDay] = useState<{
        day: number;
        profit: number;
    } | null>(null);
    const [isDateFilterModalOpen, setIsDateFilterModalOpen] = useState(false);
    const [dateRange, setDateRange] = useState<{
        start: Date | null;
        end: Date | null;
    }>({ start: null, end: null });
    const [tempStartDate, setTempStartDate] = useState('');
    const [tempEndDate, setTempEndDate] = useState('');
    const [filterMode, setFilterMode] = useState<TransactionFilterMode>('all');
    const [clientSearchQuery, setClientSearchQuery] = useState('');
    const [clientSortMode, setClientSortMode] = useState<ClientSortMode>('all');
    const [isWalletTransferModalOpen, setIsWalletTransferModalOpen] = useState(false);
    const [walletTransferAmount, setWalletTransferAmount] = useState('');
    const [walletTransferSource, setWalletTransferSource] = useState<'Caisse' | 'BaridiMob'>('Caisse');
    const [walletTransferDest, setWalletTransferDest] = useState<'Caisse' | 'BaridiMob'>('BaridiMob');
    const [walletTransferNotes, setWalletTransferNotes] = useState('');
    const setWalletTransferSourceAndSync = useCallback((value: 'Caisse' | 'BaridiMob') => {
        setWalletTransferSource(value);
        setWalletTransferDest(value === 'Caisse' ? 'BaridiMob' : 'Caisse');
    }, []);
    const [editingWalletTransferTx, setEditingWalletTransferTx] = useState<TreasuryTx | null>(null);
    const [editingTreasuryCard, setEditingTreasuryCard] = useState<TreasuryCard | null>(null);
    const [treasuryCardName, setTreasuryCardName] = useState('');
    const [treasuryCardValue, setTreasuryCardValue] = useState('');
    const [treasuryCardNotes, setTreasuryCardNotes] = useState('');
    const [treasuryCardToDelete, setTreasuryCardToDelete] = useState<TreasuryCard | null>(null);
    const [treasuryBalanceEditAsset, setTreasuryBalanceEditAsset] = useState<'Caisse' | 'BaridiMob'>('Caisse');
    const [treasuryBalanceEditValue, setTreasuryBalanceEditValue] = useState('');
    const [treasuryBalanceEditNotes, setTreasuryBalanceEditNotes] = useState('');
    const [editingTreasuryBalanceTx, setEditingTreasuryBalanceTx] = useState<TreasuryTx | null>(null);
    const [portfolioBalanceEditAsset, setPortfolioBalanceEditAsset] = useState<'USDT' | 'EUR'>('USDT');
    const [portfolioBalanceEditValue, setPortfolioBalanceEditValue] = useState('');
    const [portfolioBalanceEditNotes, setPortfolioBalanceEditNotes] = useState('');
    const [editingPortfolioBalanceTx, setEditingPortfolioBalanceTx] = useState<Tx | null>(null);
    const [copiedValue, setCopiedValue] = useState<string | null>(null);
    const [summaryClient, setSummaryClient] = useState<ClientDzd | null>(null);
    const [treasuryTxToDelete, setTreasuryTxToDelete] = useState<TreasuryTx | null>(null);
    const touchTimer = useRef<any>(null);
    // --- 4. DERIVATIONS ---
    const getClientFullName = getClientDisplayName;
    const { closeGlobalSearch, globalSearchQuery, globalSearchResults, handleOpenGlobalSearch, handleSelectGlobalSearchResult, isGlobalSearchOpen, setGlobalSearchQuery } = useGlobalSearch({
        clientTransactionsDzd,
        clientsDzd,
        getClientFullName,
        setDateRange,
        setFilterMode,
        setSelectedClientId,
        setView,
        t,
        transactions,
        treasuryTransactions,
        investors: derivedInvestors,
        setSelectedInvestorId,
    });
    const { prepareInvestorReport, handleExportPersonalExpensesReport, handleExportUsdtReport, reportClient, reportMonth, reportMonthNames, reportYear, setReportClient, setReportMonth, setReportYear, setUsdtReportMonth, setUsdtReportYear, usdtReportMonth, usdtReportYear } = useReportExports({
        clientTransactionsDzd,
        clientsDzd,
        derivedInvestors,
        getClientFullName,
        investorTransactions,
        loadPdfReports,
        managerFeePercentage,
        managerFeeHistory,
        portfolioStats,
        pamLedger,
        setAlert,
        t,
        transactions,
        deliveryExpenses,
        debtWriteOffs,
        personalExpenses
    });
    const findClientTransferCounterpartInState = (tx: ClientTransactionDzd | null) => {
        if (!tx || (tx.type !== 'Transfert Sortant' && tx.type !== 'Transfert Entrant'))
            return null;
        const counterpartType = tx.type === 'Transfert Sortant' ? 'Transfert Entrant' : 'Transfert Sortant';
        const counterpartAmount = -tx.montant;
        return clientTransactionsDzd.find((candidate) => candidate.id !== tx.id
            && candidate.clientId !== tx.clientId
            && candidate.type === counterpartType
            && candidate.date === tx.date
            && candidate.time === tx.time
            && Math.abs(candidate.montant - counterpartAmount) <= 0.01
            && Math.abs(candidate.timestamp - tx.timestamp) <= 1) || null;
    };
    const getEditableClientTransferBalance = (clientId: string) => {
        let balance = clientBalances.get(clientId) || 0;
        if (!editingTransferTx)
            return balance;
        const counterpart = findClientTransferCounterpartInState(editingTransferTx);
        if (editingTransferTx.clientId === clientId)
            balance -= editingTransferTx.montant;
        if (counterpart?.clientId === clientId)
            balance -= counterpart.montant;
        return balance;
    };
    const transferFromBalance = useMemo(() => (transferFromClientId ? getEditableClientTransferBalance(transferFromClientId) : 0), [clientBalances, clientTransactionsDzd, editingTransferTx, transferFromClientId]);
    const transferToBalance = useMemo(() => (transferToClientId ? getEditableClientTransferBalance(transferToClientId) : 0), [clientBalances, clientTransactionsDzd, editingTransferTx, transferToClientId]);
    const shouldComputeClientDerivations = view === 'dzd' || selectedClientId !== null;
    const deferredClientSearchQuery = React.useDeferredValue(clientSearchQuery);
    // Active clients matching the search; the Clients page counts its filter chips on this list.
    const searchedClientsDzd = useMemo(() => {
        if (!shouldComputeClientDerivations)
            return clientsDzd;
        let list = clientsDzd.filter(isClientActive);
        const normalizedQuery = deferredClientSearchQuery.trim().toLowerCase();
        if (normalizedQuery) {
            list = list.filter(c =>
                nameMatchesQuery(getClientDisplayName(c), normalizedQuery) ||
                (c.phone && c.phone.includes(normalizedQuery))
            );
        }
        return list;
    }, [shouldComputeClientDerivations, clientsDzd, deferredClientSearchQuery]);
    const filteredClientsDzd = useMemo(() => {
        if (!shouldComputeClientDerivations)
            return clientsDzd;
        // A copy: the list is sorted in place below.
        let list = searchedClientsDzd.slice();
        const ZERO_EPSILON = 0.005;
        let oldestDebtByClientId: Map<string, {
            oldestTimestamp: number;
            amount: number;
        }> | null = null;
        if (clientSortMode === 'debts_oldest_highest') {
            const txByClient = new Map<string, ClientTransactionDzd[]>();
            clientTransactionsDzd.forEach((tx) => {
                if (tx.affectsBalance === false)
                    return;
                const rows = txByClient.get(tx.clientId) || [];
                rows.push(tx);
                txByClient.set(tx.clientId, rows);
            });
            oldestDebtByClientId = new Map();
            txByClient.forEach((clientTxs, clientId) => {
                const debtQueue: Array<{
                    timestamp: number;
                    remaining: number;
                }> = [];
                let availableCredit = 0;
                clientTxs
                    .slice()
                    .sort((a, b) => a.timestamp - b.timestamp)
                    .forEach((tx) => {
                    const amount = Number(tx.montant || 0);
                    if (!Number.isFinite(amount) || Math.abs(amount) <= ZERO_EPSILON)
                        return;
                    if (amount < 0) {
                        let incomingDebt = Math.abs(amount);
                        if (availableCredit > ZERO_EPSILON) {
                            const consumedCredit = Math.min(availableCredit, incomingDebt);
                            availableCredit -= consumedCredit;
                            incomingDebt -= consumedCredit;
                        }
                        if (incomingDebt > ZERO_EPSILON) {
                            debtQueue.push({ timestamp: tx.timestamp, remaining: incomingDebt });
                        }
                        return;
                    }
                    let remainingPayment = amount;
                    while (remainingPayment > ZERO_EPSILON && debtQueue.length > 0) {
                        const oldestDebt = debtQueue[0];
                        const consumed = Math.min(remainingPayment, oldestDebt.remaining);
                        oldestDebt.remaining -= consumed;
                        remainingPayment -= consumed;
                        if (oldestDebt.remaining <= ZERO_EPSILON)
                            debtQueue.shift();
                    }
                    if (remainingPayment > ZERO_EPSILON) {
                        availableCredit += remainingPayment;
                    }
                });
                const openDebtLots = debtQueue.filter((lot) => lot.remaining > ZERO_EPSILON);
                if (openDebtLots.length === 0)
                    return;
                oldestDebtByClientId!.set(clientId, {
                    oldestTimestamp: openDebtLots[0].timestamp,
                    amount: openDebtLots.reduce((sum, lot) => sum + lot.remaining, 0)
                });
            });
        }
        if (clientSortMode === 'advances') {
            list = list.filter(c => (clientBalances.get(c.id) || 0) > ZERO_EPSILON);
        }
        else if (clientSortMode === 'debts' || clientSortMode === 'debts_oldest_highest') {
            list = list.filter(c => (clientBalances.get(c.id) || 0) < -ZERO_EPSILON);
        }
        else if (clientSortMode === 'zero_balance') {
            list = list.filter(c => Math.abs(clientBalances.get(c.id) || 0) <= ZERO_EPSILON);
        }
        if (clientSortMode === 'zero_balance') {
            list.sort((a, b) => getClientDisplayName(a).localeCompare(getClientDisplayName(b)));
        }
        else if (clientSortMode === 'debts_oldest_highest') {
            list.sort((a, b) => {
                const aMeta = oldestDebtByClientId?.get(a.id);
                const bMeta = oldestDebtByClientId?.get(b.id);
                const byOldest = (aMeta?.oldestTimestamp ?? Number.MAX_SAFE_INTEGER) - (bMeta?.oldestTimestamp ?? Number.MAX_SAFE_INTEGER);
                if (Math.abs(byOldest) > 1)
                    return byOldest;
                const byDebtAmount = Math.abs(clientBalances.get(b.id) || 0) - Math.abs(clientBalances.get(a.id) || 0);
                if (Math.abs(byDebtAmount) > ZERO_EPSILON)
                    return byDebtAmount;
                return getClientDisplayName(a).localeCompare(getClientDisplayName(b));
            });
        }
        else {
            list.sort((a, b) => {
                const aBalance = clientBalances.get(a.id) || 0;
                const bBalance = clientBalances.get(b.id) || 0;
                const byMagnitude = Math.abs(bBalance) - Math.abs(aBalance);
                if (Math.abs(byMagnitude) > ZERO_EPSILON)
                    return byMagnitude;
                const byValue = bBalance - aBalance;
                if (Math.abs(byValue) > ZERO_EPSILON)
                    return byValue;
                return getClientDisplayName(a).localeCompare(getClientDisplayName(b));
            });
        }
        return list;
    }, [shouldComputeClientDerivations, clientsDzd, searchedClientsDzd, clientSortMode, clientBalances, clientTransactionsDzd]);
    const selectedClient = useMemo(() => shouldComputeClientDerivations ? (clientsDzd.find(c => c.id === selectedClientId) || null) : null, [shouldComputeClientDerivations, clientsDzd, selectedClientId]);
    const selectedClientTransactions = useMemo(() => shouldComputeClientDerivations
        ? clientTransactionsDzd.filter(tx => tx.clientId === selectedClientId).sort((a, b) => b.timestamp - a.timestamp)
        : [], [shouldComputeClientDerivations, clientTransactionsDzd, selectedClientId]);
    const overdueDebtClients = useOverdueDebtClients({
        clients: shouldComputeClientDerivations ? clientsDzd : [],
        clientTransactions: shouldComputeClientDerivations ? clientTransactionsDzd : [],
        clientBalances,
        getClientFullName: getClientDisplayName,
        minDays: 7
    });
    const dashboardDebtClients = useOverdueDebtClients({
        clients: clientsDzd,
        clientTransactions: clientTransactionsDzd,
        clientBalances,
        getClientFullName: getClientDisplayName,
        minDays: -1
    });
    // M2: previously this was pamLedger.totals.derivedProfit (gross trading profit
    // before shared project expenses). The Dashboard label says "Net", so use the
    // post-expense netDistributableProfit from investorEconomics for honesty.
    const globalNetProfit = Number(investorEconomics.totals.netDistributableProfit || pamLedger.totals.derivedProfit || 0);
    const investorLiability = useMemo(() => calculateInvestorLiability(derivedInvestors), [derivedInvestors]);
    const investorBreakdown = useMemo(() => calculateInvestorBreakdown(derivedInvestors), [derivedInvestors]);
    const baseManagerProfitBreakdown = useMemo(() => getManagerProfitBreakdown(investorEconomics, managerFeePercentage), [investorEconomics, managerFeePercentage]);
    const dailyOverview = useMemo(() => {
        const now = new Date();
        const dayStart = new Date(now);
        dayStart.setHours(0, 0, 0, 0);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const yearStart = new Date(now.getFullYear(), 0, 1);
        const dayStartTs = dayStart.getTime();
        const monthStartTs = monthStart.getTime();
        const yearStartTs = yearStart.getTime();
        const nowTs = now.getTime();
        const dow = now.getDay(); // 0=Sun..6=Sat
        const daysToMon = dow === 0 ? 6 : dow - 1;
        const weekStartTs = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysToMon, 0, 0, 0, 0).getTime();
        let todayProfit = 0;
        let weekToDateProfit = 0;
        let monthToDateProfit = 0;
        let yearToDateProfit = 0;
        let allTimeProfit = 0;
        let todayUsdtSold = 0;
        let todayEurSold = 0;
        let monthToDateUsdtSold = 0;
        let monthToDateEurSold = 0;
        let yearToDateUsdtSold = 0;
        let yearToDateEurSold = 0;
        let allTimeUsdtSold = 0;
        let allTimeEurSold = 0;
        let todaySellCount = 0;
        // Last 7 days (index 0 = 6 days ago, index 6 = today)
        const last7DaysProfit = new Array(7).fill(0) as number[];
        const day7StartTs = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6).getTime();
        const activeClientIds = new Set<string>();
        const deriveOwnerTradingProfitForPeriod = (periodStartTs: number) => getManagerProfitBreakdown(deriveInvestorEconomics({
            investors,
            investorTransactions,
            transactions,
            managerFeePercentage,
            managerFeeHistory,
            pamLedger,
            periodStartTs,
            periodEndTs: nowTs,
            deliveryExpenses,
            debtWriteOffs,
            treasuryTransactions,
        }), managerFeePercentage).ownerTotalProfit;
        const serviceProfitForPeriod = (periodStartTs: number) => manualAssetTransactions.reduce((sum, tx) => {
            if (tx.timestamp < periodStartTs || tx.timestamp > nowTs)
                return sum;
            if (tx.type !== 'service' && tx.type !== 'invoice')
                return sum;
            const amount = Math.abs(Number(tx.amount || 0));
            return Number.isFinite(amount) ? sum + amount : sum;
        }, 0);
        const serviceProfitAllTime = manualAssetTransactions.reduce((sum, tx) => {
            if (tx.timestamp > nowTs || (tx.type !== 'service' && tx.type !== 'invoice'))
                return sum;
            const amount = Math.abs(Number(tx.amount || 0));
            return Number.isFinite(amount) ? sum + amount : sum;
        }, 0);
        const digitalServiceProfitForPeriod = (periodStartTs: number) => digitalServiceTransactions.reduce((sum, tx) => {
            if (tx.timestamp < periodStartTs || tx.timestamp > nowTs)
                return sum;
            const amount = Number(tx.profitDzd || 0);
            return Number.isFinite(amount) ? sum + amount : sum;
        }, 0);
        const digitalServiceProfitAllTime = digitalServiceTransactions.reduce((sum, tx) => {
            if (tx.timestamp > nowTs)
                return sum;
            const amount = Number(tx.profitDzd || 0);
            return Number.isFinite(amount) ? sum + amount : sum;
        }, 0);
        const ownerProfitToday = deriveOwnerTradingProfitForPeriod(dayStartTs) + serviceProfitForPeriod(dayStartTs) + digitalServiceProfitForPeriod(dayStartTs);
        const ownerProfitWeek = deriveOwnerTradingProfitForPeriod(weekStartTs) + serviceProfitForPeriod(weekStartTs) + digitalServiceProfitForPeriod(weekStartTs);
        const ownerProfitMonth = deriveOwnerTradingProfitForPeriod(monthStartTs) + serviceProfitForPeriod(monthStartTs) + digitalServiceProfitForPeriod(monthStartTs);
        const ownerProfitYear = deriveOwnerTradingProfitForPeriod(yearStartTs) + serviceProfitForPeriod(yearStartTs) + digitalServiceProfitForPeriod(yearStartTs);
        pamLedger.sellProfitRows.forEach((tx) => {
            if (tx.timestamp > nowTs)
                return;
            const derivedProfit = Number(tx.derivedProfit || 0);
            const quantity = Number(tx.quantity || 0);
            allTimeProfit += derivedProfit;
            if (tx.currency === 'EUR')
                allTimeEurSold += quantity;
            else
                allTimeUsdtSold += quantity;
            if (tx.timestamp >= weekStartTs) weekToDateProfit += derivedProfit;
            if (tx.timestamp >= dayStartTs) {
                todayProfit += derivedProfit;
                todaySellCount++;
                if (tx.currency === 'EUR')
                    todayEurSold += quantity;
                else
                    todayUsdtSold += quantity;
            }
            if (tx.timestamp >= monthStartTs) {
                monthToDateProfit += derivedProfit;
                if (tx.currency === 'EUR')
                    monthToDateEurSold += quantity;
                else
                    monthToDateUsdtSold += quantity;
            }
            if (tx.timestamp >= yearStartTs) {
                yearToDateProfit += derivedProfit;
                if (tx.currency === 'EUR')
                    yearToDateEurSold += quantity;
                else
                    yearToDateUsdtSold += quantity;
            }
            if (tx.timestamp >= day7StartTs) {
                const txDate = new Date(tx.timestamp);
                const dayDiff = Math.floor((txDate.getTime() - day7StartTs) / (1000 * 60 * 60 * 24));
                if (dayDiff >= 0 && dayDiff < 7)
                    last7DaysProfit[dayDiff] += derivedProfit;
            }
        });
        clientTransactionsDzd.forEach((tx) => {
            if (tx.timestamp >= dayStartTs && tx.timestamp <= nowTs) {
                activeClientIds.add(tx.clientId);
            }
        });
        return {
            caisse: treasuryStats.caisse,
            baridi: treasuryStats.baridi,
            activeClients: activeClientIds.size,
            todayProfit,
            todaySellCount,
            weekToDateProfit,
            monthToDateProfit,
            yearToDateProfit,
            allTimeProfit,
            todayUsdtSold,
            todayEurSold,
            monthToDateUsdtSold,
            monthToDateEurSold,
            yearToDateUsdtSold,
            yearToDateEurSold,
            allTimeUsdtSold,
            allTimeEurSold,
            ownerProfitToday,
            ownerProfitWeek,
            ownerProfitMonth,
            ownerProfitYear,
            ownerProfitAllTime: baseManagerProfitBreakdown.ownerTotalProfit + serviceProfitAllTime + digitalServiceProfitAllTime,
            last7DaysProfit,
        };
    }, [pamLedger, clientTransactionsDzd, treasuryStats, investors, investorTransactions, transactions, managerFeePercentage, managerFeeHistory, deliveryExpenses, debtWriteOffs, treasuryTransactions, manualAssetTransactions, digitalServiceTransactions, baseManagerProfitBreakdown]);
    const pricingMtdProfit = useMemo(() => {
        const d = new Date();
        const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
        const byCurrency = { USDT: 0, EUR: 0 };
        for (const row of pamLedger.sellProfitRows) {
            if (row.timestamp < monthStart) continue;
            byCurrency[row.currency] += Number(row.derivedProfit || 0);
        }
        return byCurrency;
    }, [pamLedger]);
    const derivedProfitLookup = useMemo(() => pamLedger.profitByTxId, [pamLedger]);
    // One canonical context per currency. V1 exposes USDT in the month-plan UI;
    // EUR keeps baseline pricing for the existing direct-sale flow.
    const smartPricingByCurrency = useMemo(() => ({
        USDT: buildPricingContext({
            transactions,
            clients: clientsDzd,
            clientTransactions: clientTransactionsDzd,
            currency: 'USDT',
            pam: portfolioStats.usdt.avgBuy,
            available: portfolioStats.usdt.available,
            plan: pricingPlanSync.plan,
            mtdProfit: pricingMtdProfit.USDT,
            policy: pricingPlanSync.policy,
            overrides: pricingPlanSync.overrides,
            derivedProfits: derivedProfitLookup,
        }),
        EUR: buildPricingContext({
            transactions,
            clients: clientsDzd,
            clientTransactions: clientTransactionsDzd,
            currency: 'EUR',
            pam: portfolioStats.eur.avgBuy,
            available: portfolioStats.eur.available,
            plan: {
                ...pricingPlanSync.plan,
                monthlyGoal: 0,
                minimumGoal: 0,
            },
            mtdProfit: pricingMtdProfit.EUR,
            policy: pricingPlanSync.policy,
            overrides: pricingPlanSync.overrides,
            derivedProfits: derivedProfitLookup,
        }),
    }), [transactions, clientsDzd, clientTransactionsDzd, portfolioStats.usdt.avgBuy, portfolioStats.usdt.available, portfolioStats.eur.avgBuy, portfolioStats.eur.available, pricingPlanSync.plan, pricingPlanSync.policy, pricingPlanSync.overrides, pricingMtdProfit, derivedProfitLookup]);
    const smartPricingCtx = smartPricingByCurrency.USDT;
    const servicesSummary = useMemo(() => {
        let amountToReceive = 0;
        let clientAdvances = 0;
        assetClientBalances.forEach((balance) => {
            if (balance < -0.005)
                amountToReceive += Math.abs(balance);
            else if (balance > 0.005)
                clientAdvances += balance;
        });
        const cashReceived = manualAssetTransactions.reduce((sum, tx) => sum + (tx.type === 'payment_received' ? Math.abs(Number(tx.amount || 0)) : 0), 0);
        const manualServiceRevenue = manualAssetTransactions.reduce((sum, tx) => sum + ((tx.type === 'service' || tx.type === 'invoice') ? Math.abs(Number(tx.amount || 0)) : 0), 0);
        const digitalServiceProfit = digitalServiceTransactions.reduce((sum, tx) => {
            const amount = Number(tx.profitDzd || 0);
            return Number.isFinite(amount) ? sum + amount : sum;
        }, 0);
        const serviceRevenue = manualServiceRevenue + digitalServiceProfit;
        const { servicesCapitalImpact } = calculateServicesCapitalImpact({ amountToReceive, clientAdvances });
        return {
            amountToReceive,
            clientAdvances,
            cashReceived,
            serviceRevenue,
            manualServiceRevenue,
            digitalServiceProfit,
            netCapitalImpact: servicesCapitalImpact,
            servicesCount: manualAssets.length,
            clientsCount: manualAssetClients.length
        };
    }, [assetClientBalances, manualAssetTransactions, digitalServiceTransactions, manualAssets.length, manualAssetClients.length]);
    const managerPendingAdvances = useMemo(
        () => personalExpenses
            .filter((tx) => tx.advanceState === 'pending')
            .reduce((sum, tx) => sum + Math.max(0, Number(tx.amount || 0)), 0),
        [personalExpenses]
    );
    const capitalSnapshot = useMemo(() => computeCapitalSnapshot({
        caisseBalance: treasuryStats.caisse,
        baridiBalance: treasuryStats.baridi,
        portfolioStats,
        totalDettes: totals.totalDettes,
        totalAvances: totals.totalAvances,
        treasuryCards,
        investorLiability,
        services: servicesSummary,
        managerPendingAdvances
    }), [treasuryStats, portfolioStats, totals, treasuryCards, investorLiability, servicesSummary, managerPendingAdvances]);
    const managerProfitBreakdown = useMemo(() => reconcileManagerProfitBreakdown({
        breakdown: baseManagerProfitBreakdown,
        openingCapital: OWNER_OPENING_CAPITAL,
        actualOwnerCapital: capitalSnapshot.netOwnedCapital,
        serviceProfit: servicesSummary.serviceRevenue,
        preTrackingPersonalExpenses: OWNER_PRE_TRACKING_EXPENSES,
    }), [baseManagerProfitBreakdown, capitalSnapshot.netOwnedCapital, servicesSummary.serviceRevenue]);
    const financialAudit = useMemo(() => {
        const personalExpenseTotals = summarizePersonalExpenseTotals(treasuryTransactions);
        return {
            openingCapital: OWNER_OPENING_CAPITAL,
            tradingOwnerProfit: managerProfitBreakdown.tradingOwnerProfit,
            serviceProfit: managerProfitBreakdown.serviceProfit,
            historicalPersonalExpenses: managerProfitBreakdown.personalExpenses,
            currentPersonalExpenses: personalExpenseTotals.current,
            totalPersonalExpenses: managerProfitBreakdown.totalPersonalExpenses,
            deliveryExpensesSinceStart: deliveryExpenses
                .filter((tx) => tx.timestamp <= Date.now())
                .reduce((sum, tx) => sum + Math.max(0, Number(tx.amountDzd ?? tx.amount ?? 0)), 0),
            actualOwnerCapital: managerProfitBreakdown.actualOwnerCapital,
        };
    }, [treasuryTransactions, deliveryExpenses, managerProfitBreakdown]);
    const readModelShadowDiagnostic = useMemo<DashboardReadModelShadowDiagnostic | null>(() => {
        if (!shadowDiagnosticsEnabled || readModelsMode !== 'shadow' || !isFinancialDataReady)
            return null;
        const readModels = buildDashboardReadModelShadowFromLegacy({
            transactions,
            clientsDzd,
            clientTransactionsDzd,
            treasuryTransactions,
            treasuryCards,
            manualAssets,
            manualAssetClients,
            manualAssetTransactions,
            digitalServiceTransactions,
            investors,
            investorTransactions,
            managerFeePercentage,
            managerFeeHistory,
            ownerOpeningCapital: OWNER_OPENING_CAPITAL,
            preTrackingPersonalExpenses: OWNER_PRE_TRACKING_EXPENSES,
            getClientFullName,
        });
        const reconciliation = reconcileDashboardReadModelsWithLegacy(readModels, {
            treasuryStats,
            portfolioStats,
            totals,
            investorBreakdown,
            investorLiability,
            capitalSnapshot,
            servicesSummary,
            dailyOverview,
            globalNetProfit,
            managerProfitBreakdown,
            financialAudit,
        });
        readModels.financial.reconciliationStatus = reconciliation.ok ? 'OK' : 'MISMATCH';
        return { mode: 'shadow', readModels, reconciliation };
    }, [
        readModelsMode,
        isFinancialDataReady,
        transactions,
        clientsDzd,
        clientTransactionsDzd,
        treasuryTransactions,
        treasuryCards,
        manualAssets,
        manualAssetClients,
        manualAssetTransactions,
        digitalServiceTransactions,
        investors,
        investorTransactions,
        managerFeePercentage,
        managerFeeHistory,
        treasuryStats,
        portfolioStats,
        totals,
        investorBreakdown,
        investorLiability,
        capitalSnapshot,
        servicesSummary,
        dailyOverview,
        globalNetProfit,
        managerProfitBreakdown,
        financialAudit,
    ]);
    useEffect(() => {
        if (typeof window === 'undefined')
            return;
        if (!readModelShadowDiagnostic) {
            delete window.__PRO_DIGITAL_READ_MODELS_SHADOW__;
            return;
        }
        window.__PRO_DIGITAL_READ_MODELS_SHADOW__ = readModelShadowDiagnostic;
        if (!readModelShadowDiagnostic.reconciliation.ok) {
            console.warn('Read Models shadow reconciliation mismatch', readModelShadowDiagnostic.reconciliation);
        }
    }, [readModelShadowDiagnostic]);
    /* Legacy global search logic moved to useGlobalSearch.
                id: `search_client_${client.id}`,
                kind: 'client' as const,
                title: getClientFullName(client),
                subtitle: [client.phone, client.redotpayId, client.binanceEmail].filter(Boolean).join(' · '),
                clientId: client.id,
                timestamp: latestClientActivity.get(client.id) || 0
            }));

        const txResults: GlobalSearchResult[] = [];

        transactions.forEach((tx) => {
            const linkedClientId = tx.id ? linkedClientByTxId.get(tx.id)?.clientId : undefined;
            const linkedClientName = linkedClientId ? (clientNameById.get(linkedClientId) || '') : '';
            const haystack = [
                tx.type,
                tx.currency,
                tx.notes || '',
                tx.date,
                tx.time,
                linkedClientName
            ].join(' ').toLowerCase();
            if (!haystack.includes(q)) return;

            const amountLabel = tx.currency === 'USDT'
                ? `${formatNumber(Number(tx.quantity || 0), { min: 0, max: 2 })} USDT`
                : `${formatNumber(Number(tx.quantity || 0), { min: 0, max: 2 })} EUR`;
            txResults.push({
                id: `search_usdt_${tx.id}`,
                kind: 'transaction',
                title: `${tx.type === 'buy' ? t('transactions.buy') : tx.type === 'sell' ? t('transactions.sell') : tx.type} ${tx.currency} · ${amountLabel}`,
                subtitle: [linkedClientName, `${tx.date} ${tx.time}`, tx.notes || ''].filter(Boolean).join(' · '),
                timestamp: tx.timestamp
            });
        });

        clientTransactionsDzd.forEach((tx) => {
            const clientName = clientNameById.get(tx.clientId) || t('portfolio.unknownClient');
            const haystack = [
                tx.type,
                tx.notes || '',
                tx.date,
                tx.time,
                tx.paymentMethod || '',
                clientName
            ].join(' ').toLowerCase();
            if (!haystack.includes(q)) return;

            txResults.push({
                id: `search_client_tx_${tx.id}`,
                kind: 'transaction',
                title: `${tx.type} · ${(tx.montant > 0 ? '+' : '')}${Number(tx.montant || 0).toFixed(2)} DZD`,
                subtitle: `${clientName} · ${tx.date} ${tx.time}`,
                timestamp: tx.timestamp
            });
        });

        treasuryTransactions.forEach((tx) => {
            const txData = tx as any;
            const haystack = [
                tx.type,
                tx.notes || '',
                tx.date,
                tx.time,
                txData.source || '',
                txData.destination || ''
            ].join(' ').toLowerCase();
            if (!haystack.includes(q)) return;

            const sourceLabel = txData.destination
                ? `${txData.source || ''} -> ${txData.destination || ''}`.trim()
                : (txData.source || '');
            txResults.push({
                id: `search_treasury_${tx.id}`,
                kind: 'transaction',
                title: `${tx.type} · ${Number(tx.amount || 0).toFixed(2)} DZD`,
                subtitle: [sourceLabel, `${tx.date} ${tx.time}`, tx.notes || ''].filter(Boolean).join(' · '),
                timestamp: tx.timestamp
            });
        });

        return [...clientResults, ...txResults]
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 20);
    }, [deferredGlobalSearchQuery, clientsDzd, clientTransactionsDzd, transactions, treasuryTransactions, t]);

    */
    // --- 5. UI HANDLERS ---
    const handleTouchStart = (c: ClientDzd) => { touchTimer.current = setTimeout(() => setSummaryClient(c), 800); };
    const handleTouchEnd = () => { if (touchTimer.current) {
        clearTimeout(touchTimer.current);
        touchTimer.current = null;
    } };
    const handleCopy = (val: string) => { navigator.clipboard.writeText(val); setCopiedValue(val); setTimeout(() => setCopiedValue(null), 2000); };
    const openDateFilterModal = () => { setTempStartDate(dateRange.start ? toDateInputValue(dateRange.start) : ''); setTempEndDate(dateRange.end ? toDateInputValue(dateRange.end) : ''); setIsDateFilterModalOpen(true); };
    const handleApplyDateFilter = () => { if (tempStartDate && tempEndDate) {
        const s = fromDateInputValue(tempStartDate);
        s.setHours(0, 0, 0, 0);
        const e = fromDateInputValue(tempEndDate);
        e.setHours(23, 59, 59, 999);
        setDateRange({ start: s, end: e });
        setIsDateFilterModalOpen(false);
    }
    else
        setAlert('⚠️ Dates incomplètes.'); };
    const handleClearDateFilter = () => { setDateRange({ start: null, end: null }); setIsDateFilterModalOpen(false); };
    const openTreasuryCardModal = (card: TreasuryCard | null = null) => {
        setEditingTreasuryCard(card);
        setTreasuryCardName(card ? card.name : '');
        setTreasuryCardValue(card ? card.value.toString() : '');
        setTreasuryCardNotes(card?.notes || '');
        setIsTreasuryCardModalOpen(true);
    };
    const closeWalletTransferModal = () => {
        setIsWalletTransferModalOpen(false);
        setEditingWalletTransferTx(null);
        setWalletTransferAmount('');
        setWalletTransferNotes('');
        setWalletTransferSource('Caisse');
        setWalletTransferDest('BaridiMob');
    };
    const openWalletTransferModal = (txToEdit: TreasuryTx | null = null) => {
        if (txToEdit) {
            const nextSource = txToEdit.source || 'Caisse';
            const nextDestination = txToEdit.destination || (nextSource === 'Caisse' ? 'BaridiMob' : 'Caisse');
            setEditingWalletTransferTx(txToEdit);
            setWalletTransferSource(nextSource);
            setWalletTransferDest(nextDestination);
            setWalletTransferAmount(Math.abs(Number(txToEdit.amount || 0)).toString());
            setWalletTransferNotes(txToEdit.notes || '');
        }
        else {
            setEditingWalletTransferTx(null);
            setWalletTransferSource('Caisse');
            setWalletTransferDest('BaridiMob');
            setWalletTransferAmount('');
            setWalletTransferNotes('');
        }
        setIsWalletTransferModalOpen(true);
    };
    const getTreasuryBalanceEditEffect = (tx: TreasuryTx | null) => {
        if (!tx)
            return 0;
        return tx.type === 'Retrait' ? -Math.abs(Number(tx.amount || 0)) : Math.abs(Number(tx.amount || 0));
    };
    const getPortfolioBalanceEditEffect = (tx: Tx | null) => {
        if (!tx)
            return 0;
        return tx.type === 'Retrait Manuel' ? -Math.abs(Number(tx.quantity || 0)) : Math.abs(Number(tx.quantity || 0));
    };
    const closeTreasuryBalanceEditModal = () => {
        setIsTreasuryBalanceEditModalOpen(false);
        setEditingTreasuryBalanceTx(null);
        setTreasuryBalanceEditNotes('');
    };
    const openTreasuryBalanceEditModal = (asset: 'Caisse' | 'BaridiMob', txToEdit: TreasuryTx | null = null) => {
        const currentBalance = asset === 'Caisse' ? treasuryStats.caisse : treasuryStats.baridi;
        setEditingTreasuryBalanceTx(txToEdit);
        setTreasuryBalanceEditAsset(asset);
        setTreasuryBalanceEditValue(Math.round(currentBalance).toString());
        setTreasuryBalanceEditNotes(txToEdit?.notes || '');
        setIsTreasuryBalanceEditModalOpen(true);
    };
    const closePortfolioBalanceEditModal = () => {
        setIsPortfolioBalanceEditModalOpen(false);
        setEditingPortfolioBalanceTx(null);
        setPortfolioBalanceEditNotes('');
    };
    const openPortfolioBalanceEditModal = (asset: 'USDT' | 'EUR', txToEdit: Tx | null = null) => {
        const currentBalance = asset === 'USDT' ? portfolioStats.usdt.available : portfolioStats.eur.available;
        const normalizedBalance = (Object.is(currentBalance, -0) || Math.abs(currentBalance) < 0.005) ? 0 : currentBalance;
        setEditingPortfolioBalanceTx(txToEdit);
        setPortfolioBalanceEditAsset(asset);
        setPortfolioBalanceEditValue(Number(normalizedBalance || 0).toFixed(2));
        setPortfolioBalanceEditNotes(txToEdit?.notes || '');
        setIsPortfolioBalanceEditModalOpen(true);
    };
    const getRelativeDateLabel = (dateStr: string) => dateStr === now().date ? t('transactions.today') : dateStr;
    /* Legacy navigation/search handlers moved to hooks.
    const navigateToView = (nextView: string) => {
        if (nextView === view) return;
        startTransition(() => {
            setView(nextView);
        });
    };
    const closeGlobalSearch = () => { setIsGlobalSearchOpen(false); setGlobalSearchQuery(''); };
    const handleOpenGlobalSearch = () => {
        void import('./components/main/MainDialogs');
        setIsGlobalSearchOpen(true);
    };
    const handleSelectGlobalSearchResult = (result: GlobalSearchResult) => {
        if (result.kind === 'client') {
            setSelectedClientId(result.clientId);
            startTransition(() => {
                setView('dzd');
            });
            closeGlobalSearch();
            return;
        }
        const dayStart = new Date(result.timestamp);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(result.timestamp);
        dayEnd.setHours(23, 59, 59, 999);
        startTransition(() => {
            setView('transactions');
            setFilterMode('all');
            setDateRange({ start: dayStart, end: dayEnd });
        });
        closeGlobalSearch();
    };

    */
    const handleSaveTreasuryBalanceEdit = async () => {
        const parsedNewVal = parseAndEvaluate(treasuryBalanceEditValue);
        if (isNaN(parsedNewVal) || parsedNewVal < 0) {
            setAlert(t('common.invalidAmount'));
            return;
        }
        const newVal = Math.round(parsedNewVal);
        setIsSaving(true);
        try {
            const currentVal = treasuryBalanceEditAsset === 'Caisse' ? treasuryStats.caisse : treasuryStats.baridi;
            const baseVal = Math.round(currentVal - getTreasuryBalanceEditEffect(editingTreasuryBalanceTx));
            const diff = Math.round(newVal - baseVal);
            const batch = db.batch();
            if (diff === 0) {
                if (editingTreasuryBalanceTx) {
                    recordTreasuryLegacyDeletionShadow({
                        operationId: `shadow:treasury-balance-delete:${editingTreasuryBalanceTx.id}`,
                        actorUid: userDocRef.id,
                        effectiveAt: Date.now(),
                        row: editingTreasuryBalanceTx,
                    });
                    batch.delete(userDocRef.collection('treasury_txs').doc(editingTreasuryBalanceTx.id));
                    const deletedEffect = -getTreasuryBalanceEditEffect(editingTreasuryBalanceTx);
                    await commitLegacyWithReadModelDeltas({
                        userDocRef,
                        batch,
                        deltas: [mustPrepareWriterReadModelDelta('treasury.adjustment', {
                            operationId: `legacy:treasury.adjustment:delete:${editingTreasuryBalanceTx.id}`,
                            effectiveAt: Date.now(),
                            payload: { type: 'treasury_balance_delete', txId: editingTreasuryBalanceTx.id, deletedEffect },
                            affectedSummaries: ['dashboard_summary', 'treasury_summary', 'financial_summary'],
                            wallets: { [editingTreasuryBalanceTx.source === 'BaridiMob' ? 'BaridiMob' : 'Caisse']: deletedEffect },
                            recentOperation: { operationId: `legacy:treasury.adjustment:delete:${editingTreasuryBalanceTx.id}`, source: 'legacy', type: 'Correction solde supprimée', effectiveAt: Date.now() },
                        })],
                    });
                    setAlert("✅ Correction supprimée.");
                }
                closeTreasuryBalanceEditModal();
                return;
            }
            const { date, time, timestamp } = now();
            const payload = {
                type: diff > 0 ? 'Ajout' : 'Retrait',
                source: treasuryBalanceEditAsset,
                amount: Math.abs(diff),
                asset: `DZD-${treasuryBalanceEditAsset}`,
                notes: `Correction Solde ${treasuryBalanceEditAsset}: ${treasuryBalanceEditNotes || 'Aucun motif'}`,
                date,
                time,
                timestamp,
                origin: 'balance_edit'
            };
            const txRef = editingTreasuryBalanceTx
                ? userDocRef.collection('treasury_txs').doc(editingTreasuryBalanceTx.id)
                : userDocRef.collection('treasury_txs').doc();
            recordTreasuryShadow({
                operationId: `shadow:treasury-balance-edit:${editingTreasuryBalanceTx?.id || timestamp}`,
                actorUid: userDocRef.id,
                effectiveAt: timestamp,
                kind: diff > 0 ? 'treasury_adjustment_in' : 'treasury_adjustment_out',
                wallet: treasuryBalanceEditAsset,
                amountDzd: Math.abs(diff),
            }, [{ type: diff > 0 ? 'Ajout' : 'Retrait', source: treasuryBalanceEditAsset, amount: Math.abs(diff) }]);
            if (editingTreasuryBalanceTx) {
                batch.update(txRef, payload);
            }
            else {
                batch.set(txRef, payload);
            }
            const oldEffect = getTreasuryBalanceEditEffect(editingTreasuryBalanceTx);
            const effectDelta = diff - oldEffect;
            await commitLegacyWithReadModelDeltas({
                userDocRef,
                batch,
                deltas: [mustPrepareWriterReadModelDelta('treasury.adjustment', {
                    operationId: `legacy:treasury.adjustment:${txRef.id}:${editingTreasuryBalanceTx ? 'update' : 'create'}`,
                    effectiveAt: timestamp,
                    payload: { type: 'treasury_balance_edit', txId: txRef.id, oldEffect, newEffect: diff, effectDelta },
                    affectedSummaries: ['dashboard_summary', 'treasury_summary', 'financial_summary'],
                    wallets: { [treasuryBalanceEditAsset]: effectDelta },
                    recentOperation: { operationId: `legacy:treasury.adjustment:${txRef.id}`, source: 'legacy', type: 'Correction solde', effectiveAt: timestamp },
                })],
            });
            setAlert("✅ Solde mis à jour.");
            closeTreasuryBalanceEditModal();
        }
        catch (e) {
            setAlert("❌ Erreur lors de la mise à jour du solde.");
        }
        finally {
            setIsSaving(false);
        }
    };
    const handleSavePortfolioBalanceEdit = async () => {
        const rawInput = portfolioBalanceEditValue.replace(',', '.').trim();
        const parsedInput = parseAndEvaluate(rawInput);
        if (isNaN(parsedInput)) {
            setAlert(t('common.invalidAmount'));
            return;
        }
        const currentValRaw = portfolioBalanceEditAsset === 'USDT'
            ? portfolioStats.usdt.available
            : portfolioStats.eur.available;
        const baseVal = Number((currentValRaw - getPortfolioBalanceEditEffect(editingPortfolioBalanceTx)).toFixed(2));
        const isSignedAdjustment = /^[+-]/.test(rawInput);
        const targetVal = isSignedAdjustment ? baseVal + parsedInput : parsedInput;
        const newVal = Math.abs(targetVal) < 0.005 ? 0 : Number(targetVal.toFixed(2));
        if (newVal < 0) {
            setAlert(`⚠️ Solde ${portfolioBalanceEditAsset} insuffisant.`);
            return;
        }
        setIsSaving(true);
        try {
            const diff = Number((newVal - baseVal).toFixed(2));
            if (Math.abs(diff) < 0.005) {
                if (editingPortfolioBalanceTx) {
                    const batch = db.batch();
                    batch.delete(userDocRef.collection('usdt_txs').doc(editingPortfolioBalanceTx.id));
                    await commitLegacyWithReadModelDeltas({ userDocRef, batch, deltas: [] });
                    setAlert(t('common.operationSuccess'));
                }
                closePortfolioBalanceEditModal();
                return;
            }
            const { date, time, timestamp } = operationStamp(editingPortfolioBalanceTx);
            const type = diff > 0 ? 'Ajout Manuel' : 'Retrait Manuel';
            const quantity = Math.abs(diff);
            const avgBuy = portfolioBalanceEditAsset === 'USDT'
                ? (portfolioStats.usdt.avgBuy || 0)
                : (portfolioStats.eur.avgBuy || 0);
            const getFallbackPrice = (currency: 'USDT' | 'EUR') => {
                const latestPricedTx = [...transactions]
                    .sort((a, b) => b.timestamp - a.timestamp)
                    .find((tx) => {
                    if (tx.currency !== currency)
                        return false;
                    if ((tx.type === 'buy' || tx.type === 'Ajout Manuel') && typeof tx.price === 'number' && tx.price > 0)
                        return true;
                    if (tx.type === 'sell' && typeof tx.sell === 'number' && tx.sell > 0)
                        return true;
                    return false;
                });
                if (latestPricedTx) {
                    if (latestPricedTx.type === 'sell')
                        return Number(latestPricedTx.sell || 0);
                    return Number(latestPricedTx.price || 0);
                }
                return 0;
            };
            const referencePrice = avgBuy > 0 ? avgBuy : getFallbackPrice(portfolioBalanceEditAsset);
            const txPayload: any = {
                timestamp,
                date,
                time,
                type,
                currency: portfolioBalanceEditAsset,
                quantity,
                notes: portfolioBalanceEditNotes.trim() || `Correction solde ${portfolioBalanceEditAsset} (${diff > 0 ? '+' : ''}${diff.toFixed(2)})`,
                origin: 'balance_edit'
            };
            if (editingPortfolioBalanceTx) {
                if (type === 'Ajout Manuel' && referencePrice > 0) {
                    txPayload.price = Number(referencePrice.toFixed(2));
                    txPayload.total = Number((quantity * referencePrice).toFixed(2));
                }
                else {
                    txPayload.price = fieldValueDelete();
                    txPayload.total = fieldValueDelete();
                }
                const batch = db.batch();
                batch.update(userDocRef.collection('usdt_txs').doc(editingPortfolioBalanceTx.id), txPayload);
                await commitLegacyWithReadModelDeltas({ userDocRef, batch, deltas: [] });
            }
            else {
                const batch = db.batch();
                const txRef = userDocRef.collection('usdt_txs').doc();
                if (type === 'Ajout Manuel' && referencePrice > 0) {
                    txPayload.price = Number(referencePrice.toFixed(2));
                    txPayload.total = Number((quantity * referencePrice).toFixed(2));
                }
                batch.set(txRef, txPayload);
                const valueDzd = Number((quantity * referencePrice).toFixed(2));
                await commitLegacyWithReadModelDeltas({
                    userDocRef,
                    batch,
                    deltas: [mustPrepareWriterReadModelDelta('portfolio.manual-adjustment', {
                        operationId: `legacy:portfolio.manual-adjustment:${txRef.id}`,
                        effectiveAt: timestamp,
                        payload: { type: 'portfolio_balance_correction', txId: txRef.id, currency: portfolioBalanceEditAsset, quantity, direction: type, valueDzd },
                        affectedSummaries: ['dashboard_summary', 'portfolio_summary', 'financial_summary'],
                        portfolio: {
                            [portfolioBalanceEditAsset]: {
                                quantityDelta: type === 'Ajout Manuel' ? quantity : -quantity,
                                costBasisDeltaDzd: type === 'Ajout Manuel' ? valueDzd : -Number((avgBuy * quantity).toFixed(2)),
                            },
                        },
                        recentOperation: {
                            operationId: `legacy:portfolio.manual-adjustment:${txRef.id}`,
                            source: 'legacy',
                            type: `Correction ${portfolioBalanceEditAsset}`,
                            effectiveAt: timestamp,
                        },
                    })],
                });
            }
            const valueDzd = Number((quantity * referencePrice).toFixed(2));
            const inventoryBefore = inventoryFromLegacyPortfolioStats(portfolioStats, portfolioBalanceEditAsset);
            const portfolioShadowWarnings = [
                ...(type === 'Ajout Manuel' && referencePrice <= 0 ? ['Legacy balance addition has no DZD value and cannot become a balanced V2 posting.'] : []),
                ...(editingPortfolioBalanceTx ? ['Legacy update replaces an existing Portfolio row; V2 immutable reversal is prepared only.'] : []),
            ];
            recordPortfolioShadow(type === 'Ajout Manuel' ? {
                operationId: `shadow:portfolio-balance-edit:${editingPortfolioBalanceTx?.id || timestamp}`,
                actorUid: userDocRef.id,
                effectiveAt: timestamp,
                kind: 'portfolio_manual_add',
                currency: portfolioBalanceEditAsset,
                quantity,
                inventoryBefore,
                valueDzd,
            } : {
                operationId: `shadow:portfolio-balance-edit:${editingPortfolioBalanceTx?.id || timestamp}`,
                actorUid: userDocRef.id,
                effectiveAt: timestamp,
                kind: 'portfolio_manual_remove',
                currency: portfolioBalanceEditAsset,
                quantity,
                inventoryBefore,
            }, {
                quantityDeltas: { [portfolioBalanceEditAsset]: type === 'Ajout Manuel' ? quantity : -quantity },
                costBasisDeltasDzd: { [portfolioBalanceEditAsset]: type === 'Ajout Manuel' ? valueDzd : -Number((avgBuy * quantity).toFixed(2)) },
                ...(portfolioShadowWarnings.length > 0 ? { warnings: portfolioShadowWarnings } : {}),
            });
            setAlert(t('common.operationSuccess'));
            closePortfolioBalanceEditModal();
        }
        catch (e) {
            setAlert(t('common.error'));
        }
        finally {
            setIsSaving(false);
        }
    };
    const handleEditClientTx = (tx: ClientTransactionDzd) => { if (tx.linkedTxId) {
        const l = transactions.find(t => t.id === tx.linkedTxId);
        if (l)
            openForm(l.type === 'buy' ? (l.currency === 'USDT' ? 'buy_usdt' : 'buy_eur') : (l.currency === 'USDT' ? 'sell_usdt' : 'sell_eur'), l);
        else
            openClientTxModal(tx);
    }
    else
        openClientTxModal(tx); };
    const handleDeleteClientTxClick = (tx: ClientTransactionDzd) => { if (tx.linkedTxId) {
        const l = transactions.find(t => t.id === tx.linkedTxId);
        if (l)
            setTxToDelete(l);
        else {
            setClientTxToDelete(tx);
        }
    }
    else
        setClientTxToDelete(tx); };
    const findLinkedParentTxForClientActions = (tx: ClientTransactionDzd): Tx | TreasuryTx | null => {
        if (!tx.linkedTxId)
            return null;
        if (tx.origin === 'adjustment') {
            return treasuryTransactions.find(t => t.id === tx.linkedTxId) ?? null;
        }
        return transactions.find(t => t.id === tx.linkedTxId) ?? null;
    };
    const handleEditLinkedClientTx = (tx: ClientTransactionDzd) => {
        if (refuseIfClosedMonth(tx.timestamp))
            return;
        if (tx.type === 'Transfert Sortant' || tx.type === 'Transfert Entrant') {
            openTransferModal(tx);
            return;
        }
        const linkedTx = findLinkedParentTxForClientActions(tx);
        if (!linkedTx) {
            openClientTxModal(tx);
            return;
        }
        if ('currency' in linkedTx) {
            openForm(linkedTx.type === 'buy'
                ? (linkedTx.currency === 'USDT' ? 'buy_usdt' : 'buy_eur')
                : (linkedTx.currency === 'USDT' ? 'sell_usdt' : 'sell_eur'), linkedTx);
            return;
        }
        openAdjustmentModal(linkedTx.type === 'Retrait' ? 'subtract' : 'add', linkedTx);
    };
    const handleDeleteLinkedClientTxClick = (tx: ClientTransactionDzd) => {
        if (refuseIfClosedMonth(tx.timestamp))
            return;
        if (tx.type === 'Transfert Sortant' || tx.type === 'Transfert Entrant') {
            setClientTxToDelete(tx);
            return;
        }
        const linkedTx = findLinkedParentTxForClientActions(tx);
        if (!linkedTx) {
            setClientTxToDelete(tx);
            return;
        }
        if ('currency' in linkedTx) {
            setTxToDelete(linkedTx);
            return;
        }
        setTreasuryTxToDelete(linkedTx);
    };
    const handleEditPortfolioTx = (tx: Tx) => {
        if (refuseIfClosedMonth(tx.timestamp))
            return;
        if (tx.linkedTxId) {
            const parentTx = transactions.find(t => t.id === tx.linkedTxId);
            if (parentTx) {
                handleEditPortfolioTx(parentTx);
                return;
            }
        }
        if (tx.type === 'Ajout Manuel' || tx.type === 'Retrait Manuel') {
            openPortfolioBalanceEditModal(tx.currency, tx);
            return;
        }
        openForm(tx.type === 'buy'
            ? (tx.currency === 'USDT' ? 'buy_usdt' : 'buy_eur')
            : (tx.currency === 'USDT' ? 'sell_usdt' : 'sell_eur'), tx);
    };
    const handleEditTreasuryTx = (tx: TreasuryTx) => {
        if (refuseIfClosedMonth(tx.timestamp))
            return;
        if (tx.type === 'Transfer') {
            openWalletTransferModal(tx);
            return;
        }
        if (tx.origin === 'balance_edit') {
            openTreasuryBalanceEditModal(tx.source === 'BaridiMob' ? 'BaridiMob' : 'Caisse', tx);
            return;
        }
        if (tx.origin === 'client_tx' && tx.linkedTxId) {
            const linkedClientTx = clientTransactionsDzd.find((clientTx) => clientTx.id === tx.linkedTxId);
            if (linkedClientTx) {
                handleEditLinkedClientTx(linkedClientTx);
            }
            else {
                setAlert("⚠️ Transaction cliente introuvable.");
            }
            return;
        }
        if (tx.origin === 'manual_asset') {
            const linkedAssetTx = manualAssetTransactions.find((assetTx) => assetTx.id === tx.linkedAssetTxId);
            if (!linkedAssetTx) {
                setAlert("⚠️ Transaction service introuvable.");
                return;
            }
            setSelectedAssetId(linkedAssetTx.actifId);
            setSelectedAssetClientId(linkedAssetTx.clientId);
            startTransition(() => {
                setView('services');
            });
            setAlert("ℹ️ La transaction source a été ouverte dans Services.");
            return;
        }
        if (tx.linkedTxId) {
            const linkedPortfolioTx = transactions.find((portfolioTx) => portfolioTx.id === tx.linkedTxId);
            if (linkedPortfolioTx) {
                handleEditPortfolioTx(linkedPortfolioTx);
                return;
            }
        }
        openAdjustmentModal(tx.type === 'Retrait' ? 'subtract' : 'add', tx);
    };
    const handleWalletTransfer = async () => {
        const amountInput = parseAndEvaluate(walletTransferAmount);
        const amount = Math.round(amountInput);
        if (isNaN(amountInput) || amount <= 0) {
            setAlert("⚠️ Montant invalide.");
            return;
        }
        if (walletTransferSource === walletTransferDest) {
            setAlert(t('common.sameSourceDest'));
            return;
        }
        let sourceBalance = walletTransferSource === 'Caisse' ? treasuryStats.caisse : treasuryStats.baridi;
        if (editingWalletTransferTx) {
            if (editingWalletTransferTx.source === walletTransferSource)
                sourceBalance += editingWalletTransferTx.amount;
            if (editingWalletTransferTx.destination === walletTransferSource)
                sourceBalance -= editingWalletTransferTx.amount;
        }
        if (amount > sourceBalance) {
            setAlert(t('common.insufficientBalance'));
            return;
        }
        setIsSaving(true);
        try {
            const ts = Date.now();
            const { date, time } = now();
            const payload = {
                type: 'Transfer',
                source: walletTransferSource,
                destination: walletTransferDest,
                asset: `From ${walletTransferSource} to ${walletTransferDest}`,
                amount,
                notes: walletTransferNotes || 'Transfert interne',
                date, time, timestamp: ts
            };
            recordTreasuryShadow({
                operationId: `shadow:wallet-transfer:${editingWalletTransferTx?.id || ts}`,
                actorUid: userDocRef.id,
                effectiveAt: ts,
                kind: 'treasury_transfer',
                from: walletTransferSource,
                to: walletTransferDest,
                amountDzd: amount,
            }, [{ type: 'Transfer', source: walletTransferSource, destination: walletTransferDest, amount }]);
            const batch = db.batch();
            const txRef = editingWalletTransferTx
                ? userDocRef.collection('treasury_txs').doc(editingWalletTransferTx.id)
                : userDocRef.collection('treasury_txs').doc();
            if (editingWalletTransferTx) {
                batch.update(txRef, payload);
                setAlert("✅ Transfert mis à jour.");
            }
            else {
                batch.set(txRef, payload);
                setAlert("✅ Transfert enregistré.");
            }
            const walletDeltas = { Caisse: 0, BaridiMob: 0 };
            if (editingWalletTransferTx) {
                const oldSource = editingWalletTransferTx.source === 'BaridiMob' ? 'BaridiMob' : 'Caisse';
                const oldDest = editingWalletTransferTx.destination === 'Caisse' ? 'Caisse' : 'BaridiMob';
                walletDeltas[oldSource] += Math.abs(Number(editingWalletTransferTx.amount || 0));
                walletDeltas[oldDest] -= Math.abs(Number(editingWalletTransferTx.amount || 0));
            }
            walletDeltas[walletTransferSource] -= amount;
            walletDeltas[walletTransferDest] += amount;
            await commitLegacyWithReadModelDeltas({
                userDocRef,
                batch,
                deltas: [mustPrepareWriterReadModelDelta('treasury.transfer', {
                    operationId: `legacy:treasury.transfer:${txRef.id}:${editingWalletTransferTx ? 'update' : 'create'}`,
                    effectiveAt: ts,
                    payload: { type: 'treasury_transfer', txId: txRef.id, from: walletTransferSource, to: walletTransferDest, amount, previous: editingWalletTransferTx || null },
                    affectedSummaries: ['dashboard_summary', 'treasury_summary', 'financial_summary'],
                    wallets: walletDeltas,
                    recentOperation: { operationId: `legacy:treasury.transfer:${txRef.id}`, source: 'legacy', type: 'Transfert interne', effectiveAt: ts },
                })],
            });
            closeWalletTransferModal();
        }
        catch (e) {
            setAlert("❌ Erreur lors du transfert.");
        }
        finally {
            setIsSaving(false);
        }
    };
    // Client-to-client transfer save wrapper: validates basic input, then delegates to the
    // clean handler in useClientHandlers. The legacy `handleSaveTransfer` (with inverted signs)
    // is intentionally NOT used for the new path; we keep it for the existing edit-existing flow.
    const handleClientToClientTransferSave = async () => {
        if (isSaving)
            return;
        const amount = parseAndEvaluate(transferAmount);
        if (!transferFromClientId || !transferToClientId) {
            setAlert('⚠️ Client source ou destination manquant.');
            return;
        }
        if (transferFromClientId === transferToClientId) {
            setAlert('⚠️ Le client source et le client destination doivent être différents.');
            return;
        }
        if (!Number.isFinite(amount) || amount <= 0) {
            setAlert('⚠️ Le montant doit être strictement positif.');
            return;
        }
        const ok = await handleClientToClientTransfer({
            fromClientId: transferFromClientId,
            toClientId: transferToClientId,
            amount,
            date: transferDate,
            time: transferTime,
            notes: transferNotes,
        });
        if (ok) {
            closeTransferModal();
        }
    };
    const handleSwapSourceDest = () => { const s = walletTransferSource; const d = walletTransferDest; setWalletTransferSource(d); setWalletTransferDest(s); };
    const getWalletTransferEditableBalance = (account: 'Caisse' | 'BaridiMob') => {
        let balance = account === 'Caisse' ? treasuryStats.caisse : treasuryStats.baridi;
        if (editingWalletTransferTx) {
            if (editingWalletTransferTx.source === account)
                balance += editingWalletTransferTx.amount;
            if (editingWalletTransferTx.destination === account)
                balance -= editingWalletTransferTx.amount;
        }
        return balance;
    };
    const handleWalletTransferMaxClick = () => {
        const max = getWalletTransferEditableBalance(walletTransferSource);
        setWalletTransferAmount(Math.max(0, Math.floor(max)).toString());
    };
    const walletTransferAmountValue = parseAndEvaluate(walletTransferAmount);
    const walletTransferSourceBalance = getWalletTransferEditableBalance(walletTransferSource);
    const isWalletTransferInvalid = isSaving
        || !walletTransferAmount
        || isNaN(walletTransferAmountValue)
        || walletTransferAmountValue <= 0
        || walletTransferAmountValue > walletTransferSourceBalance
        || walletTransferSource === walletTransferDest;
    /* Legacy report export handlers moved to useReportExports.
    const handleExportPersonalExpensesReport = async (periodKey: 'day' | 'week' | 'month' | 'year') => {
        const { buildPersonalExpensesPdfReport, openPdfPrintWindow } = await loadPdfReports();
        const nowTs = Date.now();
        const d = new Date(nowTs);

        // Compute period boundaries
        let periodStart: number;
        let periodEnd: number;
        let periodLabel: string;

        if (periodKey === 'day') {
            const sd = new Date(d);
            sd.setHours(0, 0, 0, 0);
            periodStart = sd.getTime();
            const ed = new Date(sd);
            ed.setHours(23, 59, 59, 999);
            periodEnd = ed.getTime();
            periodLabel = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        } else if (periodKey === 'week') {
            const sd = new Date(d);
            const dow = sd.getDay();
            const diff = dow === 0 ? -6 : 1 - dow;
            sd.setDate(sd.getDate() + diff);
            sd.setHours(0, 0, 0, 0);
            periodStart = sd.getTime();
            const ed = new Date(sd);
            ed.setDate(ed.getDate() + 6);
            ed.setHours(23, 59, 59, 999);
            periodEnd = ed.getTime();
            periodLabel = `Semaine du ${sd.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;
        } else if (periodKey === 'month') {
            const sd = new Date(d.getFullYear(), d.getMonth(), 1);
            periodStart = sd.getTime();
            periodEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
            periodLabel = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        } else {
            const sd = new Date(d.getFullYear(), 0, 1);
            periodStart = sd.getTime();
            periodEnd = new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999).getTime();
            periodLabel = String(d.getFullYear());
        }

        // Compute previous period total
        const prevStart = (() => {
            const ps = new Date(periodStart);
            if (periodKey === 'day') { ps.setDate(ps.getDate() - 1); ps.setHours(0, 0, 0, 0); return ps.getTime(); }
            if (periodKey === 'week') { ps.setDate(ps.getDate() - 7); return ps.getTime(); }
            if (periodKey === 'month') { return new Date(ps.getFullYear(), ps.getMonth() - 1, 1).getTime(); }
            return new Date(ps.getFullYear() - 1, 0, 1).getTime();
        })();
        const prevEnd = (() => {
            if (periodKey === 'day') { const e = new Date(prevStart); e.setHours(23, 59, 59, 999); return e.getTime(); }
            if (periodKey === 'week') { const e = new Date(prevStart); e.setDate(e.getDate() + 6); e.setHours(23, 59, 59, 999); return e.getTime(); }
            if (periodKey === 'month') { const e = new Date(prevStart); return new Date(e.getFullYear(), e.getMonth() + 1, 0, 23, 59, 59, 999).getTime(); }
            return new Date(new Date(prevStart).getFullYear(), 11, 31, 23, 59, 59, 999).getTime();
        })();

        const netExpense = (tx: any): number => {
            if (tx.origin === 'personal_expense_return') return 0;
            if (tx.advanceState === 'settled') return Number(tx.settledAmount || 0);
            return Number(tx.amount || 0);
        };
        const previousPeriodTotal = personalExpenses
            .filter((tx) => tx.timestamp >= prevStart && tx.timestamp <= prevEnd && tx.advanceState !== 'pending' && tx.origin !== 'personal_expense_return')
            .reduce((sum, tx) => sum + netExpense(tx), 0);

        const managerInvestor = derivedInvestors.find((inv) => inv.isManager === true);
        const managerProfitAvailable = Number(managerInvestor?.availableProfit || 0);

        const report = buildPersonalExpensesPdfReport({
            expenses: personalExpenses,
            periodLabel,
            periodKey,
            periodStart,
            periodEnd,
            previousPeriodTotal,
            managerProfitAvailable
        });

        const opened = openPdfPrintWindow(report);
        if (!opened) {
            setAlert("❌ Impossible d'ouvrir l'apercu PDF.");
            return;
        }
        const isMobile = /android|iphone|ipad|ipod|mobile/i.test(window.navigator.userAgent || '');
        setAlert(isMobile
            ? "✅ Rapport dépenses ouvert. Appuyez sur 'Enregistrer PDF' dans la page."
            : "✅ Rapport dépenses prêt. Enregistrez en PDF depuis l'impression.");
    };

    const handleExportClientReport = async (cId: string, m: number, y: number) => {
        if (!cId) {
            setAlert("⚠️ Selectionnez un client.");
            return;
        }
        const monthLabels = Array.isArray(t('common.months')) ? (t('common.months') as any as string[]) : [];
        const { buildClientPdfReport, openPdfPrintWindow } = await loadPdfReports();
        const report = buildClientPdfReport({
            clientId: cId,
            month: m,
            year: y,
            monthLabel: monthLabels[m] || `${m + 1}`,
            clients: clientsDzd,
            clientTransactions: clientTransactionsDzd,
            transactions,
            clientBalance: clientBalances.get(cId) || 0,
            getClientName: getClientFullName
        });

        if (!report) {
            setAlert("❌ Client introuvable.");
            return;
        }

        const opened = openPdfPrintWindow(report);
        if (!opened) {
            setAlert("❌ Impossible d'ouvrir l'apercu PDF.");
            return;
        }
        const isMobile = /android|iphone|ipad|ipod|mobile/i.test(window.navigator.userAgent || '');
        setAlert(isMobile
            ? "✅ Rapport client ouvert. Appuyez sur 'Enregistrer PDF' dans la page."
            : "✅ Rapport client pret. Enregistrez en PDF depuis l'impression.");
    };
    const handleExportUsdtReport = async () => {
        const monthLabels = Array.isArray(t('common.months')) ? (t('common.months') as any as string[]) : [];
        const { buildMonthlyPdfReport, openPdfPrintWindow } = await loadPdfReports();
        const pamLedger = computePamLedger(transactions);
        const report = buildMonthlyPdfReport({
            month: usdtReportMonth,
            year: usdtReportYear,
            monthLabel: monthLabels[usdtReportMonth] || `${usdtReportMonth + 1}`,
            transactions,
            clientTransactions: clientTransactionsDzd,
            clients: clientsDzd,
            getClientName: getClientFullName,
            portfolioStats,
            pamLedger
        });
        const opened = openPdfPrintWindow(report);
        if (!opened) {
            setAlert("❌ Impossible d'ouvrir l'apercu PDF.");
            return;
        }
        const isMobile = /android|iphone|ipad|ipod|mobile/i.test(window.navigator.userAgent || '');
        setAlert(isMobile
            ? "✅ Rapport mensuel ouvert. Appuyez sur 'Enregistrer PDF' dans la page."
            : "✅ Rapport mensuel pret. Enregistrez en PDF depuis l'impression.");
    };
    const handleExportInvestorReport = async (investorId: string) => {
        const investor = derivedInvestors.find((item) => item.id === investorId);
        if (!investor) {
            setAlert("❌ Investisseur introuvable.");
            return;
        }

        const { buildInvestorPdfReport, openPdfPrintWindow } = await loadPdfReports();
        const report = buildInvestorPdfReport({
            investor,
            investorTransactions: investorTransactions.filter((tx) => tx.investorId === investorId)
        });
        const opened = openPdfPrintWindow(report);
        if (!opened) {
            setAlert("❌ Impossible d'ouvrir l'apercu PDF.");
            return;
        }
        const isMobile = /android|iphone|ipad|ipod|mobile/i.test(window.navigator.userAgent || '');
        setAlert(isMobile
            ? "✅ Rapport investisseur ouvert. Appuyez sur 'Enregistrer PDF' dans la page."
            : "✅ Rapport investisseur pret. Enregistrez en PDF depuis l'impression.");
    };
    */
    const handleSaveTreasuryCard = async () => {
        const name = treasuryCardName.trim();
        const value = parseAndEvaluate(treasuryCardValue);
        const notes = treasuryCardNotes.trim();
        if (!name) {
            setAlert(`⚠️ ${t('common.fillAllFields')}`);
            return;
        }
        if (isNaN(value) || value < 0) {
            setAlert(`⚠️ ${t('common.invalidAmount')}`);
            return;
        }
        setIsSaving(true);
        try {
            const payload = { name, value: Number(value.toFixed(2)), notes };
            const batch = db.batch();
            const cardRef = editingTreasuryCard
                ? userDocRef.collection('treasury_cards').doc(editingTreasuryCard.id)
                : userDocRef.collection('treasury_cards').doc();
            if (editingTreasuryCard) {
                batch.update(cardRef, payload);
            }
            else {
                batch.set(cardRef, payload);
            }
            const previousValue = Number(editingTreasuryCard?.value || 0);
            const nextValue = Number(value.toFixed(2));
            await commitLegacyWithReadModelDeltas({
                userDocRef,
                batch,
                deltas: [mustPrepareWriterReadModelDelta('treasury.cards', {
                    operationId: `legacy:treasury.cards:${cardRef.id}:${editingTreasuryCard ? 'update' : 'create'}`,
                    effectiveAt: Date.now(),
                    payload: { type: 'treasury_card_save', cardId: cardRef.id, previousValue, nextValue },
                    affectedSummaries: ['dashboard_summary', 'treasury_summary', 'financial_summary'],
                    treasuryCardsDelta: nextValue - previousValue,
                })],
            });
            setAlert(`✅ ${t('common.operationSuccess')}`);
            setIsTreasuryCardModalOpen(false);
            setEditingTreasuryCard(null);
            setTreasuryCardName('');
            setTreasuryCardValue('');
            setTreasuryCardNotes('');
        }
        catch (e) {
            setAlert(`❌ ${t('common.error')}`);
        }
        finally {
            setIsSaving(false);
        }
    };
    const handleDeleteTreasuryCard = async () => {
        if (!treasuryCardToDelete)
            return;
        setIsSaving(true);
        try {
            const batch = db.batch();
            batch.delete(userDocRef.collection('treasury_cards').doc(treasuryCardToDelete.id));
            await commitLegacyWithReadModelDeltas({
                userDocRef,
                batch,
                deltas: [mustPrepareWriterReadModelDelta('treasury.cards', {
                    operationId: `legacy:treasury.cards:${treasuryCardToDelete.id}:delete`,
                    effectiveAt: Date.now(),
                    payload: { type: 'treasury_card_delete', cardId: treasuryCardToDelete.id, previousValue: treasuryCardToDelete.value || 0 },
                    affectedSummaries: ['dashboard_summary', 'treasury_summary', 'financial_summary'],
                    treasuryCardsDelta: -Number(treasuryCardToDelete.value || 0),
                })],
            });
            setAlert(`✅ ${t('common.operationSuccess')}`);
            setTreasuryCardToDelete(null);
        }
        catch (e) {
            setAlert(`❌ ${t('common.error')}`);
        }
        finally {
            setIsSaving(false);
        }
    };
    const handleDeleteTreasuryTxConfirm = async () => {
        if (!treasuryTxToDelete)
            return;
        if (treasuryTxToDelete.origin === 'investor_profit_withdrawal' && treasuryTxToDelete.linkedInvestorTxId) {
            setIsSaving(true);
            try {
                const batch = db.batch();
                recordTreasuryLegacyDeletionShadow({
                    operationId: `shadow:treasury-delete:${treasuryTxToDelete.id}`,
                    actorUid: userDocRef.id,
                    effectiveAt: Date.now(),
                    row: treasuryTxToDelete,
                });
                batch.delete(userDocRef.collection('treasury_txs').doc(treasuryTxToDelete.id));
                batch.delete(userDocRef.collection('investor_transactions').doc(treasuryTxToDelete.linkedInvestorTxId));
                await commitLegacyWithReadModelDeltas({
                    userDocRef,
                    batch,
                    deltas: [],
                });
                setAlert('✅ Retrait investisseur supprimé.');
            }
            catch (e) {
                console.error(e);
                setAlert('❌ Erreur pendant la suppression.');
            }
            finally {
                setIsSaving(false);
                setTreasuryTxToDelete(null);
            }
            return;
        }
        await handleDeleteTx(treasuryTxToDelete.id, 'treasury_tx');
        setTreasuryTxToDelete(null);
        return;
        // Treasury rows can be child transactions. Delete their parent when possible
        // to keep balances and linked records consistent.
        if (treasuryTxToDelete.origin === 'manual_asset') {
            if (!treasuryTxToDelete.linkedAssetTxId) {
                setAlert("⚠️ Transaction liée à un service introuvable.");
                setTreasuryTxToDelete(null);
                return;
            }
            await handleDeleteTx(treasuryTxToDelete.linkedAssetTxId, 'asset_tx');
            setTreasuryTxToDelete(null);
            return;
        }
        if (treasuryTxToDelete.linkedTxId) {
            if (treasuryTxToDelete.origin === 'client_tx') {
                await handleDeleteTx(treasuryTxToDelete.linkedTxId, 'client_tx');
            }
            else {
                // Legacy treasury rows generated from USDT/EUR operations may not have origin.
                await handleDeleteTx(treasuryTxToDelete.linkedTxId, 'usdt_tx');
            }
            setTreasuryTxToDelete(null);
            return;
        }
        await handleDeleteTx(treasuryTxToDelete.id, 'treasury_tx');
        setTreasuryTxToDelete(null);
    };
    const handleUpdateAssetTransaction = async (txId: string, data: Omit<ManualAssetTransaction, 'id'>) => {
        const amount = Number(data.amount);
        if (!Number.isFinite(amount) || amount === 0) {
            setAlert(t('common.invalidAmount'));
            return;
        }
        setIsSaving(true);
        try {
            const txRef = userDocRef.collection('actifTransactions').doc(txId);
            const existingDoc = await txRef.get();
            if (!existingDoc.exists) {
                setAlert("⚠️ Transaction introuvable.");
                return;
            }
            const existing = existingDoc.data() as any;
            const shouldLinkTreasury = data.type === 'payment_received' && (data.paymentMethod === 'cash' || data.paymentMethod === 'baridi');
            const source = data.paymentMethod === 'cash' ? 'Caisse' : 'BaridiMob';
            const clientName = manualAssetClients.find(c => c.id === data.clientId)?.fullName || 'Client';
            const assetName = manualAssets.find(a => a.id === data.actifId)?.name || 'Service';
            const treasuryPayload = {
                timestamp: data.timestamp,
                date: data.date,
                time: data.time,
                type: 'Ajout',
                source,
                amount: Math.abs(amount),
                notes: `Paiement ${clientName} - ${assetName}`,
                origin: 'manual_asset',
                linkedAssetTxId: txId
            };
            const batch = db.batch();
            const txUpdatePayload: any = { ...data, amount };
            const linkedTreasuryId = existing?.linkedTreasuryTxId as string | undefined;
            if (shouldLinkTreasury) {
                if (linkedTreasuryId) {
                    batch.update(userDocRef.collection('treasury_txs').doc(linkedTreasuryId), treasuryPayload);
                }
                else {
                    const newTreasuryRef = userDocRef.collection('treasury_txs').doc();
                    batch.set(newTreasuryRef, treasuryPayload);
                    txUpdatePayload.linkedTreasuryTxId = newTreasuryRef.id;
                }
                recordTreasuryShadow({
                    operationId: `shadow:manual-asset-update:${txId}`,
                    actorUid: userDocRef.id,
                    effectiveAt: data.timestamp,
                    kind: 'manual_asset_receipt_cash',
                    wallet: source,
                    amountDzd: Math.abs(amount),
                    clientId: data.clientId,
                }, [{ type: 'Ajout', source, amount: Math.abs(amount) }]);
            }
            else if (linkedTreasuryId) {
                const treasurySnapshot = await userDocRef.collection('treasury_txs').doc(linkedTreasuryId).get();
                if (treasurySnapshot.exists) {
                    recordTreasuryLegacyDeletionShadow({
                        operationId: `shadow:manual-asset-unlink:${txId}:${linkedTreasuryId}`,
                        actorUid: userDocRef.id,
                        effectiveAt: Date.now(),
                        row: treasurySnapshot.data(),
                    });
                }
                batch.delete(userDocRef.collection('treasury_txs').doc(linkedTreasuryId));
                txUpdatePayload.linkedTreasuryTxId = fieldValueDelete();
            }
            batch.update(txRef, txUpdatePayload);
            await commitLegacyWithReadModelDeltas({
                userDocRef,
                batch,
                deltas: [],
            });
            setAlert(t('common.operationSuccess'));
        }
        catch (e) {
            console.error(e);
            setAlert(t('common.error'));
        }
        finally {
            setIsSaving(false);
        }
    };
    const handleDeleteAssetTransaction = async (id: string) => {
        setIsSaving(true);
        try {
            const txRef = userDocRef.collection('actifTransactions').doc(id);
            const docSnap = await txRef.get();
            if (!docSnap.exists) {
                setAlert("⚠️ Transaction introuvable.");
                return;
            }
            const txData = docSnap.data() as any;
            const batch = db.batch();
            batch.delete(txRef);
            if (txData?.linkedTreasuryTxId) {
                const treasurySnapshot = await userDocRef.collection('treasury_txs').doc(txData.linkedTreasuryTxId).get();
                if (treasurySnapshot.exists) {
                    recordTreasuryLegacyDeletionShadow({
                        operationId: `shadow:manual-asset-delete:${id}:${treasurySnapshot.id}`,
                        actorUid: userDocRef.id,
                        effectiveAt: Date.now(),
                        row: treasurySnapshot.data(),
                    });
                }
                batch.delete(userDocRef.collection('treasury_txs').doc(txData.linkedTreasuryTxId));
            }
            else {
                const linkedTreasury = await userDocRef.collection('treasury_txs').where('linkedAssetTxId', '==', id).get();
                linkedTreasury.forEach(d => {
                    recordTreasuryLegacyDeletionShadow({
                        operationId: `shadow:manual-asset-delete:${id}:${d.id}`,
                        actorUid: userDocRef.id,
                        effectiveAt: Date.now(),
                        row: d.data(),
                    });
                    batch.delete(d.ref);
                });
            }
            await commitLegacyWithReadModelDeltas({
                userDocRef,
                batch,
                deltas: [],
            });
            setAlert(t('common.operationSuccess'));
        }
        catch (e) {
            console.error(e);
            setAlert(t('common.error'));
        }
        finally {
            setIsSaving(false);
        }
    };
    const handleClientDeleteRequest = (client: ClientDzd | null) => {
        if (client) {
            void requestClientDelete(client);
            return;
        }
        closeClientDeleteDialog();
    };
    const handleDeleteConfirm = () => handleConfirmDeleteTx();
    const handleDeleteClientTxConfirm = async () => {
        if (!clientTxToDelete)
            return;
        if (clientTxToDelete.type === 'Transfert Sortant' || clientTxToDelete.type === 'Transfert Entrant') {
            const counterpart = findClientTransferCounterpartInState(clientTxToDelete);
            setIsSaving(true);
            try {
                const batch = db.batch();
                batch.delete(userDocRef.collection('dzd_client_txs').doc(clientTxToDelete.id));
                if (counterpart) {
                    batch.delete(userDocRef.collection('dzd_client_txs').doc(counterpart.id));
                }
                await commitLegacyWithReadModelDeltas({
                    userDocRef,
                    batch,
                    deltas: [],
                });
                setAlert("✅ Transaction supprimée.");
            }
            catch (e) {
                console.error(e);
                setAlert("❌ Erreur lors de la suppression.");
            }
            finally {
                setIsSaving(false);
                setClientTxToDelete(null);
            }
            return;
        }
        await handleDeleteTx(clientTxToDelete.id, 'client_tx');
        setClientTxToDelete(null);
    };
    const handleInvestorTransaction = async () => handleSaveInvestorTx();
    const handleDeleteInvestorTx = async () => {
        if (!investorTxToDelete)
            return;
        if (investorTxToDelete.origin === 'personal_expense' && investorTxToDelete.linkedTreasuryTxId) {
            const treasuryTxId = investorTxToDelete.linkedTreasuryTxId;
            setInvestorTxToDelete(null);
            await handleDeleteTx(treasuryTxId, 'treasury_tx');
            return;
        }
        setIsSaving(true);
        try {
            const batch = db.batch();
            batch.delete(userDocRef.collection('investor_transactions').doc(investorTxToDelete.id));
            if (investorTxToDelete.linkedTreasuryTxId) {
                batch.delete(userDocRef.collection('treasury_txs').doc(investorTxToDelete.linkedTreasuryTxId));
            }
            const owner = investors.find((investor) => investor.id === investorTxToDelete.investorId);
            const profileReset = owner ? investorResetForDeletedRow(investorTxToDelete, owner, investorTransactions) : null;
            if (owner && profileReset) {
                batch.update(userDocRef.collection('investors').doc(owner.id), profileReset);
            }
            await commitLegacyWithReadModelDeltas({
                userDocRef,
                batch,
                deltas: [],
            });
            setAlert('✅ Transaction investisseur supprimée.');
        }
        catch (e) {
            console.error(e);
            setAlert('❌ Erreur pendant la suppression.');
        }
        finally {
            setIsSaving(false);
            setInvestorTxToDelete(null);
        }
    };
    const handleGlobalReset = async () => {
        if (readModelsMode === 'read') {
            setAlert('⚠️ Réinitialisation globale désactivée en mode Read Models.');
            setIsResetModalOpen(false);
            return;
        }
        // The reset deletes collection by collection: checking here avoids a half-done reset
        // that stops at the first closed operation.
        if (periodLockRef.current.lockedThrough !== null) {
            setAlert(t('periodLock.resetRefused') as string);
            setIsResetModalOpen(false);
            return;
        }
        setIsSaving(true);
        try {
            const colls = ['usdt_txs', 'treasury_txs', 'dzd_clients', 'dzd_client_txs', 'treasury_cards', 'manual_assets', 'manual_asset_clients', 'actifTransactions', 'investors', 'investor_transactions'];
            for (const c of colls) {
                const qs = await userDocRef.collection(c).get();
                let batch = db.batch();
                let count = 0;
                for (const d of qs.docs) {
                    batch.delete(d.ref);
                    count++;
                    if (count >= 400) {
                        await batch.commit();
                        batch = db.batch();
                        count = 0;
                    }
                }
                await batch.commit();
            }
            setAlert("✅ Application réinitialisée.");
            setRefreshKey(prev => prev + 1);
            setIsResetModalOpen(false);
        }
        catch (e) {
            setAlert("❌ Erreur lors de la réinitialisation.");
        }
        finally {
            setIsSaving(false);
        }
    };
    const bgApp = "bg-app-bg text-neutral-900";
    const fieldBase = "bg-surface-muted border-border text-neutral-900 focus:ring-primary";
    const alertTone = detectAlertTone(alert);
    const activeAlertUndo = alertUndo && alertUndo.message === alert ? alertUndo : null;
    const dismissAlert = useCallback(() => setAlert(''), []);
    // Confirmations leave by themselves; errors and warnings stay until the user closes them.
    useEffect(() => {
        if (!alert)
            return;
        const duration = alertToastDurationMs(alert, alertTone, Boolean(activeAlertUndo));
        if (duration === null)
            return;
        const timer = window.setTimeout(() => setAlert(''), duration);
        return () => window.clearTimeout(timer);
    }, [alert, alertTone, activeAlertUndo]);
    /* Legacy persisted navigation/search effects moved to hooks.
    useEffect(() => {
        const p = window.location.pathname;
        if (p.startsWith('/investor')) { setIsInvestorRoute(true); const s = new URLSearchParams(window.location.search); setInvestorIdFromUrl(s.get('id')); }
        else setIsInvestorRoute(false);
    }, []);

    useEffect(() => { localStorage.setItem('app_view', view); }, [view]);
    useEffect(() => { if (selectedClientId) localStorage.setItem('selected_client_id', selectedClientId); else localStorage.removeItem('selected_client_id'); }, [selectedClientId]);
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                setIsGlobalSearchOpen(true);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    const reportMonthNames = useMemo(() => {
        const months = Array.isArray(t('common.months')) ? t('common.months') as any as string[] : [];
        return months;
    }, [t]);

    */
    // Smart-engine reference sell prices (target for a normal cash deal) —
    // the single pricing source since the legacy suggested-price system was removed.
    const smartTargetPrices = useMemo(() => {
        const target = (currency: 'USDT' | 'EUR') => quoteSale(smartPricingByCurrency[currency], {
            currency, clientId: null, quantity: 300, payment: { kind: 'cash' },
        }).targetPrice;
        return { usdt: target('USDT'), eur: target('EUR') };
    }, [smartPricingByCurrency]);
    const portfolioPageProps = useMemo(() => ({
        statsView,
        setStatsView,
        setIsSettingsModalOpen,
        portfolioStats,
        totalPortfolioValue: ((portfolioStats.usdt.available + (portfolioStats.usdt.locked || 0)) * portfolioStats.usdt.avgBuy + (portfolioStats.eur.available + (portfolioStats.eur.locked || 0)) * portfolioStats.eur.avgBuy),
        smartTargetUsdt: smartTargetPrices.usdt,
        smartTargetEur: smartTargetPrices.eur,
        parseAndEvaluate,
        usdtReportMonth,
        setUsdtReportMonth,
        usdtReportYear,
        setUsdtReportYear,
        reportMonths: (year: number) => year === new Date().getFullYear() ? reportMonthNames.slice(0, new Date().getMonth() + 1) : reportMonthNames,
        // 2024 up to the current year, so a new year can be picked as soon as it starts.
        reportYears: Array.from({ length: Math.max(2026, new Date().getFullYear()) - 2023 }, (_, i) => 2024 + i),
        monthlyStats: { totalUsdtSoldMonth: 0, totalEurBoughtMonth: 0, realizedProfitMonth: 0, monthlyProfitMargin: 0 },
        transactions,
        selectedHeatmapDay,
        setSelectedHeatmapDay,
        fieldBase,
        handleExportUsdtReport,
        dzdDashboardStats: null,
        reportClient,
        setReportClient,
        clientsDzd,
        clientTransactionsDzd,
        getClientFullName,
        reportMonth,
        setReportMonth,
        reportYear,
        setReportYear,
        openPortfolioBalanceEditModal
    }), [
        statsView, portfolioStats, smartTargetPrices,
        usdtReportMonth, usdtReportYear, transactions, clientTransactionsDzd, selectedHeatmapDay,
        fieldBase,
        reportClient, clientsDzd, reportMonth, reportYear, reportMonthNames,
        getClientFullName, handleExportUsdtReport, openPortfolioBalanceEditModal
    ]);
    // Bulk-import clients from CSV. Skips duplicates by name or phone, creates
    // an initial-balance ledger entry when an `initialBalance` column is mapped.
    const handleImportClients = async (rows: Record<string, string>[]): Promise<void> => {
        if (!rows || rows.length === 0)
            return;
        const existingNames = new Set(clientsDzd.map(c => clientNameKey(c.fullName || c.nom)).filter(Boolean));
        const existingPhones = new Set(clientsDzd.map(c => clientPhoneKey(c.phone)).filter(Boolean));
        let added = 0, skipped = 0;
        for (const row of rows) {
            const fullName = (row.fullName || '').trim();
            if (!fullName) {
                skipped++;
                continue;
            }
            const phone = (row.phone || '').trim();
            const nameKey = clientNameKey(fullName);
            const phoneKey = clientPhoneKey(phone);
            if (existingNames.has(nameKey) || (phoneKey && existingPhones.has(phoneKey))) {
                skipped++;
                continue;
            }
            // Also guard against the same client appearing twice in one CSV file.
            existingNames.add(nameKey);
            if (phoneKey)
                existingPhones.add(phoneKey);
            const data: any = {
                fullName,
                phone,
                redotpayId: (row.redotpayId || '').trim(),
                binanceEmail: (row.binanceEmail || '').trim(),
                nom: fullName,
            };
            try {
                const ref = await userDocRef.collection('dzd_clients').add(data);
                const initBalRaw = (row.initialBalance || '').trim().replace(/,/g, '.');
                const initBal = initBalRaw ? Number(initBalRaw) : 0;
                if (!isNaN(initBal) && initBal !== 0) {
                    const { date, time, timestamp } = now();
                    recordClientShadow({
                        operationId: `shadow:csv-client-initial-balance:${ref.id}:${timestamp}`,
                        actorUid: userDocRef.id,
                        effectiveAt: timestamp,
                        kind: 'client_initial_balance',
                        clientId: ref.id,
                        amountDzd: initBal,
                        positionBefore: clientPositionFromLegacyRows([], ref.id, timestamp),
                        reason: 'Import CSV',
                        counterpartAccount: 'equity.client_opening_balance',
                    }, { clientDeltas: { [ref.id]: initBal } });
                    await userDocRef.collection('dzd_client_txs').add({
                        clientId: ref.id, timestamp, date, time,
                        type: 'Solde Initial', montant: initBal, notes: 'Import CSV', paymentMethod: 'Crédit'
                    });
                }
                existingNames.add(fullName.toLowerCase());
                if (phoneKey)
                    existingPhones.add(phoneKey);
                added++;
            }
            catch (e) {
                console.error('CSV import row failed:', e);
                skipped++;
            }
        }
        setAlert(`✅ Import: ${added} ajouté${added > 1 ? 's' : ''}, ${skipped} ignoré${skipped > 1 ? 's' : ''}.`);
    };
    // Client loyalty scores — computed from last 30 days activity
    // Re-use earlyClientLoyaltyMap for badges (same logic, same deps — React will share the result)
    const clientLoyaltyMap = earlyClientLoyaltyMap;
    const openClientToClientTransferModal = React.useCallback((sourceClient: ClientDzd) => {
        const stamp = now();
        const [day, month, year] = stamp.date.split('/');
        openTransferModal(null);
        setTransferFromClientId(sourceClient.id);
        setTransferToClientId('');
        setTransferAmount('');
        setTransferNotes('');
        setTransferDate(year && month && day ? `${year}-${month}-${day}` : '');
        setTransferTime(stamp.time);
    }, [openTransferModal, setTransferAmount, setTransferDate, setTransferFromClientId, setTransferNotes, setTransferTime, setTransferToClientId]);

    const clientsPageProps = useMemo(() => ({
        selectedClientId,
        setSelectedClientId,
        openClientModal,
        setIsTransferModalOpen,
        clientSearchQuery,
        setClientSearchQuery,
        clientSortMode,
        setClientSortMode,
        clientsDzd,
        filteredClientsDzd,
        searchedClientsDzd,
        clientBalances,
        getClientFullName,
        handleTouchStart,
        handleTouchEnd,
        setClientToDelete: handleClientDeleteRequest,
        selectedClient,
        selectedClientTransactions,
        clientTransactionsDzd,
        transactions,
        profitByTxId: pamLedger.profitByTxId,
        openClientTxModal,
        copiedValue,
        handleCopy,
        handleEditClientTx: handleEditLinkedClientTx,
        handleDeleteClientTxClick: handleDeleteLinkedClientTxClick,
        overdueDebtClients,
        clientLoyaltyMap,
        clientPrevMonthVolume: earlyClientPrevMonthVolumeMap,
        clientLastSellDate: earlyClientLastSellDateMap,
        handleZeroOutBalance,
        onImportClients: handleImportClients,
    }), [
        selectedClientId, clientSearchQuery, clientSortMode,
        clientsDzd, filteredClientsDzd, searchedClientsDzd, clientBalances, selectedClient, selectedClientTransactions, clientTransactionsDzd, transactions, pamLedger.profitByTxId, copiedValue,
        openClientModal, handleTouchStart, handleTouchEnd, handleClientDeleteRequest, openClientTxModal,
        handleCopy, handleEditLinkedClientTx, handleDeleteLinkedClientTxClick, overdueDebtClients, clientLoyaltyMap,
        earlyClientPrevMonthVolumeMap, earlyClientLastSellDateMap, handleZeroOutBalance
    ]);
    if (isInvestorRoute) {
        if (!isFinancialDataReady) {
            return <div className="min-h-screen flex items-center justify-center bg-app-bg text-neutral-500">{t('common.loading')}</div>;
        }
        const investor = derivedInvestors.find(i => i.id === investorIdFromUrl) || derivedInvestors[0];
        if (!investor) {
            return (<div className="min-h-screen flex items-center justify-center bg-app-bg text-neutral-500">
                    {derivedInvestors.length === 0 ? t('investorDashboard.loadingData') : t('investorDashboard.notFound')}
                </div>);
        }
        const myTransactions = investorTransactions.filter(tx => tx.investorId === investor.id);
        const totalCapital = derivedInvestors.reduce((sum, inv) => sum + (inv.isActive ? inv.capitalInvested : 0), 0);
        return (<Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-app-bg text-neutral-500">{t('common.loading')}</div>}>
                <InvestorDashboardPage investor={investor} transactions={myTransactions} globalNetProfit={globalNetProfit} managerFeePercentage={Number(managerFeePercentage)} totalCapital={totalCapital} prepareReport={prepareInvestorReport}/>
            </Suspense>);
    }
    // Quick sell: pre-fills sell form with max qty (price comes from the smart panel)
    const openQuickSell = React.useCallback(() => {
        const usdtAvail = portfolioStats.usdt.available;
        const usdtPam = portfolioStats.usdt.avgBuy;
        if (usdtAvail <= 0 || usdtPam <= 0) {
            openForm('sell_usdt');
            return;
        }
        navigateToView('transactions');
        setTimeout(() => {
            openForm('sell_usdt', null, {
                sellQty: usdtAvail.toFixed(2),
            });
        }, 80); // let navigation settle first
    }, [portfolioStats.usdt.available, portfolioStats.usdt.avgBuy, openForm, navigateToView]);
    const openSmartSale = React.useCallback((prefill: PrefillSell) => {
        navigateToView('transactions');
        window.setTimeout(() => openForm('sell_usdt', null, prefill), 80);
    }, [navigateToView, openForm]);

    const navLabels = useMemo(() => ({
        dashboard: t('nav.dashboard') as string || 'Accueil',
        transactions: t('nav.transactions') as string,
        portfolio: t('nav.portfolio') as string,
        analytics: t('nav.analytics') as string,
        reports: t('nav.reports') as string || 'Rapports',
        clients: t('nav.clients') as string,
        treasury: t('nav.treasury') as string,
        services: t('nav.services') as string || 'Services',
        investors: t('nav.investors') as string || 'Investisseurs',
        more: t('nav.more') as string || 'Plus',
        settings: t('common.settings') as string || 'Parametres',
        money: t('nav.money') as string || 'Argent',
        followUp: t('nav.followUp') as string || 'Suivi',
        documents: t('nav.documents') as string || 'Documents',
        expenses: t('nav.expenses') as string || 'Mes dépenses',
        logout: t('common.logout') as string || 'Déconnexion',
        newOperation: t('transactions.newTransaction') as string || 'Nouvelle opération'
    }), [t]);
    const openServicesView = () => {
        setSelectedAssetId(null);
        setSelectedAssetClientId(null);
        setView('services');
    };
    const openClientsWithDebtFollowUp = () => {
        setSelectedClientId(null);
        setClientSearchQuery('');
        setClientSortMode('debts_oldest_highest');
        setView('dzd');
    };
    const openDashboardClient = (clientId: string) => {
        setClientSearchQuery('');
        setSelectedClientId(clientId);
        setView('dzd');
    };
    // Monthly recap: shown from the first visit of a new month until dismissed (kept in localStorage).
    const { recap: monthlyRecap, dismiss: dismissMonthlyRecap } = useMonthlyRecap(transactions, pamLedger);

    // Notifications
    const [showNotifBanner, setShowNotifBanner] = React.useState(false);
    const notifications = useNotifications(userDocRef, t);

    // Offer notifications once (after 30s) if not yet asked and supported
    React.useEffect(() => {
        if (!notifications.isSupported || notifications.permAsked || notifications.permission !== 'default') return;
        const timer = setTimeout(() => setShowNotifBanner(true), 30_000);
        return () => clearTimeout(timer);
    }, [notifications.isSupported, notifications.permAsked, notifications.permission]);

    // Auto-trigger overdue + distribution notifications
    React.useEffect(() => {
        if (notifications.permission !== 'granted') return;
        // Overdue
        if (overdueDebtClients.length > 0) {
            notifications.notifyOverdueClients(
                overdueDebtClients.length,
                overdueDebtClients.map(c => c.fullName)
            );
        }
        // Investor profit
        const totalAvailable = derivedInvestors
            .filter(i => i.isActive && !i.isManager)
            .reduce((s, i) => s + Number(i.availableProfit || 0), 0);
        if (totalAvailable > 10_000) {
            notifications.notifyInvestorProfit(totalAvailable);
        }
    }, [notifications.permission, overdueDebtClients, derivedInvestors]);
    // Investors' quarterly terms on the phone: once a day, without the ones put off with « remind me
    // in 3 days », and only after the server answered so a decision saved on another phone counts.
    React.useEffect(() => {
        if (notifications.permission !== 'granted' || !investorTermsSynced) return;
        notifications.notifyInvestorTerms(investorTerms.reminders);
    }, [notifications.permission, investorTermsSynced, investorTerms.reminders]);
    // A term reminder on the home page opens the investor's page with the existing window on top,
    // as the same buttons do on that page.
    const openInvestorTermWindow = (investorId: string, action: 'reinvest' | 'withdraw') => {
        const investor = derivedInvestors.find((item) => item.id === investorId);
        if (!investor)
            return;
        setSelectedInvestorId(investorId);
        setView('investors');
        if (action === 'reinvest') {
            setReinvestInput((investor.availableProfit || 0).toFixed(2));
            setIsReinvestModalOpen(true);
            return;
        }
        setInvestorTxType('withdraw_profit');
        setIsInvestorTxModalOpen(true);
    };
    const { recap: weeklyRecap, dismiss: dismissWeeklyRecap } = useWeeklyRecap({
        transactions,
        clientTransactionsDzd,
        clientsDzd,
        getClientFullName,
        providedPamLedger: pamLedger,
    });
    // Recaps and the notification request appear among the dashboard alerts.
    const enableNotifications = async () => {
        const result = await notifications.requestPermission();
        setShowNotifBanner(false);
        return result;
    };
    const dismissNotificationPrompt = () => {
        setShowNotifBanner(false);
        localStorage.setItem('app_notification_perm_asked', '1');
    };
    const dashboardSummary = shouldUseDashboardReadModel ? dashboardSummaryRead.dashboardSummary : null;
    const dashboardDailyOverview = dashboardSummary?.dailyOverview ?? dailyOverview;
    const dashboardManagerProfitBreakdown = dashboardSummary?.investors.managerProfitBreakdown ?? managerProfitBreakdown;
    const dashboardFinancialAudit = dashboardSummary?.financialAudit ?? financialAudit;
    const dashboardPortfolioStats = useMemo(() => {
        if (!dashboardSummary)
            return portfolioStats;
        return {
            usdt: dashboardSummary.portfolio.usdt,
            eur: dashboardSummary.portfolio.eur,
        };
    }, [dashboardSummary, portfolioStats]);
    const dashboardTreasuryStats = useMemo(() => {
        if (!dashboardSummary)
            return treasuryStats;
        return {
            caisse: dashboardSummary.money.caisseBalance,
            baridi: dashboardSummary.money.baridiBalance,
        };
    }, [dashboardSummary, treasuryStats]);
    const dashboardTotals = useMemo(() => {
        if (!dashboardSummary)
            return totals;
        return {
            totalDettes: -Math.abs(Number(dashboardSummary.money.clientReceivables || 0)),
            totalAvances: Math.abs(Number(dashboardSummary.money.clientAdvances || 0)),
        };
    }, [dashboardSummary, totals]);
    const dashboardInvestorBreakdown = dashboardSummary?.investors.investorBreakdown ?? investorBreakdown;
    const dashboardInvestorLiability = dashboardSummary?.money.investorLiability ?? investorLiability;
    const dashboardCapitalSnapshot = dashboardSummary?.capitalSnapshot ?? capitalSnapshot;
    const dashboardServicesSummary = dashboardSummary?.services ?? servicesSummary;
    const effectiveDashboardDebtClients = dashboardSummary?.clients.topOverdueClients.items ?? dashboardDebtClients;
    const dashboardCanQuickSell = Number(dashboardPortfolioStats?.usdt?.available || 0) > 0;
    const dashboardPageProps = {
        dailyOverview: dashboardDailyOverview,
        managerProfitBreakdown: dashboardManagerProfitBreakdown,
        financialAudit: dashboardFinancialAudit,
        portfolioStats: dashboardPortfolioStats,
        treasuryStats: dashboardTreasuryStats,
        totals: dashboardTotals,
        treasuryCards: dashboardSummary ? [] : treasuryCards,
        investorLiability: dashboardInvestorLiability,
        investorBreakdown: dashboardInvestorBreakdown,
        capitalSnapshot: dashboardCapitalSnapshot,
        servicesSummary: dashboardServicesSummary,
        globalNetProfit,
        overdueDebtClients: effectiveDashboardDebtClients,
        overdueDebtClientCount: dashboardSummary?.clients.topOverdueClients.itemCount ?? dashboardDebtClients.length,
        isDataReady: isFinancialDataReady,
        onNewTransaction: () => openForm('buy_usdt'),
        onOpenClients: () => { setSelectedClientId(null); setView('dzd'); },
        onOpenClient: openDashboardClient,
        onOpenClientDebts: openClientsWithDebtFollowUp,
        onOpenTreasury: () => setView('tresorerie'),
        onOpenAnalytics: () => setView('analytics'),
        onOpenPersonalWithdrawal: openPersonalWithdrawalModal,
        transactions: dashboardSummary ? EMPTY_TRANSACTIONS : transactions,
        clientTransactionsDzd: dashboardSummary ? EMPTY_CLIENT_TRANSACTIONS_DZD : clientTransactionsDzd,
        clientsDzd: dashboardSummary ? EMPTY_CLIENTS_DZD : clientsDzd,
        treasuryTransactions: dashboardSummary ? EMPTY_TREASURY_TRANSACTIONS : treasuryTransactions,
        profitByTxId: dashboardSummary ? EMPTY_PROFIT_BY_TX_ID : pamLedger.profitByTxId,
        getRelativeDateLabel,
        getClientFullName,
        openForm,
        openAdjustmentModal,
        setTxToDelete,
        handleEditPortfolioTx,
        handleEditClientTx: handleEditLinkedClientTx,
        handleEditTreasuryTx,
        handleDeleteClientTxClick: handleDeleteLinkedClientTxClick,
        setTreasuryTxToDelete,
        onOpenTransactions: () => setView('transactions'),
        onQuickSell: dashboardCanQuickSell ? openQuickSell : undefined,
        quickSellPreview: dashboardCanQuickSell ? {
            qty: dashboardPortfolioStats.usdt.available,
            price: smartTargetPrices.usdt > 0 ? smartTargetPrices.usdt : dashboardPortfolioStats.usdt.avgBuy,
            pam: dashboardPortfolioStats.usdt.avgBuy,
        } : null,
        onOpenMonthPlan: () => setIsMonthPlanOpen(true),
        monthlyGoal: monthlyGoalState,
        weeklyRecap,
        onDismissWeeklyRecap: dismissWeeklyRecap,
        monthlyRecap,
        onDismissMonthlyRecap: dismissMonthlyRecap,
        showNotificationPrompt: showNotifBanner && notifications.permission === 'default',
        onEnableNotifications: enableNotifications,
        onDismissNotificationPrompt: dismissNotificationPrompt,
        investorTerms: investorTerms.reminders,
        onInvestorTermReinvest: (investorId: string) => openInvestorTermWindow(investorId, 'reinvest'),
        onInvestorTermWithdraw: (investorId: string) => openInvestorTermWindow(investorId, 'withdraw'),
        onInvestorTermSnooze: investorTerms.snooze,
    };
    // Deleting, or opening the edit form of, an operation of a closed month is refused at once.
    const unlessClosedMonth = <T extends { timestamp?: unknown } | null>(open: (item: T) => unknown) => (item: T) => {
        if (item && refuseIfClosedMonth(item.timestamp))
            return;
        return open(item);
    };
    const mainContentProps = { t, dailyOverview, userDocRef, setAlert, isFinancialDataReady, view, DashboardPage, dashboardPageProps, TransactionsPage, openAdjustmentModal, openForm, filterMode, setFilterMode, transactions, digitalServiceTransactions, profitByTxId: pamLedger.profitByTxId, getRelativeDateLabel, clientTransactionsDzd, clientsDzd, getClientFullName, setTxToDelete: unlessClosedMonth<Tx | TreasuryTx | null>(setTxToDelete), openDateFilterModal, dateRange, setDateRange, openNewOperationMenu, openDeliveryExpenseModal, openDigitalServiceModal: unlessClosedMonth<DigitalServiceTransaction | null>(openDigitalServiceModal), handleDeleteDigitalService: unlessClosedMonth<DigitalServiceTransaction>(handleDeleteDigitalService), treasuryTransactions, handleEditPortfolioTx, handleEditClientTx: handleEditLinkedClientTx, handleEditTreasuryTx, handleDeleteClientTxClick: handleDeleteLinkedClientTxClick, setTreasuryTxToDelete: unlessClosedMonth<TreasuryTx | null>(setTreasuryTxToDelete), PortfolioPage, portfolioPageProps, AnalyticsPage, PersonalExpensesPage, personalExpenses, managerAvailableProfit, managerExists, openReconcileAdvanceModal: unlessClosedMonth<TreasuryTx>(openReconcileAdvanceModal), openEditPersonalExpense: unlessClosedMonth<TreasuryTx>(openEditPersonalExpense), setPersonalExpenseToDelete: unlessClosedMonth<TreasuryTx | null>(setPersonalExpenseToDelete), handleExportPersonalExpensesReport, ClientsPage, clientsPageProps, openClientToClientTransferModal, ServicesPage, selectedAssetClientId, ManualClientPage, manualAssetClients, manualAssetTransactions, assetClientBalances, selectedAssetId, setSelectedAssetClientId, handleCreateAssetTransaction, handleUpdateAssetTransaction, handleDeleteAssetTransaction, fieldBase, ManualAssetPage, manualAssets, handleCreateAssetClient, handleUpdateAssetClient, handleDeleteAssetClient, TresoreriePage, treasuryStats, totals, portfolioStats, investorLiability, investorBreakdown, capitalSnapshot, globalNetProfit, managerProfitBreakdown, financialAudit, openTreasuryCardModal, treasuryCards, setTreasuryCardToDelete, openTreasuryBalanceEditModal, openPortfolioBalanceEditModal, assetBalances, servicesSummary, openServicesView, setSelectedAssetId, setIsCreateAssetModalOpen, handleDeleteAsset, selectedInvestorId, setSelectedInvestorId, InvestorDetailsPage, derivedInvestors, investorTransactions, investorEconomicsTotals: investorEconomics.totals, setInvestorTxType, setIsInvestorTxModalOpen, setReinvestInput, setIsReinvestModalOpen, setInvestorTxToDelete: unlessClosedMonth<InvestorTransaction | null>(setInvestorTxToDelete), managerFeePercentage, InvestorsPage, openInvestorModal, setInvestorToDelete, saveManagerFeePercentage, prepareInvestorReport, handleApplyLock24hToRecentBuys, periodLock: periodLockProps, investorTermsByInvestorId: investorTerms.byInvestorId };
    const walletTransferDialogProps = useMemo(() => ({
        isOpen: isWalletTransferModalOpen, onClose: closeWalletTransferModal, fieldBase,
        amount: walletTransferAmount, setAmount: setWalletTransferAmount, source: walletTransferSource, setSource: setWalletTransferSourceAndSync,
        destination: walletTransferDest, setDestination: setWalletTransferDest, notes: walletTransferNotes, setNotes: setWalletTransferNotes,
        onMax: handleWalletTransferMaxClick, onSwap: handleSwapSourceDest, onConfirm: handleWalletTransfer, isInvalid: isWalletTransferInvalid,
        isSaving, caisseBalance: getWalletTransferEditableBalance('Caisse'), baridiBalance: getWalletTransferEditableBalance('BaridiMob'), title: editingWalletTransferTx ? `${t('common.edit')} ${t('transactions.internalTransferShort')}` : t('transactions.internalTransferShort'),
        subtitle: `${t('transactions.cash')} ↔ ${t('transactions.baridi')}`, amountLabel: t('transactions.amount'), fromLabel: t('transactions.from'),
        toLabel: t('transactions.to'), sourceLabel: t('common.source'), destinationLabel: t('common.destination'),
        notesOptionalLabel: t('common.notesOptional'), sameAccountErrorText: t('formErrors.sameWallet'),
        processingText: t('common.processing'), confirmText: editingWalletTransferTx ? t('common.save') : t('transactions.confirmTransfer')
    }), [isWalletTransferModalOpen, closeWalletTransferModal, fieldBase, walletTransferAmount, walletTransferSource, walletTransferDest, walletTransferNotes, setWalletTransferSourceAndSync, handleWalletTransferMaxClick, handleSwapSourceDest, handleWalletTransfer, isWalletTransferInvalid, isSaving, editingWalletTransferTx, treasuryStats.caisse, treasuryStats.baridi, t]);
    const clientTransferDialogProps = useMemo(() => ({
        isOpen: isTransferModalOpen, onClose: closeTransferModal, fieldBase,
        fromClientId: transferFromClientId, setFromClientId: setTransferFromClientId, toClientId: transferToClientId, setToClientId: setTransferToClientId,
        amount: transferAmount, setAmount: setTransferAmount, notes: transferNotes, setNotes: setTransferNotes,
        onSave: editingTransferTx ? handleSaveTransfer : handleClientToClientTransferSave,
        isSaving, clients: selectableClients(clientsDzd, [transferFromClientId, transferToClientId]).map(c => ({ id: c.id, label: getClientFullName(c) })), fromBalance: transferFromBalance,
        toBalance: transferToBalance,
        onMaxFrom: () => setTransferAmount(getClientTransferableAmount(transferFromClientId).toString()),
        maxDisabled: !transferFromClientId || getClientTransferableAmount(transferFromClientId) <= 0,
        date: transferDate, setDate: setTransferDate, time: transferTime, setTime: setTransferTime,
        dateLabel: t('common.date'), timeLabel: t('common.time'),
        title: editingTransferTx ? `${t('common.edit')} ${t('transactions.clientTransfer')}` : t('transactions.clientTransfer'), infoText: t('transactions.transferDebtCredit'), fromLabel: t('transactions.from'),
        toLabel: t('transactions.to'), amountLabel: t('transactions.amount'), notesLabel: t('common.notesOptional'),
        filterClientsLabel: t('transactions.filterClients'), balanceLabel: t('common.balance'), dinarLabel: t('common.dinar'),
        confirmLabel: editingTransferTx ? t('common.save') : t('transactions.confirmTransfer')
    }), [isTransferModalOpen, closeTransferModal, fieldBase, transferFromClientId, transferToClientId, transferAmount, transferNotes, transferDate, transferTime, handleSaveTransfer, handleClientToClientTransferSave, isSaving, clientsDzd, getClientFullName, transferFromBalance, transferToBalance, setTransferAmount, getClientTransferableAmount, editingTransferTx, t]);
    const treasuryBalanceEditDialogProps = useMemo(() => ({
        isOpen: isTreasuryBalanceEditModalOpen, onClose: closeTreasuryBalanceEditModal, fieldBase,
        asset: treasuryBalanceEditAsset, value: treasuryBalanceEditValue, notes: treasuryBalanceEditNotes, setNotes: setTreasuryBalanceEditNotes,
        onSave: handleSaveTreasuryBalanceEdit, title: `${t('common.edit')} ${t(treasuryBalanceEditAsset === 'Caisse' ? 'common.caisseBalance' : 'common.baridiBalance')}`, descriptionText: t('transactions.editBalanceDesc'),
        newBalanceLabel: t('transactions.newBalance'), notesOptionalLabel: t('common.notesOptional'),
        reasonPlaceholder: t('transactions.reason'), saveLabel: t('common.save'), cancelLabel: t('common.cancel'),
        onValueChange: (value: string) => {
            const normalized = value.replace(',', '.').trim();
            if (normalized === '') {
                setTreasuryBalanceEditValue('');
                return;
            }
            if (/^\d+$/.test(normalized))
                setTreasuryBalanceEditValue(normalized);
        },
        onValueBlur: () => {
            const parsed = parseAndEvaluate(treasuryBalanceEditValue);
            if (!isNaN(parsed))
                setTreasuryBalanceEditValue(Math.round(parsed).toString());
        }
    }), [isTreasuryBalanceEditModalOpen, closeTreasuryBalanceEditModal, fieldBase, treasuryBalanceEditAsset, treasuryBalanceEditValue, treasuryBalanceEditNotes, handleSaveTreasuryBalanceEdit, t]);

    const portfolioBalanceEditDialogProps = useMemo(() => ({
        isOpen: isPortfolioBalanceEditModalOpen, onClose: closePortfolioBalanceEditModal, fieldBase,
        asset: portfolioBalanceEditAsset, value: portfolioBalanceEditValue, notes: portfolioBalanceEditNotes, setNotes: setPortfolioBalanceEditNotes,
        onSave: handleSavePortfolioBalanceEdit, isSaving, titlePrefix: t('transactions.editBalance'), descriptionText: `${t('transactions.editBalanceDesc')} ${t('transactions.editBalanceSignHint')}`,
        newBalanceLabel: `${t('transactions.newBalance')} / ${t('transactions.adjustmentWord')}`, notesOptionalLabel: t('common.notesOptional'), reasonPlaceholder: t('transactions.reason'),
        saveLabel: t('common.save'), savingLabel: t('common.saving'), cancelLabel: t('common.cancel'),
        onValueChange: (value: string) => {
            const normalized = value.replace(',', '.').trim();
            if (normalized === '') {
                setPortfolioBalanceEditValue('');
                return;
            }
            if (/^[+-]?$/.test(normalized) || /^[+-]?\d+(\.\d{0,2})?$/.test(normalized))
                setPortfolioBalanceEditValue(normalized);
        },
        onValueBlur: () => {
            const raw = portfolioBalanceEditValue.replace(',', '.').trim();
            if (raw === '+' || raw === '-')
                return;
            const parsed = parseAndEvaluate(raw);
            if (!isNaN(parsed)) {
                const formatted = Math.abs(parsed).toFixed(2);
                setPortfolioBalanceEditValue(raw.startsWith('+') ? `+${formatted}` : Number(parsed).toFixed(2));
            }
        }
    }), [isPortfolioBalanceEditModalOpen, closePortfolioBalanceEditModal, fieldBase, portfolioBalanceEditAsset, portfolioBalanceEditValue, portfolioBalanceEditNotes, handleSavePortfolioBalanceEdit, isSaving, t]);
    const dateFilterDialogProps = useMemo(() => ({
        isOpen: isDateFilterModalOpen, onClose: () => setIsDateFilterModalOpen(false), fieldBase,
        startDate: tempStartDate, setStartDate: setTempStartDate, endDate: tempEndDate, setEndDate: setTempEndDate,
        onClear: handleClearDateFilter, onApply: handleApplyDateFilter, title: t('transactions.filterByDate'),
        startLabel: t('transactions.startDate'), endLabel: t('transactions.endDate'), clearLabel: t('transactions.clear'),
        applyLabel: t('transactions.apply')
    }), [isDateFilterModalOpen, fieldBase, tempStartDate, tempEndDate, handleClearDateFilter, handleApplyDateFilter, t]);
    const isClientOperationsOpen = isClientTxModalOpen || isAdjustmentModalOpen;
    const isTransferAndFilterDialogsOpen = isTransferModalOpen || isTreasuryBalanceEditModalOpen || isPortfolioBalanceEditModalOpen || isDateFilterModalOpen;
    const isTransactionDialogOpen = mode !== null;
    const isClientCrudDialogsOpen = Boolean(txToDelete || clientTxToDelete || isClientModalOpen || clientToDelete);
    const isUtilityDialogsOpen = isSettingsModalOpen || isResetModalOpen || isCreateAssetModalOpen || isTreasuryCardModalOpen || treasuryCardToDelete !== null || treasuryTxToDelete !== null;
    const isClientSummaryOpen = summaryClient !== null;
    const isInvestorDialogsOpen = isInvestorModalOpen || investorToDelete !== null || isInvestorTxModalOpen || investorTxToDelete !== null || isReinvestModalOpen;
    const hasOpenMainAppDialog = isWalletTransferModalOpen
        || isClientOperationsOpen
        || isTransferAndFilterDialogsOpen
        || isTransactionDialogOpen
        || isClientCrudDialogsOpen
        || isUtilityDialogsOpen
        || isClientSummaryOpen
        || isInvestorDialogsOpen
        || isDeliveryExpenseModalOpen
        || isDigitalServiceModalOpen
        || isPersonalWithdrawalModalOpen
        || isReconcileAdvanceModalOpen
        || personalExpenseToDelete !== null;
    // Wire Android/browser system back button. Highest-priority handler first;
    // falls through to changing the active tab toward `transactions` (root).
    useBackHandler([
        // An open window closes first, the one on top only.
        closeTopOverlay,
        () => { if (personalExpenseToDelete) {
            setPersonalExpenseToDelete(null);
            return true;
        } return false; },
        () => { if (selectedAssetClientId) {
            setSelectedAssetClientId(null);
            return true;
        } return false; },
        () => { if (selectedAssetId) {
            setSelectedAssetId(null);
            return true;
        } return false; },
        () => { if (selectedInvestorId) {
            setSelectedInvestorId(null);
            return true;
        } return false; },
        () => { if (selectedClientId) {
            setSelectedClientId(null);
            return true;
        } return false; },
        () => { if (view !== 'dashboard') {
            startTransition(() => setView('dashboard'));
            return true;
        } return false; }
    ]);

    // Pricing context for the smart sell assistant
    const handleExportBackup = React.useCallback(() => {
        try {
            const backup = {
                version: 2,
                app: 'Pro Digital',
                exportedAt: new Date().toISOString(),
                data: {
                    transactions,
                    clientsDzd,
                    clientTransactionsDzd,
                    treasuryTransactions,
                    investors: derivedInvestors,
                    investorTransactions,
                    treasuryCards,
                    manualAssets,
                    manualAssetClients,
                    manualAssetTransactions,
                    pricing: {
                        policy: pricingPlanSync.policy,
                        plan: pricingPlanSync.plan,
                        overrides: pricingPlanSync.overrides,
                    },
                },
            };
            const json = JSON.stringify(backup, null, 2);
            const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `prodigital_backup_${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            setAlert('✅ Sauvegarde téléchargée avec succès.');
        } catch {
            setAlert('❌ Erreur lors de la sauvegarde.');
        }
    }, [transactions, clientsDzd, clientTransactionsDzd, treasuryTransactions, derivedInvestors, investorTransactions, treasuryCards, manualAssets, manualAssetClients, manualAssetTransactions, pricingPlanSync.policy, pricingPlanSync.plan, pricingPlanSync.overrides]);
    return (<div className={`min-h-screen bg-gradient-to-br ${bgApp} transition-colors duration-300`}>
            <OfflineBanner />
            <div className="mx-auto max-w-4xl px-page-x pb-24 sm:px-4">
                    <MainHeaderBar {...{ view, setView: navigateToView, globalSearchTitle: t('common.globalSearch'), handleOpenGlobalSearch, onOpenSettings: openSettingsModal, onSignOut: handleSignOut, labels: navLabels }}/>

                {isAwaitingServerSync && (<div role="status" className="-mt-1 mb-2 flex items-center gap-2 text-xs font-semibold text-neutral-600">
                        <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-warning"/>
                        <span>{t('common.syncLine')}</span>
                    </div>)}
                <MainContentArea {...mainContentProps}/>

                <AppBottomNav view={view} onSelect={navigateToView} labels={navLabels} onNewOperation={isFinancialDataReady ? openNewOperationMenu : undefined} onOpenSettings={openSettingsModal} onSignOut={handleSignOut} overdueCount={dashboardPageProps.overdueDebtClientCount}/>

                <NewTransactionMenuDialog isOpen={isNewOperationMenuOpen} onClose={closeNewOperationMenu} t={t as (key: string) => string} openForm={(mode) => openForm(mode)} openWalletTransferModal={openWalletTransferModal} openTransferModal={openTransferModal} openAdjustmentModal={(type) => openAdjustmentModal(type)} openDeliveryExpenseModal={openDeliveryExpenseModal} openDigitalServiceModal={() => openDigitalServiceModal(null)} openPersonalWithdrawalModal={openPersonalWithdrawalModal}/>

                {alert && (<AppToast message={translateAlert(alert, lang, t)} tone={alertTone} closeLabel={t('common.close')} onClose={dismissAlert} actionLabel={activeAlertUndo ? t('common.undo') : undefined} onAction={activeAlertUndo ? () => { setAlert(''); activeAlertUndo.run(); } : undefined}/>)}


                {isGlobalSearchOpen && (<Suspense fallback={null}>
                        <GlobalSearchDialog {...{ isOpen: isGlobalSearchOpen, onClose: closeGlobalSearch, fieldBase, query: globalSearchQuery, setQuery: setGlobalSearchQuery, results: globalSearchResults, onSelectResult: handleSelectGlobalSearchResult, title: t('common.globalSearch'), placeholder: t('common.searchPlaceholder'), noResultsText: t('common.noResults'), clientsText: t('nav.clients'), transactionsText: t('nav.transactions') }}/>
                    </Suspense>)}

                {isMonthPlanOpen && (
                    <Suspense fallback={null}>
                        <MonthPlanSheet
                            isOpen={isMonthPlanOpen}
                            onClose={() => setIsMonthPlanOpen(false)}
                            context={smartPricingCtx}
                            suggestedGoal={Math.round(salesHistory90.avgMonthlyProfit)}
                            clients={monthPlanClients}
                            syncState={pricingPlanSync.syncState}
                            onSavePlan={pricingPlanSync.savePlan}
                            onSavePolicy={pricingPlanSync.savePolicy}
                            onSaveDailyMarketOverride={pricingPlanSync.saveDailyMarketOverride}
                            onSaveDailyClientOverride={pricingPlanSync.saveDailyClientOverride}
                            onClearOverride={pricingPlanSync.clearOverride}
                            onUseInSale={openSmartSale}
                        />
                    </Suspense>
                )}
            </div>

            {hasOpenMainAppDialog && (<Suspense fallback={null}>
            <MainAppDialogs {...{
        isWalletTransferModalOpen, walletTransferDialogProps,
        isClientOperationsOpen,
        isClientTxModalOpen, setIsClientTxModalOpen,
        editingClientTx,
        clientTxType, setClientTxType,
        clientTxUsdtAmount, setClientTxUsdtAmount,
        clientTxSellPrice, setClientTxSellPrice,
        clientTxEurAmount, setClientTxEurAmount,
        clientTxEurPrice, setClientTxEurPrice,
        clientTxAmount, setClientTxAmount,
        clientTxNotes, setClientTxNotes,
        clientTxPaymentStatus, setClientTxPaymentStatus,
        clientTxLinkedClientId,
        clientTxReceiverClientId, setClientTxReceiverClientId,
        handleSaveClientTx,
        selectedClientId,
        isAdjustmentModalOpen, setIsAdjustmentModalOpen,
        editingTreasuryTx,
        adjustmentTab, setAdjustmentTab,
        adjustmentAsset, setAdjustmentAsset,
        adjustmentAmount, setAdjustmentAmount,
        adjustmentClientId, setAdjustmentClientId,
        adjustmentPrice, setAdjustmentPrice,
        adjustmentNote, setAdjustmentNote,
        isDeliveryExpenseModalOpen, closeDeliveryExpenseModal,
        openDeliveryExpenseModal,
        deliveryExpenseAmount, setDeliveryExpenseAmount,
        deliveryExpenseMethod, setDeliveryExpenseMethod,
        deliveryExpenseDate, setDeliveryExpenseDate,
        deliveryExpenseNote, setDeliveryExpenseNote,
        deliveryExpensePreview,
        handleSaveDeliveryExpense,
        isDigitalServiceModalOpen, closeDigitalServiceModal,
        isDigitalServiceSaving,
        digitalServiceClientId, setDigitalServiceClientId,
        digitalServiceName, setDigitalServiceName,
        digitalServicePurchaseWallet, setDigitalServicePurchaseWallet,
        digitalServicePurchaseAmount, setDigitalServicePurchaseAmount,
        digitalServiceSaleWallet, setDigitalServiceSaleWallet,
        digitalServiceSaleAmount, setDigitalServiceSaleAmount,
        digitalServiceDate, setDigitalServiceDate,
        digitalServiceNote, setDigitalServiceNote,
        digitalServicePreview,
        handleSaveDigitalService,
        isPersonalWithdrawalModalOpen, closePersonalWithdrawalModal,
        personalWithdrawalAmount, setPersonalWithdrawalAmount,
        personalWithdrawalMethod, setPersonalWithdrawalMethod,
        personalWithdrawalDate, setPersonalWithdrawalDate,
        personalWithdrawalNote, setPersonalWithdrawalNote,
        personalWithdrawalMode, setPersonalWithdrawalMode,
        personalWithdrawalPreview,
        editingPersonalExpenseTx,
        personalExpenseToDelete, setPersonalExpenseToDelete,
        handleSavePersonalWithdrawal,
        handleDeletePersonalExpense,
        managerAvailableProfit, managerCapitalInvested, managerExists,
        isReconcileAdvanceModalOpen, closeReconcileAdvanceModal,
        reconcileAdvanceTx, reconcileActualAmount, setReconcileActualAmount,
        reconcileSpentDescription, setReconcileSpentDescription,
        handleReconcilePersonalAdvance,
        clientBalances, portfolioStats, treasuryStats,
        clientsDzd, getClientFullName,
        treasuryCards,
        handleGlobalAdjustment,
        fieldBase, t,
        isSaving, setAlert,
        isTransferAndFilterDialogsOpen,
        clientTransferDialogProps,
        treasuryBalanceEditDialogProps,
        portfolioBalanceEditDialogProps,
        dateFilterDialogProps,
        isTransactionDialogOpen,
        mode, editingTx, closeForm, openForm,
        buyUsdtMode, setBuyUsdtMode,
        setEurDzdPrice,
        buyUsdtAmount, setBuyUsdtAmount,
        isTotalManual, setIsTotalManual,
        buyUsdtPrice, setBuyUsdtPrice,
        buyUsdtTotal, setBuyUsdtTotal,
        formValidation,
        linkedClientId, setLinkedClientId,
        linkedClientDzdId, setLinkedClientDzdId,
        openClientModal,
        clientPaymentStatus, setClientPaymentStatus,
        creditDueDate, setCreditDueDate,
        pendingCreditRisk, confirmCreditRisk, cancelCreditRisk,
        notes, setNotes,
        txTags, setTxTags,
        buyEurForUsdtAmount, setBuyEurForUsdtAmount,
        eurDzdPrice, eurUsdtRate, setEurUsdtRate,
        sellAmount, setSellAmount,
        sellPrice, setSellPrice,
        sellTotal, setSellTotal,
        sellSettlementCurrency, setSellSettlementCurrency,
        sellEurToDzdRate, setSellEurToDzdRate,
        profitPercent, setProfitPercent,
        buyEurAmount, setBuyEurAmount,
        buyEurPrice, setBuyEurPrice,
        buyEurTotal, setBuyEurTotal,
        handleBuy, handleSell,
        buyRestriction, setBuyRestriction,
        realPurchaseTime, setRealPurchaseTime,
        smartPricingByCurrency, smartQuoteRef,
        isClientCrudDialogsOpen,
        txToDelete, setTxToDelete,
        handleDeleteConfirm,
        clientTxToDelete, setClientTxToDelete,
        handleDeleteClientTxConfirm,
        isClientModalOpen, setIsClientModalOpen,
        editingClient,
        clientFullName, setClientFullName,
        clientPhone, setClientPhone,
        clientRedotpayId, setClientRedotpayId,
        clientBinanceEmail, setClientBinanceEmail,
        clientNotes, setClientNotes,
        clientCreditLimit, setClientCreditLimit,
        clientGroup, setClientGroup,
        clientIsFournisseur, setClientIsFournisseur,
        initialBalance, setInitialBalance,
        handleSaveClient, clientDuplicateMatches, confirmSaveClientDespiteDuplicates, cancelClientDuplicateWarning, restoreArchivedClient, closeClientModal, isClientSaving,
        clientToDelete, clientDeleteMode,
        handleClientDeleteRequest,
        handleDeleteClient,
        isUtilityDialogsOpen,
        isSettingsModalOpen, setIsSettingsModalOpen,
        setIsResetModalOpen,
        userDocRef,
        isResetModalOpen,
        handleGlobalReset,
        handleExportBackup,
        isCreateAssetModalOpen, setIsCreateAssetModalOpen,
        newAssetName, setNewAssetName,
        newAssetDescription, setNewAssetDescription,
        handleCreateAsset,
        isTreasuryCardModalOpen, setIsTreasuryCardModalOpen,
        editingTreasuryCard,
        treasuryCardName, setTreasuryCardName,
        treasuryCardValue, setTreasuryCardValue,
        treasuryCardNotes, setTreasuryCardNotes,
        handleSaveTreasuryCard,
        treasuryCardToDelete, setTreasuryCardToDelete,
        handleDeleteTreasuryCard,
        treasuryTxToDelete, setTreasuryTxToDelete,
        handleDeleteTreasuryTxConfirm,
        isClientSummaryOpen,
        summaryClient, setSummaryClient,
        clientTransactionsDzd, transactions,
        isInvestorDialogsOpen,
        isInvestorModalOpen, setIsInvestorModalOpen,
        editingInvestor,
        handleSaveInvestor,
        investorName, setInvestorName,
        investorInitialCapital, setInvestorInitialCapital,
        investorInitialCapitalSource, setInvestorInitialCapitalSource,
        investorNotes, setInvestorNotes,
        isManager, setIsManager,
        derivedInvestors,
        selectedInvestorId,
        isInvestorTxModalOpen, setIsInvestorTxModalOpen,
        investorTxType,
        investorTxAmount, setInvestorTxAmount,
        investorTxPaymentSource, setInvestorTxPaymentSource,
        investorTxNotes, setInvestorTxNotes,
        handleInvestorTransaction,
        investorToDelete, setInvestorToDelete,
        handleDeleteInvestor,
        investorTxToDelete, setInvestorTxToDelete,
        handleDeleteInvestorTx,
        isReinvestModalOpen, setIsReinvestModalOpen,
        reinvestInput, setReinvestInput,
        handleReinvestProfit,
    }}/>
            </Suspense>)}

        </div>);
}
