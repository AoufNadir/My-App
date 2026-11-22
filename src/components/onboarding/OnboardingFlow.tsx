import { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { CurrencyVisibilitySettings } from '../main/CurrencyVisibilitySettings';
import { CashAccountsSettings } from '../main/CashAccountsSettings';
import { useHiddenCurrencies } from '../../hooks/useHiddenCurrencies';
import { TRADE_CURRENCIES } from '../../currency/tradeCurrencies';
import { SHOWN_CASH_ACCOUNTS } from '../../accounts/cashAccounts';
import { checkOpening, type OpeningInput } from '../../utils/openingBalances';

// V15-3 (owner): first-run setup of a new account, in three steps. It only writes the settings the owner
// already has in « Réglages » (currencies shown, dinar accounts) and `setupDone`; no money, no balance.
const W = {
    fr: {
        step: (n: number) => `Étape ${n} sur 4`,
        welcomeTitle: 'Bienvenue',
        welcomeText: 'Votre monnaie de base est le dinar (DZD). Deux réglages rapides, modifiables plus tard dans Réglages.',
        currenciesTitle: 'Quelles devises achetez-vous et vendez-vous ?',
        accountsTitle: 'Où sont vos dinars ?',
        accountsText: 'La Caisse et BaridiMob sont toujours là. Ajoutez une banque, un CCP ou un autre portefeuille si vous en avez.',
        openingTitle: 'Ce que vous avez aujourd’hui',
        openingText: 'Facultatif. Ce que vous tapez devient votre capital de départ de gérant. Rien n’est enregistré avant « Commencer ».',
        managerName: 'Votre nom (gérant)',
        quantity: 'Quantité', avgPrice: 'Prix moyen d’achat (DZD)',
        total: 'Votre capital de départ',
        errors: { name: 'Écrivez votre nom.', amount: 'Montant invalide.', stock: 'Pour chaque devise, écrivez la quantité et le prix moyen, ou laissez les deux vides.' },
        doneTitle: 'C’est prêt',
        doneText: 'Vérifiez puis commencez par votre première opération avec le bouton +.',
        summaryCurrencies: 'Devises', summaryAccounts: 'Comptes en dinars', summaryOpening: 'Capital de départ', none: 'Aucun',
        saveError: 'Enregistrement impossible. Réessayez.',
        next: 'Suivant', back: 'Retour', start: 'Commencer', skip: 'Passer',
    },
    ar: {
        step: (n: number) => `الخطوة ${n} من 4`,
        welcomeTitle: 'مرحباً بك',
        welcomeText: 'عملتك الأساسية هي الدينار (DZD). إعدادان سريعان، وتستطيع تغييرهما لاحقاً من الإعدادات.',
        currenciesTitle: 'أي العملات تشتري وتبيع؟',
        accountsTitle: 'أين دنانيرك؟',
        accountsText: 'الصندوق وحساب BaridiMob موجودان دائماً. أضف بنكاً أو CCP أو محفظة أخرى إن كانت لديك.',
        openingTitle: 'ما عندك اليوم؟',
        openingText: 'اختياري. ما تكتبه هنا يصير رأس مالك الافتتاحي كمسيّر. لا يُحفظ شيء قبل «ابدأ».',
        managerName: 'اسمك (المسيّر)',
        quantity: 'الكمية', avgPrice: 'متوسط سعر الشراء (DZD)',
        total: 'رأس مالك الافتتاحي',
        errors: { name: 'اكتب اسمك.', amount: 'مبلغ غير صالح.', stock: 'لكل عملة اكتب الكمية ومتوسط السعر معاً، أو اتركهما فارغين.' },
        doneTitle: 'كل شيء جاهز',
        doneText: 'راجع ما اخترته، ثم ابدأ بأول عملية من زر +.',
        summaryCurrencies: 'العملات', summaryAccounts: 'الحسابات بالدينار', summaryOpening: 'رأس المال الافتتاحي', none: 'لا شيء',
        saveError: 'تعذّر الحفظ. حاول مرة أخرى.',
        next: 'التالي', back: 'رجوع', start: 'ابدأ', skip: 'تخطَّ',
    },
};

// Adding a currency or an account redraws the whole app (CurrencyRegistryGate): the step and what is typed are kept
// outside the component so the setup stays where the owner was.
let currentStep = 1;
let typed: { name: string; cash: Record<string, string>; qty: Record<string, string>; price: Record<string, string> } = { name: '', cash: {}, qty: {}, price: {} };

type UserDocRef = Parameters<typeof CurrencyVisibilitySettings>[0]['userDocRef'];

const num = (raw: string | undefined) => { const v = (raw ?? '').replace(/\s/g, '').replace(',', '.'); return v === '' ? 0 : Number(v); };
/** What the owner typed, as the opening input (empty fields are left out). */
export function openingFromTyped(t: typeof typed, accounts: readonly string[], currencies: readonly string[]): OpeningInput {
    return {
        managerName: t.name,
        cash: accounts.map((accountId) => ({ accountId, amount: num(t.cash[accountId]) })).filter((c) => c.amount !== 0),
        stocks: currencies.filter((c) => (t.qty[c] ?? '').trim() || (t.price[c] ?? '').trim()).map((currency) => ({ currency, quantity: num(t.qty[currency]), avgPrice: num(t.price[currency]) })),
    };
}
const fmt = (v: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(v);

export function OnboardingFlow({ userDocRef, onFinish }: { userDocRef: UserDocRef; onFinish: (opening: OpeningInput) => Promise<void> | void }) {
    const { lang } = useLanguage();
    const w = W[lang];
    const [step, setStepState] = useState(currentStep);
    const setStep = (next: number) => { currentStep = next; setStepState(next); };
    const [finishing, setFinishing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [form, setFormState] = useState(typed);
    const setForm = (next: typeof typed) => { typed = next; setFormState(next); setError(null); };
    const { isHidden } = useHiddenCurrencies(userDocRef);
    const currencies = TRADE_CURRENCIES.filter((c) => !isHidden(c.code));
    const accounts = SHOWN_CASH_ACCOUNTS;
    const accountName = (id: string, name: string) => (id === 'Caisse' ? (lang === 'ar' ? 'الصندوق' : 'Caisse') : name);
    const opening = openingFromTyped(form, accounts.map((a) => a.id), currencies.map((c) => c.code));
    const check = checkOpening(opening);
    const finish = async (withOpening: boolean) => {
        setFinishing(true); setError(null);
        try { await onFinish(withOpening ? opening : { managerName: '', cash: [], stocks: [] }); typed = { name: '', cash: {}, qty: {}, price: {} }; currentStep = 1; }
        catch (e) { console.error(e); setError(w.saveError); }
        finally { setFinishing(false); }
    };
    const next = () => {
        if (step === 3 && check.ok === false) { setError(w.errors[check.reason]); return; }
        setError(null); setStep(step + 1);
    };
    const input = 'mt-1 h-11 w-full rounded-button border border-border bg-surface px-3 text-sm text-neutral-900';
    return (<div role="dialog" aria-modal="true" data-testid="onboarding" className="fixed inset-0 z-[300] overflow-y-auto bg-app-bg">
      <div className="mx-auto flex min-h-full max-w-md flex-col gap-4 px-4 py-6">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-neutral-600">{w.step(step)}</span>
          {step < 4 && (<button type="button" onClick={() => finish(false)} disabled={finishing} className="text-xs font-semibold text-neutral-600 underline">{w.skip}</button>)}
        </div>
        {step === 1 && (<>
            <h1 className="text-2xl font-black text-neutral-900">{w.welcomeTitle}</h1>
            <p className="text-sm text-neutral-700">{w.welcomeText}</p>
            <h2 className="text-base font-bold text-neutral-900">{w.currenciesTitle}</h2>
            <CurrencyVisibilitySettings userDocRef={userDocRef}/>
          </>)}
        {step === 2 && (<>
            <h1 className="text-xl font-black text-neutral-900">{w.accountsTitle}</h1>
            <p className="text-sm text-neutral-700">{w.accountsText}</p>
            <CashAccountsSettings userDocRef={userDocRef as never}/>
          </>)}
        {step === 3 && (<div data-testid="opening-balances" className="flex flex-col gap-3">
            <h1 className="text-xl font-black text-neutral-900">{w.openingTitle}</h1>
            <p className="text-sm text-neutral-700">{w.openingText}</p>
            <label className="block"><span className="block text-xs font-semibold text-neutral-700">{w.managerName}</span>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input}/></label>
            <div className="space-y-2 rounded-card border border-border bg-surface p-3">
              {accounts.map((a) => (<label key={a.id} className="block"><span className="block text-xs font-semibold text-neutral-700">{accountName(a.id, a.name)} (DZD)</span>
                  <input inputMode="decimal" dir="ltr" value={form.cash[a.id] ?? ''} onChange={(e) => setForm({ ...form, cash: { ...form.cash, [a.id]: e.target.value } })} className={input} placeholder="0"/></label>))}
            </div>
            {currencies.map((c) => (<div key={c.code} className="space-y-2 rounded-card border border-border bg-surface p-3">
                <span className="block text-sm font-bold text-neutral-900">{c.name[lang]}</span>
                <div className="flex gap-2">
                  <label className="block flex-1"><span className="block text-xs font-semibold text-neutral-700">{w.quantity} ({c.code})</span>
                    <input inputMode="decimal" dir="ltr" value={form.qty[c.code] ?? ''} onChange={(e) => setForm({ ...form, qty: { ...form.qty, [c.code]: e.target.value } })} className={input} placeholder="0"/></label>
                  <label className="block flex-1"><span className="block text-xs font-semibold text-neutral-700">{w.avgPrice}</span>
                    <input inputMode="decimal" dir="ltr" value={form.price[c.code] ?? ''} onChange={(e) => setForm({ ...form, price: { ...form.price, [c.code]: e.target.value } })} className={input} placeholder="0"/></label>
                </div>
              </div>))}
            <div className="flex items-center justify-between rounded-card bg-primary/10 px-3 py-3">
              <span className="text-sm font-bold text-neutral-900">{w.total}</span>
              <bdi dir="ltr" data-testid="opening-total" className="text-base font-black text-primary">{fmt(checkOpening({ ...opening, managerName: opening.managerName || '-' }).ok ? (checkOpening({ ...opening, managerName: opening.managerName || '-' }) as { total: number }).total : 0)} DZD</bdi>
            </div>
          </div>)}
        {step === 4 && (<>
            <h1 className="text-2xl font-black text-neutral-900">{w.doneTitle}</h1>
            <p className="text-sm text-neutral-700">{w.doneText}</p>
            <dl data-testid="onboarding-summary" className="space-y-3 rounded-card border border-border bg-surface p-3 text-sm">
              <div><dt className="text-xs font-semibold text-neutral-600">{w.summaryCurrencies}</dt><dd className="font-bold text-neutral-900">{currencies.map((c) => c.code).join(' · ') || w.none}</dd></div>
              <div><dt className="text-xs font-semibold text-neutral-600">{w.summaryAccounts}</dt><dd className="font-bold text-neutral-900">{accounts.map((a) => accountName(a.id, a.name)).join(' · ')}</dd></div>
              <div><dt className="text-xs font-semibold text-neutral-600">{w.summaryOpening}</dt>
                {check.ok && check.total > 0 ? (<dd className="space-y-0.5 text-neutral-900">
                    {opening.cash.map((c) => (<div key={c.accountId} className="flex justify-between"><span>{accountName(c.accountId, accounts.find((a) => a.id === c.accountId)?.name ?? c.accountId)}</span><bdi dir="ltr">{fmt(c.amount)} DZD</bdi></div>))}
                    {opening.stocks.map((st) => (<div key={st.currency} className="flex justify-between"><span>{st.currency}</span><bdi dir="ltr">{fmt(st.quantity)} × {fmt(st.avgPrice)}</bdi></div>))}
                    <div className="flex justify-between border-t border-border pt-1 font-black"><span>{form.name.trim()}</span><bdi dir="ltr">{fmt(check.total)} DZD</bdi></div>
                  </dd>) : (<dd className="font-bold text-neutral-900">{w.none}</dd>)}
              </div>
            </dl>
          </>)}
        {error && <p role="alert" className="text-sm font-semibold text-financial-loss">{error}</p>}
        <div className="mt-auto flex gap-2 pt-4">
          {step > 1 && (<button type="button" onClick={() => { setError(null); setStep(step - 1); }} className="h-12 flex-1 rounded-button border border-border bg-surface text-sm font-bold text-neutral-800">{w.back}</button>)}
          {step < 4
            ? (<button type="button" onClick={next} className="h-12 flex-1 rounded-button bg-primary text-sm font-bold text-white">{w.next}</button>)
            : (<button type="button" onClick={() => finish(true)} disabled={finishing} className="h-12 flex-1 rounded-button bg-primary text-sm font-bold text-white">{w.start}</button>)}
        </div>
      </div>
    </div>);
}
