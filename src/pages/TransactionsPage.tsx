import { useMemo, useState } from 'react';
import { Button } from '../components/ui/Button';
import { Tx, ClientDzd, ClientTransactionDzd, TreasuryTx } from '../types';
import { PlusIcon } from '../components/icons/PlusIcon';
import { BriefcaseIcon } from '../components/icons/BriefcaseIcon';
import { DownloadCloudIcon } from '../components/icons/DownloadCloudIcon';
import { HeroKpiCard } from '../components/ui/HeroKpiCard';
import { useLanguage } from '../contexts/LanguageContext';
import { TransactionsHistoryCard } from '../components/transactions/TransactionsHistoryCard';
import { NewTransactionMenuDialog } from '../components/transactions/NewTransactionMenuDialog';
import { TransactionFilterMode, DisplayTx } from '../components/transactions/transactionsTypes';
import { useTransactionsViewModel } from '../components/transactions/useTransactionsViewModel';

async function exportTransactionsPdf(groupedTransactions: Record<string, DisplayTx[]>, getClientFullName: (c: ClientDzd) => string, clientsDzd: ClientDzd[], filterLabel: string) {
    const { buildTransactionListPdf, openPdfPrintWindow } = await import('../utils/pdfReports');
    const clientById = new Map(clientsDzd.map((c) => [c.id, c]));
    const getClientName = (id: string | undefined) => {
        if (!id) return '';
        const c = clientById.get(id);
        return c ? getClientFullName(c) : id;
    };
    const allTxs = Object.values(groupedTransactions).flat() as DisplayTx[];
    const rows = allTxs.map((dtx) => {
        const raw = dtx.rawTx;
        const tagsStr = Array.isArray((raw as any).tags) ? ((raw as any).tags as string[]).join(';') : '';
        if (dtx.category === 'crypto') {
            const tx = raw as Tx;
            const qty = tx.quantity ?? 0;
            const price = tx.price ?? tx.sell ?? 0;
            const total = tx.total ?? (qty * price);
            return { date: dtx.date, time: dtx.time, category: 'Portefeuille', type: dtx.typeLabel, currency: tx.currency, quantity: String(qty), price: String(price), totalDzd: String(Math.round(total)), client: getClientName(tx.linkedClientId), notes: tx.notes ?? '', tags: tagsStr };
        } else if (dtx.category === 'client') {
            const tx = raw as ClientTransactionDzd;
            return { date: dtx.date, time: dtx.time, category: 'Client', type: dtx.typeLabel, currency: 'DZD', quantity: '', price: '', totalDzd: String(Math.round(Math.abs(Number(tx.montant ?? 0)))), client: getClientName(tx.clientId), notes: tx.notes ?? '', tags: tagsStr };
        } else {
            const tx = raw as TreasuryTx;
            return { date: dtx.date, time: dtx.time, category: 'Trésorerie', type: dtx.typeLabel, currency: 'DZD', quantity: '', price: '', totalDzd: String(Math.round(Number(tx.amount ?? 0))), client: '', notes: tx.notes ?? '', tags: tagsStr };
        }
    });
    const report = buildTransactionListPdf(rows, filterLabel);
    openPdfPrintWindow(report);
}

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

      <div className="flex gap-2">
        <Button
          variant="primary"
          size="lg"
          onClick={() => setIsMenuOpen(true)}
          className="flex-1 font-bold"
        >
          <PlusIcon className="w-4 h-4" />
          {t('transactions.newTransaction')}
        </Button>
        <Button
          variant="outline"
          size="lg"
          onClick={() => exportTransactionsPdf(groupedTransactions, getClientFullName, clientsDzd, `${stats.total} opérations`)}
          className="shrink-0 font-semibold px-3"
          title="Exporter PDF"
          aria-label="Exporter PDF"
        >
          <DownloadCloudIcon className="w-4 h-4" />
          <span className="hidden sm:inline">PDF</span>
        </Button>
      </div>

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
