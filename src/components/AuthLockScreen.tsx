import { useEffect, useId, useRef, useState } from 'react';
import { signOut } from 'firebase/auth';
import { useLanguage } from '../contexts/LanguageContext';
import { auth } from '../firebaseAuth';
import { authLockStore } from '../hooks/useAuthLock';
import { FingerprintIcon } from './icons/FingerprintIcon';
import { useOverlay } from './ui/overlayStack';

// V14-1: the lock screen of a banking app. The phone asks for the fingerprint or the face at once; if that is
// cancelled, one big button asks again. The only other way in is signing in again with the account.
interface AuthLockScreenProps {
    onUnlock: () => Promise<boolean>;
    /** Asked by the phone as soon as the screen shows (off in tests) */
    autoPrompt?: boolean;
}
const noop = () => { };
export function AuthLockScreen({ onUnlock, autoPrompt = true }: AuthLockScreenProps) {
    const { t } = useLanguage();
    const titleId = useId();
    const panelRef = useRef<HTMLDivElement>(null);
    const [busy, setBusy] = useState(false);
    const [failed, setFailed] = useState(false);
    useOverlay(true, noop, panelRef);
    const ask = async () => {
        if (busy) return;
        setBusy(true);
        const ok = await onUnlock();
        setBusy(false);
        setFailed(!ok);
    };
    useEffect(() => {
        if (autoPrompt) void ask();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const signInAgain = async () => {
        authLockStore.releaseAfterSignIn();
        await signOut(auth).catch(() => undefined);
    };
    return (<div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} className="fixed inset-0 z-[80] flex flex-col items-center justify-center overflow-y-auto bg-app-bg px-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-[max(env(safe-area-inset-top),1.5rem)] text-neutral-900 outline-none">
        <div className="flex w-full max-w-xs flex-col items-center text-center">
            <h1 id={titleId} className="text-lg font-bold">{t('lock.title')}</h1>
            <p className="mt-1 text-sm text-neutral-500">{t('lock.useBiometrics')}</p>
            <button type="button" onClick={ask} disabled={busy} aria-label={t('lock.unlock')} className="mt-8 flex h-24 w-24 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/30 transition-colors active:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60">
                <FingerprintIcon aria-hidden="true" className="h-12 w-12"/>
            </button>
            <p className="mt-3 text-sm font-semibold text-primary">{t('lock.unlock')}</p>
            <p role="alert" className="mt-3 min-h-5 text-sm font-semibold text-financial-loss">{failed ? t('lock.notRecognised') : ''}</p>
            <button type="button" onClick={signInAgain} className="mt-8 text-sm font-semibold text-neutral-600 underline underline-offset-4">{t('lock.signInAgain')}</button>
        </div>
    </div>);
}
