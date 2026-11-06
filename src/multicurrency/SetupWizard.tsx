import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Button } from '../components/ui/Button';
import { BASE_CURRENCY_CHOICES, checkSetup, type SetupDraft } from './businessSettings';
import { currencyLabel } from './currencyCatalog';
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
    const [base, setBase] = useState('DZD');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const finish = async () => {
        const draft: SetupDraft = { baseCurrency: base, currencies: [], accounts: [], businessName: '', logo: null };
        const check = checkSetup(draft);
        if (check.ok === false) {
            setError(w.errors[check.reason]);
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
    return (<main dir={lang === 'ar' ? 'rtl' : 'ltr'} className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 bg-app-bg px-4 py-6">
      <div className="flex justify-end gap-1">
        <button type="button" aria-pressed={lang === 'ar'} onClick={() => setLang('ar')} className={chip(lang === 'ar')}>العربية</button>
        <button type="button" aria-pressed={lang === 'fr'} onClick={() => setLang('fr')} className={chip(lang === 'fr')}>Français</button>
      </div>
      <h1 className="text-xl font-extrabold text-neutral-900">{w.baseTitle}</h1>
      <p className="text-sm text-neutral-600">{w.baseHint}</p>
      <div className="flex flex-col gap-2">
        {BASE_CURRENCY_CHOICES.map((code) => (<button key={code} type="button" aria-pressed={base === code} onClick={() => setBase(code)} className={`min-h-touch rounded-card border px-4 text-start text-[15px] font-semibold ${base === code ? 'border-2 border-primary bg-primary/5' : 'border-border bg-surface'}`}>{currencyLabel(code, lang)}</button>))}
      </div>
      {error && <p role="alert" className="text-sm font-semibold text-financial-loss">{error}</p>}
      <div className="mt-auto pt-4">
        <Button type="button" size="lg" className="w-full font-bold" disabled={saving} onClick={finish}>{w.start}</Button>
      </div>
    </main>);
}
