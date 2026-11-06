import { Fragment, useMemo, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Button } from '../components/ui/Button';
import { FormCard } from '../components/ui/FormCard';
import { Modal, ModalContent, ModalHeader, ModalTitle } from '../components/ui/Modal';
import type { TreasuryTx, Tx } from '../types';
import { computePamLedger } from '../utils/pamLedger';
import { walletCurrency, type AccountKind } from './businessSettings';
import { CURRENCY_CATALOG, currencyLabel, searchCurrencies } from './currencyCatalog';
import { checkCurrencyOperation, conversionPam, currencyOperationRows, walletOpeningRow, type CurrencyOperation } from './currencyOperations';
import { useBusinessSettings, type BusinessSettingsState } from './useBusinessSettings';
import { computeWalletViews, type WalletView } from './walletBalances';

// « Mes portefeuilles »: every wallet with its currency and what it holds, grouped by currency, with the stock value
// in the base currency; adding a wallet (name, currency, what it holds now, what it cost); and the purchase / sale
// window for any currency, paid with (or paid into) any other wallet. Paid in another currency, it is a conversion:
// no profit, the cost carries over (EUR bought at 280 and spent on USD give the USD the EUR's cost).

const W = {
    fr: {
        title: 'Mes portefeuilles', hint: 'Chaque portefeuille avec sa devise et ce qu’il contient. La valeur est au prix moyen d’achat.',
        total: 'Valeur totale', avg: 'Prix moyen', value: 'Valeur', add: 'Ajouter un portefeuille', buy: 'Acheter', sell: 'Vendre',
        name: 'Nom (ex. Caisse, Binance, Wise)', currency: 'Devise', search: 'Chercher : euro, RMB, USDT…', more: 'Plus de devises', less: 'Moins',
        holds: 'Ce qu’il contient maintenant', cost: (base: string, code: string) => `Prix moyen d’achat de 1 ${code} (en ${base})`,
        costHint: 'Nécessaire pour calculer le capital et le bénéfice de la première vente.',
        newMoney: 'N’écrivez pas ici de l’argent déjà enregistré dans l’app : il serait compté deux fois.',
        kind: { cash: 'Espèces', bank: 'Banque', online: 'En ligne' } as Record<AccountKind, string>,
        save: 'Enregistrer', cancel: 'Annuler', quantity: (code: string) => `Quantité (${code})`, into: 'Dans le portefeuille', from: 'Depuis le portefeuille',
        payWith: 'Payé avec', receiveIn: 'Reçu dans', unitPrice: (base: string) => `Prix unitaire (${base})`, paid: (code: string) => `Montant payé (${code})`, received: (code: string) => `Montant reçu (${code})`,
        totalLine: 'Total', rate: 'Taux', newPam: (code: string) => `Prix moyen de ce ${code}`, conversionNote: 'Conversion : aucun bénéfice, le coût passe à la nouvelle devise.',
        noBase: (base: string) => `Ajoutez d’abord un portefeuille en ${base} (ex. Caisse).`, noOther: 'Ajoutez d’abord un autre portefeuille pour payer ou recevoir.',
        virtual: 'stock', errors: { quantity: 'Écrivez la quantité.', amount: 'Écrivez le montant.', same_currency: 'Choisissez un portefeuille d’une autre devise.', stock: 'Le portefeuille ne contient pas assez.', account: 'Le portefeuille de paiement ne contient pas assez.', name: 'Écrivez le nom.', cost: 'Écrivez le prix moyen d’achat.' },
    },
    ar: {
        title: 'محافظي', hint: 'كل محفظة بعملتها وما فيها. القيمة بمتوسط سعر الشراء.',
        total: 'القيمة الكلية', avg: 'متوسط السعر', value: 'القيمة', add: 'أضف محفظة', buy: 'شراء', sell: 'بيع',
        name: 'الاسم (مثل: الصندوق، Binance، Wise)', currency: 'العملة', search: 'ابحث: يورو، RMB، USDT…', more: 'عملات أخرى', less: 'أقل',
        holds: 'ما فيها الآن', cost: (base: string, code: string) => `بكم اشتريت 1 ${code} في المتوسط؟ (بـ ${base})`,
        costHint: 'ضروري ليحسب التطبيق رأس المال وربح أول بيع.',
        newMoney: 'لا تكتب هنا مالاً مسجّلاً في التطبيق من قبل، وإلا حُسب مرتين.',
        kind: { cash: 'نقد', bank: 'بنك', online: 'إلكتروني' } as Record<AccountKind, string>,
        save: 'حفظ', cancel: 'إلغاء', quantity: (code: string) => `الكمية (${code})`, into: 'إلى محفظة', from: 'من محفظة',
        payWith: 'دفعت من', receiveIn: 'استلمت في', unitPrice: (base: string) => `سعر الوحدة (${base})`, paid: (code: string) => `المبلغ المدفوع (${code})`, received: (code: string) => `المبلغ المستلم (${code})`,
        totalLine: 'المجموع', rate: 'سعر الصرف', newPam: (code: string) => `متوسط سعر هذا الـ ${code}`, conversionNote: 'تحويل: لا ربح فيه، والتكلفة تنتقل إلى العملة الجديدة.',
        noBase: (base: string) => `أضف أولاً محفظة بـ ${base} (مثل الصندوق).`, noOther: 'أضف أولاً محفظة أخرى تدفع منها أو تستلم فيها.',
        virtual: 'المخزون', errors: { quantity: 'اكتب الكمية.', amount: 'اكتب المبلغ.', same_currency: 'اختر محفظة بعملة أخرى.', stock: 'المحفظة لا تحتوي ما يكفي.', account: 'محفظة الدفع لا تحتوي ما يكفي.', name: 'اكتب الاسم.', cost: 'اكتب متوسط سعر الشراء.' },
    },
};
const field = 'min-h-input w-full rounded-button border border-border bg-surface px-3 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary/40';
const chip = (on: boolean) => `min-h-10 rounded-full border px-3 text-sm font-semibold ${on ? 'border-primary bg-primary text-white' : 'border-border-strong bg-surface text-neutral-700'}`;
const num = (value: string) => Number(value.replace(/\s/g, '').replace(',', '.'));
const n = (value: number, digits = 2) => value.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });

type Batch = { set: (ref: unknown, data: Record<string, unknown>) => void; commit: () => Promise<unknown> };
export type CurrencyUserDocRef = Parameters<typeof useBusinessSettings>[0] & { firestore?: { batch: () => Batch }; collection: (name: string) => { doc: (id?: string) => { id: string } } };
type Data = { userDocRef: CurrencyUserDocRef | null | undefined; transactions: ReadonlyArray<Tx>; treasuryTransactions: ReadonlyArray<TreasuryTx>; setAlert?: (message: string) => void };
export type CurrencyAction = { kind: 'buy' | 'sell'; currency: string };

function useWallets(data: Data, business: BusinessSettingsState) {
    const base = business.settings.baseCurrency;
    const traded = business.traded;
    const ledger = useMemo(() => computePamLedger([...data.transactions], { currencies: traded }), [data.transactions, traded]);
    const stock = useMemo(() => Object.fromEntries(Object.keys(ledger.holdings).map((code) => [code, ledger.holdings[code].available + (ledger.holdings[code].locked || 0)])), [ledger]);
    const views = useMemo(() => computeWalletViews({ accounts: business.accounts, base, traded, transactions: data.transactions, treasuryTransactions: data.treasuryTransactions, stock }), [business.accounts, base, traded, data.transactions, data.treasuryTransactions, stock]);
    const pam = (code: string) => (code === base ? 1 : ledger.holdings[code]?.avgBuy ?? 0);
    return { base, traded, ledger, views, pam };
}

const commitRows = (ref: CurrencyUserDocRef, rows: Array<{ collection: string; data: Record<string, unknown>; id?: { id: string } }>, setAlert?: (m: string) => void) => {
    if (!ref.firestore) return;
    const batch = ref.firestore.batch();
    for (const row of rows) batch.set(row.id ?? ref.collection(row.collection).doc(), row.data);
    batch.commit().catch(() => setAlert?.('❌ Erreur lors de la sauvegarde.'));
};

function OperationForm({ action, data, business, onDone }: { action: CurrencyAction; data: Data; business: BusinessSettingsState; onDone: () => void }) {
    const { lang } = useLanguage();
    const w = W[lang];
    const { base, views, pam } = useWallets(data, business);
    const own = views.filter((v) => v.currency === action.currency);
    const others = views.filter((v) => v.currency !== action.currency);
    const [form, setForm] = useState({ quantity: '', walletId: own[0]?.id ?? '', otherId: (others.find((v) => v.currency === base) ?? others[0])?.id ?? '', price: '', amount: '' });
    const [error, setError] = useState('');
    const other = others.find((v) => v.id === form.otherId);
    if (!other) return <p className="text-sm text-neutral-700">{business.walletsModel ? w.noBase(base) : w.noOther}</p>;
    const viaBase = other.currency === base;
    const quantity = num(form.quantity);
    const amount = viaBase ? Math.round(quantity * num(form.price) * 100) / 100 : num(form.amount);
    const balances = Object.fromEntries(views.map((v) => [v.id, v.balance]));
    const op: CurrencyOperation = { kind: action.kind, currency: action.currency, quantity, walletId: form.walletId, other: { walletId: other.id, currency: other.currency, amount } };
    const save = () => {
        const ref = data.userDocRef;
        if (!ref) return;
        const check = checkCurrencyOperation(op, balances);
        if (check.ok === false) {
            setError(w.errors[check.reason]);
            return;
        }
        const mainRef = ref.collection('usdt_txs').doc();
        const rows = currencyOperationRows(op, base, Date.now(), mainRef.id);
        commitRows(ref, [{ collection: 'usdt_txs', data: rows.main, id: mainRef }, rows.linked], data.setAlert);
        onDone();
    };
    const ok = quantity > 0 && amount > 0;
    // Conversion: what one unit of the currency that comes in will cost.
    const comingIn = action.kind === 'buy' ? { code: action.currency, pam: conversionPam(amount, pam(other.currency), quantity) } : { code: other.currency, pam: conversionPam(quantity, pam(action.currency), amount) };
    const walletOption = (v: WalletView) => <option key={v.id} value={v.id}>{v.virtual ? `${v.currency} (${w.virtual})` : v.name} · {n(v.balance)} {v.currency}</option>;
    return (<div className="space-y-2.5">
      <label className="block text-xs font-semibold text-neutral-600">{w.quantity(action.currency)}
        <input inputMode="decimal" value={form.quantity} onChange={(e) => { setForm({ ...form, quantity: e.target.value }); setError(''); }} placeholder="0" dir="ltr" className={`${field} mt-1`}/>
      </label>
      {own.length > 1 && (<label className="block text-xs font-semibold text-neutral-600">{action.kind === 'buy' ? w.into : w.from}
          <select value={form.walletId} onChange={(e) => setForm({ ...form, walletId: e.target.value })} className={`${field} mt-1`}>{own.map(walletOption)}</select>
        </label>)}
      {own.length === 1 && <p className="text-xs text-neutral-500">{action.kind === 'buy' ? w.into : w.from}: <b>{own[0].virtual ? action.currency : own[0].name}</b> · <bdi dir="ltr">{n(own[0].balance)} {action.currency}</bdi></p>}
      <label className="block text-xs font-semibold text-neutral-600">{action.kind === 'buy' ? w.payWith : w.receiveIn}
        <select value={form.otherId} onChange={(e) => { setForm({ ...form, otherId: e.target.value, amount: '' }); setError(''); }} className={`${field} mt-1`}>{others.map(walletOption)}</select>
      </label>
      <label className="block text-xs font-semibold text-neutral-600">{viaBase ? w.unitPrice(base) : action.kind === 'buy' ? w.paid(other.currency) : w.received(other.currency)}
        {viaBase
          ? <input inputMode="decimal" value={form.price} onChange={(e) => { setForm({ ...form, price: e.target.value }); setError(''); }} placeholder="0" dir="ltr" className={`${field} mt-1`}/>
          : <input inputMode="decimal" value={form.amount} onChange={(e) => { setForm({ ...form, amount: e.target.value }); setError(''); }} placeholder="0" dir="ltr" className={`${field} mt-1`}/>}
      </label>
      {ok && (<div className="space-y-0.5 rounded-button bg-surface-muted px-3 py-2 text-xs text-neutral-700">
          {viaBase
            ? <p>{w.totalLine}: <bdi dir="ltr"><b>{n(amount)} {base}</b></bdi></p>
            : (<>
                <p>{w.rate}: <bdi dir="ltr">1 {action.currency} = {n(amount / quantity, 4)} {other.currency}</bdi></p>
                <p className="ps-3"><bdi dir="ltr">1 {other.currency} = {n(quantity / amount, 4)} {action.currency}</bdi></p>
                <p>{w.newPam(comingIn.code)}: <bdi dir="ltr"><b>{n(comingIn.pam)} {base}</b></bdi></p>
                <p className="text-neutral-500">{w.conversionNote}</p>
              </>)}
        </div>)}
      {error && <p role="alert" className="text-xs font-semibold text-financial-loss">{error}</p>}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <Button type="button" variant="ghost" size="md" onClick={onDone}>{w.cancel}</Button>
        <Button type="button" size="md" className="font-bold" onClick={save}>{w.save}</Button>
      </div>
    </div>);
}

/** The purchase / sale window, from « Nouvelle opération » or from a wallet group. */
export function CurrencyOperationDialog({ action, onClose, business: given, ...data }: Data & { action: CurrencyAction | null; onClose: () => void; business?: BusinessSettingsState }) {
    const { lang } = useLanguage();
    const w = W[lang];
    const own = useBusinessSettings(given ? null : data.userDocRef);
    const business = given ?? own;
    return (<Modal isOpen={!!action} onClose={onClose} className="max-w-md bg-surface">
      <ModalHeader onClose={onClose}>
        <ModalTitle className="text-base sm:text-lg">{action ? `${w[action.kind]} ${action.currency}` : ''}</ModalTitle>
      </ModalHeader>
      <ModalContent className="px-4 py-4 sm:px-5">
        {action && business.loaded && <Fragment key={`${action.kind}-${action.currency}`}><OperationForm action={action} data={data} business={business} onDone={onClose}/></Fragment>}
      </ModalContent>
    </Modal>);
}

function AddWalletForm({ data, business, onDone }: { data: Data; business: BusinessSettingsState; onDone: () => void }) {
    const { lang } = useLanguage();
    const w = W[lang];
    const base = business.settings.baseCurrency;
    const [form, setForm] = useState({ name: '', currency: base, kind: 'cash' as AccountKind, quantity: '', cost: '', search: '', more: false });
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const found = form.search.trim() ? searchCurrencies(form.search) : CURRENCY_CATALOG.filter((c) => c.popular || form.more);
    const typed = form.search.trim().toUpperCase();
    const canTypeOther = /^[A-Z][A-Z0-9]{1,11}$/.test(typed) && !CURRENCY_CATALOG.some((c) => c.code === typed);
    const save = async () => {
        const quantity = form.quantity.trim() ? num(form.quantity) : 0;
        const cost = num(form.cost);
        if (!form.name.trim()) return setError(w.errors.name);
        if (!(quantity >= 0) || !Number.isFinite(quantity)) return setError(w.errors.quantity);
        if (quantity > 0 && form.currency !== base && !(cost > 0)) return setError(w.errors.cost);
        setSaving(true);
        try {
            const id = await business.addAccount(form.name, form.kind, form.currency);
            if (id && quantity > 0 && data.userDocRef) {
                const row = walletOpeningRow({ walletId: id, currency: form.currency, quantity, avgPrice: cost }, base, Date.now());
                commitRows(data.userDocRef, [row], data.setAlert);
            }
            onDone();
        }
        finally {
            setSaving(false);
        }
    };
    const pick = (code: string) => setForm({ ...form, currency: code, kind: code === base ? form.kind : 'online', search: '' });
    return (<div className="space-y-2.5 rounded-card border border-border bg-surface p-3">
      <input value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); setError(''); }} placeholder={w.name} aria-label={w.name} className={field}/>
      <p className="text-xs font-semibold text-neutral-600">{w.currency}: <b className="text-neutral-900">{currencyLabel(form.currency, lang)}</b></p>
      <input value={form.search} onChange={(e) => setForm({ ...form, search: e.target.value })} placeholder={w.search} aria-label={w.search} className={field}/>
      <div className="flex flex-wrap gap-1.5">
        {found.map((c) => <button key={c.code} type="button" aria-pressed={form.currency === c.code} onClick={() => pick(c.code)} className={chip(form.currency === c.code)}>{c.code === 'CNY' ? 'CNY (RMB)' : c.code}</button>)}
        {canTypeOther && <button type="button" onClick={() => pick(typed)} className={chip(false)}>+ {typed}</button>}
        {!form.search.trim() && <button type="button" onClick={() => setForm({ ...form, more: !form.more })} className="min-h-10 px-2 text-sm font-semibold text-primary">{form.more ? w.less : `${w.more}…`}</button>}
      </div>
      <div className="flex flex-wrap gap-1.5" role="group">
        {(['cash', 'bank', 'online'] as const).map((kind) => <button key={kind} type="button" aria-pressed={form.kind === kind} onClick={() => setForm({ ...form, kind })} className={chip(form.kind === kind)}>{w.kind[kind]}</button>)}
      </div>
      <label className="block text-xs font-semibold text-neutral-600">{w.holds}
        <input inputMode="decimal" value={form.quantity} onChange={(e) => { setForm({ ...form, quantity: e.target.value }); setError(''); }} placeholder={`0 ${form.currency}`} dir="ltr" className={`${field} mt-1`}/>
      </label>
      {form.currency !== base && (<label className="block text-xs font-semibold text-neutral-600">{w.cost(base, form.currency)}
          <input inputMode="decimal" value={form.cost} onChange={(e) => { setForm({ ...form, cost: e.target.value }); setError(''); }} placeholder={`0 ${base}`} dir="ltr" className={`${field} mt-1`}/>
          <span className="mt-1 block font-normal text-neutral-500">{w.costHint}</span>
        </label>)}
      <p className="text-xs text-neutral-500">{w.newMoney}</p>
      {error && <p role="alert" className="text-xs font-semibold text-financial-loss">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="ghost" size="md" onClick={onDone}>{w.cancel}</Button>
        <Button type="button" size="md" className="font-bold" disabled={saving} onClick={save}>{w.save}</Button>
      </div>
    </div>);
}

/** The card: wallets grouped by currency, the total value, adding a wallet, buying and selling. */
export function WalletsSection(data: Data) {
    const { lang } = useLanguage();
    const w = W[lang];
    const business = useBusinessSettings(data.userDocRef);
    const { base, views, pam } = useWallets(data, business);
    const [adding, setAdding] = useState(false);
    const [action, setAction] = useState<CurrencyAction | null>(null);
    if (!business.loaded)
        return null;
    const groups = [base, ...business.traded].map((code) => ({ code, wallets: views.filter((v) => v.currency === code) })).filter((g) => g.wallets.length);
    const valueOf = (code: string, qty: number) => (code === base ? qty : qty * pam(code));
    const total = groups.reduce((sum, g) => sum + g.wallets.reduce((s, v) => s + valueOf(g.code, v.balance), 0), 0);
    return (<FormCard title={w.title} description={w.hint}>
      <div className="flex items-baseline justify-between rounded-button bg-primary/5 px-3 py-2">
        <span className="text-sm font-semibold text-neutral-700">{w.total}</span>
        <bdi dir="ltr" className="text-lg font-extrabold tabular-nums text-neutral-900">{n(total)} {base}</bdi>
      </div>
      {groups.map(({ code, wallets }) => {
          const qty = wallets.reduce((s, v) => s + v.balance, 0);
          return (<section key={code} className="space-y-1.5 rounded-card border border-border p-3">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-extrabold text-neutral-900">{currencyLabel(code, lang)}</h3>
              <bdi dir="ltr" className="text-sm font-bold tabular-nums">{n(qty)} {code}</bdi>
            </div>
            {code !== base && <p className="text-xs text-neutral-500">{w.avg}: <bdi dir="ltr">{n(pam(code))} {base}</bdi> · {w.value}: <bdi dir="ltr">{n(valueOf(code, qty))} {base}</bdi></p>}
            <ul className="space-y-1">
              {wallets.map((v) => (<li key={v.id} className="flex items-center gap-2 rounded-button bg-surface-muted px-3 py-1.5 text-sm">
                  <span className="min-w-0 flex-1 truncate text-neutral-800">{v.virtual ? w.virtual : v.name}</span>
                  <bdi dir="ltr" className="shrink-0 font-semibold tabular-nums">{n(v.balance)} {code}</bdi>
                </li>))}
            </ul>
            {code !== base && (business.walletsModel || (code !== 'USDT' && code !== 'EUR')) && (<div className="grid grid-cols-2 gap-2 pt-1">
                <Button type="button" size="sm" className="bg-action-buy text-white hover:bg-action-buy-hover" onClick={() => setAction({ kind: 'buy', currency: code })}>{w.buy} {code}</Button>
                <Button type="button" size="sm" className="bg-action-sell text-white hover:bg-action-sell-hover" onClick={() => setAction({ kind: 'sell', currency: code })}>{w.sell} {code}</Button>
              </div>)}
          </section>);
      })}
      {adding ? <AddWalletForm data={data} business={business} onDone={() => setAdding(false)}/> : <Button type="button" variant="outline" size="md" className="w-full font-semibold" onClick={() => setAdding(true)}>+ {w.add}</Button>}
      <CurrencyOperationDialog action={action} onClose={() => setAction(null)} business={business} {...data}/>
    </FormCard>);
}

export { walletCurrency };
