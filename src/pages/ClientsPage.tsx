import React, { useMemo } from 'react';
import { Tx, ClientDzd, ClientTransactionDzd, OverdueDebtClient } from '../types';
import { ClientDetailsView } from '../components/clients/ClientDetailsView';
import { ClientsListView } from '../components/clients/ClientsListView';

type ClientSortMode = 'all' | 'advances' | 'debts' | 'zero_balance';

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
  clientSortMode: ClientSortMode;
  setClientSortMode: (mode: ClientSortMode) => void;
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
  overdueDebtClients: OverdueDebtClient[];
};

export function ClientsPage(props: ClientsPageProps) {
  const {
    selectedClientId, setSelectedClientId, cardBase, fieldBase, isDark, subtleText,
    openClientModal,
    clientSearchQuery, setClientSearchQuery, clientSortMode, setClientSortMode,
    filteredClientsDzd, clientBalances, getClientFullName, handleTouchStart, handleTouchEnd,
    setClientToDelete, selectedClient, selectedClientTransactions, transactions,
    copiedValue, handleCopy, handleEditClientTx, handleDeleteClientTxClick, overdueDebtClients
  } = props;

  const groupedHistory = useMemo(() => {
    const groups: Record<string, ClientTransactionDzd[]> = {};
    selectedClientTransactions?.forEach((tx) => {
      if (!groups[tx.date]) {
        groups[tx.date] = [];
      }
      groups[tx.date].push(tx);
    });
    return groups;
  }, [selectedClientTransactions]);

  if (selectedClientId && selectedClient) {
    const selectedClientBalance = clientBalances.get(selectedClientId) || 0;
    return (
      <ClientDetailsView
        selectedClientId={selectedClientId}
        selectedClient={selectedClient}
        selectedClientBalance={selectedClientBalance}
        groupedHistory={groupedHistory}
        cardBase={cardBase}
        isDark={isDark}
        subtleText={subtleText}
        setSelectedClientId={setSelectedClientId}
        getClientFullName={getClientFullName}
        handleTouchStart={handleTouchStart}
        openClientModal={openClientModal}
        copiedValue={copiedValue}
        handleCopy={handleCopy}
        transactions={transactions}
        handleEditClientTx={handleEditClientTx}
        handleDeleteClientTxClick={handleDeleteClientTxClick}
      />
    );
  }

  return (
    <ClientsListView
      cardBase={cardBase}
      fieldBase={fieldBase}
      isDark={isDark}
      subtleText={subtleText}
      openClientModal={openClientModal}
      clientSearchQuery={clientSearchQuery}
      setClientSearchQuery={setClientSearchQuery}
      clientSortMode={clientSortMode}
      setClientSortMode={setClientSortMode}
      filteredClientsDzd={filteredClientsDzd}
      clientBalances={clientBalances}
      getClientFullName={getClientFullName}
      handleTouchStart={handleTouchStart}
      handleTouchEnd={handleTouchEnd}
      setClientToDelete={setClientToDelete}
      setSelectedClientId={setSelectedClientId}
      overdueDebtClients={overdueDebtClients}
    />
  );
}
