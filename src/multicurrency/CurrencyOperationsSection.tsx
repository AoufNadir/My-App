import { Fragment, useMemo, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Button } from '../components/ui/Button';
import { FormCard } from '../components/ui/FormCard';
import { Modal, ModalContent, ModalHeader, ModalTitle } from '../components/ui/Modal';
import type { TreasuryTx, Tx } from '../types';
import { computePamLedger } from '../utils/pamLedger';
import { computeAccountBalances } from './accountBalances';
import { checkCurrencyOperation, currencyOperationRows, type CurrencyOperation } from './currencyOperations';
import { useBusinessSettings } from './useBusinessSettings';

// M4: the currencies added in the settings (other than USDT and EUR, which keep their own window), their stock and
// PAM, and three actions: buy, sell, convert. On the treasury page as a card, and from « Nouvelle opération » as a window.

const W = {
    fr: {
        title: 'Autres devises', hint: 'Stock et prix moyen de chaque devise ajoutée. La conversion ne fait aucun bénéfice : le coût passe à la nouvelle devise.',
        buy: 'Acheter', sell: 'Vendre', convert: 'Convertir', quantity: 'Quantité', price: 'Prix unitaire', account: 'Compte', from: 'De', to: 'Vers', received: 'Quantité reçue',
        save: 'Enregistrer', cancel: 'Annuler', avg: 'Prix moyen', total: 'Total', implied: 'Taux', stock: 'Stock',
        errors: { quantity: 'Écrivez la quantité.', price: 'Écrivez le prix.', same_currency: 'Choisissez deux devises différentes.', stock: 'Stock insuffisant.', account: 'Solde du compte insuffisant.' },
    },
    ar: {
        title: 'عملات أخرى', hint: 'مخزون ومتوسط سعر كل عملة أضفتها. التحويل بلا ربح: تنتقل التكلفة إلى العملة الجديدة.',
        buy: 'شراء', sell: 'بيع', convert: 'تحويل', quantity: 'الكمية', price: 'سعر الوحدة', account: 'الحساب', from: 'من', to: 'إلى', received: 'الكمية المستلمة',
        save: 'حفظ', cancel: 'إلغاء', avg: 'متوسط السعر', total: 'المجموع', implied: 'السعر', stock: 'المخزون',
        errors: { quantity: 'اكتب الكمية.', price: 'اكتب السعر.', same_currency: 'اختر عملتين مختلفتين.', stock: 'المخزون لا يكفي.', account: 'رصيد الحساب لا يكفي.' },
    },
};
const field = 'min-h-input w-full rounded-button border border-border bg-surface px-3 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary/40';
const num = (value: string) => Number(value.replace(/\s/g, '').replace(',', '.'));
export const LEGACY_TRADED = new Set(['USDT', 'EUR']);
const n = (value: number, digits = 2) => value.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });

type Batch = { set: (ref: unknown, data: Record<string, unknown>) => void; commit: () => Promise<unknown> };
export type CurrencyUserDocRef = Parameters<typeof useBusinessSettings>[0] & { firestore?: { batch: () => Batch }; collection: (name: string) => { doc: (id?: string) => { id: string } } };
type Data = { userDocRef: CurrencyUserDocRef | null | undefined; transactions: ReadonlyArray<Tx>; treasuryTransactions: ReadonlyArray<TreasuryTx>; setAlert?: (message: string) => void };
export type CurrencyAction = { kind: 'buy' | 'sell' | 'convert'; currency: string };

function useCurrencyData({ userDocRef, transactions, treasuryTransactions }: Data) {
    const business = useBusinessSettings(userDocRef);
    const extra = business.settings.currencies.filter((code) => !LEGACY_TRADED.has(code));
    const ledger = useMemo(() => computePamLedger([...transactions], { currencies: extra }), [transactions, extra.join(',')]);
    const balances = useMemo(() => computeAccountBalances(treasuryTransactions, business.accounts).byAccount, [treasuryTransactions, business.accounts]);
    return { business, extra, ledger, balances };
}

function CurrencyOperationForm({ action, data, onDone }: { action: CurrencyAction; data: Data; onDone: () => void }) {
    const { lang } = useLanguage();
    const w = W[lang];
    const { business, ledger, balances } = useCurrencyData(data);
    const all = business.settings.currencies;
    const base = business.settings.baseCurrency;
    const [form, setForm] = useState({ quantity: '', price: '', accountId: business.accounts[0]?.id ?? 'Caisse', from: action.currency, to: all.find((c) => c !== action.currency) ?? '', toQuantity: '' });
    const [error, setError] = useState('');
    const stock = Object.fromEntries(Object.keys(ledger.holdings).map((code) => [code, ledger.holdings[code].available]));
    const kind = action.kind;
    const op: CurrencyOperation = kind === 'convert'
        ? { kind, from: form.from, fromQuantity: num(form.quantity), to: form.to, toQuantity: num(form.toQuantity) }
        : { kind, currency: action.currency, quantity: num(form.quantity), price: num(form.price), accountId: form.accountId };
    const save = () => {
        const ref = data.userDocRef;
        if (!ref?.firestore) return;
        const check = checkCurrencyOperation(op, stock, balances);
        if (check.ok === false) {
            setError(w.errors[check.reason]);
            return;
        }
        const mainRef = ref.collection('usdt_txs').doc();
        const rows = currencyOperationRows(op, Date.now(), mainRef.id);
        const batch = ref.firestore.batch();
        batch.set(mainRef, rows.main);
        batch.set(ref.collection(rows.linked.collection).doc(), rows.linked.data);
        batch.commit().catch(() => data.setAlert?.('❌ Erreur lors de la sauvegarde.'));
        onDone();
    };
    const total = op.kind !== 'convert' && op.quantity > 0 && op.price > 0 ? op.quantity * op.price : 0;
    const rate = op.kind === 'convert' && op.fromQuantity > 0 && op.toQuantity > 0 ? op.toQuantity / op.fromQuantity : 0;
    const held = (code: string) => `${w.stock}: ${n(stock[code] ?? 0)} ${code}`;
    return (<div className="space-y-2">
      {kind === 'convert' ? (<>
          <div className="grid grid-cols-2 gap-2">
            <select value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} aria-label={w.from} className={field}>{all.map((c) => <option key={c} value={c}>{w.from} {c}</option>)}</select>
            <select value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} aria-label={w.to} className={field}>{all.map((c) => <option key={c} value={c}>{w.to} {c}</option>)}</select>
          </div>
          <p className="text-xs text-neutral-500"><bdi dir="ltr">{held(form.from)}</bdi></p>
          <input inputMode="decimal" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} placeholder={`${w.quantity} (${form.from})`} aria-label={w.quantity} dir="ltr" className={field}/>
          <input inputMode="decimal" value={form.toQuantity} onChange={(e) => setForm({ ...form, toQuantity: e.target.value })} placeholder={`${w.received} (${form.to})`} aria-label={w.received} dir="ltr" className={field}/>
          {rate > 0 && <p className="text-xs text-neutral-600">{w.implied}: <bdi dir="ltr">1 {form.from} = {n(rate, 4)} {form.to}</bdi></p>}
        </>) : (<>
          <p className="text-xs text-neutral-500"><bdi dir="ltr">{held(action.currency)}</bdi> · {w.avg}: <bdi dir="ltr">{n(ledger.holdings[action.currency]?.avgBuy ?? 0)} {base}</bdi></p>
          <input inputMode="decimal" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} placeholder={`${w.quantity} (${action.currency})`} aria-label={w.quantity} dir="ltr" className={field}/>
          <input inputMode="decimal" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder={`${w.price} (${base})`} aria-label={w.price} dir="ltr" className={field}/>
          <select value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })} aria-label={w.account} className={field}>{business.accounts.map((a) => <option key={a.id} value={a.id}>{w.account}: {a.name} ({n(balances[a.id] ?? 0)} {base})</option>)}</select>
          {total > 0 && <p className="text-xs text-neutral-600">{w.total}: <bdi dir="ltr">{n(total)} {base}</bdi></p>}
        </>)}
      {error && <p role="alert" className="text-xs font-semibold text-financial-loss">{error}</p>}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <Button type="button" variant="ghost" size="md" onClick={onDone}>{w.cancel}</Button>
        <Button type="button" size="md" className="font-bold" onClick={save}>{w.save}</Button>
      </div>
    </div>);
}

/** The window opened from « Nouvelle opération ». */
export function CurrencyOperationDialog({ action, onClose, ...data }: Data & { action: CurrencyAction | null; onClose: () => void }) {
    const { lang } = useLanguage();
    const w = W[lang];
    return (<Modal isOpen={!!action} onClose={onClose} className="max-w-md bg-surface">
      <ModalHeader onClose={onClose}>
        <ModalTitle className="text-base sm:text-lg">{action ? (action.kind === 'convert' ? w.convert : `${w[action.kind]} ${action.currency}`) : ''}</ModalTitle>
      </ModalHeader>
      <ModalContent className="px-4 py-4 sm:px-5">
        {action && <Fragment key={`${action.kind}-${action.currency}`}><CurrencyOperationForm action={action} data={data} onDone={onClose}/></Fragment>}
      </ModalContent>
    </Modal>);
}

/** The card on the treasury page. */
export function CurrencyOperationsSection(data: Data) {
    const { lang } = useLanguage();
    const w = W[lang];
    const { business, extra, ledger } = useCurrencyData(data);
    const [action, setAction] = useState<CurrencyAction | null>(null);
    if (!business.loaded || extra.length === 0)
        return null;
    const base = business.settings.baseCurrency;
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
                {(['buy', 'sell', 'convert'] as const).map((kind) => <Button key={kind} type="button" size="sm" variant="outline" onClick={() => setAction({ kind, currency: code })}>{w[kind]}</Button>)}
              </div>
            </li>);
        })}
      </ul>
      <CurrencyOperationDialog action={action} onClose={() => setAction(null)} {...data}/>
    </FormCard>);
}
