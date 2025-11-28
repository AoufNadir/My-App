
import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Tx, ClientDzd, ClientTransactionDzd } from '../types';
import { Dropdown, DropdownItem } from '../components/ui/Dropdown';
import { FilterIcon } from '../components/icons/FilterIcon';

import { UserIcon } from '../components/icons/UserIcon';
import { PlusIcon } from '../components/icons/PlusIcon';
import { ArrowRightLeftIcon } from '../components/icons/ArrowRightLeftIcon';
import { ArrowDownIcon } from '../components/icons/ArrowDownIcon';
import { ArrowUpIcon } from '../components/icons/ArrowUpIcon';
import { ChevronLeftIcon } from '../components/icons/ChevronLeftIcon';
import { PencilIcon } from '../components/icons/PencilIcon';
import { Trash2Icon } from '../components/icons/Trash2Icon';
import { CopyIcon } from '../components/icons/CopyIcon';
import { CheckIcon } from '../components/icons/CheckIcon';
import { SwipeableListItem } from '../components/ui/SwipeableListItem';

type ClientsPageProps = {
  selectedClientId: string | null;
  setSelectedClientId: (id: string | null) => void;
  cardBase: string;
  fieldBase: string;
  isDark: boolean;
  subtleText: string;
  openClientModal: (client: ClientDzd | null) => void;
  setIsTransferModalOpen: (isOpen: boolean) => void;

  clientSearchQuery: string;
  setClientSearchQuery: (query: string) => void;
  clientSortMode: 'all' | 'advances' | 'debts' | 'zero_balance';
  setClientSortMode: (mode: 'all' | 'advances' | 'debts' | 'zero_balance') => void;
  filteredClientsDzd: ClientDzd[];
  clientBalances: Map<string, number>;
  getClientFullName: (client: ClientDzd) => string;
  handleTouchStart: (client: ClientDzd) => void;
  handleTouchEnd: () => void;
  setClientToDelete: (client: ClientDzd | null) => void;
  selectedClient: ClientDzd | undefined;
  selectedClientTransactions: ClientTransactionDzd[];
  transactions: Tx[];
  handleExportClientReport: (clientId: string, month: number, year: number) => void;
  openClientTxModal: (tx: ClientTransactionDzd | null, presetType?: string) => void;
  copiedValue: string | null;
  handleCopy: (text: string) => void;
  handleEditClientTx: (tx: ClientTransactionDzd) => void;
  handleDeleteClientTxClick: (tx: ClientTransactionDzd) => void;
};

export function ClientsPage(props: ClientsPageProps) {
  const {
    selectedClientId, setSelectedClientId, cardBase, fieldBase, isDark, subtleText,
    openClientModal, setIsTransferModalOpen,
    clientSearchQuery, setClientSearchQuery, clientSortMode, setClientSortMode,
    filteredClientsDzd, clientBalances, getClientFullName, handleTouchStart, handleTouchEnd,
    setClientToDelete, selectedClient, selectedClientTransactions, transactions,
    handleExportClientReport, openClientTxModal, copiedValue, handleCopy,
    handleEditClientTx, handleDeleteClientTxClick
  } = props;

  const clientSortLabels = {
    all: 'Tous',
    advances: 'Avances',
    debts: 'Dettes',
    zero_balance: 'Solde Nul'
  };

  // Helper for Date Grouping
  const groupedHistory = useMemo(() => {
    if (!selectedClientTransactions) return {};

    const groups: Record<string, ClientTransactionDzd[]> = {};
    selectedClientTransactions.forEach(tx => {
      if (!groups[tx.date]) {
        groups[tx.date] = [];
      }
      groups[tx.date].push(tx);
    });
    return groups;
  }, [selectedClientTransactions]);

  const getRelativeDateLabel = (dateString: string) => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const parts = dateString.split('/');
    // Assuming DD/MM/YYYY format from app logic
    const txDate = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));

    if (txDate.toDateString() === today.toDateString()) {
      return "Aujourd'hui";
    }
    if (txDate.toDateString() === yesterday.toDateString()) {
      return "Hier";
    }
    // Format DD MMM YYYY roughly or keep original
    return dateString;
  };

  // Helper for Copy Row
  const CopyRow = ({ label, value }: { label: string, value: string }) => {
    if (!value) return null;
    const isCopied = copiedValue === value;
    return (
      <div className={`flex items-center justify-between p-2 rounded-lg mb-1 last:mb-0 ${isDark ? 'bg-[#111827]' : 'bg-gray-50'}`}>
        <div className="flex flex-col overflow-hidden">
          <span className={`text-[10px] uppercase ${subtleText}`}>{label}</span>
          <span className="text-sm font-medium truncate select-all leading-tight">{value}</span>
        </div>
        <Button
          onClick={() => handleCopy(value)}
          className={`ml-2 p-1.5 rounded-md shrink-0 transition-colors ${isCopied ? 'bg-green-500/10 text-green-500' : (isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-white border text-gray-500 hover:bg-gray-100')}`}
        >
          {isCopied ? <CheckIcon className="w-3.5 h-3.5" /> : <CopyIcon className="w-3.5 h-3.5" />}
        </Button>
      </div>
    );
  };

  if (selectedClientId && selectedClient) {
    const selectedClientBalance = clientBalances.get(selectedClientId) || 0;
    const dates = Object.keys(groupedHistory); // Keys are dates

    return (
      <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <Button onClick={() => setSelectedClientId(null)} className={`p-2 rounded-full ${isDark ? 'text-gray-300 hover:bg-white/10' : 'text-gray-600 hover:bg-black/5'}`}>
            <ChevronLeftIcon className="w-6 h-6" />
          </Button>
          <div className="flex-grow min-w-0">
            <h2 className="font-bold text-xl truncate">{getClientFullName(selectedClient)}</h2>
            <p className={`text-sm ${subtleText}`}>Solde: <span className={`font-bold ${selectedClientBalance >= 0 ? 'text-green-400' : 'text-red-400'}`}>{selectedClientBalance.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DZD</span></p>
          </div>
          <Button onClick={() => openClientModal(selectedClient)} className={`p-2 rounded-full ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'}`} aria-label="Modifier le client"><PencilIcon className="w-5 h-5" /></Button>
        </div>

        {/* FEATURE 1: Contact Info & Quick Copy Card */}
        {(selectedClient.phone || selectedClient.redotpayId || selectedClient.binanceEmail) && (
          <Card className={`${cardBase} mb-4`}>
            <CardContent className="p-3">
              <CopyRow label="Téléphone" value={selectedClient.phone || ''} />
              <CopyRow label="RedotPay ID" value={selectedClient.redotpayId || ''} />
              <CopyRow label="Binance Email" value={selectedClient.binanceEmail || ''} />
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}


        {/* FEATURE 2: Historique Redesign */}
        <Card className={cardBase}>
          <CardHeader className="p-4">
            <h2 className="font-bold text-lg">Historique du Client</h2>
          </CardHeader>
          <CardContent className="p-0">
            {dates.length > 0 ? (
              <div className="pb-4">
                {dates.map(date => (
                  <div key={date}>
                    {/* Date Header */}
                    <div className={`sticky top-0 z-10 px-4 py-2 text-xs font-bold uppercase tracking-wider ${isDark ? 'bg-[#111827]/95 text-gray-400 backdrop-blur-sm' : 'bg-gray-50/95 text-gray-500 backdrop-blur-sm'}`}>
                      {getRelativeDateLabel(date)} <span className="font-normal normal-case opacity-70 ml-1">({date})</span>
                    </div>

                    <div className="divide-y" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
                      {groupedHistory[date].map(tx => {
                        const linkedUsdtTx = tx.linkedTxId ? transactions.find(t => t.id === tx.linkedTxId) : null;
                        const isCredit = tx.montant > 0;

                        // Layout Data
                        let typeLabel: string = tx.type;
                        let calcDetails = ''; // Bottom Right

                        if (linkedUsdtTx) {
                          if (linkedUsdtTx.type === 'buy') {
                            typeLabel = `Achat ${linkedUsdtTx.currency}`;
                            calcDetails = `${linkedUsdtTx.quantity.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} x ${linkedUsdtTx.price?.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                          } else if (linkedUsdtTx.type === 'sell') {
                            typeLabel = `Vente ${linkedUsdtTx.currency}`;
                            calcDetails = `${linkedUsdtTx.quantity.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} x ${linkedUsdtTx.sell?.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                          }
                        }

                        // Fallback notes if specific calc details aren't present but notes exist
                        if (!calcDetails && tx.notes) {
                          // Keep it clean, maybe just show part of notes if short
                        }

                        return (
                          <React.Fragment key={tx.id}>
                            <SwipeableListItem
                              onEdit={() => handleEditClientTx(tx)}
                              onDelete={() => handleDeleteClientTxClick(tx)}
                            >
                              <div className={`flex items-start gap-3 w-full py-3 px-4 ${isDark ? 'bg-[#111827]' : 'bg-white'}`}>
                                {/* Icon */}
                                <div className="flex-shrink-0 pt-1">
                                  <div className={`p-2 rounded-full ${isCredit ? (isDark ? 'bg-green-500/10 text-green-400' : 'bg-green-100 text-green-600') : (isDark ? 'bg-red-500/10 text-red-400' : 'bg-red-100 text-red-600')}`}>
                                    {isCredit ? <ArrowDownIcon className="w-5 h-5" /> : <ArrowUpIcon className="w-5 h-5" />}
                                  </div>
                                </div>

                                {/* 4-Corner Layout */}
                                <div className="flex-1 min-w-0 flex justify-between items-start">
                                  {/* Left Column */}
                                  <div className="flex flex-col min-w-0 mr-2">
                                    {/* Top Left: Type */}
                                    <span className="font-bold text-sm truncate leading-tight mb-1">
                                      {typeLabel}
                                    </span>
                                    {/* Bottom Left: Time */}
                                    <span className={`text-xs ${subtleText}`}>
                                      {tx.time}
                                    </span>
                                  </div>

                                  {/* Right Column */}
                                  <div className="flex flex-col items-end flex-shrink-0">
                                    {/* Top Right: Amount */}
                                    <span className={`font-bold text-sm leading-tight mb-1 ${isCredit ? 'text-green-400' : 'text-red-400'}`}>
                                      {tx.montant > 0 ? '+' : ''}{tx.montant.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DZD
                                    </span>
                                    {/* Bottom Right: Details (Calc) */}
                                    <span className={`text-[11px] ${subtleText} font-mono tracking-tight`}>
                                      {calcDetails}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </SwipeableListItem>
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className={`text-center py-8 ${subtleText}`}>Aucune transaction pour ce client.</p>
            )}
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <Card className={cardBase}>
        <CardHeader className="p-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className={`font-bold text-xl tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>Liste des Clients</h2>
            </div>

            {/* Client Count Card - Professional Design */}
            <div className={`flex items-center gap-3 p-3.5 rounded-xl border shadow-sm transition-all ${isDark ? 'bg-gradient-to-r from-slate-800/80 to-slate-800/50 border-slate-700/50' : 'bg-gradient-to-r from-indigo-50/50 to-white border-indigo-100/50'}`}>
              <div className={`p-2.5 rounded-lg ${isDark ? 'bg-indigo-500/20' : 'bg-indigo-100'}`}>
                <UserIcon className={`w-5 h-5 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
              </div>
              <div className="flex-1">
                <p className={`text-xs font-medium uppercase tracking-wide ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Nombre de Clients
                </p>
                <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {filteredClientsDzd.length}
                </p>
              </div>
            </div>

            {/* Full Width Buttons */}
            <div className="w-full">
              <Button onClick={() => openClientModal(null)} className={`w-full py-3 rounded-xl font-bold border transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                <UserIcon className="w-5 h-5" />
                <span>Nouveau Client</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="flex gap-2 mb-4">
            <Input type="text" placeholder="Rechercher un client..." value={clientSearchQuery} onChange={e => setClientSearchQuery(e.target.value)} className={`${fieldBase} flex-grow`} />
          </div>
          <Dropdown isDark={isDark} trigger={
            <Button className={`w-full flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg font-semibold transition-colors ${isDark ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-200 hover:bg-slate-300'}`}>
              <FilterIcon className="w-4 h-4" />
              <span>{clientSortLabels[clientSortMode]}</span>
            </Button>
          }>
            <DropdownItem onClick={() => setClientSortMode('all')} isActive={clientSortMode === 'all'}>Tous</DropdownItem>
            <DropdownItem onClick={() => setClientSortMode('advances')} isActive={clientSortMode === 'advances'}>Avances (+)</DropdownItem>
            <DropdownItem onClick={() => setClientSortMode('debts')} isActive={clientSortMode === 'debts'}>Dettes (-)</DropdownItem>
            <DropdownItem onClick={() => setClientSortMode('zero_balance')} isActive={clientSortMode === 'zero_balance'}>Solde Nul</DropdownItem>
          </Dropdown >
        </CardContent >
        <CardContent className="p-0">
          {filteredClientsDzd.length > 0 ? (
            <div className="divide-y" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>

              {filteredClientsDzd.map(client => {
                const balance = clientBalances.get(client.id) || 0;
                return (
                  <SwipeableListItem
                    key={client.id}
                    onEdit={() => openClientModal(client)}
                    onDelete={() => setClientToDelete(client)}
                  >
                    <div onTouchStart={() => handleTouchStart(client)} onTouchEnd={handleTouchEnd} onContextMenu={(e) => { e.preventDefault(); handleTouchStart(client); }}
                      className={`flex items-center gap-3 p-4 cursor-pointer w-full relative z-10 ${isDark ? 'bg-[#111827]' : 'bg-white'}`} onClick={() => setSelectedClientId(client.id)}>
                      <div className={`p-2 rounded-full flex-shrink-0 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}><UserIcon className="w-5 h-5" /></div>
                      <div className="flex-grow min-w-0">
                        <p className="font-bold truncate">{getClientFullName(client)}</p>
                        <p className={`text-xs ${subtleText} truncate`}>{client.phone || 'Pas de numéro'}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`font-bold ${balance > 0 ? 'text-green-400' : balance < 0 ? 'text-red-400' : ''}`}>{balance.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DZD</p>
                      </div>
                    </div>
                  </SwipeableListItem>
                );
              })}
            </div>
          ) : (
            <p className={`text-center py-8 ${subtleText}`}>Aucun client trouvé.</p>
          )}
        </CardContent>
      </Card >
    </motion.div >
  );
}
