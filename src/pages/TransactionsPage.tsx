import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../components/ui/Button';
import { Tx, ClientDzd, ClientTransactionDzd, TreasuryTx, DigitalServiceTransaction } from '../types';
import { PlusIcon } from '../components/icons/PlusIcon';
import { DownloadCloudIcon } from '../components/icons/DownloadCloudIcon';
import { useLanguage } from '../contexts/LanguageContext';
import { TransactionsHistoryCard } from '../components/transactions/TransactionsHistoryCard';
import { useHeaderActionsSlot } from '../components/main/headerActionsSlot';
import { TransactionFilterMode, DisplayTx } from '../components/transactions/transactionsTypes';
import { useTransactionsViewModel } from '../components/transactions/useTransactionsViewModel';
import type { PamLedgerResult } from '../utils/pamLedger';
import { getTransactionTagLabel } from '../utils/transactionTerminology';

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
        const tagsStr = Array.isArray((raw as any).tags)
            ? ((raw as any).tags as string[]).map((tag) => getTransactionTagLabel(tag)).join(';')
            : '';
        if (dtx.category === 'crypto') {
            const tx = raw as Tx;
            const qty = tx.quantity ?? 0;
            const price = tx.price ?? tx.sell ?? 0;
            const total = tx.total ?? (qty * price);
            return { date: dtx.date, time: dtx.time, category: 'Portefeuille', type: dtx.typeLabel, currency: tx.currency, quantity: String(qty), price: String(price), totalDzd: String(Math.round(total)), client: getClientName(tx.linkedClientId), notes: tx.notes ?? '', tags: tagsStr };
        } else if (dtx.category === 'client') {
            const tx = raw as ClientTransactionDzd;
            return { date: dtx.date, time: dtx.time, category: 'Client', type: dtx.typeLabel, currency: 'DZD', quantity: '', price: '', totalDzd: String(Math.round(Math.abs(Number(tx.montant ?? 0)))), client: getClientName(tx.clientId), notes: tx.notes ?? '', tags: tagsStr };
        } else if (dtx.category === 'digital_service') {
            const tx = raw as DigitalServiceTransaction;
            return { date: dtx.date, time: dtx.time, category: 'Service numérique', type: dtx.typeLabel, currency: tx.saleCurrency, quantity: String(tx.saleAmount), price: '', totalDzd: String(Math.round(tx.saleAmountDzd)), client: getClientName(tx.clientId), notes: tx.notes ?? '', tags: tagsStr };
        } else {
            const tx = raw as TreasuryTx;
            return { date: dtx.date, time: dtx.time, category: 'Trésorerie', type: dtx.typeLabel, currency: 'DZD', quantity: '', price: '', totalDzd: String(Math.round(Number(tx.amountDzd ?? tx.amount ?? 0))), client: '', notes: tx.notes ?? '', tags: tagsStr };
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
  profitByTxId: PamLedgerResult['profitByTxId'];
  getRelativeDateLabel: (dateString: string) => string;
  clientTransactionsDzd: ClientTransactionDzd[];
  digitalServiceTransactions: DigitalServiceTransaction[];
  clientsDzd: ClientDzd[];
  getClientFullName: (client: ClientDzd) => string;
  setTxToDelete: (tx: Tx | null) => void;
  openDateFilterModal: () => void;
  dateRange: { start: Date | null; end: Date | null };
  setDateRange: (range: { start: Date | null; end: Date | null }) => void;
  /** Opens the new-operation menu (the same one as the phone's (+)); left out while the data loads. */
  onOpenNewOperation?: () => void;
  treasuryTransactions: TreasuryTx[];
  handleEditPortfolioTx?: (tx: Tx) => void;
  handleEditClientTx?: (tx: ClientTransactionDzd) => void;
  handleEditTreasuryTx?: (tx: TreasuryTx) => void;
  handleEditDigitalServiceTx?: (tx: DigitalServiceTransaction) => void;
  handleDeleteDigitalServiceTx?: (tx: DigitalServiceTransaction) => void;
  handleDeleteClientTxClick?: (tx: ClientTransactionDzd) => void;
  setTreasuryTxToDelete?: (tx: TreasuryTx | null) => void;
};

export function TransactionsPage({
  openAdjustmentModal,
  openForm,
  filterMode,
  setFilterMode,
  transactions,
  profitByTxId: providedProfitByTxId,
  getRelativeDateLabel,
  clientTransactionsDzd,
  digitalServiceTransactions,
  clientsDzd,
  getClientFullName,
  setTxToDelete,
  openDateFilterModal,
  dateRange,
  setDateRange,
  onOpenNewOperation,
  treasuryTransactions,
  handleEditPortfolioTx,
  handleEditClientTx,
  handleEditTreasuryTx,
  handleEditDigitalServiceTx,
  handleDeleteDigitalServiceTx,
  handleDeleteClientTxClick,
  setTreasuryTxToDelete,
}: TransactionsPageProps) {
  const { t } = useLanguage();
  const headerActionsSlot = useHeaderActionsSlot();

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
    profitByTxId,
  } = useTransactionsViewModel({
    t: t as (key: string) => string,
    filterMode,
    setFilterMode,
    dateRange,
    setDateRange,
    transactions,
    clientTransactionsDzd,
    digitalServiceTransactions,
    clientsDzd,
    treasuryTransactions,
    getClientFullName,
    openForm,
    openAdjustmentModal,
    setTxToDelete,
    handleEditPortfolioTx,
    handleEditClientTx,
    handleEditTreasuryTx,
    handleEditDigitalServiceTx,
    handleDeleteDigitalServiceTx,
    handleDeleteClientTxClick,
    setTreasuryTxToDelete,
    providedProfitByTxId,
  });

  // Operations listed for the PDF title: the family and period picked (the list can hold thousands).
  const listedCount = useMemo(
    () => (Object.values(groupedTransactions) as DisplayTx[][]).reduce((count, txs) => count + txs.length, 0),
    [groupedTransactions]
  );

  const exportPdf = () => exportTransactionsPdf(groupedTransactions, getClientFullName, clientsDzd, `${listedCount} opérations`);

  return (
    <div className="anim-page-in flex flex-col gap-3">
      {/* Phones get (+) in the bottom bar and the PDF button in the header. */}
      <div className="hidden gap-2 sm:flex">
        <Button
          variant="primary"
          size="md"
          onClick={onOpenNewOperation}
          disabled={!onOpenNewOperation}
          className="font-bold"
        >
          <PlusIcon className="w-4 h-4" />
          {t('transactions.newTransaction')}
        </Button>
        <Button
          variant="outline"
          size="md"
          onClick={exportPdf}
          className="font-semibold"
          title={t('transactions.exportPdf') as string}
          aria-label={t('transactions.exportPdf') as string}
        >
          <DownloadCloudIcon className="w-4 h-4" />
          <span>{t('transactions.exportPdf')}</span>
        </Button>
      </div>
      {headerActionsSlot && createPortal(
        <button
          type="button"
          onClick={exportPdf}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-neutral-700 transition-colors hover:bg-neutral-100 active:scale-95"
          title={t('transactions.exportPdf') as string}
          aria-label={t('transactions.exportPdf') as string}
        >
          <DownloadCloudIcon className="h-[22px] w-[22px]" />
        </button>,
        headerActionsSlot,
      )}

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
        profitByTxId={profitByTxId}
        onOpenNewOperation={onOpenNewOperation}
      />
    </div>
  );
}
