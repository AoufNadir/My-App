
import React, { useMemo, useState } from 'react';
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

type TransactionsPageProps = {
  cardBase: string;
  isDark: boolean;
  subtleText: string;
  openAdjustmentModal: (type: 'add' | 'subtract') => void;
  openForm: (newMode: 'buy_usdt' | 'sell_usdt' | 'buy_eur', txToEdit?: Tx | null) => void;
  filterMode: 'all' | 'buy' | 'sell' | 'adjustments' | 'clients' | 'treasury';
  setFilterMode: (mode: 'all' | 'buy' | 'sell' | 'adjustments' | 'clients' | 'treasury') => void;
  transactions: Tx[];
  getRelativeDateLabel: (dateString: string) => string;
  clientTransactionsDzd: ClientTransactionDzd[];
  clientsDzd: ClientDzd[];
  getClientFullName: (client: ClientDzd) => string;
  setTxToDelete: (tx: Tx | null) => void;
  openDateFilterModal: () => void;
  dateRange: { start: Date | null; end: Date | null };
  openWalletTransferModal: () => void;
  openTransferModal: () => void;
  treasuryTransactions: TreasuryTx[];
  handleEditClientTx?: (tx: ClientTransactionDzd) => void;
  handleDeleteClientTxClick?: (tx: ClientTransactionDzd) => void;
};

// Unified Transaction Interface for Display
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
  rawTx: any; // Store original for actions
  sourceType: 'usdt_tx' | 'client_tx' | 'treasury_tx';
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
  openWalletTransferModal,
  openTransferModal,
  treasuryTransactions,
  handleEditClientTx,
  handleDeleteClientTxClick
}: TransactionsPageProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // 1. UNIFY TRANSACTIONS
  const unifiedTransactions = useMemo(() => {
    const all: DisplayTx[] = [];

    // A. Crypto Transactions (USDT/EUR)
    transactions.forEach(tx => {
      const isBuy = tx.type === 'buy' || tx.type === 'Ajout Manuel';
      const isSell = tx.type === 'sell' || tx.type === 'Retrait Manuel';

      let typeLabel = tx.type === 'buy' ? `Achat ${tx.currency}` : tx.type === 'sell' ? `Vente ${tx.currency}` : tx.type;
      let amountLabel = `${tx.quantity.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ${tx.currency}`;
      let amountColor = isBuy ? 'text-green-400' : 'text-red-400';
      let icon = isBuy ? <ArrowDownLeftIcon className="w-5 h-5" /> : <ArrowUpRightIcon className="w-5 h-5" />;

      // Find linked client if any
      const txClient = tx.id ? clientTransactionsDzd.find(ct => ct.linkedTxId === tx.id) : undefined;
      const client = txClient ? clientsDzd.find(c => c.id === txClient.clientId) : undefined;
      let details = client ? getClientFullName(client) : (tx.notes || '');

      all.push({
        id: `crypto_${tx.id}`,
        originalId: tx.id || '',
        timestamp: tx.timestamp,
        date: tx.date,
        time: tx.time,
        typeLabel,
        amountLabel,
        amountColor,
        icon: <div className={`p-2 rounded-full flex-shrink-0 ${isBuy ? (isDark ? 'bg-green-500/10 text-green-400' : 'bg-green-100 text-green-600') : (isDark ? 'bg-red-500/10 text-red-400' : 'bg-red-100 text-red-600')}`}>{icon}</div>,
        details,
        category: 'crypto',
        rawTx: tx,
        sourceType: 'usdt_tx'
      });
    });

    // B. Client Transactions (Excluding those linked to Crypto Txs to avoid duplicates)
    clientTransactionsDzd.forEach(tx => {
      if (tx.linkedTxId) return; // Skip if linked to a crypto tx (already shown above)

      const client = clientsDzd.find(c => c.id === tx.clientId);
      const clientName = client ? getClientFullName(client) : 'Client Inconnu';

      let typeLabel = tx.type;
      let isPositive = tx.montant > 0; // Credit/Advance
      let amountLabel = `${Math.abs(tx.montant).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD`;
      let amountColor = isPositive ? 'text-green-400' : 'text-red-400';

      let icon;
      if (tx.type === 'Transfert Entrant' || tx.type === 'Transfert Sortant') {
        icon = <UsersIcon className="w-5 h-5" />;
        amountColor = 'text-blue-400'; // Transfers are neutral/blue
      } else {
        icon = isPositive ? <ArrowDownLeftIcon className="w-5 h-5" /> : <ArrowUpRightIcon className="w-5 h-5" />;
      }

      all.push({
        id: `client_${tx.id}`,
        originalId: tx.id,
        timestamp: tx.timestamp,
        date: tx.date,
        time: tx.time,
        typeLabel,
        amountLabel,
        amountColor,
        icon: <div className={`p-2 rounded-full flex-shrink-0 ${isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>{icon}</div>,
        details: `${clientName} ${tx.notes ? `• ${tx.notes}` : ''}`,
        category: 'client',
        rawTx: tx,
        sourceType: 'client_tx'
      });
    });

    // C. Treasury Transactions
    treasuryTransactions?.forEach(tx => {
      let typeLabel = tx.type === 'Ajout' ? 'Entrée Caisse' : 'Sortie Caisse';
      if (tx.source && tx.notes?.includes('Virement')) typeLabel = 'Virement Interne';

      let amountLabel = `${tx.amount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DZD`;
      let amountColor = tx.type === 'Ajout' ? 'text-green-400' : 'text-red-400';
      let icon = <WalletIcon className="w-5 h-5" />;

      all.push({
        id: `treasury_${tx.id}`,
        originalId: tx.id || '',
        timestamp: tx.timestamp,
        date: tx.date,
        time: tx.time,
        typeLabel,
        amountLabel,
        amountColor,
        icon: <div className={`p-2 rounded-full flex-shrink-0 ${isDark ? 'bg-purple-500/10 text-purple-400' : 'bg-purple-100 text-purple-600'}`}>{icon}</div>,
        details: `${tx.source} ${tx.notes ? `• ${tx.notes}` : ''}`,
        category: 'treasury',
        rawTx: tx,
        sourceType: 'treasury_tx'
      });
    });

    return all.sort((a, b) => b.timestamp - a.timestamp);
  }, [transactions, clientTransactionsDzd, treasuryTransactions, clientsDzd, isDark, getClientFullName]);

  // 2. FILTERING
  const filteredTransactions = useMemo(() => {
    return unifiedTransactions.filter(tx => {
      // Type Filter
      if (filterMode !== 'all') {
        if (filterMode === 'buy') { if (tx.category !== 'crypto' || !tx.typeLabel.includes('Achat')) return false; }
        else if (filterMode === 'sell') { if (tx.category !== 'crypto' || !tx.typeLabel.includes('Vente')) return false; }
        else if (filterMode === 'adjustments') { if (tx.category !== 'crypto' || !tx.typeLabel.includes('Manuel')) return false; } // Only crypto adjustments for now or expand?
        else if (filterMode === 'clients') { if (tx.category !== 'client') return false; }
        else if (filterMode === 'treasury') { if (tx.category !== 'treasury') return false; }
      }

      // Date Filter
      if (dateRange.start && dateRange.end) {
        if (tx.timestamp < dateRange.start.getTime() || tx.timestamp > dateRange.end.getTime()) return false;
      }

      return true;
    });
  }, [unifiedTransactions, filterMode, dateRange]);

  const groupedTransactions = useMemo(() => {
    return filteredTransactions.reduce((acc, tx) => {
      const dateKey = tx.date;
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(tx);
      return acc;
    }, {} as Record<string, DisplayTx[]>);
  }, [filteredTransactions]);

  const txFilterLabels: { [key in typeof filterMode]: string } = {
    all: 'Tout',
    buy: 'Achats',
    sell: 'Ventes',
    adjustments: 'Ajustements',
    clients: 'Clients',
    treasury: 'Trésorerie'
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">

      {/* Main Action Button */}
      <div className="mb-2">
        <Button
          onClick={() => setIsMenuOpen(true)}
          className="w-full py-4 rounded-xl shadow-lg font-bold text-lg text-white flex items-center justify-center gap-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-all transform hover:scale-[1.01]"
        >
          <PencilIcon className="w-5 h-5" />
          Nouvelle Transaction
        </Button>
      </div>

      <Card className={cardBase}>
        <CardHeader className="flex flex-row items-center justify-between p-4">
          <h2 className="font-bold text-lg">Historique des Transactions</h2>
          <div className="flex items-center gap-2">
            <Button
              onClick={openDateFilterModal}
              className={`p-2 rounded-lg font-semibold transition-colors ${isDark ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-200 hover:bg-slate-300'} ${dateRange.start ? (isDark ? 'bg-sky-500/20 text-sky-300' : 'bg-sky-100 text-sky-600') : ''}`}
              aria-label="Filtrer par date"
            >
              <CalendarIcon className="w-5 h-5" />
            </Button>
            <Dropdown isDark={isDark} trigger={
              <Button className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg font-semibold transition-colors ${isDark ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-200 hover:bg-slate-300'}`}>
                <FilterIcon className="w-4 h-4" />
                <span>{txFilterLabels[filterMode]}</span>
              </Button>
            }>
              <DropdownItem onClick={() => setFilterMode('all')} isActive={filterMode === 'all'}>Tout</DropdownItem>
              <DropdownItem onClick={() => setFilterMode('buy')} isActive={filterMode === 'buy'}>Achats (Crypto)</DropdownItem>
              <DropdownItem onClick={() => setFilterMode('sell')} isActive={filterMode === 'sell'}>Ventes (Crypto)</DropdownItem>
              <DropdownItem onClick={() => setFilterMode('clients')} isActive={filterMode === 'clients'}>Clients</DropdownItem>
              <DropdownItem onClick={() => setFilterMode('treasury')} isActive={filterMode === 'treasury'}>Trésorerie</DropdownItem>
            </Dropdown>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="space-y-4 pb-4">
            {Object.keys(groupedTransactions).length > 0 ? (
              Object.keys(groupedTransactions).map((date) => {
                const txsOnDate = groupedTransactions[date];
                return (
                  <div key={date}>
                    <h3 className={`font-semibold text-sm mb-2 px-4 ${subtleText}`}>{getRelativeDateLabel(date)}</h3>
                    <div className="divide-y" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
                      {txsOnDate.map(tx => (
                        <React.Fragment key={tx.id}>
                          <SwipeableListItem
                            onEdit={() => {
                              if (tx.sourceType === 'usdt_tx') openForm(tx.rawTx.type === 'buy' ? (tx.rawTx.currency === 'USDT' ? 'buy_usdt' : 'buy_eur') : 'sell_usdt', tx.rawTx);
                              else if (tx.sourceType === 'client_tx' && handleEditClientTx) handleEditClientTx(tx.rawTx);
                            }}
                            onDelete={() => {
                              if (tx.sourceType === 'usdt_tx') setTxToDelete(tx.rawTx);
                              else if (tx.sourceType === 'client_tx' && handleDeleteClientTxClick) handleDeleteClientTxClick(tx.rawTx);
                            }}
                            disableSwipe={tx.sourceType === 'treasury_tx'} // Disable swipe for treasury txs for now
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
                                {tx.sourceType === 'usdt_tx' && (tx.rawTx.price || tx.rawTx.sell) && <p className={`text-xs ${subtleText}`}>@ {(tx.rawTx.price || tx.rawTx.sell)?.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DZD</p>}
                              </div>
                            </div>
                          </SwipeableListItem>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                );
              })
            ) : (
              <p className={`text-center py-8 ${subtleText}`}>Aucune transaction pour ce filtre.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Transaction Type Selection Modal */}
      <Dialog isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} className={`${cardBase} max-w-sm`}>
        <DialogHeader onClose={() => setIsMenuOpen(false)} isDark={isDark}>
          <DialogTitle>Nouvelle Transaction</DialogTitle>
        </DialogHeader>
        <DialogContent className="grid grid-cols-1 gap-3 p-6 pt-0">
          <div className="grid grid-cols-2 gap-3 mb-2">
            <Button onClick={() => { setIsMenuOpen(false); openForm('buy_usdt'); }} className="bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-bold shadow-sm flex flex-col items-center gap-1 h-24 justify-center">
              <ArrowDownLeftIcon className="w-6 h-6" />
              <span>Achat USDT</span>
            </Button>
            <Button onClick={() => { setIsMenuOpen(false); openForm('sell_usdt'); }} className="bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-bold shadow-sm flex flex-col items-center gap-1 h-24 justify-center">
              <ArrowUpRightIcon className="w-6 h-6" />
              <span>Vente USDT</span>
            </Button>
          </div>
          <Button onClick={() => { setIsMenuOpen(false); openForm('buy_eur'); }} className="bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold text-lg shadow-sm mb-4">
            Acheter EUR
          </Button>

          <div className="border-t border-gray-200 dark:border-gray-700 pt-4 pb-2">
            <p className="text-center text-xs font-bold uppercase tracking-wider opacity-50 mb-3">Actions Financières</p>

            <div className="grid grid-cols-1 gap-3">
              {/* Virement Interne Button */}
              <Button onClick={() => { setIsMenuOpen(false); openWalletTransferModal(); }}
                className={`w-full py-3 rounded-xl font-bold shadow-sm flex items-center justify-between px-4 transition-all ${isDark ? 'bg-indigo-900/30 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-900/50' : 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'}`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${isDark ? 'bg-indigo-500/20' : 'bg-indigo-100'}`}><RefreshCwIcon className="w-5 h-5" /></div>
                  <div className="text-left">
                    <div className="text-sm font-bold">Virement Interne</div>
                    <div className="text-[10px] opacity-70">Entre Caisse et BaridiMob</div>
                  </div>
                </div>
                <ChevronRightIcon className="w-4 h-4 opacity-50" />
              </Button>

              {/* Virement Clients Button */}
              <Button onClick={() => { setIsMenuOpen(false); openTransferModal(); }}
                className={`w-full py-3 rounded-xl font-bold shadow-sm flex items-center justify-between px-4 transition-all ${isDark ? 'bg-sky-900/30 text-sky-300 border border-sky-500/30 hover:bg-sky-900/50' : 'bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100'}`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${isDark ? 'bg-sky-500/20' : 'bg-sky-100'}`}><UsersIcon className="w-5 h-5" /></div>
                  <div className="text-left">
                    <div className="text-sm font-bold">Virement Clients</div>
                    <div className="text-[10px] opacity-70">Transférer dette/crédit</div>
                  </div>
                </div>
                <ChevronRightIcon className="w-4 h-4 opacity-50" />
              </Button>
            </div>

            <Button onClick={() => { setIsMenuOpen(false); openAdjustmentModal('add'); }} className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 mt-3 ${isDark ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}>
              <BriefcaseIcon className="w-4 h-4 opacity-70" />
              Ajustement Trésorerie
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
