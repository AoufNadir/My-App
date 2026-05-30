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

function csvCell(value: string | number | null | undefined): string {
    const s = String(value ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n'))
        return `"${s.replace(/"/g, '""')}"`;
    return s;
}

function exportTransactionsCsv(groupedTransactions: Record<string, DisplayTx[]>, getClientFullName: (c: ClientDzd) => string, clientsDzd: ClientDzd[]) {
    const clientById = new Map(clientsDzd.map((c) => [c.id, c]));
    const getClientName = (id: string | undefined) => {
        if (!id) return '';
        const c = clientById.get(id);
        return c ? getClientFullName(c) : id;
    };

    const headers = ['Date', 'Heure', 'Catégorie', 'Type', 'Devise', 'Quantité', 'Prix', 'Total DZD', 'Client', 'Source', 'Notes', 'Tags'];
    const rows: string[][] = [];

    const allTxs = Object.values(groupedTransactions).flat() as DisplayTx[];
    for (const dtx of allTxs) {
        const raw = dtx.rawTx;
        const tagsStr = Array.isArray((raw as any).tags) ? ((raw as any).tags as string[]).join(';') : '';
        if (dtx.category === 'crypto') {
            const tx = raw as Tx;
            const qty = tx.quantity ?? 0;
            const price = tx.price ?? tx.sell ?? 0;
            const total = tx.total ?? (qty * price);
            rows.push([dtx.date, dtx.time, 'Portefeuille', dtx.typeLabel, tx.currency, String(qty), String(price), String(Math.round(total)), getClientName(tx.linkedClientId), '', tx.notes ?? '', tagsStr]);
        } else if (dtx.category === 'client') {
            const tx = raw as ClientTransactionDzd;
            const amount = Number(tx.montant ?? 0);
            rows.push([dtx.date, dtx.time, 'Client', dtx.typeLabel, 'DZD', '', '', String(Math.round(Math.abs(amount))), getClientName(tx.clientId), tx.paymentMethod ?? '', tx.notes ?? '', tagsStr]);
        } else {
            const tx = raw as TreasuryTx;
            const amount = Number(tx.amount ?? 0);
            rows.push([dtx.date, dtx.time, 'Trésorerie', dtx.typeLabel, 'DZD', '', '', String(Math.round(amount)), '', tx.source ?? '', tx.notes ?? '', tagsStr]);
        }
    }

    const csv = [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `transactions_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
          onClick={() => exportTransactionsCsv(groupedTransactions, getClientFullName, clientsDzd)}
          className="shrink-0 font-semibold px-3"
          title="Exporter CSV"
          aria-label="Exporter CSV"
        >
          <DownloadCloudIcon className="w-4 h-4" />
          <span className="hidden sm:inline">CSV</span>
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
