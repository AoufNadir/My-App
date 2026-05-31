import React, { Suspense, startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Tx, ClientDzd, ClientTransactionDzd, TreasuryTx, TreasuryCard, ManualAsset, ManualAssetClient, ManualAssetTransaction, Investor, InvestorTransaction } from './types';
import { useLanguage } from './contexts/LanguageContext';
import { signOut } from 'firebase/auth';
import { auth, type AppUser } from './firebaseAuth';
import { db, fieldValueDelete } from './firebase';
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
import { AppMobileMenuNav, AppBottomNav } from './components/main/AppNavigation';
import { MainHeaderBar } from './components/main/MainHeaderBar';
import { MainContentArea } from './components/main/MainContentArea';
import { MainAppDialogs } from './components/main/MainAppDialogs';
import type { TransactionFilterMode } from './components/transactions/transactionsTypes';
import { OfflineBanner } from './components/ui/OfflineBanner';
import { MonthlyRecapBanner } from './components/ui/MonthlyRecapBanner';
import { WeeklyRecapBanner } from './components/ui/WeeklyRecapBanner';
import { NotificationPermissionBanner } from './components/ui/NotificationPermissionBanner';
import { useMonthlyRecap } from './hooks/useMonthlyRecap';
import { useNotifications } from './hooks/useNotifications';
import { useWeeklyRecap } from './hooks/useWeeklyRecap';
// Custom Hooks
import { useAppData } from './hooks/useAppData';
import { useSettings } from './hooks/useSettings';
import { useTransactionHandlers } from './hooks/useTransactionHandlers';
import { useClientHandlers } from './hooks/useClientHandlers';
import { useAssetHandlers } from './hooks/useAssetHandlers';
import { useGlobalSearch } from './hooks/useGlobalSearch';
import { useInvestorHandlers } from './hooks/useInvestorHandlers';
import { deriveInvestorEconomics, type InvestorEconomicsResult } from './hooks/useInvestorEconomics';
import { useMainNavigation } from './hooks/useMainNavigation';
import { useBackHandler } from './hooks/useBackHandler';
import { useOverdueDebtClients } from './hooks/useOverdueDebtClients';
import { useReportExports } from './hooks/useReportExports';
// Shared Utils
import { now, parseAndEvaluate } from './utils';
import { computePamLedger } from './utils/pamLedger';
import { calculateInvestorLiability, calculateInvestorBreakdown } from './utils/capitalSnapshot';
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
const InsightsPage = React.lazy(() => import('./pages/InsightsPage').then((module) => ({ default: module.InsightsPage })));
const GlobalSearchDialog = React.lazy(() => import('./components/main/MainDialogs').then((module) => ({ default: module.GlobalSearchDialog })));
const QuickCalculatorSheet = React.lazy(() => import('./components/calculator/QuickCalculatorSheet').then((m) => ({ default: m.QuickCalculatorSheet })));
const loadPdfReports = () => import('./utils/pdfReports');
const EMPTY_INVESTOR_ECONOMICS: InvestorEconomicsResult = {
    derivedInvestors: [],
    warnings: [],
    totals: {
        derivedProfit: 0,
        managerShare: 0,
        investorShare: 0,
        unallocatedProfit: 0,
        reconciliationDifference: 0,
        totalDeliveryExpenses: 0,
        netDistributableProfit: 0,
    },
};
type ClientSortMode = 'all' | 'advances' | 'debts' | 'debts_oldest_highest' | 'zero_balance';
import { reorderClientName, nameMatchesQuery } from './utils/nameUtils';
import { computeGoalAdjustedBase, getVolumeBracket } from './utils/pricingMatrix';

function getClientDisplayName(client: ClientDzd) {
    const raw = client.fullName || (client.prenom ? `${client.nom} ${client.prenom}` : client.nom) || '';
    return reorderClientName(raw);
}
function PageLoadingFallback({ text }: {
    text: string;
}) {
    return (<div className="w-full rounded-2xl border border-border bg-surface/80 text-neutral-700 p-6 text-center text-sm font-semibold">
            {text}
        </div>);
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
    const { t } = useLanguage();
    const [refreshKey, setRefreshKey] = useState(0);
    const [alert, setAlert] = useState('');
    const { investorIdFromUrl, isInvestorRoute, navigateToView, selectedClientId, setSelectedClientId, setView, view } = useMainNavigation();
    const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
    const [selectedAssetClientId, setSelectedAssetClientId] = useState<string | null>(null);
    const shouldSubscribeManualAssets = view === 'services'
        || view === 'dashboard'
        || view === 'tresorerie'
        || selectedAssetId !== null
        || selectedAssetClientId !== null;
    const shouldSubscribeInvestors = view === 'investors' || view === 'dashboard' || view === 'tresorerie' || view === 'dzd' || view === 'transactions' || view === 'expenses' || isInvestorRoute;
    const shouldSubscribeTreasuryCards = view === 'dashboard' || view === 'tresorerie' || view === 'transactions';
    // 1.1 App Data (Provides userDocRef)
    const { userDocRef, transactions, clientsDzd, clientTransactionsDzd, treasuryTransactions, treasuryCards, manualAssets, manualAssetClients, manualAssetTransactions, portfolioStats, treasuryStats, clientBalances, assetClientBalances, assetBalances, totals, investorTransactions, investors, isDataLoaded, dataStatus } = useAppData(user, refreshKey, {
        subscribeManualAssets: shouldSubscribeManualAssets,
        subscribeInvestors: shouldSubscribeInvestors,
        subscribeTreasuryCards: shouldSubscribeTreasuryCards
    });
    // 1.2 Settings
    const { suggestedProfitMargin, setSuggestedProfitMargin, suggestedSellingPrice, setSuggestedSellingPrice, suggestedUsdtEurSellPrice, setSuggestedUsdtEurSellPrice, suggestedSellingPriceEur, setSuggestedSellingPriceEur, managerFeePercentage, setManagerFeePercentage } = useSettings(userDocRef);
    // 1.3 Derived Data
    // FIX-PERF (Phase 3): defer heavy computations so list/UI updates stay
    // interactive on weak phones. React renders with the previous pamLedger /
    // investorEconomics while a concurrent transition recomputes the new ones.
    const deferredTransactions = useDeferredValue(transactions);
    const deferredInvestors = useDeferredValue(investors);
    const deferredInvestorTransactions = useDeferredValue(investorTransactions);
    const pamLedger = useMemo(() => computePamLedger(deferredTransactions), [deferredTransactions]);
    const deliveryExpenses = useMemo(() => treasuryTransactions.filter((tx) => tx.origin === 'delivery_expense'), [treasuryTransactions]);
    const personalExpenses = useMemo(() => treasuryTransactions.filter((tx) => tx.origin === 'personal_expense'), [treasuryTransactions]);
    const investorEconomics = useMemo(() => {
        if (!shouldSubscribeInvestors)
            return EMPTY_INVESTOR_ECONOMICS;
        return deriveInvestorEconomics({
            investors: deferredInvestors,
            investorTransactions: deferredInvestorTransactions,
            transactions: deferredTransactions,
            managerFeePercentage,
            pamLedger,
            deliveryExpenses
        });
    }, [shouldSubscribeInvestors, deferredInvestors, deferredInvestorTransactions, managerFeePercentage, deferredTransactions, pamLedger, deliveryExpenses]);
    const derivedInvestors = investorEconomics.derivedInvestors;

    // Reactive monthly goal — updates instantly when changed from InsightsPage or Settings
    const GOAL_KEY = 'app_monthly_profit_goal';
    const [monthlyGoalState, setMonthlyGoalState] = React.useState<number>(() =>
        Number(localStorage.getItem(GOAL_KEY) || 0)
    );
    React.useEffect(() => {
        const handler = (e: StorageEvent) => {
            if (e.key === GOAL_KEY) setMonthlyGoalState(Number(e.newValue || 0));
        };
        window.addEventListener('storage', handler);
        return () => window.removeEventListener('storage', handler);
    }, []);

    // Early pricing data (needed before useTransactionHandlers)
    // effectiveMargin = max(historical 90d margin, goal-required margin)
    // Re-computes immediately when monthlyGoalState changes (reactive).
    const earlyAvgMarginPerUsdt = React.useMemo(() => {
        const ninetyDaysAgo = Date.now() - 90 * 86_400_000;
        let totalProfit = 0;
        let totalQty = 0;
        for (const row of pamLedger.sellProfitRows) {
            if (row.timestamp < ninetyDaysAgo || row.currency !== 'USDT') continue;
            totalProfit += row.derivedProfit || 0;
            totalQty    += Number(row.quantity || 0);
        }
        const historicalMargin = totalQty > 0
            ? totalProfit / totalQty
            : parseAndEvaluate(suggestedProfitMargin);

        // Goal-based margin: what margin is needed per USDT to hit the monthly goal
        const avgMonthlyVol = totalQty > 0 ? totalQty / 3 : 0; // 90d qty ÷ 3 months
        const rawGoalMargin = avgMonthlyVol > 0 && monthlyGoalState > 0
            ? monthlyGoalState / avgMonthlyVol
            : 0;

        // Adjust so that even VIP (minimum multiplier) achieves the goal
        const bracket = getVolumeBracket(avgMonthlyVol > 0 ? avgMonthlyVol : portfolioStats.usdt.available);
        const goalMargin = rawGoalMargin > 0
            ? computeGoalAdjustedBase(rawGoalMargin, bracket)
            : 0;

        // Use whichever is higher: historical or goal-adjusted
        return Math.max(historicalMargin, goalMargin);
    }, [pamLedger, suggestedProfitMargin, monthlyGoalState]);

    // Client tier by PREVIOUS MONTH USDT sell volume (via transaction.linkedClientId)
    const earlyClientLoyaltyMap = React.useMemo<Map<string, 'vip' | 'regular' | 'petit' | 'new' | 'inactive'>>(() => {
        const now = new Date();
        // Previous month boundaries
        const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
        const prevMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999).getTime();
        const inactifCutoff  = now.getTime() - 45 * 86_400_000;

        // Compute USDT sell volume per client for previous month
        const volumeByClient = new Map<string, number>();
        for (const tx of transactions) {
            if (tx.type !== 'sell' || tx.currency !== 'USDT') continue;
            if (!tx.linkedClientId) continue;
            if (tx.timestamp < prevMonthStart || tx.timestamp > prevMonthEnd) continue;
            volumeByClient.set(tx.linkedClientId, (volumeByClient.get(tx.linkedClientId) || 0) + Number(tx.quantity || 0));
        }

        // Also check last activity date per client (from clientTransactionsDzd)
        const lastActivityByClient = new Map<string, number>();
        for (const tx of clientTransactionsDzd) {
            const prev = lastActivityByClient.get(tx.clientId) || 0;
            if (tx.timestamp > prev) lastActivityByClient.set(tx.clientId, tx.timestamp);
        }

        // Check if client had any sell transaction ever (to distinguish Nouveau from Inactif)
        const everSoldClients = new Set<string>();
        for (const tx of transactions) {
            if (tx.type === 'sell' && tx.linkedClientId) everSoldClients.add(tx.linkedClientId);
        }

        const result = new Map<string, 'vip' | 'regular' | 'petit' | 'new' | 'inactive'>();
        for (const client of clientsDzd) {
            const lastActivity = lastActivityByClient.get(client.id) || 0;
            const volume = volumeByClient.get(client.id) || 0;
            const everSold = everSoldClients.has(client.id);

            // No history at all → Nouveau
            if (!everSold && lastActivity === 0) { result.set(client.id, 'new'); continue; }
            // No activity in 45 days → Inactif (treated as Nouveau for pricing)
            if (lastActivity < inactifCutoff && lastActivity > 0) { result.set(client.id, 'inactive'); continue; }
            // Classify by previous month volume (user-defined thresholds)
            if (volume >= 5500) { result.set(client.id, 'vip');     continue; }
            if (volume >= 1000) { result.set(client.id, 'regular'); continue; }
            if (volume >= 50)   { result.set(client.id, 'petit');   continue; }
            // Had some history but not in previous month
            result.set(client.id, 'inactive');
        }
        return result;
    }, [transactions, clientTransactionsDzd, clientsDzd]);

    // --- 2. BUSINESS LOGIC HOOKS ---
    const { isSaving, setIsSaving, mode, setMode, editingTx, setEditingTx, isTotalManual, setIsTotalManual, buyUsdtAmount, setBuyUsdtAmount, buyUsdtPrice, setBuyUsdtPrice, buyUsdtTotal, setBuyUsdtTotal, buyEurAmount, setBuyEurAmount, buyEurPrice, setBuyEurPrice, buyEurTotal, setBuyEurTotal, sellAmount, setSellAmount, sellPrice, setSellPrice, sellTotal, setSellTotal, sellSettlementCurrency, setSellSettlementCurrency, sellEurToDzdRate, setSellEurToDzdRate, buyUsdtMode, setBuyUsdtMode, buyEurForUsdtAmount, setBuyEurForUsdtAmount, eurDzdPrice, setEurDzdPrice, eurUsdtRate, setEurUsdtRate, linkedClientId, setLinkedClientId, linkedClientDzdId, setLinkedClientDzdId, clientPaymentStatus, setClientPaymentStatus, notes, setNotes, txTags, setTxTags, profitPercent, setProfitPercent, isAdjustmentModalOpen, setIsAdjustmentModalOpen, adjustmentTab, setAdjustmentTab, adjustmentAsset, setAdjustmentAsset, adjustmentAmount, setAdjustmentAmount, adjustmentPrice, setAdjustmentPrice, adjustmentNote, setAdjustmentNote, adjustmentClientId, setAdjustmentClientId, editingTreasuryTx, usdtFromEurCalc, formValidation, openForm, closeForm, handleBuy, handleSell, handleGlobalAdjustment, handleDeleteTx, openAdjustmentModal, isDeliveryExpenseModalOpen, deliveryExpenseAmount, setDeliveryExpenseAmount, deliveryExpenseMethod, setDeliveryExpenseMethod, deliveryExpenseDate, setDeliveryExpenseDate, deliveryExpenseNote, setDeliveryExpenseNote, openDeliveryExpenseModal, closeDeliveryExpenseModal, handleSaveDeliveryExpense, txToDelete, setTxToDelete, handleConfirmDeleteTx, isTransferModalOpen, setIsTransferModalOpen, transferAmount, setTransferAmount, transferFromClientId, setTransferFromClientId, transferToClientId, setTransferToClientId, transferNotes, setTransferNotes, editingTransferTx, openTransferModal, closeTransferModal, handleSaveTransfer } = useTransactionHandlers({
        userDocRef, portfolioStats, transactions, clientsDzd, clientTransactionsDzd, treasuryStats,
        suggestedProfitMargin, suggestedSellingPrice, suggestedSellingPriceEur,
        setAlert, setSelectedClientId: (id: string | null) => setSelectedClientId(id), setView: (v: string) => setView(v),
        clientLoyaltyMap: earlyClientLoyaltyMap,
        avgMarginPerUsdt: earlyAvgMarginPerUsdt,
    });
    const { isClientModalOpen, setIsClientModalOpen, editingClient, setEditingClient, clientToDelete, clientDeleteMode, clientFullName, setClientFullName, clientPhone, setClientPhone, initialBalance, setInitialBalance, clientRedotpayId, setClientRedotpayId, clientBinanceEmail, setClientBinanceEmail, clientNotes, setClientNotes, clientCreditLimit, setClientCreditLimit, clientGroup, setClientGroup, openClientModal, closeClientModal, requestClientDelete, closeClientDeleteDialog, handleSaveClient, handleDeleteClient, isClientTxModalOpen, setIsClientTxModalOpen, editingClientTx, setEditingClientTx, clientTxToDelete, setClientTxToDelete, clientTxAmount, setClientTxAmount, clientTxType, setClientTxType, clientTxNotes, setClientTxNotes, clientTxSource, setClientTxSource, clientPaymentStatus: clientTxPaymentStatus, setClientPaymentStatus: setClientTxPaymentStatus, linkedClientId: clientTxLinkedClientId, openClientTxModal, handleSaveClientTx, handleDeleteClientTx, clientTxUsdtAmount, setClientTxUsdtAmount, clientTxSellPrice, setClientTxSellPrice, clientTxEurAmount, setClientTxEurAmount, clientTxEurPrice, setClientTxEurPrice } = useClientHandlers(userDocRef, clientsDzd, clientTransactionsDzd, clientBalances, treasuryTransactions, treasuryStats, investors, setAlert);
    const { isInvestorModalOpen, setIsInvestorModalOpen, editingInvestor, setEditingInvestor, investorToDelete, setInvestorToDelete, isInvestorTxModalOpen, setIsInvestorTxModalOpen, investorName, setInvestorName, investorInitialCapital, setInvestorInitialCapital, investorNotes, setInvestorNotes, isManager, setIsManager, investorTxType, setInvestorTxType, investorTxAmount, setInvestorTxAmount, investorTxNotes, setInvestorTxNotes, investorTxPaymentSource, setInvestorTxPaymentSource, investorTxToDelete, setInvestorTxToDelete, isReinvestModalOpen, setIsReinvestModalOpen, reinvestInput, setReinvestInput, selectedInvestorId, setSelectedInvestorId, handleSaveInvestor, handleSaveInvestorTx, handleReinvestProfit, handleDeleteInvestor, openInvestorModal, closeInvestorModal, 
    // Personal withdrawal (manager's daily personal expense)
    isPersonalWithdrawalModalOpen, setIsPersonalWithdrawalModalOpen, personalWithdrawalAmount, setPersonalWithdrawalAmount, personalWithdrawalMethod, setPersonalWithdrawalMethod, personalWithdrawalDate, setPersonalWithdrawalDate, personalWithdrawalNote, setPersonalWithdrawalNote, personalWithdrawalMode, setPersonalWithdrawalMode, editingPersonalExpenseTx, personalExpenseToDelete, setPersonalExpenseToDelete, openEditPersonalExpense, openPersonalWithdrawalModal, closePersonalWithdrawalModal, handleSavePersonalWithdrawal, handleDeletePersonalExpense, managerAvailableProfit, managerExists, 
    // Reconcile advance
    isReconcileAdvanceModalOpen, reconcileAdvanceTx, reconcileActualAmount, setReconcileActualAmount, openReconcileAdvanceModal, closeReconcileAdvanceModal, handleReconcilePersonalAdvance } = useInvestorHandlers(userDocRef, derivedInvestors, treasuryStats, setAlert);
    const { isAssetModalOpen, setIsAssetModalOpen, editingAsset, setEditingAsset, isAssetClientModalOpen, setIsAssetClientModalOpen, editingAssetClient, setEditingAssetClient, isCreateAssetModalOpen, setIsCreateAssetModalOpen, newAssetName, setNewAssetName, newAssetDescription, setNewAssetDescription, assetClientBalance, setAssetClientBalance, handleCreateAsset, handleDeleteAsset, openAssetClientModal, closeAssetClientModal, handleCreateAssetClient, handleUpdateAssetClient, handleDeleteAssetClient, handleCreateAssetTransaction } = useAssetHandlers(userDocRef, manualAssets, manualAssetClients, assetClientBalances, setAlert);
    // --- 3. LOCAL UI STATE ---
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
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
    const [simMode, setSimMode] = useState<'dzd' | 'eur' | 'sell_dzd' | 'sell_eur'>('dzd');
    const [simBuyQty, setSimBuyQty] = useState('');
    const [simBuyPrice, setSimBuyPrice] = useState('');
    const [simEurQty, setSimEurQty] = useState('');
    const [simEurDzdPrice, setSimEurDzdPrice] = useState('');
    const [simEurUsdtRate, setSimEurUsdtRate] = useState('');
    const [simSellUsdtQty, setSimSellUsdtQty] = useState('');
    const [simSellDzdPrice, setSimSellDzdPrice] = useState('');
    const [simSellEurPrice, setSimSellEurPrice] = useState('');
    const [simSellEurToDzdRate, setSimSellEurToDzdRate] = useState('');
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
    const { handleExportClientReport, handleExportInvestorReport, handleExportPersonalExpensesReport, handleExportUsdtReport, reportClient, reportMonth, reportMonthNames, reportYear, setReportClient, setReportMonth, setReportYear, setUsdtReportMonth, setUsdtReportYear, usdtReportMonth, usdtReportYear } = useReportExports({
        clientBalances,
        clientTransactionsDzd,
        clientsDzd,
        derivedInvestors,
        getClientFullName,
        investorTransactions,
        loadPdfReports,
        managerFeePercentage,
        portfolioStats,
        pamLedger,
        setAlert,
        t,
        transactions,
        deliveryExpenses,
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
    const filteredClientsDzd = useMemo(() => {
        if (!shouldComputeClientDerivations)
            return clientsDzd;
        let list = [...clientsDzd];
        const normalizedQuery = clientSearchQuery.trim().toLowerCase();
        if (normalizedQuery) {
            list = list.filter(c =>
                nameMatchesQuery(getClientDisplayName(c), normalizedQuery) ||
                (c.phone && c.phone.includes(normalizedQuery))
            );
        }
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
    }, [shouldComputeClientDerivations, clientsDzd, clientSearchQuery, clientSortMode, clientBalances, clientTransactionsDzd]);
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
        clients: view === 'dashboard' ? clientsDzd : [],
        clientTransactions: view === 'dashboard' ? clientTransactionsDzd : [],
        clientBalances,
        getClientFullName: getClientDisplayName,
        minDays: -1
    });
    const shouldComputePortfolioSimulators = view === 'dashboard' || view === 'statistiques' || view === 'analytics';
    const newPamFromDzdSimulator = useMemo(() => {
        if (!shouldComputePortfolioSimulators)
            return null;
        const qty = parseAndEvaluate(simBuyQty);
        const price = parseAndEvaluate(simBuyPrice);
        if (qty <= 0 || price <= 0)
            return null;
        const totalCost = portfolioStats.usdt.costBasis + (qty * price);
        const totalQty = portfolioStats.usdt.purchasedQty + qty;
        return totalQty <= 0 ? 0 : totalCost / totalQty;
    }, [shouldComputePortfolioSimulators, simBuyQty, simBuyPrice, portfolioStats.usdt]);
    const newPamFromEurSimulator = useMemo(() => {
        if (!shouldComputePortfolioSimulators)
            return null;
        const eurQty = parseAndEvaluate(simEurQty);
        const eurPriceDzd = parseAndEvaluate(simEurDzdPrice);
        const rate = parseAndEvaluate(simEurUsdtRate);
        if (eurQty <= 0 || eurPriceDzd <= 0 || rate <= 0)
            return null;
        const newUsdtQty = eurQty / rate;
        const totalCost = portfolioStats.usdt.costBasis + (newUsdtQty * eurPriceDzd * rate);
        const totalQty = portfolioStats.usdt.purchasedQty + newUsdtQty;
        return totalQty <= 0 ? 0 : totalCost / totalQty;
    }, [shouldComputePortfolioSimulators, simEurQty, simEurDzdPrice, simEurUsdtRate, portfolioStats.usdt]);
    // Use PAM ledger derivedProfit as the single source of truth for global net profit.
    // This ensures the Dashboard total matches the amount distributed to investors.
    const globalNetProfit = Number(pamLedger.totals.derivedProfit || 0);
    const investorLiability = useMemo(() => calculateInvestorLiability(derivedInvestors), [derivedInvestors]);
    const investorBreakdown = useMemo(() => calculateInvestorBreakdown(derivedInvestors), [derivedInvestors]);
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
            last7DaysProfit,
        };
    }, [pamLedger, clientTransactionsDzd, treasuryStats]);
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
        const serviceRevenue = manualAssetTransactions.reduce((sum, tx) => sum + ((tx.type === 'service' || tx.type === 'invoice') ? Math.abs(Number(tx.amount || 0)) : 0), 0);
        return {
            amountToReceive,
            clientAdvances,
            cashReceived,
            serviceRevenue,
            netCapitalImpact: amountToReceive - clientAdvances,
            servicesCount: manualAssets.length,
            clientsCount: manualAssetClients.length
        };
    }, [assetClientBalances, manualAssetTransactions, manualAssets.length, manualAssetClients.length]);
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
    const openDateFilterModal = () => { setTempStartDate(dateRange.start ? dateRange.start.toISOString().split('T')[0] : ''); setTempEndDate(dateRange.end ? dateRange.end.toISOString().split('T')[0] : ''); setIsDateFilterModalOpen(true); };
    const handleApplyDateFilter = () => { if (tempStartDate && tempEndDate) {
        const s = new Date(tempStartDate);
        s.setHours(0, 0, 0, 0);
        const e = new Date(tempEndDate);
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
            if (diff === 0) {
                if (editingTreasuryBalanceTx) {
                    await userDocRef.collection('treasury_txs').doc(editingTreasuryBalanceTx.id).delete();
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
            if (editingTreasuryBalanceTx) {
                await userDocRef.collection('treasury_txs').doc(editingTreasuryBalanceTx.id).update(payload);
            }
            else {
                await userDocRef.collection('treasury_txs').add(payload);
            }
            setAlert("✅ Solde mis à jour.");
            closeTreasuryBalanceEditModal();
        }
        catch (e) {
            setAlert("❌ Erreur.");
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
                    await userDocRef.collection('usdt_txs').doc(editingPortfolioBalanceTx.id).delete();
                    setAlert(t('common.operationSuccess'));
                }
                closePortfolioBalanceEditModal();
                return;
            }
            const { date, time, timestamp } = now();
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
                const configuredSuggestedPrice = currency === 'EUR'
                    ? (parseFloat(suggestedSellingPriceEur || '0') || 0)
                    : (parseFloat(suggestedSellingPrice || '0') || 0);
                const margin = parseAndEvaluate(suggestedProfitMargin || '0');
                const derivedAvg = configuredSuggestedPrice - (isNaN(margin) ? 0 : margin);
                return derivedAvg > 0 ? derivedAvg : 0;
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
                await userDocRef.collection('usdt_txs').doc(editingPortfolioBalanceTx.id).update(txPayload);
            }
            else {
                if (type === 'Ajout Manuel' && referencePrice > 0) {
                    txPayload.price = Number(referencePrice.toFixed(2));
                    txPayload.total = Number((quantity * referencePrice).toFixed(2));
                }
                await userDocRef.collection('usdt_txs').add(txPayload);
            }
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
            if (editingWalletTransferTx) {
                await userDocRef.collection('treasury_txs').doc(editingWalletTransferTx.id).update(payload);
                setAlert("✅ Transfert mis à jour.");
            }
            else {
                await userDocRef.collection('treasury_txs').add(payload);
                setAlert("✅ Transfert enregistré.");
            }
            closeWalletTransferModal();
        }
        catch (e) {
            setAlert("❌ Erreur.");
        }
        finally {
            setIsSaving(false);
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
            if (editingTreasuryCard) {
                await userDocRef.collection('treasury_cards').doc(editingTreasuryCard.id).update(payload);
            }
            else {
                await userDocRef.collection('treasury_cards').add(payload);
            }
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
            await userDocRef.collection('treasury_cards').doc(treasuryCardToDelete.id).delete();
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
                batch.delete(userDocRef.collection('treasury_txs').doc(treasuryTxToDelete.id));
                batch.delete(userDocRef.collection('investor_transactions').doc(treasuryTxToDelete.linkedInvestorTxId));
                await batch.commit();
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
                setAlert("Erreur: Transaction introuvable.");
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
            }
            else if (linkedTreasuryId) {
                batch.delete(userDocRef.collection('treasury_txs').doc(linkedTreasuryId));
                txUpdatePayload.linkedTreasuryTxId = fieldValueDelete();
            }
            batch.update(txRef, txUpdatePayload);
            await batch.commit();
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
                setAlert("Erreur: Transaction introuvable.");
                return;
            }
            const txData = docSnap.data() as any;
            const batch = db.batch();
            batch.delete(txRef);
            if (txData?.linkedTreasuryTxId) {
                batch.delete(userDocRef.collection('treasury_txs').doc(txData.linkedTreasuryTxId));
            }
            else {
                const linkedTreasury = await userDocRef.collection('treasury_txs').where('linkedAssetTxId', '==', id).get();
                linkedTreasury.forEach(d => batch.delete(d.ref));
            }
            await batch.commit();
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
                await batch.commit();
                setAlert("✅ Supprimé.");
            }
            catch (e) {
                console.error(e);
                setAlert("❌ Erreur.");
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
        setIsSaving(true);
        try {
            const batch = db.batch();
            batch.delete(userDocRef.collection('investor_transactions').doc(investorTxToDelete.id));
            if (investorTxToDelete.linkedTreasuryTxId) {
                batch.delete(userDocRef.collection('treasury_txs').doc(investorTxToDelete.linkedTreasuryTxId));
            }
            await batch.commit();
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
            setAlert("✅ Réinitialisé.");
            setRefreshKey(prev => prev + 1);
            setIsResetModalOpen(false);
        }
        catch (e) {
            setAlert("❌ Erreur.");
        }
        finally {
            setIsSaving(false);
        }
    };
    const bgApp = "bg-app-bg text-neutral-900";
    const fieldBase = "bg-surface-muted border-border text-neutral-900 focus:ring-primary";
    const detectAlertTone = (message: string): 'success' | 'error' | 'info' => {
        const normalized = (message || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
        const hasAny = (tokens: string[]) => tokens.some((token) => normalized.includes(token));
        const errorTokens = [
            'error', 'erreur', 'failed', 'echec', 'invalide', 'invalid',
            'impossible', 'introuvable', 'not found', 'insuffisant', 'insufficient',
            'orphan', 'orpheline'
        ];
        const successTokens = [
            'success', 'succes', 'reussi', 'reussie', 'operation reussie',
            'mis a jour', 'mise a jour', 'ajoute', 'ajoutee', 'supprime',
            'supprimee', 'transfert reussi', 'saved', 'updated', 'added',
            'deleted', 'enregistre', 'confirme'
        ];
        if (hasAny(errorTokens))
            return 'error';
        if (hasAny(successTokens))
            return 'success';
        return 'info';
    };
    const alertTone = detectAlertTone(alert);
    const alertClass = alertTone === 'success'
        ? ('border-financial-profit/40 bg-success-bg text-financial-profit')
        : alertTone === 'error'
            ? ('border-financial-loss/40 bg-danger-bg text-financial-loss')
            : ('border-info/40 bg-info-bg text-info');
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
    const portfolioPageProps = useMemo(() => ({
        statsView,
        setStatsView,
        setIsSettingsModalOpen,
        portfolioStats,
        totalPortfolioValue: (portfolioStats.usdt.available * portfolioStats.usdt.avgBuy + portfolioStats.eur.available * portfolioStats.eur.avgBuy),
        suggestedProfitMargin,
        suggestedSellingPrice,
        suggestedUsdtEurSellPrice,
        suggestedSellingPriceEur,
        parseAndEvaluate,
        usdtReportMonth,
        setUsdtReportMonth,
        usdtReportYear,
        setUsdtReportYear,
        reportMonths: (year: number) => year === new Date().getFullYear() ? reportMonthNames.slice(0, new Date().getMonth() + 1) : reportMonthNames,
        reportYears: Array.from({ length: 3 }, (_, i) => 2024 + i),
        monthlyStats: { totalUsdtSoldMonth: 0, totalEurBoughtMonth: 0, realizedProfitMonth: 0, monthlyProfitMargin: 0 },
        transactions,
        selectedHeatmapDay,
        setSelectedHeatmapDay,
        simMode,
        setSimMode,
        simBuyQty,
        setSimBuyQty,
        simBuyPrice,
        setSimBuyPrice,
        fieldBase,
        newPamFromDzdSimulator,
        simEurQty,
        setSimEurQty,
        simEurDzdPrice,
        setSimEurDzdPrice,
        simEurUsdtRate,
        setSimEurUsdtRate,
        newPamFromEurSimulator,
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
        handleExportClientReport,
        simSellUsdtQty,
        setSimSellUsdtQty,
        simSellDzdPrice,
        setSimSellDzdPrice,
        simSellEurPrice,
        setSimSellEurPrice,
        simSellEurToDzdRate,
        setSimSellEurToDzdRate,
        openPortfolioBalanceEditModal
    }), [
        statsView, portfolioStats, suggestedProfitMargin, suggestedSellingPrice, suggestedUsdtEurSellPrice, suggestedSellingPriceEur,
        usdtReportMonth, usdtReportYear, transactions, clientTransactionsDzd, selectedHeatmapDay, simMode, simBuyQty, simBuyPrice,
        fieldBase, newPamFromDzdSimulator, simEurQty, simEurDzdPrice, simEurUsdtRate, newPamFromEurSimulator,
        reportClient, clientsDzd, reportMonth, reportYear, simSellUsdtQty, simSellDzdPrice, simSellEurPrice, simSellEurToDzdRate, reportMonthNames,
        getClientFullName, handleExportClientReport, handleExportUsdtReport, openPortfolioBalanceEditModal
    ]);
    // Bulk-import clients from CSV. Skips duplicates by name or phone, creates
    // an initial-balance ledger entry when an `initialBalance` column is mapped.
    const handleImportClients = async (rows: Record<string, string>[]): Promise<void> => {
        if (!rows || rows.length === 0)
            return;
        const existingNames = new Set(clientsDzd.map(c => (c.fullName || c.nom || '').toLowerCase()));
        const existingPhones = new Set(clientsDzd.map(c => (c.phone || '').replace(/\s+/g, '')));
        let added = 0, skipped = 0;
        for (const row of rows) {
            const fullName = (row.fullName || '').trim();
            if (!fullName) {
                skipped++;
                continue;
            }
            const phone = (row.phone || '').trim();
            const phoneKey = phone.replace(/\s+/g, '');
            if (existingNames.has(fullName.toLowerCase()) || (phoneKey && existingPhones.has(phoneKey))) {
                skipped++;
                continue;
            }
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

    const clientsPageProps = useMemo(() => ({
        selectedClientId,
        setSelectedClientId,
        openClientModal,
        setIsTransferModalOpen,
        clientSearchQuery,
        setClientSearchQuery,
        clientSortMode,
        setClientSortMode,
        filteredClientsDzd,
        clientBalances,
        getClientFullName,
        handleTouchStart,
        handleTouchEnd,
        setClientToDelete: handleClientDeleteRequest,
        selectedClient,
        selectedClientTransactions,
        transactions,
        handleExportClientReport,
        openClientTxModal,
        copiedValue,
        handleCopy,
        handleEditClientTx: handleEditLinkedClientTx,
        handleDeleteClientTxClick: handleDeleteLinkedClientTxClick,
        overdueDebtClients,
        clientLoyaltyMap,
        onImportClients: handleImportClients,
    }), [
        selectedClientId, clientSearchQuery, clientSortMode,
        filteredClientsDzd, clientBalances, selectedClient, selectedClientTransactions, transactions, copiedValue,
        openClientModal, handleTouchStart, handleTouchEnd, handleClientDeleteRequest, handleExportClientReport, openClientTxModal,
        handleCopy, handleEditLinkedClientTx, handleDeleteLinkedClientTxClick, overdueDebtClients, clientLoyaltyMap
    ]);
    if (isInvestorRoute) {
        const investor = derivedInvestors.find(i => i.id === investorIdFromUrl) || derivedInvestors[0];
        if (!investor) {
            return (<div className="min-h-screen flex items-center justify-center bg-app-bg text-neutral-500">
                    {derivedInvestors.length === 0 ? "Chargement des données investisseur..." : "Investisseur non trouvé."}
                </div>);
        }
        const myTransactions = investorTransactions.filter(tx => tx.investorId === investor.id);
        const totalCapital = derivedInvestors.reduce((sum, inv) => sum + (inv.isActive ? inv.capitalInvested : 0), 0);
        return (<Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-app-bg text-neutral-500">{t('common.loading')}</div>}>
                <InvestorDashboardPage investor={investor} transactions={myTransactions} globalNetProfit={globalNetProfit} managerFeePercentage={Number(managerFeePercentage)} totalCapital={totalCapital} onExportReport={(range) => handleExportInvestorReport(investor.id, range)}/>
            </Suspense>);
    }
    // Quick sell: pre-fills sell form with max qty + PAM+margin price
    const openQuickSell = React.useCallback(() => {
        const usdtAvail = portfolioStats.usdt.available;
        const usdtPam = portfolioStats.usdt.avgBuy;
        if (usdtAvail <= 0 || usdtPam <= 0) {
            openForm('sell_usdt');
            return;
        }
        const margin = parseAndEvaluate(suggestedProfitMargin);
        const suggestedPrice = (usdtPam + (isNaN(margin) ? 2 : margin)).toFixed(2);
        navigateToView('transactions');
        setTimeout(() => {
            openForm('sell_usdt', null, {
                sellQty: usdtAvail.toFixed(2),
                sellPrice: suggestedPrice,
            });
        }, 80); // let navigation settle first
    }, [portfolioStats.usdt.available, portfolioStats.usdt.avgBuy, suggestedProfitMargin, openForm, navigateToView]);

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
        insights: 'Insights',
        more: t('nav.more') as string || 'Menu',
        settings: t('common.settings') as string || 'Parametres',
        money: t('nav.money') as string || 'Argent',
        followUp: t('nav.followUp') as string || 'Suivi',
        documents: t('nav.documents') as string || 'Documents',
        expenses: t('nav.expenses') as string || 'Mes dépenses'
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
    const dashboardPageProps = {
        dailyOverview,
        portfolioStats,
        treasuryStats,
        totals,
        treasuryCards,
        investorLiability,
        investorBreakdown,
        servicesSummary,
        globalNetProfit,
        overdueDebtClients: dashboardDebtClients,
        isDataSyncing: !dataStatus.hasServerSynced,
        onNewTransaction: () => openForm('buy_usdt'),
        onOpenClients: () => { setSelectedClientId(null); setView('dzd'); },
        onOpenClient: openDashboardClient,
        onOpenClientDebts: openClientsWithDebtFollowUp,
        onOpenTreasury: () => setView('tresorerie'),
        onOpenAnalytics: () => setView('analytics'),
        onOpenPersonalWithdrawal: openPersonalWithdrawalModal,
        recentTransactions: transactions.slice(0, 5),
        onOpenTransactions: () => setView('transactions'),
        onQuickSell: portfolioStats.usdt.available > 0 ? openQuickSell : undefined,
        quickSellPreview: portfolioStats.usdt.available > 0 ? {
            qty: portfolioStats.usdt.available,
            price: portfolioStats.usdt.avgBuy + parseAndEvaluate(suggestedProfitMargin),
            pam: portfolioStats.usdt.avgBuy,
        } : null,
    };
    const mainContentProps = { alert, alertClass, t, dailyOverview, userDocRef, setAlert, PageLoadingFallback, view, DashboardPage, dashboardPageProps, InsightsPage, TransactionsPage, openAdjustmentModal, openForm, filterMode, setFilterMode, transactions, getRelativeDateLabel, clientTransactionsDzd, clientsDzd, getClientFullName, setTxToDelete, openDateFilterModal, dateRange, setDateRange, openWalletTransferModal, openTransferModal, openDeliveryExpenseModal, openPersonalWithdrawalModal, treasuryTransactions, handleEditPortfolioTx, handleEditClientTx: handleEditLinkedClientTx, handleEditTreasuryTx, handleDeleteClientTxClick: handleDeleteLinkedClientTxClick, setTreasuryTxToDelete, PortfolioPage, portfolioPageProps, AnalyticsPage, PersonalExpensesPage, personalExpenses, managerAvailableProfit, managerExists, openReconcileAdvanceModal, openEditPersonalExpense, setPersonalExpenseToDelete, handleExportPersonalExpensesReport, ClientsPage, clientsPageProps, ServicesPage, selectedAssetClientId, ManualClientPage, manualAssetClients, manualAssetTransactions, assetClientBalances, selectedAssetId, setSelectedAssetClientId, handleCreateAssetTransaction, handleUpdateAssetTransaction, handleDeleteAssetTransaction, fieldBase, ManualAssetPage, manualAssets, handleCreateAssetClient, handleUpdateAssetClient, handleDeleteAssetClient, TresoreriePage, treasuryStats, totals, portfolioStats, investorLiability, investorBreakdown, globalNetProfit, openTreasuryCardModal, treasuryCards, setTreasuryCardToDelete, openTreasuryBalanceEditModal, openPortfolioBalanceEditModal, assetBalances, servicesSummary, openServicesView, setSelectedAssetId, setIsCreateAssetModalOpen, handleDeleteAsset, selectedInvestorId, setSelectedInvestorId, InvestorDetailsPage, derivedInvestors, investorTransactions, investorEconomicsTotals: investorEconomics.totals, setInvestorTxType, setIsInvestorTxModalOpen, setReinvestInput, setIsReinvestModalOpen, setInvestorTxToDelete, managerFeePercentage, InvestorsPage, openInvestorModal, setInvestorToDelete, setManagerFeePercentage, handleExportInvestorReport };
    const walletTransferDialogProps = useMemo(() => ({
        isOpen: isWalletTransferModalOpen, onClose: closeWalletTransferModal, fieldBase,
        amount: walletTransferAmount, setAmount: setWalletTransferAmount, source: walletTransferSource, setSource: setWalletTransferSource,
        destination: walletTransferDest, setDestination: setWalletTransferDest, notes: walletTransferNotes, setNotes: setWalletTransferNotes,
        onMax: handleWalletTransferMaxClick, onSwap: handleSwapSourceDest, onConfirm: handleWalletTransfer, isInvalid: isWalletTransferInvalid,
        isSaving, caisseBalance: getWalletTransferEditableBalance('Caisse'), baridiBalance: getWalletTransferEditableBalance('BaridiMob'), title: editingWalletTransferTx ? `${t('common.edit')} ${t('transactions.internalTransfer')}` : t('transactions.internalTransfer'),
        subtitle: 'Transfert entre comptes internes', amountLabel: t('transactions.amount'), fromLabel: t('transactions.from'),
        toLabel: t('transactions.to'), sourceLabel: t('common.source'), destinationLabel: t('common.destination'),
        notesOptionalLabel: t('common.notesOptional'), sameAccountErrorText: 'Impossible de selectionner le meme compte.',
        processingText: t('common.processing'), confirmText: editingWalletTransferTx ? t('common.save') : t('transactions.confirmTransfer')
    }), [isWalletTransferModalOpen, closeWalletTransferModal, fieldBase, walletTransferAmount, walletTransferSource, walletTransferDest, walletTransferNotes, handleWalletTransferMaxClick, handleSwapSourceDest, handleWalletTransfer, isWalletTransferInvalid, isSaving, editingWalletTransferTx, treasuryStats.caisse, treasuryStats.baridi, t]);
    const clientTransferDialogProps = useMemo(() => ({
        isOpen: isTransferModalOpen, onClose: closeTransferModal, fieldBase,
        fromClientId: transferFromClientId, setFromClientId: setTransferFromClientId, toClientId: transferToClientId, setToClientId: setTransferToClientId,
        amount: transferAmount, setAmount: setTransferAmount, notes: transferNotes, setNotes: setTransferNotes, onSave: handleSaveTransfer,
        isSaving, clients: clientsDzd.map(c => ({ id: c.id, label: getClientFullName(c) })), fromBalance: transferFromBalance,
        toBalance: transferToBalance, onMaxFrom: () => setTransferAmount(Math.abs(transferFromBalance).toString()),
        title: editingTransferTx ? `${t('common.edit')} ${t('transactions.clientTransfer')}` : t('transactions.clientTransfer'), infoText: t('transactions.transferDebtCredit'), fromLabel: t('transactions.from'),
        toLabel: t('transactions.to'), amountLabel: t('transactions.amount'), notesLabel: t('common.notes'),
        filterClientsLabel: t('transactions.filterClients'), balanceLabel: t('common.balance'), dinarLabel: t('common.dinar'),
        confirmLabel: editingTransferTx ? t('common.save') : t('transactions.confirmTransfer')
    }), [isTransferModalOpen, closeTransferModal, fieldBase, transferFromClientId, transferToClientId, transferAmount, transferNotes, handleSaveTransfer, isSaving, clientsDzd, getClientFullName, transferFromBalance, transferToBalance, setTransferAmount, editingTransferTx, t]);
    const treasuryBalanceEditDialogProps = useMemo(() => ({
        isOpen: isTreasuryBalanceEditModalOpen, onClose: closeTreasuryBalanceEditModal, fieldBase,
        asset: treasuryBalanceEditAsset, value: treasuryBalanceEditValue, notes: treasuryBalanceEditNotes, setNotes: setTreasuryBalanceEditNotes,
        onSave: handleSaveTreasuryBalanceEdit, titlePrefix: t('transactions.editBalance'), descriptionText: t('transactions.editBalanceDesc'),
        newBalanceLabel: t('transactions.newBalance'), dinarLabel: t('common.dinar'), notesOptionalLabel: t('common.notesOptional'),
        reasonPlaceholder: t('transactions.reason'), saveLabel: t('common.save'),
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
        onSave: handleSavePortfolioBalanceEdit, isSaving, titlePrefix: t('transactions.editBalance'), descriptionText: `${t('transactions.editBalanceDesc')} Utilisez +montant pour ajouter ou -montant pour retirer.`,
        newBalanceLabel: `${t('transactions.newBalance')} / Ajustement`, notesOptionalLabel: t('common.notesOptional'), reasonPlaceholder: t('transactions.reason'),
        saveLabel: t('common.save'), savingLabel: t('common.saving'),
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
    // Wire Android/browser system back button. Highest-priority handler first;
    // falls through to changing the active tab toward `transactions` (root).
    useBackHandler([
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
    // Surface a recap of the previous month's realized profit on first
    // visit of a new month. Banner self-dismisses (persisted in localStorage).
    const { recap: monthlyRecap, dismiss: dismissMonthlyRecap } = useMonthlyRecap(transactions, pamLedger);

    // Notifications
    const [showNotifBanner, setShowNotifBanner] = React.useState(false);
    const notifications = useNotifications(userDocRef);

    // Show permission banner once (after 30s) if not yet asked and supported
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
    const { recap: weeklyRecap, dismiss: dismissWeeklyRecap } = useWeeklyRecap({
        transactions,
        clientTransactionsDzd,
        clientsDzd,
        getClientFullName,
        providedPamLedger: pamLedger,
    });
    const [isCalcOpen, setIsCalcOpen] = React.useState(false);

    // Pricing context for the smart sell assistant
    const pricingContext = React.useMemo(() => {
        const now = new Date();
        const dayOfMonth = now.getDate();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const daysRemaining = Math.max(1, daysInMonth - dayOfMonth + 1);
        const monthlyGoal = monthlyGoalState; // reactive — updates when goal changes
        const mtdProfit = dailyOverview.monthToDateProfit;
        const mtdUsdtSold = dailyOverview.monthToDateUsdtSold;

        // Daily needed = remaining goal / remaining days
        const remaining = monthlyGoal > 0 ? Math.max(0, monthlyGoal - mtdProfit) : 0;
        const dailyNeeded = monthlyGoal > 0 ? Math.ceil(remaining / daysRemaining) : 0;

        // Avg margin per USDT from last 90 days
        const ninetyDaysAgo = now.getTime() - 90 * 86_400_000;
        let totalProfit90 = 0;
        let totalQty90 = 0;
        for (const row of pamLedger.sellProfitRows) {
            if (row.timestamp < ninetyDaysAgo || row.currency !== 'USDT') continue;
            totalProfit90 += row.derivedProfit || 0;
            totalQty90 += Number(row.quantity || 0);
        }
        const historicalMargin = totalQty90 > 0 ? totalProfit90 / totalQty90 : parseAndEvaluate(suggestedProfitMargin);

        // Avg monthly USDT sold — last 3 months (approx 90 days)
        const avgMonthlyUsdtSold = totalQty90 > 0 ? totalQty90 / 3 : 0;

        // Goal-based margin: margin needed per USDT to reach monthly goal
        const goalMargin = avgMonthlyUsdtSold > 0 && monthlyGoal > 0
            ? monthlyGoal / avgMonthlyUsdtSold
            : 0;

        // Effective margin = whichever is higher (ensures goal is achievable)
        const avgMarginPerUsdt = Math.max(historicalMargin, goalMargin);

        return {
            dailyNeeded,
            avgMarginPerUsdt,       // effective (used for pricing)
            historicalMargin,       // raw historical (for display)
            goalMargin,             // goal-required margin (for display)
            avgMonthlyUsdtSold,
            monthlyGoal,
            monthToDateProfit: mtdProfit,
            monthToDateUsdtSold: mtdUsdtSold,
            dayOfMonth,
            daysInMonth,
            daysRemaining,
            fallbackMargin: parseAndEvaluate(suggestedProfitMargin),
        };
    }, [pamLedger, dailyOverview, suggestedProfitMargin, monthlyGoalState]);

    const handleExportBackup = React.useCallback(() => {
        try {
            const backup = {
                version: 1,
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
    }, [transactions, clientsDzd, clientTransactionsDzd, treasuryTransactions, derivedInvestors, investorTransactions, treasuryCards, manualAssets, manualAssetClients, manualAssetTransactions]);
    // Per-view quick action wired to the bottom-bar center FAB. Returning
    // undefined hides the FAB on read-mostly views.
    const onFabPress = useMemo(() => {
        if (view === 'dashboard')
            return () => openForm('buy_usdt');
        if (view === 'transactions')
            return () => openForm('buy_usdt');
        if (view === 'dzd')
            return () => openClientModal(null);
        if (view === 'services' && !selectedAssetId && !selectedAssetClientId)
            return () => setIsCreateAssetModalOpen(true);
        if (view === 'investors')
            return () => openInvestorModal(null);
        if (view === 'tresorerie')
            return () => openAdjustmentModal('add');
        return undefined;
    }, [view, selectedAssetId, selectedAssetClientId, openForm, openClientModal, openAdjustmentModal, openInvestorModal]);
    return (<div className={`min-h-screen bg-gradient-to-br ${bgApp} transition-colors duration-300`}>
            <OfflineBanner />
            <div className="mx-auto max-w-4xl px-page-x pb-24 sm:px-4">
                    <MainHeaderBar {...{ view, setView: navigateToView, globalSearchTitle: t('common.globalSearch'), setIsMobileMenuOpen, handleOpenGlobalSearch, onOpenSettings: () => setIsSettingsModalOpen(true), onSignOut: () => signOut(auth), labels: navLabels }}/>
                <AppMobileMenuNav view={view} onSelect={navigateToView} isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} labels={navLabels} onOpenSettings={() => setIsSettingsModalOpen(true)} handleOpenGlobalSearch={handleOpenGlobalSearch} onSignOut={() => signOut(auth)}/>

                <WeeklyRecapBanner recap={weeklyRecap} onDismiss={dismissWeeklyRecap}/>
                <MonthlyRecapBanner recap={monthlyRecap} onDismiss={dismissMonthlyRecap}/>
                {showNotifBanner && notifications.permission === 'default' && (
                    <NotificationPermissionBanner
                        onRequest={async () => {
                            const result = await notifications.requestPermission();
                            setShowNotifBanner(false);
                            return result;
                        }}
                        onDismiss={() => {
                            setShowNotifBanner(false);
                            localStorage.setItem('app_notification_perm_asked', '1');
                        }}
                    />
                )}

                <MainContentArea {...mainContentProps}/>

                <AppBottomNav view={view} onSelect={navigateToView} labels={navLabels} onFabPress={onFabPress} overdueCount={overdueDebtClients.length}/>

                {/* Quick Calculator FAB */}
                <button
                    type="button"
                    onClick={() => setIsCalcOpen(true)}
                    className="fixed bottom-[76px] end-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white shadow-lg transition-transform hover:bg-primary-dark hover:scale-105 active:scale-95"
                    aria-label="Calculatrice rapide"
                    title="Calculatrice rapide"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <rect x="4" y="2" width="16" height="20" rx="2" strokeLinejoin="round"/>
                        <line x1="8" y1="8" x2="16" y2="8"/>
                        <line x1="8" y1="12" x2="10" y2="12"/>
                        <line x1="14" y1="12" x2="16" y2="12"/>
                        <line x1="8" y1="16" x2="10" y2="16"/>
                        <line x1="14" y1="16" x2="16" y2="16"/>
                    </svg>
                </button>

                {isCalcOpen && (<Suspense fallback={null}>
                        <QuickCalculatorSheet isOpen={isCalcOpen} onClose={() => setIsCalcOpen(false)} portfolioStats={portfolioStats} pricingContext={pricingContext}/>
                    </Suspense>)}

                {isGlobalSearchOpen && (<Suspense fallback={null}>
                        <GlobalSearchDialog {...{ isOpen: isGlobalSearchOpen, onClose: closeGlobalSearch, fieldBase, query: globalSearchQuery, setQuery: setGlobalSearchQuery, results: globalSearchResults, onSelectResult: handleSelectGlobalSearchResult, title: t('common.globalSearch'), placeholder: t('common.searchPlaceholder'), noResultsText: t('common.noResults'), clientsText: t('nav.clients'), transactionsText: t('nav.transactions') }}/>
                    </Suspense>)}
            </div>

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
        handleSaveDeliveryExpense,
        isPersonalWithdrawalModalOpen, closePersonalWithdrawalModal,
        personalWithdrawalAmount, setPersonalWithdrawalAmount,
        personalWithdrawalMethod, setPersonalWithdrawalMethod,
        personalWithdrawalDate, setPersonalWithdrawalDate,
        personalWithdrawalNote, setPersonalWithdrawalNote,
        personalWithdrawalMode, setPersonalWithdrawalMode,
        editingPersonalExpenseTx,
        personalExpenseToDelete, setPersonalExpenseToDelete,
        handleSavePersonalWithdrawal,
        handleDeletePersonalExpense,
        managerAvailableProfit, managerExists,
        isReconcileAdvanceModalOpen, closeReconcileAdvanceModal,
        reconcileAdvanceTx, reconcileActualAmount, setReconcileActualAmount,
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
        notes, setNotes,
        txTags, setTxTags,
        buyEurForUsdtAmount, setBuyEurForUsdtAmount,
        eurDzdPrice, eurUsdtRate, setEurUsdtRate,
        sellAmount, setSellAmount,
        sellPrice, setSellPrice,
        sellTotal, setSellTotal,
        sellSettlementCurrency, setSellSettlementCurrency,
        sellEurToDzdRate, setSellEurToDzdRate,
        suggestedSellingPrice, suggestedUsdtEurSellPrice, suggestedSellingPriceEur, suggestedProfitMargin,
        profitPercent, setProfitPercent,
        buyEurAmount, setBuyEurAmount,
        buyEurPrice, setBuyEurPrice,
        buyEurTotal, setBuyEurTotal,
        handleBuy, handleSell,
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
        initialBalance, setInitialBalance,
        handleSaveClient,
        clientToDelete, clientDeleteMode,
        handleClientDeleteRequest,
        handleDeleteClient,
        isUtilityDialogsOpen,
        isSettingsModalOpen, setIsSettingsModalOpen,
        setSuggestedProfitMargin,
        setSuggestedSellingPrice,
        setSuggestedUsdtEurSellPrice,
        setSuggestedSellingPriceEur,
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
        handleExportClientReport,
        reportMonth, reportYear,
        isInvestorDialogsOpen,
        isInvestorModalOpen, setIsInvestorModalOpen,
        editingInvestor,
        handleSaveInvestor,
        investorName, setInvestorName,
        investorInitialCapital, setInvestorInitialCapital,
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

        </div>);
}
