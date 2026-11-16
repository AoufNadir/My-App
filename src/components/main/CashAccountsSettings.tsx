import { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { FormCard } from '../ui/FormCard';
import { CASH_ACCOUNTS, accountActions, checkCashAccount, isAccountShown, type CashAccountKind } from '../../accounts/cashAccounts';
import { useAccountUsage } from '../../accounts/AccountUsageContext';
import { BanknotesIcon } from '../icons/BanknotesIcon';
import { LandmarkIcon } from '../icons/LandmarkIcon';
import { WalletIcon } from '../icons/WalletIcon';
import { Trash2Icon } from '../icons/Trash2Icon';
import { PlusIcon } from '../icons/PlusIcon';

const KIND_ICON = { cash: BanknotesIcon, bank: LandmarkIcon, mobile: WalletIcon } as const;
const kindOf = (account: { id: string; kind: CashAccountKind }): CashAccountKind => (account.id === 'Caisse' ? 'cash' : account.id === 'BaridiMob' ? 'mobile' : account.kind);
const money = (value: number) => `${Math.round(value).toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' ')} DZD`;

// V15-2 (owner): the places that hold dinars. The Caisse and BaridiMob are always there; the owner adds a bank
// account, CCP, another e-wallet or a second cash box. Saved on the user document; nothing is deleted.
const W = {
    fr: { title: 'Comptes en dinars', hint: 'Où sont vos dinars. Chaque compte a son solde, compte dans le capital et peut recevoir un virement interne.', builtIn: 'Toujours là', add: 'Ajouter un compte', name: 'Nom (ex. BNA, CCP, Banque)', kind: 'Type', kinds: { cash: 'Espèces', bank: 'Banque', mobile: 'Portefeuille' }, save: 'Ajouter', cancel: 'Annuler', shown: 'Affiché', hiddenLabel: 'Masqué', hide: 'Masquer', show: 'Afficher', remove: 'Supprimer', confirmRemove: 'Confirmer la suppression', notEmpty: 'Solde non nul : videz-le avant de le masquer.', lastShown: 'Gardez au moins un compte affiché.', usedKeep: 'Déjà utilisé : il peut être masqué, pas supprimé.', waiting: 'Synchronisation…', errors: { name: 'Écrivez un nom de 2 à 30 caractères.', taken: 'Ce nom existe déjà.', kind: 'Choisissez le type.' } },
    ar: { title: 'الحسابات بالدينار', hint: 'أين دنانيرك. لكل حساب رصيده، ويُحسب في رأس المال، ويقبل التحويل الداخلي.', builtIn: 'موجود دائماً', add: 'أضف حساباً', name: 'الاسم (مثل BNA أو CCP أو البنك)', kind: 'النوع', kinds: { cash: 'نقد', bank: 'بنك', mobile: 'محفظة إلكترونية' }, save: 'أضف', cancel: 'إلغاء', shown: 'ظاهر', hiddenLabel: 'مخفي', hide: 'إخفاء', show: 'إظهار', remove: 'حذف', confirmRemove: 'تأكيد الحذف', notEmpty: 'رصيده ليس صفراً: فرّغه قبل إخفائه.', lastShown: 'أبقِ حساباً واحداً ظاهراً على الأقل.', usedKeep: 'استُعمل من قبل: يمكن إخفاؤه لا حذفه.', waiting: 'جارٍ المزامنة…', errors: { name: 'اكتب اسماً من 2 إلى 30 حرفاً.', taken: 'هذا الاسم موجود.', kind: 'اختر النوع.' } },
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
    const accountUsage = useAccountUsage();
    const [removing, setRemoving] = useState<string | null>(null);
    const write = async (data: Record<string, unknown>) => {
        setSaving(true);
        try { await userDocRef?.set(data, { merge: true }); }
        catch (e) { console.error(e); setError(String((e as Error)?.message || e)); }
        finally { setSaving(false); }
    };
    // V15-4: hiding writes only the list of hidden ids; deleting removes an unused account from `customAccounts`.
    const saveHidden = (ids: string[]) => write({ hiddenAccounts: ids });
    const removeAccount = (id: string) => {
        setRemoving(null);
        const custom = CASH_ACCOUNTS.filter((a) => a.custom && a.id !== id).map(({ id: i, name: n, kind: k }) => ({ id: i, name: n, kind: k }));
        const hidden = CASH_ACCOUNTS.filter((a) => a.id !== id && !isAccountShown(a.id)).map((a) => a.id);
        return write({ customAccounts: custom, hiddenAccounts: hidden });
    };
    const reset = () => { setAdding(false); setName(''); setKind(''); setError(null); };
    return (<FormCard title={w.title}>
      <p className="text-xs text-neutral-600">{w.hint}</p>
      <ul className="space-y-2">
        {CASH_ACCOUNTS.map((account) => {
            const hidden = CASH_ACCOUNTS.filter((a) => !isAccountShown(a.id)).map((a) => a.id);
            const isHidden = hidden.includes(account.id);
            const usage = accountUsage.byId[account.id] ?? { balance: 0, used: true };
            const actions = accountActions(account.id, usage, hidden);
            const note = !accountUsage.ready ? w.waiting : !isHidden && !actions.canHide ? (Math.abs(usage.balance) >= 0.005 ? w.notEmpty : w.lastShown) : account.custom && !actions.canDelete && usage.used ? w.usedKeep : null;
            const Icon = KIND_ICON[kindOf(account)];
            const confirming = removing === account.id;
            return (<li key={account.id} className={`rounded-card border px-3 py-2.5 transition-colors ${isHidden ? 'border-dashed border-border bg-surface-muted' : 'border-border bg-surface'}`}>
              <div className="flex items-center gap-3">
                <span aria-hidden="true" className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${isHidden ? 'bg-surface text-neutral-400' : 'bg-primary/10 text-primary'}`}><Icon className="h-[18px] w-[18px]"/></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`truncate text-sm font-bold ${isHidden ? 'text-neutral-500' : 'text-neutral-900'}`}>{account.id === 'Caisse' ? (lang === 'ar' ? 'الصندوق' : 'Caisse') : account.name}</span>
                    {isHidden && <span className="shrink-0 rounded-full bg-neutral-200 px-2 py-0.5 text-[10px] font-semibold text-neutral-600">{w.hiddenLabel}</span>}
                  </div>
                  <span className="block text-xs text-neutral-500">{account.custom ? w.kinds[account.kind] : w.builtIn}{accountUsage.ready ? ` · ${money(usage.balance)}` : ''}</span>
                </div>
                {accountUsage.ready && (<div className="flex shrink-0 items-center gap-1.5">
                    {(isHidden || actions.canHide) && !confirming && (<button type="button" disabled={saving} onClick={() => saveHidden(isHidden ? hidden.filter((id) => id !== account.id) : [...hidden, account.id])} className="h-8 rounded-full border border-border bg-surface px-3 text-xs font-semibold text-neutral-700 hover:bg-surface-muted disabled:opacity-60">{isHidden ? w.show : w.hide}</button>)}
                    {actions.canDelete && !confirming && (<button type="button" disabled={saving} aria-label={w.remove} title={w.remove} onClick={() => setRemoving(account.id)} className="flex h-8 w-8 items-center justify-center rounded-full text-financial-loss hover:bg-financial-loss/10 disabled:opacity-60"><Trash2Icon className="h-4 w-4"/></button>)}
                  </div>)}
              </div>
              {confirming && (<div className="mt-2 flex items-center justify-end gap-2 border-t border-border pt-2">
                  <button type="button" onClick={() => setRemoving(null)} className="h-8 rounded-full px-3 text-xs font-semibold text-neutral-600">{w.cancel}</button>
                  <button type="button" disabled={saving} onClick={() => removeAccount(account.id)} className="h-8 rounded-full bg-financial-loss px-3 text-xs font-bold text-white disabled:opacity-60">{w.confirmRemove}</button>
                </div>)}
              {note && <p className="mt-1.5 ps-12 text-[11px] leading-4 text-neutral-500">{note}</p>}
            </li>);
        })}
      </ul>
      {!adding ? (<button type="button" onClick={() => setAdding(true)} className="flex h-11 w-full items-center justify-center gap-2 rounded-card border border-dashed border-primary/60 text-sm font-bold text-primary hover:bg-primary/5"><PlusIcon className="h-4 w-4"/>{w.add}</button>) : (<div className="space-y-3 rounded-card border border-primary/30 bg-surface p-3 shadow-sm">
          <label className="block">
            <span className="block text-xs font-semibold text-neutral-700">{w.name}</span>
            <input value={name} onChange={(event) => setName(event.target.value)} autoFocus className="mt-1 h-10 w-full rounded-button border border-border bg-surface px-3 text-sm text-neutral-900 focus:border-primary focus:outline-none"/>
          </label>
          <div>
            <span className="block text-xs font-semibold text-neutral-700">{w.kind}</span>
            <div className="mt-1 grid grid-cols-3 gap-2">
              {(['cash', 'bank', 'mobile'] as const).map((option) => {
                const KindIcon = KIND_ICON[option];
                return (<button key={option} type="button" aria-pressed={kind === option} onClick={() => setKind(option)} className={`flex flex-col items-center justify-center gap-1 rounded-button border whitespace-nowrap px-1 py-2 text-[11px] font-semibold leading-tight ${kind === option ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-surface text-neutral-600'}`}><KindIcon className="h-4 w-4"/>{w.kinds[option]}</button>);
              })}
            </div>
          </div>
          {error && <p role="alert" className="text-xs font-semibold text-financial-loss">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={reset} className="h-10 flex-1 rounded-button border border-border bg-surface text-sm font-semibold text-neutral-700">{w.cancel}</button>
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
            }} className="h-10 flex-1 rounded-button bg-primary text-sm font-bold text-white disabled:opacity-60">{w.save}</button>
          </div>
        </div>)}
    </FormCard>);
}
