import { useCallback, useEffect, useRef, useState } from 'react';
const PIN_HASH_KEY = 'app_pin_hash';
const PIN_ENABLED_KEY = 'app_pin_enabled';
const AUTO_LOCK_MS = 3 * 60 * 1000; // 3 minutes
async function sha256Hex(input: string): Promise<string> {
    if (typeof crypto === 'undefined' || !crypto.subtle) {
        // Fallback: use a non-cryptographic checksum so the feature still
        // works in environments without WebCrypto. Safe enough for an
        // on-device PIN that never leaves the browser.
        let h = 0;
        for (let i = 0; i < input.length; i++) {
            h = (h * 31 + input.charCodeAt(i)) | 0;
        }
        return `legacy:${(h >>> 0).toString(16)}`;
    }
    const data = new TextEncoder().encode(input);
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}
export interface UseAuthLockOptions {
    autoLockMs?: number;
}
export function useAuthLock(options: UseAuthLockOptions = {}) {
    const autoLockMs = options.autoLockMs ?? AUTO_LOCK_MS;
    const [pinEnabled, setPinEnabledState] = useState<boolean>(() => {
        if (typeof window === 'undefined')
            return false;
        return window.localStorage.getItem(PIN_ENABLED_KEY) === '1';
    });
    // The lock screen is shown whenever `isLocked` is true AND a PIN is set.
    const [isLocked, setIsLocked] = useState<boolean>(pinEnabled);
    const lastActivityRef = useRef<number>(Date.now());
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lock = useCallback(() => {
        if (!pinEnabled)
            return;
        setIsLocked(true);
    }, [pinEnabled]);
    const unlock = useCallback(async (pinAttempt: string): Promise<boolean> => {
        const stored = typeof window !== 'undefined'
            ? window.localStorage.getItem(PIN_HASH_KEY) || ''
            : '';
        if (!stored) {
            // No PIN set; treat as unlocked.
            setIsLocked(false);
            return true;
        }
        const hash = await sha256Hex(pinAttempt);
        if (hash === stored) {
            setIsLocked(false);
            lastActivityRef.current = Date.now();
            return true;
        }
        return false;
    }, []);
    const setPin = useCallback(async (pin: string) => {
        if (typeof window === 'undefined')
            return;
        if (!pin || pin.length < 4) {
            window.localStorage.removeItem(PIN_HASH_KEY);
            window.localStorage.removeItem(PIN_ENABLED_KEY);
            setPinEnabledState(false);
            setIsLocked(false);
            return;
        }
        const hash = await sha256Hex(pin);
        window.localStorage.setItem(PIN_HASH_KEY, hash);
        window.localStorage.setItem(PIN_ENABLED_KEY, '1');
        setPinEnabledState(true);
        setIsLocked(false);
    }, []);
    const disablePin = useCallback(() => {
        if (typeof window === 'undefined')
            return;
        window.localStorage.removeItem(PIN_HASH_KEY);
        window.localStorage.removeItem(PIN_ENABLED_KEY);
        setPinEnabledState(false);
        setIsLocked(false);
    }, []);
    // Inactivity timer: lock when the page becomes hidden for too long, or
    // the user is idle past the threshold.
    useEffect(() => {
        if (!pinEnabled)
            return;
        const bumpActivity = () => {
            lastActivityRef.current = Date.now();
        };
        const checkAndLock = () => {
            const idleFor = Date.now() - lastActivityRef.current;
            if (idleFor >= autoLockMs)
                lock();
            else {
                timerRef.current = setTimeout(checkAndLock, autoLockMs - idleFor);
            }
        };
        const onVisibility = () => {
            if (document.visibilityState === 'hidden') {
                bumpActivity();
            }
            else {
                const idleFor = Date.now() - lastActivityRef.current;
                if (idleFor >= autoLockMs)
                    lock();
            }
        };
        const events: ReadonlyArray<keyof WindowEventMap> = ['mousemove', 'keydown', 'touchstart', 'click'];
        events.forEach(ev => window.addEventListener(ev, bumpActivity, { passive: true } as any));
        document.addEventListener('visibilitychange', onVisibility);
        timerRef.current = setTimeout(checkAndLock, autoLockMs);
        return () => {
            events.forEach(ev => window.removeEventListener(ev, bumpActivity as any));
            document.removeEventListener('visibilitychange', onVisibility);
            if (timerRef.current)
                clearTimeout(timerRef.current);
        };
    }, [pinEnabled, autoLockMs, lock]);
    return {
        pinEnabled,
        isLocked: pinEnabled && isLocked,
        lock,
        unlock,
        setPin,
        disablePin,
    };
}
