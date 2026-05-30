import { useMemo, useState } from 'react';
import { Button } from '../components/ui/Button';
import { Tx, ClientDzd, ClientTransactionDzd, TreasuryTx } from '../types';
import { PlusIcon } from '../components/icons/PlusIcon';
import { BriefcaseIcon } from '../components/icons/BriefcaseIcon';
import { HeroKpiCard } from '../components/ui/HeroKpiCard';
import { useLanguage } from '../contexts/LanguageContext';
import { TransactionsHistoryCard } from '../components/transactions/TransactionsHistoryCard';
import { NewTransactionMenuDialog } from '../components/transactions/NewTransactionMenuDialog';
import { TransactionFilterMode, DisplayTx } from '../components/transactions/transactionsTypes';
import { useTransactionsViewModel } from '../components/transactions/useTransactionsViewModel';

type TransactionsPageProps = {
  openAdjustmentModal: (type: 'add' | 'subtract', txToEdit?: TreasuryTx | null) => void;
  openForm: (newMode: 'buy_usdt' | 'sell_usdt' | 'buy_eur' | 'sell_eur', txToEdit?: Tx | null) => void;
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
  openDeliveryExpenseModal: () => void;
  openPersonalWithdrawalModal?: () => void;
  treasuryTransactions: TreasuryTx[];
  handleEditPortfolioTx?: (tx: Tx) => void;
  handleEditClientTx?: (tx: ClientTransactionDzd) => void;
  handleEditTreasuryTx?: (tx: TreasuryTx) => void;
  handleDeleteClientTxClick?: (tx: ClientTransactionDzd) => void;
  setTreasuryTxToDelete?: (tx: TreasuryTx | null) => void;
};

export function TransactionsPage({
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
  openDeliveryExpenseModal,
  openPersonalWithdrawalModal,
  treasuryTransactions,
  handleEditPortfolioTx,
  handleEditClientTx,
  handleEditTreasuryTx,
  handleDeleteClientTxClick,
  setTreasuryTxToDelete,
}: TransactionsPageProps) {
  const { t } = useLanguage();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const {
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
  } = useTransactionsViewModel({
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
    handleEditPortfolioTx,
    handleEditClientTx,
    handleEditTreasuryTx,
    handleDeleteClientTxClick,
    setTreasuryTxToDelete,
  });

  const stats = useMemo(() => {
    const allTxs: DisplayTx[] = Object.values(groupedTransactions).flat() as DisplayTx[];
    return {
      total:    allTxs.length,
      crypto:   allTxs.filter((tx) => tx.category === 'crypto').length,
      client:   allTxs.filter((tx) => tx.category === 'client').length,
      treasury: allTxs.filter((tx) => tx.category === 'treasury').length,
    };
  }, [groupedTransactions]);

  return (
    <div className="anim-page-in space-y-5">
      <HeroKpiCard
        accent="sky"
        icon={<BriefcaseIcon className="w-5 h-5" />}
        primaryLabel={t('transactions.history') as string}
        primaryValue={stats.total}
        primaryCurrency={null}
        primarySemantic="plain"
        secondary={[
          { label: 'Portefeuille',               value: stats.crypto,   currency: null, semantic: 'plain' },
          { label: t('nav.clients') as string,   value: stats.client,   currency: null, semantic: 'plain' },
          { label: t('nav.treasury') as string,  value: stats.treasury, currency: null, semantic: 'plain' },
        ]}
      />

      <Button
        variant="primary"
        size="lg"
        onClick={() => setIsMenuOpen(true)}
        className="w-full font-bold"
      >
        <PlusIcon className="w-4 h-4" />
        {t('transactions.newTransaction')}
      </Button>

      <TransactionsHistoryCard
        t={t as (key: string) => string}
        openDateFilterModal={openDateFilterModal}
        dateRange={dateRange}
        onSaveCurrentFilter={handleSaveCurrentFilter}
        savedFilters={savedFilters}
        onApplySavedFilter={handleApplySavedFilter}
        onDeleteSavedFilter={handleDeleteSavedFilter}
        txFilterLabels={txFilterLabels}
        txFilterCounts={txFilterCounts}
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
        t={t as (key: string) => string}
        openForm={(newMode) => openForm(newMode)}
        openWalletTransferModal={openWalletTransferModal}
        openTransferModal={openTransferModal}
        openAdjustmentModal={(type) => openAdjustmentModal(type)}
        openDeliveryExpenseModal={openDeliveryExpenseModal}
        openPersonalWithdrawalModal={openPersonalWithdrawalModal}
      />
    </div>
  );
}
