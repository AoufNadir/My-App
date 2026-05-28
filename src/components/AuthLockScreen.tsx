import React, { useEffect, useRef, useState } from 'react';
interface AuthLockScreenProps {
    onUnlock: (pin: string) => Promise<boolean>;
}
const PIN_LENGTH = 4;
export function AuthLockScreen({ onUnlock }: AuthLockScreenProps) {
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [isChecking, setIsChecking] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    useEffect(() => {
        inputRef.current?.focus();
    }, []);
    const submit = async (value: string) => {
        if (isChecking)
            return;
        setIsChecking(true);
        const ok = await onUnlock(value);
        setIsChecking(false);
        if (!ok) {
            setError('Code incorrect');
            setPin('');
            inputRef.current?.focus();
        }
    };
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const next = e.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH);
        setPin(next);
        setError('');
        if (next.length === PIN_LENGTH) {
            void submit(next);
        }
    };
    return (<div role="dialog" aria-modal="true" aria-label="Verrouillage" className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-app-bg px-6 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] text-neutral-900">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8 text-primary">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"/>
                </svg>
            </div>
            <h1 className="text-lg font-semibold mb-1">Application verrouillée</h1>
            <p className="text-sm text-neutral-500 mb-6">Entrez votre code à {PIN_LENGTH} chiffres</p>

            <div className="flex gap-3 mb-4">
                {Array.from({ length: PIN_LENGTH }).map((_, i) => (<span key={i} className={`h-3 w-3 rounded-full transition-colors ${i < pin.length ? 'bg-primary' : 'bg-neutral-300'}`}/>))}
            </div>

            <input ref={inputRef} type="password" inputMode="numeric" pattern="[0-9]*" autoComplete="one-time-code" value={pin} onChange={handleChange} disabled={isChecking} aria-label="Code PIN" className="opacity-0 absolute w-px h-px"/>

            {error && <p className="mt-2 text-sm text-danger">{error}</p>}

            <button type="button" onClick={() => inputRef.current?.focus()} className="mt-8 min-h-touch rounded-md border border-border bg-surface px-5 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
                Saisir le code
            </button>
        </div>);
}
