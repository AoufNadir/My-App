import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { Dropdown, DropdownItem } from '../ui/Dropdown';
import { UnifiedTitle } from '../ui/UnifiedTitle';
import { FilterIcon } from '../icons/FilterIcon';
import { CalendarIcon } from '../icons/CalendarIcon';
import { SwipeableListItem } from '../ui/SwipeableListItem';
import { Tx } from '../../types';
import {
  DisplayTx,
  SavedTransactionFilter,
  TransactionFilterMode
} from './transactionsTypes';

type TransactionsHistoryCardProps = {
  cardBase: string;
  isDark: boolean;
  subtleText: string;
  t: (key: string) => string;
  openDateFilterModal: () => void;
  dateRange: { start: Date | null; end: Date | null };
  onSaveCurrentFilter: () => void;
  savedFilters: SavedTransactionFilter[];
  onApplySavedFilter: (savedFilter: SavedTransactionFilter) => void;
  onDeleteSavedFilter: (savedFilterId: string) => void;
  txFilterLabels: Record<TransactionFilterMode, string>;
  filterMode: TransactionFilterMode;
  setFilterMode: (mode: TransactionFilterMode) => void;
  groupedTransactions: Record<string, DisplayTx[]>;
  getRelativeDateLabel: (dateString: string) => string;
  onEditDisplayTx: (tx: DisplayTx) => void;
  onDeleteDisplayTx: (tx: DisplayTx) => void;
  formatDzdAmount: (value: number) => string;
};

export function TransactionsHistoryCard({
  cardBase,
  isDark,
  subtleText,
  t,
  openDateFilterModal,
  dateRange,
  onSaveCurrentFilter,
  savedFilters,
  onApplySavedFilter,
  onDeleteSavedFilter,
  txFilterLabels,
  filterMode,
  setFilterMode,
  groupedTransactions,
  getRelativeDateLabel,
  onEditDisplayTx,
  onDeleteDisplayTx,
  formatDzdAmount
}: TransactionsHistoryCardProps) {
  const INITIAL_VISIBLE_TRANSACTIONS = 120;
  const LOAD_MORE_TRANSACTIONS = 120;
  const [visibleTransactionCount, setVisibleTransactionCount] = useState(INITIAL_VISIBLE_TRANSACTIONS);

  useEffect(() => {
    setVisibleTransactionCount(INITIAL_VISIBLE_TRANSACTIONS);
  }, [groupedTransactions]);

  const dateGroups = useMemo(
    () => Object.entries(groupedTransactions),
    [groupedTransactions]
  );

  const {
    visibleDateGroups,
    hiddenTransactionCount,
    totalTransactionCount
  } = useMemo(() => {
    let remaining = visibleTransactionCount;
    let hidden = 0;
    let total = 0;
    const visibleGroups: Array<[string, DisplayTx[]]> = [];

    for (const [date, txs] of dateGroups) {
      total += txs.length;

      if (remaining <= 0) {
        hidden += txs.length;
        continue;
      }

      if (txs.length <= remaining) {
        visibleGroups.push([date, txs]);
        remaining -= txs.length;
        continue;
      }

      visibleGroups.push([date, txs.slice(0, remaining)]);
      hidden += txs.length - remaining;
      remaining = 0;
    }

    return {
      visibleDateGroups: visibleGroups,
      hiddenTransactionCount: hidden,
      totalTransactionCount: total
    };
  }, [dateGroups, visibleTransactionCount]);

  return (
    <Card className={cardBase}>
      <CardHeader className="flex flex-row items-center justify-between p-4">
        <UnifiedTitle
          as="h2"
          isDark={isDark}
          variant="section"
          icon={<CalendarIcon className="w-4 h-4" />}
        >
          {t('transactions.history')}
        </UnifiedTitle>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Button
            onClick={openDateFilterModal}
            className={`p-2 rounded-lg font-semibold transition-colors ${isDark ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-200 hover:bg-slate-300'} ${dateRange.start ? (isDark ? 'bg-sky-500/20 text-sky-300' : 'bg-sky-100 text-sky-600') : ''}`}
            aria-label="Filtrer par date"
          >
            <CalendarIcon className="w-5 h-5" />
          </Button>

          <Button
            onClick={onSaveCurrentFilter}
            className={`px-3 py-2 text-sm rounded-lg font-semibold transition-colors ${isDark ? 'bg-emerald-700 hover:bg-emerald-600 text-emerald-100' : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700'}`}
          >
            {t('transactions.saveCurrentFilter')}
          </Button>

          <Dropdown
            isDark={isDark}
            trigger={(
              <Button className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg font-semibold transition-colors ${isDark ? 'bg-indigo-700 hover:bg-indigo-600 text-indigo-100' : 'bg-indigo-100 hover:bg-indigo-200 text-indigo-700'}`}>
                <span>{t('transactions.savedFilters')}</span>
              </Button>
            )}
          >
            {savedFilters.length === 0 ? (
              <div className={`px-3 py-2 text-sm ${subtleText}`}>{t('transactions.noSavedFilters')}</div>
            ) : (
              savedFilters.map((savedFilter) => (
                <div key={savedFilter.id} className="flex items-center justify-between gap-2 px-2 py-1">
                  <button
                    onClick={() => onApplySavedFilter(savedFilter)}
                    className={`text-left text-sm flex-1 px-2 py-2 rounded-md ${isDark ? 'hover:bg-slate-700 text-slate-200' : 'hover:bg-slate-100 text-slate-700'}`}
                  >
                    {savedFilter.name}
                  </button>
                  <button
                    onClick={() => onDeleteSavedFilter(savedFilter.id)}
                    className={`px-2 py-1 rounded text-xs ${isDark ? 'bg-red-900/40 text-red-300 hover:bg-red-900/60' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
                  >
                    {t('common.delete')}
                  </button>
                </div>
              ))
            )}
          </Dropdown>

          <Dropdown
            isDark={isDark}
            trigger={(
              <Button className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg font-semibold transition-colors ${isDark ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-200 hover:bg-slate-300'}`}>
                <FilterIcon className="w-4 h-4" />
                <span>{txFilterLabels[filterMode]}</span>
              </Button>
            )}
          >
            <DropdownItem onClick={() => setFilterMode('all')} isActive={filterMode === 'all'}>{t('transactions.filterAll')}</DropdownItem>
            <DropdownItem onClick={() => setFilterMode('buy')} isActive={filterMode === 'buy'}>{t('transactions.filterBuy')}</DropdownItem>
            <DropdownItem onClick={() => setFilterMode('sell')} isActive={filterMode === 'sell'}>{t('transactions.filterSell')}</DropdownItem>
            <DropdownItem onClick={() => setFilterMode('adjustments')} isActive={filterMode === 'adjustments'}>{t('transactions.filterAdjustments')}</DropdownItem>
            <DropdownItem onClick={() => setFilterMode('clients')} isActive={filterMode === 'clients'}>{t('transactions.filterClients')}</DropdownItem>
            <DropdownItem onClick={() => setFilterMode('treasury')} isActive={filterMode === 'treasury'}>{t('transactions.filterTreasury')}</DropdownItem>
          </Dropdown>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="space-y-4 pb-4">
          {visibleDateGroups.length > 0 ? (
            visibleDateGroups.map(([date, txsOnDate]) => {
              return (
                <div key={date}>
                  <h3 className={`font-semibold text-sm mb-2 px-4 ${subtleText}`}>{getRelativeDateLabel(date)}</h3>
                  <div className="divide-y" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
                    {txsOnDate.map((tx) => {
                      const cryptoTx = tx.rawTx as Tx;
                      const unitPrice = Number(cryptoTx.price || cryptoTx.sell || 0);
                      return (
                        <SwipeableListItem
                          key={tx.id}
                          onEdit={() => onEditDisplayTx(tx)}
                          onDelete={() => onDeleteDisplayTx(tx)}
                          disableSwipe={false}
                        >
                          <div className={`flex items-center gap-3 py-3 px-4 ${isDark ? 'bg-[#111827]' : 'bg-white'}`}>
                            {tx.icon}

                            <div className="flex-grow min-w-0">
                              <p className="font-bold truncate">{tx.typeLabel}</p>
                              <p className={`text-sm ${subtleText} truncate`}>{tx.details}</p>
                              <p className={`text-xs ${subtleText}`}>{tx.time}</p>
                            </div>

                            <div className="text-right flex-shrink-0">
                              <p className={`font-bold ${tx.amountColor}`}>{tx.amountLabel}</p>
                              {tx.sourceType === 'usdt_tx' && unitPrice > 0 ? (
                                <p className={`text-xs ${subtleText}`}>@ {formatDzdAmount(unitPrice)}</p>
                              ) : null}
                            </div>
                          </div>
                        </SwipeableListItem>
                      );
                    })}
                  </div>
                </div>
              );
            })
          ) : (
            <p className={`text-center py-8 ${subtleText}`}>{t('transactions.noTransactions')}</p>
          )}
          {hiddenTransactionCount > 0 && (
            <div className="px-4 pt-2">
              <Button
                onClick={() => setVisibleTransactionCount((prev) => prev + LOAD_MORE_TRANSACTIONS)}
                className={`w-full rounded-xl px-4 py-3 font-semibold ${isDark ? 'bg-slate-700 text-slate-100 hover:bg-slate-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                Afficher plus ({Math.min(hiddenTransactionCount, LOAD_MORE_TRANSACTIONS)})
              </Button>
              <p className={`mt-2 text-center text-xs ${subtleText}`}>
                {totalTransactionCount - hiddenTransactionCount} / {totalTransactionCount}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
