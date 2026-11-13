import React from 'react';
import { Modal, ModalContent, ModalHeader, ModalTitle } from '../ui/Modal';
import { FormCard } from '../ui/FormCard';
import { SegmentedControl } from '../ui/SegmentedControl';
import { Button } from '../ui/Button';
import { MoneyField } from '../ui/MoneyField';
import { OperationFooter, type OperationFooterStat } from '../ui/OperationFooter';
import { ClientLinker } from './ClientLinker';
import { ArrowDownLeftIcon } from '../icons/ArrowDownLeftIcon';
import { ArrowUpRightIcon } from '../icons/ArrowUpRightIcon';
import { BanknotesIcon } from '../icons/BanknotesIcon';
import { WalletIcon } from '../icons/WalletIcon';
import { DollarSignIcon } from '../icons/DollarSignIcon';
import { ChevronRightIcon } from '../icons/ChevronRightIcon';
import { useLanguage } from '../../contexts/LanguageContext';
import { useShowEur, useShowRmb, useShowUsdt } from '../../contexts/CurrencyVisibilityContext';
import { usualChannelOf } from '../../utils/usualChannel';
import { checkRmbTrade, linkThreeFields, rmbConversionPreview, type PaymentStatus, type RmbSource, type RmbTradeInput, type ThreeFields, type TradeCurrency } from '../../utils/rmbTrade';
import type { ClientDzd } from '../../types';

// V13-3: the buy / sell window for RMB, made like the USDT one: the same top card (operation, currency, balance,
// average price), first the source (dinars, EUR or USDT), then who and how much. With dinars the payment is chosen
// by the owner (never for him); buying with EUR or USDT is a conversion (no profit, the cost carries over), selling for
// another currency is a sale (V13-6): what comes in is valued at its average price, profit or loss against the PAM.

export type RmbHolding = { available: number; avgBuy: number };
export type RmbTradeDialogProps = {
    kind: 'buy' | 'sell' | null;
    onClose: () => void;
    /** Back to the USDT / EUR window, or the other side of RMB */
    onSwitch: (kind: 'buy' | 'sell', currency: 'USDT' | 'EUR' | 'RMB') => void;
    holdings: { RMB: RmbHolding; USDT: RmbHolding; EUR: RmbHolding };
    clientsDzd: ClientDzd[];
    openClientModal: (client: ClientDzd | null) => void;
    fieldBase: string;
    onSave: (input: RmbTradeInput, profitDzd: number) => Promise<boolean>;
    parseAndEvaluate: (expr: string) => number;
    /** V13-4: the currency bought or sold here (RMB by default). USDT and EUR come here only paid in another currency. */
    currency?: TradeCurrency;
    /** Open on a source already chosen (USDT and EUR always do: their dinar window is the usual one) */
    initialSource?: RmbSource | null;
};

const W = {
    fr: {
        buyQuestion: 'Source d’achat', buyHint: (c: string) => `Choisissez comment les ${c} ont été achetés.`, sellQuestion: 'Source de vente', sellHint: (c: string) => `Choisissez contre quoi les ${c} sont vendus.`,
        buyWith: { DZD: 'Achat avec DZD', EUR: 'Achat avec EUR', USDT: 'Achat avec USDT', RMB: 'Achat avec RMB' }, sellWith: { DZD: 'Vente avec DZD', EUR: 'Vente avec EUR', USDT: 'Vente avec USDT', RMB: 'Vente avec RMB' },
        detail: { DZD: 'Dinars : payé maintenant ou à crédit', EUR: 'Conversion : le coût des EUR est repris', USDT: 'Conversion : le coût des USDT est repris', RMB: 'Conversion : le coût des RMB est repris' },
        sellDetail: { DZD: 'Dinars : bénéfice calculé à la vente', EUR: 'Conversion sans bénéfice : le coût passe aux EUR', USDT: 'Conversion sans bénéfice : le coût passe aux USDT', RMB: 'Conversion sans bénéfice : le coût passe aux RMB' },
        quantity: (c: string) => `Quantité (${c})`, price: (c: string) => `Prix de 1 ${c} (DZD)`, totalDzd: 'Montant total (DZD)', rateLabel: (o: string, c: string) => `Taux : 1 ${o} = ? ${c}`, paid: (c: string) => `Montant payé (${c})`, received: (c: string) => `Montant reçu (${c})`, costLine: (c: string) => `Coût de ces ${c}`,
        total: 'Total', profit: 'Bénéfice estimé', rate: 'Taux', newPam: (c: string) => `Prix moyen de ces ${c}`, conversion: 'Conversion : aucun bénéfice maintenant, il viendra à la vente en dinars.', crossValue: (c: string) => `Valeur reçue (au prix moyen des ${c})`, crossNote: 'Vente : ce qui entre est compté à son prix moyen, le bénéfice ou la perte se compare au prix moyen de ce qui sort.',
        changeSource: 'Changer la source', balance: 'Solde', pam: 'Prix moyen actuel',
        errors: { client: 'Choisissez le client', quantity: 'Écrivez la quantité', price: 'Écrivez le prix', amount: 'Écrivez le montant', payment: 'Choisissez le mode de paiement', stock: 'Stock insuffisant', source_stock: 'Stock insuffisant pour payer', same_currency: 'Choisissez une autre devise', no_received_price: 'Cette devise n’a pas de prix moyen (aucun achat) : impossible de calculer le bénéfice' },
        done: '✅ Opération enregistrée.',
    },
    ar: {
        buyQuestion: 'مصدر الشراء', buyHint: (c: string) => `اختر كيف اشتريت ${c}.`, sellQuestion: 'مصدر البيع', sellHint: (c: string) => `اختر مقابل ماذا تبيع ${c}.`,
        buyWith: { DZD: 'شراء بالدينار', EUR: 'شراء باليورو', USDT: 'شراء بالـ USDT', RMB: 'شراء بالـ RMB' }, sellWith: { DZD: 'بيع بالدينار', EUR: 'بيع مقابل يورو', USDT: 'بيع مقابل USDT', RMB: 'بيع مقابل RMB' },
        detail: { DZD: 'بالدينار: الآن أو بالدَّين', EUR: 'تحويل: تنتقل تكلفة اليورو', USDT: 'تحويل: تنتقل تكلفة الـ USDT', RMB: 'تحويل: تنتقل تكلفة الـ RMB' },
        sellDetail: { DZD: 'بالدينار: يُحسب الربح عند البيع', EUR: 'تحويل بلا ربح: التكلفة تنتقل إلى اليورو', USDT: 'تحويل بلا ربح: التكلفة تنتقل إلى الـ USDT', RMB: 'تحويل بلا ربح: التكلفة تنتقل إلى الـ RMB' },
        quantity: (c: string) => `الكمية (${c})`, price: (c: string) => `سعر 1 ${c} (دج)`, totalDzd: 'المبلغ الكلي (دج)', rateLabel: (o: string, c: string) => `سعر الصرف: \u20661 ${o} = ? ${c}\u2069`, paid: (c: string) => `المبلغ المدفوع (${c})`, received: (c: string) => `المبلغ المستلم (${c})`, costLine: (c: string) => `تكلفة هذه الـ ${c}`,
        total: 'المجموع', profit: 'الربح المتوقع', rate: 'سعر الصرف', newPam: (c: string) => `متوسط سعر هذا الـ ${c}`, conversion: 'تحويل: لا ربح الآن، ويظهر الربح عند البيع بالدينار.', crossValue: (c: string) => `قيمة ما استلمته (بمتوسط سعر الـ ${c})`, crossNote: 'بيع: ما يدخل يُحسب بمتوسط سعر شرائه، والربح أو الخسارة مقارنة بمتوسط سعر ما يخرج.',
        changeSource: 'تغيير المصدر', balance: 'الرصيد', pam: 'متوسط السعر الحالي',
        errors: { client: 'اختر العميل', quantity: 'اكتب الكمية', price: 'اكتب السعر', amount: 'اكتب المبلغ', payment: 'اختر طريقة الدفع', stock: 'المخزون لا يكفي', source_stock: 'المخزون لا يكفي للدفع', same_currency: 'اختر عملة أخرى', no_received_price: 'هذه العملة بلا متوسط سعر شراء (لم تُشترَ قط)، فلا يُحسب ربح البيع' },
        done: '✅ سُجّلت العملية.',
    },
};
const n = (value: number, digits = 2) => value.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export function RmbTradeDialog({ kind, onClose, onSwitch, holdings, clientsDzd, openClientModal, fieldBase, onSave, parseAndEvaluate, initialSource = null, currency = 'RMB' }: RmbTradeDialogProps) {
    const { lang, t } = useLanguage();
    const w = W[lang];
    const showEur = useShowEur();
    const showRmb = useShowRmb();
    const showUsdt = useShowUsdt();
    const [source, setSource] = React.useState<RmbSource | null>(initialSource);
    const [clientId, setClientId] = React.useState('none');
    const [status, setStatus] = React.useState<PaymentStatus | null>(null);
    // With dinars: quantity, price, total. Paid in another currency: quantity, rate, amount (V13-4, three linked fields).
    const [dzd, setDzd] = React.useState({ quantity: '', price: '', total: '' });
    const [conv, setConv] = React.useState<ThreeFields>({ quantity: '', rate: '', amount: '' });
    const [saving, setSaving] = React.useState(false);
    React.useEffect(() => {
        // Each opening starts empty: nothing is chosen for the owner.
        setSource(initialSource); setClientId('none'); setStatus(null); setDzd({ quantity: '', price: '', total: '' }); setConv({ quantity: '', rate: '', amount: '' });
    }, [kind, initialSource, currency]);
    if (!kind)
        return null;
    const num = (value: string) => { const v = parseAndEvaluate(value || ''); return Number.isFinite(v) ? v : 0; };
    const quantityValue = source === 'DZD' ? num(dzd.quantity) : num(conv.quantity);
    const priceValue = num(dzd.quantity) > 0 && num(dzd.total) > 0 && !num(dzd.price) ? num(dzd.total) / num(dzd.quantity) : num(dzd.price);
    const input: RmbTradeInput | null = source ? { kind, currency, source, quantity: quantityValue, price: priceValue, otherAmount: num(conv.amount), clientId, paymentStatus: source === 'DZD' ? status : null, receivedAvgPrice: kind === 'sell' && source && source !== 'DZD' ? holdings[source].avgBuy : undefined } : null;
    const stock = { RMB: holdings.RMB.available, EUR: holdings.EUR.available, USDT: holdings.USDT.available };
    const setDzdField = (field: 'quantity' | 'price' | 'total', value: string) => {
        const next = { ...dzd, [field]: value };
        const q = num(next.quantity), p = num(next.price), tt = num(next.total);
        if (field !== 'total' && q > 0 && p > 0) next.total = String(Math.round(q * p));
        if (field === 'total' && q > 0 && tt > 0) next.price = String(Math.round((tt / q) * 100) / 100);
        setDzd(next);
    };
    const setConvField = (field: keyof ThreeFields, value: string) => setConv(linkThreeFields({ ...conv, [field]: value }, field, num));
    const check = input ? checkRmbTrade(input, stock) : null;
    const reason = check && check.ok === false ? w.errors[check.reason] : undefined;
    const total = input && source === 'DZD' ? Math.round(input.quantity * (input.price ?? 0)) : 0;
    const r2 = (v: number) => Math.round(v * 100) / 100;
    const crossSell = Boolean(input && kind === 'sell' && source && source !== 'DZD' && input.otherAmount && input.otherAmount > 0 && (input.receivedAvgPrice ?? 0) > 0);
    const crossValue = crossSell && input ? r2((input.otherAmount ?? 0) * (input.receivedAvgPrice ?? 0)) : 0;
    const profit = input && kind === 'sell' && source === 'DZD' && total > 0 ? r2(total - input.quantity * holdings[currency].avgBuy)
        : crossSell && input && input.quantity > 0 ? r2(crossValue - input.quantity * holdings[currency].avgBuy) : 0;
    const preview = input && source !== 'DZD' ? rmbConversionPreview(input, { RMB: holdings.RMB.avgBuy, EUR: holdings.EUR.avgBuy, USDT: holdings.USDT.avgBuy }) : null;
    const usual = clientId !== 'none' ? usualChannelOf(clientsDzd.find((c) => c.id === clientId)) : null;
    const save = async () => {
        if (!input || !check?.ok || saving) return;
        setSaving(true);
        try {
            if (await onSave(input, profit)) onClose();
        }
        finally {
            setSaving(false);
        }
    };
    const sources: RmbSource[] = (['DZD', 'USDT', 'EUR', 'RMB'] as RmbSource[])
        .filter((s) => s !== currency && (s !== 'DZD' || currency === 'RMB') && (s !== 'EUR' || showEur) && (s !== 'RMB' || showRmb) && (s !== 'USDT' || showUsdt || holdings.USDT.available > 0));
    const icon = (s: RmbSource) => (s === 'DZD' ? <BanknotesIcon className="h-5 w-5"/> : s === 'EUR' ? <WalletIcon className="h-5 w-5"/> : s === 'RMB' ? <span className="text-base font-extrabold">¥</span> : <DollarSignIcon className="h-5 w-5"/>);
    const changeSource = () => (currency === 'RMB' ? setSource(null) : onSwitch(kind, currency));
    const footerStats: OperationFooterStat[] = [];
    if (total > 0) footerStats.push({ label: w.total, value: `${n(total, 0)} DZD` });
    if (crossSell) footerStats.push({ label: w.crossValue(source as string), value: `${n(crossValue, 0)} DZD` });
    if ((kind === 'sell' && source === 'DZD' && total > 0) || crossSell) footerStats.push({ label: w.profit, value: `${n(profit, 0)} DZD`, tone: profit >= 0 ? 'profit' : 'loss' });
    return (<Modal isOpen onClose={onClose} className="bg-surface max-w-md">
      <ModalHeader onClose={onClose}>
        <ModalTitle className="text-base sm:text-lg">{`${kind === 'buy' ? t('transactions.buy') : t('transactions.sell')} ${currency}`}</ModalTitle>
      </ModalHeader>
      <ModalContent className="space-y-3 bg-app-bg px-4 py-4 sm:px-5">
        <FormCard>
          <dl className="grid grid-cols-2 gap-2">
            <div className="min-w-0 rounded-button bg-surface-muted px-3 py-2">
              <dt className="truncate text-[11px] font-semibold text-neutral-500">{w.balance}</dt>
              <dd className="mt-0.5 text-sm font-bold tabular-nums text-neutral-900"><span dir="ltr">{n(holdings[currency].available)} {currency}</span></dd>
            </div>
            <div className="min-w-0 rounded-button bg-surface-muted px-3 py-2">
              <dt className="truncate text-[11px] font-semibold text-neutral-500">{w.pam}</dt>
              <dd className="mt-0.5 text-sm font-bold tabular-nums text-neutral-900"><span dir="ltr">{holdings[currency].avgBuy.toFixed(2)} DZD</span></dd>
            </div>
          </dl>
        </FormCard>

        {!source && (<FormCard title={kind === 'buy' ? w.buyQuestion : w.sellQuestion} description={kind === 'buy' ? w.buyHint(currency) : w.sellHint(currency)}>
            <div className="-mx-2 -my-1 divide-y divide-border">
              {sources.map((s) => (<button key={s} type="button" onClick={() => setSource(s)} className="flex min-h-touch w-full items-center gap-3 rounded-button px-2 py-2.5 text-start transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-financial-asset-bg text-financial-asset">{icon(s)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-bold text-neutral-900">{kind === 'buy' ? w.buyWith[s] : w.sellWith[s]}</span>
                    <span className="block text-xs text-neutral-500">{kind === 'buy' ? w.detail[s] : w.sellDetail[s]}</span>
                  </span>
                  <ChevronRightIcon aria-hidden="true" className="h-5 w-5 shrink-0 text-neutral-400 rtl:-scale-x-100"/>
                </button>))}
            </div>
          </FormCard>)}

        {source && (<>
            <button type="button" onClick={changeSource} className="inline-flex items-center gap-1 text-xs font-semibold text-primary"><ChevronRightIcon aria-hidden="true" className="h-4 w-4 -scale-x-100 rtl:scale-x-100"/>{w.changeSource}: {kind === 'buy' ? w.buyWith[source] : w.sellWith[source]}</button>
            <FormCard title={kind === 'buy' ? t('transactions.stepWhoBuy') : t('transactions.stepWhoSell')}>
              <ClientLinker linkedClientId={clientId} setLinkedClientId={setClientId} linkedClientDzdId="none" setLinkedClientDzdId={() => undefined} openClientModal={openClientModal} clientsDzd={clientsDzd} fieldBase={fieldBase} clientPaymentStatus={status} setClientPaymentStatus={setStatus} hidePaymentStatus={source !== 'DZD'} hideLinkedDzdClient usualChannel={source === 'DZD' ? usual : null}/>
            </FormCard>
            <FormCard title={t('transactions.stepHowMuch')}>
              {source === 'DZD' ? (<>
                  <MoneyField label={w.quantity(currency)} value={dzd.quantity} onChange={(v) => setDzdField('quantity', v)} onMax={kind === 'sell' ? () => setDzdField('quantity', String(holdings[currency].available)) : undefined} hint={kind === 'sell' ? <>{w.balance}: <bdi dir="ltr">{n(holdings[currency].available)} {currency}</bdi></> : undefined}/>
                  <MoneyField label={w.price(currency)} value={dzd.price} onChange={(v) => setDzdField('price', v)} hint={<>{w.pam}: <bdi dir="ltr">{holdings[currency].avgBuy.toFixed(2)} DZD</bdi></>}/>
                  <MoneyField label={w.totalDzd} value={dzd.total} onChange={(v) => setDzdField('total', v)}/>
                </>) : (<>
                  <MoneyField label={w.quantity(currency)} value={conv.quantity} onChange={(v) => setConvField('quantity', v)} onMax={kind === 'sell' ? () => setConvField('quantity', String(holdings[currency].available)) : undefined} hint={kind === 'sell' ? <>{w.balance}: <bdi dir="ltr">{n(holdings[currency].available)} {currency}</bdi></> : undefined}/>
                  <MoneyField label={w.rateLabel(source, currency)} value={conv.rate} onChange={(v) => setConvField('rate', v)}/>
                  <MoneyField label={kind === 'buy' ? w.paid(source) : w.received(source)} value={conv.amount} onChange={(v) => setConvField('amount', v)} hint={kind === 'buy' ? <>{w.balance}: <bdi dir="ltr">{n(holdings[source].available)} {source}</bdi> · {w.pam}: <bdi dir="ltr">{holdings[source].avgBuy.toFixed(2)} DZD</bdi></> : undefined}/>
                </>)}
              {preview && source !== 'DZD' && (<div className="space-y-0.5 rounded-button bg-surface-muted px-3 py-2 text-xs text-neutral-700">
                  <p>{w.rate}: <bdi dir="ltr">1 {source} = {n(preview.rate, 4)} {currency}</bdi> · <bdi dir="ltr">1 {currency} = {n(1 / preview.rate, 4)} {source}</bdi></p>
                  {kind === 'buy' && (<>
                  <p>{w.costLine(preview.incoming)}: <bdi dir="ltr"><b>{n(preview.costDzd, 0)} DZD</b></bdi></p>
                  <p>{w.newPam(preview.incoming)}: <bdi dir="ltr"><b>{n(preview.avgPrice)} DZD</b></bdi></p>
                  </>)}
                  <p className="text-neutral-500">{kind === 'sell' ? w.crossNote : w.conversion}</p>
                </div>)}
            </FormCard>
          </>)}
      </ModalContent>
      {source && (<OperationFooter stats={footerStats} reason={reason} reasonTone="missing">
          <Button onClick={onClose} variant="outline">{t('common.cancel')}</Button>
          <Button onClick={save} disabled={!check?.ok} loading={saving} title={reason}>{saving ? t('common.processing') : t('transactions.confirm')}</Button>
        </OperationFooter>)}
    </Modal>);
}
