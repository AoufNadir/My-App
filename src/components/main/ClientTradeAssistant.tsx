import { useLanguage } from '../../contexts/LanguageContext';
import { formatNumber } from '../../pages/shared/pageFormat';
import { daysAgo, type ClientTrade, type TradeSide } from '../../utils/clientLastTrade';

// The assistant of the new-operation window (V11-1): once the client is chosen, the last price you sold to
// him (or bought from him), so the price you type is a decision, not a guess. For a client with no history,
// the last price to anyone else. A tap puts the price in the field; the price stays yours to change, and
// the suggestions of the day under the price field are untouched.

const fill = (template: string, values: Record<string, string | number>) => Object.entries(values).reduce((text, [name, value]) => text.split(`{${name}}`).join(String(value)), template);
const price2 = (value: number) => formatNumber(value, { min: 2, max: 2 });
const qty0 = (value: number) => formatNumber(value, { min: 0, max: 2 });

type Props = {
    side: TradeSide;
    currency: 'USDT' | 'EUR';
    clientName: string;
    /** The last operation with this client, in this currency */
    trade: ClientTrade | null;
    /** The last one with anyone else: shown when this client has none */
    reference: ClientTrade | null;
    /** The price now in the field (0 when empty) */
    currentPrice: number;
    onUsePrice: (price: number) => void;
    now: number;
};

export function ClientTradeAssistant({ side, currency, clientName, trade, reference, currentPrice, onUsePrice, now }: Props) {
    const { t } = useLanguage();
    const tr = (key: string, values: Record<string, string | number> = {}) => fill(t(`transactions.${key}`) as string, values);
    const when = (timestamp: number) => {
        const days = daysAgo(timestamp, now);
        return days === 0 ? tr('assistToday') : days === 1 ? tr('assistYesterday') : tr('assistDaysAgo', { days });
    };
    const useButton = (price: number) => (Math.abs(currentPrice - price) < 0.005
        ? <span className="mt-2.5 inline-block text-[13px] font-bold text-financial-profit">✓ {tr('assistApplied')}</span>
        : <button type="button" onClick={() => onUsePrice(price)} className="mt-2.5 inline-flex min-h-9 items-center rounded-button border border-primary bg-surface px-3 text-[13.5px] font-bold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><bdi>{tr('assistUse', { price: price2(price) })}</bdi></button>);
    const payment = trade?.payment === 'cash' ? tr('assistPayCash') : trade?.payment === 'baridi' ? tr('assistPayBaridi') : trade?.payment === 'credit' ? tr('assistPayCredit') : null;

    if (trade) {
        return (<section aria-label={tr(side === 'sell' ? 'assistLastSale' : 'assistLastBuy', { name: clientName })} className="flex items-center justify-between gap-3 rounded-card border border-primary/25 bg-primary/5 px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-neutral-600">{tr(side === 'sell' ? 'assistLastSaleShort' : 'assistLastBuyShort', { when: when(trade.timestamp) })}</p>
            <p className="mt-0.5 leading-tight"><span dir="ltr" className="text-lg font-extrabold tabular-nums text-neutral-900">{price2(trade.price)}</span> <small className="text-xs text-neutral-600"><bdi>{currency} · {qty0(trade.quantity)}</bdi></small></p>
          </div>
          {Math.abs(currentPrice - trade.price) < 0.005
            ? <span className="shrink-0 text-[13px] font-bold text-financial-profit">✓ {tr('assistApplied')}</span>
            : <button type="button" onClick={() => onUsePrice(trade.price)} className="inline-flex min-h-9 shrink-0 items-center rounded-button border border-primary bg-surface px-3 text-[13.5px] font-bold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{tr('assistUseShort')}</button>}
        </section>);
    }
    return (<section aria-label={tr(side === 'sell' ? 'assistFirstSale' : 'assistFirstBuy', { name: clientName })} className="rounded-card border border-border bg-surface-muted p-3">
        <p className="text-[12.5px] font-bold text-neutral-600">✦ {tr(side === 'sell' ? 'assistFirstSale' : 'assistFirstBuy', { name: clientName })}</p>
        {reference
            ? (<>
                <p className="mt-1 text-[13px] leading-snug text-neutral-600"><bdi>{tr(side === 'sell' ? 'assistReferenceSale' : 'assistReferenceBuy', { price: price2(reference.price), when: when(reference.timestamp) })}</bdi></p>
                {useButton(reference.price)}
              </>)
            : <p className="mt-1 text-[13px] leading-snug text-neutral-500">{tr('assistNoHistory')}</p>}
      </section>);
}
