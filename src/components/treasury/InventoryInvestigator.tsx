import type { ReactNode } from 'react';
import { Button } from '../ui/Button';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatMoney, formatNumber, type MoneyCurrency } from '../../pages/shared/pageFormat';
import type { InventoryAccount } from '../../utils/inventoryCheck';
import type {
    CashAccount,
    InvestigatorAction,
    InvestigatorOperation,
    InventorySuggestion,
    TradeSuggestion,
    UnexplainedSuggestion,
    WrongChannelSuggestion,
} from '../../utils/inventoryInvestigator';

const ACCOUNT_LABEL_KEYS: Record<InventoryAccount, string> = {
    caisse: 'inventory.accountCaisse',
    baridi: 'inventory.accountBaridi',
    usdt: 'inventory.accountUsdt',
    eur: 'inventory.accountEur',
};
const ACCOUNT_CURRENCY: Record<InventoryAccount, MoneyCurrency> = { caisse: 'DZD', baridi: 'DZD', usdt: 'USDT', eur: 'EUR' };
const OPERATION_LABEL_KEYS: Record<string, string> = {
    Ajout: 'opAjout',
    Retrait: 'opRetrait',
    Transfer: 'opTransfer',
    'Adjustment (+)': 'opAdjPlus',
    'Adjustment (-)': 'opAdjMinus',
    buy: 'opBuy',
    sell: 'opSell',
    'Ajout Manuel': 'opManualIn',
    'Retrait Manuel': 'opManualOut',
};

type InventoryInvestigatorProps = {
    suggestions: InventorySuggestion[];
    /** False while the figures still come from the phone's cache */
    ready: boolean;
    onAction: (action: InvestigatorAction) => void;
};

/**
 * The investigator's suggestions under the counts (V5-3). Every button opens a window that already
 * exists, filled in; nothing is saved from here.
 */
export function InventoryInvestigator({ suggestions, ready, onAction }: InventoryInvestigatorProps) {
    const { t } = useLanguage();
    const word = (key: string, values: Record<string, string> = {}) =>
        Object.entries(values).reduce((out, [name, value]) => out.replace(new RegExp(`\\{${name}\\}`, 'g'), value), String(t(`inventory.investigator.${key}`)));
    // An amount inside an Arabic sentence keeps its own left-to-right order (« 5 000 DZD », not « DZD 5 000 »).
    const ltr = (value: string) => `\u2066${value}\u2069`;
    // Whole dinars without decimals, otherwise always two (same rule as the counts above).
    const dzd = (value: number) => ltr(formatMoney(value, 'DZD', Number.isInteger(value) ? { min: 0, max: 0 } : { min: 2, max: 2 }));
    const price = (value: number) => ltr(formatMoney(value, 'DZD', { min: 2, max: 2 }));
    const units = (value: number) => ltr(formatNumber(value, { min: 2, max: 2 }));
    const box = (account: CashAccount) => word(account === 'caisse' ? 'boxCaisse' : 'boxBaridi');
    const otherBox = (account: CashAccount): CashAccount => (account === 'caisse' ? 'baridi' : 'caisse');
    const operationLabel = (type: string) => (OPERATION_LABEL_KEYS[type] ? word(OPERATION_LABEL_KEYS[type]) : type);

    const card = (key: string, children: ReactNode) => (
        <div key={key} className="space-y-2 rounded-button border border-border bg-surface px-3 py-2.5">{children}</div>
    );
    const stamp = (date: string, time: string) => (
        <span className="text-xs font-semibold text-neutral-700" dir="ltr">{date} {time}</span>
    );
    const editButton = (source: 'treasury' | 'portfolio', id: string) => (
        <Button type="button" size="sm" variant="outline" disabled={!ready} onClick={() => onAction({ kind: 'editOperation', source, id })}>{word('edit')}</Button>
    );

    const wrongChannel = (s: WrongChannelSuggestion, index: number) => card(`wrong-${index}`, <>
        <p className="text-sm font-bold text-neutral-900">{word('wrongBoxTitle', { amount: dzd(s.amount) })}</p>
        <p className="text-xs text-neutral-600">{word('wrongBoxBody', { above: box(s.booksAbove), below: box(s.booksBelow), amount: dzd(s.amount) })}</p>
        {s.candidates.length === 0
            ? (<p className="text-xs font-semibold text-neutral-700">{word('noCandidates')}</p>)
            : (<>
                <p className="text-xs font-semibold text-neutral-700">{s.sinceDate ? word('candidatesSince', { date: s.sinceDate }) : word('candidatesAll')}</p>
                <ul className="space-y-1.5">
                  {s.candidates.map((candidate) => (<li key={candidate.tx.id} className="flex items-start justify-between gap-2 rounded-button bg-surface-muted px-2.5 py-2">
                      <div className="min-w-0 space-y-0.5">
                        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          {stamp(candidate.tx.date ?? '', candidate.tx.time ?? '')}
                          <span className="text-xs font-semibold text-neutral-900">{operationLabel(String(candidate.tx.type ?? ''))}</span>
                          <span className="text-xs font-bold tabular-nums text-neutral-900" dir="ltr">{dzd(Number(candidate.tx.amount))}</span>
                        </p>
                        <p className="text-xs text-neutral-600">{word('candidateMove', { from: box(otherBox(candidate.shouldBe)), to: box(candidate.shouldBe) })}</p>
                        {candidate.linked && (<p className="text-xs text-neutral-500">{word('candidateLinked', {
                            kind: word(candidate.linked.type === 'buy' ? 'kindBuy' : 'kindSell'),
                            quantity: ltr(formatNumber(candidate.linked.quantity, { min: 0, max: 2 })),
                            currency: candidate.linked.currency,
                        })}</p>)}
                      </div>
                      {editButton('treasury', candidate.tx.id)}
                    </li>))}
                </ul>
              </>)}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
          <p className="min-w-0 flex-1 text-xs text-neutral-600">{word('transferHint', { from: box(s.transfer.from), to: box(s.transfer.to), amount: dzd(s.transfer.amount) })}</p>
          <Button type="button" size="sm" variant="outline" disabled={!ready} onClick={() => onAction({ kind: 'recordTransfer', amount: s.transfer.amount, from: s.transfer.from, to: s.transfer.to })}>{word('transferButton')}</Button>
        </div>
    </>);

    const trade = (s: TradeSuggestion, index: number) => {
        const isSale = s.kind === 'unrecordedSale';
        const values = { quantity: units(s.quantity), currency: s.currency };
        const priceLine = s.recent === null || s.plausible === null
            ? { tone: 'text-neutral-500', text: word('priceUnknown') }
            : {
                tone: s.plausible ? 'text-financial-profit' : 'text-warning',
                text: word(s.plausible ? 'priceFits' : 'priceOff', { count: String(s.recent.count), min: price(s.recent.min), max: price(s.recent.max) }),
            };
        return card(`trade-${index}`, <>
            <p className="text-sm font-bold text-neutral-900">{word(isSale ? 'saleTitle' : 'purchaseTitle', values)}</p>
            <p className="text-xs text-neutral-600">{word(isSale ? 'saleBody' : 'purchaseBody', { ...values, dzd: dzd(s.dzdAmount), price: price(s.unitPrice), box: box(s.channel) })}</p>
            <p className={`text-xs font-semibold ${priceLine.tone}`}>{priceLine.text}</p>
            {s.splitChannels
                ? (<p className="text-xs font-semibold text-neutral-700">{word('splitBoxes')}</p>)
                : (<Button type="button" size="sm" variant="outline" className="w-full" disabled={!ready} onClick={() => onAction({ kind: 'recordTrade', suggestion: s })}>{word(isSale ? 'recordSale' : 'recordPurchase')}</Button>)}
        </>);
    };

    const operationAmount = (operation: InvestigatorOperation, account: InventoryAccount) => {
        const sign = operation.direction > 0 ? '+' : operation.direction < 0 ? '-' : '';
        const currency = ACCOUNT_CURRENCY[account];
        const formatted = currency === 'DZD' ? dzd(operation.amount) : formatMoney(operation.amount, currency, { min: 2, max: 2 });
        return `${sign}${formatted}`;
    };
    const unexplained = (s: UnexplainedSuggestion, index: number) => card(`gap-${index}`, <>
        <p className="text-sm font-bold text-neutral-900">{word('unexplainedTitle', {
            account: String(t(ACCOUNT_LABEL_KEYS[s.account])),
            gap: ltr(formatMoney(s.gap, ACCOUNT_CURRENCY[s.account], { min: 0, max: 2, showSign: true })),
        })}</p>
        <p className="text-xs text-neutral-600">
          {s.count === 0
            ? word('unexplainedNone')
            : s.sinceDate ? word('unexplainedSince', { count: String(s.count), date: s.sinceDate }) : word('unexplainedAll', { count: String(s.count) })}
        </p>
        {s.operations.length > 0 && (<ul className="space-y-1.5">
            {s.operations.map((operation) => (<li key={`${operation.source}-${operation.id}`} className="flex items-center justify-between gap-2 rounded-button bg-surface-muted px-2.5 py-2">
                <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                  {stamp(operation.date, operation.time)}
                  <span className="text-xs font-semibold text-neutral-900">{operationLabel(operation.type)}</span>
                  <span className="text-xs font-bold tabular-nums text-neutral-900" dir="ltr">{operationAmount(operation, s.account)}</span>
                </p>
                {editButton(operation.source, operation.id)}
              </li>))}
          </ul>)}
    </>);

    if (suggestions.length === 0)
        return null;
    return (<section aria-label={String(t('inventory.investigator.title'))} className="space-y-2 rounded-card border border-border bg-surface-muted p-3">
        <h3 className="text-sm font-bold text-neutral-900">{word('title')}</h3>
        <p className="text-xs text-neutral-500">{word('note')}</p>
        {suggestions.map((suggestion, index) => {
            if (suggestion.kind === 'wrongChannel')
                return wrongChannel(suggestion, index);
            if (suggestion.kind === 'unexplained')
                return unexplained(suggestion, index);
            return trade(suggestion, index);
        })}
      </section>);
}
