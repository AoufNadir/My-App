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
import { useShowEur } from '../../contexts/CurrencyVisibilityContext';
import { usualChannelOf } from '../../utils/usualChannel';
import { checkRmbTrade, rmbConversionPreview, type PaymentStatus, type RmbSource, type RmbTradeInput } from '../../utils/rmbTrade';
import type { ClientDzd } from '../../types';

// V13-3: the buy / sell window for RMB, made like the USDT one: the same top card (operation, currency, balance,
// average price), first the source (dinars, EUR or USDT), then who and how much. With dinars the payment is chosen
// by the owner (never for him); with EUR or USDT it is a conversion: no profit, the cost carries over.

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
    /** Tests only: open on a source already chosen */
    initialSource?: RmbSource | null;
};

const W = {
    fr: {
        buyQuestion: 'Source d’achat', buyHint: 'Choisissez comment les RMB ont été achetés.', sellQuestion: 'Source de vente', sellHint: 'Choisissez contre quoi les RMB sont vendus.',
        buyWith: { DZD: 'Achat avec DZD', EUR: 'Achat avec EUR', USDT: 'Achat avec USDT' }, sellWith: { DZD: 'Vente avec DZD', EUR: 'Vente avec EUR', USDT: 'Vente avec USDT' },
        detail: { DZD: 'Dinars : payé maintenant ou à crédit', EUR: 'Conversion : le coût des EUR passe aux RMB', USDT: 'Conversion : le coût des USDT passe aux RMB' },
        sellDetail: { DZD: 'Dinars : bénéfice calculé à la vente', EUR: 'Conversion sans bénéfice : le coût passe aux EUR', USDT: 'Conversion sans bénéfice : le coût passe aux USDT' },
        quantity: 'Quantité (RMB)', price: 'Prix de 1 RMB (DZD)', paid: (c: string) => `Montant payé (${c})`, received: (c: string) => `Montant reçu (${c})`,
        total: 'Total', profit: 'Bénéfice estimé', rate: 'Taux', newPam: (c: string) => `Prix moyen de ces ${c}`, conversion: 'Conversion : aucun bénéfice maintenant, il viendra à la vente en dinars.',
        changeSource: 'Changer la source', balance: 'Solde', pam: 'Prix moyen actuel',
        errors: { client: 'Choisissez le client', quantity: 'Écrivez la quantité', price: 'Écrivez le prix', amount: 'Écrivez le montant', payment: 'Choisissez le mode de paiement', stock: 'Stock RMB insuffisant', source_stock: 'Stock insuffisant pour payer' },
        done: '✅ Opération enregistrée.',
    },
    ar: {
        buyQuestion: 'مصدر الشراء', buyHint: 'اختر كيف اشتريت RMB.', sellQuestion: 'مصدر البيع', sellHint: 'اختر مقابل ماذا تبيع RMB.',
        buyWith: { DZD: 'شراء بالدينار', EUR: 'شراء باليورو', USDT: 'شراء بالـ USDT' }, sellWith: { DZD: 'بيع بالدينار', EUR: 'بيع مقابل يورو', USDT: 'بيع مقابل USDT' },
        detail: { DZD: 'بالدينار: الآن أو بالدَّين', EUR: 'تحويل: تكلفة اليورو تنتقل إلى RMB', USDT: 'تحويل: تكلفة الـ USDT تنتقل إلى RMB' },
        sellDetail: { DZD: 'بالدينار: يُحسب الربح عند البيع', EUR: 'تحويل بلا ربح: التكلفة تنتقل إلى اليورو', USDT: 'تحويل بلا ربح: التكلفة تنتقل إلى الـ USDT' },
        quantity: 'الكمية (RMB)', price: 'سعر 1 RMB (دج)', paid: (c: string) => `المبلغ المدفوع (${c})`, received: (c: string) => `المبلغ المستلم (${c})`,
        total: 'المجموع', profit: 'الربح المتوقع', rate: 'سعر الصرف', newPam: (c: string) => `متوسط سعر هذا الـ ${c}`, conversion: 'تحويل: لا ربح الآن، ويظهر الربح عند البيع بالدينار.',
        changeSource: 'تغيير المصدر', balance: 'الرصيد', pam: 'متوسط السعر الحالي',
        errors: { client: 'اختر العميل', quantity: 'اكتب الكمية', price: 'اكتب السعر', amount: 'اكتب المبلغ', payment: 'اختر طريقة الدفع', stock: 'مخزون RMB لا يكفي', source_stock: 'المخزون لا يكفي للدفع' },
        done: '✅ سُجّلت العملية.',
    },
};
const n = (value: number, digits = 2) => value.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export function RmbTradeDialog({ kind, onClose, onSwitch, holdings, clientsDzd, openClientModal, fieldBase, onSave, parseAndEvaluate, initialSource = null }: RmbTradeDialogProps) {
    const { lang, t } = useLanguage();
    const w = W[lang];
    const showEur = useShowEur();
    const [source, setSource] = React.useState<RmbSource | null>(initialSource);
    const [clientId, setClientId] = React.useState('none');
    const [status, setStatus] = React.useState<PaymentStatus | null>(null);
    const [quantity, setQuantity] = React.useState('');
    const [price, setPrice] = React.useState('');
    const [otherAmount, setOtherAmount] = React.useState('');
    const [saving, setSaving] = React.useState(false);
    React.useEffect(() => {
        // Each opening starts empty: nothing is chosen for the owner.
        setSource(initialSource); setClientId('none'); setStatus(null); setQuantity(''); setPrice(''); setOtherAmount('');
    }, [kind, initialSource]);
    if (!kind)
        return null;
    const num = (value: string) => { const v = parseAndEvaluate(value || ''); return Number.isFinite(v) ? v : 0; };
    const input: RmbTradeInput | null = source ? { kind, source, quantity: num(quantity), price: num(price), otherAmount: num(otherAmount), clientId, paymentStatus: source === 'DZD' ? status : null } : null;
    const stock = { RMB: holdings.RMB.available, EUR: holdings.EUR.available, USDT: holdings.USDT.available };
    const check = input ? checkRmbTrade(input, stock) : null;
    const reason = check && check.ok === false ? w.errors[check.reason] : undefined;
    const total = input && source === 'DZD' ? Math.round(input.quantity * (input.price ?? 0)) : 0;
    const profit = input && kind === 'sell' && source === 'DZD' && total > 0 ? Math.round((total - input.quantity * holdings.RMB.avgBuy) * 100) / 100 : 0;
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
    const sources: RmbSource[] = (['DZD', 'EUR', 'USDT'] as RmbSource[]).filter((s) => s !== 'EUR' || showEur);
    const icon = (s: RmbSource) => (s === 'DZD' ? <BanknotesIcon className="h-5 w-5"/> : s === 'EUR' ? <WalletIcon className="h-5 w-5"/> : <DollarSignIcon className="h-5 w-5"/>);
    const footerStats: OperationFooterStat[] = [];
    if (total > 0) footerStats.push({ label: w.total, value: `${n(total, 0)} DZD` });
    if (kind === 'sell' && source === 'DZD' && total > 0) footerStats.push({ label: w.profit, value: `${n(profit, 0)} DZD`, tone: profit >= 0 ? 'profit' : 'loss' });
    return (<Modal isOpen onClose={onClose} className="bg-surface max-w-md">
      <ModalHeader onClose={onClose}>
        <ModalTitle className="text-base sm:text-lg">{t('transactions.newTransaction')}</ModalTitle>
      </ModalHeader>
      <ModalContent className="space-y-3 bg-app-bg px-4 py-4 sm:px-5">
        <FormCard>
          <div className="grid grid-cols-2 gap-2">
            <SegmentedControl size="md" ariaLabel={t('transactions.operationType') as string} value={kind} onChange={(next) => onSwitch(next, 'RMB')} options={[
                { id: 'buy', label: <><ArrowDownLeftIcon aria-hidden="true" className="h-4 w-4 shrink-0"/>{t('transactions.buy')}</>, tone: 'profit' },
                { id: 'sell', label: <><ArrowUpRightIcon aria-hidden="true" className="h-4 w-4 shrink-0"/>{t('transactions.sell')}</>, tone: 'loss' },
            ]}/>
            <SegmentedControl size="md" ariaLabel={t('transactions.currencyLabel') as string} value="RMB" onChange={(currency) => onSwitch(kind, currency)} options={[
                { id: 'USDT' as const, label: 'USDT', tone: 'primary' as const },
                ...(showEur ? [{ id: 'EUR' as const, label: 'EUR', tone: 'primary' as const }] : []),
                { id: 'RMB' as const, label: 'RMB', tone: 'primary' as const },
            ]}/>
          </div>
          <dl className="grid grid-cols-2 gap-2">
            <div className="min-w-0 rounded-button bg-surface-muted px-3 py-2">
              <dt className="truncate text-[11px] font-semibold text-neutral-500">{w.balance}</dt>
              <dd className="mt-0.5 text-sm font-bold tabular-nums text-neutral-900"><span dir="ltr">{n(holdings.RMB.available)} RMB</span></dd>
            </div>
            <div className="min-w-0 rounded-button bg-surface-muted px-3 py-2">
              <dt className="truncate text-[11px] font-semibold text-neutral-500">{w.pam}</dt>
              <dd className="mt-0.5 text-sm font-bold tabular-nums text-neutral-900"><span dir="ltr">{holdings.RMB.avgBuy.toFixed(2)} DZD</span></dd>
            </div>
          </dl>
        </FormCard>

        {!source && (<FormCard title={kind === 'buy' ? w.buyQuestion : w.sellQuestion} description={kind === 'buy' ? w.buyHint : w.sellHint}>
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
            <button type="button" onClick={() => setSource(null)} className="inline-flex items-center gap-1 text-xs font-semibold text-primary"><ChevronRightIcon aria-hidden="true" className="h-4 w-4 -scale-x-100 rtl:scale-x-100"/>{w.changeSource}: {kind === 'buy' ? w.buyWith[source] : w.sellWith[source]}</button>
            <FormCard title={kind === 'buy' ? t('transactions.stepWhoBuy') : t('transactions.stepWhoSell')}>
              <ClientLinker linkedClientId={clientId} setLinkedClientId={setClientId} linkedClientDzdId="none" setLinkedClientDzdId={() => undefined} openClientModal={openClientModal} clientsDzd={clientsDzd} fieldBase={fieldBase} clientPaymentStatus={status} setClientPaymentStatus={setStatus} hidePaymentStatus={source !== 'DZD'} hideLinkedDzdClient usualChannel={source === 'DZD' ? usual : null}/>
            </FormCard>
            <FormCard title={t('transactions.stepHowMuch')}>
              <MoneyField label={w.quantity} value={quantity} onChange={setQuantity} onMax={kind === 'sell' ? () => setQuantity(String(holdings.RMB.available)) : undefined} hint={kind === 'sell' ? <>{w.balance}: <bdi dir="ltr">{n(holdings.RMB.available)} RMB</bdi></> : undefined}/>
              {source === 'DZD'
                ? <MoneyField label={w.price} value={price} onChange={setPrice} hint={<>{w.pam}: <bdi dir="ltr">{holdings.RMB.avgBuy.toFixed(2)} DZD</bdi></>}/>
                : <MoneyField label={kind === 'buy' ? w.paid(source) : w.received(source)} value={otherAmount} onChange={setOtherAmount} hint={kind === 'buy' ? <>{w.balance}: <bdi dir="ltr">{n(holdings[source].available)} {source}</bdi> · {w.pam}: <bdi dir="ltr">{holdings[source].avgBuy.toFixed(2)} DZD</bdi></> : undefined}/>}
              {preview && (<div className="space-y-0.5 rounded-button bg-surface-muted px-3 py-2 text-xs text-neutral-700">
                  <p>{w.rate}: <bdi dir="ltr">1 {source} = {n(preview.rate, 4)} RMB</bdi></p>
                  <p>{w.newPam(preview.incoming)}: <bdi dir="ltr"><b>{n(preview.avgPrice)} DZD</b></bdi></p>
                  <p className="text-neutral-500">{w.conversion}</p>
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
