import { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { FormCard } from '../ui/FormCard';
import { useHiddenCurrencies } from '../../hooks/useHiddenCurrencies';
import { TRADE_CURRENCIES } from '../../currency/tradeCurrencies';
import { canHideCurrency } from '../../utils/hiddenCurrencies';

// V13-2 / V14-2, in the settings window: « I work with … », one switch per currency of the list (USDT, EUR, RMB).
// Off: the currency leaves the buy / sell windows, the menus and the portfolio page. Nothing is deleted and no figure
// changes: its past profits, reports and any stock left still count. At least one currency stays on.
const W = {
    fr: { title: 'Devises affichées', with: (name: string) => `Je travaille avec ${name}`, on: 'Affiché dans les fenêtres d’achat et de vente et dans le portefeuille.', off: 'Masqué. Ses opérations passées, ses bénéfices et son stock restent comptés ; rien n’est supprimé.', last: 'Gardez au moins une devise affichée.' },
    ar: { title: 'العملات الظاهرة', with: (name: string) => `أتعامل بـ${name.startsWith('ال') ? '' : ' '}${name}`, on: 'ظاهر في نوافذ الشراء والبيع وفي صفحة المحافظ.', off: 'مخفي. عملياته السابقة وأرباحه ومخزونه تبقى محسوبة، ولا يُحذف شيء.', last: 'أبقِ عملة واحدة على الأقل ظاهرة.' },
};

export function CurrencyVisibilitySettings({ userDocRef }: { userDocRef: Parameters<typeof useHiddenCurrencies>[0] }) {
    const { lang } = useLanguage();
    const w = W[lang];
    const { hidden, isHidden, setCurrencyHidden } = useHiddenCurrencies(userDocRef);
    const [refused, setRefused] = useState(false);
    return (<FormCard title={w.title}>
      <div className="space-y-2">
        {TRADE_CURRENCIES.map(({ code, name }) => {
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
              </span>
              <span aria-hidden="true" className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${shown ? 'bg-primary' : 'bg-neutral-300'}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${shown ? 'start-[22px]' : 'start-0.5'}`}/>
              </span>
            </button>);
        })}
      </div>
      {refused && <p role="alert" className="text-xs font-semibold text-financial-loss">{w.last}</p>}
    </FormCard>);
}
