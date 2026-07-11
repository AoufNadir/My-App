import type { Tx } from '../../types';
import { normalizeLedgerLabel } from '../../utils/financialUx';
import { SwipeableListItem } from '../ui/SwipeableListItem';
import type { DisplayTx } from './transactionsTypes';

type TransactionDisplayListProps = {
  dateGroups: Array<[string, DisplayTx[]]>;
  getRelativeDateLabel: (dateString: string) => string;
  onEditDisplayTx?: (tx: DisplayTx) => void;
  onDeleteDisplayTx?: (tx: DisplayTx) => void;
  onOpenDisplayTx?: (tx: DisplayTx) => void;
  formatDzdAmount: (value: number) => string;
  profitByTxId?: Record<string, { derivedProfit: number }>;
  disableSwipe?: boolean;
  showDateHeaders?: boolean;
};

export function TransactionDisplayList({
  dateGroups,
  getRelativeDateLabel,
  onEditDisplayTx,
  onDeleteDisplayTx,
  onOpenDisplayTx,
  formatDzdAmount,
  profitByTxId,
  disableSwipe = false,
  showDateHeaders = true,
}: TransactionDisplayListProps) {
  return (
    <>
      {dateGroups.map(([date, txsOnDate]) => (
        <div key={date}>
          {showDateHeaders && (
            <div className="sticky top-0 z-10 bg-surface/95 px-4 py-2 text-xs font-semibold uppercase text-neutral-500 backdrop-blur-sm">
              {getRelativeDateLabel(date)}
            </div>
          )}
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
              const notes = (tx.rawTx as any).notes as string | undefined;
              const tags = Array.isArray((tx.rawTx as any).tags) ? ((tx.rawTx as any).tags as string[]) : [];
              const derivedProfit = tx.sourceType === 'usdt_tx' && cryptoTx.type === 'sell'
                ? profitByTxId?.[cryptoTx.id]?.derivedProfit
                : undefined;
              const showProfit = typeof derivedProfit === 'number' && Math.abs(derivedProfit) >= 0.5;
              const profitLabel = showProfit
                ? `${derivedProfit! >= 0 ? '+' : ''}${Math.round(derivedProfit!).toLocaleString('fr-FR')} DZD`
                : '';
              const detailText = normalizeLedgerLabel(tx.details || notes || '');
              const rightMiddleLabel = tx.rightMiddleLabel
                ?? (tx.sourceType === 'usdt_tx' && unitPrice > 0 ? `@ ${unitPriceLabel}` : '');
              const canOpen = Boolean(onOpenDisplayTx);

              return (
                <SwipeableListItem
                  key={tx.id}
                  onEdit={onEditDisplayTx ? () => onEditDisplayTx(tx) : undefined}
                  onDelete={onDeleteDisplayTx ? () => onDeleteDisplayTx(tx) : undefined}
                  disableSwipe={disableSwipe || (!onEditDisplayTx && !onDeleteDisplayTx)}
                >
                  <div
                    role={canOpen ? 'button' : undefined}
                    tabIndex={canOpen ? 0 : undefined}
                    onClick={canOpen ? () => onOpenDisplayTx?.(tx) : undefined}
                    onKeyDown={canOpen ? (event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onOpenDisplayTx?.(tx);
                      }
                    } : undefined}
                    className={[
                      'bg-surface px-4 py-3 transition-colors hover:bg-neutral-50',
                      canOpen ? 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary' : '',
                    ].join(' ')}
                    // Technical exception: content-visibility keeps long transaction lists responsive.
                    style={{ contentVisibility: 'auto', containIntrinsicSize: '76px' }}
                  >
                    <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-start gap-x-2 gap-y-0.5">
                      <div className="row-span-3 flex h-10 w-10 items-center justify-center overflow-hidden text-neutral-600">
                        {tx.icon}
                      </div>

                      <p className="min-w-0 truncate text-[15px] font-semibold leading-snug text-neutral-900">
                        {normalizeLedgerLabel(tx.typeLabel)}
                      </p>
                      <p dir="ltr" className={`min-w-0 max-w-[8.75rem] justify-self-end truncate text-end text-[15px] font-semibold leading-snug tabular-nums ${tx.amountColor}`}>
                        {tx.amountLabel}
                      </p>

                      <p className="min-w-0 truncate text-[13px] leading-snug text-neutral-500">
                        {detailText}
                      </p>
                      <p dir="ltr" className="min-w-0 max-w-[7.5rem] justify-self-end truncate text-end text-[11px] leading-snug text-neutral-500">
                        {rightMiddleLabel}
                      </p>

                      <p className="min-w-0 truncate text-[11px] leading-snug text-neutral-500">
                        {tx.time}
                      </p>
                      <div className="min-w-0 max-w-[7.5rem] justify-self-end text-end">
                        {tx.rightBottomLabel ? (
                          <p dir="ltr" className={`truncate text-[11px] font-bold leading-snug tabular-nums ${tx.rightBottomClassName || 'text-neutral-500'}`}>
                            {tx.rightBottomLabel}
                          </p>
                        ) : showProfit ? (
                          <p dir="ltr" className={`truncate text-[11px] font-bold leading-snug tabular-nums ${derivedProfit! >= 0 ? 'text-financial-profit' : 'text-financial-loss'}`}>
                            {profitLabel}
                          </p>
                        ) : tx.sourceType === 'usdt_tx' && cryptoTx.purchaseFundingCurrency === 'EUR' && Number(cryptoTx.purchaseAmountEur) > 0 ? (
                          <p dir="ltr" className="truncate text-[11px] leading-snug text-neutral-500">
                            ← {Number(cryptoTx.purchaseAmountEur).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR
                          </p>
                        ) : null}
                      </div>
                    </div>

                    {tags.length > 0 && (
                      <div className="mt-1.5 flex min-w-0 flex-wrap gap-1 ps-12">
                        {tags.map((tag: string) => (
                          <span key={tag} className="max-w-full truncate rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </SwipeableListItem>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}
