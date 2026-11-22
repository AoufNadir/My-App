import { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { FormCard } from '../ui/FormCard';
import { useHiddenCurrencies } from '../../hooks/useHiddenCurrencies';
import { checkCustomCurrency, COMMON_CURRENCIES, TRADE_CURRENCIES } from '../../currency/tradeCurrencies';
import { canHideCurrency } from '../../utils/hiddenCurrencies';

// V13-2 / V14-2, in the settings window: « I work with … », one switch per currency of the list (USDT, EUR, RMB).
// Off: the currency leaves the buy / sell windows, the menus and the portfolio page. Nothing is deleted and no figure
// changes: its past profits, reports and any stock left still count. At least one currency stays on.
const W = {
    fr: { add: 'Ajouter une devise', addHint: 'Touchez une devise, ou « Autre devise ».', other: 'Autre devise', change: 'Changer', code: 'Code (3 à 5 lettres, ex. GBP)', symbol: 'Symbole (ex. £)', nameFr: 'Nom en français (ex. la livre sterling)', nameAr: 'Nom en arabe (ex. الجنيه الإسترليني)', save: 'Ajouter', cancel: 'Annuler', errors: { code: 'Le code doit faire 3 à 5 lettres.', taken: 'Ce code existe déjà (ou c’est le dinar).', symbol: 'Écrivez le symbole (1 à 4 caractères).', name: 'Écrivez le nom en français et en arabe.' }, added: 'Devise ajoutée.', custom: 'Ajoutée par vous', title: 'Devises affichées', with: (name: string) => `Je travaille avec ${name}`, on: 'Affiché dans les fenêtres d’achat et de vente et dans le portefeuille.', off: 'Masqué. Ses opérations passées, ses bénéfices et son stock restent comptés ; rien n’est supprimé.', last: 'Gardez au moins une devise affichée.' },
    ar: { add: 'أضف عملة', addHint: 'اضغط على عملة، أو «عملة أخرى».', other: 'عملة أخرى', change: 'غيّر', code: 'الرمز (من 3 إلى 5 حروف، مثل GBP)', symbol: 'العلامة (مثل £)', nameFr: 'الاسم بالفرنسية (مثل la livre sterling)', nameAr: 'الاسم بالعربية (مثل الجنيه الإسترليني)', save: 'أضف', cancel: 'إلغاء', errors: { code: 'الرمز من 3 إلى 5 حروف.', taken: 'هذا الرمز موجود (أو هو الدينار).', symbol: 'اكتب العلامة (من 1 إلى 4 رموز).', name: 'اكتب الاسم بالفرنسية وبالعربية.' }, added: 'أُضيفت العملة.', custom: 'أضفتها أنت', title: 'العملات الظاهرة', with: (name: string) => `أتعامل بـ${name.startsWith('ال') ? '' : ' '}${name}`, on: 'ظاهر في نوافذ الشراء والبيع وفي صفحة المحافظ.', off: 'مخفي. عملياته السابقة وأرباحه ومخزونه تبقى محسوبة، ولا يُحذف شيء.', last: 'أبقِ عملة واحدة على الأقل ظاهرة.' },
};

export function CurrencyVisibilitySettings({ userDocRef }: { userDocRef: Parameters<typeof useHiddenCurrencies>[0] }) {
    // V15-1: the owner adds a currency here; it is kept on his user document and joins the list everywhere.
    const [adding, setAdding] = useState(false);
    const [form, setForm] = useState({ code: '', symbol: '', nameFr: '', nameAr: '' });
    const [formError, setFormError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    // V22-1: « picked » = a common currency filled in one tap; « manual » = the 4 fields.
    const [mode, setMode] = useState<'list' | 'picked' | 'manual'>('list');
    const { lang } = useLanguage();
    const w = W[lang];
    const { hidden, isHidden, setCurrencyHidden } = useHiddenCurrencies(userDocRef);
    const [refused, setRefused] = useState(false);
    return (<FormCard title={w.title}>
      <div className="space-y-2">
        {TRADE_CURRENCIES.map(({ code, name, custom }) => {
            const shown = !isHidden(code);
            const toggle = () => {
                if (shown && !canHideCurrency(hidden, code)) { setRefused(true); return; }
                setRefused(false);
                void setCurrencyHidden(code, shown);
            };
            return (<button key={code} type="button" role="switch" aria-checked={shown} onClick={toggle} className="flex w-full items-center gap-3 rounded-card border border-border bg-surface px-3 py-3 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-neutral-900">{w.with(name[lang])}</span>
                <span className="block text-xs text-neutral-600">{shown ? w.on : w.off}</span>
                {custom && <span className="mt-0.5 block text-[11px] font-semibold text-primary">{w.custom}</span>}
              </span>
              <span aria-hidden="true" className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${shown ? 'bg-primary' : 'bg-neutral-300'}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${shown ? 'start-[22px]' : 'start-0.5'}`}/>
              </span>
            </button>);
        })}
      </div>
      {refused && <p role="alert" className="text-xs font-semibold text-financial-loss">{w.last}</p>}
      {!adding ? (<button type="button" onClick={() => { setAdding(true); setFormError(null); }} className="w-full rounded-card border border-dashed border-primary px-3 py-3 text-sm font-bold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">+ {w.add}</button>) : (<div className="space-y-2 rounded-card border border-border bg-surface-muted p-3">
          {mode === 'list' && (<>
            <p className="text-xs text-neutral-600">{w.addHint}</p>
            <div className="grid grid-cols-2 gap-1.5">
              {COMMON_CURRENCIES.filter((c) => !TRADE_CURRENCIES.some((t) => t.code === c.code)).map((c) => (<button key={c.code} type="button" onClick={() => { setForm({ code: c.code, symbol: c.symbol, nameFr: c.nameFr, nameAr: c.nameAr }); setMode('picked'); setFormError(null); }} className="flex min-h-12 items-center gap-2 rounded-button border border-border bg-surface px-2.5 py-1.5 text-start">
                  <span className="w-11 shrink-0 text-sm font-black text-primary" dir="ltr">{c.code}</span>
                  <span className="min-w-0 text-xs leading-tight text-neutral-700">{lang === 'ar' ? c.nameAr : c.nameFr}</span>
                </button>))}
              <button type="button" onClick={() => { setForm({ code: '', symbol: '', nameFr: '', nameAr: '' }); setMode('manual'); }} className="col-span-2 min-h-12 rounded-button border border-dashed border-primary text-sm font-bold text-primary">+ {w.other}</button>
            </div>
          </>)}
          {mode === 'picked' && (<div className="flex items-center gap-3 rounded-button border border-primary/40 bg-surface px-3 py-3">
              <span className="text-lg font-black text-primary" dir="ltr">{form.code} · {form.symbol}</span>
              <span className="min-w-0 flex-1 text-sm text-neutral-800">{lang === 'ar' ? form.nameAr : form.nameFr}</span>
              <button type="button" onClick={() => setMode('list')} className="text-xs font-semibold text-neutral-600 underline">{w.change}</button>
            </div>)}
          {mode === 'manual' && ([['code', w.code], ['symbol', w.symbol], ['nameFr', w.nameFr], ['nameAr', w.nameAr]] as const).map(([field, label]) => (<label key={field} className="block">
              <span className="block text-xs font-semibold text-neutral-700">{label}</span>
              <input value={form[field]} dir={field === 'nameAr' ? 'rtl' : 'ltr'} onChange={(event) => setForm({ ...form, [field]: field === 'code' ? event.target.value.toUpperCase() : event.target.value })} className="mt-1 h-11 w-full rounded-button border border-border bg-surface px-3 text-sm text-neutral-900"/>
            </label>))}
          {mode !== 'list' && formError && <p role="alert" className="text-xs font-semibold text-financial-loss">{formError}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => { setAdding(false); setMode('list'); setForm({ code: '', symbol: '', nameFr: '', nameAr: '' }); setFormError(null); }} className="h-11 flex-1 rounded-button border border-border bg-surface text-sm font-semibold text-neutral-700">{w.cancel}</button>
            {mode !== 'list' && <button type="button" disabled={saving} onClick={async () => {
                const check = checkCustomCurrency(form);
                if (check.ok === false) { setFormError(w.errors[check.reason]); return; }
                setSaving(true);
                try {
                    const custom = TRADE_CURRENCIES.filter((c) => c.custom).map(({ code, symbol, name }) => ({ code, symbol, name }));
                    await userDocRef?.set({ customCurrencies: [...custom, { code: check.currency.code, symbol: check.currency.symbol, name: check.currency.name }] }, { merge: true });
                    setAdding(false); setMode('list'); setForm({ code: '', symbol: '', nameFr: '', nameAr: '' }); setFormError(null);
                }
                catch (error) { console.error(error); setFormError(String((error as Error)?.message || error)); }
                finally { setSaving(false); }
            }} className="h-11 flex-1 rounded-button bg-primary text-sm font-bold text-white disabled:opacity-60">{w.save}</button>}
          </div>
        </div>)}
    </FormCard>);
}
