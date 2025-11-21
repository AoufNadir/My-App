
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardHeader, CardContent } from './components/ui/Card';
import { Label } from './components/ui/Label';
import { Input } from './components/ui/Input';
import { Button } from './components/ui/Button';
import { Alert, AlertDescription } from './components/ui/Alert';
import { Select } from './components/ui/Select';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './components/ui/Dialog';

import { Tx, ClientDzd, ClientTransactionDzd, TreasuryTx, TreasuryCard } from './types';
import { MONTHS_FR } from './constants';

import { AlertTriangleIcon } from './components/icons/AlertTriangleIcon';
import { Trash2Icon } from './components/icons/Trash2Icon';
import { ArrowDownIcon } from './components/icons/ArrowDownIcon';
import { ArrowUpIcon } from './components/icons/ArrowUpIcon';
import { UserIcon } from './components/icons/UserIcon';
import { PlusCircleIcon } from './components/icons/PlusCircleIcon';
import { WalletIcon } from './components/icons/WalletIcon';
import { UsersIcon } from './components/icons/UsersIcon';
import { LogOutIcon } from './components/icons/LogOutIcon';
import { BriefcaseIcon } from './components/icons/BriefcaseIcon';
import { MenuIcon } from './components/icons/MenuIcon';
import { XIcon } from './components/icons/XIcon';
import { Auth } from './components/Auth';
import { PlusIcon } from './components/icons/PlusIcon';
import { MinusIcon } from './components/icons/MinusIcon';
import { DownloadCloudIcon } from './components/icons/DownloadCloudIcon';
import { SunIcon } from './components/icons/SunIcon';
import { MoonIcon } from './components/icons/MoonIcon';
import { CopyIcon } from './components/icons/CopyIcon';
import { CheckIcon } from './components/icons/CheckIcon';
import { CameraIcon } from './components/icons/CameraIcon';
import { ArrowRightLeftIcon } from './components/icons/ArrowRightLeftIcon';
import { ShareIcon } from './components/icons/ShareIcon';
import { LandmarkIcon } from './components/icons/LandmarkIcon';
import { RefreshCwIcon } from './components/icons/RefreshCwIcon';
import { RotateCcwIcon } from './components/icons/RotateCcwIcon';

// Page Components
import { TransactionsPage } from './pages/TransactionsPage';
import { PortfolioPage } from './pages/PortfolioPage';
import { ClientsPage } from './pages/ClientsPage';
import { TresoreriePage } from './pages/TresoreriePage';
import { NumberInput } from './components/ui/NumberInput';
import { ReportModal } from './components/ReportModal';

import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';

const MotionDiv = motion.div;

declare const html2canvas: any;

// ===== FIREBASE SETUP =====
const firebaseConfig = {
    apiKey: "AIzaSyBQuc1tL9mt7aG4bMWTbixw_c3aw_tgINQ",
    authDomain: "proodigital-7ec70.firebaseapp.com",
    projectId: "proodigital-7ec70",
    storageBucket: "proodigital-7ec70.firebasestorage.app",
    messagingSenderId: "581545185473",
    appId: "1:581545185473:web:6df6b106d9ce80a89ec440"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();
const auth = firebase.auth();


export default function App() {
    const [user, setUser] = useState<firebase.User | null>(null);
    const [authLoading, setAuthLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((user: firebase.User | null) => {
            setUser(user);
            setAuthLoading(false);
        });
        return () => unsubscribe();
    }, []);

    if (authLoading) {
        const isDark = document.documentElement.classList.contains('dark');
        const bgApp = isDark ? 'from-[#0B1120] via-[#0F172A] to-[#1E293B] text-gray-100' : 'from-[#F8FAFC] via-[#F1F5F9] to-[#E2E8F0] text-gray-900';
        return (
            <div className={`min-h-screen bg-gradient-to-br ${bgApp} flex items-center justify-center text-lg font-semibold`}>
                Chargement de l'application...
            </div>
        );
    }

    if (!user) {
        return <Auth />;
    }

    return <MainApp user={user} />;
}

function MainApp({ user }: { user: firebase.User }) {
    // ===== THEME =====
    const [theme, setTheme] = useState<'dark' | 'light'>(() => {
        const savedTheme = localStorage.getItem('usdt_theme');
        return (savedTheme === 'light' || savedTheme === 'dark') ? savedTheme : 'dark';
    });
    const isDark = theme === 'dark';

    useEffect(() => {
        localStorage.setItem('usdt_theme', theme);
        if (isDark) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [theme, isDark]);

    // ===== PWA INSTALL PROMPT =====
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

    // ===== USER-SPECIFIC DATABASE REFERENCE =====
    const userDocRef = useMemo(() => db.collection('users').doc(user.uid), [user.uid]);

    // ===== DATA =====
    const [transactions, setTransactions] = useState<Tx[]>([]);
    useEffect(() => {
        const unsubscribe = userDocRef.collection('usdt_txs').orderBy('timestamp', 'asc').onSnapshot((snapshot: firebase.firestore.QuerySnapshot) => {
            const txsData = snapshot.docs.map((doc) => {
                const data = doc.data();
                const newDoc: any = { id: doc.id, ...data };
                if (newDoc.usd !== undefined) { newDoc.quantity = newDoc.usd; delete newDoc.usd; }
                if (!newDoc.currency) { newDoc.currency = 'USDT'; }
                return newDoc;
            }) as Tx[];
            setTransactions(txsData);
        });
        return () => unsubscribe();
    }, [userDocRef]);

    // ... State definitions ...
    const [mode, setMode] = useState<'buy_usdt' | 'sell_usdt' | 'buy_eur' | null>(null);
    const [notes, setNotes] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const [buyUsdtAmount, setBuyUsdtAmount] = useState('');
    const [buyUsdtPrice, setBuyUsdtPrice] = useState('');
    const [buyUsdtTotal, setBuyUsdtTotal] = useState('');
    const [buyUsdtMode, setBuyUsdtMode] = useState<'with_dzd' | 'with_eur' | null>(null);
    const [buyEurForUsdtAmount, setBuyEurForUsdtAmount] = useState('');
    const [eurDzdPrice, setEurDzdPrice] = useState('');
    const [eurUsdtRate, setEurUsdtRate] = useState('');
    const [buyEurAmount, setBuyEurAmount] = useState('');
    const [buyEurPrice, setBuyEurPrice] = useState('');

    const [sellAmount, setSellAmount] = useState('');
    const [sellPrice, setSellPrice] = useState('');
    const [sellTotal, setSellTotal] = useState('');
    const [profitPercent, setProfitPercent] = useState('');
    const [sellAmountError, setSellAmountError] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<'Espèces' | 'BaridiMob' | 'Crédit'>('Espèces');

    const [alert, setAlert] = useState('');

    useEffect(() => {
        if (alert) {
            const timer = setTimeout(() => setAlert(''), 3000);
            return () => clearTimeout(timer);
        }
    }, [alert]);

    const [editingTx, setEditingTx] = useState<Tx | null>(null);
    const [txToDelete, setTxToDelete] = useState<Tx | null>(null);
    const [suggestedProfitMargin, setSuggestedProfitMargin] = useState('2');
    const [linkedClientId, setLinkedClientId] = useState('none');

    const [view, setView] = useState<'transactions' | 'statistiques' | 'dzd' | 'tresorerie'>(() => {
        const savedView = localStorage.getItem('app_view');
        return (savedView === 'transactions' || savedView === 'statistiques' || savedView === 'dzd' || savedView === 'tresorerie') ? savedView : 'transactions';
    });
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [statsView, setStatsView] = useState<'usdt' | 'clients'>('usdt');
    const [selectedClientId, setSelectedClientId] = useState<string | null>(() => localStorage.getItem('selected_client_id'));

    useEffect(() => { localStorage.setItem('app_view', view); }, [view]);
    useEffect(() => {
        if (selectedClientId) localStorage.setItem('selected_client_id', selectedClientId);
        else localStorage.removeItem('selected_client_id');
    }, [selectedClientId]);

    const [clientsDzd, setClientsDzd] = useState<ClientDzd[]>([]);
    useEffect(() => {
        const unsubscribe = userDocRef.collection('dzd_clients').orderBy('fullName', 'asc').onSnapshot((snapshot: firebase.firestore.QuerySnapshot) => {
            setClientsDzd(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as ClientDzd[]);
        });
        return () => unsubscribe();
    }, [userDocRef]);

    const [clientTransactionsDzd, setClientTransactionsDzd] = useState<ClientTransactionDzd[]>([]);
    useEffect(() => {
        const unsubscribe = userDocRef.collection('dzd_client_txs').orderBy('timestamp', 'asc').onSnapshot((snapshot: firebase.firestore.QuerySnapshot) => {
            const clientTxsData = snapshot.docs.map((doc) => {
                const data = doc.data();
                const newDoc: any = { id: doc.id, ...data };
                if (newDoc.linkedUsdtTxId) { newDoc.linkedTxId = newDoc.linkedUsdtTxId; delete newDoc.linkedUsdtTxId; }
                return newDoc;
            }) as ClientTransactionDzd[];
            setClientTransactionsDzd(clientTxsData);
        });
        return () => unsubscribe();
    }, [userDocRef]);

    const [treasuryTransactions, setTreasuryTransactions] = useState<TreasuryTx[]>([]);
    useEffect(() => {
        const unsubscribe = userDocRef.collection('treasury_txs').orderBy('timestamp', 'asc').onSnapshot((snapshot: firebase.firestore.QuerySnapshot) => {
            setTreasuryTransactions(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as TreasuryTx[]);
        });
        return () => unsubscribe();
    }, [userDocRef]);

    const [treasuryCards, setTreasuryCards] = useState<TreasuryCard[]>([]);
    useEffect(() => {
        const unsubscribe = userDocRef.collection('treasury_cards').onSnapshot((snapshot: firebase.firestore.QuerySnapshot) => {
            setTreasuryCards(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as TreasuryCard[]);
        });
        return () => unsubscribe();
    }, [userDocRef]);

    // Adjustment Modal
    const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
    const [adjustmentTab, setAdjustmentTab] = useState<'add' | 'subtract'>('add');
    const [adjustmentAsset, setAdjustmentAsset] = useState<'DZD-Caisse' | 'DZD-Baridi' | 'USDT' | 'EUR'>('DZD-Caisse');
    const [adjustmentAmount, setAdjustmentAmount] = useState('');
    const [adjustmentNote, setAdjustmentNote] = useState('');
    const [adjustmentClientId, setAdjustmentClientId] = useState('');

    const openAdjustmentModal = (type: 'add' | 'subtract' = 'add') => {
        setAdjustmentTab(type);
        setAdjustmentAmount('');
        setAdjustmentNote('');
        setAdjustmentAsset('DZD-Caisse');
        setAdjustmentClientId('');
        setIsAdjustmentModalOpen(true);
    };

    const treasuryStats = useMemo(() => {
        let caisse = 0;
        let baridi = 0;
        treasuryTransactions.forEach(tx => {
            const factor = tx.type === 'Ajout' ? 1 : -1;
            if (tx.source === 'Caisse') caisse += (tx.amount * factor);
            if (tx.source === 'BaridiMob') baridi += (tx.amount * factor);
        });
        return { caisse, baridi };
    }, [treasuryTransactions]);

    // Client Balances Calculation
    const clientBalances = useMemo(() => {
        const balances = new Map<string, number>();
        // Initialize
        clientsDzd.forEach(c => balances.set(c.id, 0));

        clientTransactionsDzd.forEach(tx => {
            if (!tx.paymentMethod || tx.paymentMethod === 'Crédit') {
                const current = balances.get(tx.clientId) || 0;
                balances.set(tx.clientId, current + tx.montant);
            }
        });
        return balances;
    }, [clientsDzd, clientTransactionsDzd]);

    const clientStats = useMemo(() => {
        let totalDettes = 0;
        let totalAvances = 0;
        clientBalances.forEach(balance => {
            if (balance < 0) totalDettes += balance;
            else if (balance > 0) totalAvances += balance;
        });
        return { totalDettes, totalAvances };
    }, [clientBalances]);

    const [isClientModalOpen, setIsClientModalOpen] = useState(false);
    const [editingClient, setEditingClient] = useState<ClientDzd | null>(null);
    const [clientToDelete, setClientToDelete] = useState<ClientDzd | null>(null);
    const [clientFullName, setClientFullName] = useState('');
    const [clientPhone, setClientPhone] = useState('');
    const [initialBalance, setInitialBalance] = useState('');
    const [clientRedotpayId, setClientRedotpayId] = useState('');
    const [clientBinanceEmail, setClientBinanceEmail] = useState('');

    const [isClientTxModalOpen, setIsClientTxModalOpen] = useState(false);
    const [editingClientTx, setEditingClientTx] = useState<ClientTransactionDzd | null>(null);
    const [clientTxToDelete, setClientTxToDelete] = useState<ClientTransactionDzd | null>(null);
    const [clientTxAmount, setClientTxAmount] = useState('');
    const [clientTxType, setClientTxType] = useState<ClientTransactionDzd['type'] | 'Achat EUR'>('Règlement Reçu');
    const [clientTxNotes, setClientTxNotes] = useState('');
    const [clientTxUsdtAmount, setClientTxUsdtAmount] = useState('');
    const [clientTxSellPrice, setClientTxSellPrice] = useState('');
    const [clientTxEurAmount, setClientTxEurAmount] = useState('');
    const [clientTxEurPrice, setClientTxEurPrice] = useState('');
    const [clientTxSource, setClientTxSource] = useState<'Caisse' | 'BaridiMob' | ''>('');

    // Wallet Transfer Modal
    const [isWalletTransferModalOpen, setIsWalletTransferModalOpen] = useState(false);
    const [walletTransferSource, setWalletTransferSource] = useState<'Caisse' | 'BaridiMob'>('Caisse');
    const [walletTransferDest, setWalletTransferDest] = useState<'Caisse' | 'BaridiMob'>('BaridiMob');
    const [walletTransferAmount, setWalletTransferAmount] = useState('');
    const [walletTransferNotes, setWalletTransferNotes] = useState('');

    const [isSettlementModalOpen, setIsSettlementModalOpen] = useState(false);
    const [settlementType, setSettlementType] = useState<'reçu' | 'effectué' | null>(null);
    const [settlementClientId, setSettlementClientId] = useState('');
    const [settlementAmount, setSettlementAmount] = useState('');
    const [settlementNotes, setSettlementNotes] = useState('');
    const [settlementSource, setSettlementSource] = useState<'Caisse' | 'BaridiMob' | ''>('');

    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [transferFromClientId, setTransferFromClientId] = useState('');
    const [transferToClientId, setTransferToClientId] = useState('');
    const [transferAmount, setTransferAmount] = useState('');
    const [transferNotes, setTransferNotes] = useState('');

    const [dzdDashboardPeriod, setDzdDashboardPeriod] = useState<'current_month' | 'last_30_days' | 'current_year'>('current_month');
    const [reportClient, setReportClient] = useState('');
    const [reportMonth, setReportMonth] = useState(new Date().getMonth());
    const [reportYear, setReportYear] = useState(new Date().getFullYear());
    const [usdtReportMonth, setUsdtReportMonth] = useState(new Date().getMonth());
    const [usdtReportYear, setUsdtReportYear] = useState(new Date().getFullYear());
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [selectedHeatmapDay, setSelectedHeatmapDay] = useState<{ day: number; profit: number } | null>(null);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [currentReportData, setCurrentReportData] = useState<{ html: string; filename: string } | null>(null);
    useEffect(() => { setSelectedHeatmapDay(null); }, [usdtReportMonth, usdtReportYear]);
    const [simBuyQty, setSimBuyQty] = useState('');
    const [simBuyPrice, setSimBuyPrice] = useState('');
    const [simMode, setSimMode] = useState<'dzd' | 'eur'>('dzd');
    const [simEurQty, setSimEurQty] = useState('');
    const [simEurDzdPrice, setSimEurDzdPrice] = useState('');
    const [simEurUsdtRate, setSimEurUsdtRate] = useState('');
    const [clientSearchQuery, setClientSearchQuery] = useState('');
    const [clientSortMode, setClientSortMode] = useState<'all' | 'advances' | 'debts' | 'zero_balance'>('all');
    const [copiedValue, setCopiedValue] = useState<string | null>(null);
    const handleCopy = (text: string) => { if (!text) return; navigator.clipboard.writeText(text).then(() => { setCopiedValue(text); setTimeout(() => setCopiedValue(null), 2000); }); };
    const [isClientReportModalOpen, setIsClientReportModalOpen] = useState(false);
    const [clientForReport, setClientForReport] = useState<ClientDzd | null>(null);
    const reportRef = useRef<HTMLDivElement>(null);
    const [isDateFilterModalOpen, setIsDateFilterModalOpen] = useState(false);
    const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>({ start: null, end: null });
    const [tempStartDate, setTempStartDate] = useState('');
    const [tempEndDate, setTempEndDate] = useState('');
    const [filterMode, setFilterMode] = useState<'all' | 'buy' | 'sell' | 'adjustments'>('all');
    const [isResetModalOpen, setIsResetModalOpen] = useState(false);
    const [clientPaymentStatus, setClientPaymentStatus] = useState<'credit' | 'baridi' | 'cash'>('cash');

    // Treasury Card Modal
    const [isTreasuryCardModalOpen, setIsTreasuryCardModalOpen] = useState(false);
    const [treasuryCardName, setTreasuryCardName] = useState('');
    const [treasuryCardValue, setTreasuryCardValue] = useState('');
    const [treasuryCardToDelete, setTreasuryCardToDelete] = useState<TreasuryCard | null>(null);
    const [editingTreasuryCard, setEditingTreasuryCard] = useState<TreasuryCard | null>(null);

    // ... Helper functions ...
    const parseAndEvaluate = (expr: string): number => {
        if (!expr) return 0;
        const evaluateExpression = (expr: string): { success: boolean; value?: number; error?: string } => {
            if (!expr) return { success: true, value: 0 };
            try {
                const sanitizedExpr = expr.replace(/,/g, '.').replace(/\s+/g, '');
                if (!sanitizedExpr) return { success: true, value: 0 };
                if (/[^0-9.+\-*/().]/.test(sanitizedExpr)) return { success: false, error: "Invalid characters" };
                const result = new Function(`return ${sanitizedExpr}`)();
                if (typeof result !== 'number' || !isFinite(result)) return { success: false, error: "Invalid expression" };
                return { success: true, value: result };
            } catch (e) { return { success: false, error: "Invalid syntax" }; }
        };
        const result = evaluateExpression(expr);
        return result.success && result.value !== undefined ? result.value : NaN;
    };

    const portfolioStats = useMemo(() => {
        const createInitialStats = () => ({ costBasis: 0, purchasedQty: 0, available: 0, totalProfit: 0, avgBuy: 0 });
        let usdtStats = createInitialStats();
        let eurStats = createInitialStats();
        for (const tx of transactions) {
            const stats = tx.currency === 'USDT' ? usdtStats : eurStats;
            if (tx.type === 'buy' || tx.type === 'Ajout Manuel') stats.available += tx.quantity;
            else stats.available -= tx.quantity;
            if (tx.type === 'sell' && tx.currency === 'USDT') usdtStats.totalProfit += (tx.profit || 0);
            if (tx.type === 'Ajout Manuel' || tx.type === 'Retrait Manuel') continue;
            if (tx.type === 'buy') {
                stats.purchasedQty += tx.quantity;
                stats.costBasis += (tx.total || 0);
            } else if (tx.type === 'sell' && tx.currency === 'USDT') {
                const avgBuyOfPurchased = (usdtStats.purchasedQty > 0) ? (usdtStats.costBasis / usdtStats.purchasedQty) : 0;
                const soldQtyToConsider = Math.min(tx.quantity, usdtStats.purchasedQty);
                usdtStats.purchasedQty -= soldQtyToConsider;
                usdtStats.costBasis -= (soldQtyToConsider * avgBuyOfPurchased);
                if (usdtStats.purchasedQty < 0.00001) { usdtStats.purchasedQty = 0; usdtStats.costBasis = 0; }
            }
        }
        usdtStats.avgBuy = (usdtStats.purchasedQty > 0) ? usdtStats.costBasis / usdtStats.purchasedQty : 0;
        eurStats.avgBuy = (eurStats.purchasedQty > 0) ? eurStats.costBasis / eurStats.purchasedQty : 0;
        return { usdt: usdtStats, eur: eurStats };
    }, [transactions]);

    const getRelativeDateLabel = (dateString: string) => {
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);
        const parts = dateString.split('/');
        const txDate = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
        if (txDate.toDateString() === today.toDateString()) return `Aujourd'hui (${dateString})`;
        if (txDate.toDateString() === yesterday.toDateString()) return `Hier (${dateString})`;
        return dateString;
    };
    const now = () => {
        const d = new Date();
        return { date: d.toLocaleDateString('fr-FR'), time: d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }), timestamp: d.getTime() };
    };
    const usdtFromEurCalc = useMemo(() => {
        const eurQty = parseAndEvaluate(buyEurForUsdtAmount);
        const eurPrice = parseAndEvaluate(eurDzdPrice);
        const rate = parseAndEvaluate(eurUsdtRate);
        if (eurQty <= 0 || eurPrice <= 0 || rate <= 0) return null;
        return { usdtQty: eurQty / rate, usdtPriceDzd: eurPrice * rate, totalCostDzd: (eurQty / rate) * (eurPrice * rate) };
    }, [buyEurForUsdtAmount, eurDzdPrice, eurUsdtRate]);
    const isFormValid = useMemo(() => {
        if (paymentMethod === 'Crédit' && (!linkedClientId || linkedClientId === 'none')) return false;
        if (mode === 'buy_usdt') {
            if (buyUsdtMode === 'with_dzd') return parseAndEvaluate(buyUsdtAmount) > 0 && parseAndEvaluate(buyUsdtPrice) > 0;
            if (buyUsdtMode === 'with_eur') return parseAndEvaluate(buyEurForUsdtAmount) > 0 && parseAndEvaluate(eurDzdPrice) > 0 && parseAndEvaluate(eurUsdtRate) > 0 && parseAndEvaluate(buyEurForUsdtAmount) <= portfolioStats.eur.available;
            return false;
        }
        if (mode === 'buy_eur') return parseAndEvaluate(buyEurAmount) > 0 && parseAndEvaluate(buyEurPrice) > 0;
        if (mode === 'sell_usdt') {
            const amt = parseAndEvaluate(sellAmount);
            const prc = parseAndEvaluate(sellPrice);
            const avail = portfolioStats.usdt.available + (editingTx?.type === 'sell' ? editingTx.quantity : 0);
            return amt > 0 && prc > 0 && amt <= avail;
        }
        return false;
    }, [mode, buyUsdtMode, buyUsdtAmount, buyUsdtPrice, buyEurForUsdtAmount, eurDzdPrice, eurUsdtRate, buyEurAmount, buyEurPrice, sellAmount, sellPrice, portfolioStats.eur.available, portfolioStats.usdt.available, editingTx, paymentMethod, linkedClientId]);

    const openForm = (newMode: 'buy_usdt' | 'sell_usdt' | 'buy_eur', txToEdit: Tx | null = null) => {
        setBuyUsdtAmount(''); setBuyUsdtPrice(''); setBuyEurAmount(''); setBuyEurPrice('');
        setSellAmount(''); setSellPrice(''); setSellTotal(''); setProfitPercent(''); setNotes('');
        setAlert(''); setSellAmountError(''); setLinkedClientId('none');
        setBuyUsdtMode(null); setBuyEurForUsdtAmount(''); setEurDzdPrice(''); setEurUsdtRate('');
        setBuyUsdtMode(null); setBuyEurForUsdtAmount(''); setEurDzdPrice(''); setEurUsdtRate('');
        setBuyUsdtTotal(''); setPaymentMethod('Espèces'); setClientPaymentStatus('cash');
        setEditingTx(txToEdit); setMode(newMode);
        if (txToEdit) {
            if (txToEdit.type === 'buy') {
                if (txToEdit.currency === 'USDT') { setBuyUsdtMode('with_dzd'); setBuyUsdtAmount(txToEdit.quantity.toString()); setBuyUsdtPrice((txToEdit.price ?? 0).toString()); setBuyUsdtTotal(((txToEdit.quantity || 0) * (txToEdit.price || 0)).toFixed(2)); }
                else { setBuyEurAmount(txToEdit.quantity.toString()); setBuyEurPrice((txToEdit.price ?? 0).toString()); }
            } else { setSellAmount(txToEdit.quantity.toString()); setSellPrice((txToEdit.sell ?? 0).toString()); setSellTotal(((txToEdit.quantity || 0) * (txToEdit.sell || 0)).toFixed(2)); }
            setNotes(txToEdit.notes ?? '');
            const linkedDzdTx = clientTransactionsDzd.find(t => t.linkedTxId === txToEdit.id);
            if (linkedDzdTx) { setLinkedClientId(linkedDzdTx.clientId); setPaymentMethod(linkedDzdTx.paymentMethod || 'Espèces'); }
            if (txToEdit.paymentMethod) setPaymentMethod(txToEdit.paymentMethod);
        } else { if (newMode === 'buy_eur' && portfolioStats.eur.avgBuy > 0) setBuyEurPrice(portfolioStats.eur.avgBuy.toFixed(2)); }
    };
    const closeForm = () => { setMode(null); setEditingTx(null); setBuyUsdtMode(null); setSellTotal(''); setBuyUsdtTotal(''); };

    const handleBuy = async () => {
        if (!isFormValid || isSaving) return;
        setIsSaving(true); setAlert('');
        try {
            const batch = db.batch();
            let quantity: number, price: number, currency: 'USDT' | 'EUR';
            if (mode === 'buy_usdt') {
                currency = 'USDT';
                if (buyUsdtMode === 'with_dzd') { quantity = parseAndEvaluate(buyUsdtAmount); price = parseAndEvaluate(buyUsdtPrice); }
                else {
                    const eurSpent = parseAndEvaluate(buyEurForUsdtAmount);
                    quantity = usdtFromEurCalc!.usdtQty; price = usdtFromEurCalc!.usdtPriceDzd;
                    batch.set(userDocRef.collection('usdt_txs').doc(), { timestamp: now().timestamp - 1, type: 'Retrait Manuel', currency: 'EUR', quantity: eurSpent, date: now().date, time: now().time, notes: `Achat de ${quantity.toFixed(2)} USDT` });
                }
            } else { currency = 'EUR'; quantity = parseAndEvaluate(buyEurAmount); price = parseAndEvaluate(buyEurPrice); }
            const totalCost = quantity * price; const { date, time, timestamp } = now();

            // TREASURY LOGIC: Only if NOT Credit (Baridi or Cash)
            if (!editingTx && buyUsdtMode !== 'with_eur' && clientPaymentStatus !== 'credit') {
                const source = clientPaymentStatus === 'baridi' ? 'BaridiMob' : 'Caisse';
                batch.set(userDocRef.collection('treasury_txs').doc(), { timestamp, date, time, type: 'Retrait', source, amount: totalCost, notes: `Achat ${quantity.toFixed(2)} ${currency}` });
            }

            if (editingTx) {
                batch.update(userDocRef.collection('usdt_txs').doc(editingTx.id), { quantity, price, total: totalCost, notes: notes.trim(), sell: firebase.firestore.FieldValue.delete(), profit: firebase.firestore.FieldValue.delete(), currency, paymentMethod: clientPaymentStatus });
                const qs = await userDocRef.collection('dzd_client_txs').where('linkedTxId', '==', editingTx.id).get(); qs.forEach(d => batch.delete(d.ref));

                // CLIENT LOGIC: Only if Credit
                if (linkedClientId && linkedClientId !== 'none' && clientPaymentStatus === 'credit') {
                    batch.set(userDocRef.collection('dzd_client_txs').doc(), { clientId: linkedClientId, timestamp, date, time, montant: totalCost, type: 'Règlement Reçu', notes: `Financement achat de ${quantity.toFixed(2)} ${currency}`, linkedTxId: editingTx.id, paymentMethod: 'Crédit' });
                }
                setAlert('✅ Transaction mise à jour.');
            } else {
                const ref = userDocRef.collection('usdt_txs').doc(); batch.set(ref, { timestamp, type: 'buy', quantity, price, total: totalCost, date, time, notes: notes.trim(), currency, paymentMethod: clientPaymentStatus });

                // CLIENT LOGIC: Only if Credit
                if (linkedClientId && linkedClientId !== 'none' && clientPaymentStatus === 'credit') {
                    batch.set(userDocRef.collection('dzd_client_txs').doc(), { clientId: linkedClientId, timestamp, date, time, montant: totalCost, type: 'Règlement Reçu', notes: `Financement achat de ${quantity.toFixed(2)} ${currency}`, linkedTxId: ref.id, paymentMethod: 'Crédit' });
                }
                setAlert('✅ Transaction ajoutée.');
            }
            await batch.commit(); closeForm();
        } catch (error) { console.error(error); setAlert('❌ Erreur.'); } finally { setIsSaving(false); }
    };

    const handleSell = async () => {
        if (!isFormValid || isSaving) return;
        setIsSaving(true); setAlert('');
        try {
            const quantity = parseAndEvaluate(sellAmount); const sell = parseAndEvaluate(sellPrice); const avg = portfolioStats.usdt.avgBuy; const profit = (sell - avg) * quantity; const totalRevenue = quantity * sell; const { date, time, timestamp } = now(); const batch = db.batch();

            // TREASURY LOGIC: Only if NOT Credit (Baridi or Cash)
            if (!editingTx && clientPaymentStatus !== 'credit') {
                const source = clientPaymentStatus === 'baridi' ? 'BaridiMob' : 'Caisse';
                batch.set(userDocRef.collection('treasury_txs').doc(), { timestamp, date, time, type: 'Ajout', source, amount: totalRevenue, notes: `Vente ${quantity.toFixed(2)} USDT` });
            }

            if (editingTx) {
                batch.update(userDocRef.collection('usdt_txs').doc(editingTx.id), { quantity, sell, profit, notes: notes.trim(), price: firebase.firestore.FieldValue.delete(), total: firebase.firestore.FieldValue.delete(), currency: 'USDT', paymentMethod: clientPaymentStatus });
                const qs = await userDocRef.collection('dzd_client_txs').where('linkedTxId', '==', editingTx.id).get(); qs.forEach(d => batch.delete(d.ref));

                // CLIENT LOGIC: Only if Credit
                if (linkedClientId && linkedClientId !== 'none' && clientPaymentStatus === 'credit') {
                    batch.set(userDocRef.collection('dzd_client_txs').doc(), { clientId: linkedClientId, timestamp, date, time, montant: -totalRevenue, type: 'Vente USDT', notes: `Vente de ${quantity.toFixed(2)} USDT @ ${sell.toFixed(2)}`, linkedTxId: editingTx.id, paymentMethod: 'Crédit' });
                }
                setAlert('✅ Transaction mise à jour.');
            } else {
                const ref = userDocRef.collection('usdt_txs').doc(); batch.set(ref, { timestamp, type: 'sell', quantity, sell, profit, date, time, notes: notes.trim(), currency: 'USDT', paymentMethod: clientPaymentStatus });

                // CLIENT LOGIC: Only if Credit
                if (linkedClientId && linkedClientId !== 'none' && clientPaymentStatus === 'credit') {
                    batch.set(userDocRef.collection('dzd_client_txs').doc(), { clientId: linkedClientId, timestamp, date, time, montant: -totalRevenue, type: 'Vente USDT', notes: `Vente de ${quantity.toFixed(2)} USDT @ ${sell.toFixed(2)}`, linkedTxId: ref.id, paymentMethod: 'Crédit' });
                }
                setAlert('✅ Transaction ajoutée.');
            }
            await batch.commit(); closeForm();
        } catch (error) { console.error(error); setAlert('❌ Erreur.'); } finally { setIsSaving(false); }
    };
    const handleDeleteConfirm = async () => {
        if (!txToDelete?.id) return;
        try {
            const qs = await userDocRef.collection('dzd_client_txs').where('linkedTxId', '==', txToDelete.id).get();
            const batch = db.batch(); qs.forEach(d => batch.delete(d.ref));
            batch.delete(userDocRef.collection('usdt_txs').doc(txToDelete.id));
            await batch.commit(); setAlert('✅ Supprimé.');
        } catch (e) { setAlert('❌ Erreur.'); } finally { setTxToDelete(null); }
    };

    const openClientModal = (client: ClientDzd | null = null) => {
        setEditingClient(client);
        if (client) {
            setClientFullName(client.fullName || client.nom || '');
            setClientPhone(client.phone || '');
            setClientRedotpayId(client.redotpayId || '');
            setClientBinanceEmail(client.binanceEmail || '');
        } else {
            setClientFullName('');
            setClientPhone('');
            setClientRedotpayId('');
            setClientBinanceEmail('');
            setInitialBalance('');
        }
        setIsClientModalOpen(true);
    };

    const handleSaveClient = async () => {
        if (!clientFullName.trim()) { setAlert('⚠️ Nom requis.'); return; }
        setIsSaving(true);
        try {
            const data: any = {
                fullName: clientFullName.trim(),
                phone: clientPhone.trim(),
                redotpayId: clientRedotpayId.trim(),
                binanceEmail: clientBinanceEmail.trim(),
                nom: clientFullName.trim()
            };
            if (editingClient) {
                await userDocRef.collection('dzd_clients').doc(editingClient.id).update(data);
                setAlert('✅ Client modifié.');
            } else {
                const ref = await userDocRef.collection('dzd_clients').add(data);
                const initBal = parseAndEvaluate(initialBalance);
                if (initBal !== 0 && !isNaN(initBal)) {
                    const { date, time, timestamp } = now();
                    await userDocRef.collection('dzd_client_txs').add({
                        clientId: ref.id, timestamp, date, time,
                        type: 'Solde Initial', montant: initBal, notes: 'Solde initial', paymentMethod: 'Crédit'
                    });
                }
                setAlert('✅ Client ajouté.');
            }
            setIsClientModalOpen(false);
        } catch (e) { console.error(e); setAlert('❌ Erreur.'); } finally { setIsSaving(false); }
    };

    const handleDeleteClient = async () => {
        if (!clientToDelete) return;
        try {
            await userDocRef.collection('dzd_clients').doc(clientToDelete.id).delete();
            setAlert('✅ Client supprimé.');
            setClientToDelete(null);
            if (selectedClientId === clientToDelete.id) setSelectedClientId(null);
        } catch (e) { setAlert('❌ Erreur.'); }
    };

    const handleGlobalAdjustment = async () => {
        const amountNum = parseAndEvaluate(adjustmentAmount);
        if (amountNum <= 0 || isNaN(amountNum)) { setAlert("⚠️ Montant invalide."); return; }

        if (adjustmentTab === 'subtract') {
            if (adjustmentAsset === 'USDT' && amountNum > portfolioStats.usdt.available) { setAlert("⚠️ Solde USDT insuffisant."); return; }
            if (adjustmentAsset === 'EUR' && amountNum > portfolioStats.eur.available) { setAlert("⚠️ Solde EUR insuffisant."); return; }
            if (adjustmentAsset === 'DZD-Caisse') {
                if (treasuryStats.caisse <= 0) { setAlert("⚠️ La Caisse est vide (0 DZD)."); return; }
                if (amountNum > treasuryStats.caisse) { setAlert("⚠️ Solde Caisse insuffisant."); return; }
            }
            if (adjustmentAsset === 'DZD-Baridi') {
                if (treasuryStats.baridi <= 0) { setAlert("⚠️ BaridiMob est vide (0 DZD)."); return; }
                if (amountNum > treasuryStats.baridi) { setAlert("⚠️ Solde Baridi insuffisant."); return; }
            }
        }

        const { date, time, timestamp } = now();
        try {
            const batch = db.batch();
            if (adjustmentAsset === 'USDT' || adjustmentAsset === 'EUR') {
                const type = adjustmentTab === 'add' ? 'Ajout Manuel' : 'Retrait Manuel';
                batch.set(userDocRef.collection('usdt_txs').doc(), { timestamp, type, currency: adjustmentAsset, quantity: amountNum, date, time, notes: adjustmentNote || 'Ajustement Manuel' });
            } else {
                // Treasury Adjustment
                const type = adjustmentTab === 'add' ? 'Ajout' : 'Retrait';
                const source = adjustmentAsset === 'DZD-Caisse' ? 'Caisse' : 'BaridiMob';
                const note = adjustmentNote || 'Ajustement Trésorerie';

                // Create Treasury Tx
                batch.set(userDocRef.collection('treasury_txs').doc(), { timestamp, date, time, type, source, amount: amountNum, notes: note });

                // LINKED CLIENT LOGIC
                if (adjustmentClientId) {
                    const client = clientsDzd.find(c => c.id === adjustmentClientId);
                    if (client) {
                        const clientTxType = adjustmentTab === 'add' ? 'Règlement Reçu' : 'Paiement Effectué';
                        const clientAmount = adjustmentTab === 'add' ? amountNum : -amountNum;

                        batch.set(userDocRef.collection('dzd_client_txs').doc(), {
                            clientId: adjustmentClientId, timestamp, date, time,
                            montant: clientAmount, type: clientTxType,
                            notes: `${note} (${source})`
                        });
                    }
                }
            }
            await batch.commit();
            setAlert('✅ Ajustement enregistré.'); setIsAdjustmentModalOpen(false);
        } catch (error) { console.error(error); setAlert("❌ Erreur."); }
    };

    const handleSwapSourceDest = () => {
        setWalletTransferSource(walletTransferDest);
        setWalletTransferDest(walletTransferSource);
    };

    const handleWalletTransfer = async () => {
        const amount = parseAndEvaluate(walletTransferAmount);
        if (amount <= 0 || isNaN(amount)) { setAlert("⚠️ Montant invalide."); return; }
        if (walletTransferSource === walletTransferDest) { setAlert("⚠️ Source et destination identiques."); return; }

        const sourceBalance = walletTransferSource === 'Caisse' ? treasuryStats.caisse : treasuryStats.baridi;
        if (sourceBalance <= 0) { setAlert(`⚠️ Le solde de ${walletTransferSource} est vide (0).`); return; }
        if (amount > sourceBalance) { setAlert(`⚠️ Solde ${walletTransferSource} insuffisant.`); return; }

        const { date, time, timestamp } = now();
        try {
            const batch = db.batch();
            const note = walletTransferNotes.trim() || `Virement ${walletTransferSource} -> ${walletTransferDest}`;

            // Remove from Source
            batch.set(userDocRef.collection('treasury_txs').doc(), { timestamp, date, time, type: 'Retrait', source: walletTransferSource, amount: amount, notes: note });

            // Add to Destination
            batch.set(userDocRef.collection('treasury_txs').doc(), { timestamp: timestamp + 1, date, time, type: 'Ajout', source: walletTransferDest, amount: amount, notes: note });

            await batch.commit();
            setAlert('✅ Virement effectué.'); setIsWalletTransferModalOpen(false);
            setWalletTransferAmount(''); setWalletTransferNotes('');
        } catch (e) { console.error(e); setAlert('❌ Erreur.'); }
    };

    const openClientTxModal = (tx: ClientTransactionDzd | null = null, presetType?: string) => {
        setEditingClientTx(tx);
        if (tx) {
            setClientTxAmount(Math.abs(tx.montant).toString()); setClientTxType(tx.type); setClientTxNotes(tx.notes || '');
            setClientTxSource('');
        } else {
            setClientTxAmount('');
            setClientTxType(presetType || 'Règlement Reçu');
            setClientTxNotes('');
            setClientTxSource('');
            setLinkedClientId(selectedClientId || 'none'); // Pre-fill with selected client if in client detail view
        }
        setIsClientTxModalOpen(true);
    };

    const handleSaveClientTx = async () => {
        const targetClientId = linkedClientId !== 'none' ? linkedClientId : selectedClientId;
        if (!targetClientId || targetClientId === 'none') { setAlert('⚠️ Veuillez sélectionner un client.'); return; }
        if (clientTxType === 'Achat EUR' || clientTxType === 'Vente USDT') {
            const { date, time, timestamp } = now();
            if (clientTxType === 'Achat EUR') {
                const eurAmount = parseAndEvaluate(clientTxEurAmount); const eurPrice = parseAndEvaluate(clientTxEurPrice);
                if (eurAmount <= 0 || eurPrice <= 0) { setAlert('⚠️ Valeurs invalides.'); return; }
                const totalCost = eurAmount * eurPrice; const batch = db.batch();
                const ref = userDocRef.collection('usdt_txs').doc();
                batch.set(ref, { timestamp, type: 'buy', currency: 'EUR', quantity: eurAmount, price: eurPrice, total: totalCost, date, time, notes: clientTxNotes.trim() });
                batch.set(userDocRef.collection('dzd_client_txs').doc(), { clientId: selectedClientId, timestamp, date, time, montant: totalCost, type: 'Règlement Reçu', notes: clientTxNotes.trim(), linkedTxId: ref.id });
                await batch.commit(); setAlert('✅ Achat EUR enregistré.'); setIsClientTxModalOpen(false); return;
            }
            if (clientTxType === 'Vente USDT') {
                const usdtAmount = parseAndEvaluate(clientTxUsdtAmount); const sellPrice = parseAndEvaluate(clientTxSellPrice);
                if (usdtAmount <= 0 || sellPrice <= 0) { setAlert('⚠️ Valeurs invalides.'); return; }
                if (usdtAmount > portfolioStats.usdt.available) { setAlert('⚠️ Solde USDT insuffisant.'); return; }
                const totalRevenue = usdtAmount * sellPrice; const profit = (sellPrice - portfolioStats.usdt.avgBuy) * usdtAmount; const batch = db.batch();
                const ref = userDocRef.collection('usdt_txs').doc();
                batch.set(ref, { timestamp, type: 'sell', currency: 'USDT', quantity: usdtAmount, sell: sellPrice, profit, date, time, notes: clientTxNotes.trim() });
                batch.set(userDocRef.collection('dzd_client_txs').doc(), { clientId: selectedClientId, timestamp, date, time, montant: -totalRevenue, type: 'Vente USDT', notes: clientTxNotes.trim(), linkedTxId: ref.id });
                await batch.commit(); setAlert('✅ Vente USDT enregistrée.'); setIsClientTxModalOpen(false); return;
            }
        }

        const amount = parseAndEvaluate(clientTxAmount);
        if (amount <= 0 || isNaN(amount)) { setAlert('⚠️ Montant invalide.'); return; }
        const finalAmount = clientTxType === 'Paiement Effectué' ? -amount : amount;

        if (clientTxSource && clientTxType === 'Paiement Effectué') {
            const balance = clientTxSource === 'Caisse' ? treasuryStats.caisse : treasuryStats.baridi;
            if (balance <= 0) { setAlert(`⚠️ Le solde de ${clientTxSource} est vide (0).`); return; }
            if (amount > balance) { setAlert(`⚠️ Solde ${clientTxSource} insuffisant.`); return; }
        }

        try {
            const { date, time, timestamp } = now();
            const batch = db.batch();

            if (editingClientTx) {
                batch.update(userDocRef.collection('dzd_client_txs').doc(editingClientTx.id), { montant: finalAmount, type: clientTxType, notes: clientTxNotes.trim(), paymentMethod: 'Crédit' });
            } else {
                batch.set(userDocRef.collection('dzd_client_txs').doc(), { clientId: targetClientId, timestamp, date, time, montant: finalAmount, type: clientTxType, notes: clientTxNotes.trim(), paymentMethod: 'Crédit' });
                if (clientTxSource) {
                    batch.set(userDocRef.collection('treasury_txs').doc(), { timestamp, date, time, type: finalAmount > 0 ? 'Ajout' : 'Retrait', source: clientTxSource, amount: Math.abs(finalAmount), notes: `${clientTxType} - ${clientsDzd.find(c => c.id === targetClientId)?.fullName || 'Client'}` });
                }
            }
            await batch.commit();
            setAlert('✅ Opération enregistrée.'); setIsClientTxModalOpen(false);
        } catch (e) { console.error(e); setAlert("❌ Erreur."); }
    };

    const handleDeleteClientTx = async () => {
        if (!clientTxToDelete) return;
        try { await userDocRef.collection('dzd_client_txs').doc(clientTxToDelete.id).delete(); setAlert('✅ Supprimé.'); }
        catch (e) { setAlert('❌ Erreur.'); } finally { setClientTxToDelete(null); }
    };

    const openSettlementModal = (type: 'reçu' | 'effectué') => {
        setSettlementType(type);
        setSettlementClientId('');
        setSettlementAmount('');
        setSettlementNotes('');
        setSettlementSource(''); // Reset source
        setIsSettlementModalOpen(true);
    };

    const handleSaveSettlement = async () => {
        const amount = parseAndEvaluate(settlementAmount);
        if (amount <= 0 || !settlementClientId) { setAlert('⚠️ Erreur: Client ou Montant manquant.'); return; }

        if (settlementSource && settlementType === 'effectué') {
            const balance = settlementSource === 'Caisse' ? treasuryStats.caisse : treasuryStats.baridi;
            if (amount > balance) { setAlert(`⚠️ Solde ${settlementSource} insuffisant.`); return; }
        }

        setIsSaving(true);
        try {
            const { date, time, timestamp } = now();
            const t = settlementType === 'reçu' ? 'Règlement Reçu' : 'Paiement Effectué';
            const m = settlementType === 'reçu' ? amount : -amount;
            const batch = db.batch();

            // Client Transaction
            batch.set(userDocRef.collection('dzd_client_txs').doc(), {
                clientId: settlementClientId, timestamp, date, time, montant: m, type: t, notes: settlementNotes.trim()
            });

            // Treasury Transaction (if source selected)
            if (settlementSource) {
                const treasuryType = settlementType === 'reçu' ? 'Ajout' : 'Retrait';
                const client = clientsDzd.find(c => c.id === settlementClientId);
                const clientName = client ? (client.fullName || client.nom) : 'Client';
                batch.set(userDocRef.collection('treasury_txs').doc(), {
                    timestamp, date, time, type: treasuryType, source: settlementSource, amount: amount,
                    notes: `${t} - ${clientName}`
                });
            }

            await batch.commit();
            setAlert('✅ Enregistré.');
            setIsSettlementModalOpen(false);
        } catch (e) {
            console.error(e);
            setAlert('❌ Erreur lors de l\'enregistrement.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveTransfer = async () => {
        const amt = parseAndEvaluate(transferAmount); if (amt <= 0 || !transferFromClientId || !transferToClientId || transferFromClientId === transferToClientId) { setAlert('⚠️ Erreur.'); return; }
        setIsSaving(true);
        try {
            const { date, time, timestamp } = now(); const batch = db.batch();
            const fromC = clientsDzd.find(c => c.id === transferFromClientId); const toC = clientsDzd.find(c => c.id === transferToClientId);

            // Source (De) advances money -> Credit (+amt)
            batch.set(userDocRef.collection('dzd_client_txs').doc(), {
                clientId: transferFromClientId, timestamp, date, time, montant: amt, type: 'Transfert Sortant', notes: transferNotes.trim() || `Transfert vers ${toC?.fullName}`
            });

            // Destination (À) receives benefit -> Debit (-amt)
            batch.set(userDocRef.collection('dzd_client_txs').doc(), {
                clientId: transferToClientId, timestamp: timestamp + 1, date, time, montant: -amt, type: 'Transfert Entrant', notes: transferNotes.trim() || `Transfert de ${fromC?.fullName}`
            });

            await batch.commit(); setAlert('✅ Transfert effectué.'); setIsTransferModalOpen(false); setTransferAmount(''); setTransferFromClientId(''); setTransferToClientId(''); setTransferNotes('');
        } catch (e) { setAlert('❌ Erreur.'); } finally { setIsSaving(false); }
    };

    const handleGlobalReset = async () => {
        setIsSaving(true);
        try {
            const batch = db.batch();
            // Delete all collections
            const collections = ['usdt_txs', 'treasury_txs', 'dzd_clients', 'dzd_client_txs', 'treasury_cards'];
            for (const col of collections) {
                const qs = await userDocRef.collection(col).get();
                qs.forEach(doc => batch.delete(doc.ref));
            }
            await batch.commit();
            setAlert('✅ Réinitialisation complète effectuée.');
            setIsResetModalOpen(false);
        } catch (e) {
            console.error(e);
            setAlert('❌ Erreur lors de la réinitialisation.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveTreasuryCard = async () => {
        const val = parseAndEvaluate(treasuryCardValue);
        if (!treasuryCardName.trim() || val < 0 || isNaN(val)) { setAlert('⚠️ Nom ou valeur invalide.'); return; }
        setIsSaving(true);
        try {
            if (editingTreasuryCard) {
                await userDocRef.collection('treasury_cards').doc(editingTreasuryCard.id).update({ name: treasuryCardName.trim(), value: val });
                setAlert('✅ Carte mise à jour.');
            } else {
                await userDocRef.collection('treasury_cards').add({ name: treasuryCardName.trim(), value: val });
                setAlert('✅ Carte ajoutée.');
            }
            setIsTreasuryCardModalOpen(false);
            setTreasuryCardName(''); setTreasuryCardValue(''); setEditingTreasuryCard(null);
        } catch (e) { setAlert('❌ Erreur.'); } finally { setIsSaving(false); }
    };

    const openTreasuryCardModal = (card: TreasuryCard | null = null) => {
        setEditingTreasuryCard(card);
        if (card) {
            setTreasuryCardName(card.name);
            setTreasuryCardValue(card.value.toString());
        } else {
            setTreasuryCardName('');
            setTreasuryCardValue('');
        }
        setIsTreasuryCardModalOpen(true);
    };

    const handleDeleteTreasuryCard = async () => {
        if (!treasuryCardToDelete) return;
        try {
            await userDocRef.collection('treasury_cards').doc(treasuryCardToDelete.id).delete();
            setAlert('✅ Carte supprimée.');
            setTreasuryCardToDelete(null);
        } catch (e) { setAlert('❌ Erreur.'); }
    };

    const bgApp = isDark ? 'from-[#0B1120] via-[#0F172A] to-[#1E293B] text-gray-100' : 'from-[#F8FAFC] via-[#F1F5F9] to-[#E2E8F0] text-gray-900';
    const cardBase = isDark ? 'bg-[#111827]/90 border-[#1f2937] text-white' : 'bg-white/90 border-[#E5E7EB] text-gray-900';
    const fieldBase = isDark ? 'bg-[#0F172A] text-white border border-[#334155]' : 'bg-white text-gray-900 border border-[#CBD5E1]';
    const subtleText = isDark ? 'text-[#9CA3AF]' : 'text-[#475569]';
    const selectedClient = clientsDzd.find(c => c.id === selectedClientId);
    const selectedClientBalance = clientBalances.get(selectedClientId || '') || 0;
    const selectedClientTransactions = useMemo(() => !selectedClientId ? [] : clientTransactionsDzd.filter(tx => tx.clientId === selectedClientId).sort((a, b) => b.timestamp - a.timestamp), [clientTransactionsDzd, selectedClientId]);
    const filteredClientsDzd = useMemo(() => {
        const base = clientSearchQuery.trim() ? clientsDzd.filter(c => (c.fullName || '').toLowerCase().includes(clientSearchQuery.toLowerCase())) : clientsDzd;
        if (clientSortMode === 'advances') return base.filter(c => (clientBalances.get(c.id) || 0) > 0).sort((a, b) => (clientBalances.get(b.id) || 0) - (clientBalances.get(a.id) || 0));
        if (clientSortMode === 'debts') return base.filter(c => (clientBalances.get(c.id) || 0) < 0).sort((a, b) => (clientBalances.get(a.id) || 0) - (clientBalances.get(b.id) || 0));
        if (clientSortMode === 'zero_balance') return base.filter(c => (clientBalances.get(c.id) || 0) === 0);
        return base;
    }, [clientsDzd, clientSearchQuery, clientSortMode, clientBalances]);

    const NavLink = ({ activeView, targetView, children, colorClass }: any) => (<button onClick={() => setView(targetView)} className={`flex-1 text-center font-semibold tracking-wider uppercase py-2.5 px-4 rounded-lg transition-colors text-sm ${activeView === targetView ? `${colorClass} text-white shadow-md` : `${isDark ? 'text-gray-400 hover:bg-white/5' : 'text-gray-600 hover:bg-black/5'}`}`}>{children}</button>);
    const MobileNavLink = ({ targetView, children, colorClass, icon }: any) => (<button onClick={() => { setView(targetView); setIsMobileMenuOpen(false); }} className={`flex items-center gap-4 w-full text-left p-4 rounded-lg text-lg font-semibold transition-colors ${view === targetView ? `${colorClass} text-white` : `${isDark ? 'text-gray-300 hover:bg-white/10' : 'text-gray-700 hover:bg-black/5'}`}`}>{icon}{children}</button>);

    const handleEditClientTx = (tx: ClientTransactionDzd) => {
        if (tx.linkedTxId) {
            const l = transactions.find(t => t.id === tx.linkedTxId);
            if (l) openForm(l.type === 'buy' ? (l.currency === 'USDT' ? 'buy_usdt' : 'buy_eur') : 'sell_usdt', l); else setAlert("❌ Non modifiable.");
        } else openClientTxModal(tx);
    };
    const handleDeleteClientTxClick = (tx: ClientTransactionDzd) => {
        if (tx.linkedTxId) { const l = transactions.find(t => t.id === tx.linkedTxId); if (l) setTxToDelete(l); else { setClientTxToDelete(tx); setAlert("⚠️ Transaction orpheline."); } }
        else setClientTxToDelete(tx);
    };
    const ClientLinker = ({ linkedClientId, setLinkedClientId, openClientModal, clientsDzd, fieldBase, isDark, clientPaymentStatus, setClientPaymentStatus }: any) => (
        <div className="pb-2 space-y-2">
            <div>
                <Label htmlFor="link_client_buy">Lier à un client DZD (Optionnel)</Label>
                <div className="flex items-center gap-2">
                    <Select id="link_client_buy" value={linkedClientId} onChange={(e: any) => setLinkedClientId(e.target.value)} className={`${fieldBase} focus:ring-amber-400 rounded-xl flex-grow`}>
                        <option value="none">Aucun / Sans client</option>
                        {clientsDzd.map(c => (<option key={c.id} value={c.id}>{c.fullName || c.nom}</option>))}
                    </Select>
                    <Button type="button" onClick={() => openClientModal(null)} className={`p-2.5 h-10 w-10 rounded-xl shrink-0 transition-colors ${isDark ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}`}>
                        <PlusIcon className="w-5 h-5" />
                    </Button>
                </div>
            </div>
            {linkedClientId && linkedClientId !== 'none' && (
                <div>
                    <Label>Statut du Paiement Client</Label>
                    <div className="grid grid-cols-3 gap-2">
                        <button type="button" onClick={() => setClientPaymentStatus('credit')} className={`py-2 px-1 rounded-lg text-xs font-bold border transition-all ${clientPaymentStatus === 'credit' ? (isDark ? 'bg-amber-500/20 border-amber-500 text-amber-400' : 'bg-amber-100 border-amber-500 text-amber-700') : (isDark ? 'border-slate-700 text-slate-400 hover:bg-slate-800' : 'border-slate-200 text-slate-500 hover:bg-slate-50')}`}>Crédit</button>
                        <button type="button" onClick={() => setClientPaymentStatus('baridi')} className={`py-2 px-1 rounded-lg text-xs font-bold border transition-all ${clientPaymentStatus === 'baridi' ? (isDark ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-blue-100 border-blue-500 text-blue-700') : (isDark ? 'border-slate-700 text-slate-400 hover:bg-slate-800' : 'border-slate-200 text-slate-500 hover:bg-slate-50')}`}>Réglé Baridi</button>
                        <button type="button" onClick={() => setClientPaymentStatus('cash')} className={`py-2 px-1 rounded-lg text-xs font-bold border transition-all ${clientPaymentStatus === 'cash' ? (isDark ? 'bg-green-500/20 border-green-500 text-green-400' : 'bg-green-100 border-green-500 text-green-700') : (isDark ? 'border-slate-700 text-slate-400 hover:bg-slate-800' : 'border-slate-200 text-slate-500 hover:bg-slate-50')}`}>Réglé Cash</button>
                    </div>
                </div>
            )}
        </div>
    );
    const ActionInputButton = ({ onClick, children }: any) => (<Button type="button" onClick={onClick} className="absolute right-1 top-1/2 -translate-y-1/2 h-8 px-3 text-xs bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 rounded-md z-10">{children}</Button>);

    const getClientFullName = (client: ClientDzd) => client.fullName || (client.prenom ? `${client.nom} ${client.prenom}` : client.nom);
    const handleTouchStart = (c: ClientDzd) => { /* ... */ }; const handleTouchEnd = () => { /* ... */ };
    const handleExportClientReport = (cId: string, m: number, y: number) => { /* ... */ };
    const handleExportUsdtReport = () => { /* ... */ };
    const openDateFilterModal = () => { setTempStartDate(dateRange.start ? dateRange.start.toISOString().split('T')[0] : ''); setTempEndDate(dateRange.end ? dateRange.end.toISOString().split('T')[0] : ''); setIsDateFilterModalOpen(true); };
    const handleApplyDateFilter = () => { if (tempStartDate && tempEndDate) { const s = new Date(tempStartDate); s.setHours(0, 0, 0, 0); const e = new Date(tempEndDate); e.setHours(23, 59, 59, 999); setDateRange({ start: s, end: e }); setIsDateFilterModalOpen(false); } else setAlert('⚠️ Dates incomplètes.'); };
    const handleClearDateFilter = () => { setDateRange({ start: null, end: null }); setIsDateFilterModalOpen(false); };

    return (
        <div className={`min-h-screen bg-gradient-to-br ${bgApp} transition-colors duration-300`}>
            <div className="max-w-4xl mx-auto px-2 sm:px-4 pb-24">
                <header className="sticky top-0 z-40 py-4 backdrop-blur-md bg-opacity-50">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="sm:hidden"><Button onClick={() => setIsMobileMenuOpen(true)} className={`p-2 rounded-full ${isDark ? 'text-gray-300 hover:bg-white/10' : 'text-gray-600 hover:bg-black/5'}`}><MenuIcon className="w-6 h-6" /></Button></div>
                            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">ProDigital</h1>
                        </div>
                        <div className="hidden sm:flex items-center gap-2 p-1 rounded-full border" style={{ borderColor: isDark ? '#334155' : '#CBD5E1' }}>
                            <NavLink activeView={view} targetView="transactions" colorClass="bg-indigo-600">Transactions</NavLink>
                            <NavLink activeView={view} targetView="statistiques" colorClass="bg-teal-600">Portefeuille</NavLink>
                            <NavLink activeView={view} targetView="dzd" colorClass="bg-sky-600">Clients</NavLink>
                            <NavLink activeView={view} targetView="tresorerie" colorClass="bg-emerald-600">Trésorerie</NavLink>
                        </div>
                        <div className="flex items-center gap-1 sm:gap-2">
                            <Button onClick={() => setTheme(isDark ? 'light' : 'dark')} className={`p-2 rounded-full transition-colors ${isDark ? 'text-gray-300 hover:bg-white/10' : 'text-gray-600 hover:bg-black/5'}`}>{isDark ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}</Button>
                            <Button onClick={() => setIsResetModalOpen(true)} className={`p-2 rounded-full transition-colors ${isDark ? 'text-red-400 hover:bg-red-500/20' : 'text-red-500 hover:bg-red-100'}`} title="Réinitialiser l'application"><RotateCcwIcon className="w-5 h-5" /></Button>
                            <Button onClick={() => auth.signOut()} className={`p-2 rounded-full transition-colors ${isDark ? 'text-gray-300 hover:bg-white/10' : 'text-gray-600 hover:bg-black/5'}`}><LogOutIcon className="w-5 h-5" /></Button>
                        </div>
                    </div>
                </header>

                {/* Mobile Menu Overlay */}
                <AnimatePresence>
                    {isMobileMenuOpen && (
                        <MotionDiv
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className={`fixed inset-0 z-50 p-4 ${isDark ? 'bg-slate-900/95' : 'bg-white/95'} backdrop-blur-xl sm:hidden`}
                        >
                            <div className="flex justify-end mb-8">
                                <Button onClick={() => setIsMobileMenuOpen(false)} className={`p-2 rounded-full ${isDark ? 'bg-white/10 text-white' : 'bg-black/5 text-gray-900'}`}>
                                    <XIcon className="w-6 h-6" />
                                </Button>
                            </div>
                            <div className="space-y-2">
                                <MobileNavLink targetView="transactions" icon={<BriefcaseIcon className="w-6 h-6" />} colorClass="text-indigo-500">Transactions</MobileNavLink>
                                <MobileNavLink targetView="statistiques" icon={<WalletIcon className="w-6 h-6" />} colorClass="text-teal-500">Portefeuille</MobileNavLink>
                                <MobileNavLink targetView="dzd" icon={<UsersIcon className="w-6 h-6" />} colorClass="text-sky-500">Clients</MobileNavLink>
                                <MobileNavLink targetView="tresorerie" icon={<LandmarkIcon className="w-6 h-6" />} colorClass="text-emerald-500">Trésorerie</MobileNavLink>
                            </div>
                        </MotionDiv>
                    )}
                </AnimatePresence>

                <main className="py-6">
                    <AnimatePresence>{alert && (<MotionDiv initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="mb-4"><Alert className={`rounded-xl ${alert.includes('✅') || alert.includes('⚠️') ? (isDark ? 'bg-green-900/50 border-green-400/30 text-green-300' : 'bg-green-50 border-green-300 text-green-800') : (isDark ? 'bg-red-900/50 border-red-400/30 text-red-300' : 'bg-red-50 border-red-300 text-red-800')}`}><AlertDescription>{alert}</AlertDescription></Alert></MotionDiv>)}</AnimatePresence>

                    {view === 'transactions' && <TransactionsPage {...{ cardBase, isDark, subtleText, openAdjustmentModal, openForm, filterMode, setFilterMode, transactions, getRelativeDateLabel, clientTransactionsDzd, clientsDzd, getClientFullName, setTxToDelete, openDateFilterModal, dateRange, treasuryTransactions, handleEditClientTx, handleDeleteClientTxClick }} openWalletTransferModal={() => setIsWalletTransferModalOpen(true)} openTransferModal={() => setIsTransferModalOpen(true)} />}

                    {view === 'statistiques' && <PortfolioPage {...{ statsView, setStatsView, isDark, setIsSettingsModalOpen, cardBase, subtleText, portfolioStats, totalPortfolioValue: (portfolioStats.usdt.available * portfolioStats.usdt.avgBuy + portfolioStats.eur.available * portfolioStats.eur.avgBuy), suggestedProfitMargin, parseAndEvaluate, usdtReportMonth, setUsdtReportMonth, usdtReportYear, setUsdtReportYear, reportMonths: (y: number) => y === new Date().getFullYear() ? MONTHS_FR.slice(0, new Date().getMonth() + 1) : MONTHS_FR, reportYears: Array.from({ length: 3 }, (_, i) => 2024 + i), monthlyStats: { totalUsdtSoldMonth: 0, totalEurBoughtMonth: 0, realizedProfitMonth: 0, monthlyProfitMargin: 0 }, transactions, selectedHeatmapDay, setSelectedHeatmapDay, simMode, setSimMode, simBuyQty, setSimBuyQty, simBuyPrice, setSimBuyPrice, fieldBase, newPamFromDzdSimulator: null, simEurQty, setSimEurQty, simEurDzdPrice, setSimEurDzdPrice, simEurUsdtRate, setSimEurUsdtRate, newPamFromEurSimulator: null, handleExportUsdtReport, dzdDashboardStats: null, reportClient, setReportClient, clientsDzd, getClientFullName, reportMonth, setReportMonth, reportYear, setReportYear, handleExportClientReport }} />}

                    {view === 'dzd' && <ClientsPage {...{ selectedClientId, setSelectedClientId, cardBase, fieldBase, isDark, subtleText, openClientModal, setIsTransferModalOpen, openSettlementModal, clientSearchQuery, setClientSearchQuery, clientSortMode, setClientSortMode, filteredClientsDzd, clientBalances: clientBalances, getClientFullName, handleTouchStart, handleTouchEnd, setClientToDelete, selectedClient, selectedClientTransactions, transactions, handleExportClientReport, openClientTxModal, copiedValue, handleCopy, handleEditClientTx, handleDeleteClientTxClick }} />}

                    {view === 'tresorerie' && <TresoreriePage {...{ isDark, cardBase, subtleText, caisseBalance: treasuryStats.caisse, baridiBalance: treasuryStats.baridi, totalDettes: clientStats.totalDettes, totalAvances: clientStats.totalAvances, portfolioValue: (portfolioStats.usdt.available * portfolioStats.usdt.avgBuy + portfolioStats.eur.available * portfolioStats.eur.avgBuy), openTreasuryModal: () => openAdjustmentModal('add'), treasuryCards, openTreasuryCardModal, setTreasuryCardToDelete }} />}
                </main>

                {/* Mobile Nav */}
                <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 p-2 backdrop-blur-md bg-opacity-50">
                    <div className="max-w-4xl mx-auto flex items-center justify-around gap-2 p-1 rounded-full border" style={{ borderColor: isDark ? '#334155' : '#CBD5E1', background: isDark ? 'rgba(15, 23, 42, 0.8)' : 'rgba(241, 245, 249, 0.8)' }}>
                        <NavLink activeView={view} targetView="transactions" colorClass="bg-indigo-600"><BriefcaseIcon className="w-5 h-5 mx-auto" /></NavLink>
                        <NavLink activeView={view} targetView="statistiques" colorClass="bg-teal-600"><WalletIcon className="w-5 h-5 mx-auto" /></NavLink>
                        <NavLink activeView={view} targetView="dzd" colorClass="bg-sky-600"><UsersIcon className="w-5 h-5 mx-auto" /></NavLink>
                        <NavLink activeView={view} targetView="tresorerie" colorClass="bg-emerald-600"><LandmarkIcon className="w-5 h-5 mx-auto" /></NavLink>
                    </div>
                </div>
            </div>

            {/* MODALS */}

            {/* 1. WALLET TRANSFER MODAL */}
            <Dialog isOpen={isWalletTransferModalOpen} onClose={() => setIsWalletTransferModalOpen(false)} className={`${cardBase} max-w-md`}>
                <DialogHeader onClose={() => setIsWalletTransferModalOpen(false)} isDark={isDark}><DialogTitle>Virement Interne</DialogTitle></DialogHeader>
                <DialogContent className="px-6 pb-6 space-y-6">

                    {/* 1. AMOUNT (Top & Prominent) */}
                    <div className="relative">
                        <Label className="text-center w-full block mb-2 text-gray-500 dark:text-gray-400 uppercase tracking-wider text-xs">Montant à transférer</Label>
                        <div className="relative max-w-[200px] mx-auto">
                            <NumberInput
                                value={walletTransferAmount}
                                onChange={e => setWalletTransferAmount(e.target.value)}
                                className={`${fieldBase} text-center text-3xl font-bold h-16 bg-transparent border-b-2 border-sky-500/30 focus:border-sky-500 rounded-none px-0`}
                                placeholder="0.00"
                            />
                            <span className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-400 font-medium">DZD</span>
                        </div>
                    </div>

                    {/* 2. SOURCE -> DESTINATION (Swappable Row) */}
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50 relative">
                        <div className="flex items-center justify-between gap-4">
                            {/* Source */}
                            <div className="flex-1">
                                <Label className="text-xs mb-1.5 text-gray-500">De (Source)</Label>
                                <div className={`p-3 rounded-xl font-semibold text-sm border ${isDark ? 'bg-slate-800 border-slate-700 text-gray-200' : 'bg-white border-slate-200 text-gray-800'}`}>
                                    {walletTransferSource}
                                </div>
                            </div>

                            {/* Swap Button */}
                            <button
                                onClick={handleSwapSourceDest}
                                className={`p-2 rounded-full shadow-sm border transition-transform hover:scale-110 active:scale-95 z-10 ${isDark ? 'bg-slate-700 border-slate-600 text-sky-400' : 'bg-white border-slate-200 text-sky-600'}`}
                                title="Inverser"
                            >
                                <ArrowRightLeftIcon className="w-5 h-5" />
                            </button>

                            {/* Destination */}
                            <div className="flex-1 text-right">
                                <Label className="text-xs mb-1.5 text-gray-500">Vers (Destination)</Label>
                                <div className={`p-3 rounded-xl font-semibold text-sm border ${isDark ? 'bg-slate-800 border-slate-700 text-gray-200' : 'bg-white border-slate-200 text-gray-800'}`}>
                                    {walletTransferDest}
                                </div>
                            </div>
                        </div>

                        {/* Hidden Selects for Logic (Controlled by the UI above) */}
                        <div className="hidden">
                            <Select value={walletTransferSource} onChange={e => setWalletTransferSource(e.target.value as any)}><option value="Caisse">Caisse</option><option value="BaridiMob">BaridiMob</option></Select>
                            <Select value={walletTransferDest} onChange={e => setWalletTransferDest(e.target.value as any)}><option value="BaridiMob">BaridiMob</option><option value="Caisse">Caisse</option></Select>
                        </div>
                    </div>

                    <div><Label>Notes (Optionnel)</Label><Input value={walletTransferNotes} onChange={e => setWalletTransferNotes(e.target.value)} className={fieldBase} placeholder="Ex: Alimentation caisse..." /></div>
                </DialogContent>
                <DialogFooter>
                    <Button onClick={handleWalletTransfer} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-indigo-500/20 transition-all active:scale-[0.98]">
                        Confirmer le Transfert
                    </Button>
                </DialogFooter>
            </Dialog>

            {/* 2. CLIENT TX MODAL - Updated to use Select for Type d'Actif */}
            <Dialog isOpen={isClientTxModalOpen} onClose={() => setIsClientTxModalOpen(false)} className={`${cardBase} max-w-lg`}>
                <DialogHeader onClose={() => setIsClientTxModalOpen(false)} isDark={isDark}><DialogTitle>{editingClientTx ? "Modifier l'Opération" : "Nouvelle Opération"}</DialogTitle></DialogHeader>
                <DialogContent className="px-6 pb-6 space-y-4">
                    {/* HIDE TYPE SELECTOR IF EDITING OR IF IT WAS PRE-SELECTED FROM DROPDOWN */}
                    {!editingClientTx && (clientTxType === 'Règlement Reçu' || clientTxType === 'Paiement Effectué') && (
                        <div><Label>Type d'Opération</Label><Select id="tx_type_select" value={clientTxType} onChange={e => setClientTxType(e.target.value as any)} className={fieldBase} disabled={!!editingClientTx}><option>Règlement Reçu</option><option>Paiement Effectué</option><option>Vente USDT</option><option>Achat EUR</option></Select></div>
                    )}

                    {/* CLIENT SELECTOR - ALWAYS SHOW FOR NEW OPERATIONS */}
                    {!editingClientTx && (
                        <div>
                            <Label>Client</Label>
                            <Select value={linkedClientId || 'none'} onChange={e => setLinkedClientId(e.target.value)} className={fieldBase}>
                                <option value="none">-- Sélectionner un client --</option>
                                {clientsDzd.map(c => <option key={c.id} value={c.id}>{c.fullName || c.nom}</option>)}
                            </Select>
                        </div>
                    )}

                    {/* SHOW SOURCE SELECTOR FOR PAYMENTS/SETTLEMENTS - AVAILABLE ALWAYS WHEN ADDING NEW */}
                    {(clientTxType === 'Règlement Reçu' || clientTxType === 'Paiement Effectué') && !editingClientTx && (
                        <div>
                            <Label>Type d'Actif (Source/Destination)</Label>
                            <Select value={clientTxSource} onChange={(e) => setClientTxSource(e.target.value as any)} className={fieldBase}>
                                <option value="">-- Aucun (Juste le solde client) --</option>
                                <option value="Caisse">Caisse (Espèces)</option>
                                <option value="BaridiMob">BaridiMob</option>
                            </Select>
                            {clientTxSource && <p className="text-xs mt-1 opacity-70">Le montant sera {clientTxType === 'Règlement Reçu' ? 'ajouté à' : 'déduit de'} {clientTxSource}.</p>}
                        </div>
                    )}

                    {clientTxType === 'Vente USDT' ? (
                        <div className="space-y-4"><div><Label>Quantité USDT</Label><NumberInput value={clientTxUsdtAmount} onChange={e => setClientTxUsdtAmount(e.target.value)} className={fieldBase} /></div><div><Label>Prix de Vente</Label><NumberInput value={clientTxSellPrice} onChange={e => setClientTxSellPrice(e.target.value)} className={fieldBase} /></div></div>
                    ) : clientTxType === 'Achat EUR' ? (
                        <div className="space-y-4"><div><Label>Quantité EUR</Label><NumberInput value={clientTxEurAmount} onChange={e => setClientTxEurAmount(e.target.value)} className={fieldBase} /></div><div><Label>Prix d'Achat</Label><NumberInput value={clientTxEurPrice} onChange={e => setClientTxEurPrice(e.target.value)} className={fieldBase} /></div></div>
                    ) : (
                        <div><Label>Montant (DZD)</Label><div className="relative"><NumberInput value={clientTxAmount} onChange={e => setClientTxAmount(e.target.value)} className={fieldBase} /></div></div>
                    )}
                    <div><Label>Notes (Optionnel)</Label><Input value={clientTxNotes} onChange={e => setClientTxNotes(e.target.value)} className={fieldBase} /></div>
                </DialogContent>
                <DialogFooter><Button onClick={handleSaveClientTx} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl">Sauvegarder</Button></DialogFooter>
            </Dialog>

            {/* 3. TREASURY ADJUSTMENT MODAL */}
            <Dialog isOpen={isAdjustmentModalOpen} onClose={() => setIsAdjustmentModalOpen(false)} className={`${cardBase} max-w-md`}>
                <DialogHeader onClose={() => setIsAdjustmentModalOpen(false)} isDark={isDark}><DialogTitle>Ajustement Trésorerie</DialogTitle></DialogHeader>
                <DialogContent className="px-6 pb-6 space-y-4">
                    <div className="grid grid-cols-2 gap-0 p-1 bg-slate-100 dark:bg-slate-800/50 rounded-xl">
                        <button onClick={() => setAdjustmentTab('add')} className={`py-2.5 rounded-lg font-bold text-sm transition-all ${adjustmentTab === 'add' ? 'bg-[#1E293B] text-white shadow-sm' : 'text-gray-500'}`}>Ajouter (+)</button>
                        <button onClick={() => setAdjustmentTab('subtract')} className={`py-2.5 rounded-lg font-bold text-sm transition-all ${adjustmentTab === 'subtract' ? 'bg-[#1E293B] text-white shadow-sm' : 'text-gray-500'}`}>Retirer (-)</button>
                    </div>
                    <div><Label>Type d'Actif</Label><Select value={adjustmentAsset} onChange={e => setAdjustmentAsset(e.target.value as any)} className={`${fieldBase} h-12 text-base`}><option value="DZD-Caisse">DZD - Caisse</option><option value="DZD-Baridi">DZD - BaridiMob</option><option value="USDT">USDT</option><option value="EUR">EUR</option></Select></div>
                    <div className="relative"><Label>Montant</Label><NumberInput value={adjustmentAmount} onChange={e => setAdjustmentAmount(e.target.value)} className={`${fieldBase} h-14 text-2xl font-bold text-center`} placeholder="0.00" /></div>

                    {/* CLIENT SELECTOR FOR DZD ADJUSTMENTS */}
                    {(adjustmentAsset === 'DZD-Caisse' || adjustmentAsset === 'DZD-Baridi') && (
                        <div className="p-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                            <Label className="mb-1">Lier à un Client (Optionnel)</Label>
                            <Select value={adjustmentClientId} onChange={e => setAdjustmentClientId(e.target.value)} className={fieldBase}>
                                <option value="">-- Aucun / Sans client --</option>
                                {clientsDzd.map(c => <option key={c.id} value={c.id}>{getClientFullName(c)}</option>)}
                            </Select>
                            {adjustmentClientId && <p className="text-xs mt-1 text-blue-400">Une transaction client sera générée automatiquement.</p>}
                        </div>
                    )}

                    <div><Label>Motif</Label><Input value={adjustmentNote} onChange={e => setAdjustmentNote(e.target.value)} className={fieldBase} placeholder="Ex: Alimentation, Frais..." /></div>
                </DialogContent>
                <DialogFooter><Button onClick={handleGlobalAdjustment} className={`w-full rounded-xl font-bold py-3.5 text-white text-lg shadow-lg transition-transform active:scale-95 ${adjustmentTab === 'add' ? 'bg-green-600' : 'bg-red-600'}`}>Confirmer</Button></DialogFooter>
            </Dialog>

            <Dialog isOpen={isTransferModalOpen} onClose={() => setIsTransferModalOpen(false)} className={`${cardBase} max-w-lg`}>
                <DialogHeader onClose={() => setIsTransferModalOpen(false)} isDark={isDark}><DialogTitle>Transfert Client</DialogTitle></DialogHeader>
                <DialogContent className="px-6 pb-6 space-y-4">
                    <div className="p-3 bg-sky-500/10 rounded-lg text-sm text-sky-600 dark:text-sky-400 mb-2">Transfert de dette/crédit entre deux clients.</div>
                    <div><Label>De (Source)</Label><Select value={transferFromClientId} onChange={e => setTransferFromClientId(e.target.value)} className={fieldBase}><option value="">-- Client --</option>{clientsDzd.map(c => <option key={c.id} value={c.id}>{getClientFullName(c)}</option>)}</Select></div>
                    <div><Label>À (Destination)</Label><Select value={transferToClientId} onChange={e => setTransferToClientId(e.target.value)} className={fieldBase}><option value="">-- Client --</option>{clientsDzd.map(c => <option key={c.id} value={c.id}>{getClientFullName(c)}</option>)}</Select></div>
                    <div><Label>Montant</Label><NumberInput value={transferAmount} onChange={e => setTransferAmount(e.target.value)} className={fieldBase} /></div>
                    <div><Label>Notes</Label><Input value={transferNotes} onChange={e => setTransferNotes(e.target.value)} className={fieldBase} /></div>
                </DialogContent>
                <DialogFooter><Button onClick={handleSaveTransfer} disabled={isSaving} className="w-full bg-sky-600 hover:bg-sky-700 text-white font-bold py-3 rounded-xl">Confirmer le Transfert</Button></DialogFooter>
            </Dialog>

            {/* NEW: SETTLEMENT MODAL */}
            <Dialog isOpen={isSettlementModalOpen} onClose={() => setIsSettlementModalOpen(false)} className={`${cardBase} max-w-md`}>
                <DialogHeader onClose={() => setIsSettlementModalOpen(false)} isDark={isDark}>
                    <DialogTitle>{settlementType === 'reçu' ? 'Règlement Client (Reçu)' : 'Paiement Client (Effectué)'}</DialogTitle>
                </DialogHeader>
                <DialogContent className="px-6 pb-6 space-y-4">
                    <div className={`p-3 rounded-lg text-sm mb-2 ${isDark ? 'bg-slate-800' : 'bg-gray-100'}`}>
                        {settlementType === 'reçu'
                            ? "Vous avez reçu de l'argent d'un client (Diminue sa dette / Augmente son avance)."
                            : "Vous avez payé un client (Augmente sa dette / Diminue son avance)."
                        }
                    </div>
                    <div>
                        <Label>Client</Label>
                        <Select value={settlementClientId} onChange={e => setSettlementClientId(e.target.value)} className={fieldBase}>
                            <option value="">-- Sélectionner un client --</option>
                            {clientsDzd.map(c => <option key={c.id} value={c.id}>{getClientFullName(c)}</option>)}
                        </Select>
                    </div>

                    {/* Source Selector */}
                    <div>
                        <Label>Type d'Actif (Source/Destination)</Label>
                        <Select value={settlementSource} onChange={e => setSettlementSource(e.target.value as any)} className={fieldBase}>
                            <option value="">-- Aucun (Juste le solde) --</option>
                            <option value="Caisse">Caisse (Espèces)</option>
                            <option value="BaridiMob">BaridiMob</option>
                        </Select>
                        {settlementSource && <p className="text-xs mt-1 text-blue-400">Le solde de {settlementSource} sera mis à jour.</p>}
                    </div>

                    <div>
                        <Label>Montant</Label>
                        <NumberInput value={settlementAmount} onChange={e => setSettlementAmount(e.target.value)} className={fieldBase} placeholder="0.00" />
                    </div>
                    <div>
                        <Label>Notes</Label>
                        <Input value={settlementNotes} onChange={e => setSettlementNotes(e.target.value)} className={fieldBase} />
                    </div>
                </DialogContent>
                <DialogFooter>
                    <Button onClick={handleSaveSettlement} disabled={isSaving} className={`w-full font-bold py-3 rounded-xl text-white ${settlementType === 'reçu' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
                        Confirmer
                    </Button>
                </DialogFooter>
            </Dialog>

            <Dialog isOpen={isDateFilterModalOpen} onClose={() => setIsDateFilterModalOpen(false)} className={`${cardBase} max-w-md`}>
                <DialogHeader onClose={() => setIsDateFilterModalOpen(false)} isDark={isDark}><DialogTitle>Filtrer par Date</DialogTitle></DialogHeader>
                <DialogContent className="px-6 pb-6 space-y-4"><div><Label>Date début</Label><Input type="date" value={tempStartDate} onChange={e => setTempStartDate(e.target.value)} className={fieldBase} /></div><div><Label>Date fin</Label><Input type="date" value={tempEndDate} onChange={e => setTempEndDate(e.target.value)} className={fieldBase} /></div></DialogContent>
                <DialogFooter><Button onClick={handleClearDateFilter} className={`w-full ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>Effacer</Button><Button onClick={handleApplyDateFilter} className="w-full bg-sky-600 text-white">Appliquer</Button></DialogFooter>
            </Dialog>

            <Dialog isOpen={mode !== null} onClose={closeForm} className={`${cardBase} max-w-lg`}>
                <DialogHeader onClose={closeForm} isDark={isDark}><DialogTitle>{editingTx ? 'Modifier' : (mode === 'sell_usdt' ? 'Ajouter une Transaction' : 'Ajouter Transaction')}</DialogTitle></DialogHeader>
                <DialogContent className="px-6 pb-6 space-y-4">
                    {mode && (
                        <>
                            {mode.startsWith('buy') && !buyUsdtMode && mode !== 'buy_eur' && (
                                <>
                                    <div className="text-center mb-6">
                                        <h3 className="text-lg font-medium mb-1">Comment avez-vous acheté les USDT ?</h3>
                                        <p className={`text-sm ${subtleText}`}>Sélectionnez la devise utilisée</p>
                                    </div>
                                    <div className="space-y-3">
                                        <Button onClick={() => setBuyUsdtMode('with_dzd')} className="w-full bg-teal-600 hover:bg-teal-700 text-white py-4 rounded-xl font-bold shadow-md flex items-center justify-center">
                                            Avec des Dinars (DZD)
                                        </Button>
                                        <Button onClick={() => { setBuyUsdtMode('with_eur'); setEurDzdPrice(portfolioStats.eur.avgBuy.toFixed(2)); }} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold shadow-md flex items-center justify-center">
                                            Avec des Euros (EUR)
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
                                                <Label>Quantité (USDT)</Label>
                                                <NumberInput value={buyUsdtAmount} onChange={e => setBuyUsdtAmount(e.target.value)} className={fieldBase} />
                                            </div>
                                            <div>
                                                <Label>Prix d'achat (DZD)</Label>
                                                <NumberInput value={buyUsdtPrice} onChange={e => setBuyUsdtPrice(e.target.value)} className={fieldBase} />
                                            </div>
                                            <ClientLinker {...{ linkedClientId, setLinkedClientId, openClientModal, clientsDzd, fieldBase, isDark, clientPaymentStatus, setClientPaymentStatus }} />
                                            <div>
                                                <Label>Notes (Optionnel)</Label>
                                                <Input value={notes} onChange={e => setNotes(e.target.value)} className={fieldBase} />
                                            </div>
                                        </>
                                    )}

                                    {/* CASE 1: Buy USDT with EUR (Layout requested by user) */}
                                    {buyUsdtMode === 'with_eur' && (
                                        <>
                                            <div>
                                                <Label>Quantité (EUR)</Label>
                                                <div className="relative">
                                                    <NumberInput value={buyEurForUsdtAmount} onChange={e => setBuyEurForUsdtAmount(e.target.value)} className={fieldBase} />
                                                    <button onClick={() => setBuyEurForUsdtAmount(portfolioStats.eur.available.toString())} className="absolute right-2 top-2 text-xs bg-blue-600 text-white px-2 py-1 rounded">Max</button>
                                                </div>
                                                <p className={`text-xs mt-1 ${subtleText}`}>Solde EUR disponible: {portfolioStats.eur.available.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} EUR</p>
                                            </div>

                                            <div>
                                                <Label>Prix d'achat EUR (DZD)</Label>
                                                <NumberInput value={eurDzdPrice} onChange={e => setEurDzdPrice(e.target.value)} className={fieldBase} />
                                                <p className={`text-xs mt-1 ${subtleText}`}>Basé sur votre PAM EUR actuel</p>
                                            </div>
                                            <div><Label>Taux de change (EUR pour 1 USDT)</Label><NumberInput value={eurUsdtRate} onChange={e => setEurUsdtRate(e.target.value)} className={fieldBase} placeholder="Ex: 0.92" /></div>

                                            <ClientLinker {...{ linkedClientId, setLinkedClientId, openClientModal, clientsDzd, fieldBase, isDark, clientPaymentStatus, setClientPaymentStatus }} />
                                            <div><Label>Notes (Optionnel)</Label><Input value={notes} onChange={e => setNotes(e.target.value)} className={fieldBase} /></div>
                                        </>
                                    )}

                                    {/* CASE 2: Sell USDT */}
                                    {mode === 'sell_usdt' && (
                                        <>
                                            <div>
                                                <Label>Quantité (USDT)</Label>
                                                <div className="relative">
                                                    <NumberInput value={sellAmount} onChange={e => setSellAmount(e.target.value)} className={fieldBase} placeholder="0.00" />
                                                    <button onClick={() => setSellAmount(portfolioStats.usdt.available.toString())} className="absolute right-2 top-2 text-xs bg-sky-600 text-white px-2 py-1 rounded">Max</button>
                                                </div>
                                                <p className={`text-xs mt-1 ${subtleText}`}>Solde disponible: {portfolioStats.usdt.available.toLocaleString()} USDT</p>
                                            </div>

                                            <div>
                                                <Label>Montant Total (DZD)</Label>
                                                <NumberInput value={sellTotal} onChange={() => { }} className={`${fieldBase} bg-opacity-50`} placeholder="Calcul automatique" disabled />
                                            </div>

                                            <div className={`p-3 rounded-lg ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-gray-400">PAM Actuel:</span>
                                                    <span className="font-bold">{portfolioStats.usdt.avgBuy.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD</span>
                                                </div>
                                                <div className="flex justify-between text-sm mt-1">
                                                    <span className="text-yellow-500">Prix Suggéré ({suggestedProfitMargin}%):</span>
                                                    <span className="font-bold text-yellow-500">{(portfolioStats.usdt.avgBuy * (1 + parseAndEvaluate(suggestedProfitMargin) / 100)).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD</span>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
                                                <div><Label>Prix de vente (DZD)</Label><NumberInput value={sellPrice} onChange={e => setSellPrice(e.target.value)} className={fieldBase} /></div>
                                                <div><Label>Marge (%)</Label><Input value={profitPercent} onChange={e => { setProfitPercent(e.target.value); if (parseAndEvaluate(e.target.value) > 0) setSellPrice((portfolioStats.usdt.avgBuy * (1 + parseAndEvaluate(e.target.value) / 100)).toFixed(2)); }} className={fieldBase} placeholder="%" /></div>
                                            </div>
                                            <ClientLinker {...{ linkedClientId, setLinkedClientId, openClientModal, clientsDzd, fieldBase, isDark, clientPaymentStatus, setClientPaymentStatus }} />
                                            <div><Label>Notes (Optionnel)</Label><Input value={notes} onChange={e => setNotes(e.target.value)} className={fieldBase} /></div>
                                        </>
                                    )}

                                    {/* CASE 3: Buy EUR (Standard) - REDESIGNED */}
                                    {mode === 'buy_eur' && (
                                        <div className="space-y-4">
                                            <div>
                                                <Label>Quantité (EUR)</Label>
                                                <NumberInput value={buyEurAmount} onChange={e => setBuyEurAmount(e.target.value)} className={fieldBase} />
                                            </div>
                                            <div>
                                                <Label>Prix d'achat (DZD)</Label>
                                                <NumberInput value={buyEurPrice} onChange={e => setBuyEurPrice(e.target.value)} className={fieldBase} />
                                                <p className={`text-xs mt-1 ${subtleText}`}>Basé sur votre PAM EUR actuel.</p>
                                            </div>
                                            <ClientLinker {...{ linkedClientId, setLinkedClientId, openClientModal, clientsDzd, fieldBase, isDark, clientPaymentStatus, setClientPaymentStatus }} />
                                            <div>
                                                <Label>Notes (Optionnel)</Label>
                                                <Input value={notes} onChange={e => setNotes(e.target.value)} className={fieldBase} />
                                            </div>
                                        </div>
                                    )}

                                    {/* CASE 4: Buy USDT (Standard) */}
                                    {mode === 'buy_usdt' && !buyUsdtMode && (
                                        <div className="space-y-4">
                                            <div>
                                                <Label>Quantité (USDT)</Label>
                                                <NumberInput value={buyUsdtAmount} onChange={e => setBuyUsdtAmount(e.target.value)} className={fieldBase} />
                                            </div>
                                            <div>
                                                <Label>Prix d'achat (DZD)</Label>
                                                <NumberInput value={buyUsdtPrice} onChange={e => setBuyUsdtPrice(e.target.value)} className={fieldBase} />
                                            </div>
                                            <ClientLinker {...{ linkedClientId, setLinkedClientId, openClientModal, clientsDzd, fieldBase, isDark, clientPaymentStatus, setClientPaymentStatus }} />
                                            <div>
                                                <Label>Notes (Optionnel)</Label>
                                                <Input value={notes} onChange={e => setNotes(e.target.value)} className={fieldBase} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </DialogContent>
                <DialogFooter>{(mode !== 'buy_usdt' || buyUsdtMode) && <Button onClick={mode?.startsWith('buy') ? handleBuy : handleSell} className="w-full bg-green-600 text-white font-bold py-3 rounded-xl">Confirmer</Button>}</DialogFooter>
            </Dialog>

            <Dialog isOpen={txToDelete !== null} onClose={() => setTxToDelete(null)} className={cardBase}><DialogHeader isDark={isDark}><DialogTitle>Supprimer?</DialogTitle></DialogHeader><DialogFooter><Button onClick={handleDeleteConfirm} className="bg-red-600 text-white w-full">Oui</Button></DialogFooter></Dialog>
            <Dialog isOpen={isClientModalOpen} onClose={() => setIsClientModalOpen(false)} className={`${cardBase} max-w-md`}>
                <DialogHeader onClose={() => setIsClientModalOpen(false)} isDark={isDark}><DialogTitle>{editingClient ? 'Modifier Client' : 'Nouveau Client'}</DialogTitle></DialogHeader>
                <DialogContent className="px-6 pb-6 space-y-4">
                    <div><Label>Nom complet</Label><Input value={clientFullName} onChange={e => setClientFullName(e.target.value)} className={fieldBase} /></div>
                    <div><Label>Téléphone</Label><Input value={clientPhone} onChange={e => setClientPhone(e.target.value)} className={fieldBase} /></div>
                    <div><Label>RedotPay ID</Label><Input value={clientRedotpayId} onChange={e => setClientRedotpayId(e.target.value)} className={fieldBase} /></div>
                    <div><Label>Binance Email</Label><Input value={clientBinanceEmail} onChange={e => setClientBinanceEmail(e.target.value)} className={fieldBase} /></div>
                    {!editingClient && <div><Label>Solde Initial (DZD)</Label><NumberInput value={initialBalance} onChange={e => setInitialBalance(e.target.value)} className={fieldBase} placeholder="0.00" /></div>}
                </DialogContent>
                <DialogFooter><Button onClick={handleSaveClient} className="w-full bg-green-600 text-white font-bold py-3 rounded-xl">Sauvegarder</Button></DialogFooter>
            </Dialog>

            <Dialog isOpen={clientToDelete !== null} onClose={() => setClientToDelete(null)} className={cardBase}>
                <DialogHeader isDark={isDark}><DialogTitle>Supprimer Client?</DialogTitle></DialogHeader>
                <DialogContent className="p-6"><p>Cette action est irréversible.</p></DialogContent>
                <DialogFooter><Button onClick={handleDeleteClient} className="w-full bg-red-600 text-white font-bold py-3 rounded-xl">Oui, supprimer</Button></DialogFooter>
            </Dialog>

            <Dialog isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} className={`${cardBase} max-w-sm`}>
                <DialogHeader onClose={() => setIsSettingsModalOpen(false)} isDark={isDark}><DialogTitle>Paramètres</DialogTitle></DialogHeader>
                <DialogContent className="px-6 pb-6 space-y-4">
                    <div>
                        <Label>Marge Bénéficiaire (%)</Label>
                        <div className="relative">
                            <NumberInput
                                value={suggestedProfitMargin}
                                onChange={e => setSuggestedProfitMargin(e.target.value)}
                                className={`${fieldBase} text-center text-2xl font-bold`}
                                placeholder="2"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">%</span>
                        </div>
                        <p className={`text-xs mt-2 ${subtleText}`}>Cette marge est utilisée pour calculer le prix de vente suggéré.</p>
                    </div>
                </DialogContent>
                <DialogFooter>
                    <Button onClick={() => setIsSettingsModalOpen(false)} className="w-full bg-sky-600 hover:bg-sky-700 text-white font-bold py-3 rounded-xl">Enregistrer</Button>
                </DialogFooter>
            </Dialog>

            {/* RESET CONFIRMATION MODAL */}
            <Dialog isOpen={isResetModalOpen} onClose={() => setIsResetModalOpen(false)} className={cardBase}>
                <DialogHeader isDark={isDark}><DialogTitle>Réinitialisation Globale</DialogTitle></DialogHeader>
                <DialogContent className="p-6">
                    <p className="text-red-500 font-bold mb-2">ATTENTION : Cette action est irréversible.</p>
                    <p>Vous êtes sur le point de supprimer TOUTES les données de l'application (Transactions, Clients, Trésorerie, etc.).</p>
                    <p className="mt-2">Voulez-vous vraiment recommencer à zéro ?</p>
                </DialogContent>
                <DialogFooter>
                    <Button onClick={() => setIsResetModalOpen(false)} className={`w-full ${isDark ? 'bg-slate-700' : 'bg-slate-200'} mb-2`}>Annuler</Button>
                    <Button onClick={handleGlobalReset} className="w-full bg-red-600 text-white font-bold py-3 rounded-xl">OUI, TOUT EFFACER</Button>
                </DialogFooter>
            </Dialog>

            {/* TREASURY CARD MODAL */}
            <Dialog isOpen={isTreasuryCardModalOpen} onClose={() => setIsTreasuryCardModalOpen(false)} className={`${cardBase} max-w-sm`}>
                <DialogHeader onClose={() => setIsTreasuryCardModalOpen(false)} isDark={isDark}><DialogTitle>{editingTreasuryCard ? 'Modifier Carte' : 'Ajouter une Carte'}</DialogTitle></DialogHeader>
                <DialogContent className="px-6 pb-6 space-y-4">
                    <div><Label>Nom de la carte / Source</Label><Input value={treasuryCardName} onChange={e => setTreasuryCardName(e.target.value)} className={fieldBase} placeholder="Ex: Coffre Fort" /></div>
                    <div><Label>Valeur (DZD)</Label><NumberInput value={treasuryCardValue} onChange={e => setTreasuryCardValue(e.target.value)} className={fieldBase} placeholder="0.00" /></div>
                </DialogContent>
                <DialogFooter><Button onClick={handleSaveTreasuryCard} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl">{editingTreasuryCard ? 'Mettre à jour' : 'Ajouter'}</Button></DialogFooter>
            </Dialog>

            {/* DELETE TREASURY CARD CONFIRMATION */}
            <Dialog isOpen={treasuryCardToDelete !== null} onClose={() => setTreasuryCardToDelete(null)} className={cardBase}>
                <DialogHeader isDark={isDark}><DialogTitle>Supprimer cette carte ?</DialogTitle></DialogHeader>
                <DialogFooter><Button onClick={handleDeleteTreasuryCard} className="bg-red-600 text-white w-full">Supprimer</Button></DialogFooter>
            </Dialog>

        </div>
    );
}
