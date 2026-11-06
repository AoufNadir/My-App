import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Button } from '../components/ui/Button';
import { BASE_CURRENCY_CHOICES, checkSetup, TRADED_CURRENCY_CHOICES, type AccountKind, type SetupDraft } from './businessSettings';
import { compressLogo, SETUP_WORDS } from './setupWords';

// M2: the first-time setup, four short steps, for a business with nothing recorded yet. It writes settings and
// accounts only: no balance, no operation.

const chip = (on: boolean) => `min-h-10 rounded-full border px-3.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${on ? 'border-primary bg-primary text-white' : 'border-border-strong bg-surface text-neutral-700'}`;
const field = 'min-h-input w-full rounded-button border border-border bg-surface px-3 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary/40';

export function CurrencyChips({ selected, onToggle, choices, exclude, otherLabel, addLabel }: { selected: string[]; onToggle: (code: string) => void; choices: readonly string[]; exclude?: string; otherLabel: string; addLabel: string }) {
    const [other, setOther] = useState('');
    const all = [...new Set([...choices, ...selected])].filter((code) => code !== exclude);
    const addOther = () => {
        const code = other.trim().toUpperCase();
        if (/^[A-Z][A-Z0-9]{1,11}$/.test(code) && code !== exclude && !selected.includes(code))
            onToggle(code);
        setOther('');
    };
    return (<div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {all.map((code) => (<button key={code} type="button" aria-pressed={selected.includes(code)} onClick={() => onToggle(code)} className={chip(selected.includes(code))}>{code}</button>))}
      </div>
      <div className="flex gap-2">
        <input value={other} onChange={(event) => setOther(event.target.value)} placeholder={otherLabel} aria-label={otherLabel} dir="ltr" className={field}/>
        <Button type="button" variant="outline" size="md" onClick={addOther}>{addLabel}</Button>
      </div>
    </div>);
}

export function LogoPicker({ logo, onChange, pickLabel, removeLabel }: { logo: string | null; onChange: (logo: string | null) => void; pickLabel: string; removeLabel: string }) {
    return (<div className="flex items-center gap-3">
      <label className="flex h-24 w-24 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-card border border-dashed border-border-strong bg-surface text-center text-xs text-neutral-500">
        {logo ? <img src={logo} alt="" className="h-full w-full object-contain"/> : pickLabel}
        <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label={pickLabel} onChange={async (event) => {
            const file = event.target.files?.[0];
            if (file)
                onChange(await compressLogo(file).catch(() => null));
        }}/>
      </label>
      {logo && <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>{removeLabel}</Button>}
    </div>);
}

export function SetupWizard({ onSave }: { onSave: (draft: SetupDraft) => Promise<void> }) {
    const { lang, setLang } = useLanguage();
    // The setup opens in Arabic; the switch at the top changes the whole app's language.
    const startedInArabic = useRef(false);
    useEffect(() => {
        if (!startedInArabic.current) {
            startedInArabic.current = true;
            if (lang !== 'ar') setLang('ar');
        }
    }, [lang, setLang]);
    const w = SETUP_WORDS[lang];
    const [step, setStep] = useState(1);
    const [draft, setDraft] = useState<SetupDraft>({ baseCurrency: 'DZD', currencies: ['USDT'], accounts: [{ name: SETUP_WORDS.ar.defaultCash, kind: 'cash' }], businessName: '', logo: null });
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const update = (patch: Partial<SetupDraft>) => {
        setDraft((value) => ({ ...value, ...patch }));
        setError('');
    };
    const toggle = (code: string) => update({ currencies: draft.currencies.includes(code) ? draft.currencies.filter((c) => c !== code) : [...draft.currencies, code] });
    const setAccount = (index: number, patch: Partial<{ name: string; kind: AccountKind }>) => update({ accounts: draft.accounts.map((account, i) => (i === index ? { ...account, ...patch } : account)) });
    const finish = async () => {
        const check = checkSetup(draft);
        if (check.ok === false) {
            setError(w.errors[check.reason]);
            setStep(check.reason === 'no_currency' || check.reason === 'bad_currency' ? 2 : check.reason === 'no_account' ? 3 : 4);
            return;
        }
        setSaving(true);
        try {
            await onSave(draft);
        }
        finally {
            setSaving(false);
        }
    };
    const next = () => {
        if (step === 2 && !draft.currencies.some((code) => code !== draft.baseCurrency))
            return setError(w.errors.no_currency);
        if (step === 3 && !draft.accounts.some((account) => account.name.trim()))
            return setError(w.errors.no_account);
        setError('');
        setStep(step + 1);
    };
    const screens: Record<number, { title: string; hint: string; body: ReactNode }> = {
        1: { title: w.baseTitle, hint: w.baseHint, body: (<div className="flex flex-col gap-2">
            {BASE_CURRENCY_CHOICES.map((code) => (<button key={code} type="button" aria-pressed={draft.baseCurrency === code} onClick={() => update({ baseCurrency: code, currencies: draft.currencies.filter((c) => c !== code) })} className={`min-h-touch rounded-card border px-4 text-start text-[15px] font-semibold ${draft.baseCurrency === code ? 'border-2 border-primary bg-primary/5' : 'border-border bg-surface'}`}>{code}</button>))}
          </div>) },
        2: { title: w.currenciesTitle, hint: w.currenciesHint, body: <CurrencyChips selected={draft.currencies} onToggle={toggle} choices={TRADED_CURRENCY_CHOICES} exclude={draft.baseCurrency} otherLabel={w.otherCode} addLabel={w.add}/> },
        3: { title: w.accountsTitle(draft.baseCurrency), hint: w.accountsHint(draft.baseCurrency), body: (<div className="space-y-2">
            {draft.accounts.map((account, index) => (<div key={index} className="space-y-2 rounded-card border border-border bg-surface p-3">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor={`account-${index}`} className="text-sm font-bold text-neutral-900">{w.accountNumber(index + 1)}</label>
                  {draft.accounts.length > 1 && <button type="button" onClick={() => update({ accounts: draft.accounts.filter((_, i) => i !== index) })} className="text-xs font-semibold text-financial-loss">{w.removeLogo}</button>}
                </div>
                <input id={`account-${index}`} value={account.name} onChange={(event) => setAccount(index, { name: event.target.value })} placeholder={w.accountName} className={field}/>
                <div className="flex flex-wrap gap-2" role="group" aria-label={w.accountKind}>
                  {(['cash', 'bank', 'online'] as const).map((kind) => <button key={kind} type="button" aria-pressed={account.kind === kind} onClick={() => setAccount(index, { kind })} className={chip(account.kind === kind)}>{w.kind[kind]}</button>)}
                </div>
              </div>))}
            <Button type="button" variant="outline" size="md" className="w-full" onClick={() => update({ accounts: [...draft.accounts, { name: '', kind: 'bank' }] })}>+ {w.addAccount}</Button>
            <p className="text-xs text-neutral-500">{w.openingLater}</p>
          </div>) },
        4: { title: w.identityTitle, hint: w.identityHint, body: (<div className="space-y-3">
            <input value={draft.businessName} onChange={(event) => update({ businessName: event.target.value })} placeholder={w.businessName} aria-label={w.businessName} className={field}/>
            <LogoPicker logo={draft.logo} onChange={(logo) => update({ logo })} pickLabel={w.pickLogo} removeLabel={w.removeLogo}/>
          </div>) },
    };
    const screen = screens[step];
    return (<main dir={lang === 'ar' ? 'rtl' : 'ltr'} className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 bg-app-bg px-4 py-6">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-neutral-500">{w.step(step)}</p>
        <div className="flex gap-1">
          <button type="button" aria-pressed={lang === 'ar'} onClick={() => setLang('ar')} className={chip(lang === 'ar')}>العربية</button>
          <button type="button" aria-pressed={lang === 'fr'} onClick={() => setLang('fr')} className={chip(lang === 'fr')}>Français</button>
        </div>
      </div>
      <div className="flex gap-1" aria-hidden="true">{[1, 2, 3, 4].map((i) => <span key={i} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-primary' : 'bg-neutral-300'}`}/>)}</div>
      <h1 className="text-xl font-extrabold text-neutral-900">{screen.title}</h1>
      <p className="text-sm text-neutral-600">{screen.hint}</p>
      {screen.body}
      {error && <p role="alert" className="text-sm font-semibold text-financial-loss">{error}</p>}
      <div className="mt-auto flex flex-col gap-2 pt-4">
        {step < 4
            ? <Button type="button" size="lg" className="w-full font-bold" onClick={next}>{w.next}</Button>
            : <Button type="button" size="lg" className="w-full font-bold" disabled={saving} onClick={finish}>{w.start}</Button>}
        {step > 1 && <Button type="button" variant="ghost" size="md" onClick={() => setStep(step - 1)}>{w.back}</Button>}
      </div>
    </main>);
}
