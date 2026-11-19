import { Fragment } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useEditLog } from '../../hooks/useEditLog';
import { EDIT_LOG_FIELDS, moneyChange, type EditLogEntry } from '../../utils/editLog';

// V17-3: the edit log in the settings: every change or delete of a money line, newest first, before → after.
// Read only: nothing here can change anything.

const fmt = (v: unknown) => (typeof v === 'number' ? (Math.round(v * 100) / 100).toLocaleString('fr-FR').replace(/ | /g, ' ') : String(v ?? '—'));
const when = (ts: number) => { const d = new Date(ts); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const W = {
    ar: {
        empty: 'لا تعديل ولا حذف مسجّل بعد. يبدأ السجل من الآن.',
        hint: 'كل تعديل أو حذف لعملية مالية يُحفظ هنا: ما كان قبله وما صار بعده.',
        edit: 'تعديل', del: 'حذف', before: 'قبل', after: 'بعد', amountWas: 'المبلغ',
        fields: { notes: 'الملاحظة', date: 'التاريخ', time: 'الساعة', source: 'المحفظة', destination: 'الوجهة', type: 'النوع', currency: 'العملة', payee: 'دُفع إلى', paymentMethod: 'طريقة الدفع', advanceState: 'حالة السلفة', settledAmount: 'المبلغ المسوّى', quantity: 'الكمية', price: 'السعر', sell: 'سعر البيع', total: 'المجموع', amount: 'المبلغ', montant: 'المبلغ', fullName: 'الاسم', initialCapital: 'رأس المال', percentage: 'النسبة' } as Record<string, string>,
        what: (e: EditLogEntry) => ({ usdt_txs: 'عملية', treasury_txs: e.before.origin === 'personal_expense' ? 'مصروف شخصي' : e.before.origin === 'delivery_expense' ? 'مصروف المشروع' : 'حركة خزينة', dzd_client_txs: 'سطر عميل', dzd_clients: 'عميل', investor_transactions: 'حركة مستثمر', investors: 'مستثمر', digital_service_txs: 'خدمة رقمية' } as Record<string, string>)[e.collection] ?? 'سطر',
    },
    fr: {
        empty: 'Aucune modification ni suppression enregistrée. Le journal commence maintenant.',
        hint: 'Chaque modification ou suppression d’une ligne d’argent est gardée ici : avant et après.',
        edit: 'Modifié', del: 'Supprimé', before: 'Avant', after: 'Après', amountWas: 'Montant',
        fields: { notes: 'Note', date: 'Date', time: 'Heure', source: 'Portefeuille', destination: 'Destination', type: 'Type', currency: 'Devise', payee: 'Payé à', paymentMethod: 'Paiement', advanceState: 'Avance', settledAmount: 'Montant régularisé', quantity: 'Quantité', price: 'Prix', sell: 'Prix de vente', total: 'Total', amount: 'Montant', montant: 'Montant', fullName: 'Nom', initialCapital: 'Capital', percentage: 'Pourcentage' } as Record<string, string>,
        what: (e: EditLogEntry) => ({ usdt_txs: 'Opération', treasury_txs: e.before.origin === 'personal_expense' ? 'Dépense perso' : e.before.origin === 'delivery_expense' ? 'Frais du projet' : 'Mouvement de trésorerie', dzd_client_txs: 'Ligne client', dzd_clients: 'Client', investor_transactions: 'Mouvement investisseur', investors: 'Investisseur', digital_service_txs: 'Service numérique' } as Record<string, string>)[e.collection] ?? 'Ligne',
    },
};

/** The fields that changed, other than the money one already shown. */
function otherChanges(e: EditLogEntry, skip: string | null) {
    if (!e.after) return [];
    // Ids, technical markers and the dinar copy of the amount are not shown: only what the owner typed.
    const hidden = new Set(['timestamp', 'amountDzd', 'origin', 'clientId', 'linkedClientId', 'investorId']);
    return EDIT_LOG_FIELDS.filter((k) => k !== skip && !hidden.has(k) && e.before[k] !== e.after![k]).map((k) => ({ k, from: e.before[k], to: e.after![k] }));
}

export function EditLogSettings({ userDocRef }: { userDocRef: unknown }) {
    const { lang } = useLanguage();
    const w = W[lang === 'ar' ? 'ar' : 'fr'];
    const entries = useEditLog(userDocRef as never, true).slice(0, 60);
    return (<div className="space-y-2" data-testid="edit-log">
      <p className="text-xs text-neutral-500">{w.hint}</p>
      {entries.length === 0 && <p className="text-sm text-neutral-500">{w.empty}</p>}
      {entries.map((e) => {
            const change = moneyChange(e);
            const others = otherChanges(e, change?.field ?? null);
            return (<Fragment key={e.id}>
              <div className="rounded-card border border-border bg-surface px-3 py-2 text-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-bold text-neutral-900">{e.kind === 'delete' ? '🗑 ' : '✏️ '}{e.kind === 'delete' ? w.del : w.edit} · {w.what(e)}</span>
                  <bdi dir="ltr" className="shrink-0 text-xs text-neutral-500">{when(Number(e.at))}</bdi>
                </div>
                {change && (<div className="mt-1 flex flex-wrap gap-x-3 text-neutral-700">
                    <span>{w.before}: <bdi dir="ltr" className="whitespace-nowrap tabular-nums">{fmt(change.from)}</bdi></span>
                    {e.kind !== 'delete' && <span>{w.after}: <bdi dir="ltr" className="whitespace-nowrap font-semibold tabular-nums">{fmt(change.to)}</bdi></span>}
                  </div>)}
                {others.length > 0 && (<div className="mt-1 text-xs text-neutral-500">
                    {others.map((o) => (<Fragment key={o.k}><div><span className="font-semibold">{w.fields[o.k] ?? o.k}</span> · {w.before}: <bdi dir="auto">{fmt(o.from)}</bdi> · {w.after}: <bdi dir="auto">{fmt(o.to)}</bdi></div></Fragment>))}
                  </div>)}
              </div>
            </Fragment>);
        })}
    </div>);
}
