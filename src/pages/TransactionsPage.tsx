import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Tx, ClientDzd, ClientTransactionDzd, TreasuryTx } from '../types';
import { Dropdown, DropdownItem } from '../components/ui/Dropdown';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/Dialog';

import { FilterIcon } from '../components/icons/FilterIcon';
import { ArrowDownLeftIcon } from '../components/icons/ArrowDownLeftIcon';
import { ArrowUpRightIcon } from '../components/icons/ArrowUpRightIcon';
import { PencilIcon } from '../components/icons/PencilIcon';
import { CalendarIcon } from '../components/icons/CalendarIcon';
import { SwipeableListItem } from '../components/ui/SwipeableListItem';
import { RefreshCwIcon } from '../components/icons/RefreshCwIcon';
import { BriefcaseIcon } from '../components/icons/BriefcaseIcon';
import { UsersIcon } from '../components/icons/UsersIcon';
import { ChevronRightIcon } from '../components/icons/ChevronRightIcon';
import { WalletIcon } from '../components/icons/WalletIcon';
import { useLanguage } from '../contexts/LanguageContext';
import { formatDzd, formatNumber } from './shared/pageFormat';

type TransactionFilterMode = 'all' | 'buy' | 'sell' | 'adjustments' | 'clients' | 'treasury';
type TransactionSourceType = 'usdt_tx' | 'client_tx' | 'treasury_tx';
type DisplayRawTx = Tx | ClientTransactionDzd | TreasuryTx;

type TransactionsPageProps = {
  cardBase: string;
  isDark: boolean;
  subtleText: string;
  openAdjustmentModal: (type: 'add' | 'subtract', txToEdit?: TreasuryTx | null) => void;
  openForm: (newMode: 'buy_usdt' | 'sell_usdt' | 'buy_eur', txToEdit?: Tx | null) => void;
  filterMode: TransactionFilterMode;
  setFilterMode: (mode: TransactionFilterMode) => void;
  transactions: Tx[];
  getRelativeDateLabel: (dateString: string) => string;
  clientTransactionsDzd: ClientTransactionDzd[];
  clientsDzd: ClientDzd[];
  getClientFullName: (client: ClientDzd) => string;
  setTxToDelete: (tx: Tx | null) => void;
  openDateFilterModal: () => void;
  dateRange: { start: Date | null; end: Date | null };
  setDateRange: (range: { start: Date | null; end: Date | null }) => void;
  openWalletTransferModal: () => void;
  openTransferModal: () => void;
  treasuryTransactions: TreasuryTx[];
  handleEditClientTx?: (tx: ClientTransactionDzd) => void;
  handleDeleteClientTxClick?: (tx: ClientTransactionDzd) => void;
  setTreasuryTxToDelete?: (tx: TreasuryTx | null) => void;
};

interface DisplayTx {
  id: string;
  originalId: string;
  timestamp: number;
  date: string;
  time: string;
  typeLabel: string;
  amountLabel: string;
  amountColor: string;
  icon: React.ReactNode;
  details: string;
  category: 'crypto' | 'client' | 'treasury';
  rawTx: DisplayRawTx;
  sourceType: TransactionSourceType;
}

interface SavedTransactionFilter {
  id: string;
  name: string;
  filterMode: TransactionFilterMode;
  startTimestamp: number | null;
  endTimestamp: number | null;
  createdAt: number;
}

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

export function TransactionsPage({
  cardBase,
  isDark,
  subtleText,
  openAdjustmentModal,
  openForm,
  filterMode,
  setFilterMode,
  transactions,
  getRelativeDateLabel,
  clientTransactionsDzd,
  clientsDzd,
  getClientFullName,
  setTxToDelete,
  openDateFilterModal,
  dateRange,
  setDateRange,
  openWalletTransferModal,
  openTransferModal,
  treasuryTransactions,
  handleEditClientTx,
  handleDeleteClientTxClick,
  setTreasuryTxToDelete
}: TransactionsPageProps) {
  const { t } = useLanguage();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
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

      const txClient = tx.id ? clientTransactionsDzd.find((clientTx) => clientTx.linkedTxId === tx.id) : undefined;
      const client = txClient ? clientsDzd.find((c) => c.id === txClient.clientId) : undefined;
      let details = client ? getClientFullName(client) : (tx.notes || '');
      if (tx.price && (tx.type === 'Ajout Manuel' || tx.type === 'Retrait Manuel')) {
        details = `${details} • Prix: ${formatDzdAmount(tx.price)}`;
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
        details: `${clientName} ${tx.notes ? `• ${tx.notes}` : ''}`,
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

  const txFilterLabels: Record<TransactionFilterMode, string> = {
    all: t('transactions.filterAll'),
    buy: t('transactions.filterBuy'),
    sell: t('transactions.filterSell'),
    adjustments: t('transactions.filterAdjustments'),
    clients: t('transactions.filterClients'),
    treasury: t('transactions.filterTreasury')
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="mb-2">
        <Button
          onClick={() => setIsMenuOpen(true)}
          className="w-full py-4 rounded-xl shadow-lg font-bold text-lg text-white flex items-center justify-center gap-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-all transform hover:scale-[1.01]"
        >
          <PencilIcon className="w-5 h-5" />
          {t('transactions.newTransaction')}
        </Button>
      </div>

      <Card className={cardBase}>
        <CardHeader className="flex flex-row items-center justify-between p-4">
          <h2 className="font-bold text-lg">{t('transactions.history')}</h2>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Button
              onClick={openDateFilterModal}
              className={`p-2 rounded-lg font-semibold transition-colors ${isDark ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-200 hover:bg-slate-300'} ${dateRange.start ? (isDark ? 'bg-sky-500/20 text-sky-300' : 'bg-sky-100 text-sky-600') : ''}`}
              aria-label="Filtrer par date"
            >
              <CalendarIcon className="w-5 h-5" />
            </Button>

            <Button
              onClick={handleSaveCurrentFilter}
              className={`px-3 py-2 text-sm rounded-lg font-semibold transition-colors ${isDark ? 'bg-emerald-700 hover:bg-emerald-600 text-emerald-100' : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700'}`}
            >
              {t('transactions.saveCurrentFilter')}
            </Button>

            <Dropdown
              isDark={isDark}
              trigger={
                <Button className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg font-semibold transition-colors ${isDark ? 'bg-indigo-700 hover:bg-indigo-600 text-indigo-100' : 'bg-indigo-100 hover:bg-indigo-200 text-indigo-700'}`}>
                  <span>{t('transactions.savedFilters')}</span>
                </Button>
              }
            >
              {savedFilters.length === 0 ? (
                <div className={`px-3 py-2 text-sm ${subtleText}`}>{t('transactions.noSavedFilters')}</div>
              ) : (
                savedFilters.map((savedFilter) => (
                  <div key={savedFilter.id} className="flex items-center justify-between gap-2 px-2 py-1">
                    <button
                      onClick={() => handleApplySavedFilter(savedFilter)}
                      className={`text-left text-sm flex-1 px-2 py-2 rounded-md ${isDark ? 'hover:bg-slate-700 text-slate-200' : 'hover:bg-slate-100 text-slate-700'}`}
                    >
                      {savedFilter.name}
                    </button>
                    <button
                      onClick={() => handleDeleteSavedFilter(savedFilter.id)}
                      className={`px-2 py-1 rounded text-xs ${isDark ? 'bg-red-900/40 text-red-300 hover:bg-red-900/60' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
                    >
                      {t('common.delete')}
                    </button>
                  </div>
                ))
              )}
            </Dropdown>

            <Dropdown
              isDark={isDark}
              trigger={
                <Button className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg font-semibold transition-colors ${isDark ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-200 hover:bg-slate-300'}`}>
                  <FilterIcon className="w-4 h-4" />
                  <span>{txFilterLabels[filterMode]}</span>
                </Button>
              }
            >
              <DropdownItem onClick={() => setFilterMode('all')} isActive={filterMode === 'all'}>{t('transactions.filterAll')}</DropdownItem>
              <DropdownItem onClick={() => setFilterMode('buy')} isActive={filterMode === 'buy'}>{t('transactions.filterBuy')} (Crypto)</DropdownItem>
              <DropdownItem onClick={() => setFilterMode('sell')} isActive={filterMode === 'sell'}>{t('transactions.filterSell')} (Crypto)</DropdownItem>
              <DropdownItem onClick={() => setFilterMode('adjustments')} isActive={filterMode === 'adjustments'}>{t('transactions.filterAdjustments')} (Crypto)</DropdownItem>
              <DropdownItem onClick={() => setFilterMode('clients')} isActive={filterMode === 'clients'}>{t('transactions.filterClients')}</DropdownItem>
              <DropdownItem onClick={() => setFilterMode('treasury')} isActive={filterMode === 'treasury'}>{t('transactions.filterTreasury')}</DropdownItem>
            </Dropdown>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="space-y-4 pb-4">
            {Object.keys(groupedTransactions).length > 0 ? (
              Object.keys(groupedTransactions).map((date) => {
                const txsOnDate = groupedTransactions[date] || [];
                return (
                <div key={date}>
                  <h3 className={`font-semibold text-sm mb-2 px-4 ${subtleText}`}>{getRelativeDateLabel(date)}</h3>
                  <div className="divide-y" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
                    {txsOnDate.map((tx) => (
                      <React.Fragment key={tx.id}>
                        <SwipeableListItem
                          onEdit={() => handleEditDisplayTx(tx)}
                          onDelete={() => handleDeleteDisplayTx(tx)}
                          disableSwipe={false}
                        >
                          <div className={`flex items-center gap-3 py-3 px-4 ${isDark ? 'bg-[#111827]' : 'bg-white'}`}>
                            {tx.icon}

                            <div className="flex-grow min-w-0">
                              <p className="font-bold truncate">{tx.typeLabel}</p>
                              <p className={`text-sm ${subtleText} truncate`}>{tx.details}</p>
                              <p className={`text-xs ${subtleText}`}>{tx.time}</p>
                            </div>

                            <div className="text-right flex-shrink-0">
                              <p className={`font-bold ${tx.amountColor}`}>{tx.amountLabel}</p>
                              {tx.sourceType === 'usdt_tx' && (
                                (((tx.rawTx as Tx).price) || ((tx.rawTx as Tx).sell)) ? (
                                  <p className={`text-xs ${subtleText}`}>
                                    @ {formatDzdAmount(((tx.rawTx as Tx).price || (tx.rawTx as Tx).sell || 0))}
                                  </p>
                                ) : null
                              )}
                            </div>
                          </div>
                        </SwipeableListItem>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )})
            ) : (
              <p className={`text-center py-8 ${subtleText}`}>{t('transactions.noTransactions')}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} className={`${cardBase} max-w-sm`}>
        <DialogHeader onClose={() => setIsMenuOpen(false)} isDark={isDark}>
          <DialogTitle>{t('transactions.newTransaction')}</DialogTitle>
        </DialogHeader>
        <DialogContent className="grid grid-cols-1 gap-3 p-6 pt-0">
          <div className="grid grid-cols-2 gap-3 mb-2">
            <Button onClick={() => { setIsMenuOpen(false); openForm('buy_usdt'); }} className="bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-bold shadow-sm flex flex-col items-center gap-1 h-24 justify-center">
              <ArrowDownLeftIcon className="w-6 h-6" />
              <span>{t('transactions.buyUsdt')}</span>
            </Button>
            <Button onClick={() => { setIsMenuOpen(false); openForm('sell_usdt'); }} className="bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-bold shadow-sm flex flex-col items-center gap-1 h-24 justify-center">
              <ArrowUpRightIcon className="w-6 h-6" />
              <span>{t('transactions.sellUsdt')}</span>
            </Button>
          </div>
          <Button onClick={() => { setIsMenuOpen(false); openForm('buy_eur'); }} className="bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold text-lg shadow-sm mb-4">
            {t('transactions.buyEur')}
          </Button>

          <div className="border-t border-gray-200 dark:border-gray-700 pt-4 pb-2">
            <p className="text-center text-xs font-bold uppercase tracking-wider opacity-50 mb-3">{t('transactions.financialActions')}</p>

            <div className="grid grid-cols-1 gap-3">
              <Button
                onClick={() => { setIsMenuOpen(false); openWalletTransferModal(); }}
                className={`w-full py-3 rounded-xl font-bold shadow-sm flex items-center justify-between px-4 transition-all ${isDark ? 'bg-indigo-900/30 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-900/50' : 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${isDark ? 'bg-indigo-500/20' : 'bg-indigo-100'}`}><RefreshCwIcon className="w-5 h-5" /></div>
                  <div className="text-left">
                    <div className="text-sm font-bold">{t('transactions.internalTransfer')}</div>
                    <div className="text-[10px] opacity-70">{t('transactions.caisseAndBaridi')}</div>
                  </div>
                </div>
                <ChevronRightIcon className="w-4 h-4 opacity-50" />
              </Button>

              <Button
                onClick={() => { setIsMenuOpen(false); openTransferModal(); }}
                className={`w-full py-3 rounded-xl font-bold shadow-sm flex items-center justify-between px-4 transition-all ${isDark ? 'bg-sky-900/30 text-sky-300 border border-sky-500/30 hover:bg-sky-900/50' : 'bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100'}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${isDark ? 'bg-sky-500/20' : 'bg-sky-100'}`}><UsersIcon className="w-5 h-5" /></div>
                  <div className="text-left">
                    <div className="text-sm font-bold">{t('transactions.clientTransfer')}</div>
                    <div className="text-[10px] opacity-70">{t('transactions.transferDebtCredit')}</div>
                  </div>
                </div>
                <ChevronRightIcon className="w-4 h-4 opacity-50" />
              </Button>
            </div>

            <Button
              onClick={() => { setIsMenuOpen(false); openAdjustmentModal('add'); }}
              className={`w-full py-3 rounded-xl font-bold shadow-sm flex items-center justify-between px-4 transition-all mt-3 ${isDark ? 'bg-slate-700 text-slate-200 border border-slate-600 hover:bg-slate-600' : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200'}`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${isDark ? 'bg-slate-600' : 'bg-white'}`}><BriefcaseIcon className="w-5 h-5" /></div>
                <div className="text-left">
                  <div className="text-sm font-bold">{t('transactions.treasuryAdjustment')}</div>
                  <div className="text-[10px] opacity-70">{t('transactions.manualEntryExit')}</div>
                </div>
              </div>
              <ChevronRightIcon className="w-4 h-4 opacity-50" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

