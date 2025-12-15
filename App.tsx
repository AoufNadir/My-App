
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardHeader, CardContent } from './components/ui/Card';
import { Label } from './components/ui/Label';
import { Input } from './components/ui/Input';
import { Button } from './components/ui/Button';
import { Alert, AlertDescription } from './components/ui/Alert';
import { Select } from './components/ui/Select';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './components/ui/Dialog';

import { Tx, ClientDzd, ClientTransactionDzd, TreasuryTx, TreasuryCard, ManualAsset, ManualAssetClient, ManualAssetTransaction } from './types';
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
import { ManualAssetPage } from './pages/ManualAssetPage';
import { ManualClientPage } from './pages/ManualClientPage';
import { NumberInput } from './components/ui/NumberInput';
import { ReportModal } from './components/ReportModal';
import { BellIcon } from './components/icons/BellIcon';
import { NotificationPanel, Notification } from './components/NotificationPanel';

import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';

// Transaction Service
import { applyTransactionDelete, applyTransactionUpdate } from './src/transactionService';

// I18n
import { LanguageProvider, useLanguage } from './src/contexts/LanguageContext';
import { GlobeIcon } from './components/icons/GlobeIcon';

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
    return (
        <LanguageProvider>
            <AppInner />
        </LanguageProvider>
    );
}

function AppInner() {
    const { t } = useLanguage();
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
                {t('common.loading')}
            </div>
        );
    }

    if (!user) {
        return <Auth />;
    }

    return <MainApp user={user} />;
}

function MainApp({ user }: { user: firebase.User }) {
    const { t, language, setLanguage } = useLanguage();
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

    // ===== REFRESH MECHANISM =====
    const [refreshKey, setRefreshKey] = useState(0);
    const handleRefresh = () => {
        setRefreshKey(prev => prev + 1);
        setAlert('🔄 ' + t('common.refreshing'));
    };

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
    }, [userDocRef, refreshKey]);

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
    const [buyUsdtWithEurTotal, setBuyUsdtWithEurTotal] = useState('');
    const [buyEurAmount, setBuyEurAmount] = useState('');
    const [buyEurPrice, setBuyEurPrice] = useState('');
    const [buyEurTotal, setBuyEurTotal] = useState('');


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
    const [suggestedSellingPrice, setSuggestedSellingPrice] = useState(''); // NEW: سعر البيع المقترح
    const [linkedClientId, setLinkedClientId] = useState('none');

    // ===== NOTIFICATION SYSTEM =====
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);
    const [lastPamValue, setLastPamValue] = useState<number | null>(null);
    const [lastCheckDate, setLastCheckDate] = useState<string>('');

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
    }, [userDocRef, refreshKey]);

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
    }, [userDocRef, refreshKey]);

    const [treasuryTransactions, setTreasuryTransactions] = useState<TreasuryTx[]>([]);
    useEffect(() => {
        const unsubscribe = userDocRef.collection('treasury_txs').orderBy('timestamp', 'asc').onSnapshot((snapshot: firebase.firestore.QuerySnapshot) => {
            setTreasuryTransactions(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as TreasuryTx[]);
        });
        return () => unsubscribe();
    }, [userDocRef, refreshKey]);

    const [treasuryCards, setTreasuryCards] = useState<TreasuryCard[]>([]);
    useEffect(() => {
        const unsubscribe = userDocRef.collection('treasury_cards').onSnapshot((snapshot: firebase.firestore.QuerySnapshot) => {
            setTreasuryCards(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as TreasuryCard[]);
        });
        return () => unsubscribe();
    }, [userDocRef, refreshKey]);

    // ===== MANUAL ASSETS =====
    const [manualAssets, setManualAssets] = useState<ManualAsset[]>([]);
    useEffect(() => {
        const unsubscribe = userDocRef.collection('manual_assets').orderBy('createdAt', 'desc').onSnapshot((snapshot: firebase.firestore.QuerySnapshot) => {
            setManualAssets(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as ManualAsset[]);
        });
        return () => unsubscribe();
    }, [userDocRef, refreshKey]);

    const [manualAssetClients, setManualAssetClients] = useState<ManualAssetClient[]>([]);
    useEffect(() => {
        const unsubscribe = userDocRef.collection('manual_asset_clients').orderBy('fullName', 'asc').onSnapshot((snapshot: firebase.firestore.QuerySnapshot) => {
            setManualAssetClients(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as ManualAssetClient[]);
        });
        return () => unsubscribe();
    }, [userDocRef, refreshKey]);

    const [manualAssetTransactions, setManualAssetTransactions] = useState<ManualAssetTransaction[]>([]);
    useEffect(() => {
        const unsubscribe = userDocRef.collection('actifTransactions').orderBy('timestamp', 'desc').onSnapshot((snapshot: firebase.firestore.QuerySnapshot) => {
            setManualAssetTransactions(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as ManualAssetTransaction[]);
        });
        return () => unsubscribe();
    }, [userDocRef, refreshKey]);

    // Load Settings from Firestore (profit margin + selling price)
    useEffect(() => {
        const loadSettings = async () => {
            try {
                const doc = await userDocRef.get();
                if (doc.exists) {
                    const data = doc.data();
                    if (data?.suggestedProfitMargin !== undefined) {
                        // FIX: Round to 2 decimals when loading
                        const margin = parseFloat(data.suggestedProfitMargin);
                        setSuggestedProfitMargin(margin.toFixed(2));
                    }
                    if (data?.suggestedSellingPrice !== undefined) {
                        // FIX: Round to 2 decimals when loading
                        const sellPrice = parseFloat(data.suggestedSellingPrice);
                        setSuggestedSellingPrice(sellPrice.toFixed(2));
                    }
                }
            } catch (e) {
                console.error('Error loading settings:', e);
            }
        };
        loadSettings();
    }, [userDocRef]);

    // Manual Assets UI State
    const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
    const [selectedAssetClientId, setSelectedAssetClientId] = useState<string | null>(null);

    // Manual Assets Balance Calculations
    const assetBalances = useMemo(() => {
        const map = new Map<string, number>();
        manualAssetTransactions.forEach(tx => {
            const current = map.get(tx.actifId) || 0;
            map.set(tx.actifId, current + tx.amount);
        });
        return map;
    }, [manualAssetTransactions]);

    const assetClientBalances = useMemo(() => {
        const map = new Map<string, number>();
        manualAssetTransactions.forEach(tx => {
            const key = `${tx.actifId}_${tx.clientId}`;
            const current = map.get(key) || 0;
            map.set(key, current + tx.amount);
        });
        return map;
    }, [manualAssetTransactions]);

    // Manual Assets CRUD Functions
    const handleCreateAsset = async (name: string, description?: string) => {
        setIsSaving(true);
        try {
            const now = Date.now();
            await userDocRef.collection('manual_assets').add({
                name: name.trim(),
                description: description?.trim() || '',
                createdAt: now,
                updatedAt: now,
                archived: false
            });
            setAlert('✅ ' + t('common.operationSuccess'));
        } catch (e) {
            console.error(e);
            setAlert('❌ ' + t('common.error'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteAsset = async (assetId: string) => {
        // Check if asset has transactions
        const assetTxCount = manualAssetTransactions.filter(tx => tx.actifId === assetId).length;
        if (assetTxCount > 0) {
            setAlert("⚠️ " + t('common.cannotDeleteHasTransactions'));
            return;
        }

        setIsSaving(true);
        try {
            await userDocRef.collection('manual_assets').doc(assetId).delete();
            setAlert('✅ ' + t('common.operationSuccess'));
            if (selectedAssetId === assetId) setSelectedAssetId(null);
        } catch (e) {
            console.error(e);
            setAlert('❌ ' + t('common.error'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleCreateAssetClient = async (assetId: string, fullName: string, phone?: string, email?: string, notes?: string) => {
        setIsSaving(true);
        try {
            const now = Date.now();
            await userDocRef.collection('manual_asset_clients').add({
                assetId,
                fullName: fullName.trim(),
                phone: phone?.trim() || '',
                email: email?.trim() || '',
                notes: notes?.trim() || '',
                createdAt: now,
                updatedAt: now
            });
            setAlert('✅ ' + t('common.operationSuccess'));
        } catch (e) {
            console.error(e);
            setAlert('❌ ' + t('common.error'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteAssetClient = async (assetId: string, clientId: string) => {
        // Check balance
        const balance = assetClientBalances.get(`${assetId}_${clientId}`) || 0;
        if (Math.abs(balance) > 0.01) {
            setAlert("⚠️ " + t('common.cannotDeleteHasBalance'));
            return;
        }

        setIsSaving(true);
        try {
            await userDocRef.collection('manual_asset_clients').doc(clientId).delete();
            setAlert('✅ ' + t('common.operationSuccess'));
            if (selectedAssetClientId === clientId) setSelectedAssetClientId(null);
        } catch (e) {
            console.error(e);
            setAlert('❌ ' + t('common.error'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleCreateAssetTransaction = async (data: Omit<ManualAssetTransaction, 'id'>) => {
        setIsSaving(true);
        try {
            const batch = db.batch();

            // Ensure numeric amount and remove undefined values
            const rawPayload = {
                ...data,
                amount: Number(data.amount)
            };
            const payload = JSON.parse(JSON.stringify(rawPayload));

            // Create the asset transaction
            const assetTxRef = userDocRef.collection('actifTransactions').doc();
            batch.set(assetTxRef, payload);

            // If payment_received with cash or baridi, create linked treasury transaction
            if (data.type === 'payment_received' && (data.paymentMethod === 'cash' || data.paymentMethod === 'baridi')) {
                // Get client and asset names for notes
                const client = manualAssetClients.find(c => c.id === data.clientId);
                const asset = manualAssets.find(a => a.id === data.actifId);

                const treasuryTxRef = userDocRef.collection('treasury_txs').doc();
                const treasuryPayload = {
                    timestamp: data.timestamp,
                    date: data.date,
                    time: data.time,
                    type: 'Ajout',
                    source: data.paymentMethod === 'cash' ? 'Caisse' : 'BaridiMob',
                    amount: Math.abs(Number(data.amount)),
                    notes: `Paiement de ${client?.fullName || 'Client'} - ${asset?.name || 'Actif'}`,
                    origin: 'manual_asset',
                    linkedAssetTxId: assetTxRef.id
                };
                batch.set(treasuryTxRef, treasuryPayload);

                // Update asset transaction with link to treasury tx
                batch.update(assetTxRef, { linkedTreasuryTxId: treasuryTxRef.id });
            }

            await batch.commit();
            setAlert('✅ ' + t('common.transactionAdded'));
        } catch (e: any) {
            console.error("Error creating transaction:", e);
            console.error("Payload:", JSON.stringify({ ...data, amount: Number(data.amount) }));
            setAlert(`❌ ${t('common.operationFailed')}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteAssetTransaction = async (txId: string) => {
        setIsSaving(true);
        try {
            const batch = db.batch();

            // Get the asset transaction to check for linked treasury tx
            const assetTxDoc = await userDocRef.collection('actifTransactions').doc(txId).get();
            const assetTxData = assetTxDoc.data() as ManualAssetTransaction | undefined;

            // Delete the asset transaction
            batch.delete(userDocRef.collection('actifTransactions').doc(txId));

            // If there's a linked treasury transaction, delete it too
            if (assetTxData?.linkedTreasuryTxId) {
                batch.delete(userDocRef.collection('treasury_txs').doc(assetTxData.linkedTreasuryTxId));
            }

            await batch.commit();
            setAlert('✅ ' + t('common.transactionDeleted'));
        } catch (e) {
            console.error(e);
            setAlert('❌ ' + t('common.error'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleUpdateAssetTransaction = async (txId: string, data: Omit<ManualAssetTransaction, 'id'>) => {
        setIsSaving(true);
        try {
            const batch = db.batch();
            const txRef = userDocRef.collection('actifTransactions').doc(txId);

            // Get existing tx to check for linked treasury tx
            const existingTxDoc = await txRef.get();
            const existingTx = existingTxDoc.data() as ManualAssetTransaction;

            // Ensure numeric amount
            const rawPayload = {
                ...data,
                amount: Number(data.amount)
            };
            const payload = JSON.parse(JSON.stringify(rawPayload));

            batch.update(txRef, payload);

            // Handle linked treasury tx
            if (existingTx?.linkedTreasuryTxId) {
                const treasuryTxRef = userDocRef.collection('treasury_txs').doc(existingTx.linkedTreasuryTxId);

                if (data.type === 'payment_received' && (data.paymentMethod === 'cash' || data.paymentMethod === 'baridi')) {
                    const treasuryPayload = {
                        timestamp: data.timestamp,
                        date: data.date,
                        time: data.time,
                        source: data.paymentMethod === 'cash' ? 'Caisse' : 'BaridiMob',
                        amount: Math.abs(Number(data.amount)),
                        notes: `Paiement de ${manualAssetClients.find(c => c.id === data.clientId)?.fullName || 'Client'} - ${manualAssets.find(a => a.id === data.actifId)?.name || 'Actif'} (Modifié)`,
                    };
                    batch.update(treasuryTxRef, treasuryPayload);
                } else {
                    // If it's no longer a treasury-affecting transaction, delete the linked tx
                    batch.delete(treasuryTxRef);
                    batch.update(txRef, { linkedTreasuryTxId: firebase.firestore.FieldValue.delete() });
                }
            } else if (data.type === 'payment_received' && (data.paymentMethod === 'cash' || data.paymentMethod === 'baridi')) {
                // It didn't have a linked tx, but now it should
                const treasuryTxRef = userDocRef.collection('treasury_txs').doc();
                const treasuryPayload = {
                    timestamp: data.timestamp,
                    date: data.date,
                    time: data.time,
                    type: 'Ajout',
                    source: data.paymentMethod === 'cash' ? 'Caisse' : 'BaridiMob',
                    amount: Math.abs(Number(data.amount)),
                    notes: `Paiement de ${manualAssetClients.find(c => c.id === data.clientId)?.fullName || 'Client'} - ${manualAssets.find(a => a.id === data.actifId)?.name || 'Actif'}`,
                    origin: 'manual_asset',
                    linkedAssetTxId: txId
                };
                batch.set(treasuryTxRef, treasuryPayload);
                batch.update(txRef, { linkedTreasuryTxId: treasuryTxRef.id });
            }

            await batch.commit();
            setAlert('✅ ' + t('common.transactionUpdated'));
        } catch (e: any) {
            console.error("Error updating transaction:", e);
            setAlert(`❌ ${t('common.operationFailed')}`);
        } finally {
            setIsSaving(false);
        }
    };

    // Adjustment Modal
    const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
    const [adjustmentTab, setAdjustmentTab] = useState<'add' | 'subtract'>('add');
    const [adjustmentAsset, setAdjustmentAsset] = useState<'DZD-Caisse' | 'DZD-Baridi' | 'USDT' | 'EUR'>('DZD-Caisse');
    const [adjustmentAmount, setAdjustmentAmount] = useState('');
    const [adjustmentPrice, setAdjustmentPrice] = useState('');
    const [adjustmentNote, setAdjustmentNote] = useState('');
    const [adjustmentClientId, setAdjustmentClientId] = useState('');

    const openAdjustmentModal = (type: 'add' | 'subtract' = 'add', txToEdit: TreasuryTx | null = null) => {
        setEditingTreasuryTx(txToEdit);
        if (txToEdit) {
            setAdjustmentTab(txToEdit.type === 'Ajout' ? 'add' : 'subtract');
            setAdjustmentAmount(txToEdit.amount.toString());
            setAdjustmentNote(txToEdit.notes || '');
            setAdjustmentAsset(txToEdit.source === 'Caisse' ? 'DZD-Caisse' : 'DZD-Baridi');
            setAdjustmentClientId('');
        } else {
            setAdjustmentTab(type);
            setAdjustmentAmount('');
            setAdjustmentPrice('');
            setAdjustmentNote('');
            setAdjustmentAsset('DZD-Caisse');
            setAdjustmentClientId('');
        }
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
            // ALWAYS include Settlement transactions (Règlement Reçu / Paiement Effectué) as they directly affect balance
            if (tx.type === 'Règlement Reçu' || tx.type === 'Paiement Effectué') {
                const current = balances.get(tx.clientId) || 0;
                balances.set(tx.clientId, current + tx.montant);
            }
            // For Sales/Purchases (Vente USDT / Achat EUR), only include if it's a Credit transaction
            else if (!tx.paymentMethod || tx.paymentMethod === 'Crédit') {
                const current = balances.get(tx.clientId) || 0;
                balances.set(tx.clientId, current + tx.montant);
            }
        });
        return balances;
    }, [clientsDzd, clientTransactionsDzd]);

    const clientStats = useMemo(() => {
        let totalDettes = 0;
        let totalAvances = 0;

        // Standard Clients
        clientBalances.forEach(balance => {
            if (balance < 0) totalDettes += balance;
            else if (balance > 0) totalAvances += balance;
        });

        // Manual Assets (Cards)
        assetBalances.forEach(balance => {
            if (balance < 0) totalDettes += balance;
            else if (balance > 0) totalAvances += balance;
        });

        return { totalDettes, totalAvances };
    }, [clientBalances, assetBalances]);

    const [isClientModalOpen, setIsClientModalOpen] = useState(false);
    const [editingClient, setEditingClient] = useState<ClientDzd | null>(null);
    const [clientToDelete, setClientToDelete] = useState<ClientDzd | null>(null);
    const [clientFullName, setClientFullName] = useState('');
    const [clientPhone, setClientPhone] = useState('');
    const [initialBalance, setInitialBalance] = useState('');
    const [clientRedotpayId, setClientRedotpayId] = useState('');
    const [clientBinanceEmail, setClientBinanceEmail] = useState('');
    const [clientBalanceInput, setClientBalanceInput] = useState(''); // NEW: For editing balance

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
    const [simMode, setSimMode] = useState<'dzd' | 'eur' | 'sell_dzd'>('dzd');
    const [simEurQty, setSimEurQty] = useState('');
    const [simEurDzdPrice, setSimEurDzdPrice] = useState('');
    const [simEurUsdtRate, setSimEurUsdtRate] = useState('');
    const [simSellUsdtQty, setSimSellUsdtQty] = useState('');
    const [simSellDzdPrice, setSimSellDzdPrice] = useState('');
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

    // Treasury Tx Edit/Delete
    const [editingTreasuryTx, setEditingTreasuryTx] = useState<TreasuryTx | null>(null);
    const [treasuryTxToDelete, setTreasuryTxToDelete] = useState<TreasuryTx | null>(null);
    const [summaryClient, setSummaryClient] = useState<ClientDzd | null>(null);
    const [isTotalManual, setIsTotalManual] = useState(false); // NEW STATE FOR STRICT TOTAL
    const touchTimer = useRef<any>(null);

    // Treasury Balance Edit Modal
    const [isTreasuryBalanceEditModalOpen, setIsTreasuryBalanceEditModalOpen] = useState(false);
    const [treasuryBalanceEditAsset, setTreasuryBalanceEditAsset] = useState<'Caisse' | 'BaridiMob'>('Caisse');
    const [treasuryBalanceEditValue, setTreasuryBalanceEditValue] = useState('');
    const [treasuryBalanceEditNotes, setTreasuryBalanceEditNotes] = useState('');

    // Create Asset Modal State
    const [isCreateAssetModalOpen, setIsCreateAssetModalOpen] = useState(false);
    const [newAssetName, setNewAssetName] = useState('');
    const [newAssetDescription, setNewAssetDescription] = useState('');

    const openTreasuryBalanceEditModal = (asset: 'Caisse' | 'BaridiMob') => {
        setTreasuryBalanceEditAsset(asset);
        const currentBalance = asset === 'Caisse' ? treasuryStats.caisse : treasuryStats.baridi;
        setTreasuryBalanceEditValue(currentBalance.toString());
        setTreasuryBalanceEditNotes('');
        setIsTreasuryBalanceEditModalOpen(true);
    };

    const handleSaveTreasuryBalanceEdit = async () => {
        const newValue = parseAndEvaluate(treasuryBalanceEditValue);
        if (isNaN(newValue)) { setAlert('⚠️ Valeur invalide.'); return; }

        const currentBalance = treasuryBalanceEditAsset === 'Caisse' ? treasuryStats.caisse : treasuryStats.baridi;
        const diff = newValue - currentBalance;

        if (diff === 0) { setIsTreasuryBalanceEditModalOpen(false); return; }

        setIsSaving(true);
        try {
            const { date, time, timestamp } = now();
            const batch = db.batch();

            // Create Adjustment Transaction
            const type = diff > 0 ? 'Ajout' : 'Retrait';
            const amount = Math.abs(diff);

            batch.set(userDocRef.collection('treasury_txs').doc(), {
                timestamp, date, time,
                type,
                source: treasuryBalanceEditAsset,
                amount,
                notes: treasuryBalanceEditNotes.trim() || `Ajustement manuel du solde (${diff > 0 ? '+' : ''}${diff.toFixed(2)})`,
                origin: 'balance_adjustment'
            });

            await batch.commit();
            setAlert('✅ Solde ajusté avec succès.');
            setIsTreasuryBalanceEditModalOpen(false);
        } catch (e) {
            console.error(e);
            setAlert('❌ Erreur lors de l\'ajustement.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleUpdateAssetClient = async (clientId: string, data: { fullName: string, phone?: string, email?: string, notes?: string, balance?: number }) => {
        setIsSaving(true);
        try {
            const updatePayload: any = {
                fullName: data.fullName.trim(),
                phone: data.phone?.trim() || '',
                email: data.email?.trim() || '',
                notes: data.notes?.trim() || '',
                updatedAt: Date.now()
            };

            await userDocRef.collection('manual_asset_clients').doc(clientId).update(updatePayload);

            // Handle Balance Adjustment
            if (data.balance !== undefined) {
                // Find assetId for this client
                const client = manualAssetClients.find(c => c.id === clientId);
                if (client) {
                    const currentBalance = assetClientBalances.get(`${client.assetId}_${clientId}`) || 0;
                    const diff = data.balance - currentBalance;

                    if (Math.abs(diff) > 0.01) {
                        const now = new Date();
                        await userDocRef.collection('actifTransactions').add({
                            actifId: client.assetId,
                            clientId: clientId,
                            type: 'adjustment',
                            amount: diff,
                            date: now.toLocaleDateString('fr-FR'),
                            time: now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
                            timestamp: now.getTime(),
                            notes: 'Ajustement manuel du solde'
                        });
                    }
                }
            }

            setAlert('✅ Client mis à jour.');
        } catch (e) {
            console.error(e);
            setAlert('❌ Erreur.');
        } finally {
            setIsSaving(false);
        }
    };

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

            // Include Ajout Manuel with price in Cost Basis calculation
            if (tx.type === 'Ajout Manuel' && tx.total && tx.total > 0) {
                stats.purchasedQty += tx.quantity;
                stats.costBasis += tx.total;
            } else if (tx.type === 'buy') {
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

    // ===== NOTIFICATION SYSTEM LOGIC =====
    // 1. Client Debt Alerts (7 & 10+ days)
    const clientDebtAlerts = useMemo(() => {
        const alerts: Notification[] = [];
        const today = new Date();

        clientsDzd.forEach(client => {
            const balance = clientBalances.get(client.id) || 0;
            if (balance >= 0) return; // No debt

            // Find oldest debt transaction
            const clientTxs = clientTransactionsDzd
                .filter(tx => tx.clientId === client.id && tx.montant < 0)
                .sort((a, b) => a.timestamp - b.timestamp);

            if (clientTxs.length === 0) return;

            const oldestDebtDate = new Date(clientTxs[0].timestamp);
            const daysSinceDebt = Math.floor((today.getTime() - oldestDebtDate.getTime()) / (1000 * 60 * 60 * 24));

            // Alert rouge: > 10 jours
            if (daysSinceDebt > 10) {
                alerts.push({
                    id: `debt_critical_${client.id}`,
                    type: 'client_debt_critical',
                    priority: 1,
                    title: 'Dette Cliente Critique',
                    message: `Alerte : le client ${client.fullName || client.nom} a une dette depuis ${daysSinceDebt} jours – montant : ${Math.abs(balance).toFixed(2)} DZD`,
                    timestamp: Date.now(),
                    read: false,
                    color: 'red',
                    data: { clientId: client.id, days: daysSinceDebt, amount: balance }
                });
            }
            // Alert jaune: >= 7 jours (mais <= 10)
            else if (daysSinceDebt >= 7) {
                alerts.push({
                    id: `debt_warning_${client.id}`,
                    type: 'client_debt_warning',
                    priority: 2,
                    title: 'Rappel Dette Client',
                    message: `Rappel : le client ${client.fullName || client.nom} a une dette depuis ${daysSinceDebt} jours, veuillez le suivre.`,
                    timestamp: Date.now(),
                    read: false,
                    color: 'yellow',
                    data: { clientId: client.id, days: daysSinceDebt, amount: balance }
                });
            }
        });

        return alerts;
    }, [clientsDzd, clientBalances, clientTransactionsDzd]);

    // 2. Low Cash Alert
    const lowCashAlert = useMemo(() => {
        const alerts: Notification[] = [];
        const caisseBalance = treasuryStats.caisse;

        if (caisseBalance < 100000) {
            alerts.push({
                id: 'low_cash_alert',
                type: 'low_cash',
                priority: 2,
                title: 'Solde Caisse Faible',
                message: `Alerte : le solde Caisse est inférieur à 100 000.00 DZD (actuel: ${caisseBalance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD)`,
                timestamp: Date.now(),
                read: false,
                color: 'orange',
                data: { balance: caisseBalance }
            });
        }

        return alerts;
    }, [treasuryStats.caisse]);

    // 3. PAM Variation Alert
    const pamVariationAlert = useMemo(() => {
        const alerts: Notification[] = [];
        const currentPam = portfolioStats.usdt.avgBuy;
        const todayDate = new Date().toLocaleDateString('fr-FR');

        // Only check if we have a previous PAM and it's a new day
        if (lastPamValue !== null && lastCheckDate !== todayDate && lastCheckDate !== '') {
            const variation = currentPam - lastPamValue;

            if (Math.abs(variation) >= 5) {
                const isIncrease = variation > 0;
                alerts.push({
                    id: `pam_variation_${todayDate}`,
                    type: 'pam_variation',
                    priority: 2,
                    title: isIncrease ? 'PAM en Hausse' : 'PAM en Baisse',
                    message: isIncrease
                        ? `Le PAM a augmenté de +${variation.toFixed(2)} DA`
                        : `Le PAM a diminué de ${variation.toFixed(2)} DA`,
                    timestamp: Date.now(),
                    read: false,
                    color: isIncrease ? 'blue' : 'red',
                    data: { variation, previousPam: lastPamValue, currentPam }
                });
            }
        }

        return alerts;
    }, [portfolioStats.usdt.avgBuy, lastPamValue, lastCheckDate]);

    // Update last PAM value when day changes
    useEffect(() => {
        const todayDate = new Date().toLocaleDateString('fr-FR');
        if (lastCheckDate !== todayDate) {
            setLastPamValue(portfolioStats.usdt.avgBuy);
            setLastCheckDate(todayDate);
        }
    }, [portfolioStats.usdt.avgBuy, lastCheckDate]);

    // 4. Daily Profit/Loss Alert
    const dailyProfitLossAlert = useMemo(() => {
        const alerts: Notification[] = [];
        const today = new Date().toLocaleDateString('fr-FR');

        // Calculate today's profit/loss from transactions
        const todayTransactions = transactions.filter(tx => tx.date === today && tx.type === 'sell');
        const todayProfit = todayTransactions.reduce((sum, tx) => sum + (tx.profit || 0), 0);

        if (todayProfit >= 5000) {
            alerts.push({
                id: `daily_profit_${today}`,
                type: 'profit_loss',
                priority: 3,
                title: 'Gros Bénéfice Journalier',
                message: `Le bénéfice du jour dépasse +5000.00 DZD (actuel: +${todayProfit.toFixed(2)} DZD)`,
                timestamp: Date.now(),
                read: false,
                color: 'green',
                data: { profit: todayProfit }
            });
        } else if (todayProfit <= -5000) {
            alerts.push({
                id: `daily_loss_${today}`,
                type: 'profit_loss',
                priority: 1,
                title: 'Grosse Perte Journalière',
                message: `La perte du jour dépasse -5000.00 DZD (actuel: ${todayProfit.toFixed(2)} DZD)`,
                timestamp: Date.now(),
                read: false,
                color: 'red',
                data: { loss: todayProfit }
            });
        }

        return alerts;
    }, [transactions]);

    // Combine all notifications and sort by priority + timestamp
    useEffect(() => {
        const allAlerts = [
            ...clientDebtAlerts,
            ...lowCashAlert,
            ...pamVariationAlert,
            ...dailyProfitLossAlert
        ];

        // Sort by priority (1=high first) then by timestamp (newest first)
        allAlerts.sort((a, b) => {
            if (a.priority !== b.priority) return a.priority - b.priority;
            return b.timestamp - a.timestamp;
        });

        setNotifications(allAlerts);
    }, [clientDebtAlerts, lowCashAlert, pamVariationAlert, dailyProfitLossAlert]);


    const getRelativeDateLabel = (dateString: string) => {
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);
        const parts = dateString.split('/');
        const txDate = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
        if (txDate.toDateString() === today.toDateString()) return `${t('transactions.today')} (${dateString})`;
        if (txDate.toDateString() === yesterday.toDateString()) return `${t('transactions.yesterday')} (${dateString})`;
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

    // Helper function to calculate client balance
    const getClientBalance = (clientId: string): number => {
        return clientTransactionsDzd
            .filter(tx => tx.clientId === clientId)
            .reduce((acc, tx) => acc + tx.montant, 0);
    };

    // Calculate balances for transfer clients
    const transferFromBalance = useMemo(() => {
        if (!transferFromClientId) return 0;
        return getClientBalance(transferFromClientId);
    }, [transferFromClientId, clientTransactionsDzd]);

    const transferToBalance = useMemo(() => {
        if (!transferToClientId) return 0;
        return getClientBalance(transferToClientId);
    }, [transferToClientId, clientTransactionsDzd]);

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
        setBuyUsdtTotal(''); setBuyEurTotal(''); setPaymentMethod('Espèces'); setClientPaymentStatus('cash');
        setEditingTx(txToEdit); setMode(newMode); setIsTotalManual(false);
        if (txToEdit) {
            if (txToEdit.type === 'buy') {
                if (txToEdit.currency === 'USDT') { setBuyUsdtMode('with_dzd'); setBuyUsdtAmount(txToEdit.quantity.toString()); setBuyUsdtPrice((txToEdit.price ?? 0).toString()); setBuyUsdtTotal(((txToEdit.quantity || 0) * (txToEdit.price || 0)).toFixed(2)); }
                else {
                    setBuyEurAmount(txToEdit.quantity.toString());
                    setBuyEurPrice((txToEdit.price ?? 0).toString());
                    setBuyEurTotal(((txToEdit.quantity || 0) * (txToEdit.price || 0)).toFixed(2));
                }
            } else {
                setSellAmount(txToEdit.quantity.toString());
                setSellPrice((txToEdit.sell ?? 0).toString());
                setSellTotal(((txToEdit.quantity || 0) * (txToEdit.sell || 0)).toFixed(2));
                // Calculate margin from existing price
                if (portfolioStats.usdt.avgBuy > 0 && txToEdit.sell) {
                    const margin = ((txToEdit.sell - portfolioStats.usdt.avgBuy) / portfolioStats.usdt.avgBuy * 100);
                    setProfitPercent(margin.toFixed(2));
                }
            }
            setNotes(txToEdit.notes ?? '');
            const linkedDzdTx = clientTransactionsDzd.find(t => t.linkedTxId === txToEdit.id);
            let initialPaymentMethod = 'Espèces';
            if (linkedDzdTx) {
                setLinkedClientId(linkedDzdTx.clientId);
                initialPaymentMethod = linkedDzdTx.paymentMethod || 'Espèces';
            }
            if (txToEdit.paymentMethod) {
                initialPaymentMethod = txToEdit.paymentMethod;
            }
            setPaymentMethod(initialPaymentMethod as any);

            // Initialize clientPaymentStatus based on paymentMethod
            if (initialPaymentMethod === 'Crédit') setClientPaymentStatus('credit');
            else if (initialPaymentMethod === 'BaridiMob') setClientPaymentStatus('baridi');
            else setClientPaymentStatus('cash');
        } else {
            if (newMode === 'buy_eur' && portfolioStats.eur.avgBuy > 0) setBuyEurPrice(portfolioStats.eur.avgBuy.toFixed(2));
            // Initialize margin with suggested profit margin for new sell transactions
            if (newMode === 'sell_usdt') {
                setProfitPercent(suggestedProfitMargin);
                // Set suggested price (Fixed Margin Logic)
                const suggestedPrice = portfolioStats.usdt.avgBuy + parseAndEvaluate(suggestedProfitMargin);
                setSellPrice(suggestedPrice.toFixed(2));
            }
        }
    };
    const closeForm = () => { setMode(null); setEditingTx(null); setBuyUsdtMode(null); setSellTotal(''); setBuyUsdtTotal(''); setBuyEurTotal(''); setIsTotalManual(false); };

    const handleBuy = async () => {
        if (!isFormValid || isSaving) return;
        setIsSaving(true); setAlert('');
        try {
            const batch = db.batch();
            let quantity: number, price: number, currency: 'USDT' | 'EUR';
            if (mode === 'buy_usdt') {
                currency = 'USDT';
                if (buyUsdtMode === 'with_dzd') {
                    quantity = parseAndEvaluate(buyUsdtAmount);
                    price = parseAndEvaluate(buyUsdtPrice);
                    // STRICT TOTAL LOGIC: Use manual total if set, otherwise calc
                    if (isTotalManual && buyUsdtTotal) {
                        // If manual total is set, we trust it.
                        // We might need to adjust price or quantity to match, but for now we just use it for the total cost.
                        // Ideally, we should recalculate one of them to be consistent, but user asked for total to be EXACT.
                    }
                }
                else {
                    const eurSpent = parseAndEvaluate(buyEurForUsdtAmount);
                    quantity = usdtFromEurCalc!.usdtQty; price = usdtFromEurCalc!.usdtPriceDzd;
                    batch.set(userDocRef.collection('usdt_txs').doc(), { timestamp: now().timestamp - 1, type: 'Retrait Manuel', currency: 'EUR', quantity: eurSpent, date: now().date, time: now().time, notes: `Achat de ${quantity.toFixed(2)} USDT` });
                }
            } else { currency = 'EUR'; quantity = parseAndEvaluate(buyEurAmount); price = parseAndEvaluate(buyEurPrice); }

            // STRICT TOTAL LOGIC
            let totalCost = quantity * price;
            if (isTotalManual) {
                if (mode === 'buy_usdt' && buyUsdtMode === 'with_dzd') totalCost = parseAndEvaluate(buyUsdtTotal);
                else if (mode === 'buy_eur') totalCost = parseAndEvaluate(buyEurTotal);
                // For EUR to USDT purchases, always use calculated total (no manual total field)
                else if (mode === 'buy_usdt' && buyUsdtMode === 'with_eur' && usdtFromEurCalc) totalCost = usdtFromEurCalc.totalCostDzd;
            } else if (mode === 'buy_usdt' && buyUsdtMode === 'with_eur' && usdtFromEurCalc) {
                // Always use calculated total for EUR purchases
                totalCost = usdtFromEurCalc.totalCostDzd;
            }

            const { date, time, timestamp } = now();

            // TREASURY LOGIC REMOVED FROM HERE - MOVED INSIDE else BLOCK TO ACCESS ref.id

            if (editingTx) {
                batch.update(userDocRef.collection('usdt_txs').doc(editingTx.id), { quantity, price, total: totalCost, notes: notes.trim(), sell: firebase.firestore.FieldValue.delete(), profit: firebase.firestore.FieldValue.delete(), currency, paymentMethod: clientPaymentStatus });

                // 1. Delete linked Client Txs
                const qsClient = await userDocRef.collection('dzd_client_txs').where('linkedTxId', '==', editingTx.id).get();
                qsClient.forEach(d => batch.delete(d.ref));

                // 2. Delete linked Treasury Txs (NEW)
                const qsTreasury = await userDocRef.collection('treasury_txs').where('linkedTxId', '==', editingTx.id).get();
                qsTreasury.forEach(d => batch.delete(d.ref));

                // 3. Re-create Client Tx if Credit
                if (linkedClientId && linkedClientId !== 'none' && clientPaymentStatus === 'credit') {
                    batch.set(userDocRef.collection('dzd_client_txs').doc(), { clientId: linkedClientId, timestamp, date, time, montant: totalCost, type: 'Règlement Reçu', notes: `Financement achat de ${quantity.toFixed(2)} ${currency}`, linkedTxId: editingTx.id, paymentMethod: 'Crédit' });
                }

                // 4. Re-create Treasury Tx if NOT Credit (NEW)
                if (buyUsdtMode !== 'with_eur' && clientPaymentStatus !== 'credit') {
                    const source = clientPaymentStatus === 'baridi' ? 'BaridiMob' : 'Caisse';
                    batch.set(userDocRef.collection('treasury_txs').doc(), { timestamp, date, time, type: 'Retrait', source, amount: totalCost, notes: `Achat ${quantity.toFixed(2)} ${currency}`, linkedTxId: editingTx.id });
                }
                setAlert('✅ Transaction mise à jour.');
            } else {
                const ref = userDocRef.collection('usdt_txs').doc();
                batch.set(ref, { timestamp, type: 'buy', quantity, price, total: totalCost, date, time, notes: notes.trim(), currency, paymentMethod: clientPaymentStatus });

                // TREASURY LOGIC: Only if NOT Credit (Baridi or Cash)
                // MOVED HERE to access ref.id
                if (buyUsdtMode !== 'with_eur' && clientPaymentStatus !== 'credit') {
                    const source = clientPaymentStatus === 'baridi' ? 'BaridiMob' : 'Caisse';
                    batch.set(userDocRef.collection('treasury_txs').doc(), { timestamp, date, time, type: 'Retrait', source, amount: totalCost, notes: `Achat ${quantity.toFixed(2)} ${currency}`, linkedTxId: ref.id });
                }

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
            let quantity = parseAndEvaluate(sellAmount);
            quantity = Number(quantity.toFixed(2)); // Enforce 2 decimals
            const sell = parseAndEvaluate(sellPrice);
            const avg = portfolioStats.usdt.avgBuy;
            const profit = (sell - avg) * quantity;
            const totalInput = parseAndEvaluate(sellTotal);

            // STRICT TOTAL LOGIC
            let totalRevenue = quantity * sell;
            if (isTotalManual && totalInput > 0) {
                totalRevenue = totalInput;
            } else if (totalInput > 0 && !isTotalManual) {
                // Fallback if user didn't trigger manual flag but field has value (shouldn't happen with new logic but safe)
                totalRevenue = totalInput;
            }

            const { date, time, timestamp } = now(); const batch = db.batch();

            // TREASURY LOGIC REMOVED FROM HERE - MOVED INSIDE else BLOCK TO ACCESS ref.id

            if (editingTx) {
                batch.update(userDocRef.collection('usdt_txs').doc(editingTx.id), { quantity, sell, profit, notes: notes.trim(), price: firebase.firestore.FieldValue.delete(), total: firebase.firestore.FieldValue.delete(), currency: 'USDT', paymentMethod: clientPaymentStatus });

                // 1. Delete linked Client Txs
                const qsClient = await userDocRef.collection('dzd_client_txs').where('linkedTxId', '==', editingTx.id).get();
                qsClient.forEach(d => batch.delete(d.ref));

                // 2. Delete linked Treasury Txs (NEW)
                const qsTreasury = await userDocRef.collection('treasury_txs').where('linkedTxId', '==', editingTx.id).get();
                qsTreasury.forEach(d => batch.delete(d.ref));

                // 3. Re-create Client Tx if Credit
                if (linkedClientId && linkedClientId !== 'none' && clientPaymentStatus === 'credit') {
                    batch.set(userDocRef.collection('dzd_client_txs').doc(), { clientId: linkedClientId, timestamp, date, time, montant: -totalRevenue, type: 'Vente USDT', notes: `Vente de ${quantity.toFixed(2)} USDT @ ${sell.toFixed(2)}`, linkedTxId: editingTx.id, paymentMethod: 'Crédit' });
                }

                // 4. Re-create Treasury Tx if NOT Credit (NEW)
                if (clientPaymentStatus !== 'credit') {
                    const source = clientPaymentStatus === 'baridi' ? 'BaridiMob' : 'Caisse';
                    batch.set(userDocRef.collection('treasury_txs').doc(), { timestamp, date, time, type: 'Ajout', source, amount: totalRevenue, notes: `Vente ${quantity.toFixed(2)} USDT`, linkedTxId: editingTx.id });
                }
                setAlert('✅ Transaction mise à jour.');
            } else {
                const ref = userDocRef.collection('usdt_txs').doc();
                batch.set(ref, { timestamp, type: 'sell', quantity, sell, profit, date, time, notes: notes.trim(), currency: 'USDT', paymentMethod: clientPaymentStatus });

                // TREASURY LOGIC: Only if NOT Credit (Baridi or Cash)
                // MOVED HERE to access ref.id
                if (clientPaymentStatus !== 'credit') {
                    const source = clientPaymentStatus === 'baridi' ? 'BaridiMob' : 'Caisse';
                    batch.set(userDocRef.collection('treasury_txs').doc(), { timestamp, date, time, type: 'Ajout', source, amount: totalRevenue, notes: `Vente ${quantity.toFixed(2)} USDT`, linkedTxId: ref.id });
                }

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

        setIsSaving(true);
        try {
            // Use centralized transaction service for consistent deletion
            const result = await applyTransactionDelete(txToDelete.id, 'usdt_tx', userDocRef);

            if (result.success) {
                setAlert('✅ Supprimé.');
            } else {
                setAlert(`❌ ${result.error || 'Erreur lors de la suppression.'}`);
            }
        } catch (e) {
            console.error(e);
            setAlert('❌ Erreur.');
        } finally {
            setIsSaving(false);
            setTxToDelete(null);
        }
    };
    const openClientModal = (client: ClientDzd | null = null) => {
        setEditingClient(client);
        if (client) {
            setClientFullName(client.fullName || client.nom);
            setClientPhone(client.phone || '');
            setClientRedotpayId(client.redotpayId || '');
            setClientBinanceEmail(client.binanceEmail || '');
            // Pre-fill with current balance
            const bal = clientBalances.get(client.id) || 0;
            setClientBalanceInput(bal.toString());
        } else {
            setClientFullName('');
            setClientPhone('');
            setClientRedotpayId('');
            setClientBinanceEmail('');
            setInitialBalance('');
            setClientBalanceInput('');
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

                // NEW: Handle Balance Adjustment
                const currentBal = clientBalances.get(editingClient.id) || 0;
                const newBal = parseAndEvaluate(clientBalanceInput);

                // Only create adjustment if valid number and value changed
                if (!isNaN(newBal) && Math.abs(newBal - currentBal) > 0.01) {
                    const diff = newBal - currentBal;
                    const { date, time, timestamp } = now();

                    await userDocRef.collection('dzd_client_txs').add({
                        clientId: editingClient.id,
                        timestamp, date, time,
                        montant: diff,
                        type: 'Ajustement Solde',
                        notes: 'Mise à jour manuelle du solde',
                        paymentMethod: 'Crédit'
                    });
                }

                setAlert('✅ Client modifié.');
            } else {
                // NEW: Validation for duplicate clients
                const duplicateClient = clientsDzd.find(c => {
                    if (data.fullName && c.fullName && c.fullName.toLowerCase() === data.fullName.toLowerCase()) return true;
                    if (data.phone && c.phone && c.phone === data.phone) return true;
                    if (data.redotpayId && c.redotpayId && c.redotpayId === data.redotpayId) return true;
                    if (data.binanceEmail && c.binanceEmail && c.binanceEmail.toLowerCase() === data.binanceEmail.toLowerCase()) return true;
                    return false;
                });

                if (duplicateClient) {
                    setAlert('⚠️ Ce client existe déjà. Veuillez vérifier les informations.');
                    setIsSaving(false);
                    return;
                }

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

        // NEW: Check Balance Restriction
        const bal = clientBalances.get(clientToDelete.id) || 0;
        if (Math.abs(bal) > 0.01) {
            setAlert("⚠️ Impossible de supprimer : Le client possède un solde non nul. Veuillez le régulariser avant suppression.");
            setClientToDelete(null);
            return;
        }

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
                const priceNum = parseAndEvaluate(adjustmentPrice);
                const total = priceNum > 0 ? amountNum * priceNum : 0;

                const txData: any = {
                    timestamp, type, currency: adjustmentAsset, quantity: amountNum, date, time,
                    notes: adjustmentNote || 'Ajustement Manuel'
                };

                if (priceNum > 0) {
                    txData.price = priceNum;
                    txData.total = total;
                }

                batch.set(userDocRef.collection('usdt_txs').doc(), txData);
            } else {
                // Treasury Adjustment
                const type = adjustmentTab === 'add' ? 'Ajout' : 'Retrait';
                const source = adjustmentAsset === 'DZD-Caisse' ? 'Caisse' : 'BaridiMob';
                const note = adjustmentNote || 'Ajustement Trésorerie';

                if (editingTreasuryTx) {
                    batch.update(userDocRef.collection('treasury_txs').doc(editingTreasuryTx.id), {
                        type, source, amount: amountNum, notes: note
                    });
                } else {
                    // Create Treasury Tx
                    const treasuryTxRef = userDocRef.collection('treasury_txs').doc();
                    batch.set(treasuryTxRef, { timestamp, date, time, type, source, amount: amountNum, notes: note });

                    // LINKED CLIENT LOGIC (Only for new adjustments for now)
                    if (adjustmentClientId) {
                        const client = clientsDzd.find(c => c.id === adjustmentClientId);
                        if (client) {
                            const clientTxType = adjustmentTab === 'add' ? 'Règlement Reçu' : 'Paiement Effectué';
                            const clientAmount = adjustmentTab === 'add' ? amountNum : -amountNum;

                            batch.set(userDocRef.collection('dzd_client_txs').doc(), {
                                clientId: adjustmentClientId, timestamp, date, time,
                                montant: clientAmount, type: clientTxType,
                                notes: `${note} (${source})`,
                                linkedTxId: treasuryTxRef.id, // STRICT LINKING
                                origin: 'adjustment'
                            });
                        }
                    }
                }
            }
            await batch.commit();
            setAlert(editingTreasuryTx ? '✅ ' + t('common.transactionUpdated') : '✅ ' + t('common.operationSuccess')); setIsAdjustmentModalOpen(false);
        } catch (error) { console.error(error); setAlert("❌ " + t('common.error')); }
    };

    const handleSwapSourceDest = () => {
        setWalletTransferSource(walletTransferDest);
        setWalletTransferDest(walletTransferSource);
    };

    const handleWalletTransfer = async () => {
        const amount = parseAndEvaluate(walletTransferAmount);
        if (amount <= 0 || isNaN(amount)) { setAlert("⚠️ " + t('common.invalidAmount')); return; }
        if (walletTransferSource === walletTransferDest) { setAlert("⚠️ " + t('common.sameSourceDest')); return; }

        const sourceBalance = walletTransferSource === 'Caisse' ? treasuryStats.caisse : treasuryStats.baridi;
        if (sourceBalance <= 0) { setAlert(`⚠️ ${t('common.insufficientBalance')} (0).`); return; }
        if (amount > sourceBalance) { setAlert(`⚠️ ${t('common.insufficientBalance')}.`); return; }

        const { date, time, timestamp } = now();
        try {
            const batch = db.batch();
            const note = walletTransferNotes.trim() || `Virement ${walletTransferSource} -> ${walletTransferDest}`;

            // Remove from Source
            batch.set(userDocRef.collection('treasury_txs').doc(), { timestamp, date, time, type: 'Retrait', source: walletTransferSource, amount: amount, notes: note });

            // Add to Destination
            batch.set(userDocRef.collection('treasury_txs').doc(), { timestamp: timestamp + 1, date, time, type: 'Ajout', source: walletTransferDest, amount: amount, notes: note });

            await batch.commit();
            setAlert('✅ ' + t('common.operationSuccess')); setIsWalletTransferModalOpen(false);
            setWalletTransferAmount(''); setWalletTransferNotes('');
        } catch (e) { console.error(e); setAlert('❌ ' + t('common.error')); }
    };

    const handleWalletTransferMaxClick = () => {
        const sourceBalance = walletTransferSource === 'Caisse' ? treasuryStats.caisse : treasuryStats.baridi;
        if (sourceBalance > 0) {
            setWalletTransferAmount(sourceBalance.toFixed(2));
        } else {
            setAlert(`⚠️ ${t('common.insufficientBalance')}.`);
        }
    };

    const openClientTxModal = (tx: ClientTransactionDzd | null = null, presetType?: string) => {
        setEditingClientTx(tx);
        if (tx) {
            setClientTxAmount(Math.abs(tx.montant).toString());
            setClientTxType(tx.type);
            setClientTxNotes(tx.notes || '');
            setClientTxSource('');
            // Initialize payment status from existing transaction
            if (tx.paymentMethod === 'Crédit' || !tx.paymentMethod) {
                setClientPaymentStatus('credit');
            } else if (tx.paymentMethod === 'Espèces') {
                setClientPaymentStatus('cash');
            } else if (tx.paymentMethod === 'BaridiMob') {
                setClientPaymentStatus('baridi');
            }
        } else {
            setClientTxAmount('');
            setClientTxType(presetType || 'Règlement Reçu');
            setClientTxNotes('');
            setClientTxSource('');
            setClientPaymentStatus('credit');
            setLinkedClientId(selectedClientId || 'none'); // Pre-fill with selected client if in client detail view
        }
        setIsClientTxModalOpen(true);
    };

    const handleSaveClientTx = async () => {
        const targetClientId = linkedClientId !== 'none' ? linkedClientId : selectedClientId;
        if (!targetClientId || targetClientId === 'none') { setAlert('⚠️ Veuillez sélectionner un client.'); return; }

        // SIMPLIFIED LOGIC: Just save Amount and Notes. No auto-calc, no restrictions.
        const amount = parseAndEvaluate(clientTxAmount);
        if (isNaN(amount)) { setAlert('⚠️ Montant invalide.'); return; }

        setIsSaving(true);
        try {
            const { date, time, timestamp } = now();
            const batch = db.batch();

            if (editingClientTx) {
                // Update existing
                batch.update(userDocRef.collection('dzd_client_txs').doc(editingClientTx.id), {
                    montant: amount, // Allow negative/positive as is
                    notes: clientTxNotes.trim(),
                });
                setAlert('✅ ' + t('common.transactionUpdated'));
            } else {
                // Create new
                batch.set(userDocRef.collection('dzd_client_txs').doc(), {
                    clientId: targetClientId,
                    timestamp, date, time,
                    montant: amount,
                    type: clientTxType,
                    notes: clientTxNotes.trim(),
                    paymentMethod: 'Crédit'
                });
                setAlert('✅ ' + t('common.transactionAdded'));
            }

            await batch.commit();
            setIsClientTxModalOpen(false);
            setEditingClientTx(null);
        } catch (e) { console.error(e); setAlert('❌ ' + t('common.error')); } finally { setIsSaving(false); }
    };

    const handleDeleteClientTx = async () => {
        if (!clientTxToDelete) return;

        // 1. Check if it's a CHILD transaction (linked to an Adjustment)
        if (clientTxToDelete.origin === 'adjustment') {
            setAlert('⚠️ ' + t('common.cannotDeleteHasTransactions'));
            setClientTxToDelete(null);
            return;
        }

        setIsSaving(true);
        try {
            // Use centralized transaction service for consistent deletion
            const result = await applyTransactionDelete(clientTxToDelete.id, 'client_tx', userDocRef);

            if (result.success) {
                setAlert('✅ ' + t('common.transactionDeleted'));
            } else {
                setAlert(`❌ ${t('common.error')}`);
            }
        } catch (e) {
            console.error(e);
            setAlert('❌ Erreur.');
        } finally {
            setIsSaving(false);
            setClientTxToDelete(null);
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

            await batch.commit(); setAlert('✅ ' + t('common.operationSuccess')); setIsTransferModalOpen(false); setTransferAmount(''); setTransferFromClientId(''); setTransferToClientId(''); setTransferNotes('');
        } catch (e) { setAlert('❌ ' + t('common.error')); } finally { setIsSaving(false); }
    };

    const handleGlobalReset = async () => {
        setIsSaving(true);
        try {
            // Delete all collections
            const collections = ['usdt_txs', 'treasury_txs', 'dzd_clients', 'dzd_client_txs', 'treasury_cards', 'manual_assets', 'manual_asset_clients', 'actifTransactions'];

            for (const col of collections) {
                const qs = await userDocRef.collection(col).get();
                // Delete in batches of 400 to avoid limit
                let batch = db.batch();
                let count = 0;

                for (const doc of qs.docs) {
                    batch.delete(doc.ref);
                    count++;
                    if (count >= 400) {
                        await batch.commit();
                        batch = db.batch();
                        count = 0;
                    }
                }
                if (count > 0) await batch.commit();
            }

            // Reset settings in main doc
            await userDocRef.set({ settingsUpdatedAt: Date.now() });

            setAlert('✅ ' + t('common.operationSuccess'));
            setIsResetModalOpen(false);
            window.location.reload();
        } catch (e) {
            console.error(e);
            setAlert('❌ ' + t('common.operationFailed'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleBackup = async () => {
        setIsSaving(true);
        try {
            const collections = ['usdt_txs', 'treasury_txs', 'dzd_clients', 'dzd_client_txs', 'treasury_cards'];
            const data: any = {};

            for (const col of collections) {
                const snapshot = await userDocRef.collection(col).get();
                data[col] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            }

            const backup = {
                timestamp: Date.now(),
                date: new Date().toISOString(),
                data: data
            };

            const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const dateStr = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
            a.download = `backup_${dateStr}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            setAlert('✅ ' + t('common.operationSuccess'));
        } catch (e) {
            console.error(e);
            setAlert('❌ ' + t('common.operationFailed'));
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
                setAlert('✅ ' + t('common.operationSuccess'));
            } else {
                await userDocRef.collection('treasury_cards').add({ name: treasuryCardName.trim(), value: val });
                setAlert('✅ ' + t('common.operationSuccess'));
            }
            setIsTreasuryCardModalOpen(false);
            setTreasuryCardName(''); setTreasuryCardValue(''); setEditingTreasuryCard(null);
        } catch (e) { setAlert('❌ ' + t('common.error')); } finally { setIsSaving(false); }
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
            setAlert('✅ ' + t('common.operationSuccess'));
            setTreasuryCardToDelete(null);
        } catch (e) { setAlert('❌ ' + t('common.error')); }
    };

    const handleDeleteTreasuryTxConfirm = async () => {
        if (!treasuryTxToDelete) return;

        // 1. Check if it's a CHILD transaction (linked to a Client Tx, USDT Tx, or Manual Asset)
        // If origin is 'client_tx', 'usdt_tx', or 'manual_asset', it's a child -> Prevent Delete
        // Fallback: if linkedTxId exists but no origin, assume it's a child (safe default for old data)
        // Restriction removed as requested by user.
        // if (treasuryTxToDelete.origin === 'client_tx' || treasuryTxToDelete.origin === 'usdt_tx' || treasuryTxToDelete.origin === 'manual_asset' || (treasuryTxToDelete.linkedTxId && !treasuryTxToDelete.origin)) {
        //     setAlert('⚠️ Impossible de supprimer : Cette transaction est liée. Supprimez la transaction d\'origine.');
        //     setTreasuryTxToDelete(null);
        //     return;
        // }

        setIsSaving(true);
        try {
            // Use centralized transaction service for consistent deletion
            const result = await applyTransactionDelete(treasuryTxToDelete.id, 'treasury_tx', userDocRef);

            if (result.success) {
                setAlert('✅ ' + t('common.transactionDeleted'));
            } else {
                setAlert(`❌ ${t('common.error')}`);
            }
        } catch (e) {
            console.error(e);
            setAlert('❌ ' + t('common.error'));
        } finally {
            setIsSaving(false);
            setTreasuryTxToDelete(null);
        }
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
            if (l) {
                // Found linked USDT/EUR transaction - edit it
                openForm(l.type === 'buy' ? (l.currency === 'USDT' ? 'buy_usdt' : 'buy_eur') : 'sell_usdt', l);
            } else {
                // Linked transaction not found (orphaned) - allow direct edit of client transaction
                openClientTxModal(tx);
            }
        } else {
            // Independent client transaction - edit directly
            openClientTxModal(tx);
        }
    };
    const handleDeleteClientTxClick = (tx: ClientTransactionDzd) => {
        if (tx.linkedTxId) { const l = transactions.find(t => t.id === tx.linkedTxId); if (l) setTxToDelete(l); else { setClientTxToDelete(tx); setAlert("⚠️ Transaction orpheline."); } }
        else setClientTxToDelete(tx);
    };

    const handleClientDeleteRequest = (client: ClientDzd | null) => {
        if (!client) { setClientToDelete(null); return; }
        const bal = clientBalances.get(client.id) || 0;
        if (Math.abs(bal) > 0.01) {
            setAlert("⚠️ " + t('common.cannotDeleteHasBalance'));
        } else {
            setClientToDelete(client);
        }
    };
    const ClientLinker = ({ isEditing, linkedClientId, setLinkedClientId, openClientModal, clientsDzd, fieldBase, isDark, clientPaymentStatus, setClientPaymentStatus }: any) => {

        return (
            <div className="pb-2 space-y-2">
                <div>
                    <Label htmlFor="link_client_buy">Lier à un client DZD (Optionnel)</Label>
                    <div className="flex items-center gap-2">
                        <Select id="link_client_buy" value={linkedClientId} onChange={(e: any) => setLinkedClientId(e.target.value)} className={`${fieldBase} focus:ring-amber-400 rounded-xl flex-grow`}>
                            <option value="none">Aucun / Sans client</option>
                            {clientsDzd.map((c: any) => (<option key={c.id} value={c.id}>{c.fullName || c.nom}</option>))}
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
    };
    const ActionInputButton = ({ onClick, children }: any) => (<Button type="button" onClick={onClick} className="absolute right-1 top-1/2 -translate-y-1/2 h-8 px-3 text-xs bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 rounded-md z-10">{children}</Button>);

    const getClientFullName = (client: ClientDzd) => client.fullName || (client.prenom ? `${client.nom} ${client.prenom}` : client.nom);
    const handleTouchStart = (c: ClientDzd) => {
        touchTimer.current = setTimeout(() => {
            setSummaryClient(c);
        }, 800);
    };
    const handleTouchEnd = () => {
        if (touchTimer.current) {
            clearTimeout(touchTimer.current);
            touchTimer.current = null;
        }
    };
    const handleExportClientReport = (cId: string, m: number, y: number) => { /* ... */ };
    const handleExportUsdtReport = () => { /* ... */ };
    const openDateFilterModal = () => { setTempStartDate(dateRange.start ? dateRange.start.toISOString().split('T')[0] : ''); setTempEndDate(dateRange.end ? dateRange.end.toISOString().split('T')[0] : ''); setIsDateFilterModalOpen(true); };
    const handleApplyDateFilter = () => { if (tempStartDate && tempEndDate) { const s = new Date(tempStartDate); s.setHours(0, 0, 0, 0); const e = new Date(tempEndDate); e.setHours(23, 59, 59, 999); setDateRange({ start: s, end: e }); setIsDateFilterModalOpen(false); } else setAlert('⚠️ Dates incomplètes.'); };
    const handleClearDateFilter = () => { setDateRange({ start: null, end: null }); setIsDateFilterModalOpen(false); };

    const newPamFromDzdSimulator = useMemo(() => {
        const qty = parseAndEvaluate(simBuyQty);
        const price = parseAndEvaluate(simBuyPrice);
        if (qty <= 0 || price <= 0) return null;
        const newCost = qty * price;
        const totalCost = portfolioStats.usdt.costBasis + newCost;
        const totalQty = portfolioStats.usdt.purchasedQty + qty;
        if (totalQty <= 0) return 0;
        return totalCost / totalQty;
    }, [simBuyQty, simBuyPrice, portfolioStats.usdt]);

    const newPamFromEurSimulator = useMemo(() => {
        const eurQty = parseAndEvaluate(simEurQty);
        const eurPriceDzd = parseAndEvaluate(simEurDzdPrice);
        const rate = parseAndEvaluate(simEurUsdtRate);
        if (eurQty <= 0 || eurPriceDzd <= 0 || rate <= 0) return null;

        // Correct formula: TotalUSDT = AmountEUR / TauxEUR_USDT
        const newUsdtQty = eurQty / rate;
        const pricePerUSDT = eurPriceDzd * rate;
        const newCostDzd = newUsdtQty * pricePerUSDT;

        const totalCost = portfolioStats.usdt.costBasis + newCostDzd;
        const totalQty = portfolioStats.usdt.purchasedQty + newUsdtQty;

        if (totalQty <= 0) return 0;
        return totalCost / totalQty;
    }, [simEurQty, simEurDzdPrice, simEurUsdtRate, portfolioStats.usdt]);

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
                            <NavLink activeView={view} targetView="transactions" colorClass="bg-indigo-600">{t('nav.transactions')}</NavLink>
                            <NavLink activeView={view} targetView="statistiques" colorClass="bg-teal-600">{t('nav.portfolio')}</NavLink>
                            <NavLink activeView={view} targetView="dzd" colorClass="bg-sky-600">{t('nav.clients')}</NavLink>
                            <NavLink activeView={view} targetView="tresorerie" colorClass="bg-emerald-600">{t('nav.treasury')}</NavLink>
                        </div>
                        <div className="flex items-center gap-1 sm:gap-2">
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
                                    {notifications.filter(n => !n.read).length > 0 && (
                                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                                            {notifications.filter(n => !n.read).length}
                                        </span>
                                    )}
                                </Button>

                                {/* Notification Panel */}
                                {isNotificationPanelOpen && (
                                    <NotificationPanel
                                        notifications={notifications}
                                        onClose={() => setIsNotificationPanelOpen(false)}
                                        onMarkAsRead={(id) => {
                                            setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
                                        }}
                                        onMarkAllAsRead={() => {
                                            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
                                        }}
                                        isDark={isDark}
                                    />
                                )}
                            </div>

                            <Button onClick={() => setTheme(isDark ? 'light' : 'dark')} className={`p-2 rounded-full transition-colors ${isDark ? 'text-gray-300 hover:bg-white/10' : 'text-gray-600 hover:bg-black/5'}`}>{isDark ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}</Button>
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
                                <MobileNavLink targetView="transactions" icon={<BriefcaseIcon className="w-6 h-6" />} colorClass="text-indigo-500">{t('nav.transactions')}</MobileNavLink>
                                <MobileNavLink targetView="statistiques" icon={<WalletIcon className="w-6 h-6" />} colorClass="text-teal-500">{t('nav.portfolio')}</MobileNavLink>
                                <MobileNavLink targetView="dzd" icon={<UsersIcon className="w-6 h-6" />} colorClass="text-sky-500">{t('nav.clients')}</MobileNavLink>
                                <MobileNavLink targetView="tresorerie" icon={<LandmarkIcon className="w-6 h-6" />} colorClass="text-emerald-500">{t('nav.treasury')}</MobileNavLink>
                            </div>
                        </MotionDiv>
                    )}
                </AnimatePresence>

                <main className="py-6">
                    <AnimatePresence>{alert && (<MotionDiv initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="mb-4"><Alert className={`rounded-xl ${alert.includes('✅') || alert.includes('⚠️') ? (isDark ? 'bg-green-900/50 border-green-400/30 text-green-300' : 'bg-green-50 border-green-300 text-green-800') : (isDark ? 'bg-red-900/50 border-red-400/30 text-red-300' : 'bg-red-50 border-red-300 text-red-800')}`}><AlertDescription>{alert}</AlertDescription></Alert></MotionDiv>)}</AnimatePresence>

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
                        openWalletTransferModal={() => setIsWalletTransferModalOpen(true)}
                        openTransferModal={() => setIsTransferModalOpen(true)}
                        treasuryTransactions={treasuryTransactions}
                        handleEditClientTx={handleEditClientTx}
                        handleDeleteClientTxClick={handleDeleteClientTxClick}
                        setTreasuryTxToDelete={setTreasuryTxToDelete}
                    />}

                    {view === 'statistiques' && <PortfolioPage {...{ statsView, setStatsView, isDark, setIsSettingsModalOpen, cardBase, subtleText, portfolioStats, totalPortfolioValue: (portfolioStats.usdt.available * portfolioStats.usdt.avgBuy + portfolioStats.eur.available * portfolioStats.eur.avgBuy), suggestedProfitMargin, suggestedSellingPrice, parseAndEvaluate, usdtReportMonth, setUsdtReportMonth, usdtReportYear, setUsdtReportYear, reportMonths: (y: number) => y === new Date().getFullYear() ? (Array.isArray(t('common.months')) ? t('common.months') as any as string[] : []).slice(0, new Date().getMonth() + 1) : (Array.isArray(t('common.months')) ? t('common.months') as any as string[] : []), reportYears: Array.from({ length: 3 }, (_, i) => 2024 + i), monthlyStats: { totalUsdtSoldMonth: 0, totalEurBoughtMonth: 0, realizedProfitMonth: 0, monthlyProfitMargin: 0 }, transactions, selectedHeatmapDay, setSelectedHeatmapDay, simMode, setSimMode, simBuyQty, setSimBuyQty, simBuyPrice, setSimBuyPrice, fieldBase, newPamFromDzdSimulator, simEurQty, setSimEurQty, simEurDzdPrice, setSimEurDzdPrice, simEurUsdtRate, setSimEurUsdtRate, newPamFromEurSimulator, handleExportUsdtReport, dzdDashboardStats: null, reportClient, setReportClient, clientsDzd, getClientFullName, reportMonth, setReportMonth, reportYear, setReportYear, handleExportClientReport, simSellUsdtQty, setSimSellUsdtQty, simSellDzdPrice, setSimSellDzdPrice }} />}

                    {view === 'dzd' && <ClientsPage {...{ selectedClientId, setSelectedClientId, cardBase, fieldBase, isDark, subtleText, openClientModal, setIsTransferModalOpen, clientSearchQuery, setClientSearchQuery, clientSortMode, setClientSortMode, filteredClientsDzd, clientBalances: clientBalances, getClientFullName, handleTouchStart, handleTouchEnd, setClientToDelete: handleClientDeleteRequest, selectedClient, selectedClientTransactions, transactions, handleExportClientReport, openClientTxModal, copiedValue, handleCopy, handleEditClientTx, handleDeleteClientTxClick }} />}

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
                                onCreateClient={(fullName, phone, email, notes) => handleCreateAssetClient(selectedAssetId, fullName, phone, email, notes)}
                                onUpdateClient={handleUpdateAssetClient}
                                onDeleteClient={(clientId) => handleDeleteAssetClient(selectedAssetId, clientId)}
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
                                    totalDettes: clientStats.totalDettes,
                                    totalAvances: clientStats.totalAvances,
                                    portfolioValue: (portfolioStats.usdt.available * portfolioStats.usdt.avgBuy + portfolioStats.eur.available * portfolioStats.eur.avgBuy),
                                    openTreasuryModal: () => openAdjustmentModal('add'),
                                    treasuryCards,
                                    openTreasuryCardModal,
                                    setTreasuryCardToDelete,
                                    openTreasuryBalanceEditModal,
                                    manualAssets,
                                    manualAssetClients,
                                    assetBalances,
                                    onOpenManualAsset: (asset) => setSelectedAssetId(asset.id),
                                    onOpenCreateManualAsset: () => setIsCreateAssetModalOpen(true),
                                    onDeleteManualAsset: handleDeleteAsset
                                }}
                            />
                        )
                    )}
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
                <DialogHeader onClose={() => setIsWalletTransferModalOpen(false)} isDark={isDark}><DialogTitle>{t('transactions.internalTransfer')}</DialogTitle></DialogHeader>
                <DialogContent className="px-6 pb-6 space-y-6">

                    {/* 1. AMOUNT (Top & Prominent) with MAX Button */}
                    <div className="relative pb-4 border-b border-gray-200 dark:border-gray-700">
                        <Label className="text-center w-full block mb-2 text-gray-500 dark:text-gray-400 uppercase tracking-wider text-xs">{t('transactions.transferAmount')}</Label>
                        <div className="relative max-w-[240px] mx-auto">
                            <NumberInput
                                value={walletTransferAmount}
                                onChange={e => setWalletTransferAmount(e.target.value)}
                                className={`${fieldBase} text-center text-3xl font-bold h-16 bg-transparent border-b-2 border-sky-500/30 focus:border-sky-500 rounded-none px-12`}
                                placeholder="0.00"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-sm">DZD</span>
                            <button
                                onClick={handleWalletTransferMaxClick}
                                className={`absolute left-2 top-1/2 -translate-y-1/2 text-xs font-bold px-2.5 py-1 rounded-md transition-all ${isDark ? 'bg-sky-600 text-white hover:bg-sky-700' : 'bg-sky-500 text-white hover:bg-sky-600'} shadow-sm hover:shadow-md active:scale-95`}
                                title={t('common.max')}
                            >
                                {t('common.max')}
                            </button>
                        </div>
                    </div>

                    {/* 2. SOURCE -> DESTINATION (Swappable Row) with Balances */}
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/50 relative">
                        <div className="flex items-center justify-between gap-4">
                            {/* Source */}
                            <div className="flex-1">
                                <Label className="text-xs mb-1.5 text-gray-500">{t('transactions.from')} ({t('common.source')})</Label>
                                <div className={`p-3 rounded-xl font-semibold text-sm border ${isDark ? 'bg-slate-800 border-slate-700 text-gray-200' : 'bg-white border-slate-200 text-gray-800'}`}>
                                    {walletTransferSource}
                                </div>
                                {/* Balance Display */}
                                <p className={`text-xs mt-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                    {t('common.balance')}: <span className="font-semibold">{(walletTransferSource === 'Caisse' ? treasuryStats.caisse : treasuryStats.baridi).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD</span>
                                </p>
                            </div>

                            {/* Swap Button - Enhanced */}
                            <button
                                onClick={handleSwapSourceDest}
                                className={`p-3 rounded-full shadow-lg border-2 transition-all duration-200 hover:scale-110 hover:shadow-xl active:scale-95 z-10 ${isDark ? 'bg-gradient-to-br from-slate-700 to-slate-800 border-sky-500/50 text-sky-400 hover:border-sky-400' : 'bg-gradient-to-br from-white to-gray-50 border-sky-400/50 text-sky-600 hover:border-sky-500'}`}
                                title="Inverser Source et Destination"
                            >
                                <ArrowRightLeftIcon className="w-6 h-6" />
                            </button>

                            {/* Destination */}
                            <div className="flex-1 text-right">
                                <Label className="text-xs mb-1.5 text-gray-500">{t('transactions.to')} ({t('common.destination')})</Label>
                                <div className={`p-3 rounded-xl font-semibold text-sm border ${isDark ? 'bg-slate-800 border-slate-700 text-gray-200' : 'bg-white border-slate-200 text-gray-800'}`}>
                                    {walletTransferDest}
                                </div>
                                {/* Balance Display */}
                                <p className={`text-xs mt-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                    {t('common.balance')}: <span className="font-semibold">{(walletTransferDest === 'Caisse' ? treasuryStats.caisse : treasuryStats.baridi).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD</span>
                                </p>
                            </div>
                        </div>

                        {/* Hidden Selects for Logic (Controlled by the UI above) */}
                        <div className="hidden">
                            <Select value={walletTransferSource} onChange={e => setWalletTransferSource(e.target.value as any)}><option value="Caisse">Caisse</option><option value="BaridiMob">BaridiMob</option></Select>
                            <Select value={walletTransferDest} onChange={e => setWalletTransferDest(e.target.value as any)}><option value="BaridiMob">BaridiMob</option><option value="Caisse">Caisse</option></Select>
                        </div>
                    </div>

                    {/* 3. Notes Section */}
                    <div><Label>{t('common.notesOptional')}</Label><Input value={walletTransferNotes} onChange={e => setWalletTransferNotes(e.target.value)} className={fieldBase} placeholder="" /></div>
                </DialogContent>
                <DialogFooter>
                    {/* Enhanced Confirmation Button */}
                    <Button
                        onClick={handleWalletTransfer}
                        disabled={isSaving}
                        className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-bold py-4 rounded-xl shadow-xl shadow-indigo-500/30 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isSaving ? (
                            <>
                                <RefreshCwIcon className="w-5 h-5 animate-spin" />
                                {t('common.processing')}
                            </>
                        ) : (
                            <>
                                <ArrowRightLeftIcon className="w-5 h-5" />
                                {t('transactions.confirmTransfer')}
                            </>
                        )}
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
                        <div><Label>{t('transactions.operationType')}</Label><Select id="tx_type_select" value={clientTxType} onChange={e => setClientTxType(e.target.value as any)} className={fieldBase} disabled={!!editingClientTx}><option value="Règlement Reçu">{t('transactions.paymentReceived')}</option><option value="Paiement Effectué">{t('transactions.paymentMade')}</option><option value="Vente USDT">{t('transactions.sellUsdt')}</option><option value="Achat EUR">{t('transactions.buyEur')}</option></Select></div>
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
                <DialogFooter><Button onClick={handleSaveClientTx} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl">{t('common.save')}</Button></DialogFooter>
            </Dialog>

            {/* 3. TREASURY ADJUSTMENT MODAL */}
            <Dialog isOpen={isAdjustmentModalOpen} onClose={() => setIsAdjustmentModalOpen(false)} className={`${cardBase} max-w-md`}>
                <DialogHeader onClose={() => setIsAdjustmentModalOpen(false)} isDark={isDark}><DialogTitle>{editingTreasuryTx ? t('transactions.editAdjustment') : t('transactions.treasuryAdjustment')}</DialogTitle></DialogHeader>
                <DialogContent className="px-6 pb-6 space-y-4">
                    <div className="grid grid-cols-2 gap-0 p-1 bg-slate-100 dark:bg-slate-800/50 rounded-xl">
                        <button onClick={() => setAdjustmentTab('add')} className={`py-2.5 rounded-lg font-bold text-sm transition-all ${adjustmentTab === 'add' ? 'bg-[#1E293B] text-white shadow-sm' : 'text-gray-500'}`}>{t('transactions.addTo')}</button>
                        <button onClick={() => setAdjustmentTab('subtract')} className={`py-2.5 rounded-lg font-bold text-sm transition-all ${adjustmentTab === 'subtract' ? 'bg-[#1E293B] text-white shadow-sm' : 'text-gray-500'}`}>{t('transactions.withdrawFrom')}</button>
                    </div>
                    <div><Label>{t('transactions.assetType')}</Label><Select value={adjustmentAsset} onChange={e => setAdjustmentAsset(e.target.value as any)} className={`${fieldBase} h-12 text-base`}><option value="DZD-Caisse">{t('common.dinar')} - {t('transactions.cash')}</option><option value="DZD-Baridi">{t('common.dinar')} - {t('transactions.baridi')}</option><option value="USDT">USDT</option><option value="EUR">EUR</option></Select></div>

                    <div className="relative">
                        <Label>{adjustmentAsset === 'USDT' || adjustmentAsset === 'EUR' ? t('transactions.quantity') : t('transactions.amount')}</Label>
                        <div className="relative">
                            <NumberInput
                                value={adjustmentAmount}
                                onChange={e => setAdjustmentAmount(e.target.value)}
                                className={fieldBase}
                                placeholder="0.00"
                            />
                            {/* MAX BUTTON */}
                            {(adjustmentAsset === 'DZD-Caisse' || adjustmentAsset === 'DZD-Baridi') && (
                                (adjustmentTab === 'subtract') || (adjustmentTab === 'add' && adjustmentClientId)
                            ) && (
                                    <button
                                        onClick={() => {
                                            if (adjustmentTab === 'subtract') {
                                                const bal = adjustmentAsset === 'DZD-Caisse' ? treasuryStats.caisse : treasuryStats.baridi;
                                                setAdjustmentAmount(bal.toString());
                                            } else if (adjustmentTab === 'add' && adjustmentClientId) {
                                                const clientBal = Math.abs(clientBalances.get(adjustmentClientId) || 0);
                                                setAdjustmentAmount(clientBal.toString());
                                            }
                                        }}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-xs bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700 transition-colors"
                                    >
                                        MAX
                                    </button>
                                )}
                        </div>
                    </div>

                    {(adjustmentAsset === 'USDT' || adjustmentAsset === 'EUR') && (
                        <div><Label>{t('transactions.unitPrice')}</Label><NumberInput value={adjustmentPrice} onChange={e => setAdjustmentPrice(e.target.value)} className={fieldBase} placeholder="Ex: 240.00" /></div>
                    )}

                    {/* CLIENT SELECTOR FOR DZD ADJUSTMENTS */}
                    {(adjustmentAsset === 'DZD-Caisse' || adjustmentAsset === 'DZD-Baridi') && (
                        <div className="p-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                            <Label className="mb-1">{t('transactions.linkedClientOptional')}</Label>
                            <Select value={adjustmentClientId} onChange={e => setAdjustmentClientId(e.target.value)} className={fieldBase}>
                                <option value="">-- {t('common.notes')} --</option>
                                {clientsDzd.map(c => <option key={c.id} value={c.id}>{getClientFullName(c)}</option>)}
                            </Select>
                            {adjustmentClientId && (
                                <div className="flex justify-between items-center mt-1">
                                    <p className="text-xs text-blue-400">{t('transactions.clientTxGenerated')}</p>
                                    <p className={`text-xs font-bold ${subtleText}`}>
                                        {t('common.balance')}: {(clientBalances.get(adjustmentClientId) || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {t('common.dinar')}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    <div><Label>{t('transactions.reason')}</Label><Input value={adjustmentNote} onChange={e => setAdjustmentNote(e.target.value)} className={fieldBase} placeholder="Ex: Alimentation, Frais..." /></div>
                </DialogContent>
                <DialogFooter><Button onClick={handleGlobalAdjustment} className={`w-full rounded-xl font-bold py-3.5 text-white text-lg shadow-lg transition-transform active:scale-95 ${adjustmentTab === 'add' ? 'bg-green-600' : 'bg-red-600'}`}>{t('transactions.confirm')}</Button></DialogFooter>
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
                            {transferToClientId && (
                                <button
                                    onClick={() => setTransferAmount(Math.abs(transferToBalance).toString())}
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
                            inputMode="decimal"
                            value={treasuryBalanceEditValue}
                            onChange={e => setTreasuryBalanceEditValue(e.target.value)}
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
                                                                setBuyUsdtTotal((qty * price).toFixed(2));
                                                            } else if (qty === 0 || e.target.value === '') {
                                                                setBuyUsdtTotal('');
                                                            }
                                                        }
                                                    }}
                                                    className={fieldBase}
                                                />
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
                                                                setBuyUsdtTotal((qty * price).toFixed(2));
                                                            } else if (price === 0 || e.target.value === '') {
                                                                setBuyUsdtTotal('');
                                                            }
                                                        }
                                                    }}
                                                    className={fieldBase}
                                                />
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
                                                            if (qty > 0 && price > 0) setBuyUsdtTotal((qty * price).toFixed(2));
                                                        }
                                                    }}
                                                    className={fieldBase}
                                                    placeholder={t('transactions.autoCalc')}
                                                />
                                                <p className={`text-xs mt-1 ${subtleText}`}>{t('transactions.autoCalc')}</p>
                                            </div>
                                            <ClientLinker {...{ isEditing: !!editingTx, linkedClientId, setLinkedClientId, openClientModal, clientsDzd, fieldBase, isDark, clientPaymentStatus, setClientPaymentStatus }} />
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
                                                        className={fieldBase}
                                                    />
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
                                            </div>
                                            <div>
                                                <Label>{t('portfolio.rateEurUsdt')}</Label>
                                                <NumberInput
                                                    value={eurUsdtRate}
                                                    onChange={e => {
                                                        setEurUsdtRate(e.target.value);
                                                    }}
                                                    className={fieldBase}
                                                    placeholder="Ex: 0.92"
                                                />
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
                                                                    setSellTotal((qty * price).toFixed(2));
                                                                }
                                                            }
                                                        }}
                                                        className={fieldBase}
                                                        placeholder="0.00"
                                                    />
                                                    <button onClick={() => {
                                                        setSellAmount(portfolioStats.usdt.available.toString());
                                                        const price = parseAndEvaluate(sellPrice);
                                                        if (price > 0) {
                                                            setSellTotal((portfolioStats.usdt.available * price).toFixed(2));
                                                        }
                                                    }} className="absolute right-2 top-2 text-xs bg-sky-600 text-white px-2 py-1 rounded">{t('common.max')}</button>
                                                </div>
                                                <p className={`text-xs mt-1 ${subtleText}`}>{t('common.balance')}: {portfolioStats.usdt.available.toLocaleString()} USDT</p>
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
                                                                setSellAmount((total / price).toFixed(4));
                                                            }
                                                        } else {
                                                            setIsTotalManual(false);
                                                            // Immediate auto-calc when cleared
                                                            const qty = parseAndEvaluate(sellAmount);
                                                            const price = parseAndEvaluate(sellPrice);
                                                            if (qty > 0 && price > 0) setSellTotal((qty * price).toFixed(2));
                                                        }
                                                    }}
                                                    className={fieldBase}
                                                    placeholder="0.00"
                                                />
                                            </div>

                                            <div className={`p-3 rounded-lg ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-gray-400">{t('portfolio.currentPam')}:</span>
                                                    <span className="font-bold">{portfolioStats.usdt.avgBuy.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {t('common.dinar')}</span>
                                                </div>
                                                <div className="flex justify-between text-sm mt-1">
                                                    <span className="text-yellow-500">{t('portfolio.suggestedPrice')} (+{suggestedProfitMargin} DA):</span>
                                                    <span className="font-bold text-yellow-500">{(portfolioStats.usdt.avgBuy + parseAndEvaluate(suggestedProfitMargin)).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {t('common.dinar')}</span>
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
                                                                setSellTotal((qty * price).toFixed(2));
                                                            }

                                                            // Update margin when price changes
                                                            if (portfolioStats.usdt.avgBuy > 0 && price > 0) {
                                                                const margin = price - portfolioStats.usdt.avgBuy;
                                                                setProfitPercent(margin.toFixed(2));
                                                            }
                                                        }}
                                                        className={fieldBase}
                                                    />
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
                                                                    setSellTotal((qty * newPrice).toFixed(2));
                                                                }
                                                            }
                                                        }}
                                                        className={fieldBase}
                                                        placeholder="DZD"
                                                    />
                                                </div>
                                            </div>
                                            <ClientLinker {...{ isEditing: !!editingTx, linkedClientId, setLinkedClientId, openClientModal, clientsDzd, fieldBase, isDark, clientPaymentStatus, setClientPaymentStatus }} />
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
                                                                setBuyEurTotal((qty * price).toFixed(2));
                                                            } else if (qty === 0 || e.target.value === '') {
                                                                setBuyEurTotal('');
                                                            }
                                                        }
                                                    }}
                                                    className={fieldBase}
                                                />
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
                                                                setBuyEurTotal((qty * price).toFixed(2));
                                                            } else if (price === 0 || e.target.value === '') {
                                                                setBuyEurTotal('');
                                                            }
                                                        }
                                                    }}
                                                    className={fieldBase}
                                                />
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
                                                            if (qty > 0 && price > 0) setBuyEurTotal((qty * price).toFixed(2));
                                                        }
                                                    }}
                                                    className={fieldBase}
                                                    placeholder={t('transactions.autoCalc')}
                                                />
                                                <p className={`text-xs mt-1 ${subtleText}`}>{t('transactions.autoCalc')}</p>
                                            </div>
                                            <ClientLinker {...{ linkedClientId, setLinkedClientId, openClientModal, clientsDzd, fieldBase, isDark, clientPaymentStatus, setClientPaymentStatus }} />
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
                </DialogContent>
                <DialogFooter>{(mode !== 'buy_usdt' || buyUsdtMode) && <Button onClick={mode?.startsWith('buy') ? handleBuy : handleSell} className="w-full bg-green-600 text-white font-bold py-3 rounded-xl">{t('transactions.confirm')}</Button>}</DialogFooter>
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
                        handleCreateAsset(newAssetName, newAssetDescription);
                        setIsCreateAssetModalOpen(false);
                        setNewAssetName('');
                        setNewAssetDescription('');
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
                <DialogFooter><Button onClick={handleSaveTreasuryCard} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl">{editingTreasuryCard ? t('transactions.update') : t('transactions.add')}</Button></DialogFooter>
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
                    <Button onClick={handleDeleteTreasuryCard} className="bg-red-600 text-white w-full font-bold py-3 rounded-xl">{t('common.delete')}</Button>
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
                                const canvas = await html2canvas(modalContent as HTMLElement, {
                                    backgroundColor: isDark ? '#111827' : '#ffffff',
                                    scale: 2
                                });

                                canvas.toBlob(async (blob) => {
                                    if (!blob) { setAlert('❌ ' + t('common.error')); return; }

                                    const file = new File([blob], `releve_${summaryClient.phone || 'client'}.png`, { type: 'image/png' });

                                    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                                        try {
                                            await navigator.share({
                                                files: [file],
                                                title: t('transactions.clientStatement'),
                                                text: `${t('transactions.statementOf')} ${getClientFullName(summaryClient)}`
                                            });
                                        } catch (e) {
                                            console.error(e);
                                            setAlert('❌ ' + t('transactions.shareCancelled'));
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
                                }, 'image/png');
                            } catch (e) {
                                console.error(e);
                                setAlert('❌ ' + t('transactions.captureError'));
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

        </div>
    );
}
