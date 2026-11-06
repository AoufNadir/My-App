import { useMemo, useState, type ReactNode } from 'react';
import { useLanguage, type Lang } from '../../contexts/LanguageContext';
import { Button } from '../ui/Button';
import { SegmentedControl } from '../ui/SegmentedControl';
import { ArrowUpRightIcon } from '../icons/ArrowUpRightIcon';
import { ChevronRightIcon } from '../icons/ChevronRightIcon';
import { Trash2Icon } from '../icons/Trash2Icon';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { formatNumber } from '../../pages/shared/pageFormat';
import { canRemove, checkDelivery, deliveryStates, type ClientDeliveryState, type DeliveryCurrency, type DeliveryDoc } from '../../utils/deferredDelivery';
import { formatWaNumber, openWhatsAppChooser, openWhatsAppMessenger } from '../../utils/whatsapp';
import { clientReportLanguage } from '../reports/reportLanguage';

// V12-2, on the client's page: the USDT/EUR sold and not sent yet. « J'ai livré » records what was sent, never more
// than what is left; a WhatsApp message then tells the client what he received, in total, and what is left.

const W = {
    fr: {
        title: 'À envoyer au client', hint: 'Écrivez ce que vous envoyez à chaque fois : le reste se calcule seul.',
        sold: 'À envoyer au total', delivered: 'Envoyé', left: 'Reste à envoyer', qty: 'Quantité envoyée', deliver: 'J’ai envoyé',
        tooMuch: (left: string) => `Il ne reste que ${left} à envoyer.`, empty: 'Écrivez la quantité envoyée.',
        history: 'Détail', whatsapp: 'Prévenir sur WhatsApp', addOld: 'Vendu mais pas encore envoyé ? Ajoutez-le',
        addOldHint: 'La quantité vendue à ce client et pas encore envoyée. Sa vente reste comme elle est.', add: 'Ajouter',
        addMore: '+ Ajouter une autre quantité à envoyer', done: 'Tout est envoyé.', cancel: 'Annuler',
        lineSold: 'À envoyer', lineSent: 'Envoyé', remove: 'Supprimer',
        pickSale: 'Quelle vente n’est pas encore envoyée ?', saleOf: 'Vente du', otherQty: 'Autre quantité', noSale: 'Aucune vente récente à ce client.',
        removeTitle: 'Supprimer cette ligne ?', removeBody: (what: string) => `${what}. Aucun solde ni bénéfice ne change.`,
        cannotRemove: 'Impossible : une partie a déjà été envoyée. Supprimez d’abord les envois.',
    },
    ar: {
        title: 'للإرسال إلى العميل', hint: 'اكتب ما ترسله في كل مرة، والتطبيق يحسب الباقي.',
        sold: 'المطلوب إرساله', delivered: 'أُرسل', left: 'الباقي', qty: 'الكمية المرسلة', deliver: 'أرسلت',
        tooMuch: (left: string) => `الباقي ${left} فقط.`, empty: 'اكتب الكمية المرسلة.',
        history: 'التفاصيل', whatsapp: 'أخبره على واتساب', addOld: 'بعت له ولم ترسل بعد؟ أضفه',
        addOldHint: 'الكمية التي بعتها لهذا العميل ولم ترسلها بعد. بيعه يبقى كما هو.', add: 'إضافة',
        addMore: '+ إضافة كمية أخرى للإرسال', done: 'أُرسل كل شيء.', cancel: 'إلغاء',
        lineSold: 'للإرسال', lineSent: 'أُرسل', remove: 'حذف',
        pickSale: 'أي بيع لم تُرسله بعد؟', saleOf: 'بيع يوم', otherQty: 'كمية أخرى', noSale: 'لا بيع حديث لهذا العميل.',
        removeTitle: 'حذف هذا السطر؟', removeBody: (what: string) => `${what}. لا يتغيّر أي رصيد ولا ربح.`,
        cannotRemove: 'غير ممكن: أُرسل جزء منه. احذف الإرسالات أولاً.',
    },
};

const qtyText = (value: number, currency: string) => `⁦${formatNumber(value, { min: 2, max: 2 })} ${currency}⁩`;

/** The message sent after a delivery, in the client's language. */
export function deliveryMessage(lang: Lang, name: string, state: Pick<ClientDeliveryState, 'committed' | 'delivered' | 'remaining' | 'currency'>, sent: number): string {
    const c = state.currency;
    return lang === 'ar'
        ? `مرحباً ${name}،\nأرسلنا لك اليوم ${qtyText(sent, c)}.\nالمجموع المُسلَّم ${qtyText(state.delivered, c)} من ${qtyText(state.committed, c)}، والباقي ${qtyText(state.remaining, c)}.`
        : `Bonjour ${name},\nNous vous avons envoyé aujourd’hui ${qtyText(sent, c)}.\nTotal livré : ${qtyText(state.delivered, c)} sur ${qtyText(state.committed, c)}, reste ${qtyText(state.remaining, c)}.`;
}

export type ClientSale = { id: string; currency: DeliveryCurrency; quantity: number; timestamp: number };

export function ClientDeliveries({ clientId, clientName, phone, docs, saleIds, onRecord, onRemove, sales = [], defaultOpen = false }: {
    clientId: string;
    clientName: string;
    phone?: string;
    docs: ReadonlyArray<DeliveryDoc>;
    saleIds: ReadonlySet<string>;
    onRecord: (kind: DeliveryDoc['kind'], clientId: string, currency: DeliveryCurrency, quantity: number, saleTxId?: string) => void;
    /** This client's recent sales: one tap says « this one is not sent yet », no figure to type */
    sales?: ReadonlyArray<ClientSale>;
    /** Removes a line typed by mistake */
    onRemove?: (id: string) => void;
    /** Opens the « add » part at once (screens and tests) */
    defaultOpen?: boolean;
}) {
    const { lang } = useLanguage();
    const w = W[lang];
    const states = useMemo(() => deliveryStates(docs.filter((doc) => doc.clientId === clientId), saleIds), [docs, clientId, saleIds]);
    const [draft, setDraft] = useState<Record<string, string>>({});
    const [error, setError] = useState<Record<string, string>>({});
    const [lastSent, setLastSent] = useState<Record<string, number>>({});
    const [oldOpen, setOldOpen] = useState(defaultOpen);
    const [manual, setManual] = useState(false);
    const [toRemove, setToRemove] = useState<{ doc: DeliveryDoc; state: ClientDeliveryState } | null>(null);
    const [removeError, setRemoveError] = useState('');
    const [old, setOld] = useState<{ qty: string; currency: DeliveryCurrency }>({ qty: '', currency: 'USDT' });
    const field = 'min-h-input w-full rounded-button border border-border bg-surface px-3 text-sm tabular-nums text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary/40';

    const deliver = (state: ClientDeliveryState) => {
        const key = state.currency;
        const quantity = Number(String(draft[key] ?? '').replace(',', '.'));
        const check = checkDelivery(state.remaining, quantity);
        if (check.ok === false) {
            setError({ ...error, [key]: check.reason === 'empty' ? w.empty : w.tooMuch(qtyText(check.remaining, key)) });
            return;
        }
        onRecord('delivery', clientId, state.currency, quantity);
        setDraft({ ...draft, [key]: '' });
        setError({ ...error, [key]: '' });
        setLastSent({ ...lastSent, [key]: quantity });
    };
    const tell = (state: ClientDeliveryState) => {
        const text = deliveryMessage(clientReportLanguage(clientId), clientName, state, lastSent[state.currency] ?? 0);
        const number = phone ? formatWaNumber(phone) : '';
        if (number.length >= 9)
            openWhatsAppMessenger(number, text);
        else
            openWhatsAppChooser(text);
    };

    // In the style of the « Rapport d'activité » row just above: an icon, a title, a line of explanation.
    const header = (subtitle: string, onClick?: () => void, trailing?: ReactNode) => {
        const inner = (<>
          <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-financial-debt-bg text-financial-debt">
            <ArrowUpRightIcon className="h-5 w-5"/>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-neutral-900">{w.title}</span>
            <span className="block truncate text-xs text-neutral-500">{subtitle}</span>
          </span>
          {trailing}
        </>);
        return onClick
            ? <button type="button" onClick={onClick} className="flex min-h-touch w-full items-center gap-3 px-3 py-2 text-start transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{inner}</button>
            : <div className="flex min-h-touch items-center gap-3 px-3 py-2">{inner}</div>;
    };
    const box = 'mt-2 overflow-hidden rounded-button border border-border bg-surface';
    const linkedSales = new Set(docs.filter((doc) => doc.kind === 'commitment' && doc.saleTxId).map((doc) => doc.saleTxId));
    const freeSales = sales.filter((sale) => !linkedSales.has(sale.id)).slice(0, 5);
    const oldForm = (<div className="space-y-3 border-t border-border p-3">
        <p className="text-xs font-semibold text-neutral-700">{w.pickSale}</p>
        {freeSales.length > 0
            ? (<div className="space-y-1.5">
                {freeSales.map((sale) => (<button key={sale.id} type="button" onClick={() => { onRecord('commitment', clientId, sale.currency, sale.quantity, sale.id); setOldOpen(false); setManual(false); }} className="flex min-h-touch w-full items-center justify-between gap-3 rounded-button border border-border bg-surface px-3 py-2 text-start text-sm transition-colors hover:border-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                    <span className="text-neutral-600">{w.saleOf} {new Date(sale.timestamp).toLocaleDateString('fr-FR')}</span>
                    <span className="font-bold tabular-nums text-neutral-900">{qtyText(sale.quantity, sale.currency)}</span>
                  </button>))}
              </div>)
            : <p className="text-xs text-neutral-500">{w.noSale}</p>}
        {!manual
            ? (<div className="flex items-center justify-between gap-3">
                <button type="button" onClick={() => setManual(true)} className="min-h-touch text-xs font-semibold text-primary">{w.otherQty}</button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setOldOpen(false)}>{w.cancel}</Button>
              </div>)
            : (<div className="space-y-3">
        <p className="text-xs text-neutral-500">{w.addOldHint}</p>
        <SegmentedControl size="sm" ariaLabel={w.left} value={old.currency} onChange={(currency) => setOld({ ...old, currency })} options={[{ id: 'USDT', label: 'USDT', tone: 'primary' }, { id: 'EUR', label: 'EUR', tone: 'primary' }]}/>
        <div className="relative">
          <input inputMode="decimal" value={old.qty} onChange={(event) => setOld({ ...old, qty: event.target.value })} placeholder="0,00" aria-label={w.left} dir="ltr" className={`${field} pr-16 text-base font-semibold`}/>
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 text-sm font-semibold text-neutral-500">{old.currency}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="ghost" size="md" onClick={() => { setOldOpen(false); setManual(false); setOld({ qty: '', currency: old.currency }); }}>{w.cancel}</Button>
          <Button type="button" size="md" className="font-bold" disabled={!(Number(old.qty.replace(',', '.')) > 0)} onClick={() => {
            onRecord('commitment', clientId, old.currency, Number(old.qty.replace(',', '.')));
            setOld({ qty: '', currency: old.currency });
            setOldOpen(false);
            setManual(false);
        }}>{w.add}</Button>
        </div>
              </div>)}
      </div>);
    if (states.length === 0)
        return (<div className={box}>
          {header(w.addOld, oldOpen ? undefined : () => setOldOpen(true), oldOpen ? undefined : <ChevronRightIcon aria-hidden="true" className="h-5 w-5 shrink-0 text-neutral-400 rtl:-scale-x-100"/>)}
          {oldOpen && oldForm}
        </div>);
    const totalLeft = states.reduce((sum, state) => sum + Math.max(0, state.remaining), 0);
    return (<div className={box}>
      {header(totalLeft > 0 ? w.hint : w.done)}
      {states.map((state) => (<div key={state.currency} className="space-y-3 border-t border-border p-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            {[[w.sold, state.committed], [w.delivered, state.delivered], [w.left, state.remaining]].map(([label, value], i) => (<div key={i} className={`rounded-button px-1 py-2 ${i === 2 && (value as number) > 0 ? 'bg-financial-debt-bg' : 'bg-surface-muted'}`}>
                <p className="text-xs font-semibold text-neutral-500">{label as string}</p>
                <p className={`mt-0.5 text-sm font-bold tabular-nums ${i === 2 && (value as number) > 0 ? 'text-financial-debt' : 'text-neutral-900'}`}><bdi dir="ltr">{formatNumber(value as number, { min: 2, max: 2 })}</bdi></p>
                <p className="text-[11px] font-semibold text-neutral-500">{state.currency}</p>
              </div>))}
          </div>
          {state.remaining > 0 && oldOpen ? null : state.remaining > 0
                ? (<div className="space-y-2">
                    <div className="relative">
                      <input inputMode="decimal" value={draft[state.currency] ?? ''} onChange={(event) => setDraft({ ...draft, [state.currency]: event.target.value })} placeholder={w.qty} aria-label={w.qty} dir="ltr" className={`${field} pr-16 text-base font-semibold`}/>
                      <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 text-sm font-semibold text-neutral-500">{state.currency}</span>
                    </div>
                    {error[state.currency] && <p role="alert" className="text-xs font-semibold text-financial-loss">{error[state.currency]}</p>}
                    <Button type="button" size="md" className="w-full font-bold" onClick={() => deliver(state)}>{w.deliver}</Button>
                  </div>)
                : <p className="text-sm font-semibold text-financial-profit">✓ {w.done}</p>}
          {lastSent[state.currency] !== undefined && <Button type="button" variant="outline" size="md" className="w-full" onClick={() => tell(state)}>{w.whatsapp}</Button>}
          <details>
              <summary className="min-h-touch cursor-pointer py-1 text-xs font-semibold text-neutral-600">{w.history} ({state.commitments.length + state.deliveries.length})</summary>
              <ul className="space-y-1 text-xs text-neutral-700">
                {[...state.commitments, ...state.deliveries].sort((x, y) => x.timestamp - y.timestamp).map((doc) => (<li key={doc.id} className="flex items-center gap-2 rounded-button bg-surface-muted px-2 py-1">
                    <span className="w-20 shrink-0 text-neutral-500">{new Date(doc.timestamp).toLocaleDateString('fr-FR')}</span>
                    <span className={`flex-1 font-semibold ${doc.kind === 'delivery' ? 'text-financial-profit' : 'text-financial-debt'}`}>{doc.kind === 'delivery' ? w.lineSent : w.lineSold}</span>
                    <span className="font-semibold tabular-nums">{qtyText(doc.quantity, doc.currency)}</span>
                    {onRemove && (<button type="button" aria-label={w.remove} title={w.remove} onClick={() => { setRemoveError(''); setToRemove({ doc, state }); }} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-neutral-400 hover:bg-surface hover:text-financial-loss focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                        <Trash2Icon className="h-4 w-4"/>
                      </button>)}
                  </li>))}
              </ul>
            </details>
        </div>))}
      <div className="border-t border-border px-3 py-1">
        {oldOpen ? <div className="-mx-3 -mb-1">{oldForm}</div> : <button type="button" onClick={() => setOldOpen(true)} className="min-h-touch text-start text-xs font-semibold text-primary">{w.addMore}</button>}
      </div>
      {removeError && <p role="alert" className="px-3 pb-2 text-xs font-semibold text-financial-loss">{removeError}</p>}
      <ConfirmDialog isOpen={!!toRemove} onClose={() => setToRemove(null)} variant="danger" title={w.removeTitle}
        description={toRemove ? w.removeBody(`${toRemove.doc.kind === 'delivery' ? w.lineSent : w.lineSold} ${qtyText(toRemove.doc.quantity, toRemove.doc.currency)}`) : ''}
        confirmLabel={w.remove} cancelLabel={w.cancel}
        onConfirm={() => {
            if (toRemove && onRemove) {
                if (canRemove(toRemove.state, toRemove.doc))
                    onRemove(toRemove.doc.id);
                else
                    setRemoveError(w.cannotRemove);
            }
            setToRemove(null);
        }}/>
    </div>);
}
