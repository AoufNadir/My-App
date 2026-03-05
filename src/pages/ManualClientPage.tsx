import React from 'react';
import { motion } from 'framer-motion';
import { ManualAssetClient, ManualAssetTransaction } from '../types';
import { ManualClientTransactionsPanel } from '../components/manual-client/ManualClientTransactionsPanel';
import { ManualClientTransactionDialog } from '../components/manual-client/ManualClientTransactionDialog';
import { ManualClientHeaderStats } from '../components/manual-client/ManualClientHeaderStats';
import { useManualClientTransactionManager } from '../hooks/useManualClientTransactionManager';

type ManualClientPageProps = {
  client: ManualAssetClient;
  transactions: ManualAssetTransaction[];
  balance: number;
  onBack: () => void;
  onAddTransaction: (data: Omit<ManualAssetTransaction, 'id'>) => void;
  onUpdateTransaction: (txId: string, data: Omit<ManualAssetTransaction, 'id'>) => void;
  onDeleteTransaction: (txId: string) => void;
  isDark: boolean;
  cardBase: string;
  fieldBase: string;
  subtleText: string;
};

export function ManualClientPage({
  client,
  transactions,
  balance,
  onBack,
  onAddTransaction,
  onUpdateTransaction,
  onDeleteTransaction,
  isDark,
  cardBase,
  fieldBase,
  subtleText
}: ManualClientPageProps) {
  const {
    orderedTransactions,
    isTxModalOpen,
    editingTx,
    txType,
    setTxType,
    amount,
    setAmount,
    serviceType,
    setServiceType,
    notes,
    setNotes,
    paymentMethod,
    setPaymentMethod,
    openCreateModal,
    openEditModal,
    closeTransactionModal,
    handleSaveTx
  } = useManualClientTransactionManager({
    client,
    transactions,
    onAddTransaction,
    onUpdateTransaction
  });

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
      <ManualClientHeaderStats
        clientName={client.fullName}
        clientPhone={client.phone}
        balance={balance}
        onBack={onBack}
        isDark={isDark}
        subtleText={subtleText}
      />

      <ManualClientTransactionsPanel
        isDark={isDark}
        subtleText={subtleText}
        orderedTransactions={orderedTransactions}
        onOpenCreateModal={openCreateModal}
        onOpenEditModal={openEditModal}
        onDeleteTransaction={onDeleteTransaction}
      />

      <ManualClientTransactionDialog
        isDark={isDark}
        cardBase={cardBase}
        fieldBase={fieldBase}
        isTxModalOpen={isTxModalOpen}
        editingTx={editingTx}
        txType={txType}
        setTxType={setTxType}
        amount={amount}
        setAmount={setAmount}
        serviceType={serviceType}
        setServiceType={setServiceType}
        notes={notes}
        setNotes={setNotes}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        onClose={closeTransactionModal}
        onSave={handleSaveTx}
      />
    </motion.div>
  );
}
