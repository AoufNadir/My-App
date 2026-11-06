import { useMemo, useState } from 'react';
import { useLanguage, type Lang } from '../../contexts/LanguageContext';
import { Button } from '../ui/Button';
import { FormCard } from '../ui/FormCard';
import { formatNumber } from '../../pages/shared/pageFormat';
import { checkDelivery, deliveryStates, type ClientDeliveryState, type DeliveryCurrency, type DeliveryDoc } from '../../utils/deferredDelivery';
import { formatWaNumber, openWhatsAppChooser, openWhatsAppMessenger } from '../../utils/whatsapp';
import { clientReportLanguage } from '../reports/reportLanguage';

// V12-2, on the client's page: the USDT/EUR sold and not sent yet. « J'ai livré » records what was sent, never more
// than what is left; a WhatsApp message then tells the client what he received, in total, and what is left.

const W = {
    fr: {
        title: 'À livrer au client', hint: 'Vendu au prix du jour, envoyé plus tard. Rien ici ne change un solde.',
        sold: 'Vendu', delivered: 'Livré', left: 'Reste à livrer', qty: 'Quantité envoyée', deliver: 'J’ai livré',
        tooMuch: (left: string) => `Il ne reste que ${left} à livrer.`, empty: 'Écrivez la quantité envoyée.',
        history: 'Livraisons', whatsapp: 'Prévenir sur WhatsApp', addOld: 'Ajouter un reste d’une ancienne vente',
        addOldHint: 'Pour une vente déjà enregistrée avant cette fonction : la quantité qui n’a pas encore été envoyée.', add: 'Ajouter',
        done: 'Tout est livré.',
    },
    ar: {
        title: 'لم يُسلَّم للعميل بعد', hint: 'بِيع بسعر يومه ويُرسَل لاحقاً. لا شيء هنا يغيّر أي رصيد.',
        sold: 'بِيع', delivered: 'سُلّم', left: 'الباقي', qty: 'الكمية المرسلة', deliver: 'سلّمت',
        tooMuch: (left: string) => `الباقي ${left} فقط.`, empty: 'اكتب الكمية المرسلة.',
        history: 'التسليمات', whatsapp: 'أخبره على واتساب', addOld: 'إضافة باقٍ من بيع قديم',
        addOldHint: 'لبيع سُجّل قبل هذه الميزة: الكمية التي لم تُرسل بعد.', add: 'إضافة',
        done: 'سُلّم كل شيء.',
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

export function ClientDeliveries({ clientId, clientName, phone, docs, saleIds, onRecord }: {
    clientId: string;
    clientName: string;
    phone?: string;
    docs: ReadonlyArray<DeliveryDoc>;
    saleIds: ReadonlySet<string>;
    onRecord: (kind: DeliveryDoc['kind'], clientId: string, currency: DeliveryCurrency, quantity: number) => void;
}) {
    const { lang } = useLanguage();
    const w = W[lang];
    const states = useMemo(() => deliveryStates(docs.filter((doc) => doc.clientId === clientId), saleIds), [docs, clientId, saleIds]);
    const [draft, setDraft] = useState<Record<string, string>>({});
    const [error, setError] = useState<Record<string, string>>({});
    const [lastSent, setLastSent] = useState<Record<string, number>>({});
    const [oldOpen, setOldOpen] = useState(false);
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

    // Nothing owed to this client: only the small link that adds a rest from an old sale, no card.
    const oldForm = (<div className="space-y-2">
        <p className="text-xs text-neutral-500">{w.addOldHint}</p>
        <div className="flex gap-2">
          <input inputMode="decimal" value={old.qty} onChange={(event) => setOld({ ...old, qty: event.target.value })} placeholder={w.left} aria-label={w.left} dir="ltr" className={field}/>
          <select value={old.currency} onChange={(event) => setOld({ ...old, currency: event.target.value as DeliveryCurrency })} aria-label={w.left} className={`${field} w-24 shrink-0`}>
            <option value="USDT">USDT</option><option value="EUR">EUR</option>
          </select>
          <Button type="button" variant="outline" size="md" className="shrink-0" onClick={() => {
            const quantity = Number(old.qty.replace(',', '.'));
            if (quantity > 0) {
                onRecord('commitment', clientId, old.currency, quantity);
                setOld({ qty: '', currency: old.currency });
                setOldOpen(false);
            }
        }}>{w.add}</Button>
        </div>
      </div>);
    if (states.length === 0)
        return oldOpen ? <FormCard title={w.title}>{oldForm}</FormCard> : <button type="button" onClick={() => setOldOpen(true)} className="min-h-touch px-1 text-start text-xs font-semibold text-primary">+ {w.addOld}</button>;
    return (<FormCard title={w.title} description={states.length ? w.hint : undefined}>
      {states.map((state) => (<div key={state.currency} className="space-y-2 rounded-button bg-surface-muted p-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            {[[w.sold, state.committed], [w.delivered, state.delivered], [w.left, state.remaining]].map(([label, value], i) => (<div key={i}>
                <p className="text-xs font-semibold text-neutral-500">{label as string}</p>
                <p className={`text-sm font-bold tabular-nums ${i === 2 && (value as number) > 0 ? 'text-financial-debt' : 'text-neutral-900'}`}>{qtyText(value as number, state.currency)}</p>
              </div>))}
          </div>
          {state.remaining > 0
                ? (<div className="flex gap-2">
                    <input inputMode="decimal" value={draft[state.currency] ?? ''} onChange={(event) => setDraft({ ...draft, [state.currency]: event.target.value })} placeholder={w.qty} aria-label={w.qty} dir="ltr" className={field}/>
                    <Button type="button" size="md" className="shrink-0 font-bold" onClick={() => deliver(state)}>{w.deliver}</Button>
                  </div>)
                : <p className="text-sm font-semibold text-financial-profit">✓ {w.done}</p>}
          {error[state.currency] && <p role="alert" className="text-xs font-semibold text-financial-loss">{error[state.currency]}</p>}
          {lastSent[state.currency] !== undefined && <Button type="button" variant="outline" size="sm" onClick={() => tell(state)}>{w.whatsapp}</Button>}
          {state.deliveries.length > 0 && (<details>
              <summary className="cursor-pointer text-xs font-semibold text-neutral-600">{w.history} ({state.deliveries.length})</summary>
              <ul className="mt-1 space-y-0.5 text-xs text-neutral-600">
                {state.deliveries.map((doc) => <li key={doc.id} className="flex justify-between"><span>{new Date(doc.timestamp).toLocaleDateString('fr-FR')}</span><span className="tabular-nums">{qtyText(doc.quantity, doc.currency)}</span></li>)}
              </ul>
            </details>)}
        </div>))}
      {!oldOpen
            ? <button type="button" onClick={() => setOldOpen(true)} className="min-h-touch text-start text-xs font-semibold text-primary">+ {w.addOld}</button>
            : oldForm}
    </FormCard>);
}
