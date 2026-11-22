import { useLanguage } from '../../contexts/LanguageContext';
import { useNewVersion } from '../../hooks/useNewVersion';

// V24-1: « Nouvelle version disponible · Mettre à jour ». The reload is the owner's tap, never automatic (a form could be open).
export function UpdateBar() {
    const { lang } = useLanguage();
    const available = useNewVersion();
    if (!available) return null;
    return (<div role="status" data-testid="update-bar" className="fixed inset-x-3 bottom-[calc(84px+env(safe-area-inset-bottom))] z-[260] flex items-center gap-3 rounded-card bg-neutral-900 px-4 py-3 text-white shadow-card-hover sm:bottom-6 sm:start-auto sm:end-6 sm:w-96">
      <span className="min-w-0 flex-1 text-sm font-semibold">{lang === 'ar' ? 'نسخة جديدة من التطبيق متوفرة' : 'Nouvelle version de l’application'}</span>
      <button type="button" onClick={() => window.location.reload()} className="h-10 shrink-0 rounded-button bg-primary px-4 text-sm font-bold text-white">{lang === 'ar' ? 'حدّث الآن' : 'Mettre à jour'}</button>
    </div>);
}
