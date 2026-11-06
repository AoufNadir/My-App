import { useEffect, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Button } from '../components/ui/Button';
import { FormCard } from '../components/ui/FormCard';
import { LogoPicker } from './SetupWizard';
import { SETUP_WORDS } from './setupWords';
import { useBusinessSettings, type BusinessSettingsState } from './useBusinessSettings';

// M2, in the settings window: the base currency (shown, fixed), the currencies traded, the accounts of the base
// currency and the report identity. Saving changes no balance. A currency is only added here: taking one away
// waits for M3, which knows whether it still has stock.

const field = 'min-h-input w-full rounded-button border border-border bg-surface px-3 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary/40';

export function BusinessSettingsCard({ business }: { business: BusinessSettingsState }) {
    const { lang } = useLanguage();
    const w = SETUP_WORDS[lang];
    const { settings } = business;
    const [name, setName] = useState(settings.businessName);
    const [logo, setLogo] = useState(settings.logo);
    const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
    useEffect(() => {
        setName(settings.businessName);
        setLogo(settings.logo);
    }, [settings.businessName, settings.logo]);
    const save = async () => {
        setState('saving');
        try {
            await business.saveBusiness({ businessName: name.trim(), logo });
            setState('saved');
        }
        catch {
            setState('idle');
        }
    };
    return (<FormCard title={w.cardTitle} description={w.cardHint}>
      <p className="text-sm font-semibold text-neutral-800">{w.baseLocked(settings.baseCurrency)}</p>
      <div className="rounded-button bg-surface-muted px-3 py-2">
        <p className="text-xs font-semibold text-neutral-600">{w.walletsWhere}</p>
        <p className="mt-1 text-sm font-semibold text-neutral-800">{business.accounts.map((a) => `${a.name} (${a.currency ?? settings.baseCurrency})`).concat(business.traded.filter((c) => !business.accounts.some((a) => a.currency === c)).map((c) => c)).join(' · ')}</p>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium text-neutral-700">{w.identityTitle}</p>
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder={w.businessName} aria-label={w.businessName} className={field}/>
        <LogoPicker logo={logo} onChange={setLogo} pickLabel={w.pickLogo} removeLabel={w.removeLogo}/>
      </div>
      <Button type="button" variant="primary" size="md" className="w-full font-semibold" disabled={state === 'saving'} onClick={save}>{state === 'saved' ? `✓ ${w.saved}` : w.save}</Button>
    </FormCard>);
}

/** The card with its own reading of the settings: mounted only while the settings window is open. */
export function BusinessSettingsSection({ userDocRef }: { userDocRef: Parameters<typeof useBusinessSettings>[0] }) {
    const business = useBusinessSettings(userDocRef);
    return business.loaded ? <BusinessSettingsCard business={business}/> : null;
}
