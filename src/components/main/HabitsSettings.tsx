import { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useSubscriptions } from '../../hooks/useSubscriptions';
import type { SubscriptionWallet } from '../../utils/habits';
import { Button } from '../ui/Button';
import { FormCard } from '../ui/FormCard';
import { Trash2Icon } from '../icons/Trash2Icon';

// V12-13, in the settings window: the recurring subscriptions and the monthly budget of small expenses.
// Nothing here records money: a subscription reminds on its day, the budget only shows how much was spent.

export const SMALL_BUDGET_KEY = 'app_small_expense_budget';
export function readSmallBudget(): number {
    try {
        const value = Number(localStorage.getItem(SMALL_BUDGET_KEY));
        return Number.isFinite(value) && value > 0 ? value : 0;
    }
    catch {
        return 0;
    }
}

const W = {
    fr: {
        title: 'Habitudes contre les oublis', hint: 'Les abonnements vous sont rappelés le jour venu ; rien n’est enregistré sans votre accord.',
        subs: 'Abonnements mensuels', name: 'Nom (ex. ChatGPT)', amount: 'Montant', day: 'Jour du mois', add: 'Ajouter', none: 'Aucun abonnement.', remove: 'Supprimer',
        budget: 'Budget mensuel des petites dépenses (DZD)', budgetHint: 'Dépenses personnelles de 5 000 DZD au plus. Laissez vide pour ne rien afficher.', save: 'Enregistrer', saved: 'Enregistré',
    },
    ar: {
        title: 'عادات ضد النسيان', hint: 'تُذكَّر بالاشتراكات في يومها، ولا يُسجَّل شيء دون موافقتك.',
        subs: 'الاشتراكات الشهرية', name: 'الاسم (مثلاً ChatGPT)', amount: 'المبلغ', day: 'يوم الشهر', add: 'إضافة', none: 'لا اشتراكات.', remove: 'حذف',
        budget: 'حدّ المصاريف الصغيرة الشهري (DZD)', budgetHint: 'المصاريف الشخصية التي لا تتجاوز 5 000 DZD. اتركه فارغاً لإخفائه.', save: 'حفظ', saved: 'حُفظ',
    },
};
const WALLETS: SubscriptionWallet[] = ['Caisse', 'BaridiMob', 'USDT', 'EUR'];
const field = 'min-h-input w-full rounded-button border border-border bg-surface px-3 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary/40';

export function HabitsSettings({ userDocRef }: { userDocRef: Parameters<typeof useSubscriptions>[0] }) {
    const { lang } = useLanguage();
    const w = W[lang];
    const { subscriptions, add, remove } = useSubscriptions(userDocRef, Boolean(userDocRef));
    const [draft, setDraft] = useState({ name: '', amount: '', wallet: 'USDT' as SubscriptionWallet, day: '1' });
    const [budget, setBudget] = useState(() => (readSmallBudget() ? String(readSmallBudget()) : ''));
    const [saved, setSaved] = useState(false);
    const amount = Number(draft.amount.replace(',', '.'));
    const day = Math.round(Number(draft.day));
    const canAdd = draft.name.trim().length >= 2 && amount > 0 && day >= 1 && day <= 28;
    return (<FormCard title={w.title} description={w.hint}>
      <div className="space-y-2">
        <p className="text-sm font-semibold text-neutral-700">{w.subs}</p>
        {subscriptions.length === 0 && <p className="text-xs text-neutral-500">{w.none}</p>}
        <ul className="space-y-1.5">
          {subscriptions.map((sub) => (<li key={sub.id} className="flex items-center gap-2 rounded-button bg-surface-muted px-3 py-1.5 text-sm">
              <span className="min-w-0 flex-1 truncate font-semibold text-neutral-800">{sub.name}</span>
              <bdi dir="ltr" className="shrink-0 tabular-nums text-neutral-700">{sub.amount} {sub.wallet === 'Caisse' || sub.wallet === 'BaridiMob' ? 'DZD' : sub.wallet}</bdi>
              <span className="shrink-0 text-xs text-neutral-500">{sub.wallet} · J{sub.day}</span>
              <button type="button" aria-label={w.remove} onClick={() => remove(sub.id)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-neutral-400 hover:text-financial-loss"><Trash2Icon className="h-4 w-4"/></button>
            </li>))}
        </ul>
        <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder={w.name} aria-label={w.name} className={field}/>
        <div className="grid grid-cols-3 gap-2">
          <input inputMode="decimal" value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} placeholder={w.amount} aria-label={w.amount} dir="ltr" className={field}/>
          <select value={draft.wallet} onChange={(event) => setDraft({ ...draft, wallet: event.target.value as SubscriptionWallet })} aria-label={w.amount} className={field}>
            {WALLETS.map((wallet) => <option key={wallet} value={wallet}>{wallet}</option>)}
          </select>
          <input inputMode="numeric" value={draft.day} onChange={(event) => setDraft({ ...draft, day: event.target.value })} placeholder={w.day} aria-label={w.day} dir="ltr" className={field}/>
        </div>
        <Button type="button" variant="outline" size="md" className="w-full" disabled={!canAdd} onClick={() => { add({ name: draft.name, amount, wallet: draft.wallet, day }); setDraft({ ...draft, name: '', amount: '' }); }}>+ {w.add}</Button>
      </div>
      <div className="space-y-2 border-t border-border pt-3">
        <p className="text-sm font-semibold text-neutral-700">{w.budget}</p>
        <div className="flex gap-2">
          <input inputMode="numeric" value={budget} onChange={(event) => { setBudget(event.target.value); setSaved(false); }} placeholder="10000" aria-label={w.budget} dir="ltr" className={field}/>
          <Button type="button" variant="outline" size="md" className="shrink-0" onClick={() => {
            try {
                const value = Number(budget);
                if (value > 0) localStorage.setItem(SMALL_BUDGET_KEY, String(Math.round(value)));
                else localStorage.removeItem(SMALL_BUDGET_KEY);
            }
            catch { /* storage unavailable */ }
            setSaved(true);
        }}>{saved ? `✓ ${w.saved}` : w.save}</Button>
        </div>
        <p className="text-xs text-neutral-500">{w.budgetHint}</p>
      </div>
    </FormCard>);
}
