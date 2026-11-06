import { useMemo, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Button } from '../components/ui/Button';
import { FormCard } from '../components/ui/FormCard';
import type { TreasuryTx, Tx } from '../types';
import { computePamLedger } from '../utils/pamLedger';
import { computeAccountBalances } from './accountBalances';
import { checkCurrencyOperation, currencyOperationRows, type CurrencyOperation } from './currencyOperations';
import { useBusinessSettings } from './useBusinessSettings';

// M4, on the treasury page: the currencies added in the settings (other than USDT and EUR, which keep their own
// window), their stock and PAM, and three actions: buy, sell, convert. Shown only when such a currency exists.

const W = {
    fr: {
        title: 'Autres devises', hint: 'Stock et prix moyen de chaque devise ajoutée. La conversion ne fait aucun bénéfice : le coût passe à la nouvelle devise.',
        buy: 'Acheter', sell: 'Vendre', convert: 'Convertir', quantity: 'Quantité', price: 'Prix unitaire', account: 'Compte', from: 'De', to: 'Vers', received: 'Quantité reçue',
        save: 'Enregistrer', cancel: 'Annuler', avg: 'Prix moyen', total: 'Total', implied: 'Taux',
        errors: { quantity: 'Écrivez la quantité.', price: 'Écrivez le prix.', same_currency: 'Choisissez deux devises différentes.', stock: 'Stock insuffisant.', account: 'Solde du compte insuffisant.' },
    },
    ar: {
        title: 'عملات أخرى', hint: 'مخزون ومتوسط سعر كل عملة أضفتها. التحويل بلا ربح: تنتقل التكلفة إلى العملة الجديدة.',
        buy: 'شراء', sell: 'بيع', convert: 'تحويل', quantity: 'الكمية', price: 'سعر الوحدة', account: 'الحساب', from: 'من', to: 'إلى', received: 'الكمية المستلمة',
        save: 'حفظ', cancel: 'إلغاء', avg: 'متوسط السعر', total: 'المجموع', implied: 'السعر',
        errors: { quantity: 'اكتب الكمية.', price: 'اكتب السعر.', same_currency: 'اختر عملتين مختلفتين.', stock: 'المخزون لا يكفي.', account: 'رصيد الحساب لا يكفي.' },
    },
};
const field = 'min-h-input w-full rounded-button border border-border bg-surface px-3 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary/40';
const num = (value: string) => Number(value.replace(/\s/g, '').replace(',', '.'));
const LEGACY = new Set(['USDT', 'EUR']);

type Batch = { set: (ref: unknown, data: Record<string, unknown>) => void; commit: () => Promise<unknown> };
type UserDocRefLike = Parameters<typeof useBusinessSettings>[0] & { firestore?: { batch: () => Batch }; collection: (name: string) => { doc: (id?: string) => { id: string } } };

export function CurrencyOperationsSection({ userDocRef, transactions, treasuryTransactions, setAlert }: { userDocRef: UserDocRefLike | null | undefined; transactions: ReadonlyArray<Tx>; treasuryTransactions: ReadonlyArray<TreasuryTx>; setAlert?: (message: string) => void }) {
    const { lang } = useLanguage();
    const w = W[lang];
    const business = useBusinessSettings(userDocRef);
    const extra = business.settings.currencies.filter((code) => !LEGACY.has(code));
    const all = business.settings.currencies;
    const base = business.settings.baseCurrency;
    const ledger = useMemo(() => computePamLedger([...transactions], { currencies: extra }), [transactions, extra.join(',')]);
    const balances = useMemo(() => computeAccountBalances(treasuryTransactions, business.accounts).byAccount, [treasuryTransactions, business.accounts]);
    const [kind, setKind] = useState<null | 'buy' | 'sell' | 'convert'>(null);
    const [form, setForm] = useState({ currency: '', quantity: '', price: '', accountId: 'Caisse', from: '', to: '', toQuantity: '' });
    const [error, setError] = useState('');
    if (!business.loaded || extra.length === 0)
        return null;
    const n = (value: number, digits = 2) => value.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
    const stock = Object.fromEntries(Object.keys(ledger.holdings).map((code) => [code, ledger.holdings[code].available]));
    const open = (next: 'buy' | 'sell' | 'convert', currency: string) => {
        setKind(next);
        setError('');
        setForm({ currency, quantity: '', price: '', accountId: business.accounts[0]?.id ?? 'Caisse', from: currency, to: all.find((c) => c !== currency) ?? '', toQuantity: '' });
    };
    const op: CurrencyOperation | null = kind === 'convert'
        ? { kind, from: form.from, fromQuantity: num(form.quantity), to: form.to, toQuantity: num(form.toQuantity) }
        : kind ? { kind, currency: form.currency, quantity: num(form.quantity), price: num(form.price), accountId: form.accountId } : null;
    const save = () => {
        if (!op || !userDocRef?.firestore) return;
        const check = checkCurrencyOperation(op, stock, balances);
        if (check.ok === false) {
            setError(w.errors[check.reason]);
            return;
        }
        const mainRef = userDocRef.collection('usdt_txs').doc();
        const rows = currencyOperationRows(op, Date.now(), mainRef.id);
        const batch = userDocRef.firestore.batch();
        batch.set(mainRef, rows.main);
        batch.set(userDocRef.collection(rows.linked.collection).doc(), rows.linked.data);
        batch.commit().catch(() => setAlert?.('❌ Erreur lors de la sauvegarde.'));
        setKind(null);
    };
    const total = op && op.kind !== 'convert' && op.quantity > 0 && op.price > 0 ? op.quantity * op.price : 0;
    const rate = op && op.kind === 'convert' && op.fromQuantity > 0 && op.toQuantity > 0 ? op.toQuantity / op.fromQuantity : 0;
    return (<FormCard title={w.title} description={w.hint}>
      <ul className="space-y-1.5">
        {extra.map((code) => {
            const h = ledger.holdings[code];
            return (<li key={code} className="rounded-button bg-surface-muted px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="flex-1 text-sm font-bold text-neutral-900">{code}</span>
                <bdi dir="ltr" className="text-sm font-bold tabular-nums">{n(h?.available ?? 0)} {code}</bdi>
              </div>
              <p className="text-xs text-neutral-500">{w.avg}: <bdi dir="ltr">{n(h?.avgBuy ?? 0)} {base}</bdi></p>
              <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                <Button type="button" size="sm" variant="outline" onClick={() => open('buy', code)}>{w.buy}</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => open('sell', code)}>{w.sell}</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => open('convert', code)}>{w.convert}</Button>
              </div>
            </li>);
        })}
      </ul>
      {kind && (<div className="space-y-2 rounded-button border border-border p-3">
          <p className="text-sm font-bold text-neutral-900">{w[kind]} {kind === 'convert' ? '' : form.currency}</p>
          {kind === 'convert' ? (<>
              <div className="grid grid-cols-2 gap-2">
                <select value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} aria-label={w.from} className={field}>{all.map((c) => <option key={c} value={c}>{w.from} {c}</option>)}</select>
                <select value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} aria-label={w.to} className={field}>{all.map((c) => <option key={c} value={c}>{w.to} {c}</option>)}</select>
              </div>
              <input inputMode="decimal" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} placeholder={`${w.quantity} (${form.from})`} aria-label={w.quantity} dir="ltr" className={field}/>
              <input inputMode="decimal" value={form.toQuantity} onChange={(e) => setForm({ ...form, toQuantity: e.target.value })} placeholder={`${w.received} (${form.to})`} aria-label={w.received} dir="ltr" className={field}/>
              {rate > 0 && <p className="text-xs text-neutral-600">{w.implied}: <bdi dir="ltr">1 {form.from} = {n(rate, 4)} {form.to}</bdi></p>}
            </>) : (<>
              <input inputMode="decimal" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} placeholder={w.quantity} aria-label={w.quantity} dir="ltr" className={field}/>
              <input inputMode="decimal" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder={`${w.price} (${base})`} aria-label={w.price} dir="ltr" className={field}/>
              <select value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })} aria-label={w.account} className={field}>{business.accounts.map((a) => <option key={a.id} value={a.id}>{w.account}: {a.name}</option>)}</select>
              {total > 0 && <p className="text-xs text-neutral-600">{w.total}: <bdi dir="ltr">{n(total)} {base}</bdi></p>}
            </>)}
          {error && <p role="alert" className="text-xs font-semibold text-financial-loss">{error}</p>}
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="ghost" size="md" onClick={() => setKind(null)}>{w.cancel}</Button>
            <Button type="button" size="md" className="font-bold" onClick={save}>{w.save}</Button>
          </div>
        </div>)}
    </FormCard>);
}
