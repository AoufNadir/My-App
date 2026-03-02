
import React, { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { Card, CardHeader, CardContent } from './components/ui/Card';
import { Label } from './components/ui/Label';
import { Input } from './components/ui/Input';
import { Button } from './components/ui/Button';
import { Alert, AlertDescription } from './components/ui/Alert';
import { Select } from './components/ui/Select';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './components/ui/Dialog';

import { Tx, ClientDzd, ClientTransactionDzd, TreasuryTx, TreasuryCard, ManualAsset, ManualAssetClient, ManualAssetTransaction, Investor, InvestorTransaction, Notification } from './types';
import { useLanguage } from './contexts/LanguageContext';
import { signOut } from 'firebase/auth';
import { auth, db, fieldValueDelete, type AppUser } from './firebase';

import { AlertTriangleIcon } from './components/icons/AlertTriangleIcon';
import { Trash2Icon } from './components/icons/Trash2Icon';
import { ArrowDownIcon } from './components/icons/ArrowDownIcon';
import { UserIcon } from './components/icons/UserIcon';
import { PlusCircleIcon } from './components/icons/PlusCircleIcon';
import { LogOutIcon } from './components/icons/LogOutIcon';
import { MenuIcon } from './components/icons/MenuIcon';
import { MinusIcon } from './components/icons/MinusIcon';
import { DownloadCloudIcon } from './components/icons/DownloadCloudIcon';
import { SunIcon } from './components/icons/SunIcon';
import { MoonIcon } from './components/icons/MoonIcon';
import { CopyIcon } from './components/icons/CopyIcon';
import { CheckIcon } from './components/icons/CheckIcon';
import { CameraIcon } from './components/icons/CameraIcon';
import { ArrowRightLeftIcon } from './components/icons/ArrowRightLeftIcon';
import { ShareIcon } from './components/icons/ShareIcon';
import { RefreshCwIcon } from './components/icons/RefreshCwIcon';
import { RotateCcwIcon } from './components/icons/RotateCcwIcon';
import { GlobeIcon } from './components/icons/GlobeIcon';
import { BellIcon } from './components/icons/BellIcon';
import { MagnifyingGlassIcon } from './components/icons/MagnifyingGlassIcon';
import { NotificationPanel } from './components/NotificationPanel';

import { NumberInput } from './components/ui/NumberInput';
import { ClientLinker } from './components/main/ClientLinker';
import { AppDesktopNav, AppMobileMenuNav, AppBottomNav } from './components/main/AppNavigation';
// Custom Hooks
import { useAppData } from './hooks/useAppData';
import { useSettings } from './hooks/useSettings';
import { useNotifications } from './hooks/useNotifications';
import { useTransactionHandlers } from './hooks/useTransactionHandlers';
import { useClientHandlers } from './hooks/useClientHandlers';
import { useAssetHandlers } from './hooks/useAssetHandlers';
import { useInvestorHandlers } from './hooks/useInvestorHandlers';

// Shared Utils
import { now, parseAndEvaluate } from './utils';

// Modals
import { TransactionModal } from './components/modals/TransactionModal';
import { ClientModal } from './components/modals/ClientModal';
import { AdjustmentModal } from './components/modals/AdjustmentModal';

const MotionDiv = motion.div;

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
    const { t, language, setLanguage } = useLanguage();
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
        linkedClientId, setLinkedClientId, clientPaymentStatus, setClientPaymentStatus,
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

    const {
        notifications, unreadCount, markAsRead, markAllAsRead
    } = useNotifications({
        transactions, clientsDzd, clientBalances, clientTransactionsDzd,
        treasuryStats, portfolioStats, t
    });

    // --- 3. LOCAL UI STATE ---
    const [view, setView] = useState(() => localStorage.getItem('app_view') || 'transactions');
    const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
    const [globalSearchQuery, setGlobalSearchQuery] = useState('');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);
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

        const linkedClientByTxId = new Map<string, string>();
        clientTransactionsDzd.forEach((tx) => {
            if (!tx.linkedTxId) return;
            const existingTs = linkedClientByTxId.get(tx.linkedTxId);
            if (!existingTs) linkedClientByTxId.set(tx.linkedTxId, tx.clientId);
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
            const linkedClientId = tx.id ? linkedClientByTxId.get(tx.id) : undefined;
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
    }, [t, language]);

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
        handleDeleteClientTxClick
    }), [
        selectedClientId, cardBase, fieldBase, isDark, subtleText, clientSearchQuery, clientSortMode,
        filteredClientsDzd, clientBalances, selectedClient, selectedClientTransactions, transactions, copiedValue,
        openClientModal, handleTouchStart, handleTouchEnd, handleExportClientReport, openClientTxModal,
        handleCopy, handleEditClientTx, handleDeleteClientTxClick
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

    return (
        <div className={`min-h-screen bg-gradient-to-br ${bgApp} transition-colors duration-300`}>
            <div className="max-w-4xl mx-auto px-2 sm:px-4 pb-24">
                <header className="sticky top-0 z-40 py-4 backdrop-blur-md bg-opacity-50">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="sm:hidden"><Button onClick={() => setIsMobileMenuOpen(true)} className={`p-2 rounded-full ${isDark ? 'text-gray-300 hover:bg-white/10' : 'text-gray-600 hover:bg-black/5'}`}><MenuIcon className="w-6 h-6" /></Button></div>
                            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">ProDigital</h1>
                        </div>
                        <AppDesktopNav
                            view={view}
                            isDark={isDark}
                            onSelect={setView}
                            labels={{
                                transactions: t('nav.transactions') as string,
                                portfolio: t('nav.portfolio') as string,
                                analytics: t('nav.analytics') as string,
                                clients: t('nav.clients') as string,
                                treasury: t('nav.treasury') as string,
                                investors: 'Investisseurs'
                            }}
                        />
                        <div className="flex items-center gap-1 sm:gap-2">
                            <Button
                                onClick={handleOpenGlobalSearch}
                                className={`p-2 rounded-full transition-colors ${isDark ? 'text-gray-300 hover:bg-white/10' : 'text-gray-600 hover:bg-black/5'}`}
                                title={`${t('common.globalSearch')} (Ctrl+K)`}
                            >
                                <MagnifyingGlassIcon className="w-5 h-5" />
                            </Button>
                            {/* Language Switcher */}
                            <div className="relative group">
                                <Button className={`p-2 rounded-full transition-colors ${isDark ? 'text-gray-300 hover:bg-white/10' : 'text-gray-600 hover:bg-black/5'}`}>
                                    <GlobeIcon className="w-5 h-5" />
                                    <span className="absolute -top-1 -right-1 text-[10px] font-bold bg-primary text-white px-1 rounded-full uppercase">{language}</span>
                                </Button>
                                <div className={`absolute right-0 mt-2 w-32 py-1 rounded-lg shadow-xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} hidden group-hover:block z-50`}>
                                    <button onClick={() => setLanguage('fr')} className={`block w-full text-left px-4 py-2 text-sm hover:bg-opacity-10 ${language === 'fr' ? 'font-bold text-sky-500' : ''} ${isDark ? 'hover:bg-white text-gray-300' : 'hover:bg-black text-gray-700'}`}>Français</button>
                                    <button onClick={() => setLanguage('en')} className={`block w-full text-left px-4 py-2 text-sm hover:bg-opacity-10 ${language === 'en' ? 'font-bold text-sky-500' : ''} ${isDark ? 'hover:bg-white text-gray-300' : 'hover:bg-black text-gray-700'}`}>English</button>
                                    <button onClick={() => setLanguage('ar')} className={`block w-full text-right px-4 py-2 text-sm hover:bg-opacity-10 ${language === 'ar' ? 'font-bold text-sky-500' : ''} ${isDark ? 'hover:bg-white text-gray-300' : 'hover:bg-black text-gray-700'}`}>العربية</button>
                                </div>
                            </div>

                            {/* Notification Bell */}
                            <div className="relative">
                                <Button
                                    onClick={() => setIsNotificationPanelOpen(!isNotificationPanelOpen)}
                                    className={`p-2 rounded-full transition-colors relative ${isDark ? 'text-gray-300 hover:bg-white/10' : 'text-gray-600 hover:bg-black/5'}`}
                                >
                                    <BellIcon className="w-5 h-5" />
                                    {unreadCount > 0 && (
                                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                                            {unreadCount}
                                        </span>
                                    )}
                                </Button>

                                {/* Notification Panel */}
                                {isNotificationPanelOpen && (
                                    <NotificationPanel
                                        notifications={notifications}
                                        onClose={() => setIsNotificationPanelOpen(false)}
                                        onMarkAsRead={markAsRead}
                                        onMarkAllAsRead={markAllAsRead}
                                        isDark={isDark}
                                    />
                                )}
                            </div>

                            <Button onClick={() => setTheme(isDark ? 'light' : 'dark')} className={`p-2 rounded-full transition-colors ${isDark ? 'text-gray-300 hover:bg-white/10' : 'text-gray-600 hover:bg-black/5'}`}>{isDark ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}</Button>
                            <Button onClick={() => signOut(auth)} className={`p-2 rounded-full transition-colors ${isDark ? 'text-gray-300 hover:bg-white/10' : 'text-gray-600 hover:bg-black/5'}`}><LogOutIcon className="w-5 h-5" /></Button>
                        </div>
                    </div>
                </header>

                <AppMobileMenuNav
                    view={view}
                    isDark={isDark}
                    onSelect={setView}
                    isOpen={isMobileMenuOpen}
                    onClose={() => setIsMobileMenuOpen(false)}
                    labels={{
                        transactions: t('nav.transactions') as string,
                        portfolio: t('nav.portfolio') as string,
                        analytics: t('nav.analytics') as string,
                        clients: t('nav.clients') as string,
                        treasury: t('nav.treasury') as string,
                        investors: 'Investisseurs'
                    }}
                />

                <main className="py-6">
                    <AnimatePresence>{alert && (<MotionDiv initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="mb-4"><Alert className={`rounded-xl ${alertClass}`}><AlertDescription>{alert}</AlertDescription></Alert></MotionDiv>)}</AnimatePresence>

                    <Card className={`${cardBase} p-4 mb-4`}>
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="font-bold text-base">{t('common.dailyOverview')}</h2>
                            <span className={`text-xs ${subtleText}`}>{now().date}</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className={`rounded-xl p-3 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                <p className={`text-xs ${subtleText}`}>{t('common.caisseBalance')}</p>
                                <p className="text-lg font-bold text-emerald-400">{dailyOverview.caisse.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            </div>
                            <div className={`rounded-xl p-3 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                <p className={`text-xs ${subtleText}`}>{t('common.baridiBalance')}</p>
                                <p className="text-lg font-bold text-sky-400">{dailyOverview.baridi.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            </div>
                            <div className={`rounded-xl p-3 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                <p className={`text-xs ${subtleText}`}>{t('common.activeClientsToday')}</p>
                                <p className="text-lg font-bold text-indigo-400">{dailyOverview.activeClients}</p>
                            </div>
                            <div className={`rounded-xl p-3 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                <p className={`text-xs ${subtleText}`}>{t('common.todayProfit')}</p>
                                <p className={`text-lg font-bold ${dailyOverview.todayProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {dailyOverview.todayProfit >= 0 ? '+' : ''}{dailyOverview.todayProfit.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </p>
                                <p className={`text-[11px] ${subtleText}`}>{dailyOverview.todayUsdtSold.toFixed(2)} USDT</p>
                            </div>
                        </div>
                    </Card>

                    <Suspense fallback={<PageLoadingFallback isDark={isDark} text={t('common.loading')} />}>
                    {view === 'transactions' && <TransactionsPage
                        cardBase={cardBase}
                        isDark={isDark}
                        subtleText={subtleText}
                        openAdjustmentModal={openAdjustmentModal}
                        openForm={openForm}
                        filterMode={filterMode}
                        setFilterMode={setFilterMode}
                        transactions={transactions}
                        getRelativeDateLabel={getRelativeDateLabel}
                        clientTransactionsDzd={clientTransactionsDzd}
                        clientsDzd={clientsDzd}
                        getClientFullName={getClientFullName}
                        setTxToDelete={setTxToDelete}
                        openDateFilterModal={openDateFilterModal}
                        dateRange={dateRange}
                        setDateRange={setDateRange}
                        openWalletTransferModal={() => setIsWalletTransferModalOpen(true)}
                        openTransferModal={() => setIsTransferModalOpen(true)}
                        treasuryTransactions={treasuryTransactions}
                        handleEditClientTx={handleEditClientTx}
                        handleDeleteClientTxClick={handleDeleteClientTxClick}
                        setTreasuryTxToDelete={setTreasuryTxToDelete}
                    />}

                    {view === 'statistiques' && <PortfolioPage {...portfolioPageProps} />}

                    {view === 'analytics' && <AnalyticsPage {...portfolioPageProps} />}

                    {view === 'dzd' && <ClientsPage {...clientsPageProps} />}

                    {view === 'tresorerie' && (
                        selectedAssetClientId ? (
                            <ManualClientPage
                                client={manualAssetClients.find(c => c.id === selectedAssetClientId)!}
                                transactions={manualAssetTransactions.filter(tx => tx.clientId === selectedAssetClientId)}
                                balance={assetClientBalances.get(`${selectedAssetId}_${selectedAssetClientId}`) || 0}
                                onBack={() => setSelectedAssetClientId(null)}
                                onAddTransaction={handleCreateAssetTransaction}
                                onUpdateTransaction={handleUpdateAssetTransaction}
                                onDeleteTransaction={handleDeleteAssetTransaction}
                                isDark={isDark}
                                cardBase={cardBase}
                                fieldBase={fieldBase}
                                subtleText={subtleText}
                            />
                        ) : selectedAssetId ? (
                            <ManualAssetPage
                                asset={manualAssets.find(a => a.id === selectedAssetId)!}
                                clients={manualAssetClients.filter(c => c.assetId === selectedAssetId)}
                                clientBalances={assetClientBalances}
                                onBack={() => setSelectedAssetId(null)}
                                onSelectClient={(client) => setSelectedAssetClientId(client.id)}
                                onCreateClient={(fullName, phone, email, notes) => {
                                    handleCreateAssetClient(selectedAssetId, { fullName, phone, email, notes });
                                }}
                                onUpdateClient={(clientId, data) => {
                                    handleUpdateAssetClient(clientId, data);
                                }}
                                onDeleteClient={handleDeleteAssetClient}
                                isDark={isDark}
                                cardBase={cardBase}
                                fieldBase={fieldBase}
                                subtleText={subtleText}
                            />
                        ) : (
                            <TresoreriePage
                                {...{
                                    isDark, cardBase, subtleText,
                                    caisseBalance: treasuryStats.caisse,
                                    baridiBalance: treasuryStats.baridi,
                                    totalDettes: totals.totalDettes,
                                    totalAvances: totals.totalAvances,
                                    portfolioValue: (portfolioStats.usdt.available * (portfolioStats.usdt.avgBuy || 0) + portfolioStats.eur.available * (portfolioStats.eur.avgBuy || 0)),
                                    openTreasuryModal: () => openTreasuryCardModal(),
                                    treasuryCards,
                                    openTreasuryCardModal,
                                    setTreasuryCardToDelete,
                                    openTreasuryBalanceEditModal,
                                    openPortfolioBalanceEditModal,
                                    openAdjustmentModal: openAdjustmentModal,
                                    treasuryTransactions,
                                    setTreasuryTxToDelete,
                                    manualAssets,
                                    manualAssetClients,
                                    assetBalances,
                                    assetClientBalances,
                                    onSelectAsset: setSelectedAssetId,
                                    onAddManualAsset: () => setIsCreateAssetModalOpen(true),
                                    onDeleteManualAsset: (id: string) => handleDeleteAsset(id, manualAssetTransactions.filter(tx => tx.actifId === id).length),
                                    onOpenManualAsset: (asset: ManualAsset) => setSelectedAssetId(asset.id),
                                    onOpenCreateManualAsset: () => setIsCreateAssetModalOpen(true)
                                }}
                            />
                        )
                    )}

                    {view === 'investors' && (
                        selectedInvestorId ? (
                            <InvestorDetailsPage
                                investor={derivedInvestors.find(i => i.id === selectedInvestorId)!}
                                transactions={investorTransactions.filter(tx => tx.investorId === selectedInvestorId)}
                                onBack={() => setSelectedInvestorId(null)}
                                onAddCapital={() => { setInvestorTxType('deposit_capital'); setIsInvestorTxModalOpen(true); }}
                                onWithdrawCapital={() => { setInvestorTxType('withdraw_capital'); setIsInvestorTxModalOpen(true); }}
                                onWithdrawProfit={() => { setInvestorTxType('withdraw_profit'); setIsInvestorTxModalOpen(true); }}
                                onReinvestProfit={() => {
                                    const inv = derivedInvestors.find(i => i.id === selectedInvestorId);
                                    if (inv) {
                                        setReinvestInput((inv.availableProfit || 0).toFixed(2));
                                        setIsReinvestModalOpen(true);
                                    }
                                }}
                                onDeleteTransaction={(tx) => { setInvestorTxToDelete(tx); }}
                                isDark={isDark}
                                cardBase={cardBase}
                                subtleText={subtleText}
                                globalNetProfit={portfolioStats.usdt.totalProfit}
                                managerFeePercentage={Number(managerFeePercentage)}
                                totalCapital={derivedInvestors.reduce((sum, inv) => sum + (inv.isActive ? inv.capitalInvested : 0), 0)}
                            />
                        ) : (
                            <InvestorsPage
                                isDark={isDark}
                                cardBase={cardBase}
                                subtleText={subtleText}
                                investors={derivedInvestors}
                                onOpenInvestor={(inv) => setSelectedInvestorId(inv.id)}
                                onAddInvestor={() => { setEditingInvestor(null); setIsInvestorModalOpen(true); }}
                                onEditInvestor={(inv) => { setEditingInvestor(inv); setIsInvestorModalOpen(true); }}
                                onDeleteInvestor={(inv) => { setInvestorToDelete(inv); }}
                                globalNetProfit={portfolioStats.usdt.totalProfit}
                                managerFeePercentage={managerFeePercentage}
                                setManagerFeePercentage={setManagerFeePercentage}
                            />
                        )
                    )}
                    </Suspense>
                </main>
                <AppBottomNav
                    view={view}
                    isDark={isDark}
                    onSelect={setView}
                    labels={{
                        transactions: t('nav.transactions') as string,
                        portfolio: t('nav.portfolio') as string,
                        analytics: t('nav.analytics') as string,
                        clients: t('nav.clients') as string,
                        treasury: t('nav.treasury') as string,
                        investors: 'Investisseurs'
                    }}
                />

                <Dialog isOpen={isGlobalSearchOpen} onClose={closeGlobalSearch} className={`${cardBase} max-w-2xl`}>
                    <DialogHeader onClose={closeGlobalSearch} isDark={isDark}>
                        <DialogTitle>{t('common.globalSearch')}</DialogTitle>
                    </DialogHeader>
                    <DialogContent className="px-6 pb-6 space-y-3">
                        <Input
                            value={globalSearchQuery}
                            onChange={(e) => setGlobalSearchQuery(e.target.value)}
                            className={fieldBase}
                            placeholder={t('common.searchPlaceholder')}
                            autoFocus
                        />
                        <div className={`rounded-xl border max-h-[50vh] overflow-y-auto ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                            {!globalSearchQuery.trim() ? (
                                <p className={`p-4 text-sm ${subtleText}`}>Ctrl+K</p>
                            ) : globalSearchResults.length === 0 ? (
                                <p className={`p-4 text-sm ${subtleText}`}>{t('common.noResults')}</p>
                            ) : (
                                <div className="divide-y" style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}>
                                    {globalSearchResults.map((result) => (
                                        <button
                                            key={result.id}
                                            onClick={() => handleSelectGlobalSearchResult(result)}
                                            className={`w-full text-left p-3 transition-colors ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-50'}`}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="font-semibold truncate">{result.title}</p>
                                                    <p className={`text-xs mt-0.5 ${subtleText} truncate`}>{result.subtitle || '-'}</p>
                                                </div>
                                                <span className={`text-[10px] px-2 py-1 rounded-full uppercase tracking-wide ${result.kind === 'client' ? (isDark ? 'bg-sky-900/50 text-sky-300' : 'bg-sky-100 text-sky-700') : (isDark ? 'bg-indigo-900/50 text-indigo-300' : 'bg-indigo-100 text-indigo-700')}`}>
                                                    {result.kind === 'client' ? t('nav.clients') : t('nav.transactions')}
                                                </span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {/* MODALS */}

            {/* 1. WALLET TRANSFER MODAL REDESIGNED */}
            <Dialog isOpen={isWalletTransferModalOpen} onClose={() => setIsWalletTransferModalOpen(false)} className={`${cardBase} max-w-sm`}>
                <DialogHeader onClose={() => setIsWalletTransferModalOpen(false)} isDark={isDark}>
                    <DialogTitle>{t('transactions.internalTransfer')}</DialogTitle>
                    <p className={`text-sm ${subtleText} mt-1 font-normal`}>Transfert entre comptes internes</p>
                </DialogHeader>
                <DialogContent className="px-6 pb-6 space-y-4">

                    {/* 1. Amount Field (Top) */}
                    <div>
                        <Label>{t('transactions.amount')} (DZD)</Label>
                        <div className="relative">
                            <NumberInput
                                value={walletTransferAmount}
                                onChange={e => setWalletTransferAmount(e.target.value)}
                                className={fieldBase}
                                placeholder="0.00"
                            />
                            <button
                                onClick={handleWalletTransferMaxClick}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs bg-sky-600 text-white px-2 py-1 rounded hover:bg-sky-700 transition-colors font-bold"
                            >
                                MAX
                            </button>
                        </div>
                    </div>

                    {/* 2. Source Account (De) */}
                    <div>
                        <Label>{t('transactions.from')} ({t('common.source')})</Label>
                        <Select
                            value={walletTransferSource}
                            onChange={e => setWalletTransferSource(e.target.value as any)}
                            className={fieldBase}
                        >
                            <option value="Caisse">Caisse — Solde: {treasuryStats.caisse.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD</option>
                            <option value="BaridiMob">BaridiMob — Solde: {treasuryStats.baridi.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD</option>
                        </Select>
                    </div>

                    {/* 3. Swap Button (Centered) */}
                    <div className="flex justify-center -my-2 z-10 relative">
                        <button
                            onClick={handleSwapSourceDest}
                            className={`p-2 rounded-full border shadow-sm transition-all hover:scale-110 active:scale-95 ${isDark ? 'bg-slate-800 border-slate-600 text-sky-400 hover:bg-slate-700' : 'bg-white border-slate-200 text-sky-600 hover:bg-slate-50'}`}
                            title="Inverser Source et Destination"
                        >
                            <ArrowRightLeftIcon className="w-4 h-4 rotate-90 sm:rotate-0" />
                        </button>
                    </div>

                    {/* 4. Destination Account (Vers) */}
                    <div>
                        <Label>{t('transactions.to')} ({t('common.destination')})</Label>
                        <Select
                            value={walletTransferDest}
                            onChange={e => setWalletTransferDest(e.target.value as any)}
                            className={fieldBase}
                        >
                            <option value="BaridiMob">BaridiMob — Solde: {treasuryStats.baridi.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD</option>
                            <option value="Caisse">Caisse — Solde: {treasuryStats.caisse.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD</option>
                        </Select>
                        {walletTransferSource === walletTransferDest && (
                            <p className="text-xs text-red-500 mt-1">⚠️ Impossible de sélectionner le même compte.</p>
                        )}
                    </div>

                    {/* 5. Notes Field */}
                    <div>
                        <Label>{t('common.notesOptional')}</Label>
                        <Input
                            value={walletTransferNotes}
                            onChange={e => setWalletTransferNotes(e.target.value)}
                            className={fieldBase}
                            placeholder="Note..."
                        />
                    </div>

                </DialogContent>
                <DialogFooter>
                    <Button
                        onClick={handleWalletTransfer}
                        disabled={isWalletTransferInvalid}
                        className={`w-full font-bold py-3 rounded-xl shadow-md transition-all ${isWalletTransferInvalid
                            ? 'bg-gray-400 cursor-not-allowed opacity-70'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                            }`}
                    >
                        {isSaving ? t('common.processing') : t('transactions.confirmTransfer')}
                    </Button>
                </DialogFooter>
            </Dialog>

            {/* 2. CLIENT TX MODAL - Updated to use Select for Type d'Actif */}
            <Dialog isOpen={isClientTxModalOpen} onClose={() => setIsClientTxModalOpen(false)} className={`${cardBase} max-w-lg`}>
                <DialogHeader onClose={() => setIsClientTxModalOpen(false)} isDark={isDark}><DialogTitle>{editingClientTx ? t('transactions.editOperation') : t('transactions.newOperation')}</DialogTitle></DialogHeader>
                <DialogContent className="px-6 pb-6 space-y-4">
                    {/* SIMPLIFIED CLIENT TX MODAL CONTENT */}

                    {/* HIDE TYPE SELECTOR IF EDITING OR IF IT WAS PRE-SELECTED FROM DROPDOWN */}
                    {!editingClientTx && (clientTxType === 'Règlement Reçu' || clientTxType === 'Paiement Effectué') && (
                        <div><Label>{t('transactions.operationType')}</Label><Select id="tx_type_select" value={clientTxType} onChange={e => setClientTxType(e.target.value as any)} className={fieldBase} disabled={!!editingClientTx}><option value="Règlement Reçu">{t('transactions.paymentReceived')}</option><option value="Paiement Effectué">{t('transactions.paymentMade')}</option></Select></div>
                    )}

                    {/* REMOVED: Source Selector (Type d'Actif) */}
                    {/* REMOVED: Payment Status Selector (Statut du Paiement) */}

                    {clientTxType === 'Vente USDT' ? (
                        <div className="space-y-4"><div><Label>{t('portfolio.qtyUsdt')}</Label><NumberInput value={clientTxUsdtAmount} onChange={e => setClientTxUsdtAmount(e.target.value)} className={fieldBase} /></div><div><Label>{t('portfolio.sellingPriceDzd')}</Label><NumberInput value={clientTxSellPrice} onChange={e => setClientTxSellPrice(e.target.value)} className={fieldBase} /></div></div>
                    ) : clientTxType === 'Achat EUR' ? (
                        <div className="space-y-4"><div><Label>{t('transactions.qtyEur')}</Label><NumberInput value={clientTxEurAmount} onChange={e => setClientTxEurAmount(e.target.value)} className={fieldBase} /></div><div><Label>{t('portfolio.buyPrice')}</Label><NumberInput value={clientTxEurPrice} onChange={e => setClientTxEurPrice(e.target.value)} className={fieldBase} /></div></div>
                    ) : (
                        <div>
                            <Label>{t('transactions.amountDzd')}</Label>
                            <div className="relative">
                                {/* ALLOW NEGATIVE VALUES: Use Input type="number" or NumberInput without restrictions if possible. 
                                    Our NumberInput might restrict? Let's check. 
                                    If NumberInput restricts, use standard Input. 
                                    User said: "يقبل القيم الموجبة والسالبة دون أي قيود"
                                */}
                                <Input
                                    type="text"
                                    inputMode="decimal"
                                    value={clientTxAmount}
                                    onChange={e => setClientTxAmount(e.target.value)}
                                    className={fieldBase}
                                    placeholder="+/- Montant"
                                />
                            </div>
                            <p className="text-xs mt-1 opacity-60">{t('transactions.enterPositiveNegativeValue')}</p>
                        </div>
                    )}
                    <div><Label>{t('common.notesOptional')}</Label><Input value={clientTxNotes} onChange={e => setClientTxNotes(e.target.value)} className={fieldBase} /></div>
                </DialogContent>
                <DialogFooter><Button onClick={() => handleSaveClientTx(selectedClientId)} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl">{t('common.save')}</Button></DialogFooter>
            </Dialog>

            {/* 3. TREASURY ADJUSTMENT MODAL REDESIGNED */}
            <Dialog isOpen={isAdjustmentModalOpen} onClose={() => setIsAdjustmentModalOpen(false)} className={`${cardBase} max-w-sm`}>
                <DialogHeader onClose={() => setIsAdjustmentModalOpen(false)} isDark={isDark}>
                    <DialogTitle>{editingTreasuryTx ? t('transactions.editAdjustment') : 'Ajustement Trésorerie'}</DialogTitle>
                </DialogHeader>
                <DialogContent className="px-6 pb-6 space-y-4">

                    {/* 1. Mode Toggle (Ajouter / Retirer) */}
                    <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                        <button
                            onClick={() => setAdjustmentTab('add')}
                            className={`flex-1 py-2 rounded-md text-sm font-semibold transition-all ${adjustmentTab === 'add' ? 'bg-green-600 text-white shadow' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                        >
                            Ajouter (+)
                        </button>
                        <button
                            onClick={() => setAdjustmentTab('subtract')}
                            className={`flex-1 py-2 rounded-md text-sm font-semibold transition-all ${adjustmentTab === 'subtract' ? 'bg-red-600 text-white shadow' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                        >
                            Retirer (-)
                        </button>
                    </div>

                    {/* 2. Type d'Actif */}
                    <div>
                        <Label>{t('transactions.assetType')}</Label>
                        <Select value={adjustmentAsset} onChange={e => setAdjustmentAsset(e.target.value as any)} className={fieldBase}>
                            <option value="DZD-Caisse">DZD - Caisse</option>
                            <option value="DZD-Baridi">DZD - Baridi</option>
                            <option value="USDT">USDT</option>
                            <option value="EUR">EUR</option>
                        </Select>
                    </div>

                    {/* 3. Montant (+ MAX button if Client Selected) */}
                    <div>
                        <Label>{adjustmentAsset === 'USDT' || adjustmentAsset === 'EUR' ? t('transactions.quantity') : t('transactions.amount')}</Label>
                        <div className="relative">
                            <NumberInput
                                value={adjustmentAmount}
                                onChange={e => setAdjustmentAmount(e.target.value)}
                                className={fieldBase}
                                placeholder="0.00"
                            />
                            {/* MAX BUTTON - ALWAYS VISIBLE, logic depends on Asset Type */}
                            <button
                                onClick={() => {
                                    // LOGIC 1: Caisse / Baridi -> Client Balance
                                    if (adjustmentAsset === 'DZD-Caisse' || adjustmentAsset === 'DZD-Baridi') {
                                        if (adjustmentClientId) {
                                            const clientBal = clientBalances.get(adjustmentClientId) || 0;
                                            setAdjustmentAmount(Math.abs(clientBal).toString());
                                        }
                                    }
                                    // LOGIC 2: USDT / EUR -> Available Balance
                                    else if (adjustmentAsset === 'USDT') {
                                        setAdjustmentAmount((portfolioStats?.usdt?.available || 0).toString());
                                    }
                                    else if (adjustmentAsset === 'EUR') {
                                        setAdjustmentAmount((portfolioStats?.eur?.available || 0).toString());
                                    }
                                }}
                                disabled={
                                    (adjustmentAsset === 'DZD-Caisse' || adjustmentAsset === 'DZD-Baridi') && !adjustmentClientId
                                }
                                className={`absolute right-2 top-1/2 -translate-y-1/2 text-xs px-2 py-1 rounded transition-colors font-bold ${((adjustmentAsset === 'DZD-Caisse' || adjustmentAsset === 'DZD-Baridi') && !adjustmentClientId)
                                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-slate-700 dark:text-slate-500' // Disabled Style
                                    : (isDark ? 'bg-slate-600 text-gray-200 hover:bg-slate-500' : 'bg-slate-200 text-gray-700 hover:bg-slate-300') // Enabled Style
                                    }`}
                                title={
                                    (adjustmentAsset === 'DZD-Caisse' || adjustmentAsset === 'DZD-Baridi') && !adjustmentClientId
                                        ? "Sélectionnez un client"
                                        : "Utiliser le solde disponible"
                                }
                            >
                                MAX
                            </button>
                        </div>
                    </div>

                    {/* 4. Prix Unitaire (Visible only if USDT/EUR) */}
                    {(adjustmentAsset === 'USDT' || adjustmentAsset === 'EUR') && (
                        <div>
                            <Label>{t('transactions.unitPrice')}</Label>
                            <NumberInput value={adjustmentPrice} onChange={e => setAdjustmentPrice(e.target.value)} className={fieldBase} placeholder="Ex: 240.00" />
                        </div>
                    )}

                    {/* 5. Client Lié (Visible only if DZD) */}
                    {(adjustmentAsset === 'DZD-Caisse' || adjustmentAsset === 'DZD-Baridi') && (
                        <div>
                            <div className="flex justify-between">
                                <Label>{t('transactions.linkedClientOptional')}</Label>
                                <span className="text-xs text-gray-400">Optionnel</span>
                            </div>
                            <Select value={adjustmentClientId} onChange={e => setAdjustmentClientId(e.target.value)} className={fieldBase}>
                                <option value="">Aucun client</option>
                                {clientsDzd.map(c => <option key={c.id} value={c.id}>{getClientFullName(c)}</option>)}
                            </Select>
                        </div>
                    )}

                    {/* 6. Motif */}
                    <div>
                        <Label>{t('transactions.reason')}</Label>
                        <Input value={adjustmentNote} onChange={e => setAdjustmentNote(e.target.value)} className={fieldBase} placeholder="Ex: Alimentation, Frais..." />
                    </div>

                </DialogContent>
                <DialogFooter>
                    <Button
                        onClick={handleGlobalAdjustment}
                        disabled={
                            isSaving ||
                            !adjustmentAmount || parseFloat(adjustmentAmount) <= 0 ||
                            (adjustmentTab === 'subtract' && (
                                adjustmentAsset === 'USDT' ? parseFloat(adjustmentAmount) > (portfolioStats?.usdt?.available || 0) :
                                    adjustmentAsset === 'EUR' ? parseFloat(adjustmentAmount) > (portfolioStats?.eur?.available || 0) : false
                            ))
                        }
                        className={`w-full font-bold py-3 rounded-xl shadow-md transition-all ${(isSaving || !adjustmentAmount || parseFloat(adjustmentAmount) <= 0 || (adjustmentTab === 'subtract' && (
                            adjustmentAsset === 'USDT' ? parseFloat(adjustmentAmount) > (portfolioStats?.usdt?.available || 0) :
                                adjustmentAsset === 'EUR' ? parseFloat(adjustmentAmount) > (portfolioStats?.eur?.available || 0) : false
                        )))
                            ? 'bg-gray-400 cursor-not-allowed opacity-70'
                            : (adjustmentTab === 'add' ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white')
                            }`}
                    >
                        {isSaving ? t('common.processing') : 'Confirmer'}
                    </Button>
                </DialogFooter>
            </Dialog>

            <Dialog isOpen={isTransferModalOpen} onClose={() => setIsTransferModalOpen(false)} className={`${cardBase} max-w-lg`}>
                <DialogHeader onClose={() => setIsTransferModalOpen(false)} isDark={isDark}><DialogTitle>{t('transactions.clientTransfer')}</DialogTitle></DialogHeader>
                <DialogContent className="px-6 pb-6 space-y-4">
                    <div className="p-3 bg-sky-500/10 rounded-lg text-sm text-sky-600 dark:text-sky-400 mb-2">{t('transactions.transferDebtCredit')}</div>
                    <div>
                        <Label>{t('transactions.from')}</Label>
                        <Select value={transferFromClientId} onChange={e => setTransferFromClientId(e.target.value)} className={fieldBase}>
                            <option value="">-- {t('transactions.filterClients')} --</option>
                            {clientsDzd.map(c => <option key={c.id} value={c.id}>{getClientFullName(c)}</option>)}
                        </Select>
                        {transferFromClientId && (
                            <p className={`text-xs mt-1 ${subtleText}`}>
                                {t('common.balance')} : {transferFromBalance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {t('common.dinar')}
                            </p>
                        )}
                    </div>
                    <div>
                        <Label>{t('transactions.to')}</Label>
                        <Select value={transferToClientId} onChange={e => setTransferToClientId(e.target.value)} className={fieldBase}>
                            <option value="">-- {t('transactions.filterClients')} --</option>
                            {clientsDzd.map(c => <option key={c.id} value={c.id}>{getClientFullName(c)}</option>)}
                        </Select>
                        {transferToClientId && (
                            <p className={`text-xs mt-1 ${subtleText}`}>
                                {t('common.balance')} : {transferToBalance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {t('common.dinar')}
                            </p>
                        )}
                    </div>
                    <div>
                        <Label>{t('transactions.amount')}</Label>
                        <div className="relative">
                            <NumberInput value={transferAmount} onChange={e => setTransferAmount(e.target.value)} className={fieldBase} />
                            {transferFromClientId && (
                                <button
                                    onClick={() => setTransferAmount(Math.abs(transferFromBalance).toString())}
                                    className="absolute right-2 top-2 text-xs bg-sky-600 text-white px-2 py-1 rounded hover:bg-sky-700 transition-colors"
                                >
                                    Max
                                </button>
                            )}
                        </div>
                    </div>
                    <div><Label>{t('common.notes')}</Label><Input value={transferNotes} onChange={e => setTransferNotes(e.target.value)} className={fieldBase} /></div>
                </DialogContent>
                <DialogFooter><Button onClick={handleSaveTransfer} disabled={isSaving} className="w-full bg-sky-600 hover:bg-sky-700 text-white font-bold py-3 rounded-xl">{t('transactions.confirmTransfer')}</Button></DialogFooter>
            </Dialog>

            {/* NEW: Treasury Balance Edit Modal */}
            <Dialog isOpen={isTreasuryBalanceEditModalOpen} onClose={() => setIsTreasuryBalanceEditModalOpen(false)} className={`${cardBase} max-w-sm`}>
                <DialogHeader onClose={() => setIsTreasuryBalanceEditModalOpen(false)} isDark={isDark}>
                    <DialogTitle>{t('transactions.editBalance')} {treasuryBalanceEditAsset}</DialogTitle>
                </DialogHeader>
                <DialogContent className="px-6 pb-6 space-y-4">
                    <div className="p-3 bg-blue-500/10 rounded-lg text-sm text-blue-600 dark:text-blue-400 mb-2">
                        {t('transactions.editBalanceDesc')}
                    </div>
                    <div>
                        <Label>{t('transactions.newBalance')} ({t('common.dinar')})</Label>
                        <Input
                            type="text"
                            inputMode="numeric"
                            value={treasuryBalanceEditValue}
                            onChange={e => {
                                const normalized = e.target.value.replace(',', '.').trim();
                                if (normalized === '') {
                                    setTreasuryBalanceEditValue('');
                                    return;
                                }
                                if (/^\d+$/.test(normalized)) {
                                    setTreasuryBalanceEditValue(normalized);
                                }
                            }}
                            onBlur={() => {
                                const parsed = parseAndEvaluate(treasuryBalanceEditValue);
                                if (!isNaN(parsed)) {
                                    setTreasuryBalanceEditValue(Math.round(parsed).toString());
                                }
                            }}
                            className={`${fieldBase} text-2xl font-bold text-center`}
                        />
                    </div>
                    <div>
                        <Label>{t('common.notesOptional')}</Label>
                        <Input value={treasuryBalanceEditNotes} onChange={e => setTreasuryBalanceEditNotes(e.target.value)} className={fieldBase} placeholder={t('transactions.reason')} />
                    </div>
                </DialogContent>
                <DialogFooter>
                    <Button onClick={handleSaveTreasuryBalanceEdit} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl">{t('common.save')}</Button>
                </DialogFooter>
            </Dialog>

            {/* NEW: Portfolio Balance Edit Modal */}
            <Dialog isOpen={isPortfolioBalanceEditModalOpen} onClose={() => setIsPortfolioBalanceEditModalOpen(false)} className={`${cardBase} max-w-sm`}>
                <DialogHeader onClose={() => setIsPortfolioBalanceEditModalOpen(false)} isDark={isDark}>
                    <DialogTitle>{t('transactions.editBalance')} {portfolioBalanceEditAsset}</DialogTitle>
                </DialogHeader>
                <DialogContent className="px-6 pb-6 space-y-4">
                    <div className="p-3 bg-blue-500/10 rounded-lg text-sm text-blue-600 dark:text-blue-400 mb-2">
                        {t('transactions.editBalanceDesc')}
                    </div>
                    <div>
                        <Label>{t('transactions.newBalance')} ({portfolioBalanceEditAsset})</Label>
                        <Input
                            type="text"
                            inputMode="decimal"
                            value={portfolioBalanceEditValue}
                            onChange={e => {
                                const normalized = e.target.value.replace(',', '.').trim();
                                if (normalized === '') {
                                    setPortfolioBalanceEditValue('');
                                    return;
                                }
                                if (/^\d+(\.\d{0,2})?$/.test(normalized)) {
                                    setPortfolioBalanceEditValue(normalized);
                                }
                            }}
                            onBlur={() => {
                                const parsed = parseAndEvaluate(portfolioBalanceEditValue);
                                if (!isNaN(parsed)) {
                                    setPortfolioBalanceEditValue(Number(parsed).toFixed(2));
                                }
                            }}
                            className={`${fieldBase} text-2xl font-bold text-center`}
                        />
                    </div>
                    <div>
                        <Label>{t('common.notesOptional')}</Label>
                        <Input value={portfolioBalanceEditNotes} onChange={e => setPortfolioBalanceEditNotes(e.target.value)} className={fieldBase} placeholder={t('transactions.reason')} />
                    </div>
                </DialogContent>
                <DialogFooter>
                    <Button onClick={handleSavePortfolioBalanceEdit} disabled={isSaving} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl">{isSaving ? t('common.saving') : t('common.save')}</Button>
                </DialogFooter>
            </Dialog>





            <Dialog isOpen={isDateFilterModalOpen} onClose={() => setIsDateFilterModalOpen(false)} className={`${cardBase} max-w-md`}>
                <DialogHeader onClose={() => setIsDateFilterModalOpen(false)} isDark={isDark}><DialogTitle>{t('transactions.filterByDate')}</DialogTitle></DialogHeader>
                <DialogContent className="px-6 pb-6 space-y-4"><div><Label>{t('transactions.startDate')}</Label><Input type="date" value={tempStartDate} onChange={e => setTempStartDate(e.target.value)} className={fieldBase} /></div><div><Label>{t('transactions.endDate')}</Label><Input type="date" value={tempEndDate} onChange={e => setTempEndDate(e.target.value)} className={fieldBase} /></div></DialogContent>
                <DialogFooter><Button onClick={handleClearDateFilter} className={`w-full ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>{t('transactions.clear')}</Button><Button onClick={handleApplyDateFilter} className="w-full bg-sky-600 text-white">{t('transactions.apply')}</Button></DialogFooter>
            </Dialog>

            <Dialog isOpen={mode !== null} onClose={closeForm} className={`${cardBase} max-w-lg`}>
                <DialogHeader onClose={closeForm} isDark={isDark}><DialogTitle>{editingTx ? t('common.edit') : (mode === 'sell_usdt' ? t('transactions.newTransaction') : t('transactions.newTransaction'))}</DialogTitle></DialogHeader>
                <DialogContent className="px-6 pb-6 space-y-4">
                    {mode && (
                        <>
                            {mode.startsWith('buy') && !buyUsdtMode && mode !== 'buy_eur' && (
                                <>
                                    <div className="text-center mb-6">
                                        <h3 className="text-lg font-medium mb-1">{t('transactions.howDidYouBuy')}</h3>
                                        <p className={`text-sm ${subtleText}`}>{t('transactions.selectCurrency')}</p>
                                    </div>
                                    <div className="space-y-3">
                                        <Button onClick={() => setBuyUsdtMode('with_dzd')} className="w-full bg-teal-600 hover:bg-teal-700 text-white py-4 rounded-xl font-bold shadow-md flex items-center justify-center">
                                            {t('portfolio.buyWithDzd')} ({t('common.dinar')})
                                        </Button>
                                        <Button onClick={() => { setBuyUsdtMode('with_eur'); setEurDzdPrice(portfolioStats.eur.avgBuy.toFixed(2)); }} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold shadow-md flex items-center justify-center">
                                            {t('portfolio.buyWithEur')} (EUR)
                                        </Button>
                                    </div>
                                </>
                            )}
                            {(buyUsdtMode || mode === 'buy_eur' || mode === 'sell_usdt') && (
                                <div className="space-y-3">

                                    {/* CASE 0: Buy USDT with DZD - REDESIGNED */}
                                    {buyUsdtMode === 'with_dzd' && (
                                        <>
                                            <div>
                                                <Label>{t('transactions.qtyUsdt')}</Label>
                                                <NumberInput
                                                    value={buyUsdtAmount}
                                                    onChange={e => {
                                                        setBuyUsdtAmount(e.target.value);
                                                        // Auto-calculate total when quantity changes ONLY IF NOT MANUAL
                                                        if (!isTotalManual) {
                                                            const qty = parseAndEvaluate(e.target.value);
                                                            const price = parseAndEvaluate(buyUsdtPrice);
                                                            if (qty > 0 && price > 0) {
                                                                setBuyUsdtTotal((qty * price).toFixed(0));
                                                            } else if (qty === 0 || e.target.value === '') {
                                                                setBuyUsdtTotal('');
                                                            }
                                                        }
                                                    }}
                                                    onBlur={() => {
                                                        const qty = parseAndEvaluate(buyUsdtAmount);
                                                        if (!isNaN(qty) && qty > 0) {
                                                            setBuyUsdtAmount(qty.toFixed(2));
                                                        }
                                                    }}
                                                    className={`${fieldBase} ${formValidation.errors['buyUsdtAmount'] ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                                                />
                                                {formValidation.errors['buyUsdtAmount'] && <p className="text-red-500 text-xs mt-1">{formValidation.errors['buyUsdtAmount']}</p>}
                                            </div>
                                            <div>
                                                <Label>{t('transactions.buyPrice')} ({t('common.dinar')})</Label>
                                                <NumberInput
                                                    value={buyUsdtPrice}
                                                    onChange={e => {
                                                        setBuyUsdtPrice(e.target.value);
                                                        // Auto-calculate total when price changes ONLY IF NOT MANUAL
                                                        if (!isTotalManual) {
                                                            const qty = parseAndEvaluate(buyUsdtAmount);
                                                            const price = parseAndEvaluate(e.target.value);
                                                            if (qty > 0 && price > 0) {
                                                                setBuyUsdtTotal((qty * price).toFixed(0));
                                                            } else if (price === 0 || e.target.value === '') {
                                                                setBuyUsdtTotal('');
                                                            }
                                                        }
                                                    }}
                                                    className={`${fieldBase} ${formValidation.errors['buyUsdtPrice'] ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                                                />
                                                {formValidation.errors['buyUsdtPrice'] && <p className="text-red-500 text-xs mt-1">{formValidation.errors['buyUsdtPrice']}</p>}
                                            </div>
                                            <div>
                                                <Label>{t('transactions.totalAmount')} ({t('common.dinar')})</Label>
                                                <NumberInput
                                                    value={buyUsdtTotal}
                                                    onChange={e => {
                                                        const val = e.target.value;
                                                        setBuyUsdtTotal(val);
                                                        if (val) {
                                                            setIsTotalManual(true);
                                                            // Bidirectional: Calculate Quantity from Total
                                                            const total = parseAndEvaluate(val);
                                                            const price = parseAndEvaluate(buyUsdtPrice);
                                                            if (total > 0 && price > 0) {
                                                                setBuyUsdtAmount((total / price).toFixed(2));
                                                            }
                                                        } else {
                                                            setIsTotalManual(false);
                                                            // Immediate auto-calc when cleared
                                                            const qty = parseAndEvaluate(buyUsdtAmount);
                                                            const price = parseAndEvaluate(buyUsdtPrice);
                                                            if (qty > 0 && price > 0) setBuyUsdtTotal((qty * price).toFixed(0));
                                                        }
                                                    }}
                                                    onBlur={() => {
                                                        const total = parseAndEvaluate(buyUsdtTotal);
                                                        if (!isNaN(total) && total > 0) {
                                                            setBuyUsdtTotal(Math.round(total).toString());
                                                        }
                                                    }}
                                                    className={`${fieldBase} ${formValidation.errors['buyUsdtTotal'] ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                                                    placeholder={t('transactions.autoCalc')}
                                                />
                                                {formValidation.errors['buyUsdtTotal'] && <p className="text-red-500 text-xs mt-1">{formValidation.errors['buyUsdtTotal']}</p>}
                                                <p className={`text-xs mt-1 ${subtleText}`}>{t('transactions.autoCalc')}</p>
                                            </div>
                                            <ClientLinker
                                                {...{ linkedClientId, setLinkedClientId, openClientModal, clientsDzd, fieldBase, isDark, clientPaymentStatus, setClientPaymentStatus }}
                                                errorMessage={formValidation.errors['linkedClientId']}
                                                hasError={!!formValidation.errors['linkedClientId']}
                                            />
                                            <div>
                                                <Label>{t('common.notesOptional')}</Label>
                                                <Input value={notes} onChange={e => setNotes(e.target.value)} className={fieldBase} />
                                            </div>
                                        </>
                                    )}

                                    {/* CASE 1: Buy USDT with EUR (Layout requested by user) */}
                                    {buyUsdtMode === 'with_eur' && (
                                        <>
                                            <div>
                                                <Label>{t('transactions.qtyEur')}</Label>
                                                <div className="relative">
                                                    <NumberInput
                                                        value={buyEurForUsdtAmount}
                                                        onChange={e => {
                                                            setBuyEurForUsdtAmount(e.target.value);
                                                        }}
                                                        className={`${fieldBase} ${formValidation.errors['buyEurForUsdtAmount'] ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                                                    />
                                                    {formValidation.errors['buyEurForUsdtAmount'] && <p className="text-red-500 text-xs mt-1 absolute -bottom-5 left-0">{formValidation.errors['buyEurForUsdtAmount']}</p>}
                                                    <button onClick={() => setBuyEurForUsdtAmount(portfolioStats.eur.available.toString())} className="absolute right-2 top-2 text-xs bg-blue-600 text-white px-2 py-1 rounded">{t('common.max')}</button>
                                                </div>
                                                <p className={`text-xs mt-1 ${subtleText}`}>{t('portfolio.currentBalanceEur')}: {portfolioStats.eur.available.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} EUR</p>
                                            </div>

                                            <div>
                                                <Label>{t('portfolio.buyPriceEur')} ({t('common.dinar')})</Label>
                                                <NumberInput
                                                    value={eurDzdPrice}
                                                    onChange={e => {
                                                        setEurDzdPrice(e.target.value);
                                                    }}
                                                    className={fieldBase}
                                                />
                                                <p className={`text-xs mt-1 ${subtleText}`}>{t('transactions.basedOnPamEur')}</p>
                                                {formValidation.errors['eurDzdPrice'] && <p className="text-red-500 text-xs mt-1">{formValidation.errors['eurDzdPrice']}</p>}
                                            </div>
                                            <div>
                                                <Label>{t('portfolio.rateEurUsdt')}</Label>
                                                <NumberInput
                                                    value={eurUsdtRate}
                                                    onChange={e => {
                                                        setEurUsdtRate(e.target.value);
                                                    }}
                                                    className={`${fieldBase} ${formValidation.errors['eurUsdtRate'] ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                                                    placeholder="Ex: 0.92"
                                                />
                                                {formValidation.errors['eurUsdtRate'] && <p className="text-red-500 text-xs mt-1">{formValidation.errors['eurUsdtRate']}</p>}
                                            </div>

                                            {/* Calculated USDT Quantity Message */}
                                            {(() => {
                                                const eurQty = parseAndEvaluate(buyEurForUsdtAmount);
                                                const rate = parseAndEvaluate(eurUsdtRate);
                                                const usdtQty = (eurQty > 0 && rate > 0) ? (eurQty / rate) : 0;
                                                const currentUsdtBalance = portfolioStats.usdt.available;
                                                const totalAfterPurchase = currentUsdtBalance + usdtQty;

                                                if (usdtQty > 0) {
                                                    return (
                                                        <div className="p-3 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/30 rounded-xl space-y-2">
                                                            <div>
                                                                <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{t('transactions.quantity')} USDT</p>
                                                                <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
                                                                    {usdtQty.toFixed(2)} USDT
                                                                </p>
                                                            </div>

                                                            <div className="pt-2 border-t border-emerald-500/20">
                                                                <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{t('transactions.newBalance')}</p>
                                                                <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                                                                    {totalAfterPurchase.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
                                                                </p>
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            })()}

                                            <div><Label>{t('common.notesOptional')}</Label><Input value={notes} onChange={e => setNotes(e.target.value)} className={fieldBase} /></div>
                                        </>
                                    )}

                                    {/* CASE 2: Sell USDT */}
                                    {mode === 'sell_usdt' && (
                                        <>
                                            <div>
                                                <Label>{t('transactions.qtyUsdt')}</Label>
                                                <div className="relative">
                                                    <NumberInput
                                                        value={sellAmount}
                                                        onChange={e => {
                                                            setSellAmount(e.target.value);
                                                            // Calculate total when quantity changes ONLY IF NOT MANUAL
                                                            if (!isTotalManual) {
                                                                const qty = parseAndEvaluate(e.target.value);
                                                                const price = parseAndEvaluate(sellPrice);
                                                                if (qty > 0 && price > 0) {
                                                                    setSellTotal((qty * price).toFixed(0));
                                                                }
                                                            }
                                                        }}
                                                        onBlur={() => {
                                                            const qty = parseAndEvaluate(sellAmount);
                                                            if (!isNaN(qty) && qty > 0) {
                                                                setSellAmount(qty.toFixed(2));
                                                            }
                                                        }}
                                                        className={fieldBase}
                                                        placeholder="0.00"
                                                    />
                                                    <button onClick={() => {
                                                        setSellAmount(portfolioStats.usdt.available.toFixed(2));
                                                        const price = parseAndEvaluate(sellPrice);
                                                        if (price > 0) {
                                                            setSellTotal((portfolioStats.usdt.available * price).toFixed(0));
                                                        }
                                                    }} className="absolute right-2 top-2 text-xs bg-sky-600 text-white px-2 py-1 rounded">{t('common.max')}</button>
                                                </div>
                                                <p className={`text-xs mt-1 ${subtleText}`}>{t('common.balance')}: {portfolioStats.usdt.available.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT</p>
                                                {formValidation.errors['sellAmount'] && <p className="text-red-500 text-xs mt-1">{formValidation.errors['sellAmount']}</p>}
                                            </div>

                                            <div>
                                                <Label>{t('transactions.totalAmount')} ({t('common.dinar')})</Label>
                                                <NumberInput
                                                    value={sellTotal}
                                                    onChange={e => {
                                                        const val = e.target.value;
                                                        setSellTotal(val);
                                                        if (val) {
                                                            setIsTotalManual(true);
                                                            // Bidirectional: Calculate Quantity from Total
                                                            const total = parseAndEvaluate(val);
                                                            const price = parseAndEvaluate(sellPrice);
                                                            if (total > 0 && price > 0) {
                                                                setSellAmount((total / price).toFixed(2));
                                                            }
                                                        } else {
                                                            setIsTotalManual(false);
                                                            // Immediate auto-calc when cleared
                                                            const qty = parseAndEvaluate(sellAmount);
                                                            const price = parseAndEvaluate(sellPrice);
                                                            if (qty > 0 && price > 0) setSellTotal((qty * price).toFixed(0));
                                                        }
                                                    }}
                                                    onBlur={() => {
                                                        const total = parseAndEvaluate(sellTotal);
                                                        if (!isNaN(total) && total > 0) {
                                                            setSellTotal(Math.round(total).toString());
                                                        }
                                                    }}
                                                    className={`${fieldBase} ${formValidation.errors['sellTotal'] ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                                                    placeholder="0.00"
                                                />
                                                {formValidation.errors['sellTotal'] && <p className="text-red-500 text-xs mt-1">{formValidation.errors['sellTotal']}</p>}
                                            </div>

                                            <div className={`p-3 rounded-lg ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-gray-400">{t('portfolio.currentPam')}:</span>
                                                    <span className="font-bold">{portfolioStats.usdt.avgBuy.toFixed(2)} {t('common.dinar')}</span>
                                                </div>
                                                <div
                                                    className="flex justify-between text-sm mt-1 cursor-pointer hover:opacity-80 transition-opacity"
                                                    onClick={() => {
                                                        const price = suggestedSellingPrice && parseFloat(suggestedSellingPrice) > 0
                                                            ? parseFloat(suggestedSellingPrice)
                                                            : (portfolioStats.usdt.avgBuy + parseAndEvaluate(suggestedProfitMargin));
                                                        setSellPrice(price.toFixed(2));
                                                        setProfitPercent((price - portfolioStats.usdt.avgBuy).toFixed(2));
                                                        // Update total if not manual
                                                        const qty = parseAndEvaluate(sellAmount);
                                                        if (!isTotalManual && qty > 0) {
                                                            setSellTotal((qty * price).toFixed(0));
                                                        }
                                                    }}
                                                >
                                                    <span className="text-yellow-500">{t('portfolio.suggestedPrice')} (+{(suggestedSellingPrice && parseFloat(suggestedSellingPrice) > 0 ? (parseFloat(suggestedSellingPrice) - portfolioStats.usdt.avgBuy).toFixed(2) : suggestedProfitMargin)} DA):</span>
                                                    <span className="font-bold text-yellow-500 underline decoration-dotted underline-offset-2">{(suggestedSellingPrice && parseFloat(suggestedSellingPrice) > 0 ? parseFloat(suggestedSellingPrice) : (portfolioStats.usdt.avgBuy + parseAndEvaluate(suggestedProfitMargin))).toFixed(2)} {t('common.dinar')}</span>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <Label>{t('transactions.sellPrice')} ({t('common.dinar')})</Label>
                                                    <NumberInput
                                                        value={sellPrice}
                                                        onChange={e => {
                                                            setSellPrice(e.target.value);
                                                            const price = parseAndEvaluate(e.target.value);
                                                            const qty = parseAndEvaluate(sellAmount);

                                                            // Update total when price changes ONLY IF NOT MANUAL
                                                            if (!isTotalManual && qty > 0 && price > 0) {
                                                                setSellTotal((qty * price).toFixed(0));
                                                            }

                                                            // Update margin when price changes
                                                            if (portfolioStats.usdt.avgBuy > 0 && price > 0) {
                                                                const margin = price - portfolioStats.usdt.avgBuy;
                                                                setProfitPercent(margin.toFixed(2));
                                                            }
                                                        }}
                                                        className={`${fieldBase} ${formValidation.errors['sellPrice'] ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                                                    />
                                                    {formValidation.errors['sellPrice'] && <p className="text-red-500 text-xs mt-1">{formValidation.errors['sellPrice']}</p>}
                                                </div>
                                                <div>
                                                    <Label>{t('portfolio.margin')} ({t('common.dinar')})</Label>
                                                    <NumberInput
                                                        value={profitPercent}
                                                        onChange={e => {
                                                            setProfitPercent(e.target.value);
                                                            const margin = parseAndEvaluate(e.target.value);
                                                            if (margin >= 0 && portfolioStats.usdt.avgBuy > 0) {
                                                                const newPrice = portfolioStats.usdt.avgBuy + margin;
                                                                setSellPrice(newPrice.toFixed(2));

                                                                // Update total based on new price ONLY IF NOT MANUAL
                                                                const qty = parseAndEvaluate(sellAmount);
                                                                if (!isTotalManual && qty > 0) {
                                                                    setSellTotal((qty * newPrice).toFixed(0));
                                                                }
                                                            }
                                                        }}
                                                        className={fieldBase}
                                                        placeholder="DZD"
                                                    />
                                                </div>
                                            </div>
                                            <ClientLinker
                                                {...{ linkedClientId, setLinkedClientId, openClientModal, clientsDzd, fieldBase, isDark, clientPaymentStatus, setClientPaymentStatus }}
                                                errorMessage={formValidation.errors['linkedClientId']}
                                                hasError={!!formValidation.errors['linkedClientId']}
                                            />
                                            <div><Label>{t('common.notesOptional')}</Label><Input value={notes} onChange={e => setNotes(e.target.value)} className={fieldBase} /></div>
                                        </>
                                    )}

                                    {/* CASE 3: Buy EUR (Standard) - REDESIGNED */}
                                    {mode === 'buy_eur' && (
                                        <div className="space-y-4">
                                            <div>
                                                <Label>{t('transactions.qtyEur')}</Label>
                                                <NumberInput
                                                    value={buyEurAmount}
                                                    onChange={e => {
                                                        setBuyEurAmount(e.target.value);
                                                        // Auto-calculate total when quantity changes ONLY IF NOT MANUAL
                                                        if (!isTotalManual) {
                                                            const qty = parseAndEvaluate(e.target.value);
                                                            const price = parseAndEvaluate(buyEurPrice);
                                                            if (qty > 0 && price > 0) {
                                                                setBuyEurTotal((qty * price).toFixed(0));
                                                            } else if (qty === 0 || e.target.value === '') {
                                                                setBuyEurTotal('');
                                                            }
                                                        }
                                                    }}
                                                    className={`${fieldBase} ${formValidation.errors['buyEurAmount'] ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                                                />
                                                {formValidation.errors['buyEurAmount'] && <p className="text-red-500 text-xs mt-1">{formValidation.errors['buyEurAmount']}</p>}
                                            </div>
                                            <div>
                                                <Label>{t('portfolio.buyPriceEur')} ({t('common.dinar')})</Label>
                                                <NumberInput
                                                    value={buyEurPrice}
                                                    onChange={e => {
                                                        setBuyEurPrice(e.target.value);
                                                        // Auto-calculate total when price changes ONLY IF NOT MANUAL
                                                        if (!isTotalManual) {
                                                            const qty = parseAndEvaluate(buyEurAmount);
                                                            const price = parseAndEvaluate(e.target.value);
                                                            if (qty > 0 && price > 0) {
                                                                setBuyEurTotal((qty * price).toFixed(0));
                                                            } else if (price === 0 || e.target.value === '') {
                                                                setBuyEurTotal('');
                                                            }
                                                        }
                                                    }}
                                                    className={`${fieldBase} ${formValidation.errors['buyEurPrice'] ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                                                />
                                                {formValidation.errors['buyEurPrice'] && <p className="text-red-500 text-xs mt-1">{formValidation.errors['buyEurPrice']}</p>}
                                                <p className={`text-xs mt-1 ${subtleText}`}>{t('transactions.basedOnPamEur')}</p>
                                            </div>
                                            <div>
                                                <Label>{t('transactions.totalAmount')} ({t('common.dinar')})</Label>
                                                <NumberInput
                                                    value={buyEurTotal}
                                                    onChange={e => {
                                                        const val = e.target.value;
                                                        setBuyEurTotal(val);
                                                        if (val) {
                                                            setIsTotalManual(true);
                                                            // Bidirectional: Calculate Quantity from Total
                                                            const total = parseAndEvaluate(val);
                                                            const price = parseAndEvaluate(buyEurPrice);
                                                            if (total > 0 && price > 0) {
                                                                setBuyEurAmount((total / price).toFixed(2));
                                                            }
                                                        } else {
                                                            setIsTotalManual(false);
                                                            // Immediate auto-calc when cleared
                                                            const qty = parseAndEvaluate(buyEurAmount);
                                                            const price = parseAndEvaluate(buyEurPrice);
                                                            if (qty > 0 && price > 0) setBuyEurTotal((qty * price).toFixed(0));
                                                        }
                                                    }}
                                                    onBlur={() => {
                                                        const total = parseAndEvaluate(buyEurTotal);
                                                        if (!isNaN(total) && total > 0) {
                                                            setBuyEurTotal(Math.round(total).toString());
                                                        }
                                                    }}
                                                    className={`${fieldBase} ${formValidation.errors['buyEurTotal'] ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                                                    placeholder={t('transactions.autoCalc')}
                                                />
                                                {formValidation.errors['buyEurTotal'] && <p className="text-red-500 text-xs mt-1">{formValidation.errors['buyEurTotal']}</p>}
                                                <p className={`text-xs mt-1 ${subtleText}`}>{t('transactions.autoCalc')}</p>
                                            </div>
                                            <ClientLinker
                                                {...{ linkedClientId, setLinkedClientId, openClientModal, clientsDzd, fieldBase, isDark, clientPaymentStatus, setClientPaymentStatus }}
                                                errorMessage={formValidation.errors['linkedClientId']}
                                                hasError={!!formValidation.errors['linkedClientId']}
                                            />
                                            <div>
                                                <Label>{t('common.notesOptional')}</Label>
                                                <Input value={notes} onChange={e => setNotes(e.target.value)} className={fieldBase} />
                                            </div>
                                        </div>
                                    )}

                                    {/* CASE 4: Buy USDT (Standard) */}
                                    {mode === 'buy_usdt' && !buyUsdtMode && (
                                        <div className="space-y-4">
                                            <div>
                                                <Label>{t('transactions.qtyUsdt')}</Label>
                                                <NumberInput value={buyUsdtAmount} onChange={e => setBuyUsdtAmount(e.target.value)} className={fieldBase} />
                                            </div>
                                            <div>
                                                <Label>{t('transactions.buyPrice')} ({t('common.dinar')})</Label>
                                                <NumberInput value={buyUsdtPrice} onChange={e => setBuyUsdtPrice(e.target.value)} className={fieldBase} />
                                            </div>
                                            <ClientLinker {...{ linkedClientId, setLinkedClientId, openClientModal, clientsDzd, fieldBase, isDark, clientPaymentStatus, setClientPaymentStatus }} />
                                            <div>
                                                <Label>{t('common.notesOptional')}</Label>
                                                <Input value={notes} onChange={e => setNotes(e.target.value)} className={fieldBase} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                    {/* Validation Alert */}
                    {!formValidation.isValid && (
                        <div className="mx-6 mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                                <span className="text-red-500 font-bold">!</span>
                            </div>
                            <p className="text-sm text-red-500 font-medium">
                                {t('common.fillAllFields') || "Veuillez remplir correctement tous les champs obligatoires."}
                            </p>
                        </div>
                    )}
                </DialogContent>
                <DialogFooter>
                    {(mode !== 'buy_usdt' || buyUsdtMode) && (
                        <div className="flex gap-3 w-full">
                            <Button onClick={closeForm} className={`flex-1 ${isDark ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-200 hover:bg-slate-300'} text-slate-800 dark:text-slate-200 py-3 rounded-xl font-bold`}>{t('common.cancel')}</Button>
                            <Button
                                onClick={mode?.startsWith('buy') ? handleBuy : handleSell}
                                disabled={!formValidation.isValid || isSaving}
                                className={`flex-1 py-3 rounded-xl font-bold text-white shadow-lg shadow-blue-500/20 transition-all ${!formValidation.isValid || isSaving ? 'bg-slate-400 cursor-not-allowed opacity-70' : 'bg-blue-600 hover:bg-blue-700 hover:shadow-blue-500/40 hover:-translate-y-0.5'}`}
                            >
                                {isSaving ? (
                                    <div className="flex items-center justify-center gap-2">
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>{t('common.processing')}</span>
                                    </div>
                                ) : (
                                    t('transactions.confirm')
                                )}
                            </Button>
                        </div>
                    )}
                </DialogFooter>
            </Dialog>

            <Dialog isOpen={txToDelete !== null} onClose={() => setTxToDelete(null)} className={cardBase}>
                <DialogHeader isDark={isDark}><DialogTitle>{t('transactions.deleteTransaction')}</DialogTitle></DialogHeader>
                <DialogContent className="p-6">
                    <p className="text-sm opacity-80">{t('transactions.confirmDeleteTx')}</p>
                    <p className="text-xs text-red-500 font-bold mt-2">{t('transactions.irreversibleAction')}</p>
                </DialogContent>
                <DialogFooter>
                    <Button onClick={() => setTxToDelete(null)} className={`w-full ${isDark ? 'bg-slate-700' : 'bg-slate-200'} mb-2`}>{t('common.cancel')}</Button>
                    <Button onClick={handleDeleteConfirm} className="bg-red-600 text-white w-full font-bold py-3 rounded-xl">{t('common.delete')}</Button>
                </DialogFooter>
            </Dialog>
            <Dialog isOpen={clientTxToDelete !== null} onClose={() => setClientTxToDelete(null)} className={cardBase}>
                <DialogHeader isDark={isDark}><DialogTitle>{t('transactions.deleteTransaction')}</DialogTitle></DialogHeader>
                <DialogContent className="p-6">
                    <p className="text-sm opacity-80">{t('transactions.confirmDeleteTx')}</p>
                    <p className="text-xs text-red-500 font-bold mt-2">{t('transactions.irreversibleAction')}</p>
                </DialogContent>
                <DialogFooter>
                    <Button onClick={() => setClientTxToDelete(null)} className={`w-full ${isDark ? 'bg-slate-700' : 'bg-slate-200'} mb-2`}>{t('common.cancel')}</Button>
                    <Button onClick={handleDeleteClientTxConfirm} className="bg-red-600 text-white w-full font-bold py-3 rounded-xl">{t('common.delete')}</Button>
                </DialogFooter>
            </Dialog>
            <Dialog isOpen={isClientModalOpen} onClose={() => setIsClientModalOpen(false)} className={`${cardBase} max-w-md`}>
                <DialogHeader onClose={() => setIsClientModalOpen(false)} isDark={isDark}><DialogTitle>{editingClient ? t('transactions.editClient') : t('transactions.newClient')}</DialogTitle></DialogHeader>
                <DialogContent className="px-6 pb-6 space-y-4">
                    <div><Label>{t('transactions.fullName')}</Label><Input value={clientFullName} onChange={e => setClientFullName(e.target.value)} className={fieldBase} /></div>
                    <div><Label>{t('transactions.phone')}</Label><Input value={clientPhone} onChange={e => setClientPhone(e.target.value)} className={fieldBase} /></div>
                    <div><Label>RedotPay ID</Label><Input value={clientRedotpayId} onChange={e => setClientRedotpayId(e.target.value)} className={fieldBase} /></div>
                    <div><Label>Binance Email</Label><Input value={clientBinanceEmail} onChange={e => setClientBinanceEmail(e.target.value)} className={fieldBase} /></div>

                    {!editingClient && <div><Label>{t('transactions.initialBalance')} ({t('common.dinar')})</Label><NumberInput value={initialBalance} onChange={e => setInitialBalance(e.target.value)} className={fieldBase} placeholder="0.00" /></div>}
                </DialogContent>
                <DialogFooter><Button onClick={handleSaveClient} className="w-full bg-green-600 text-white font-bold py-3 rounded-xl">{t('common.save')}</Button></DialogFooter>
            </Dialog>

            <Dialog isOpen={clientToDelete !== null} onClose={() => setClientToDelete(null)} className={cardBase}>
                <DialogHeader isDark={isDark}><DialogTitle>{t('common.confirmDelete')}</DialogTitle></DialogHeader>
                <DialogContent className="p-6">
                    <p className="text-sm opacity-80">{t('transactions.confirmDeleteClient')}</p>
                    <p className="text-xs text-red-500 font-bold mt-2">{t('transactions.irreversibleAction')}</p>
                </DialogContent>
                <DialogFooter>
                    <Button onClick={() => setClientToDelete(null)} className={`w-full ${isDark ? 'bg-slate-700' : 'bg-slate-200'} mb-2`}>{t('common.cancel')}</Button>
                    <Button onClick={handleDeleteClient} className="w-full bg-red-600 text-white font-bold py-3 rounded-xl">{t('transactions.confirmDelete')}</Button>
                </DialogFooter>
            </Dialog>

            <Dialog isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} className={`${cardBase} max-w-sm`}>
                <DialogHeader onClose={() => setIsSettingsModalOpen(false)} isDark={isDark}><DialogTitle>{t('common.settings')}</DialogTitle></DialogHeader>
                <DialogContent className="px-6 pb-6 space-y-4">
                    <div>
                        <Label>{t('portfolio.margin')} ({t('common.dinar')})</Label>
                        <div className="relative">
                            <NumberInput
                                value={suggestedProfitMargin}
                                onChange={e => {
                                    const newMargin = e.target.value;
                                    setSuggestedProfitMargin(newMargin);

                                    // Update selling price based on margin (with 2 decimal precision)
                                    const marginNum = parseFloat(newMargin) || 0;
                                    const avgBuyPrice = portfolioStats.usdt.avgBuy || 0;
                                    const newSellingPrice = avgBuyPrice + marginNum;
                                    // FIX: Round to 2 decimals
                                    setSuggestedSellingPrice(newSellingPrice > 0 ? parseFloat(newSellingPrice.toFixed(2)).toString() : '');
                                }}
                                className={`${fieldBase} text-center text-2xl font-bold`}
                                placeholder="2.00"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">{t('common.dinar')}</span>
                        </div>
                        <p className={`text-xs mt-2 ${subtleText}`}>Cette marge est utilisée pour calculer le prix de vente suggéré.</p>
                    </div>

                    <div>
                        <Label>{t('transactions.sellPrice')} ({t('common.dinar')})</Label>
                        <div className="relative">
                            <NumberInput
                                value={suggestedSellingPrice}
                                onChange={e => {
                                    const newSellingPrice = e.target.value;
                                    setSuggestedSellingPrice(newSellingPrice);

                                    // Update margin based on selling price (with 2 decimal precision)
                                    const sellingPriceNum = parseFloat(newSellingPrice) || 0;
                                    const avgBuyPrice = portfolioStats.usdt.avgBuy || 0;
                                    const newMargin = sellingPriceNum - avgBuyPrice;
                                    // FIX: Round to 2 decimals
                                    setSuggestedProfitMargin(newMargin >= 0 ? parseFloat(newMargin.toFixed(2)).toString() : '0');
                                }}
                                className={`${fieldBase} text-center text-2xl font-bold`}
                                placeholder="0.00"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">{t('common.dinar')}</span>
                        </div>
                        <p className={`text-xs mt-2 ${subtleText}`}>
                            {t('portfolio.avgBuyPriceUsdt')}: {(portfolioStats.usdt.avgBuy || 0).toFixed(2)} {t('common.dinar')}
                        </p>
                    </div>

                    <div className="pt-4 border-t border-red-200 dark:border-red-900/30">
                        <Label className="text-red-500">{t('common.dangerZone')}</Label>
                        <p className={`text-xs mb-3 ${subtleText}`}>{t('common.deleteAllData')}</p>
                        <Button
                            onClick={() => { setIsSettingsModalOpen(false); setIsResetModalOpen(true); }}
                            className="w-full bg-red-100 hover:bg-red-200 text-red-600 dark:bg-red-900/20 dark:hover:bg-red-900/40 dark:text-red-400 font-bold py-3 rounded-xl border border-red-200 dark:border-red-900/50"
                        >
                            {t('common.resetApp')}
                        </Button>
                    </div>
                </DialogContent>
                <DialogFooter>
                    <Button
                        onClick={async () => {
                            // Save to Firestore with 2 decimal precision
                            try {
                                const marginToSave = parseFloat(parseFloat(suggestedProfitMargin).toFixed(2)) || 2;
                                const sellPriceToSave = parseFloat(parseFloat(suggestedSellingPrice).toFixed(2)) || 0;

                                console.log('Saving settings:', { marginToSave, sellPriceToSave });

                                // Use set with merge=true to create document if it doesn't exist
                                await userDocRef.set({
                                    suggestedProfitMargin: marginToSave,
                                    suggestedSellingPrice: sellPriceToSave,
                                    settingsUpdatedAt: Date.now()
                                }, { merge: true });

                                console.log('Settings saved successfully');
                                setAlert('✅ ' + t('common.settingsSaved'));
                                setIsSettingsModalOpen(false);
                            } catch (e: any) {
                                console.error('Error saving settings:', e);
                                console.error('Error details:', e.message, e.code);
                                setAlert('❌ ' + t('common.error') + ': ' + (e.message || 'Erreur inconnue'));
                            }
                        }}
                        className="w-full bg-sky-600 hover:bg-sky-700 text-white font-bold py-3 rounded-xl"
                    >
                        {t('common.save')}
                    </Button>
                </DialogFooter>
            </Dialog>

            {/* RESET CONFIRMATION MODAL */}
            <Dialog isOpen={isResetModalOpen} onClose={() => setIsResetModalOpen(false)} className={cardBase}>
                <DialogHeader isDark={isDark}><DialogTitle>{t('common.resetConfirmTitle')}</DialogTitle></DialogHeader>
                <DialogContent className="p-6">
                    <p className="text-red-500 font-bold mb-2">{t('common.resetWarning')}</p>
                    <p>{t('common.resetConfirmBody')}</p>
                    <p className="mt-2">{t('common.areYouSure')}</p>
                </DialogContent>
                <DialogFooter>
                    <Button onClick={() => setIsResetModalOpen(false)} className={`w-full ${isDark ? 'bg-slate-700' : 'bg-slate-200'} mb-2`}>{t('common.cancel')}</Button>
                    <Button onClick={handleGlobalReset} className="w-full bg-red-600 text-white font-bold py-3 rounded-xl">{t('common.resetYes')}</Button>
                </DialogFooter>
            </Dialog>

            {/* NEW: CREATE MANUAL ASSET MODAL */}
            <Dialog isOpen={isCreateAssetModalOpen} onClose={() => setIsCreateAssetModalOpen(false)} className={`${cardBase} max-w-md`}>
                <DialogHeader onClose={() => setIsCreateAssetModalOpen(false)} isDark={isDark}>
                    <DialogTitle>{t('transactions.newManualAsset')}</DialogTitle>
                </DialogHeader>
                <DialogContent className="px-6 pb-6 space-y-4">
                    <div>
                        <Label>{t('transactions.assetName')}</Label>
                        <Input value={newAssetName} onChange={e => setNewAssetName(e.target.value)} className={fieldBase} placeholder="Ex: Impression, Conception..." />
                    </div>
                    <div>
                        <Label>{t('transactions.descriptionOptional')}</Label>
                        <Input value={newAssetDescription} onChange={e => setNewAssetDescription(e.target.value)} className={fieldBase} />
                    </div>
                </DialogContent>
                <DialogFooter>
                    <Button onClick={() => {
                        handleCreateAsset();
                    }} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl">{t('transactions.create')}</Button>
                </DialogFooter>
            </Dialog>

            {/* TREASURY CARD MODAL */}
            <Dialog isOpen={isTreasuryCardModalOpen} onClose={() => setIsTreasuryCardModalOpen(false)} className={`${cardBase} max-w-sm`}>
                <DialogHeader onClose={() => setIsTreasuryCardModalOpen(false)} isDark={isDark}><DialogTitle>{editingTreasuryCard ? t('transactions.editCard') : t('transactions.addCard')}</DialogTitle></DialogHeader>
                <DialogContent className="px-6 pb-6 space-y-4">
                    <div><Label>{t('transactions.cardNameSource')}</Label><Input value={treasuryCardName} onChange={e => setTreasuryCardName(e.target.value)} className={fieldBase} placeholder="Ex: Coffre Fort" /></div>
                    <div><Label>{t('transactions.valueDzd')}</Label><NumberInput value={treasuryCardValue} onChange={e => setTreasuryCardValue(e.target.value)} className={fieldBase} placeholder="0.00" /></div>
                </DialogContent>
                <DialogFooter><Button onClick={handleSaveTreasuryCard} disabled={isSaving} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl">{isSaving ? t('common.saving') : (editingTreasuryCard ? t('transactions.update') : t('transactions.add'))}</Button></DialogFooter>
            </Dialog>

            {/* DELETE TREASURY CARD CONFIRMATION */}
            <Dialog isOpen={treasuryCardToDelete !== null} onClose={() => setTreasuryCardToDelete(null)} className={cardBase}>
                <DialogHeader isDark={isDark}><DialogTitle>{t('common.confirmDelete')}</DialogTitle></DialogHeader>
                <DialogContent className="p-6">
                    <p className="text-sm opacity-80">{t('common.areYouSure')}</p>
                    <p className="text-xs text-red-500 font-bold mt-2">{t('transactions.irreversibleAction')}</p>
                </DialogContent>
                <DialogFooter>
                    <Button onClick={() => setTreasuryCardToDelete(null)} className={`w-full ${isDark ? 'bg-slate-700' : 'bg-slate-200'} mb-2`}>{t('common.cancel')}</Button>
                    <Button onClick={handleDeleteTreasuryCard} disabled={isSaving} className="bg-red-600 text-white w-full font-bold py-3 rounded-xl">{isSaving ? t('common.deleting') : t('common.delete')}</Button>
                </DialogFooter>
            </Dialog>

            <Dialog isOpen={treasuryTxToDelete !== null} onClose={() => setTreasuryTxToDelete(null)} className={cardBase}>
                <DialogHeader isDark={isDark}><DialogTitle>{t('transactions.deleteTransaction')}</DialogTitle></DialogHeader>
                <DialogContent className="p-6">
                    <p className="text-sm opacity-80">{t('transactions.confirmDeleteTx')}</p>
                    <p className="text-xs text-red-500 font-bold mt-2">{t('transactions.irreversibleAction')}</p>
                </DialogContent>
                <DialogFooter>
                    <Button onClick={() => setTreasuryTxToDelete(null)} className={`w-full ${isDark ? 'bg-slate-700' : 'bg-slate-200'} mb-2`}>{t('common.cancel')}</Button>
                    <Button onClick={handleDeleteTreasuryTxConfirm} className="bg-red-600 text-white w-full font-bold py-3 rounded-xl">{t('common.delete')}</Button>
                </DialogFooter>
            </Dialog>

            {/* CLIENT SUMMARY MODAL */}
            {/* CLIENT SUMMARY MODAL */}
            <Dialog isOpen={summaryClient !== null} onClose={() => setSummaryClient(null)} className={`${cardBase} max-w-md`}>
                <DialogHeader onClose={() => setSummaryClient(null)} isDark={isDark}>
                    <DialogTitle>{t('transactions.clientDetails')}</DialogTitle>
                </DialogHeader>
                <DialogContent className="px-6 pb-6 space-y-4">
                    {summaryClient && (() => {
                        const bal = clientBalances.get(summaryClient.id) || 0;
                        const lastTxs = clientTransactionsDzd
                            .filter(t => t.clientId === summaryClient.id)
                            .sort((a, b) => b.timestamp - a.timestamp)
                            .slice(0, 5);

                        const getTxDetails = (tx: ClientTransactionDzd) => {
                            let type: string = tx.type;
                            let details = '';
                            let method = tx.paymentMethod || '';

                            if (tx.linkedTxId) {
                                const linked = transactions.find(t => t.id === tx.linkedTxId);
                                if (linked) {
                                    if (linked.type === 'sell') {
                                        type = t('transactions.sellUsdt');
                                        details = `${linked.quantity} USDT @ ${linked.sell} ${t('common.dinar')}`;
                                    } else if (linked.type === 'buy') {
                                        type = `${t('transactions.buy')} ${linked.currency}`;
                                        details = `${linked.quantity} ${linked.currency} @ ${linked.price} ${t('common.dinar')}`;
                                    }
                                }
                            } else if (tx.type.includes('Transfert')) {
                                details = tx.notes || '';
                            }

                            return { type, details, method, notes: tx.notes };
                        };

                        const handleShare = async () => {
                            const modalContent = document.querySelector('[data-client-summary]');
                            if (!modalContent) { setAlert('❌ ' + t('common.error')); return; }

                            try {
                                // Feedback that it started
                                // setAlert('⏳ ' + t('common.generatingImage')); 

                                // Wait a tiny bit to ensure rendering
                                await new Promise(resolve => setTimeout(resolve, 500));

                                const { toBlob } = await import('html-to-image');
                                const blob = await toBlob(modalContent as HTMLElement, {
                                    backgroundColor: isDark ? '#111827' : '#ffffff',
                                    style: {
                                        transform: 'scale(1)', // reset legacy transforms if any
                                    }
                                });

                                if (!blob) { setAlert('❌ ' + t('common.error')); return; }

                                const file = new File([blob], `releve_${summaryClient.phone || 'client'}.png`, { type: 'image/png' });

                                // Helper to check if sharing files is supported
                                if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                                    try {
                                        await navigator.share({
                                            files: [file],
                                            title: t('transactions.clientStatement'),
                                            text: `${t('transactions.statementOf')} ${getClientFullName(summaryClient)}`
                                        });
                                        // Success
                                    } catch (e: any) {
                                        console.error("Share failed", e);
                                        // Don't error alert if user just cancelled
                                        if (e.name !== 'AbortError') {
                                            setAlert('❌ ' + t('transactions.shareCancelled'));
                                        }
                                    }
                                } else {
                                    // Fallback: download image
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `releve_${summaryClient.phone || 'client'}.png`;
                                    document.body.appendChild(a);
                                    a.click();
                                    document.body.removeChild(a);
                                    URL.revokeObjectURL(url);
                                    setAlert('✅ ' + t('transactions.imageDownloaded'));
                                }
                            } catch (e: any) {
                                console.error(e);
                                setAlert('❌ ' + t('transactions.captureError') + (e.message ? `: ${e.message}` : ''));
                            }
                        };

                        return (
                            <div data-client-summary>
                                <div className="space-y-5">
                                    <div className={`text-center p-4 rounded-2xl ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                        <h3 className="text-xl font-bold mb-1">{getClientFullName(summaryClient)}</h3>
                                        <p className={`text-sm ${subtleText} mb-3`}>{summaryClient.phone || t('transactions.noPhone')}</p>
                                        <div className="flex flex-col items-center justify-center">
                                            <span className={`text-xs uppercase tracking-wider font-semibold ${subtleText}`}>{t('transactions.currentBalance')}</span>
                                            <span className={`text-3xl font-bold ${bal >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                {bal.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-lg text-gray-400">{t('common.dinar')}</span>
                                            </span>
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="font-bold mb-3 text-sm uppercase tracking-wider opacity-70 flex items-center gap-2">
                                            <RefreshCwIcon className="w-4 h-4" /> {t('transactions.recentTransactions')}
                                        </h4>
                                        <div className={`rounded-xl overflow-hidden border ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                                            {lastTxs.length > 0 ? (
                                                <div className="divide-y" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
                                                    {lastTxs.map(tx => {
                                                        const { type, details, method } = getTxDetails(tx);
                                                        return (
                                                            <div key={tx.id} className={`p-3.5 ${isDark ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
                                                                <div className="flex justify-between items-start mb-1">
                                                                    <div className="font-bold text-sm">{type}</div>
                                                                    <div className={`font-bold text-sm ${tx.montant > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                                        {tx.montant > 0 ? '+' : ''}{tx.montant.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DZD
                                                                    </div>
                                                                </div>
                                                                <div className="space-y-0.5 text-xs">
                                                                    {details && <div className={isDark ? 'text-gray-300' : 'text-gray-700'}>{details}</div>}
                                                                    <div className={subtleText}>{tx.date} à {tx.time}</div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <p className="p-6 text-center text-sm opacity-50">{t('transactions.noRecentTransactions')}</p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex gap-3 pt-2">
                                        <Button onClick={() => setSummaryClient(null)} className={`flex-1 py-3 rounded-xl font-semibold ${isDark ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-200 hover:bg-slate-300'}`}>{t('transactions.close')}</Button>
                                        <Button onClick={handleShare} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20">
                                            <ShareIcon className="w-4 h-4" /> {t('transactions.send')}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </DialogContent>
            </Dialog>

            {/* INVESTOR CREATION / EDIT MODAL */}
            <Dialog isOpen={isInvestorModalOpen} onClose={() => setIsInvestorModalOpen(false)} className={`${cardBase} max-w-md`}>
                <DialogHeader onClose={() => setIsInvestorModalOpen(false)} isDark={isDark}>
                    <DialogTitle>{editingInvestor ? "Modifier Investisseur" : "Nouvel Investisseur"}</DialogTitle>
                </DialogHeader>
                <DialogContent className="px-6 pb-6 space-y-4">
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        handleSaveInvestor();
                    }}>
                        <div>
                            <Label>Nom Complet</Label>
                            <Input value={investorName} onChange={e => setInvestorName(e.target.value)} className={fieldBase} placeholder="Nom de l'investisseur" required />
                        </div>
                        {!editingInvestor && (
                            <div>
                                <Label>Capital Initial (DZD)</Label>
                                <NumberInput value={investorInitialCapital} onChange={e => setInvestorInitialCapital(e.target.value)} className={fieldBase} placeholder="0.00" />
                            </div>
                        )}
                        {/* Share Percentage Removed - Auto Calculated */}
                        <div>
                            <Label>Notes (Optionnel)</Label>
                            <Input value={investorNotes} onChange={e => setInvestorNotes(e.target.value)} className={fieldBase} placeholder="Notes..." />
                        </div>

                        <div className="flex items-center gap-2 mt-4 p-3 rounded-lg border border-indigo-100 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-900/10">
                            <input
                                type="checkbox"
                                id="isManager"
                                checked={isManager}
                                onChange={e => setIsManager(e.target.checked)}
                                className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                            />
                            <label htmlFor="isManager" className="text-sm font-medium cursor-pointer select-none">
                                Cet investisseur est le Gérant
                            </label>
                        </div>

                        <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl mt-4">
                            {editingInvestor ? "Mettre à jour" : "Créer Investisseur"}
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>

            {/* INVESTOR TRANSACTION MODAL */}
            {(() => {
                const selectedInv = derivedInvestors.find(i => i.id === selectedInvestorId);
                let availableProfit = 0;
                let showAvailability = false;

                if (isInvestorTxModalOpen && selectedInv && investorTxType === 'withdraw_profit') {
                    showAvailability = true;
                    availableProfit = selectedInv.availableProfit || 0;
                }

                return (
                    <Dialog isOpen={isInvestorTxModalOpen} onClose={() => setIsInvestorTxModalOpen(false)} className={`${cardBase} max-w-md`}>
                        <DialogHeader onClose={() => setIsInvestorTxModalOpen(false)} isDark={isDark}>
                            <DialogTitle>
                                {investorTxType === 'deposit_capital' ? 'Dépôt Capital' :
                                    investorTxType === 'withdraw_capital' ? 'Retrait Capital' :
                                        investorTxType === 'profit_distribution' ? 'Distribution Profit' : 'Retrait Profit'}
                            </DialogTitle>
                        </DialogHeader>
                        <DialogContent className="px-6 pb-6 space-y-4">
                            <div>
                                <Label>Montant (DZD)</Label>
                                <NumberInput value={investorTxAmount} onChange={e => setInvestorTxAmount(e.target.value)} className={fieldBase} placeholder="0.00" />
                                {showAvailability && (
                                    <div className={`text-xs mt-1 text-right ${availableProfit > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                        Disponible: {availableProfit.toLocaleString('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DZD
                                    </div>
                                )}
                            </div>
                            <div>
                                <Label>Notes</Label>
                                <Input value={investorTxNotes} onChange={e => setInvestorTxNotes(e.target.value)} className={fieldBase} />
                            </div>
                        </DialogContent>
                        <DialogFooter>
                            <Button
                                onClick={handleInvestorTransaction}
                                disabled={showAvailability && availableProfit <= 0}
                                className={`w-full text-white font-bold py-3 rounded-xl ${showAvailability && availableProfit <= 0 ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                            >
                                Confirmer
                            </Button>
                        </DialogFooter>
                    </Dialog>
                );
            })()}

            {/* INVESTOR DELETE CONFIRMATION */}
            <Dialog isOpen={investorToDelete !== null} onClose={() => setInvestorToDelete(null)} className={cardBase}>
                <DialogHeader isDark={isDark}><DialogTitle>{t('common.confirmDelete')}</DialogTitle></DialogHeader>
                <DialogContent className="p-6">
                    <p className="text-sm opacity-80">Êtes-vous sûr de vouloir supprimer cet investisseur ?</p>
                    <p className="text-xs text-red-500 font-bold mt-2">Cette action est irréversible.</p>
                </DialogContent>
                <DialogFooter>
                    <Button onClick={() => setInvestorToDelete(null)} className={`w-full ${isDark ? 'bg-slate-700' : 'bg-slate-200'} mb-2`}>{t('common.cancel')}</Button>
                    <Button onClick={() => handleDeleteInvestor(investorToDelete?.id)} className="bg-red-600 text-white w-full font-bold py-3 rounded-xl">{t('common.delete')}</Button>
                </DialogFooter>
            </Dialog>

            {/* INVESTOR TRANSACTION DELETE CONFIRMATION */}
            <Dialog isOpen={investorTxToDelete !== null} onClose={() => setInvestorTxToDelete(null)} className={cardBase}>
                <DialogHeader isDark={isDark}><DialogTitle>{t('common.confirmDelete')}</DialogTitle></DialogHeader>
                <DialogContent className="p-6">
                    <p className="text-sm opacity-80">Êtes-vous sûr de vouloir supprimer cette transaction ?</p>
                </DialogContent>
                <DialogFooter>
                    <Button onClick={() => setInvestorTxToDelete(null)} className={`w-full ${isDark ? 'bg-slate-700' : 'bg-slate-200'} mb-2`}>{t('common.cancel')}</Button>
                    <Button onClick={handleDeleteInvestorTx} className="bg-red-600 text-white w-full font-bold py-3 rounded-xl">{t('common.delete')}</Button>
                </DialogFooter>
            </Dialog>

            {/* REINVEST PROFIT MODAL */}
            {isReinvestModalOpen && (
                <Dialog isOpen={isReinvestModalOpen} onClose={() => setIsReinvestModalOpen(false)} className={`${cardBase} max-w-md`}>
                    <DialogHeader onClose={() => setIsReinvestModalOpen(false)} isDark={isDark}>
                        <DialogTitle>Réinvestir les bénéfices</DialogTitle>
                    </DialogHeader>
                    <DialogContent className="px-6 pb-6 space-y-4">
                        <div>
                            <Label>Montant à réinvestir (DZD)</Label>
                            <NumberInput
                                value={reinvestInput}
                                onChange={e => setReinvestInput(e.target.value)}
                                className={`${fieldBase} text-xl font-bold text-center h-14`}
                                placeholder="0.00"
                            />
                            <div className="flex justify-between items-center mt-2 px-1">
                                <span className={`text-xs ${subtleText}`}>Disponible:</span>
                                <span className="text-xs font-bold text-indigo-500">
                                    {(derivedInvestors.find(i => i.id === selectedInvestorId)?.availableProfit || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DZD
                                </span>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-4">
                            <button
                                onClick={() => {
                                    const avail = derivedInvestors.find(i => i.id === selectedInvestorId)?.availableProfit || 0;
                                    setReinvestInput(avail.toFixed(2));
                                }}
                                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${isDark ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'bg-indigo-50 text-indigo-700 border border-indigo-200'}`}
                            >
                                Tout Réinvestir
                            </button>
                            <button
                                onClick={() => {
                                    const avail = (derivedInvestors.find(i => i.id === selectedInvestorId)?.availableProfit || 0) / 2;
                                    setReinvestInput(avail.toFixed(2));
                                }}
                                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${isDark ? 'bg-slate-800 text-slate-300 border border-slate-700' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}
                            >
                                Moitié (50%)
                            </button>
                        </div>
                    </DialogContent>
                    <DialogFooter>
                        <div className="flex gap-3 w-full">
                            <Button onClick={() => setIsReinvestModalOpen(false)} className={`flex-1 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>Annuler</Button>
                            <Button
                                onClick={() => {
                                    const amt = parseFloat(reinvestInput);
                                    if (!isNaN(amt) && amt > 0) {
                                        handleReinvestProfit(selectedInvestorId!, amt);
                                        setIsReinvestModalOpen(false);
                                    } else {
                                        setAlert("⚠️ Montant invalide.");
                                    }
                                }}
                                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                            >
                                Confirmer
                            </Button>
                        </div>
                    </DialogFooter>
                </Dialog>
            )}

        </div>
    );
}



