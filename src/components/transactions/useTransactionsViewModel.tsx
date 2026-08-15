import { useEffect, useMemo, useState } from 'react';
import { Tx, ClientDzd, ClientTransactionDzd, TreasuryTx } from '../../types';
import { computePamLedger } from '../../utils/pamLedger';
import type { PamLedgerResult } from '../../utils/pamLedger';
import { ArrowDownLeftIcon } from '../icons/ArrowDownLeftIcon';
import { ArrowUpRightIcon } from '../icons/ArrowUpRightIcon';
import { UsersIcon } from '../icons/UsersIcon';
import { WalletIcon } from '../icons/WalletIcon';
import { formatDzd, formatNumber } from '../../pages/shared/pageFormat';
import { getClientOperationLabel, getClientTransferDetails, getManualClientNote, getPortfolioOperationLabel, getTreasuryOperationLabel } from '../../utils/transactionTerminology';
import { DisplayRawTx, DisplayTx, SavedTransactionFilter, TransactionFilterMode } from './transactionsTypes';
const SAVED_FILTERS_STORAGE_KEY = 'tx_saved_filters_v1';
const ALL_FILTER_MODES: TransactionFilterMode[] = [
    'all',
    'buy_usdt_dzd',
    'buy_usdt_eur',
    'buy_eur_dzd',
    'sell_usdt_dzd',
    'sell_usdt_eur',
    'sell_eur_dzd',
    'stock',
    'stock_in',
    'stock_out',
    'client_receipts',
    'client_receipts_cash',
    'client_receipts_baridi',
    'client_receipts_credit',
    'client_payouts',
    'client_payouts_cash',
    'client_payouts_baridi',
    'client_payouts_credit',
    'client_adjustments',
    'client_transfers',
    'treasury_in_cash',
    'treasury_in_baridi',
    'treasury_out_cash',
    'treasury_out_baridi',
    'treasury_transfers',
    'buy',
    'sell',
    'adjustments',
    'client_payments',
    'treasury_in',
    'treasury_out',
    'clients',
    'treasury'
];
function isCryptoBuy(rawTx: DisplayRawTx): rawTx is Tx {
    return (rawTx as Tx).type === 'buy';
}
function isCryptoSell(rawTx: DisplayRawTx): rawTx is Tx {
    return (rawTx as Tx).type === 'sell';
}
function isCryptoManual(rawTx: DisplayRawTx): rawTx is Tx {
    const type = (rawTx as Tx).type;
    return type === 'Ajout Manuel' || type === 'Retrait Manuel';
}
function isClientTransfer(rawTx: DisplayRawTx) {
    const type = (rawTx as ClientTransactionDzd).type;
    return type === 'Transfert Entrant' || type === 'Transfert Sortant';
}
function isClientTxLinkedToPortfolio(tx: ClientTransactionDzd, portfolioTxIds: Set<string>) {
    return Boolean(tx.linkedTxId && portfolioTxIds.has(tx.linkedTxId));
}
function isClientTxLinkedToClient(tx: ClientTransactionDzd, clientTxIds: Set<string>) {
    return Boolean(tx.linkedTxId && clientTxIds.has(tx.linkedTxId));
}
function isInternalTreasuryEffect(tx: TreasuryTx) {
    const normalizedNotes = normalizeText(tx.notes);
    const isLinkedPortfolioTreasuryEffect = Boolean(tx.linkedTxId)
        && (
            tx.origin === 'usdt_tx'
            || tx.origin === 'client_tx'
            || normalizedNotes.startsWith('achat ')
            || normalizedNotes.startsWith('vente ')
        );
    return isLinkedPortfolioTreasuryEffect
        || Boolean(tx.linkedAssetTxId && tx.origin === 'manual_asset')
        || tx.origin === 'personal_expense_return';
}
function getTreasuryEffectDirection(tx: TreasuryTx) {
    return tx.type === 'Ajout' || tx.type === 'Adjustment (+)' ? 'in' : 'out';
}
function getTreasuryEffectWallet(tx: TreasuryTx) {
    const data = tx as TreasuryTx & { asset?: string };
    return data.source || data.destination || data.asset || '';
}
function findClientTransferCounterpart(tx: ClientTransactionDzd, clientTransactionsDzd: ClientTransactionDzd[]) {
    if (tx.type !== 'Transfert Sortant' && tx.type !== 'Transfert Entrant')
        return null;
    if (tx.linkedTxId) {
        const linked = clientTransactionsDzd.find((candidate) => candidate.id === tx.linkedTxId);
        if (linked)
            return linked;
    }
    const counterpartType = tx.type === 'Transfert Sortant' ? 'Transfert Entrant' : 'Transfert Sortant';
    const counterpartAmount = -Number(tx.montant || 0);
    return clientTransactionsDzd
        .filter((candidate) => candidate.id !== tx.id
        && candidate.clientId !== tx.clientId
        && candidate.type === counterpartType
        && candidate.date === tx.date
        && candidate.time === tx.time
        && Math.abs(Number(candidate.montant || 0) - counterpartAmount) <= 0.01
        && Math.abs(Number(candidate.timestamp || 0) - Number(tx.timestamp || 0)) <= 2000)
        .sort((left, right) => Math.abs(Number(left.timestamp || 0) - Number(tx.timestamp || 0))
        - Math.abs(Number(right.timestamp || 0) - Number(tx.timestamp || 0)))[0] || null;
}
function isTreasuryTransfer(rawTx: DisplayRawTx) {
    const tx = rawTx as TreasuryTx;
    return tx.type === 'Transfer' || Boolean(tx.notes?.includes('Virement'));
}
function isTreasuryEntry(rawTx: DisplayRawTx): rawTx is TreasuryTx {
    const tx = rawTx as TreasuryTx;
    return !isTreasuryTransfer(tx) && (tx.type === 'Ajout' || tx.type === 'Adjustment (+)');
}
function isTreasuryExit(rawTx: DisplayRawTx): rawTx is TreasuryTx {
    const tx = rawTx as TreasuryTx;
    return !isTreasuryTransfer(tx) && (tx.type === 'Retrait' || tx.type === 'Adjustment (-)');
}
function normalizeText(value?: string) {
    return (value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}
function compactText(value?: string) {
    return normalizeText(value).replace(/[^a-z0-9]+/g, '');
}
function normalizePaymentMethod(value?: string): 'cash' | 'baridi' | 'credit' | null {
    const normalized = normalizeText(value);
    const compact = compactText(value);
    if (!normalized)
        return null;
    if (normalized.includes('baridi'))
        return 'baridi';
    if (normalized.includes('espe') || normalized.includes('cash') || normalized.includes('caisse'))
        return 'cash';
    if (normalized.includes('credit') || compact.includes('crdit'))
        return 'credit';
    return null;
}
function getTreasuryWallet(rawTx: TreasuryTx): 'cash' | 'baridi' | null {
    const tx = rawTx as TreasuryTx & {
        asset?: string;
    };
    const normalized = normalizeText([tx.source, tx.asset].filter(Boolean).join(' '));
    if (normalized.includes('baridi'))
        return 'baridi';
    if (normalized.includes('caisse') || normalized.includes('cash'))
        return 'cash';
    return null;
}
function isClientReceipt(rawTx: ClientTransactionDzd) {
    const normalizedType = normalizeText(rawTx.type);
    if (isClientAdjustment(rawTx) || isClientTransfer(rawTx))
        return false;
    return normalizedType.includes('reglement') || rawTx.type === 'Règlement Reçu' || Number(rawTx.montant || 0) > 0;
}
function isClientPayout(rawTx: ClientTransactionDzd) {
    const normalizedType = normalizeText(rawTx.type);
    if (isClientAdjustment(rawTx) || isClientTransfer(rawTx))
        return false;
    return normalizedType.includes('paiement') || rawTx.type === 'Paiement Effectué' || Number(rawTx.montant || 0) < 0;
}
function isClientAdjustment(rawTx: ClientTransactionDzd) {
    const normalizedType = normalizeText(rawTx.type);
    return !isClientTransfer(rawTx)
        && (normalizedType.includes('solde') || normalizedType.includes('ajustement'));
}

function matchesTransactionFilter(mode: TransactionFilterMode, tx: DisplayTx) {
    const rawTx = tx.rawTx;
    switch (mode) {
        case 'all':
            return true;
        case 'buy':
            return tx.sourceType === 'usdt_tx' && isCryptoBuy(rawTx);
        case 'sell':
            return tx.sourceType === 'usdt_tx' && isCryptoSell(rawTx);
        case 'adjustments':
            return tx.sourceType === 'usdt_tx' && isCryptoManual(rawTx);
        case 'stock':
            return tx.sourceType === 'usdt_tx' && isCryptoManual(rawTx);
        case 'buy_usdt_dzd':
            return tx.sourceType === 'usdt_tx'
                && isCryptoBuy(rawTx)
                && rawTx.currency === 'USDT'
                && rawTx.purchaseFundingCurrency !== 'EUR';
        case 'buy_usdt_eur':
            return tx.sourceType === 'usdt_tx'
                && isCryptoBuy(rawTx)
                && rawTx.currency === 'USDT'
                && rawTx.purchaseFundingCurrency === 'EUR';
        case 'buy_eur_dzd':
            return tx.sourceType === 'usdt_tx'
                && isCryptoBuy(rawTx)
                && rawTx.currency === 'EUR'
                && !rawTx.linkedTxId;
        case 'sell_usdt_dzd':
            return tx.sourceType === 'usdt_tx'
                && isCryptoSell(rawTx)
                && rawTx.currency === 'USDT'
                && rawTx.settlementCurrency !== 'EUR';
        case 'sell_usdt_eur':
            return tx.sourceType === 'usdt_tx'
                && isCryptoSell(rawTx)
                && rawTx.currency === 'USDT'
                && rawTx.settlementCurrency === 'EUR';
        case 'sell_eur_dzd':
            return tx.sourceType === 'usdt_tx'
                && isCryptoSell(rawTx)
                && rawTx.currency === 'EUR';
        case 'stock_in':
            return tx.sourceType === 'usdt_tx'
                && (rawTx as Tx).type === 'Ajout Manuel';
        case 'stock_out':
            return tx.sourceType === 'usdt_tx'
                && (rawTx as Tx).type === 'Retrait Manuel';
        case 'client_payments':
            return tx.sourceType === 'client_tx' && !isClientTransfer(rawTx);
        case 'client_receipts':
            return tx.sourceType === 'client_tx'
                && isClientReceipt(rawTx as ClientTransactionDzd);
        case 'client_receipts_cash':
            return tx.sourceType === 'client_tx'
                && isClientReceipt(rawTx as ClientTransactionDzd)
                && normalizePaymentMethod((rawTx as ClientTransactionDzd).paymentMethod) === 'cash';
        case 'client_receipts_baridi':
            return tx.sourceType === 'client_tx'
                && isClientReceipt(rawTx as ClientTransactionDzd)
                && normalizePaymentMethod((rawTx as ClientTransactionDzd).paymentMethod) === 'baridi';
        case 'client_receipts_credit':
            return tx.sourceType === 'client_tx'
                && isClientReceipt(rawTx as ClientTransactionDzd)
                && normalizePaymentMethod((rawTx as ClientTransactionDzd).paymentMethod) === 'credit';
        case 'client_payouts':
            return tx.sourceType === 'client_tx'
                && isClientPayout(rawTx as ClientTransactionDzd);
        case 'client_payouts_cash':
            return tx.sourceType === 'client_tx'
                && isClientPayout(rawTx as ClientTransactionDzd)
                && normalizePaymentMethod((rawTx as ClientTransactionDzd).paymentMethod) === 'cash';
        case 'client_payouts_baridi':
            return tx.sourceType === 'client_tx'
                && isClientPayout(rawTx as ClientTransactionDzd)
                && normalizePaymentMethod((rawTx as ClientTransactionDzd).paymentMethod) === 'baridi';
        case 'client_payouts_credit':
            return tx.sourceType === 'client_tx'
                && isClientPayout(rawTx as ClientTransactionDzd)
                && normalizePaymentMethod((rawTx as ClientTransactionDzd).paymentMethod) === 'credit';
        case 'client_adjustments':
            return tx.sourceType === 'client_tx' && isClientAdjustment(rawTx as ClientTransactionDzd);
        case 'client_transfers':
            return tx.sourceType === 'client_tx' && isClientTransfer(rawTx);
        case 'treasury_in':
            return tx.sourceType === 'treasury_tx' && isTreasuryEntry(rawTx);
        case 'treasury_in_cash':
            return tx.sourceType === 'treasury_tx'
                && isTreasuryEntry(rawTx)
                && getTreasuryWallet(rawTx as TreasuryTx) === 'cash';
        case 'treasury_in_baridi':
            return tx.sourceType === 'treasury_tx'
                && isTreasuryEntry(rawTx)
                && getTreasuryWallet(rawTx as TreasuryTx) === 'baridi';
        case 'treasury_out':
            return tx.sourceType === 'treasury_tx' && isTreasuryExit(rawTx);
        case 'treasury_out_cash':
            return tx.sourceType === 'treasury_tx'
                && isTreasuryExit(rawTx)
                && getTreasuryWallet(rawTx as TreasuryTx) === 'cash';
        case 'treasury_out_baridi':
            return tx.sourceType === 'treasury_tx'
                && isTreasuryExit(rawTx)
                && getTreasuryWallet(rawTx as TreasuryTx) === 'baridi';
        case 'treasury_transfers':
            return tx.sourceType === 'treasury_tx' && isTreasuryTransfer(rawTx);
        case 'clients':
            return tx.category === 'client';
        case 'treasury':
            return tx.category === 'treasury';
        default:
            return false;
    }
}
type UseTransactionsViewModelParams = {
    t: (key: string) => string;
    filterMode: TransactionFilterMode;
    setFilterMode: (mode: TransactionFilterMode) => void;
    dateRange: {
        start: Date | null;
        end: Date | null;
    };
    setDateRange: (range: {
        start: Date | null;
        end: Date | null;
    }) => void;
    transactions: Tx[];
    clientTransactionsDzd: ClientTransactionDzd[];
    clientsDzd: ClientDzd[];
    treasuryTransactions: TreasuryTx[];
    getClientFullName: (client: ClientDzd) => string;
    openForm: (newMode: 'buy_usdt' | 'sell_usdt' | 'buy_eur' | 'sell_eur', txToEdit?: Tx | null) => void;
    openAdjustmentModal: (type: 'add' | 'subtract', txToEdit?: TreasuryTx | null) => void;
    setTxToDelete: (tx: Tx | null) => void;
    handleEditPortfolioTx?: (tx: Tx) => void;
    handleEditClientTx?: (tx: ClientTransactionDzd) => void;
    handleEditTreasuryTx?: (tx: TreasuryTx) => void;
    handleDeleteClientTxClick?: (tx: ClientTransactionDzd) => void;
    setTreasuryTxToDelete?: (tx: TreasuryTx | null) => void;
    resultLimit?: number;
    providedProfitByTxId?: PamLedgerResult['profitByTxId'];
};
export function useTransactionsViewModel({ t, filterMode, setFilterMode, dateRange, setDateRange, transactions, clientTransactionsDzd, clientsDzd, treasuryTransactions, getClientFullName, openForm, openAdjustmentModal, setTxToDelete, handleEditPortfolioTx, handleEditClientTx, handleEditTreasuryTx, handleDeleteClientTxClick, setTreasuryTxToDelete, resultLimit, providedProfitByTxId }: UseTransactionsViewModelParams) {
    const [savedFilters, setSavedFilters] = useState<SavedTransactionFilter[]>(() => {
        try {
            const raw = localStorage.getItem(SAVED_FILTERS_STORAGE_KEY);
            if (!raw)
                return [];
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed))
                return [];
            return parsed.filter((item: any) => item &&
                typeof item.id === 'string' &&
                typeof item.name === 'string' &&
                typeof item.filterMode === 'string') as SavedTransactionFilter[];
        }
        catch {
            return [];
        }
    });
    const formatDzdAmount = (value: number) => formatDzd(value, { min: 2, max: 2 });
    const formatAssetAmount = (value: number) => formatNumber(value, { min: 0, max: 2 });
    const formatEurPerUsdtRate = (value: number) => formatNumber(value, { min: 2, max: 4 });
    useEffect(() => {
        localStorage.setItem(SAVED_FILTERS_STORAGE_KEY, JSON.stringify(savedFilters));
    }, [savedFilters]);
    const txFilterLabels: Record<TransactionFilterMode, string> = useMemo(() => ({
        all: t('transactions.filterAll'),
        buy_usdt_dzd: t('transactions.filterBuyUsdtDzd'),
        buy_usdt_eur: t('transactions.filterBuyUsdtEur'),
        buy_eur_dzd: t('transactions.filterBuyEurDzd'),
        sell_usdt_dzd: t('transactions.filterSellUsdtDzd'),
        sell_usdt_eur: t('transactions.filterSellUsdtEur'),
        sell_eur_dzd: t('transactions.filterSellEurDzd'),
        stock: t('transactions.filterStock'),
        stock_in: t('transactions.filterStockIn'),
        stock_out: t('transactions.filterStockOut'),
        client_receipts: t('transactions.filterClientReceipts'),
        client_receipts_cash: t('transactions.filterClientReceiptsCash'),
        client_receipts_baridi: t('transactions.filterClientReceiptsBaridi'),
        client_receipts_credit: t('transactions.filterClientReceiptsCredit'),
        client_payouts: t('transactions.filterClientPayouts'),
        client_payouts_cash: t('transactions.filterClientPayoutsCash'),
        client_payouts_baridi: t('transactions.filterClientPayoutsBaridi'),
        client_payouts_credit: t('transactions.filterClientPayoutsCredit'),
        client_adjustments: t('transactions.filterClientAdjustments'),
        treasury_in_cash: t('transactions.filterTreasuryInCash'),
        treasury_in_baridi: t('transactions.filterTreasuryInBaridi'),
        treasury_out_cash: t('transactions.filterTreasuryOutCash'),
        treasury_out_baridi: t('transactions.filterTreasuryOutBaridi'),
        buy: t('transactions.filterBuy'),
        sell: t('transactions.filterSell'),
        adjustments: t('transactions.filterAdjustments'),
        client_payments: t('transactions.filterClientPayments'),
        client_transfers: t('transactions.filterClientTransfers'),
        treasury_in: t('transactions.filterTreasuryIn'),
        treasury_out: t('transactions.filterTreasuryOut'),
        treasury_transfers: t('transactions.filterTreasuryTransfers'),
        clients: t('transactions.filterClients'),
        treasury: t('transactions.filterTreasury')
    }), [t]);
    const handleSaveCurrentFilter = () => {
        const hasDate = Boolean(dateRange.start && dateRange.end);
        const defaultName = `${txFilterLabels[filterMode]}${hasDate ? ` (${dateRange.start!.toLocaleDateString('fr-FR')})` : ''}`;
        const enteredName = window.prompt(t('transactions.savedFilterPrompt'), defaultName);
        const name = (enteredName || '').trim();
        if (!name)
            return;
        const next: SavedTransactionFilter[] = [
            {
                id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                name,
                filterMode,
                startTimestamp: dateRange.start ? dateRange.start.getTime() : null,
                endTimestamp: dateRange.end ? dateRange.end.getTime() : null,
                createdAt: Date.now()
            },
            ...savedFilters
        ].slice(0, 20);
        setSavedFilters(next);
    };
    const handleApplySavedFilter = (savedFilter: SavedTransactionFilter) => {
        setFilterMode(savedFilter.filterMode);
        if (savedFilter.startTimestamp && savedFilter.endTimestamp) {
            setDateRange({
                start: new Date(savedFilter.startTimestamp),
                end: new Date(savedFilter.endTimestamp)
            });
        }
        else {
            setDateRange({ start: null, end: null });
        }
    };
    const handleDeleteSavedFilter = (savedFilterId: string) => {
        setSavedFilters((prev) => prev.filter((item) => item.id !== savedFilterId));
    };
    const handleEditDisplayTx = (tx: DisplayTx) => {
        if (tx.sourceType === 'usdt_tx') {
            const rawTx = tx.rawTx as Tx;
            if (handleEditPortfolioTx) {
                handleEditPortfolioTx(rawTx);
                return;
            }
            const mode = rawTx.type === 'buy'
                ? (rawTx.currency === 'USDT' ? 'buy_usdt' : 'buy_eur')
                : (rawTx.currency === 'USDT' ? 'sell_usdt' : 'sell_eur');
            openForm(mode, rawTx);
            return;
        }
        if (tx.sourceType === 'client_tx' && handleEditClientTx) {
            handleEditClientTx(tx.rawTx as ClientTransactionDzd);
            return;
        }
        if (tx.sourceType === 'treasury_tx') {
            const rawTx = tx.rawTx as TreasuryTx;
            if (handleEditTreasuryTx) {
                handleEditTreasuryTx(rawTx);
                return;
            }
            openAdjustmentModal(rawTx.type === 'Ajout' ? 'add' : 'subtract', rawTx);
        }
    };
    const handleDeleteDisplayTx = (tx: DisplayTx) => {
        if (tx.sourceType === 'usdt_tx') {
            setTxToDelete(tx.rawTx as Tx);
            return;
        }
        if (tx.sourceType === 'client_tx' && handleDeleteClientTxClick) {
            handleDeleteClientTxClick(tx.rawTx as ClientTransactionDzd);
            return;
        }
        if (tx.sourceType === 'treasury_tx' && setTreasuryTxToDelete) {
            setTreasuryTxToDelete(tx.rawTx as TreasuryTx);
        }
    };
    const clientsById = useMemo(() => {
        const map = new Map<string, ClientDzd>();
        for (const client of clientsDzd) {
            map.set(client.id, client);
        }
        return map;
    }, [clientsDzd]);
    const linkedClientTxsByTransactionId = useMemo(() => {
        const map = new Map<string, ClientTransactionDzd[]>();
        for (const clientTx of clientTransactionsDzd) {
            if (!clientTx.linkedTxId)
                continue;
            const existing = map.get(clientTx.linkedTxId);
            if (existing) {
                existing.push(clientTx);
            }
            else {
                map.set(clientTx.linkedTxId, [clientTx]);
            }
        }
        return map;
    }, [clientTransactionsDzd]);
    const compactSourceLimit = resultLimit ? Math.max(resultLimit * 8, 40) : null;
    const transactionRows = useMemo(
        () => compactSourceLimit ? transactions.slice(-compactSourceLimit) : transactions,
        [compactSourceLimit, transactions]
    );
    const clientTransactionRows = useMemo(
        () => compactSourceLimit ? clientTransactionsDzd.slice(-compactSourceLimit) : clientTransactionsDzd,
        [clientTransactionsDzd, compactSourceLimit]
    );
    const treasuryTransactionRows = useMemo(
        () => compactSourceLimit ? treasuryTransactions.slice(-compactSourceLimit) : treasuryTransactions,
        [compactSourceLimit, treasuryTransactions]
    );
    const unifiedTransactions = useMemo(() => {
        const all: DisplayTx[] = [];
        const portfolioTxIds = new Set(transactions.map((tx) => tx.id).filter(Boolean));
        const clientTxIds = new Set(clientTransactionsDzd.map((tx) => tx.id).filter(Boolean));
        const treasuryEffectsByLinkedTxId = new Map<string, TreasuryTx>();
        for (const treasuryTx of treasuryTransactions || []) {
            if (!treasuryTx.linkedTxId || !isInternalTreasuryEffect(treasuryTx))
                continue;
            if (!treasuryEffectsByLinkedTxId.has(treasuryTx.linkedTxId)) {
                treasuryEffectsByLinkedTxId.set(treasuryTx.linkedTxId, treasuryTx);
            }
        }
        const hiddenClientTransferIds = new Set<string>();
        for (const tx of clientTransactionRows) {
            if (tx.type !== 'Transfert Entrant')
                continue;
            const counterpart = findClientTransferCounterpart(tx, clientTransactionsDzd);
            if (counterpart?.type === 'Transfert Sortant')
                hiddenClientTransferIds.add(tx.id);
        }
        transactionRows.forEach((tx) => {
            if (tx.linkedTxId) return;
            const isBuy = tx.type === 'buy' || tx.type === 'Ajout Manuel';
            const isUsdtSaleSettledInEur = tx.type === 'sell' && tx.currency === 'USDT' && tx.settlementCurrency === 'EUR';
            const saleValueEur = Number(tx.saleValueEur || 0);
            const purchaseAmountEur = Number(tx.purchaseAmountEur || 0);
            const isUsdtPurchaseFundedByEur = tx.type === 'buy'
                && tx.currency === 'USDT'
                && tx.purchaseFundingCurrency === 'EUR'
                && purchaseAmountEur > 0;
            const eurPerUsdtRate = Number(tx.eurPerUsdtAtPurchase || 0) > 0
                ? Number(tx.eurPerUsdtAtPurchase)
                : (tx.quantity > 0 ? purchaseAmountEur / tx.quantity : 0);
            const linkedTreasuryEffect = tx.id ? treasuryEffectsByLinkedTxId.get(tx.id) : undefined;
            const showLinkedTreasuryOut = tx.type === 'buy'
                && linkedTreasuryEffect
                && getTreasuryEffectDirection(linkedTreasuryEffect) === 'out';
            const typeLabel = isUsdtSaleSettledInEur
                ? t('ledger.sellUsdtEur')
                : getPortfolioOperationLabel(tx.type, tx.currency, t);
            const txClientCandidates = tx.id ? (linkedClientTxsByTransactionId.get(tx.id) || []) : [];
            const txClient = (tx.linkedClientId ? txClientCandidates.find((clientTx) => clientTx.clientId === tx.linkedClientId) : undefined)
                || txClientCandidates.find((clientTx) => clientTx.linkRole === 'primary')
                || txClientCandidates.find((clientTx) => clientTx.linkRole !== 'dzd_receiver')
                || txClientCandidates[0];
            const txDzdReceiver = (tx.linkedClientDzdId ? txClientCandidates.find((clientTx) => clientTx.clientId === tx.linkedClientDzdId) : undefined)
                || txClientCandidates.find((clientTx) => clientTx.linkRole === 'dzd_receiver');
            const client = txClient ? clientsById.get(txClient.clientId) : undefined;
            const receiverClient = txDzdReceiver
                ? clientsById.get(txDzdReceiver.clientId)
                : (tx.linkedClientDzdId ? clientsById.get(tx.linkedClientDzdId) : undefined);
            let details = client ? getClientFullName(client) : (tx.notes || '');
            if (receiverClient && (!client || receiverClient.id !== client.id)) {
                const settlementAt = String(t('transactions.settlementAt')).replace('{client}', getClientFullName(receiverClient));
                details = [details, settlementAt].filter(Boolean).join(' - ');
            }
            if (isUsdtSaleSettledInEur) {
                const eurRate = Number(tx.eurToDzdRateAtSale || 0);
                const saleValueDzd = Number(tx.total || 0);
                details = [
                    details,
                    `${formatAssetAmount(tx.quantity)} USDT`,
                    eurRate > 0 ? `EUR/DZD ${formatDzdAmount(eurRate)}` : null,
                    saleValueDzd > 0 ? `${formatDzdAmount(saleValueDzd)}` : null
                ].filter(Boolean).join(' - ');
            }
            if (tx.price && (tx.type === 'Ajout Manuel' || tx.type === 'Retrait Manuel')) {
                details = `${details} - Prix: ${formatDzdAmount(tx.price)}`;
            }
            if (showLinkedTreasuryOut) {
                details = [details, getTreasuryEffectWallet(linkedTreasuryEffect)].filter(Boolean).join(' - ');
            }
            all.push({
                id: `crypto_${tx.id}`,
                originalId: tx.id || '',
                timestamp: tx.timestamp,
                date: tx.date,
                time: tx.time,
                typeLabel,
                amountLabel: isUsdtSaleSettledInEur
                    ? (saleValueEur > 0 ? `${formatAssetAmount(saleValueEur)} EUR` : `${formatAssetAmount(tx.quantity)} USDT`)
                    : isUsdtPurchaseFundedByEur
                        ? `${formatAssetAmount(purchaseAmountEur)} EUR`
                        : `${formatAssetAmount(tx.quantity)} ${tx.currency}`,
                amountColor: isBuy ? 'text-financial-profit' : 'text-financial-loss',
                icon: (<div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-neutral-100 text-neutral-600">
            {isBuy ? <ArrowDownLeftIcon className="w-5 h-5"/> : <ArrowUpRightIcon className="w-5 h-5"/>}
          </div>),
                details,
                category: 'crypto',
                rawTx: tx,
                sourceType: 'usdt_tx',
                rightMiddleLabel: isUsdtPurchaseFundedByEur
                    ? `@ ${formatEurPerUsdtRate(eurPerUsdtRate)} EUR/USDT`
                    : undefined,
                rightBottomLabel: isUsdtPurchaseFundedByEur
                    ? `→ ${formatAssetAmount(tx.quantity)} USDT`
                    : showLinkedTreasuryOut
                        ? `← ${formatDzdAmount(linkedTreasuryEffect.amount)}`
                        : undefined,
                rightBottomClassName: showLinkedTreasuryOut ? 'text-financial-loss' : undefined
            });
        });
        clientTransactionRows.forEach((tx) => {
            if (isClientTxLinkedToPortfolio(tx, portfolioTxIds)
                || isClientTxLinkedToClient(tx, clientTxIds)
                || tx.origin === 'adjustment'
                || hiddenClientTransferIds.has(tx.id))
                return;
            const client = clientsById.get(tx.clientId);
            const clientName = client ? getClientFullName(client) : 'Client Inconnu';
            const isPositive = tx.montant > 0;
            const isTransfer = tx.type === 'Transfert Entrant' || tx.type === 'Transfert Sortant';
            const transferCounterpart = isTransfer ? findClientTransferCounterpart(tx, clientTransactionsDzd) : null;
            const counterpartClient = transferCounterpart ? clientsById.get(transferCounterpart.clientId) : undefined;
            const counterpartName = counterpartClient ? getClientFullName(counterpartClient) : '';
            const clientDetails = isTransfer
                ? getClientTransferDetails(tx, counterpartName, t)
                : [clientName, getManualClientNote(tx.notes)].filter(Boolean).join(' - ');
            const icon = isTransfer
                ? <UsersIcon className="w-5 h-5"/>
                : isPositive
                    ? <ArrowDownLeftIcon className="w-5 h-5"/>
                    : <ArrowUpRightIcon className="w-5 h-5"/>;
            all.push({
                id: `client_${tx.id}`,
                originalId: tx.id,
                timestamp: tx.timestamp,
                date: tx.date,
                time: tx.time,
                typeLabel: getClientOperationLabel(tx.type, t),
                amountLabel: formatDzdAmount(Math.abs(tx.montant)),
                amountColor: isTransfer ? 'text-primary' : (isPositive ? 'text-financial-profit' : 'text-financial-loss'),
                icon: (<div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-neutral-100 text-neutral-600">
            {icon}
          </div>),
                details: clientDetails,
                category: 'client',
                rawTx: tx,
                sourceType: 'client_tx'
            });
        });
        treasuryTransactionRows.forEach((tx) => {
            if (isInternalTreasuryEffect(tx))
                return;
            const txData = tx as any;
            const isEntry = tx.type === 'Ajout' || tx.type === 'Adjustment (+)';
            const isTransfer = tx.type === 'Transfer' || tx.notes?.includes('Virement');
            const legacyTransferMatch = typeof txData.asset === 'string'
                ? /from\s+(.+?)\s+to\s+(.+)/i.exec(txData.asset)
                : null;
            const transferFrom = txData.source || legacyTransferMatch?.[1] || 'N/A';
            const transferTo = txData.destination || legacyTransferMatch?.[2] || 'N/A';
            const sourceLabel = isTransfer
                ? `${transferFrom} -> ${transferTo}`
                : (txData.source || txData.asset || 'N/A');
            const typeLabel = isTransfer
                ? t('ledger.internalTransfer')
                : getTreasuryOperationLabel(tx.type, t);
            all.push({
                id: `treasury_${tx.id}`,
                originalId: tx.id || '',
                timestamp: tx.timestamp,
                date: tx.date,
                time: tx.time,
                typeLabel,
                amountLabel: formatDzdAmount(tx.amount),
                amountColor: isTransfer ? 'text-primary' : (isEntry ? 'text-financial-profit' : 'text-financial-loss'),
                icon: (<div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-neutral-100 text-neutral-600">
            <WalletIcon className="w-5 h-5"/>
          </div>),
                details: [sourceLabel, tx.notes].filter(Boolean).join(' - '),
                category: 'treasury',
                rawTx: tx,
                sourceType: 'treasury_tx'
            });
        });
        const ordered = all.sort((a, b) => b.timestamp - a.timestamp);
        return resultLimit ? ordered.slice(0, resultLimit) : ordered;
    }, [
        transactionRows,
        clientTransactionsDzd,
        clientTransactionRows,
        treasuryTransactionRows,
        linkedClientTxsByTransactionId,
        clientsById,
        getClientFullName,
        resultLimit,
        t
    ]);
    const filteredTransactions = useMemo(() => {
        return unifiedTransactions.filter((tx) => {
            if (!matchesTransactionFilter(filterMode, tx))
                return false;
            if (dateRange.start && dateRange.end) {
                if (tx.timestamp < dateRange.start.getTime() || tx.timestamp > dateRange.end.getTime())
                    return false;
            }
            return true;
        });
    }, [unifiedTransactions, filterMode, dateRange]);
    const txFilterCounts: Record<TransactionFilterMode, number> = useMemo(() => {
        const initial = Object.fromEntries(ALL_FILTER_MODES.map((mode) => [mode, 0])) as Record<TransactionFilterMode, number>;
        if (resultLimit) {
            initial.all = unifiedTransactions.length;
            return initial;
        }
        for (const tx of unifiedTransactions) {
            if (dateRange.start && dateRange.end) {
                if (tx.timestamp < dateRange.start.getTime() || tx.timestamp > dateRange.end.getTime())
                    continue;
            }
            for (const mode of ALL_FILTER_MODES) {
                if (matchesTransactionFilter(mode, tx)) {
                    initial[mode] += 1;
                }
            }
        }
        return initial;
    }, [unifiedTransactions, dateRange, resultLimit]);
    const groupedTransactions = useMemo(() => {
        return filteredTransactions.reduce((acc, tx) => {
            if (!acc[tx.date]) {
                acc[tx.date] = [];
            }
            acc[tx.date].push(tx);
            return acc;
        }, {} as Record<string, DisplayTx[]>);
    }, [filteredTransactions]);
    const computedProfitByTxId = useMemo(
        () => providedProfitByTxId || computePamLedger(transactions).profitByTxId,
        [providedProfitByTxId, transactions]
    );

    return {
        savedFilters,
        txFilterLabels,
        txFilterCounts,
        groupedTransactions,
        formatDzdAmount,
        handleSaveCurrentFilter,
        handleApplySavedFilter,
        handleDeleteSavedFilter,
        handleEditDisplayTx,
        handleDeleteDisplayTx,
        profitByTxId: computedProfitByTxId,
    };
}
