import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Button } from '../ui/Button';
import { Dropdown } from '../ui/Dropdown';
import { EmptyState } from '../ui/EmptyState';
import { FilterChips, type FilterChip } from '../ui/FilterChips';
import { SearchField } from '../ui/SearchField';
import { SectionCard } from '../cards';
import { CalendarIcon } from '../icons/CalendarIcon';
import { ArrowDownLeftIcon } from '../icons/ArrowDownLeftIcon';
import { ArrowRightLeftIcon } from '../icons/ArrowRightLeftIcon';
import { ArrowUpRightIcon } from '../icons/ArrowUpRightIcon';
import { BanknotesIcon } from '../icons/BanknotesIcon';
import { ChevronRightIcon } from '../icons/ChevronRightIcon';
import { CreditCardIcon } from '../icons/CreditCardIcon';
import { FilterIcon } from '../icons/FilterIcon';
import { MoreHorizontalIcon } from '../icons/MoreHorizontalIcon';
import { PlusIcon } from '../icons/PlusIcon';
import { WalletIcon } from '../icons/WalletIcon';
import { UsersIcon } from '../icons/UsersIcon';
import { TransactionDisplayList } from './TransactionDisplayList';
import { getTransactionTagLabel } from '../../utils/transactionTerminology';
import { formatDayLabel } from '../../utils/dateInput';
import { formatNumber } from '../../pages/shared/pageFormat';
import {
  DisplayTx,
  SavedTransactionFilter,
  TransactionFilterMode,
} from './transactionsTypes';

type TransactionsHistoryCardProps = {
  t: (key: string) => string;
  openDateFilterModal: () => void;
  dateRange: { start: Date | null; end: Date | null };
  onSaveCurrentFilter: () => void;
  savedFilters: SavedTransactionFilter[];
  onApplySavedFilter: (savedFilter: SavedTransactionFilter) => void;
  onDeleteSavedFilter: (savedFilterId: string) => void;
  txFilterLabels: Record<TransactionFilterMode, string>;
  txFilterCounts: Record<TransactionFilterMode, number>;
  filterMode: TransactionFilterMode;
  setFilterMode: (mode: TransactionFilterMode) => void;
  groupedTransactions: Record<string, DisplayTx[]>;
  getRelativeDateLabel: (dateString: string) => string;
  onEditDisplayTx: (tx: DisplayTx) => void;
  onDeleteDisplayTx: (tx: DisplayTx) => void;
  formatDzdAmount: (value: number) => string;
  profitByTxId?: Record<string, { derivedProfit: number }>;
  /** Opens the new-operation menu from an empty list; left out while the data loads. */
  onOpenNewOperation?: () => void;
};

const formatCount = (value: number) => formatNumber(value, { min: 0, max: 0 });
// Older saved filters that belong to no chip: they light up their family.
const LEGACY_FILTER_GROUP: Partial<Record<TransactionFilterMode, TransactionFilterMode>> = {
  adjustments: 'stock',
  client_payments: 'clients',
};
const refineChipClass = (active: boolean) => [
  'inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold transition-colors',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
  active ? 'border-primary bg-primary/10 text-neutral-900' : 'border-border bg-surface text-neutral-700 hover:border-border-strong',
].join(' ');

export function TransactionsHistoryCard({
  t,
  openDateFilterModal,
  dateRange,
  onSaveCurrentFilter,
  savedFilters,
  onApplySavedFilter,
  onDeleteSavedFilter,
  txFilterLabels,
  txFilterCounts,
  filterMode,
  setFilterMode,
  groupedTransactions,
  getRelativeDateLabel,
  onEditDisplayTx,
  onDeleteDisplayTx,
  formatDzdAmount,
  profitByTxId,
  onOpenNewOperation,
}: TransactionsHistoryCardProps) {
  const INITIAL_VISIBLE = 60;
  const LOAD_MORE_COUNT = 60;
  const [visibleTransactionCount, setVisibleTransactionCount] = useState(INITIAL_VISIBLE);
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [activeTag, setActiveTag] = useState<string | null>(null);

  type FilterItem = { mode: TransactionFilterMode; label?: string; icon: React.ReactNode; tone: string };
  type FilterSection = { title?: string; modes: FilterItem[] };
  type FilterGroup = { mode: TransactionFilterMode; label: string; sections: FilterSection[] };
  const allLabel = t('transactions.filterDetailAll');
  const cashLabel = t('transactions.filterDetailCash');
  const baridiLabel = t('transactions.filterDetailBaridi');
  const creditLabel = t('transactions.filterDetailCredit');
  const filterGroups: FilterGroup[] = [
    {
      mode: 'all',
      label: txFilterLabels.all,
      sections: [],
    },
    {
      mode: 'buy',
      label: txFilterLabels.buy,
      sections: [{
        modes: [
          { mode: 'buy', label: allLabel, icon: <ArrowDownLeftIcon className="h-4 w-4" />, tone: 'text-financial-profit bg-success-bg' },
          { mode: 'buy_usdt_dzd', icon: <ArrowDownLeftIcon className="h-4 w-4" />, tone: 'text-financial-profit bg-success-bg' },
          { mode: 'buy_usdt_eur', icon: <ArrowRightLeftIcon className="h-4 w-4" />, tone: 'text-primary bg-primary/10' },
          { mode: 'buy_eur_dzd', icon: <ArrowDownLeftIcon className="h-4 w-4" />, tone: 'text-financial-profit bg-success-bg' },
        ],
      }],
    },
    {
      mode: 'sell',
      label: txFilterLabels.sell,
      sections: [{
        modes: [
          { mode: 'sell', label: allLabel, icon: <ArrowUpRightIcon className="h-4 w-4" />, tone: 'text-financial-loss bg-danger-bg' },
          { mode: 'sell_usdt_dzd', icon: <ArrowUpRightIcon className="h-4 w-4" />, tone: 'text-financial-loss bg-danger-bg' },
          { mode: 'sell_usdt_eur', icon: <ArrowRightLeftIcon className="h-4 w-4" />, tone: 'text-financial-debt bg-warning-bg' },
          { mode: 'sell_eur_dzd', icon: <ArrowUpRightIcon className="h-4 w-4" />, tone: 'text-financial-loss bg-danger-bg' },
        ],
      }],
    },
    {
      mode: 'stock',
      label: txFilterLabels.stock,
      sections: [{
        modes: [
          { mode: 'stock', label: allLabel, icon: <WalletIcon className="h-4 w-4" />, tone: 'text-neutral-600 bg-neutral-100' },
          { mode: 'stock_in', icon: <ArrowDownLeftIcon className="h-4 w-4" />, tone: 'text-financial-profit bg-success-bg' },
          { mode: 'stock_out', icon: <ArrowUpRightIcon className="h-4 w-4" />, tone: 'text-financial-loss bg-danger-bg' },
        ],
      }],
    },
    {
      mode: 'clients',
      label: txFilterLabels.clients,
      sections: [
        {
          modes: [
            { mode: 'clients', label: allLabel, icon: <UsersIcon className="h-4 w-4" />, tone: 'text-primary bg-primary/10' },
          ],
        },
        {
          title: txFilterLabels.client_receipts,
          modes: [
            { mode: 'client_receipts', label: allLabel, icon: <ArrowDownLeftIcon className="h-4 w-4" />, tone: 'text-financial-profit bg-success-bg' },
            { mode: 'client_receipts_cash', label: cashLabel, icon: <BanknotesIcon className="h-4 w-4" />, tone: 'text-financial-profit bg-success-bg' },
            { mode: 'client_receipts_baridi', label: baridiLabel, icon: <CreditCardIcon className="h-4 w-4" />, tone: 'text-financial-profit bg-success-bg' },
            { mode: 'client_receipts_credit', label: creditLabel, icon: <UsersIcon className="h-4 w-4" />, tone: 'text-financial-debt bg-warning-bg' },
          ],
        },
        {
          title: txFilterLabels.client_payouts,
          modes: [
            { mode: 'client_payouts', label: allLabel, icon: <ArrowUpRightIcon className="h-4 w-4" />, tone: 'text-financial-loss bg-danger-bg' },
            { mode: 'client_payouts_cash', label: cashLabel, icon: <BanknotesIcon className="h-4 w-4" />, tone: 'text-financial-loss bg-danger-bg' },
            { mode: 'client_payouts_baridi', label: baridiLabel, icon: <CreditCardIcon className="h-4 w-4" />, tone: 'text-financial-loss bg-danger-bg' },
            { mode: 'client_payouts_credit', label: creditLabel, icon: <UsersIcon className="h-4 w-4" />, tone: 'text-financial-debt bg-warning-bg' },
          ],
        },
        {
          modes: [
            { mode: 'client_transfers', icon: <ArrowRightLeftIcon className="h-4 w-4" />, tone: 'text-primary bg-primary/10' },
            { mode: 'client_adjustments', icon: <WalletIcon className="h-4 w-4" />, tone: 'text-neutral-500 bg-neutral-100' },
          ],
        },
      ],
    },
    {
      mode: 'treasury',
      label: txFilterLabels.treasury,
      sections: [
        {
          modes: [
            { mode: 'treasury', label: allLabel, icon: <WalletIcon className="h-4 w-4" />, tone: 'text-primary bg-primary/10' },
          ],
        },
        {
          title: txFilterLabels.treasury_in,
          modes: [
            { mode: 'treasury_in', label: allLabel, icon: <ArrowDownLeftIcon className="h-4 w-4" />, tone: 'text-financial-profit bg-success-bg' },
            { mode: 'treasury_in_cash', label: cashLabel, icon: <BanknotesIcon className="h-4 w-4" />, tone: 'text-financial-profit bg-success-bg' },
            { mode: 'treasury_in_baridi', label: baridiLabel, icon: <CreditCardIcon className="h-4 w-4" />, tone: 'text-financial-profit bg-success-bg' },
          ],
        },
        {
          title: txFilterLabels.treasury_out,
          modes: [
            { mode: 'treasury_out', label: allLabel, icon: <ArrowUpRightIcon className="h-4 w-4" />, tone: 'text-financial-loss bg-danger-bg' },
            { mode: 'treasury_out_cash', label: cashLabel, icon: <BanknotesIcon className="h-4 w-4" />, tone: 'text-financial-loss bg-danger-bg' },
            { mode: 'treasury_out_baridi', label: baridiLabel, icon: <CreditCardIcon className="h-4 w-4" />, tone: 'text-financial-loss bg-danger-bg' },
          ],
        },
        {
          modes: [
            { mode: 'treasury_transfers', icon: <ArrowRightLeftIcon className="h-4 w-4" />, tone: 'text-primary bg-primary/10' },
          ],
        },
      ],
    },
    {
      mode: 'digital_services',
      label: txFilterLabels.digital_services,
      sections: [],
    },
  ];
  const getGroupModes = (group: FilterGroup) => [group.mode, ...group.sections.flatMap((section) => section.modes.map((item) => item.mode))];
  const activeFilterGroup = filterGroups.find((group) => getGroupModes(group).includes(filterMode))
    || filterGroups.find((group) => group.mode === LEGACY_FILTER_GROUP[filterMode])
    || filterGroups[0];
  // The chip of a family shows that family; tapped again, it goes back to its whole family, then to everything.
  const selectFilterGroup = (id: string) => {
    const mode = id as TransactionFilterMode;
    if (mode !== activeFilterGroup.mode) setFilterMode(mode);
    else setFilterMode(filterMode !== mode ? mode : 'all');
  };
  const groupChips: FilterChip[] = filterGroups.map((group) => ({
    id: group.mode,
    label: group.label,
    count: formatCount(txFilterCounts[group.mode] || 0),
  }));
  const hasDateRange = Boolean(dateRange.start && dateRange.end);
  const dateLabel = hasDateRange
    ? [formatDayLabel(dateRange.start!), formatDayLabel(dateRange.end!)]
      .filter((day, index, days) => days.indexOf(day) === index)
      .join(' – ')
    : t('transactions.allDates');
  const isDetailActive = filterMode !== activeFilterGroup.mode;

  useEffect(() => {
    setVisibleTransactionCount(INITIAL_VISIBLE);
  }, [groupedTransactions, deferredSearchQuery, activeTag]);

  const dateGroups = useMemo(
    () => Object.entries(groupedTransactions),
    [groupedTransactions]
  );

  // All unique tags across all transactions (for the tag picker)
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const [, txs] of dateGroups) {
      for (const tx of txs) {
        const tags = (tx.rawTx as any).tags;
        if (Array.isArray(tags)) tags.forEach((t: string) => tagSet.add(t));
      }
    }
    return Array.from(tagSet).sort();
  }, [dateGroups]);

  const filteredDateGroups = useMemo(() => {
    const q = deferredSearchQuery.trim().toLowerCase();
    const hasFilter = q || activeTag;
    if (!hasFilter) return dateGroups;
    return dateGroups
      .map(([date, txs]) => [date, txs.filter((tx) => {
        const notes = ((tx.rawTx as any).notes || '') as string;
        const tags = (Array.isArray((tx.rawTx as any).tags) ? (tx.rawTx as any).tags : []) as string[];
        const matchesSearch = !q || (
          tx.typeLabel.toLowerCase().includes(q) ||
          tx.details.toLowerCase().includes(q) ||
          tx.amountLabel.toLowerCase().includes(q) ||
          notes.toLowerCase().includes(q) ||
          tags.some((tag) => tag.toLowerCase().includes(q)
            || getTransactionTagLabel(tag, t).toLowerCase().includes(q))
        );
        const matchesTag = !activeTag || tags.includes(activeTag);
        return matchesSearch && matchesTag;
      })] as [string, DisplayTx[]])
      .filter(([, txs]) => txs.length > 0);
  }, [dateGroups, deferredSearchQuery, activeTag, t]);

  // Compute total DZD for all filtered transactions when a filter/search is active
  const filteredSummary = useMemo(() => {
    const isFiltered = filterMode !== 'all' || deferredSearchQuery.trim().length > 0 || activeTag !== null;
    if (!isFiltered) return null;
    let totalDzd = 0;
    let count = 0;
    for (const [, txs] of filteredDateGroups) {
      for (const tx of txs) {
        count++;
        const raw = tx.rawTx as any;
        if (tx.sourceType === 'usdt_tx') totalDzd += Math.abs(Number(raw.total ?? (raw.quantity ?? 0) * (raw.price ?? raw.sell ?? 0)));
        else if (tx.sourceType === 'client_tx') totalDzd += Math.abs(Number(raw.montant ?? 0));
        else if (tx.sourceType === 'treasury_tx') totalDzd += Math.abs(Number(raw.amount ?? 0));
        else if (tx.sourceType === 'digital_service_tx') totalDzd += Math.abs(Number(raw.saleAmountDzd ?? raw.profitDzd ?? 0));
      }
    }
    return { totalDzd, count };
  }, [filteredDateGroups, filterMode, deferredSearchQuery, activeTag]);

  const { visibleDateGroups, hiddenTransactionCount, totalTransactionCount } = useMemo(() => {
    let remaining = visibleTransactionCount;
    let hidden = 0;
    let total = 0;
    const visibleGroups: Array<[string, DisplayTx[]]> = [];

    for (const [date, txs] of filteredDateGroups) {
      total += txs.length;
      if (remaining <= 0) { hidden += txs.length; continue; }
      if (txs.length <= remaining) {
        visibleGroups.push([date, txs]);
        remaining -= txs.length;
      } else {
        visibleGroups.push([date, txs.slice(0, remaining)]);
        hidden += txs.length - remaining;
        remaining = 0;
      }
    }

    return {
      visibleDateGroups: visibleGroups,
      hiddenTransactionCount: hidden,
      totalTransactionCount: total,
    };
  }, [filteredDateGroups, visibleTransactionCount]);

  const tagChips: FilterChip[] = allTags.map((tag) => ({ id: tag, label: getTransactionTagLabel(tag, t) }));
  const hasSearch = searchQuery.trim().length > 0;

  return (
    <>
      <div className="flex items-center gap-2">
        <SearchField
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={t('transactions.searchLedgerPlaceholder')}
          clearLabel={t('transactions.clearSearch')}
        />
        <Dropdown
          contentClassName="w-64"
          trigger={(
            <button
              type="button"
              aria-haspopup="menu"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-button border border-border bg-surface text-neutral-700 transition-colors hover:border-border-strong hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              title={t('transactions.savedFilters')}
              aria-label={t('transactions.savedFilters')}
            >
              <MoreHorizontalIcon aria-hidden="true" className="h-5 w-5" />
            </button>
          )}
        >
          <button
            type="button"
            onClick={onSaveCurrentFilter}
            className="mb-1 w-full min-h-touch rounded-button bg-primary px-3 py-2 text-start text-sm font-semibold text-white hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            + {t('transactions.saveCurrentFilter')}
          </button>
          {savedFilters.length === 0 ? (
            <div className="px-3 py-2 text-sm text-neutral-500">
              {t('transactions.noSavedFilters')}
            </div>
          ) : (
            savedFilters.map((savedFilter) => (
              <div key={savedFilter.id} className="flex items-center justify-between gap-1">
                <button
                  type="button"
                  onClick={() => onApplySavedFilter(savedFilter)}
                  className="min-h-touch min-w-0 flex-1 truncate rounded-button px-3 py-2 text-start text-sm text-neutral-700 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {savedFilter.name}
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteSavedFilter(savedFilter.id)}
                  className="min-h-touch shrink-0 rounded-button px-2 py-1 text-xs font-semibold text-danger hover:bg-danger-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
                >
                  {t('common.delete')}
                </button>
              </div>
            ))
          )}
        </Dropdown>
      </div>

      <FilterChips chips={groupChips} activeIds={[activeFilterGroup.mode]} onToggle={selectFilterGroup} label={t('transactions.filterAction')} />

      {/* Period, and the detail of the family picked above */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={openDateFilterModal}
          aria-haspopup="dialog"
          title={t('transactions.filterByDate')}
          className={refineChipClass(hasDateRange)}
        >
          <CalendarIcon aria-hidden="true" className="h-4 w-4 shrink-0 text-neutral-500" />
          <span dir={hasDateRange ? 'ltr' : undefined} className="min-w-0 truncate tabular-nums">{dateLabel}</span>
          <ChevronRightIcon aria-hidden="true" className="h-3.5 w-3.5 shrink-0 rotate-90 text-neutral-400" />
        </button>

        {activeFilterGroup.sections.length > 0 && (
          <Dropdown
            align="start"
            contentClassName="w-72 max-h-[60vh] overflow-y-auto"
            trigger={(
              <button
                type="button"
                aria-haspopup="menu"
                aria-label={`${t('transactions.filterDetailLabel')} : ${isDetailActive ? txFilterLabels[filterMode] : allLabel}`}
                className={refineChipClass(isDetailActive)}
              >
                <FilterIcon aria-hidden="true" className="h-4 w-4 shrink-0 text-neutral-500" />
                <span className="min-w-0 max-w-[13rem] truncate">{isDetailActive ? txFilterLabels[filterMode] : allLabel}</span>
                <span dir="ltr" className="shrink-0 text-xs font-bold tabular-nums text-neutral-500">{formatCount(txFilterCounts[filterMode] || 0)}</span>
                <ChevronRightIcon aria-hidden="true" className="h-3.5 w-3.5 shrink-0 rotate-90 text-neutral-400" />
              </button>
            )}
          >
            {activeFilterGroup.sections.map((section, sectionIndex) => (
              <div key={`${activeFilterGroup.mode}_${section.title || sectionIndex}`} className={sectionIndex > 0 ? 'mt-1 border-t border-border pt-1' : ''}>
                {section.title && (
                  <div className="px-2.5 pb-1 pt-1.5 text-xs font-bold text-neutral-500">
                    {section.title}
                  </div>
                )}
                {section.modes.map(({ mode, label, icon, tone }) => {
                  const isActive = filterMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => setFilterMode(mode)}
                      className={[
                        'flex min-h-11 w-full items-center gap-2.5 rounded-button px-2.5 text-start text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                        isActive ? 'bg-primary/10 font-semibold text-neutral-900' : 'text-neutral-700 hover:bg-neutral-100',
                      ].join(' ')}
                    >
                      <span aria-hidden="true" className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${tone}`}>
                        {icon}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{label || txFilterLabels[mode]}</span>
                      <span dir="ltr" className="shrink-0 text-xs font-bold tabular-nums text-neutral-500">
                        {formatCount(txFilterCounts[mode] || 0)}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </Dropdown>
        )}
      </div>

      {tagChips.length > 0 && (
        <FilterChips chips={tagChips} activeIds={activeTag ? [activeTag] : []} onToggle={(tag) => setActiveTag((prev) => prev === tag ? null : tag)} label={t('transactions.tags')} />
      )}

      <SectionCard
        flush
        title={<>{t('transactions.history')} <span className="font-semibold text-neutral-500">· <bdi>{formatCount(totalTransactionCount)}</bdi></span></>}
      >
        {/* Sum of what is listed, once a filter, a search or a tag narrows the list */}
        {filteredSummary && filteredSummary.count > 0 && (
          <div className="mx-4 mb-2 flex items-center justify-between gap-3 rounded-button bg-surface-muted px-3 py-2">
            <span className="text-xs font-semibold text-neutral-500">{t('transactions.totalApprox')}</span>
            <span dir="ltr" className="text-sm font-bold tabular-nums text-neutral-900">
              {filteredSummary.totalDzd.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} <span className="text-xs font-semibold text-neutral-500">DZD</span>
            </span>
          </div>
        )}

        {visibleDateGroups.length > 0 ? (
          <TransactionDisplayList
            dateGroups={visibleDateGroups}
            t={t}
            getRelativeDateLabel={getRelativeDateLabel}
            onEditDisplayTx={onEditDisplayTx}
            onDeleteDisplayTx={onDeleteDisplayTx}
            onOpenDisplayTx={onEditDisplayTx}
            formatDzdAmount={formatDzdAmount}
            profitByTxId={profitByTxId}
          />
        ) : (
          <EmptyState
            icon={<CalendarIcon className="h-5 w-5" />}
            title={hasSearch ? t('emptyStates.results.title') : t('transactions.noTransactions')}
            subtitle={hasSearch ? `${t('transactions.noSearchMatch')} "${searchQuery.trim()}"` : undefined}
            action={!hasSearch && onOpenNewOperation ? (
              <Button onClick={onOpenNewOperation} variant="primary" size="md" className="font-bold">
                <PlusIcon className="h-4 w-4" />
                <span>{t('transactions.newTransaction')}</span>
              </Button>
            ) : undefined}
          />
        )}

        {hiddenTransactionCount > 0 && (
          <div className="border-t border-border px-4 pb-4 pt-3">
            <Button
              onClick={() => setVisibleTransactionCount((prev) => prev + LOAD_MORE_COUNT)}
              variant="outline"
              className="w-full font-semibold"
            >
              {t('transactions.showMore')} ({Math.min(hiddenTransactionCount, LOAD_MORE_COUNT)})
            </Button>
            <p dir="ltr" className="mt-2 text-center text-xs text-neutral-500">
              {totalTransactionCount - hiddenTransactionCount} / {totalTransactionCount}
            </p>
          </div>
        )}
        {hiddenTransactionCount === 0 && visibleDateGroups.length > 0 && <div className="h-2" aria-hidden="true" />}
      </SectionCard>
    </>
  );
}
