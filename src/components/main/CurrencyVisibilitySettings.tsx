import { useLanguage } from '../../contexts/LanguageContext';
import { FormCard } from '../ui/FormCard';
import { useHiddenCurrencies } from '../../hooks/useHiddenCurrencies';

// V13-2, in the settings window: « I work with EUR ». Off: EUR leaves the buy / sell windows and the portfolio page.
// Nothing is deleted and no figure changes: its past profits, reports and any stock left still count.
const W = {
    fr: { title: 'Devises affichées', eur: 'Je travaille avec l’EUR', on: 'Affiché dans les fenêtres d’achat et de vente et dans le portefeuille.', off: 'Masqué. Ses opérations passées, ses bénéfices et son stock restent comptés ; rien n’est supprimé.' },
    ar: { title: 'العملات الظاهرة', eur: 'أتعامل باليورو', on: 'ظاهر في نوافذ الشراء والبيع وفي صفحة المحافظ.', off: 'مخفي. عملياته السابقة وأرباحه ومخزونه تبقى محسوبة، ولا يُحذف شيء.' },
};

export function CurrencyVisibilitySettings({ userDocRef }: { userDocRef: Parameters<typeof useHiddenCurrencies>[0] }) {
    const { lang } = useLanguage();
    const w = W[lang];
    const { isHidden, setCurrencyHidden } = useHiddenCurrencies(userDocRef);
    const shown = !isHidden('EUR');
    return (<FormCard title={w.title}>
      <button type="button" role="switch" aria-checked={shown} onClick={() => { void setCurrencyHidden('EUR', shown); }} className="flex w-full items-center gap-3 rounded-card border border-border bg-surface px-3 py-3 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-neutral-900">{w.eur}</span>
          <span className="block text-xs text-neutral-600">{shown ? w.on : w.off}</span>
        </span>
        <span aria-hidden="true" className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${shown ? 'bg-primary' : 'bg-neutral-300'}`}>
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${shown ? 'start-[22px]' : 'start-0.5'}`}/>
        </span>
      </button>
    </FormCard>);
}
