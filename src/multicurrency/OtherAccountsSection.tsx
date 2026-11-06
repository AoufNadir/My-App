import { useMemo, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Button } from '../components/ui/Button';
import { FormCard } from '../components/ui/FormCard';
import type { TreasuryTx } from '../types';
import { computeAccountBalances } from './accountBalances';
import { baseAccounts } from './businessSettings';
import { accountMovementRow, checkAccountMovement } from './accountMovements';
import { useBusinessSettings } from './useBusinessSettings';

// M3, on the treasury page: the accounts of the base currency created in the settings, their balances, their opening
// balance and the transfers between any two accounts. Shown only once an account other than the cash box and
// BaridiMob exists: a business made before M2 sees nothing new.

const W = {
    fr: {
        title: 'Mes comptes', hint: 'Le solde de chaque compte, et les transferts entre eux (aucun bénéfice).',
        opening: 'Solde d’ouverture', transfer: 'Transfert entre comptes', from: 'De', to: 'Vers', amount: 'Montant', save: 'Enregistrer', cancel: 'Annuler',
        errors: { amount: 'Écrivez un montant.', same_account: 'Choisissez deux comptes différents.', insufficient: 'Solde insuffisant sur le compte de départ.' },
    },
    ar: {
        title: 'حساباتي', hint: 'رصيد كل حساب، والتحويل بينها (بلا ربح).',
        opening: 'رصيد افتتاحي', transfer: 'تحويل بين الحسابات', from: 'من', to: 'إلى', amount: 'المبلغ', save: 'حفظ', cancel: 'إلغاء',
        errors: { amount: 'اكتب المبلغ.', same_account: 'اختر حسابين مختلفين.', insufficient: 'الرصيد لا يكفي في الحساب المحوَّل منه.' },
    },
};
const field = 'min-h-input w-full rounded-button border border-border bg-surface px-3 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary/40';

type UserDocRefLike = Parameters<typeof useBusinessSettings>[0] & { collection: (name: string) => { doc: (id?: string) => { set: (data: Record<string, unknown>) => Promise<unknown> } } };

export function OtherAccountsSection({ userDocRef, treasuryTransactions, baseCurrency = 'DZD', setAlert }: { userDocRef: UserDocRefLike | null | undefined; treasuryTransactions: ReadonlyArray<TreasuryTx>; baseCurrency?: string; setAlert?: (message: string) => void }) {
    const { lang } = useLanguage();
    const w = W[lang];
    const business = useBusinessSettings(userDocRef);
    const balances = useMemo(() => computeAccountBalances(treasuryTransactions, baseAccounts(business.accounts, business.settings.baseCurrency)).byAccount, [treasuryTransactions, business.accounts, business.settings.baseCurrency]);
    const [mode, setMode] = useState<null | { kind: 'opening'; accountId: string } | { kind: 'transfer' }>(null);
    const [form, setForm] = useState({ amount: '', from: 'Caisse', to: '' });
    const [error, setError] = useState('');
    const accounts = baseAccounts(business.accounts, business.settings.baseCurrency);
    if (!business.loaded || accounts.filter((a) => a.id !== 'Caisse' && a.id !== 'BaridiMob').length === 0)
        return null;
    const byId = new Map(accounts.map((a) => [a.id, a]));
    const n = (value: number) => value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const save = () => {
        const amount = Number(form.amount.replace(',', '.'));
        const input = mode?.kind === 'opening'
            ? { kind: 'opening' as const, account: byId.get(mode.accountId)!, amount }
            : { kind: 'transfer' as const, from: byId.get(form.from) ?? accounts[0], to: byId.get(form.to) ?? accounts[0], amount };
        const check = checkAccountMovement(input, balances);
        if (check.ok === false) {
            setError(w.errors[check.reason]);
            return;
        }
        userDocRef?.collection('treasury_txs').doc().set(accountMovementRow(input, Date.now()))
            .catch(() => setAlert?.('❌ Erreur lors de la sauvegarde.'));
        setMode(null);
        setForm({ amount: '', from: 'Caisse', to: '' });
        setError('');
    };
    return (<FormCard title={w.title} description={w.hint}>
      <ul className="space-y-1.5">
        {accounts.map((account) => (<li key={account.id} className="flex items-center gap-2 rounded-button bg-surface-muted px-3 py-2">
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-neutral-900">{account.name}</span>
            <bdi dir="ltr" className="shrink-0 text-sm font-bold tabular-nums">{n(balances[account.id] ?? 0)} {business.settings.baseCurrency}</bdi>
            {account.id !== 'Caisse' && account.id !== 'BaridiMob' && (<Button type="button" size="sm" variant="ghost" onClick={() => { setMode({ kind: 'opening', accountId: account.id }); setError(''); }}>{w.opening}</Button>)}
          </li>))}
      </ul>
      {!mode && <Button type="button" variant="outline" size="md" className="w-full" onClick={() => { setMode({ kind: 'transfer' }); setForm({ amount: '', from: accounts[0]?.id ?? '', to: accounts[1]?.id ?? '' }); setError(''); }}>{w.transfer}</Button>}
      {mode && (<div className="space-y-2 rounded-button border border-border p-3">
          <p className="text-sm font-bold text-neutral-900">{mode.kind === 'opening' ? `${w.opening} · ${byId.get(mode.accountId)?.name ?? ''}` : w.transfer}</p>
          {mode.kind === 'transfer' && (<div className="grid grid-cols-2 gap-2">
              <select value={form.from} onChange={(event) => setForm({ ...form, from: event.target.value })} aria-label={w.from} className={field}>{accounts.map((a) => <option key={a.id} value={a.id}>{w.from} {a.name}</option>)}</select>
              <select value={form.to} onChange={(event) => setForm({ ...form, to: event.target.value })} aria-label={w.to} className={field}>{accounts.map((a) => <option key={a.id} value={a.id}>{w.to} {a.name}</option>)}</select>
            </div>)}
          <input inputMode="decimal" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder={w.amount} aria-label={w.amount} dir="ltr" className={field}/>
          {error && <p role="alert" className="text-xs font-semibold text-financial-loss">{error}</p>}
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="ghost" size="md" onClick={() => { setMode(null); setError(''); }}>{w.cancel}</Button>
            <Button type="button" size="md" className="font-bold" onClick={save}>{w.save}</Button>
          </div>
        </div>)}
    </FormCard>);
}
