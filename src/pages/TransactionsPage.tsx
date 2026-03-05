import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../components/ui/Button';
import { Tx, ClientDzd, ClientTransactionDzd, TreasuryTx } from '../types';
import { PencilIcon } from '../components/icons/PencilIcon';
import { useLanguage } from '../contexts/LanguageContext';
import { TransactionsHistoryCard } from '../components/transactions/TransactionsHistoryCard';
import { NewTransactionMenuDialog } from '../components/transactions/NewTransactionMenuDialog';
import { TransactionFilterMode } from '../components/transactions/transactionsTypes';
import { useTransactionsViewModel } from '../components/transactions/useTransactionsViewModel';

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

  const {
    savedFilters,
    txFilterLabels,
    groupedTransactions,
    formatDzdAmount,
    handleSaveCurrentFilter,
    handleApplySavedFilter,
    handleDeleteSavedFilter,
    handleEditDisplayTx,
    handleDeleteDisplayTx
  } = useTransactionsViewModel({
    isDark,
    t: t as (key: string) => string,
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
  });

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

      <TransactionsHistoryCard
        cardBase={cardBase}
        isDark={isDark}
        subtleText={subtleText}
        t={t as (key: string) => string}
        openDateFilterModal={openDateFilterModal}
        dateRange={dateRange}
        onSaveCurrentFilter={handleSaveCurrentFilter}
        savedFilters={savedFilters}
        onApplySavedFilter={handleApplySavedFilter}
        onDeleteSavedFilter={handleDeleteSavedFilter}
        txFilterLabels={txFilterLabels}
        filterMode={filterMode}
        setFilterMode={setFilterMode}
        groupedTransactions={groupedTransactions}
        getRelativeDateLabel={getRelativeDateLabel}
        onEditDisplayTx={handleEditDisplayTx}
        onDeleteDisplayTx={handleDeleteDisplayTx}
        formatDzdAmount={formatDzdAmount}
      />

      <NewTransactionMenuDialog
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        cardBase={cardBase}
        isDark={isDark}
        t={t as (key: string) => string}
        openForm={(newMode) => openForm(newMode)}
        openWalletTransferModal={openWalletTransferModal}
        openTransferModal={openTransferModal}
        openAdjustmentModal={(type) => openAdjustmentModal(type)}
      />
    </motion.div>
  );
}
