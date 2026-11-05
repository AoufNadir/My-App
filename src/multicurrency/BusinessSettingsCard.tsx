import { useEffect, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Button } from '../components/ui/Button';
import { FormCard } from '../components/ui/FormCard';
import { TRADED_CURRENCY_CHOICES, type AccountKind } from './businessSettings';
import { CurrencyChips, LogoPicker } from './SetupWizard';
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
    const [currencies, setCurrencies] = useState(settings.currencies);
    const [name, setName] = useState(settings.businessName);
    const [logo, setLogo] = useState(settings.logo);
    const [account, setAccount] = useState<{ name: string; kind: AccountKind }>({ name: '', kind: 'bank' });
    const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
    useEffect(() => {
        setCurrencies(settings.currencies);
        setName(settings.businessName);
        setLogo(settings.logo);
    }, [settings.currencies.join(), settings.businessName, settings.logo]); // eslint-disable-line react-hooks/exhaustive-deps
    const addCurrency = (code: string) => {
        if (!currencies.includes(code))
            setCurrencies([...currencies, code]);
    };
    const save = async () => {
        setState('saving');
        try {
            await business.saveBusiness({ currencies, businessName: name.trim(), logo });
            setState('saved');
        }
        catch {
            setState('idle');
        }
    };
    const addAccount = async () => {
        await business.addAccount(account.name, account.kind);
        setAccount({ name: '', kind: 'bank' });
    };
    return (<FormCard title={w.cardTitle} description={w.cardHint}>
      <p className="text-sm font-semibold text-neutral-800">{w.baseLocked(settings.baseCurrency)}</p>
      <div>
        <p className="mb-1.5 text-sm font-medium text-neutral-700">{w.currenciesTitle}</p>
        <CurrencyChips selected={currencies} onToggle={addCurrency} choices={TRADED_CURRENCY_CHOICES} exclude={settings.baseCurrency} otherLabel={w.otherCode} addLabel={w.add}/>
      </div>
      <div>
        <p className="mb-1.5 text-sm font-medium text-neutral-700">{w.accountsTitle(settings.baseCurrency)}</p>
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {business.accounts.map((item) => (<li key={item.id} className="rounded-full bg-surface-muted px-3 py-1.5 text-xs font-semibold text-neutral-700">{item.name} · {w.kind[item.kind]}</li>))}
        </ul>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <input value={account.name} onChange={(event) => setAccount({ ...account, name: event.target.value })} placeholder={w.accountName} aria-label={w.accountName} className={`${field} col-span-2`}/>
          <select value={account.kind} onChange={(event) => setAccount({ ...account, kind: event.target.value as AccountKind })} aria-label={w.accountName} className={field}>
            {(['cash', 'bank', 'online'] as const).map((kind) => <option key={kind} value={kind}>{w.kind[kind]}</option>)}
          </select>
          <Button type="button" variant="outline" size="md" disabled={!account.name.trim()} onClick={addAccount}>{w.add}</Button>
        </div>
        <p className="mt-1 text-xs text-neutral-500">{w.openingLater}</p>
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
