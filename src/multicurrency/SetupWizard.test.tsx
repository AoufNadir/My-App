import assert from 'node:assert/strict';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { LanguageProvider } from '../contexts/LanguageContext';
import { SetupWizard } from './SetupWizard';
import { BusinessSettingsCard } from './BusinessSettingsCard';
import { LEGACY_ACCOUNTS, LEGACY_SETTINGS } from './businessSettings';
import { SETUP_WORDS } from './setupWords';
import type { BusinessSettingsState } from './useBusinessSettings';

// M2 screens: the first step of the setup, and the settings card of a business made before M2.

const storage = new Map<string, string>();
(globalThis as { window?: unknown }).window = {
    localStorage: { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => { storage.set(k, v); }, removeItem: (k: string) => { storage.delete(k); } },
    matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }),
};
(globalThis as unknown as { localStorage: unknown }).localStorage = (globalThis as unknown as { window: { localStorage: unknown } }).window.localStorage;
const render = (lang: 'fr' | 'ar', node: ReactElement) => {
    storage.set('app_lang', lang);
    return renderToStaticMarkup(<LanguageProvider>{node}</LanguageProvider>);
};
const noop = async () => {};

for (const lang of ['fr', 'ar'] as const) {
    const w = SETUP_WORDS[lang];
    const first = render(lang, <SetupWizard onSave={noop}/>);
    assert.ok(first.includes(w.step(1)) && first.includes(w.baseTitle.replace(/'/g, '&#x27;')), `${lang}: step 1 asks for the base currency`);
    for (const code of ['DZD', 'EUR', 'USD'])
        assert.ok(first.includes(`>${code}</button>`), `${lang}: ${code} offered`);
    assert.ok(first.includes('aria-pressed="true"'), `${lang}: DZD chosen by default`);

    const owner: BusinessSettingsState = { loaded: true, raw: undefined, settings: LEGACY_SETTINGS, created: [], accounts: LEGACY_ACCOUNTS, saveSetup: noop, saveBusiness: noop, addAccount: noop };
    const card = render(lang, <BusinessSettingsCard business={owner}/>);
    assert.ok(card.includes(w.baseLocked('DZD').replace(/'/g, '&#x27;')), `${lang}: the base currency is shown fixed`);
    assert.ok(card.includes('Caisse') && card.includes('BaridiMob'), `${lang}: the owner keeps his two accounts`);
    assert.ok(card.includes('>USDT</button>') && card.includes('>GBP</button>'), `${lang}: traded and offered currencies`);
}
console.log('SetupWizard tests passed');
