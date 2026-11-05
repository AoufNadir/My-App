import { lazy, Suspense, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../components/ui/Button';
import { Tx, ClientDzd, ClientTransactionDzd, TreasuryTx, DigitalServiceTransaction } from '../types';
import { ReportButton } from '../components/reports/ReportButton';
import { PlusIcon } from '../components/icons/PlusIcon';
import { useLanguage } from '../contexts/LanguageContext';
import { TransactionsHistoryCard } from '../components/transactions/TransactionsHistoryCard';
import { useHeaderActionsSlot } from '../components/main/headerActionsSlot';
import { TransactionFilterMode, DisplayTx } from '../components/transactions/transactionsTypes';
import { useTransactionsViewModel } from '../components/transactions/useTransactionsViewModel';
import type { PamLedgerResult } from '../utils/pamLedger';
import type { TransactionListInput } from '../utils/listReports';
const TransactionListDialog = lazy(() => import('../components/reports/documents/DocumentReportDialogs').then((module) => ({ default: module.TransactionListDialog })));

/**
 * The operations log's rows, one per listed operation (what the page lists, with the same names as the
 * list shows). The old print page wrote the quantity, the price and the total as plain text; the sheet
 * writes the same numbers with their separators.
 */
function transactionListRows(groupedTransactions: Record<string, DisplayTx[]>, getClientFullName: (c: ClientDzd) => string, clientsDzd: ClientDzd[]): TransactionListInput[] {
    const clientById = new Map(clientsDzd.map((c) => [c.id, c]));
    const getClientName = (id: string | undefined) => {
        if (!id) return '';
        const c = clientById.get(id);
        return c ? getClientFullName(c) : id;
    };
    const allTxs = Object.values(groupedTransactions).flat() as DisplayTx[];
    return allTxs.map((dtx): TransactionListInput => {
        const raw = dtx.rawTx;
        const tags = Array.isArray((raw as any).tags) ? ((raw as any).tags as string[]) : [];
        if (dtx.category === 'crypto') {
            const tx = raw as Tx;
            const qty = tx.quantity ?? 0;
            const price = tx.price ?? tx.sell ?? 0;
            const total = tx.total ?? (qty * price);
            return { category: 'portfolio', date: dtx.date, time: dtx.time, type: dtx.typeLabel, currency: tx.currency, quantity: qty, price, totalDzd: Math.round(total), client: getClientName(tx.linkedClientId), notes: tx.notes ?? '', tags, side: tx.type === 'buy' ? 'buy' : tx.type === 'sell' ? 'sell' : undefined, timestamp: tx.timestamp };
        } else if (dtx.category === 'client') {
            const tx = raw as ClientTransactionDzd;
            return { category: 'client', date: dtx.date, time: dtx.time, type: dtx.typeLabel, currency: 'DZD', quantity: null, price: null, totalDzd: Math.round(Math.abs(Number(tx.montant ?? 0))), client: getClientName(tx.clientId), notes: tx.notes ?? '', tags, timestamp: tx.timestamp };
        } else if (dtx.category === 'digital_service') {
            const tx = raw as DigitalServiceTransaction;
            return { category: 'digital_service', date: dtx.date, time: dtx.time, type: dtx.typeLabel, currency: tx.saleCurrency, quantity: tx.saleAmount, price: null, totalDzd: Math.round(tx.saleAmountDzd), client: getClientName(tx.clientId), notes: tx.notes ?? '', tags, timestamp: tx.timestamp };
        } else {
            const tx = raw as TreasuryTx;
            return { category: 'treasury', date: dtx.date, time: dtx.time, type: dtx.typeLabel, currency: 'DZD', quantity: null, price: null, totalDzd: Math.round(Number(tx.amountDzd ?? tx.amount ?? 0)), client: '', notes: tx.notes ?? '', tags, timestamp: tx.timestamp };
        }
    });
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

  // The operations log: its rows are fixed when the window opens.
  const [listReport, setListReport] = useState<TransactionListInput[] | null>(null);
  const exportPdf = () => setListReport(transactionListRows(groupedTransactions, getClientFullName, clientsDzd));

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
        <ReportButton onClick={exportPdf}/>
      </div>
      {headerActionsSlot && createPortal(<ReportButton variant="header" onClick={exportPdf}/>, headerActionsSlot)}

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
        onClearFilters={() => { setFilterMode('all'); setDateRange({ start: null, end: null }); }}
      />

      {listReport && (<Suspense fallback={null}>
          <TransactionListDialog onClose={() => setListReport(null)} rows={listReport}/>
        </Suspense>)}
    </div>
  );
}
