import { useEffect, useId, useRef, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { PIN_MAX_LENGTH, PIN_MIN_LENGTH } from '../hooks/useAuthLock';
import { DeleteLeftIcon } from './icons/DeleteLeftIcon';
import { LockIcon } from './icons/LockIcon';
import { useOverlay } from './ui/overlayStack';
interface AuthLockScreenProps {
    onUnlock: (pin: string) => Promise<boolean>;
    /** Nombre de chiffres du code ; null pour un ancien code dont la longueur n'a pas été retenue */
    pinLength?: number | null;
}
const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
const noop = () => { };
const keyClass = 'flex h-16 w-16 items-center justify-center rounded-full text-2xl font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50';
export function AuthLockScreen({ onUnlock, pinLength = null }: AuthLockScreenProps) {
    const { t } = useLanguage();
    const titleId = useId();
    const panelRef = useRef<HTMLDivElement>(null);
    const known = pinLength !== null && pinLength >= PIN_MIN_LENGTH && pinLength <= PIN_MAX_LENGTH;
    const maxLength = known ? pinLength : PIN_MAX_LENGTH;
    const [pin, setPinState] = useState('');
    const [error, setError] = useState('');
    const pinRef = useRef('');
    const checkingRef = useRef(false);
    // Au-dessus de toute fenêtre ouverte : Échap et le bouton retour ne ferment rien derrière.
    useOverlay(true, noop, panelRef);
    const setPin = (next: string) => {
        pinRef.current = next;
        setPinState(next);
    };
    const submit = async (value: string) => {
        checkingRef.current = true;
        const ok = await onUnlock(value);
        checkingRef.current = false;
        if (ok)
            return;
        setError(t('lock.wrongCode'));
        // Ancien code de longueur inconnue : les chiffres restent, pour pouvoir continuer
        // jusqu'à 5 ou 6 chiffres ; on efface tout au 6e.
        if (known || value.length >= PIN_MAX_LENGTH)
            setPin('');
    };
    const press = (digit: string) => {
        const current = pinRef.current;
        if (checkingRef.current || current.length >= maxLength)
            return;
        const next = current + digit;
        setPin(next);
        setError('');
        if (known ? next.length === pinLength : next.length >= PIN_MIN_LENGTH)
            void submit(next);
    };
    const erase = () => {
        if (checkingRef.current)
            return;
        setPin(pinRef.current.slice(0, -1));
        setError('');
    };
    // Clavier physique (ordinateur) : chiffres et retour arrière.
    const keysRef = useRef({ press, erase });
    keysRef.current = { press, erase };
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.ctrlKey || event.metaKey || event.altKey)
                return;
            if (/^[0-9]$/.test(event.key)) {
                event.preventDefault();
                keysRef.current.press(event.key);
            }
            else if (event.key === 'Backspace') {
                event.preventDefault();
                keysRef.current.erase();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);
    const slots = known ? pinLength : Math.max(PIN_MIN_LENGTH, pin.length);
    const subtitle = known
        ? String(t('lock.enterCodeDigits')).replace('{count}', String(pinLength))
        : t('lock.enterCodeRange');
    return (<div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} className="fixed inset-0 z-[80] flex flex-col items-center justify-center overflow-y-auto bg-app-bg px-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-[max(env(safe-area-inset-top),1.5rem)] text-neutral-900 outline-none">
            <div className="flex w-full max-w-xs flex-col items-center text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20">
                    <LockIcon aria-hidden="true" className="h-7 w-7 text-primary"/>
                </div>
                <h1 id={titleId} className="text-lg font-bold">{t('lock.title')}</h1>
                <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>

                <div dir="ltr" aria-hidden="true" className="mt-6 flex h-4 items-center gap-3">
                    {Array.from({ length: slots }).map((_, i) => (<span key={i} className={`h-3.5 w-3.5 rounded-full transition-colors ${i < pin.length ? (error ? 'bg-financial-loss' : 'bg-primary') : 'border-2 border-neutral-300'}`}/>))}
                </div>
                <p role="alert" className="mt-3 min-h-5 text-sm font-semibold text-financial-loss">{error}</p>

                <div dir="ltr" className="mt-4 grid grid-cols-3 gap-x-6 gap-y-4">
                    {DIGITS.map(digit => (<button key={digit} type="button" onClick={() => press(digit)} className={`${keyClass} border border-border bg-surface text-neutral-900 shadow-card active:bg-neutral-100`}>
                            {digit}
                        </button>))}
                    <span aria-hidden="true"/>
                    <button type="button" onClick={() => press('0')} className={`${keyClass} border border-border bg-surface text-neutral-900 shadow-card active:bg-neutral-100`}>
                        0
                    </button>
                    <button type="button" onClick={erase} disabled={pin.length === 0} aria-label={t('lock.erase')} className={`${keyClass} text-neutral-600 active:bg-neutral-100`}>
                        <DeleteLeftIcon aria-hidden="true" className="h-7 w-7"/>
                    </button>
                </div>
            </div>
        </div>);
}
