import { useEffect, useMemo, useState } from 'react';
import { Tx, ClientDzd, ClientTransactionDzd, TreasuryTx } from '../../types';
import { ArrowDownLeftIcon } from '../icons/ArrowDownLeftIcon';
import { ArrowUpRightIcon } from '../icons/ArrowUpRightIcon';
import { UsersIcon } from '../icons/UsersIcon';
import { WalletIcon } from '../icons/WalletIcon';
import { formatDzd, formatNumber } from '../../pages/shared/pageFormat';
import {
  DisplayRawTx,
  DisplayTx,
  SavedTransactionFilter,
  TransactionFilterMode
} from './transactionsTypes';

const SAVED_FILTERS_STORAGE_KEY = 'tx_saved_filters_v1';

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

type UseTransactionsViewModelParams = {
  isDark: boolean;
  t: (key: string) => string;
  filterMode: TransactionFilterMode;
  setFilterMode: (mode: TransactionFilterMode) => void;
  dateRange: { start: Date | null; end: Date | null };
  setDateRange: (range: { start: Date | null; end: Date | null }) => void;
  transactions: Tx[];
  clientTransactionsDzd: ClientTransactionDzd[];
  clientsDzd: ClientDzd[];
  treasuryTransactions: TreasuryTx[];
  getClientFullName: (client: ClientDzd) => string;
  openForm: (newMode: 'buy_usdt' | 'sell_usdt' | 'buy_eur', txToEdit?: Tx | null) => void;
  openAdjustmentModal: (type: 'add' | 'subtract', txToEdit?: TreasuryTx | null) => void;
  setTxToDelete: (tx: Tx | null) => void;
  handleEditClientTx?: (tx: ClientTransactionDzd) => void;
  handleDeleteClientTxClick?: (tx: ClientTransactionDzd) => void;
  setTreasuryTxToDelete?: (tx: TreasuryTx | null) => void;
};

export function useTransactionsViewModel({
  isDark,
  t,
  filterMode,
  setFilterMode,
  dateRange,
  setDateRange,
  transactions,
  clientTransactionsDzd,
  clientsDzd,
  treasuryTransactions,
  getClientFullName,
  openForm,
  openAdjustmentModal,
  setTxToDelete,
  handleEditClientTx,
  handleDeleteClientTxClick,
  setTreasuryTxToDelete
}: UseTransactionsViewModelParams) {
  const [savedFilters, setSavedFilters] = useState<SavedTransactionFilter[]>(() => {
    try {
      const raw = localStorage.getItem(SAVED_FILTERS_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((item: any) =>
        item &&
        typeof item.id === 'string' &&
        typeof item.name === 'string' &&
        typeof item.filterMode === 'string'
      ) as SavedTransactionFilter[];
    } catch {
      return [];
    }
  });

  const formatDzdAmount = (value: number) => formatDzd(value, { min: 2, max: 2 });
  const formatAssetAmount = (value: number) => formatNumber(value, { min: 2, max: 2 });

  useEffect(() => {
    localStorage.setItem(SAVED_FILTERS_STORAGE_KEY, JSON.stringify(savedFilters));
  }, [savedFilters]);

  const txFilterLabels: Record<TransactionFilterMode, string> = useMemo(() => ({
    all: t('transactions.filterAll'),
    buy: t('transactions.filterBuy'),
    sell: t('transactions.filterSell'),
    adjustments: t('transactions.filterAdjustments'),
    clients: t('transactions.filterClients'),
    treasury: t('transactions.filterTreasury')
  }), [t]);

  const handleSaveCurrentFilter = () => {
    const hasDate = Boolean(dateRange.start && dateRange.end);
    const defaultName = `${txFilterLabels[filterMode]}${hasDate ? ` (${dateRange.start!.toLocaleDateString('fr-FR')})` : ''}`;
    const enteredName = window.prompt(t('transactions.savedFilterPrompt'), defaultName);
    const name = (enteredName || '').trim();
    if (!name) return;

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
    } else {
      setDateRange({ start: null, end: null });
    }
  };

  const handleDeleteSavedFilter = (savedFilterId: string) => {
    setSavedFilters((prev) => prev.filter((item) => item.id !== savedFilterId));
  };

  const handleEditDisplayTx = (tx: DisplayTx) => {
    if (tx.sourceType === 'usdt_tx') {
      const rawTx = tx.rawTx as Tx;
      const mode = rawTx.type === 'buy'
        ? (rawTx.currency === 'USDT' ? 'buy_usdt' : 'buy_eur')
        : 'sell_usdt';
      openForm(mode, rawTx);
      return;
    }

    if (tx.sourceType === 'client_tx' && handleEditClientTx) {
      handleEditClientTx(tx.rawTx as ClientTransactionDzd);
      return;
    }

    if (tx.sourceType === 'treasury_tx') {
      const rawTx = tx.rawTx as TreasuryTx;
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

  const unifiedTransactions = useMemo(() => {
    const all: DisplayTx[] = [];

    transactions.forEach((tx) => {
      const isBuy = tx.type === 'buy' || tx.type === 'Ajout Manuel';
      const typeLabel = tx.type === 'buy'
        ? `${t('transactions.buy')} ${tx.currency}`
        : tx.type === 'sell'
          ? `${t('transactions.sell')} ${tx.currency}`
          : tx.type;

      const txClientCandidates = tx.id ? clientTransactionsDzd.filter((clientTx) => clientTx.linkedTxId === tx.id) : [];
      const txClient = txClientCandidates.find((clientTx) => clientTx.linkRole !== 'dzd_receiver') || txClientCandidates[0];
      const client = txClient ? clientsDzd.find((c) => c.id === txClient.clientId) : undefined;
      let details = client ? getClientFullName(client) : (tx.notes || '');
      if (tx.price && (tx.type === 'Ajout Manuel' || tx.type === 'Retrait Manuel')) {
        details = `${details} â€¢ Prix: ${formatDzdAmount(tx.price)}`;
      }

      all.push({
        id: `crypto_${tx.id}`,
        originalId: tx.id || '',
        timestamp: tx.timestamp,
        date: tx.date,
        time: tx.time,
        typeLabel,
        amountLabel: `${formatAssetAmount(tx.quantity)} ${tx.currency}`,
        amountColor: isBuy ? 'text-green-400' : 'text-red-400',
        icon: (
          <div className={`p-2 rounded-full flex-shrink-0 ${isBuy ? (isDark ? 'bg-green-500/10 text-green-400' : 'bg-green-100 text-green-600') : (isDark ? 'bg-red-500/10 text-red-400' : 'bg-red-100 text-red-600')}`}>
            {isBuy ? <ArrowDownLeftIcon className="w-5 h-5" /> : <ArrowUpRightIcon className="w-5 h-5" />}
          </div>
        ),
        details,
        category: 'crypto',
        rawTx: tx,
        sourceType: 'usdt_tx'
      });
    });

    clientTransactionsDzd.forEach((tx) => {
      if (tx.linkedTxId) return;

      const client = clientsDzd.find((c) => c.id === tx.clientId);
      const clientName = client ? getClientFullName(client) : 'Client Inconnu';
      const isPositive = tx.montant > 0;
      const isTransfer = tx.type === 'Transfert Entrant' || tx.type === 'Transfert Sortant';
      const icon = isTransfer
        ? <UsersIcon className="w-5 h-5" />
        : isPositive
          ? <ArrowDownLeftIcon className="w-5 h-5" />
          : <ArrowUpRightIcon className="w-5 h-5" />;

      all.push({
        id: `client_${tx.id}`,
        originalId: tx.id,
        timestamp: tx.timestamp,
        date: tx.date,
        time: tx.time,
        typeLabel: tx.type,
        amountLabel: formatDzdAmount(Math.abs(tx.montant)),
        amountColor: isTransfer ? 'text-blue-400' : (isPositive ? 'text-green-400' : 'text-red-400'),
        icon: (
          <div className={`p-2 rounded-full flex-shrink-0 ${isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>
            {icon}
          </div>
        ),
        details: `${clientName} ${tx.notes ? `â€¢ ${tx.notes}` : ''}`,
        category: 'client',
        rawTx: tx,
        sourceType: 'client_tx'
      });
    });

    treasuryTransactions?.forEach((tx) => {
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
      let typeLabel = isEntry ? t('transactions.entry') : t('transactions.exit');
      if (isTransfer) {
        typeLabel = t('transactions.internalTransfer');
      }

      all.push({
        id: `treasury_${tx.id}`,
        originalId: tx.id || '',
        timestamp: tx.timestamp,
        date: tx.date,
        time: tx.time,
        typeLabel,
        amountLabel: formatDzdAmount(tx.amount),
        amountColor: isTransfer ? 'text-blue-400' : (isEntry ? 'text-green-400' : 'text-red-400'),
        icon: (
          <div className={`p-2 rounded-full flex-shrink-0 ${isDark ? 'bg-purple-500/10 text-purple-400' : 'bg-purple-100 text-purple-600'}`}>
            <WalletIcon className="w-5 h-5" />
          </div>
        ),
        details: [sourceLabel, tx.notes].filter(Boolean).join(' - '),
        category: 'treasury',
        rawTx: tx,
        sourceType: 'treasury_tx'
      });
    });

    return all.sort((a, b) => b.timestamp - a.timestamp);
  }, [transactions, clientTransactionsDzd, treasuryTransactions, clientsDzd, isDark, getClientFullName, t]);

  const filteredTransactions = useMemo(() => {
    return unifiedTransactions.filter((tx) => {
      if (filterMode !== 'all') {
        if (filterMode === 'buy' && !(tx.sourceType === 'usdt_tx' && isCryptoBuy(tx.rawTx))) return false;
        if (filterMode === 'sell' && !(tx.sourceType === 'usdt_tx' && isCryptoSell(tx.rawTx))) return false;
        if (filterMode === 'adjustments' && !(tx.sourceType === 'usdt_tx' && isCryptoManual(tx.rawTx))) return false;
        if (filterMode === 'clients' && tx.category !== 'client') return false;
        if (filterMode === 'treasury' && tx.category !== 'treasury') return false;
      }

      if (dateRange.start && dateRange.end) {
        if (tx.timestamp < dateRange.start.getTime() || tx.timestamp > dateRange.end.getTime()) return false;
      }

      return true;
    });
  }, [unifiedTransactions, filterMode, dateRange]);

  const groupedTransactions = useMemo(() => {
    return filteredTransactions.reduce((acc, tx) => {
      if (!acc[tx.date]) {
        acc[tx.date] = [];
      }
      acc[tx.date].push(tx);
      return acc;
    }, {} as Record<string, DisplayTx[]>);
  }, [filteredTransactions]);

  return {
    savedFilters,
    txFilterLabels,
    groupedTransactions,
    formatDzdAmount,
    handleSaveCurrentFilter,
    handleApplySavedFilter,
    handleDeleteSavedFilter,
    handleEditDisplayTx,
    handleDeleteDisplayTx
  };
}

