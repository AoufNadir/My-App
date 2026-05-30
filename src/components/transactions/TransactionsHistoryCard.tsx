import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Dropdown } from '../ui/Dropdown';
import { SectionHeading } from '../ui/SectionHeading';
import { EmptyState } from '../ui/EmptyState';
import { CalendarIcon } from '../icons/CalendarIcon';
import { ArrowDownLeftIcon } from '../icons/ArrowDownLeftIcon';
import { ArrowRightLeftIcon } from '../icons/ArrowRightLeftIcon';
import { ArrowUpRightIcon } from '../icons/ArrowUpRightIcon';
import { BanknotesIcon } from '../icons/BanknotesIcon';
import { CreditCardIcon } from '../icons/CreditCardIcon';
import { FilterIcon } from '../icons/FilterIcon';
import { WalletIcon } from '../icons/WalletIcon';
import { UsersIcon } from '../icons/UsersIcon';
import { SwipeableListItem } from '../ui/SwipeableListItem';
import { Tx } from '../../types';
import { normalizeLedgerLabel } from '../../utils/financialUx';
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
};

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
}: TransactionsHistoryCardProps) {
  const INITIAL_VISIBLE = 120;
  const LOAD_MORE_COUNT = 120;
  const [visibleTransactionCount, setVisibleTransactionCount] = useState(INITIAL_VISIBLE);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const filterGroups: Array<{
    title: string;
    modes: Array<{ mode: TransactionFilterMode; icon: React.ReactNode; tone: string }>;
  }> = [
    {
      title: t('transactions.filterGroupGeneral'),
      modes: [
        { mode: 'all', icon: <CalendarIcon className="h-4 w-4" />, tone: 'text-primary bg-primary/10' },
      ],
    },
    {
      title: t('transactions.filterGroupBuy'),
      modes: [
        { mode: 'buy_usdt_dzd', icon: <ArrowDownLeftIcon className="h-4 w-4" />, tone: 'text-financial-profit bg-success-bg' },
        { mode: 'buy_usdt_eur', icon: <ArrowRightLeftIcon className="h-4 w-4" />, tone: 'text-primary bg-primary/10' },
        { mode: 'buy_eur_dzd',  icon: <ArrowDownLeftIcon className="h-4 w-4" />, tone: 'text-financial-profit bg-success-bg' },
      ],
    },
    {
      title: t('transactions.filterGroupSell'),
      modes: [
        { mode: 'sell_usdt_dzd', icon: <ArrowUpRightIcon className="h-4 w-4" />,   tone: 'text-financial-loss bg-danger-bg' },
        { mode: 'sell_usdt_eur', icon: <ArrowRightLeftIcon className="h-4 w-4" />, tone: 'text-financial-debt bg-warning-bg' },
        { mode: 'sell_eur_dzd',  icon: <ArrowUpRightIcon className="h-4 w-4" />,   tone: 'text-financial-loss bg-danger-bg' },
      ],
    },
    {
      title: t('transactions.filterGroupStock'),
      modes: [
        { mode: 'stock_in',  icon: <ArrowDownLeftIcon className="h-4 w-4" />, tone: 'text-financial-profit bg-success-bg' },
        { mode: 'stock_out', icon: <ArrowUpRightIcon className="h-4 w-4" />,  tone: 'text-financial-loss bg-danger-bg' },
      ],
    },
    {
      title: t('transactions.filterGroupClients'),
      modes: [
        { mode: 'client_receipts_cash',    icon: <BanknotesIcon className="h-4 w-4" />,     tone: 'text-financial-profit bg-success-bg' },
        { mode: 'client_receipts_baridi',  icon: <CreditCardIcon className="h-4 w-4" />,    tone: 'text-financial-profit bg-success-bg' },
        { mode: 'client_receipts_credit',  icon: <UsersIcon className="h-4 w-4" />,          tone: 'text-financial-debt bg-warning-bg' },
        { mode: 'client_payouts_cash',     icon: <BanknotesIcon className="h-4 w-4" />,     tone: 'text-financial-loss bg-danger-bg' },
        { mode: 'client_payouts_baridi',   icon: <CreditCardIcon className="h-4 w-4" />,    tone: 'text-financial-loss bg-danger-bg' },
        { mode: 'client_payouts_credit',   icon: <UsersIcon className="h-4 w-4" />,          tone: 'text-financial-debt bg-warning-bg' },
        { mode: 'client_adjustments',      icon: <WalletIcon className="h-4 w-4" />,         tone: 'text-neutral-500 bg-neutral-100' },
        { mode: 'client_transfers',        icon: <ArrowRightLeftIcon className="h-4 w-4" />, tone: 'text-primary bg-primary/10' },
      ],
    },
    {
      title: t('transactions.filterGroupTreasury'),
      modes: [
        { mode: 'treasury_in_cash',    icon: <BanknotesIcon className="h-4 w-4" />,     tone: 'text-financial-profit bg-success-bg' },
        { mode: 'treasury_in_baridi',  icon: <CreditCardIcon className="h-4 w-4" />,    tone: 'text-financial-profit bg-success-bg' },
        { mode: 'treasury_out_cash',   icon: <BanknotesIcon className="h-4 w-4" />,     tone: 'text-financial-loss bg-danger-bg' },
        { mode: 'treasury_out_baridi', icon: <CreditCardIcon className="h-4 w-4" />,    tone: 'text-financial-loss bg-danger-bg' },
        { mode: 'treasury_transfers',  icon: <ArrowRightLeftIcon className="h-4 w-4" />, tone: 'text-primary bg-primary/10' },
      ],
    },
  ];

  useEffect(() => {
    setVisibleTransactionCount(INITIAL_VISIBLE);
  }, [groupedTransactions, searchQuery, activeTag]);

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
    const q = searchQuery.trim().toLowerCase();
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
          tags.some((tag) => tag.toLowerCase().includes(q))
        );
        const matchesTag = !activeTag || tags.includes(activeTag);
        return matchesSearch && matchesTag;
      })] as [string, DisplayTx[]])
      .filter(([, txs]) => txs.length > 0);
  }, [dateGroups, searchQuery, activeTag]);

  // Compute total DZD for all filtered transactions when a filter/search is active
  const filteredSummary = useMemo(() => {
    const isFiltered = filterMode !== 'all' || searchQuery.trim().length > 0 || activeTag !== null;
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
      }
    }
    return { totalDzd, count };
  }, [filteredDateGroups, filterMode, searchQuery]);

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
  }, [dateGroups, visibleTransactionCount]);

  return (
    <Card>
      <CardHeader className="p-4 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SectionHeading icon={<CalendarIcon className="w-4 h-4" />}>
            {t('transactions.history')}
          </SectionHeading>

          <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2 sm:flex sm:items-center sm:justify-end">
            <Dropdown
              align="start"
              contentClassName="w-[calc(100vw-2rem)] max-w-2xl max-h-[72vh] overflow-y-auto p-2"
              trigger={(
                <Button variant="outline" className="min-h-touch w-full min-w-0 justify-start gap-2 rounded-lg px-3 text-xs font-bold bg-neutral-100 hover:bg-neutral-200 text-neutral-800 transition-colors">
                  <FilterIcon className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 truncate">{txFilterLabels[filterMode]}</span>
                  <span className="ms-auto shrink-0 rounded-full px-1.5 py-0.5 text-[10px] bg-surface text-neutral-600">
                    {txFilterCounts[filterMode] || 0}
                  </span>
                </Button>
              )}
            >
              <div className="space-y-3">
                {filterGroups.map((group) => (
                  <div key={group.title}>
                    <div className="mb-1 px-1 text-[10px] font-black uppercase text-neutral-400">
                      {group.title}
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {group.modes.map(({ mode, icon, tone }) => {
                        const isActive = filterMode === mode;
                        return (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setFilterMode(mode)}
                            className={[
                                'min-h-12 rounded-lg border p-2 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                              isActive
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-neutral-200 bg-neutral-50 text-neutral-700 hover:bg-neutral-100',
                            ].join(' ')}
                          >
                            <span className="flex items-center gap-2">
                              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone}`}>
                                {icon}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-[12px] font-bold leading-snug">
                                  {txFilterLabels[mode]}
                                </span>
                                <span className={[
                                  'mt-1 inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                                  isActive ? 'bg-surface/20' : 'bg-surface text-neutral-500',
                                ].join(' ')}>
                                  {txFilterCounts[mode] || 0}
                                </span>
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </Dropdown>

            <Button
              onClick={openDateFilterModal}
              className={[
                'min-h-touch px-3 rounded-lg text-xs font-bold transition-colors',
                dateRange.start
                  ? 'bg-primary/10 text-primary hover:bg-primary/20'
                  : 'bg-neutral-200 hover:bg-neutral-300 text-neutral-700',
              ].join(' ')}
              aria-label="Filtrer par date"
            >
              <CalendarIcon className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">Dates</span>
            </Button>

            <Dropdown
              trigger={(
                <Button className="min-h-touch px-3 text-xs rounded-lg font-bold transition-colors bg-primary/10 hover:bg-primary/20 text-primary">
                  <span>Vues</span>
                </Button>
              )}
            >
              <button
                onClick={onSaveCurrentFilter}
                className="mb-1 w-full min-h-touch text-start text-sm font-semibold px-3 py-2 rounded-md bg-primary hover:bg-primary-dark text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                + {t('transactions.saveCurrentFilter')}
              </button>
              {savedFilters.length === 0 ? (
                <div className="px-3 py-2 text-sm text-neutral-500">
                  {t('transactions.noSavedFilters')}
                </div>
              ) : (
                savedFilters.map((savedFilter) => (
                  <div key={savedFilter.id} className="flex items-center justify-between gap-2 px-2 py-1">
                    <button
                      onClick={() => onApplySavedFilter(savedFilter)}
                      className="min-h-touch text-start text-sm flex-1 px-2 py-2 rounded-md hover:bg-neutral-100 text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      {savedFilter.name}
                    </button>
                    <button
                      onClick={() => onDeleteSavedFilter(savedFilter.id)}
                      className="min-h-touch px-2 py-1 rounded text-xs font-semibold text-danger hover:bg-danger-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
                    >
                      {t('common.delete')}
                    </button>
                  </div>
                ))
              )}
            </Dropdown>
          </div>
        </div>

        {/* Inline text search */}
        <div className="relative">
          <Input
            type="search"
            placeholder="Rechercher : client, type, notes, tag, montant..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pe-8 text-sm"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute end-2 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-600"
              aria-label="Effacer la recherche"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          )}
        </div>

        {/* Tag filter chips */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {allTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setActiveTag((prev) => prev === tag ? null : tag)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  activeTag === tag
                    ? 'bg-primary text-white'
                    : 'bg-primary/10 text-primary hover:bg-primary/20'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </CardHeader>

      <CardContent className="p-0">
        <div className="pb-2">
          {visibleDateGroups.length > 0 ? (
            visibleDateGroups.map(([date, txsOnDate]: [string, DisplayTx[]]) => (
              <div key={date}>
                <div className="sticky top-0 z-10 px-4 py-2 text-xs font-semibold uppercase bg-surface/95 text-neutral-500 backdrop-blur-sm">
                  {getRelativeDateLabel(date)}
                </div>
                <div className="divide-y divide-neutral-100">
                  {txsOnDate.map((tx) => {
                    const cryptoTx = tx.rawTx as Tx;
                    const isUsdtSaleSettledInEur =
                      cryptoTx.type === 'sell'
                      && cryptoTx.currency === 'USDT'
                      && cryptoTx.settlementCurrency === 'EUR';
                    const unitPrice = Number(
                      isUsdtSaleSettledInEur
                        ? cryptoTx.sellPriceEur
                        : (cryptoTx.price || cryptoTx.sell || 0)
                    );
                    const unitPriceLabel = isUsdtSaleSettledInEur
                      ? `${unitPrice.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} EUR/USDT`
                      : formatDzdAmount(unitPrice);

                    return (
                      <SwipeableListItem
                        key={tx.id}
                        onEdit={() => onEditDisplayTx(tx)}
                        onDelete={() => onDeleteDisplayTx(tx)}
                        disableSwipe={false}
                      >
                        <div
                          className="flex items-center gap-3 py-3 px-4 bg-surface"
                          // Technical exception: content-visibility keeps long transaction lists responsive.
                          style={{ contentVisibility: 'auto', containIntrinsicSize: '76px' }}
                        >
                          {tx.icon}

                          <div className="flex-grow min-w-0">
                            <p className="text-base font-semibold truncate">
                              {normalizeLedgerLabel(tx.typeLabel)}
                            </p>
                            <p className="text-xs truncate text-neutral-500">
                              {normalizeLedgerLabel(tx.details)}
                            </p>
                            {(tx.rawTx as any).notes && (
                              <p className="text-xs truncate text-neutral-400 italic">
                                {(tx.rawTx as any).notes}
                              </p>
                            )}
                            {Array.isArray((tx.rawTx as any).tags) && (tx.rawTx as any).tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-0.5">
                                {((tx.rawTx as any).tags as string[]).map((tag: string) => (
                                  <span key={tag} className="inline-block rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary leading-none">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                            <p className="text-xs text-neutral-500">{tx.time}</p>
                          </div>

                          <div className="text-end shrink-0">
                            <p dir="ltr" className={`text-base font-semibold tabular-nums ${tx.amountColor}`}>
                              {tx.amountLabel}
                            </p>
                            {tx.sourceType === 'usdt_tx' && unitPrice > 0 && (
                              <p dir="ltr" className="text-xs text-neutral-500">@ {unitPriceLabel}</p>
                            )}
                            {tx.sourceType === 'usdt_tx' && cryptoTx.type === 'sell' && profitByTxId?.[cryptoTx.id] && (() => {
                              const profit = profitByTxId[cryptoTx.id].derivedProfit;
                              if (Math.abs(profit) < 0.5) return null;
                              return (
                                <p dir="ltr" className={`text-[10px] font-bold tabular-nums ${profit >= 0 ? 'text-financial-profit' : 'text-financial-loss'}`}>
                                  {profit >= 0 ? '+' : ''}{Math.round(profit).toLocaleString('fr-FR')} DZD
                                </p>
                              );
                            })()}
                          </div>
                        </div>
                      </SwipeableListItem>
                    );
                  })}
                </div>
              </div>
            ))
          ) : (
            <EmptyState
              title={searchQuery.trim() ? 'Aucun résultat' : t('transactions.noTransactions')}
              subtitle={searchQuery.trim() ? `Aucune opération ne correspond à "${searchQuery.trim()}"` : undefined}
            />
          )}

          {/* Filtered summary bar */}
          {filteredSummary && filteredSummary.count > 0 && (
            <div className="mx-4 mt-2 mb-1 flex items-center justify-between rounded-xl bg-surface-muted px-4 py-2.5 border border-border">
              <span className="text-xs font-semibold text-neutral-500">
                {filteredSummary.count} opération{filteredSummary.count > 1 ? 's' : ''}
              </span>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-neutral-400">Total ≈</span>
                <span dir="ltr" className="text-sm font-bold text-neutral-800 tabular-nums">
                  {filteredSummary.totalDzd.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}
                </span>
                <span className="text-[10px] text-neutral-400">DZD</span>
              </div>
            </div>
          )}

          {hiddenTransactionCount > 0 && (
            <div className="px-4 pt-2">
              <Button
                onClick={() => setVisibleTransactionCount((prev) => prev + LOAD_MORE_COUNT)}
                variant="outline"
                className="w-full rounded-xl px-4 py-3 font-semibold bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
              >
                Afficher plus ({Math.min(hiddenTransactionCount, LOAD_MORE_COUNT)})
              </Button>
              <p className="mt-2 text-center text-xs text-neutral-500">
                {totalTransactionCount - hiddenTransactionCount} / {totalTransactionCount}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
