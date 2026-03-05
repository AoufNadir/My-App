import React, { useState, useEffect, useMemo, useRef, Suspense } from 'react';

import { Tx, ClientDzd, ClientTransactionDzd, TreasuryTx, TreasuryCard, ManualAsset, ManualAssetClient, ManualAssetTransaction, Investor, InvestorTransaction } from './types';
import { useLanguage } from './contexts/LanguageContext';
import { signOut } from 'firebase/auth';
import { auth, db, fieldValueDelete, type AppUser } from './firebase';

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
import { MainTransactionDialog } from './components/main/MainTransactionDialog';
import { MainClientSummaryDialog } from './components/main/MainClientSummaryDialog';
import { MainInvestorDialogs } from './components/main/MainInvestorDialogs';
import { MainUtilityDialogs } from './components/main/MainUtilityDialogs';
import { MainClientOperationsDialogs } from './components/main/MainClientOperationsDialogs';
import { MainClientCrudDialogs } from './components/main/MainClientCrudDialogs';
import { MainHeaderBar } from './components/main/MainHeaderBar';
import { MainContentArea } from './components/main/MainContentArea';
import { MainTransferAndFilterDialogs } from './components/main/MainTransferAndFilterDialogs';
import {
    GlobalSearchDialog,
    WalletTransferDialog
} from './components/main/MainDialogs';
// Custom Hooks
import { useAppData } from './hooks/useAppData';
import { useSettings } from './hooks/useSettings';
import { useTransactionHandlers } from './hooks/useTransactionHandlers';
import { useClientHandlers } from './hooks/useClientHandlers';
import { useAssetHandlers } from './hooks/useAssetHandlers';
import { useInvestorHandlers } from './hooks/useInvestorHandlers';
import { useOverdueDebtClients } from './hooks/useOverdueDebtClients';

// Shared Utils
import { now, parseAndEvaluate } from './utils';

// Modals
import { TransactionModal } from './components/modals/TransactionModal';
import { ClientModal } from './components/modals/ClientModal';
import { AdjustmentModal } from './components/modals/AdjustmentModal';

const TransactionsPage = React.lazy(() =>
    import('./pages/TransactionsPage').then((module) => ({ default: module.TransactionsPage }))
);
const PortfolioPage = React.lazy(() =>
    import('./pages/PortfolioPage').then((module) => ({ default: module.PortfolioPage }))
);
const AnalyticsPage = React.lazy(() =>
    import('./pages/AnalyticsPage').then((module) => ({ default: module.AnalyticsPage }))
);
const ClientsPage = React.lazy(() =>
    import('./pages/ClientsPage').then((module) => ({ default: module.ClientsPage }))
);
const TresoreriePage = React.lazy(() =>
    import('./pages/TresoreriePage').then((module) => ({ default: module.TresoreriePage }))
);
const ManualAssetPage = React.lazy(() =>
    import('./pages/ManualAssetPage').then((module) => ({ default: module.ManualAssetPage }))
);
const ManualClientPage = React.lazy(() =>
    import('./pages/ManualClientPage').then((module) => ({ default: module.ManualClientPage }))
);
const InvestorsPage = React.lazy(() =>
    import('./pages/InvestorsPage').then((module) => ({ default: module.InvestorsPage }))
);
const InvestorDetailsPage = React.lazy(() =>
    import('./pages/InvestorDetailsPage').then((module) => ({ default: module.InvestorDetailsPage }))
);
const InvestorDashboardPage = React.lazy(() =>
    import('./pages/InvestorDashboardPage').then((module) => ({ default: module.InvestorDashboardPage }))
);

function PageLoadingFallback({ isDark, text }: { isDark: boolean; text: string }) {
    return (
        <div className={`w-full rounded-2xl border p-6 text-center text-sm font-semibold ${isDark ? 'border-slate-700 bg-slate-800/60 text-slate-200' : 'border-slate-200 bg-white/80 text-slate-700'}`}>
            {text}
        </div>
    );
}

type GlobalSearchResult =
    | { id: string; kind: 'client'; title: string; subtitle: string; clientId: string; timestamp: number }
    | { id: string; kind: 'transaction'; title: string; subtitle: string; timestamp: number };





export default function MainApp({ user }: { user: AppUser }) {
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
        if (!installPrompt) return;
        installPrompt.prompt();
        installPrompt.userChoice.then((choiceResult: { outcome: string }) => {
            setInstallPrompt(null);
        });
    };

    // --- 1. CORE DATA & SETTINGS ---
    const { t } = useLanguage();
    const [refreshKey, setRefreshKey] = useState(0);
    const [alert, setAlert] = useState('');
    const [selectedClientId, setSelectedClientId] = useState<string | null>(() => localStorage.getItem('selected_client_id'));

    // 1.1 App Data (Provides userDocRef)
    const {
        userDocRef, transactions, clientsDzd, clientTransactionsDzd, treasuryTransactions, treasuryCards, manualAssets,
        manualAssetClients, manualAssetTransactions, portfolioStats, treasuryStats, clientBalances,
        assetClientBalances, assetBalances, totals, investorTransactions, investors, isDataLoaded
    } = useAppData(user, refreshKey);

    // 1.2 Settings
    const {
        suggestedProfitMargin, setSuggestedProfitMargin,
        suggestedSellingPrice, setSuggestedSellingPrice,
        managerFeePercentage, setManagerFeePercentage,
        setTheme, isDark
    } = useSettings(userDocRef);

    // 1.3 Derived Data
    const derivedInvestors = useMemo(() => {
        const toMs = (value: any): number => {
            if (typeof value === 'number') return value;
            if (value && typeof value.toMillis === 'function') return value.toMillis();
            const parsed = new Date(value).getTime();
            return Number.isFinite(parsed) ? parsed : 0;
        };

        const feePercent = parseFloat(managerFeePercentage) || 0;
        const managerFeeRatio = Math.max(0, Math.min(1, feePercent / 100));

        const txByInvestor = new Map<string, InvestorTransaction[]>();
        for (const tx of investorTransactions) {
            const list = txByInvestor.get(tx.investorId) || [];
            list.push(tx);
            txByInvestor.set(tx.investorId, list);
        }

        const investorsBase = investors.map(inv => {
            const myTxs = txByInvestor.get(inv.id) || [];
            const movementTxs = myTxs.filter(tx =>
                tx.type === 'deposit_capital' ||
                tx.type === 'reinvest_profit' ||
                tx.type === 'withdraw_capital'
            );

            const currentCapitalFromMovements = movementTxs.reduce((sum, tx) => {
                if (tx.type === 'withdraw_capital') return sum - tx.amount;
                return sum + tx.amount;
            }, 0);

            const withdrawnProfit = myTxs
                .filter(tx => tx.type === 'withdraw_profit')
                .reduce((sum, tx) => sum + tx.amount, 0);
            const reinvestedProfit = myTxs
                .filter(tx => tx.type === 'reinvest_profit')
                .reduce((sum, tx) => sum + tx.amount, 0);

            return {
                ...inv,
                entryTs: toMs(inv.entryDate),
                txs: myTxs,
                hasCapitalMovements: movementTxs.length > 0,
                capitalInvested: movementTxs.length > 0 ? currentCapitalFromMovements : inv.initialCapital,
                withdrawnProfit,
                reinvestedProfit
            };
        });

        const capitalAtTs = (inv: typeof investorsBase[number], ts: number): number => {
            const movementsUntilTs = inv.txs.filter(tx =>
                toMs(tx.timestamp) <= ts &&
                (tx.type === 'deposit_capital' || tx.type === 'reinvest_profit' || tx.type === 'withdraw_capital')
            );

            if (movementsUntilTs.length === 0) {
                return inv.hasCapitalMovements ? 0 : inv.initialCapital;
            }

            return movementsUntilTs.reduce((sum, tx) => {
                if (tx.type === 'withdraw_capital') return sum - tx.amount;
                return sum + tx.amount;
            }, 0);
        };

        const distributedProfitByInvestor = new Map<string, number>();
        for (const inv of investorsBase) distributedProfitByInvestor.set(inv.id, 0);

        const sellTxs = transactions
            .filter(tx => tx.type === 'sell' && tx.currency === 'USDT' && (tx.profit || 0) !== 0)
            .sort((a, b) => toMs(a.timestamp) - toMs(b.timestamp));

        for (const sellTx of sellTxs) {
            const sellTs = toMs(sellTx.timestamp);
            const distributableProfit = (sellTx.profit || 0) * (1 - managerFeeRatio);

            const eligible = investorsBase
                .filter(inv => inv.entryTs <= sellTs)
                .map(inv => ({ id: inv.id, cap: Math.max(0, capitalAtTs(inv, sellTs)) }))
                .filter(item => item.cap > 0);

            const totalCapAtSell = eligible.reduce((sum, item) => sum + item.cap, 0);
            if (totalCapAtSell <= 0) continue;

            for (const item of eligible) {
                const share = item.cap / totalCapAtSell;
                distributedProfitByInvestor.set(
                    item.id,
                    (distributedProfitByInvestor.get(item.id) || 0) + (distributableProfit * share)
                );
            }
        }

        const totalCurrentCapital = investorsBase.reduce((sum, inv) => {
            if (!inv.isActive || inv.capitalInvested <= 0) return sum;
            return sum + inv.capitalInvested;
        }, 0);

        return investorsBase.map(inv => {
            const currentShare = inv.isActive && totalCurrentCapital > 0
                ? Math.max(0, inv.capitalInvested) / totalCurrentCapital
                : 0;
            const totalProfit = distributedProfitByInvestor.get(inv.id) || 0;
            const availableProfit = totalProfit - inv.withdrawnProfit - inv.reinvestedProfit;

            return {
                ...inv,
                sharePercentage: currentShare,
                totalProfit,
                availableProfit
            };
        });
    }, [investors, investorTransactions, managerFeePercentage, transactions]);

    // --- 2. BUSINESS LOGIC HOOKS ---
    const {
        isSaving, setIsSaving, mode, setMode, editingTx, setEditingTx, isTotalManual, setIsTotalManual,
        buyUsdtAmount, setBuyUsdtAmount, buyUsdtPrice, setBuyUsdtPrice, buyUsdtTotal, setBuyUsdtTotal,
        buyEurAmount, setBuyEurAmount, buyEurPrice, setBuyEurPrice, buyEurTotal, setBuyEurTotal,
        sellAmount, setSellAmount, sellPrice, setSellPrice, sellTotal, setSellTotal,
        buyUsdtMode, setBuyUsdtMode, buyEurForUsdtAmount, setBuyEurForUsdtAmount,
        eurDzdPrice, setEurDzdPrice, eurUsdtRate, setEurUsdtRate,
        linkedClientId, setLinkedClientId, linkedClientDzdId, setLinkedClientDzdId, clientPaymentStatus, setClientPaymentStatus,
        notes, setNotes, profitPercent, setProfitPercent,
        isAdjustmentModalOpen, setIsAdjustmentModalOpen, adjustmentTab, setAdjustmentTab,
        adjustmentAsset, setAdjustmentAsset, adjustmentAmount, setAdjustmentAmount,
        adjustmentPrice, setAdjustmentPrice, adjustmentNote, setAdjustmentNote,
        adjustmentClientId, setAdjustmentClientId, editingTreasuryTx,
        usdtFromEurCalc, formValidation, openForm, closeForm, handleBuy, handleSell,
        handleGlobalAdjustment, handleDeleteTx, openAdjustmentModal,
        txToDelete, setTxToDelete, handleConfirmDeleteTx,
        isTransferModalOpen, setIsTransferModalOpen, transferAmount, setTransferAmount,
        transferFromClientId, setTransferFromClientId, transferToClientId, setTransferToClientId,
        transferNotes, setTransferNotes, handleSaveTransfer
    } = useTransactionHandlers({
        userDocRef, portfolioStats, transactions, clientsDzd, clientTransactionsDzd, treasuryStats,
        suggestedProfitMargin, suggestedSellingPrice,
        setAlert, setSelectedClientId: (id: string | null) => setSelectedClientId(id), setView: (v: string) => setView(v)
    });

    const {
        isClientModalOpen, setIsClientModalOpen, editingClient, setEditingClient, clientToDelete, setClientToDelete,
        clientFullName, setClientFullName, clientPhone, setClientPhone, initialBalance, setInitialBalance,
        clientRedotpayId, setClientRedotpayId, clientBinanceEmail, setClientBinanceEmail,
        openClientModal, closeClientModal, handleSaveClient, handleDeleteClient,
        isClientTxModalOpen, setIsClientTxModalOpen, editingClientTx, setEditingClientTx,
        clientTxToDelete, setClientTxToDelete, clientTxAmount, setClientTxAmount,
        clientTxType, setClientTxType, clientTxNotes, setClientTxNotes,
        clientTxSource, setClientTxSource, openClientTxModal, handleSaveClientTx, handleDeleteClientTx,
        clientTxUsdtAmount, setClientTxUsdtAmount, clientTxSellPrice, setClientTxSellPrice,
        clientTxEurAmount, setClientTxEurAmount, clientTxEurPrice, setClientTxEurPrice
    } = useClientHandlers(userDocRef, clientsDzd, clientBalances, setAlert);

    const {
        isInvestorModalOpen, setIsInvestorModalOpen, editingInvestor, setEditingInvestor,
        investorToDelete, setInvestorToDelete, isInvestorTxModalOpen, setIsInvestorTxModalOpen,
        investorName, setInvestorName, investorInitialCapital, setInvestorInitialCapital,
        investorNotes, setInvestorNotes, isManager, setIsManager,
        investorTxType, setInvestorTxType, investorTxAmount, setInvestorTxAmount,
        investorTxNotes, setInvestorTxNotes, investorTxToDelete, setInvestorTxToDelete,
        isReinvestModalOpen, setIsReinvestModalOpen, reinvestInput, setReinvestInput,
        selectedInvestorId, setSelectedInvestorId, handleSaveInvestor, handleSaveInvestorTx,
        handleReinvestProfit, handleDeleteInvestor, openInvestorModal, closeInvestorModal
    } = useInvestorHandlers(userDocRef, investors, derivedInvestors, treasuryStats, setAlert);

    const {
        isAssetModalOpen, setIsAssetModalOpen, editingAsset, setEditingAsset,
        isAssetClientModalOpen, setIsAssetClientModalOpen, editingAssetClient, setEditingAssetClient,
        isCreateAssetModalOpen, setIsCreateAssetModalOpen, newAssetName, setNewAssetName,
        newAssetDescription, setNewAssetDescription, assetClientBalance, setAssetClientBalance,
        handleCreateAsset, handleDeleteAsset, openAssetClientModal, closeAssetClientModal,
        handleCreateAssetClient, handleUpdateAssetClient, handleDeleteAssetClient, handleCreateAssetTransaction
    } = useAssetHandlers(userDocRef, manualAssets, manualAssetClients, assetClientBalances, setAlert);

    // --- 3. LOCAL UI STATE ---
    const [view, setView] = useState(() => localStorage.getItem('app_view') || 'transactions');
    const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
    const [globalSearchQuery, setGlobalSearchQuery] = useState('');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [isResetModalOpen, setIsResetModalOpen] = useState(false);
    const [isTreasuryCardModalOpen, setIsTreasuryCardModalOpen] = useState(false);
    const [isTreasuryBalanceEditModalOpen, setIsTreasuryBalanceEditModalOpen] = useState(false);
    const [isPortfolioBalanceEditModalOpen, setIsPortfolioBalanceEditModalOpen] = useState(false);
    const [statsView, setStatsView] = useState<'overview' | 'historical' | 'simulator' | 'dzd' | 'investors'>('overview');
    const [selectedHeatmapDay, setSelectedHeatmapDay] = useState<{ day: number; profit: number; } | null>(null);
    const [isDateFilterModalOpen, setIsDateFilterModalOpen] = useState(false);
    const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>({ start: null, end: null });
    const [tempStartDate, setTempStartDate] = useState('');
    const [tempEndDate, setTempEndDate] = useState('');
    const [filterMode, setFilterMode] = useState<'all' | 'buy' | 'sell' | 'adjustments' | 'clients' | 'treasury'>('all');
    const [clientSearchQuery, setClientSearchQuery] = useState('');
    const [clientSortMode, setClientSortMode] = useState<'all' | 'advances' | 'debts' | 'zero_balance'>('all');

    const [isWalletTransferModalOpen, setIsWalletTransferModalOpen] = useState(false);
    const [walletTransferAmount, setWalletTransferAmount] = useState('');
    const [walletTransferSource, setWalletTransferSource] = useState<'Caisse' | 'BaridiMob'>('Caisse');
    const [walletTransferDest, setWalletTransferDest] = useState<'Caisse' | 'BaridiMob'>('BaridiMob');
    const [walletTransferNotes, setWalletTransferNotes] = useState('');

    const [editingTreasuryCard, setEditingTreasuryCard] = useState<TreasuryCard | null>(null);
    const [treasuryCardName, setTreasuryCardName] = useState('');
    const [treasuryCardValue, setTreasuryCardValue] = useState('');
    const [treasuryCardToDelete, setTreasuryCardToDelete] = useState<TreasuryCard | null>(null);
    const [treasuryBalanceEditAsset, setTreasuryBalanceEditAsset] = useState<'Caisse' | 'BaridiMob'>('Caisse');
    const [treasuryBalanceEditValue, setTreasuryBalanceEditValue] = useState('');
    const [treasuryBalanceEditNotes, setTreasuryBalanceEditNotes] = useState('');
    const [portfolioBalanceEditAsset, setPortfolioBalanceEditAsset] = useState<'USDT' | 'EUR'>('USDT');
    const [portfolioBalanceEditValue, setPortfolioBalanceEditValue] = useState('');
    const [portfolioBalanceEditNotes, setPortfolioBalanceEditNotes] = useState('');

    const [simMode, setSimMode] = useState<'dzd' | 'eur' | 'sell_dzd'>('dzd');
    const [simBuyQty, setSimBuyQty] = useState('');
    const [simBuyPrice, setSimBuyPrice] = useState('');
    const [simEurQty, setSimEurQty] = useState('');
    const [simEurDzdPrice, setSimEurDzdPrice] = useState('');
    const [simEurUsdtRate, setSimEurUsdtRate] = useState('');
    const [simSellUsdtQty, setSimSellUsdtQty] = useState('');
    const [simSellDzdPrice, setSimSellDzdPrice] = useState('');

    const [usdtReportMonth, setUsdtReportMonth] = useState(new Date().getMonth());
    const [usdtReportYear, setUsdtReportYear] = useState(new Date().getFullYear());
    const [reportClient, setReportClient] = useState<ClientDzd | null>(null);
    const [reportMonth, setReportMonth] = useState(new Date().getMonth());
    const [reportYear, setReportYear] = useState(new Date().getFullYear());

    const [isInvestorRoute, setIsInvestorRoute] = useState(false);
    const [investorIdFromUrl, setInvestorIdFromUrl] = useState<string | null>(null);
    const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
    const [selectedAssetClientId, setSelectedAssetClientId] = useState<string | null>(null);

    const [copiedValue, setCopiedValue] = useState<string | null>(null);
    const [summaryClient, setSummaryClient] = useState<ClientDzd | null>(null);
    const [treasuryTxToDelete, setTreasuryTxToDelete] = useState<TreasuryTx | null>(null);
    const touchTimer = useRef<any>(null);

    // --- 4. DERIVATIONS ---
    const getClientFullName = (c: ClientDzd) => c.fullName || (c.prenom ? `${c.nom} ${c.prenom}` : c.nom);
    const transferFromBalance = useMemo(() => clientBalances.get(transferFromClientId) || 0, [clientBalances, transferFromClientId]);
    const transferToBalance = useMemo(() => clientBalances.get(transferToClientId) || 0, [clientBalances, transferToClientId]);

    const filteredClientsDzd = useMemo(() => {
        let list = [...clientsDzd];
        if (clientSearchQuery) {
            list = list.filter(c => getClientFullName(c).toLowerCase().includes(clientSearchQuery.toLowerCase()) || (c.phone && c.phone.includes(clientSearchQuery)));
        }
        const ZERO_EPSILON = 0.005;
        if (clientSortMode === 'advances') {
            list = list.filter(c => (clientBalances.get(c.id) || 0) > ZERO_EPSILON);
        } else if (clientSortMode === 'debts') {
            list = list.filter(c => (clientBalances.get(c.id) || 0) < -ZERO_EPSILON);
        } else if (clientSortMode === 'zero_balance') {
            list = list.filter(c => Math.abs(clientBalances.get(c.id) || 0) <= ZERO_EPSILON);
        }
        if (clientSortMode === 'zero_balance') {
            list.sort((a, b) => getClientFullName(a).localeCompare(getClientFullName(b)));
        } else {
            list.sort((a, b) => {
                const aBalance = clientBalances.get(a.id) || 0;
                const bBalance = clientBalances.get(b.id) || 0;
                const byMagnitude = Math.abs(bBalance) - Math.abs(aBalance);
                if (Math.abs(byMagnitude) > ZERO_EPSILON) return byMagnitude;
                const byValue = bBalance - aBalance;
                if (Math.abs(byValue) > ZERO_EPSILON) return byValue;
                return getClientFullName(a).localeCompare(getClientFullName(b));
            });
        }
        return list;
    }, [clientsDzd, clientSearchQuery, clientSortMode, clientBalances]);

    const selectedClient = clientsDzd.find(c => c.id === selectedClientId) || null;
    const selectedClientTransactions = clientTransactionsDzd.filter(tx => tx.clientId === selectedClientId).sort((a, b) => b.timestamp - a.timestamp);
    const overdueDebtClients = useOverdueDebtClients({
        clients: clientsDzd,
        clientTransactions: clientTransactionsDzd,
        clientBalances,
        getClientFullName,
        minDays: 7
    });

    const newPamFromDzdSimulator = useMemo(() => {
        const qty = parseAndEvaluate(simBuyQty);
        const price = parseAndEvaluate(simBuyPrice);
        if (qty <= 0 || price <= 0) return null;
        const totalCost = portfolioStats.usdt.costBasis + (qty * price);
        const totalQty = portfolioStats.usdt.purchasedQty + qty;
        return totalQty <= 0 ? 0 : totalCost / totalQty;
    }, [simBuyQty, simBuyPrice, portfolioStats.usdt]);

    const newPamFromEurSimulator = useMemo(() => {
        const eurQty = parseAndEvaluate(simEurQty);
        const eurPriceDzd = parseAndEvaluate(simEurDzdPrice);
        const rate = parseAndEvaluate(simEurUsdtRate);
        if (eurQty <= 0 || eurPriceDzd <= 0 || rate <= 0) return null;
        const newUsdtQty = eurQty / rate;
        const totalCost = portfolioStats.usdt.costBasis + (newUsdtQty * eurPriceDzd * rate);
        const totalQty = portfolioStats.usdt.purchasedQty + newUsdtQty;
        return totalQty <= 0 ? 0 : totalCost / totalQty;
    }, [simEurQty, simEurDzdPrice, simEurUsdtRate, portfolioStats.usdt]);

    const dailyOverview = useMemo(() => {
        const dayStart = new Date();
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date();
        dayEnd.setHours(23, 59, 59, 999);
        const startTs = dayStart.getTime();
        const endTs = dayEnd.getTime();

        let todayProfit = 0;
        let todayUsdtSold = 0;
        const activeClientIds = new Set<string>();

        transactions.forEach((tx) => {
            if (tx.timestamp < startTs || tx.timestamp > endTs) return;
            if (tx.type === 'sell' && tx.currency === 'USDT') {
                todayProfit += Number(tx.profit || 0);
                todayUsdtSold += Number(tx.quantity || 0);
            }
        });

        clientTransactionsDzd.forEach((tx) => {
            if (tx.timestamp >= startTs && tx.timestamp <= endTs) {
                activeClientIds.add(tx.clientId);
            }
        });

        return {
            caisse: treasuryStats.caisse,
            baridi: treasuryStats.baridi,
            activeClients: activeClientIds.size,
            todayProfit,
            todayUsdtSold
        };
    }, [transactions, clientTransactionsDzd, treasuryStats]);

    const globalSearchResults = useMemo<GlobalSearchResult[]>(() => {
        const q = globalSearchQuery.trim().toLowerCase();
        if (!q) return [];

        const latestClientActivity = new Map<string, number>();
        clientTransactionsDzd.forEach((tx) => {
            const prev = latestClientActivity.get(tx.clientId) || 0;
            if (tx.timestamp > prev) latestClientActivity.set(tx.clientId, tx.timestamp);
        });

        const clientNameById = new Map<string, string>();
        clientsDzd.forEach((client) => {
            clientNameById.set(client.id, getClientFullName(client));
        });

        const linkedClientByTxId = new Map<string, { clientId: string; isSecondary: boolean; timestamp: number }>();
        clientTransactionsDzd.forEach((tx) => {
            if (!tx.linkedTxId || !tx.clientId) return;
            const isSecondary = tx.linkRole === 'dzd_receiver';
            const existing = linkedClientByTxId.get(tx.linkedTxId);
            if (!existing || (existing.isSecondary && !isSecondary) || (existing.isSecondary === isSecondary && tx.timestamp > existing.timestamp)) {
                linkedClientByTxId.set(tx.linkedTxId, { clientId: tx.clientId, isSecondary, timestamp: tx.timestamp });
            }
        });

        const clientResults: GlobalSearchResult[] = clientsDzd
            .filter((client) => {
                const haystack = [
                    getClientFullName(client),
                    client.phone || '',
                    client.redotpayId || '',
                    client.binanceEmail || ''
                ].join(' ').toLowerCase();
                return haystack.includes(q);
            })
            .map((client) => ({
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
                ? `${Number(tx.quantity || 0).toFixed(2)} USDT`
                : `${Number(tx.quantity || 0).toFixed(2)} EUR`;
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
    }, [globalSearchQuery, clientsDzd, clientTransactionsDzd, transactions, treasuryTransactions, getClientFullName, t]);

    // --- 5. UI HANDLERS ---
    const handleTouchStart = (c: ClientDzd) => { touchTimer.current = setTimeout(() => setSummaryClient(c), 800); };
    const handleTouchEnd = () => { if (touchTimer.current) { clearTimeout(touchTimer.current); touchTimer.current = null; } };
    const handleCopy = (val: string) => { navigator.clipboard.writeText(val); setCopiedValue(val); setTimeout(() => setCopiedValue(null), 2000); };
    const openDateFilterModal = () => { setTempStartDate(dateRange.start ? dateRange.start.toISOString().split('T')[0] : ''); setTempEndDate(dateRange.end ? dateRange.end.toISOString().split('T')[0] : ''); setIsDateFilterModalOpen(true); };
    const handleApplyDateFilter = () => { if (tempStartDate && tempEndDate) { const s = new Date(tempStartDate); s.setHours(0, 0, 0, 0); const e = new Date(tempEndDate); e.setHours(23, 59, 59, 999); setDateRange({ start: s, end: e }); setIsDateFilterModalOpen(false); } else setAlert('⚠️ Dates incomplètes.'); };
    const handleClearDateFilter = () => { setDateRange({ start: null, end: null }); setIsDateFilterModalOpen(false); };
    const openTreasuryCardModal = (card: TreasuryCard | null = null) => {
        setEditingTreasuryCard(card);
        setTreasuryCardName(card ? card.name : '');
        setTreasuryCardValue(card ? card.value.toString() : '');
        setIsTreasuryCardModalOpen(true);
    };
    const openTreasuryBalanceEditModal = (asset: 'Caisse' | 'BaridiMob') => { setTreasuryBalanceEditAsset(asset); setTreasuryBalanceEditValue(Math.round(asset === 'Caisse' ? treasuryStats.caisse : treasuryStats.baridi).toString()); setTreasuryBalanceEditNotes(''); setIsTreasuryBalanceEditModalOpen(true); };
    const openPortfolioBalanceEditModal = (asset: 'USDT' | 'EUR') => {
        const currentBalance = asset === 'USDT' ? portfolioStats.usdt.available : portfolioStats.eur.available;
        const normalizedBalance = (Object.is(currentBalance, -0) || Math.abs(currentBalance) < 0.005) ? 0 : currentBalance;
        setPortfolioBalanceEditAsset(asset);
        setPortfolioBalanceEditValue(Number(normalizedBalance || 0).toFixed(2));
        setPortfolioBalanceEditNotes('');
        setIsPortfolioBalanceEditModalOpen(true);
    };
    const getRelativeDateLabel = (dateStr: string) => dateStr === now().date ? t('transactions.today') : dateStr;
    const closeGlobalSearch = () => { setIsGlobalSearchOpen(false); setGlobalSearchQuery(''); };
    const handleOpenGlobalSearch = () => { setIsGlobalSearchOpen(true); };
    const handleSelectGlobalSearchResult = (result: GlobalSearchResult) => {
        if (result.kind === 'client') {
            setSelectedClientId(result.clientId);
            setView('dzd');
            closeGlobalSearch();
            return;
        }
        const dayStart = new Date(result.timestamp);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(result.timestamp);
        dayEnd.setHours(23, 59, 59, 999);
        setView('transactions');
        setFilterMode('all');
        setDateRange({ start: dayStart, end: dayEnd });
        closeGlobalSearch();
    };

    const handleSaveTreasuryBalanceEdit = async () => {
        const parsedNewVal = parseAndEvaluate(treasuryBalanceEditValue);
        if (isNaN(parsedNewVal) || parsedNewVal < 0) { setAlert(t('common.invalidAmount')); return; }
        const newVal = Math.round(parsedNewVal);
        setIsSaving(true);
        try {
            const oldVal = treasuryBalanceEditAsset === 'Caisse' ? treasuryStats.caisse : treasuryStats.baridi;
            const diff = Math.round(newVal - oldVal); if (diff === 0) { setIsTreasuryBalanceEditModalOpen(false); return; }
            const { date, time, timestamp } = now();
            await userDocRef.collection('treasury_txs').add({
                type: diff > 0 ? 'Ajout' : 'Retrait',
                source: treasuryBalanceEditAsset,
                amount: Math.abs(diff),
                asset: `DZD-${treasuryBalanceEditAsset}`,
                notes: `Correction Solde ${treasuryBalanceEditAsset}: ${treasuryBalanceEditNotes || 'Aucun motif'}`,
                date,
                time,
                timestamp,
                origin: 'balance_edit'
            });
            setAlert("✅ Solde mis à jour."); setIsTreasuryBalanceEditModalOpen(false);
        } catch (e) { setAlert("❌ Erreur."); } finally { setIsSaving(false); }
    };

    const handleSavePortfolioBalanceEdit = async () => {
        const parsedNewVal = parseAndEvaluate(portfolioBalanceEditValue);
        if (isNaN(parsedNewVal) || parsedNewVal < 0) { setAlert(t('common.invalidAmount')); return; }
        const newVal = Number(parsedNewVal.toFixed(2));

        setIsSaving(true);
        try {
            const oldValRaw = portfolioBalanceEditAsset === 'USDT'
                ? portfolioStats.usdt.available
                : portfolioStats.eur.available;
            const oldVal = Number(oldValRaw.toFixed(2));
            const diff = Number((newVal - oldVal).toFixed(2));
            if (Math.abs(diff) < 0.005) { setIsPortfolioBalanceEditModalOpen(false); return; }

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
                        if (tx.currency !== currency) return false;
                        if ((tx.type === 'buy' || tx.type === 'Ajout Manuel') && typeof tx.price === 'number' && tx.price > 0) return true;
                        if (tx.type === 'sell' && typeof tx.sell === 'number' && tx.sell > 0) return true;
                        return false;
                    });

                if (latestPricedTx) {
                    if (latestPricedTx.type === 'sell') return Number(latestPricedTx.sell || 0);
                    return Number(latestPricedTx.price || 0);
                }

                if (currency === 'USDT') {
                    const suggested = parseFloat(suggestedSellingPrice || '0') || 0;
                    const margin = parseAndEvaluate(suggestedProfitMargin || '0');
                    const derivedAvg = suggested - (isNaN(margin) ? 0 : margin);
                    return derivedAvg > 0 ? derivedAvg : 0;
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

            // Preserve weighted average when increasing balance.
            if (type === 'Ajout Manuel' && referencePrice > 0) {
                txPayload.price = Number(referencePrice.toFixed(2));
                txPayload.total = Number((quantity * referencePrice).toFixed(2));
            }

            await userDocRef.collection('usdt_txs').add(txPayload);
            setAlert(t('common.operationSuccess'));
            setIsPortfolioBalanceEditModalOpen(false);
        } catch (e) {
            setAlert(t('common.error'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleEditClientTx = (tx: ClientTransactionDzd) => { if (tx.linkedTxId) { const l = transactions.find(t => t.id === tx.linkedTxId); if (l) openForm(l.type === 'buy' ? (l.currency === 'USDT' ? 'buy_usdt' : 'buy_eur') : 'sell_usdt', l); else openClientTxModal(tx); } else openClientTxModal(tx); };
    const handleDeleteClientTxClick = (tx: ClientTransactionDzd) => { if (tx.linkedTxId) { const l = transactions.find(t => t.id === tx.linkedTxId); if (l) setTxToDelete(l); else { setClientTxToDelete(tx); setAlert("⚠️ Orpheline."); } } else setClientTxToDelete(tx); };

    const handleWalletTransfer = async () => {
        const amountInput = parseAndEvaluate(walletTransferAmount);
        const amount = Math.round(amountInput);
        if (isNaN(amountInput) || amount <= 0) { setAlert("⚠️ Montant invalide."); return; }
        if (walletTransferSource === walletTransferDest) { setAlert(t('common.sameSourceDest')); return; }
        const sourceBalance = walletTransferSource === 'Caisse' ? treasuryStats.caisse : treasuryStats.baridi;
        if (amount > sourceBalance) { setAlert(t('common.insufficientBalance')); return; }
        setIsSaving(true);
        try {
            const ts = Date.now();
            const { date, time } = now();
            await userDocRef.collection('treasury_txs').add({
                type: 'Transfer',
                source: walletTransferSource,
                destination: walletTransferDest,
                asset: `From ${walletTransferSource} to ${walletTransferDest}`,
                amount,
                notes: walletTransferNotes || 'Transfert interne',
                date, time, timestamp: ts
            });
            setAlert("✅ Transfert enregistré.");
            setIsWalletTransferModalOpen(false);
            setWalletTransferAmount('');
            setWalletTransferNotes('');
        } catch (e) { setAlert("❌ Erreur."); } finally { setIsSaving(false); }
    };
    const handleSwapSourceDest = () => { const s = walletTransferSource; const d = walletTransferDest; setWalletTransferSource(d); setWalletTransferDest(s); };
    const handleWalletTransferMaxClick = () => {
        let max = 0;
        if (walletTransferSource === 'Caisse') max = treasuryStats.caisse;
        else if (walletTransferSource === 'BaridiMob') max = treasuryStats.baridi;
        setWalletTransferAmount(Math.max(0, Math.floor(max)).toString());
    };
    const walletTransferAmountValue = parseAndEvaluate(walletTransferAmount);
    const walletTransferSourceBalance = walletTransferSource === 'Caisse' ? treasuryStats.caisse : treasuryStats.baridi;
    const isWalletTransferInvalid = isSaving
        || !walletTransferAmount
        || isNaN(walletTransferAmountValue)
        || walletTransferAmountValue <= 0
        || walletTransferAmountValue > walletTransferSourceBalance
        || walletTransferSource === walletTransferDest;

    const handleExportClientReport = (cId: string, m: number, y: number) => { setAlert("🚧 Export bientôt disponible."); };
    const handleExportUsdtReport = () => { setAlert("🚧 Export bientôt disponible."); };
    const handleSaveTreasuryCard = async () => {
        const name = treasuryCardName.trim();
        const value = parseAndEvaluate(treasuryCardValue);

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
            const payload = { name, value: Number(value.toFixed(2)) };
            if (editingTreasuryCard) {
                await userDocRef.collection('treasury_cards').doc(editingTreasuryCard.id).update(payload);
            } else {
                await userDocRef.collection('treasury_cards').add(payload);
            }

            setAlert(`✅ ${t('common.operationSuccess')}`);
            setIsTreasuryCardModalOpen(false);
            setEditingTreasuryCard(null);
            setTreasuryCardName('');
            setTreasuryCardValue('');
        } catch (e) {
            setAlert(`❌ ${t('common.error')}`);
        } finally {
            setIsSaving(false);
        }
    };
    const handleDeleteTreasuryCard = async () => {
        if (!treasuryCardToDelete) return;

        setIsSaving(true);
        try {
            await userDocRef.collection('treasury_cards').doc(treasuryCardToDelete.id).delete();
            setAlert(`✅ ${t('common.operationSuccess')}`);
            setTreasuryCardToDelete(null);
        } catch (e) {
            setAlert(`❌ ${t('common.error')}`);
        } finally {
            setIsSaving(false);
        }
    };
    const handleDeleteTreasuryTxConfirm = async () => {
        if (!treasuryTxToDelete) return;

        // Treasury rows can be child transactions. Delete their parent when possible
        // to keep balances and linked records consistent.
        if (treasuryTxToDelete.origin === 'manual_asset') {
            if (!treasuryTxToDelete.linkedAssetTxId) {
                setAlert("⚠️ Transaction liée à un actif manuel introuvable.");
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
            } else {
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
            const assetName = manualAssets.find(a => a.id === data.actifId)?.name || 'Actif';
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
                } else {
                    const newTreasuryRef = userDocRef.collection('treasury_txs').doc();
                    batch.set(newTreasuryRef, treasuryPayload);
                    txUpdatePayload.linkedTreasuryTxId = newTreasuryRef.id;
                }
            } else if (linkedTreasuryId) {
                batch.delete(userDocRef.collection('treasury_txs').doc(linkedTreasuryId));
                txUpdatePayload.linkedTreasuryTxId = fieldValueDelete();
            }

            batch.update(txRef, txUpdatePayload);
            await batch.commit();
            setAlert(t('common.operationSuccess'));
        } catch (e) {
            console.error(e);
            setAlert(t('common.error'));
        } finally {
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
            } else {
                const linkedTreasury = await userDocRef.collection('treasury_txs').where('linkedAssetTxId', '==', id).get();
                linkedTreasury.forEach(d => batch.delete(d.ref));
            }

            await batch.commit();
            setAlert(t('common.operationSuccess'));
        } catch (e) {
            console.error(e);
            setAlert(t('common.error'));
        } finally {
            setIsSaving(false);
        }
    };
    const handleClientDeleteRequest = (c: ClientDzd) => setClientToDelete(c);
    const handleDeleteConfirm = () => handleConfirmDeleteTx();
    const handleDeleteClientTxConfirm = async () => {
        if (!clientTxToDelete) return;
        await handleDeleteTx(clientTxToDelete.id, 'client_tx');
        setClientTxToDelete(null);
    };
    const handleInvestorTransaction = async () => handleSaveInvestorTx();
    const handleDeleteInvestorTx = async (tx: InvestorTransaction) => { setInvestorTxToDelete(tx); };

    const handleGlobalReset = async () => {
        setIsSaving(true);
        try {
            const colls = ['usdt_txs', 'treasury_txs', 'dzd_clients', 'dzd_client_txs', 'treasury_cards', 'manual_assets', 'manual_asset_clients', 'actifTransactions', 'investors', 'investor_transactions'];
            for (const c of colls) {
                const qs = await userDocRef.collection(c).get();
                let batch = db.batch(); let count = 0;
                for (const d of qs.docs) { batch.delete(d.ref); count++; if (count >= 400) { await batch.commit(); batch = db.batch(); count = 0; } }
                await batch.commit();
            }
            setAlert("✅ Réinitialisé."); setRefreshKey(prev => prev + 1); setIsResetModalOpen(false);
        } catch (e) { setAlert("❌ Erreur."); } finally { setIsSaving(false); }
    };

    const bgApp = isDark ? "bg-[#0b0f1a] text-white" : "bg-slate-50 text-slate-900";
    const cardBase = isDark ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900";
    const fieldBase = isDark ? "bg-slate-800 border-slate-700 text-white focus:ring-sky-500" : "bg-slate-50 border-slate-200 text-slate-900 focus:ring-sky-600";
    const subtleText = isDark ? "text-slate-400" : "text-slate-500";
    const detectAlertTone = (message: string): 'success' | 'error' | 'info' => {
        const normalized = (message || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');

        const hasAny = (tokens: string[]) =>
            tokens.some((token) => normalized.includes(token));

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

        if (hasAny(errorTokens)) return 'error';
        if (hasAny(successTokens)) return 'success';
        return 'info';
    };
    const alertTone = detectAlertTone(alert);
    const alertClass = alertTone === 'success'
        ? (isDark ? 'bg-green-900/50 border-green-400/30 text-green-300' : 'bg-green-50 border-green-300 text-green-800')
        : alertTone === 'error'
            ? (isDark ? 'bg-red-900/50 border-red-400/30 text-red-300' : 'bg-red-50 border-red-300 text-red-800')
            : (isDark ? 'bg-sky-900/40 border-sky-400/30 text-sky-300' : 'bg-sky-50 border-sky-300 text-sky-800');

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

    const portfolioPageProps = useMemo(() => ({
        statsView,
        setStatsView,
        isDark,
        setIsSettingsModalOpen,
        cardBase,
        subtleText,
        portfolioStats,
        totalPortfolioValue: (portfolioStats.usdt.available * portfolioStats.usdt.avgBuy + portfolioStats.eur.available * portfolioStats.eur.avgBuy),
        suggestedProfitMargin,
        suggestedSellingPrice,
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
        openPortfolioBalanceEditModal
    }), [
        statsView, isDark, cardBase, subtleText, portfolioStats, suggestedProfitMargin, suggestedSellingPrice,
        usdtReportMonth, usdtReportYear, transactions, clientTransactionsDzd, selectedHeatmapDay, simMode, simBuyQty, simBuyPrice,
        fieldBase, newPamFromDzdSimulator, simEurQty, simEurDzdPrice, simEurUsdtRate, newPamFromEurSimulator,
        reportClient, clientsDzd, reportMonth, reportYear, simSellUsdtQty, simSellDzdPrice, reportMonthNames,
        getClientFullName, handleExportClientReport, handleExportUsdtReport, openPortfolioBalanceEditModal
    ]);

    const clientsPageProps = useMemo(() => ({
        selectedClientId,
        setSelectedClientId,
        cardBase,
        fieldBase,
        isDark,
        subtleText,
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
        handleEditClientTx,
        handleDeleteClientTxClick,
        overdueDebtClients
    }), [
        selectedClientId, cardBase, fieldBase, isDark, subtleText, clientSearchQuery, clientSortMode,
        filteredClientsDzd, clientBalances, selectedClient, selectedClientTransactions, transactions, copiedValue,
        openClientModal, handleTouchStart, handleTouchEnd, handleExportClientReport, openClientTxModal,
        handleCopy, handleEditClientTx, handleDeleteClientTxClick, overdueDebtClients
    ]);

    if (isInvestorRoute) {
        const investor = derivedInvestors.find(i => i.id === investorIdFromUrl) || derivedInvestors[0];
        if (!investor) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">
                    {derivedInvestors.length === 0 ? "Chargement des données investisseur..." : "Investisseur non trouvé."}
                </div>
            );
        }
        const myTransactions = investorTransactions.filter(tx => tx.investorId === investor.id);
        const totalCapital = derivedInvestors.reduce((sum, inv) => sum + (inv.isActive ? inv.capitalInvested : 0), 0);
        return (
            <Suspense fallback={<div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-slate-900 text-slate-200' : 'bg-slate-50 text-slate-600'}`}>{t('common.loading')}</div>}>
                <InvestorDashboardPage
                    investor={investor}
                    transactions={myTransactions}
                    isDark={isDark}
                    globalNetProfit={portfolioStats.usdt.totalProfit}
                    managerFeePercentage={Number(managerFeePercentage)}
                    totalCapital={totalCapital}
                />
            </Suspense>
        );
    }

    const navLabels = { transactions: t('nav.transactions') as string, portfolio: t('nav.portfolio') as string, analytics: t('nav.analytics') as string, clients: t('nav.clients') as string, treasury: t('nav.treasury') as string, investors: 'Investisseurs' };
    const mainContentProps = { alert, alertClass, cardBase, subtleText, t, isDark, dailyOverview, PageLoadingFallback, view, TransactionsPage, openAdjustmentModal, openForm, filterMode, setFilterMode, transactions, getRelativeDateLabel, clientTransactionsDzd, clientsDzd, getClientFullName, setTxToDelete, openDateFilterModal, dateRange, setDateRange, setIsWalletTransferModalOpen, setIsTransferModalOpen, treasuryTransactions, handleEditClientTx, handleDeleteClientTxClick, setTreasuryTxToDelete, PortfolioPage, portfolioPageProps, AnalyticsPage, ClientsPage, clientsPageProps, selectedAssetClientId, ManualClientPage, manualAssetClients, manualAssetTransactions, assetClientBalances, selectedAssetId, setSelectedAssetClientId, handleCreateAssetTransaction, handleUpdateAssetTransaction, handleDeleteAssetTransaction, fieldBase, ManualAssetPage, manualAssets, handleCreateAssetClient, handleUpdateAssetClient, handleDeleteAssetClient, TresoreriePage, treasuryStats, totals, portfolioStats, openTreasuryCardModal, treasuryCards, setTreasuryCardToDelete, openTreasuryBalanceEditModal, openPortfolioBalanceEditModal, assetBalances, setSelectedAssetId, setIsCreateAssetModalOpen, handleDeleteAsset, selectedInvestorId, setSelectedInvestorId, InvestorDetailsPage, derivedInvestors, investorTransactions, setInvestorTxType, setIsInvestorTxModalOpen, setReinvestInput, setIsReinvestModalOpen, setInvestorTxToDelete, managerFeePercentage, InvestorsPage, setEditingInvestor, setIsInvestorModalOpen, setInvestorToDelete, setManagerFeePercentage };
    const walletTransferDialogProps = {
        isOpen: isWalletTransferModalOpen, onClose: () => setIsWalletTransferModalOpen(false), cardBase, isDark, subtleText, fieldBase,
        amount: walletTransferAmount, setAmount: setWalletTransferAmount, source: walletTransferSource, setSource: setWalletTransferSource,
        destination: walletTransferDest, setDestination: setWalletTransferDest, notes: walletTransferNotes, setNotes: setWalletTransferNotes,
        onMax: handleWalletTransferMaxClick, onSwap: handleSwapSourceDest, onConfirm: handleWalletTransfer, isInvalid: isWalletTransferInvalid,
        isSaving, caisseBalance: treasuryStats.caisse, baridiBalance: treasuryStats.baridi, title: t('transactions.internalTransfer'),
        subtitle: 'Transfert entre comptes internes', amountLabel: t('transactions.amount'), fromLabel: t('transactions.from'),
        toLabel: t('transactions.to'), sourceLabel: t('common.source'), destinationLabel: t('common.destination'),
        notesOptionalLabel: t('common.notesOptional'), sameAccountErrorText: 'Impossible de selectionner le meme compte.',
        processingText: t('common.processing'), confirmText: t('transactions.confirmTransfer')
    };
    const clientTransferDialogProps = {
        isOpen: isTransferModalOpen, onClose: () => setIsTransferModalOpen(false), cardBase, isDark, subtleText, fieldBase,
        fromClientId: transferFromClientId, setFromClientId: setTransferFromClientId, toClientId: transferToClientId, setToClientId: setTransferToClientId,
        amount: transferAmount, setAmount: setTransferAmount, notes: transferNotes, setNotes: setTransferNotes, onSave: handleSaveTransfer,
        isSaving, clients: clientsDzd.map(c => ({ id: c.id, label: getClientFullName(c) })), fromBalance: transferFromBalance,
        toBalance: transferToBalance, onMaxFrom: () => setTransferAmount(Math.abs(transferFromBalance).toString()),
        title: t('transactions.clientTransfer'), infoText: t('transactions.transferDebtCredit'), fromLabel: t('transactions.from'),
        toLabel: t('transactions.to'), amountLabel: t('transactions.amount'), notesLabel: t('common.notes'),
        filterClientsLabel: t('transactions.filterClients'), balanceLabel: t('common.balance'), dinarLabel: t('common.dinar'),
        confirmLabel: t('transactions.confirmTransfer')
    };
    const treasuryBalanceEditDialogProps = {
        isOpen: isTreasuryBalanceEditModalOpen, onClose: () => setIsTreasuryBalanceEditModalOpen(false), cardBase, isDark, fieldBase,
        asset: treasuryBalanceEditAsset, value: treasuryBalanceEditValue, notes: treasuryBalanceEditNotes, setNotes: setTreasuryBalanceEditNotes,
        onSave: handleSaveTreasuryBalanceEdit, titlePrefix: t('transactions.editBalance'), descriptionText: t('transactions.editBalanceDesc'),
        newBalanceLabel: t('transactions.newBalance'), dinarLabel: t('common.dinar'), notesOptionalLabel: t('common.notesOptional'),
        reasonPlaceholder: t('transactions.reason'), saveLabel: t('common.save'),
        onValueChange: (value: string) => {
            const normalized = value.replace(',', '.').trim();
            if (normalized === '') { setTreasuryBalanceEditValue(''); return; }
            if (/^\d+$/.test(normalized)) setTreasuryBalanceEditValue(normalized);
        },
        onValueBlur: () => {
            const parsed = parseAndEvaluate(treasuryBalanceEditValue);
            if (!isNaN(parsed)) setTreasuryBalanceEditValue(Math.round(parsed).toString());
        }
    };
    const portfolioBalanceEditDialogProps = {
        isOpen: isPortfolioBalanceEditModalOpen, onClose: () => setIsPortfolioBalanceEditModalOpen(false), cardBase, isDark, fieldBase,
        asset: portfolioBalanceEditAsset, value: portfolioBalanceEditValue, notes: portfolioBalanceEditNotes, setNotes: setPortfolioBalanceEditNotes,
        onSave: handleSavePortfolioBalanceEdit, isSaving, titlePrefix: t('transactions.editBalance'), descriptionText: t('transactions.editBalanceDesc'),
        newBalanceLabel: t('transactions.newBalance'), notesOptionalLabel: t('common.notesOptional'), reasonPlaceholder: t('transactions.reason'),
        saveLabel: t('common.save'), savingLabel: t('common.saving'),
        onValueChange: (value: string) => {
            const normalized = value.replace(',', '.').trim();
            if (normalized === '') { setPortfolioBalanceEditValue(''); return; }
            if (/^\d+(\.\d{0,2})?$/.test(normalized)) setPortfolioBalanceEditValue(normalized);
        },
        onValueBlur: () => {
            const parsed = parseAndEvaluate(portfolioBalanceEditValue);
            if (!isNaN(parsed)) setPortfolioBalanceEditValue(Number(parsed).toFixed(2));
        }
    };
    const dateFilterDialogProps = {
        isOpen: isDateFilterModalOpen, onClose: () => setIsDateFilterModalOpen(false), cardBase, isDark, fieldBase,
        startDate: tempStartDate, setStartDate: setTempStartDate, endDate: tempEndDate, setEndDate: setTempEndDate,
        onClear: handleClearDateFilter, onApply: handleApplyDateFilter, title: t('transactions.filterByDate'),
        startLabel: t('transactions.startDate'), endLabel: t('transactions.endDate'), clearLabel: t('transactions.clear'),
        applyLabel: t('transactions.apply')
    };

    return (
        <div className={`min-h-screen bg-gradient-to-br ${bgApp} transition-colors duration-300`}>
            <div className="max-w-4xl mx-auto px-2 sm:px-4 pb-24">
                <MainHeaderBar {...{ isDark, view, setView, t, setIsMobileMenuOpen, handleOpenGlobalSearch, setTheme, onSignOut: () => signOut(auth) }} />
                <AppMobileMenuNav view={view} isDark={isDark} onSelect={setView} isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} labels={navLabels} />

                <MainContentArea {...mainContentProps} />

                <AppBottomNav view={view} isDark={isDark} onSelect={setView} labels={navLabels} />

                <GlobalSearchDialog {...{ isOpen: isGlobalSearchOpen, onClose: closeGlobalSearch, cardBase, isDark, fieldBase, subtleText, query: globalSearchQuery, setQuery: setGlobalSearchQuery, results: globalSearchResults, onSelectResult: handleSelectGlobalSearchResult, title: t('common.globalSearch'), placeholder: t('common.searchPlaceholder'), noResultsText: t('common.noResults'), clientsText: t('nav.clients'), transactionsText: t('nav.transactions') }} />
            </div>

            {/* MODALS */}

            {/* 1. WALLET TRANSFER MODAL REDESIGNED */}
            <WalletTransferDialog {...walletTransferDialogProps} />
            <MainClientOperationsDialogs {...{ isClientTxModalOpen, setIsClientTxModalOpen, cardBase, isDark, editingClientTx, t, clientTxType, setClientTxType, fieldBase, clientTxUsdtAmount, setClientTxUsdtAmount, clientTxSellPrice, setClientTxSellPrice, clientTxEurAmount, setClientTxEurAmount, clientTxEurPrice, setClientTxEurPrice, clientTxAmount, setClientTxAmount, clientTxNotes, setClientTxNotes, handleSaveClientTx, selectedClientId, isAdjustmentModalOpen, setIsAdjustmentModalOpen, editingTreasuryTx, adjustmentTab, setAdjustmentTab, adjustmentAsset, setAdjustmentAsset, adjustmentAmount, setAdjustmentAmount, adjustmentClientId, clientBalances, portfolioStats, clientsDzd, getClientFullName, setAdjustmentClientId, adjustmentPrice, setAdjustmentPrice, adjustmentNote, setAdjustmentNote, handleGlobalAdjustment, isSaving }} />
            <MainTransferAndFilterDialogs
                clientTransferProps={clientTransferDialogProps}
                treasuryBalanceEditProps={treasuryBalanceEditDialogProps}
                portfolioBalanceEditProps={portfolioBalanceEditDialogProps}
                dateFilterProps={dateFilterDialogProps}
            />

            <MainTransactionDialog {...{ mode, editingTx, closeForm, cardBase, isDark, t, subtleText, fieldBase, buyUsdtMode, setBuyUsdtMode, setEurDzdPrice, portfolioStats, buyUsdtAmount, setBuyUsdtAmount, isTotalManual, buyUsdtPrice, setBuyUsdtPrice, buyUsdtTotal, setBuyUsdtTotal, setIsTotalManual, formValidation, linkedClientId, setLinkedClientId, linkedClientDzdId, setLinkedClientDzdId, openClientModal, clientsDzd, clientPaymentStatus, setClientPaymentStatus, notes, setNotes, buyEurForUsdtAmount, setBuyEurForUsdtAmount, eurDzdPrice, eurUsdtRate, setEurUsdtRate, sellAmount, setSellAmount, sellPrice, setSellPrice, sellTotal, setSellTotal, suggestedSellingPrice, suggestedProfitMargin, profitPercent, setProfitPercent, buyEurAmount, setBuyEurAmount, buyEurPrice, setBuyEurPrice, buyEurTotal, setBuyEurTotal, handleBuy, handleSell, isSaving }} />
            <MainClientCrudDialogs {...{ txToDelete, setTxToDelete, cardBase, isDark, t, handleDeleteConfirm, clientTxToDelete, setClientTxToDelete, handleDeleteClientTxConfirm, isClientModalOpen, setIsClientModalOpen, editingClient, clientFullName, setClientFullName, clientPhone, setClientPhone, clientRedotpayId, setClientRedotpayId, clientBinanceEmail, setClientBinanceEmail, initialBalance, setInitialBalance, fieldBase, handleSaveClient, clientToDelete, setClientToDelete, handleDeleteClient }} />
            <MainUtilityDialogs {...{ isSettingsModalOpen, setIsSettingsModalOpen, cardBase, isDark, t, suggestedProfitMargin, setSuggestedProfitMargin, suggestedSellingPrice, setSuggestedSellingPrice, portfolioStats, fieldBase, subtleText, setIsResetModalOpen, userDocRef, setAlert, isResetModalOpen, handleGlobalReset, isCreateAssetModalOpen, setIsCreateAssetModalOpen, newAssetName, setNewAssetName, newAssetDescription, setNewAssetDescription, handleCreateAsset, isTreasuryCardModalOpen, setIsTreasuryCardModalOpen, editingTreasuryCard, treasuryCardName, setTreasuryCardName, treasuryCardValue, setTreasuryCardValue, handleSaveTreasuryCard, isSaving, treasuryCardToDelete, setTreasuryCardToDelete, handleDeleteTreasuryCard, treasuryTxToDelete, setTreasuryTxToDelete, handleDeleteTreasuryTxConfirm }} />
            {/* CLIENT SUMMARY MODAL */}
            {/* CLIENT SUMMARY MODAL */}
            <MainClientSummaryDialog {...{ summaryClient, setSummaryClient, cardBase, isDark, t, subtleText, clientBalances, clientTransactionsDzd, transactions, setAlert, getClientFullName }} />
            <MainInvestorDialogs {...{ isInvestorModalOpen, setIsInvestorModalOpen, editingInvestor, handleSaveInvestor, investorName, setInvestorName, fieldBase, investorInitialCapital, setInvestorInitialCapital, investorNotes, setInvestorNotes, isManager, setIsManager, derivedInvestors, selectedInvestorId, isInvestorTxModalOpen, setIsInvestorTxModalOpen, investorTxType, investorTxAmount, setInvestorTxAmount, subtleText, investorTxNotes, setInvestorTxNotes, handleInvestorTransaction, cardBase, isDark, t, investorToDelete, setInvestorToDelete, handleDeleteInvestor, investorTxToDelete, setInvestorTxToDelete, handleDeleteInvestorTx, isReinvestModalOpen, setIsReinvestModalOpen, reinvestInput, setReinvestInput, handleReinvestProfit, setAlert }} />

        </div>
    );
}















