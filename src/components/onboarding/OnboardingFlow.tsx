import { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { CurrencyVisibilitySettings } from '../main/CurrencyVisibilitySettings';
import { CashAccountsSettings } from '../main/CashAccountsSettings';

// V15-3 (owner): first-run setup of a new account, in three steps. It only writes the settings the owner
// already has in « Réglages » (currencies shown, dinar accounts) and `setupDone`; no money, no balance.
const W = {
    fr: {
        step: (n: number) => `Étape ${n} sur 3`,
        welcomeTitle: 'Bienvenue',
        welcomeText: 'Votre monnaie de base est le dinar (DZD). Deux réglages rapides, modifiables plus tard dans Réglages.',
        currenciesTitle: 'Quelles devises achetez-vous et vendez-vous ?',
        accountsTitle: 'Où sont vos dinars ?',
        accountsText: 'La Caisse et BaridiMob sont toujours là. Ajoutez une banque, un CCP ou un autre portefeuille si vous en avez.',
        doneTitle: 'C’est prêt',
        doneText: 'Commencez par votre première opération avec le bouton +.',
        next: 'Suivant', back: 'Retour', start: 'Commencer', skip: 'Passer',
    },
    ar: {
        step: (n: number) => `الخطوة ${n} من 3`,
        welcomeTitle: 'مرحباً بك',
        welcomeText: 'عملتك الأساسية هي الدينار (DZD). إعدادان سريعان، وتستطيع تغييرهما لاحقاً من الإعدادات.',
        currenciesTitle: 'أي العملات تشتري وتبيع؟',
        accountsTitle: 'أين دنانيرك؟',
        accountsText: 'الصندوق وBaridiMob موجودان دائماً. أضف بنكاً أو CCP أو محفظة أخرى إن كانت لديك.',
        doneTitle: 'كل شيء جاهز',
        doneText: 'ابدأ بأول عملية من زر +.',
        next: 'التالي', back: 'رجوع', start: 'ابدأ', skip: 'تخطَّ',
    },
};

// Adding a currency or an account redraws the whole app (CurrencyRegistryGate): the step is kept outside the
// component so the setup stays where the owner was.
let currentStep = 1;

type UserDocRef = Parameters<typeof CurrencyVisibilitySettings>[0]['userDocRef'];

export function OnboardingFlow({ userDocRef, onFinish }: { userDocRef: UserDocRef; onFinish: () => Promise<void> | void }) {
    const { lang } = useLanguage();
    const w = W[lang];
    const [step, setStepState] = useState(currentStep);
    const setStep = (next: number) => { currentStep = next; setStepState(next); };
    const [finishing, setFinishing] = useState(false);
    const finish = async () => { setFinishing(true); try { await onFinish(); } finally { setFinishing(false); } };
    return (<div role="dialog" aria-modal="true" data-testid="onboarding" className="fixed inset-0 z-[300] overflow-y-auto bg-app-bg">
      <div className="mx-auto flex min-h-full max-w-md flex-col gap-4 px-4 py-6">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-neutral-600">{w.step(step)}</span>
          {step < 3 && (<button type="button" onClick={finish} disabled={finishing} className="text-xs font-semibold text-neutral-600 underline">{w.skip}</button>)}
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
        {step === 3 && (<>
            <h1 className="text-2xl font-black text-neutral-900">{w.doneTitle}</h1>
            <p className="text-sm text-neutral-700">{w.doneText}</p>
          </>)}
        <div className="mt-auto flex gap-2 pt-4">
          {step > 1 && (<button type="button" onClick={() => setStep(step - 1)} className="h-12 flex-1 rounded-button border border-border bg-surface text-sm font-bold text-neutral-800">{w.back}</button>)}
          {step < 3
            ? (<button type="button" onClick={() => setStep(step + 1)} className="h-12 flex-1 rounded-button bg-primary text-sm font-bold text-white">{w.next}</button>)
            : (<button type="button" onClick={finish} disabled={finishing} className="h-12 flex-1 rounded-button bg-primary text-sm font-bold text-white">{w.start}</button>)}
        </div>
      </div>
    </div>);
}
