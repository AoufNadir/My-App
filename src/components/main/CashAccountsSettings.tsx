import { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { FormCard } from '../ui/FormCard';
import { CASH_ACCOUNTS, checkCashAccount, type CashAccountKind } from '../../accounts/cashAccounts';

// V15-2 (owner): the places that hold dinars. The Caisse and BaridiMob are always there; the owner adds a bank
// account, CCP, another e-wallet or a second cash box. Saved on the user document; nothing is deleted.
const W = {
    fr: { title: 'Comptes en dinars', hint: 'Où sont vos dinars. Chaque compte a son solde, compte dans le capital et peut recevoir un virement interne.', builtIn: 'Toujours là', add: 'Ajouter un compte', name: 'Nom (ex. BNA, CCP, Banque)', kind: 'Type', kinds: { cash: 'Espèces', bank: 'Banque', mobile: 'Portefeuille électronique' }, save: 'Ajouter', cancel: 'Annuler', errors: { name: 'Écrivez un nom de 2 à 30 caractères.', taken: 'Ce nom existe déjà.', kind: 'Choisissez le type.' } },
    ar: { title: 'الحسابات بالدينار', hint: 'أين دنانيرك. لكل حساب رصيده، ويُحسب في رأس المال، ويقبل التحويل الداخلي.', builtIn: 'موجود دائماً', add: 'أضف حساباً', name: 'الاسم (مثل BNA أو CCP أو البنك)', kind: 'النوع', kinds: { cash: 'نقد', bank: 'بنك', mobile: 'محفظة إلكترونية' }, save: 'أضف', cancel: 'إلغاء', errors: { name: 'اكتب اسماً من 2 إلى 30 حرفاً.', taken: 'هذا الاسم موجود.', kind: 'اختر النوع.' } },
};
type UserDocRefLike = { set: (data: Record<string, unknown>, options: { merge: boolean }) => Promise<unknown> } | null | undefined;

export function CashAccountsSettings({ userDocRef }: { userDocRef: UserDocRefLike }) {
    const { lang } = useLanguage();
    const w = W[lang];
    const [adding, setAdding] = useState(false);
    const [name, setName] = useState('');
    const [kind, setKind] = useState<CashAccountKind | ''>(''); // rule 11: nothing chosen in advance
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const reset = () => { setAdding(false); setName(''); setKind(''); setError(null); };
    return (<FormCard title={w.title}>
      <p className="text-xs text-neutral-600">{w.hint}</p>
      <ul className="space-y-1.5">
        {CASH_ACCOUNTS.map((account) => (<li key={account.id} className="flex items-center justify-between rounded-card border border-border bg-surface px-3 py-2.5">
            <span className="text-sm font-bold text-neutral-900">{account.id === 'Caisse' ? (lang === 'ar' ? 'الصندوق' : 'Caisse') : account.name}</span>
            <span className="text-xs text-neutral-600">{account.custom ? w.kinds[account.kind] : w.builtIn}</span>
          </li>))}
      </ul>
      {!adding ? (<button type="button" onClick={() => setAdding(true)} className="w-full rounded-card border border-dashed border-primary px-3 py-3 text-sm font-bold text-primary">+ {w.add}</button>) : (<div className="space-y-2 rounded-card border border-border bg-surface-muted p-3">
          <label className="block">
            <span className="block text-xs font-semibold text-neutral-700">{w.name}</span>
            <input value={name} onChange={(event) => setName(event.target.value)} className="mt-1 h-11 w-full rounded-button border border-border bg-surface px-3 text-sm text-neutral-900"/>
          </label>
          <div>
            <span className="block text-xs font-semibold text-neutral-700">{w.kind}</span>
            <div className="mt-1 grid grid-cols-3 gap-2">
              {(['cash', 'bank', 'mobile'] as const).map((option) => (<button key={option} type="button" aria-pressed={kind === option} onClick={() => setKind(option)} className={`rounded-button border px-2 py-2 text-xs font-semibold ${kind === option ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-surface text-neutral-600'}`}>{w.kinds[option]}</button>))}
            </div>
          </div>
          {error && <p role="alert" className="text-xs font-semibold text-financial-loss">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={reset} className="h-11 flex-1 rounded-button border border-border bg-surface text-sm font-semibold text-neutral-700">{w.cancel}</button>
            <button type="button" disabled={saving} onClick={async () => {
                const check = checkCashAccount({ name, kind });
                if (check.ok === false) { setError(w.errors[check.reason]); return; }
                setSaving(true);
                try {
                    const custom = CASH_ACCOUNTS.filter((a) => a.custom).map(({ id, name: n, kind: k }) => ({ id, name: n, kind: k }));
                    await userDocRef?.set({ customAccounts: [...custom, { id: check.account.id, name: check.account.name, kind: check.account.kind }] }, { merge: true });
                    reset();
                }
                catch (e) { console.error(e); setError(String((e as Error)?.message || e)); }
                finally { setSaving(false); }
            }} className="h-11 flex-1 rounded-button bg-primary text-sm font-bold text-white disabled:opacity-60">{w.save}</button>
          </div>
        </div>)}
    </FormCard>);
}
