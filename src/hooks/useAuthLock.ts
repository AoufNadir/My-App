import { useEffect, useRef, useSyncExternalStore } from 'react';
const PIN_HASH_KEY = 'app_pin_hash';
const PIN_ENABLED_KEY = 'app_pin_enabled';
const PIN_LENGTH_KEY = 'app_pin_length';
const AUTO_LOCK_MS = 3 * 60 * 1000; // 3 minutes
export const PIN_MIN_LENGTH = 4;
export const PIN_MAX_LENGTH = 6;
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
export interface AuthLockState {
    pinEnabled: boolean;
    isLocked: boolean;
    /** Digits in the PIN, or null for a PIN saved before its length was stored. */
    pinLength: number | null;
}
export interface PinStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}
/**
 * One lock state for the whole app. The lock screen (AppContent) and the
 * settings window each call useAuthLock, so they must read and change the
 * same values: "Verrouiller" and a newly enabled PIN act at once, not after
 * a reload. Without localStorage (unit tests) the values stay in memory.
 */
export function createAuthLockStore(storage: PinStorage | null) {
    const memory = new Map<string, string>();
    const read = (key: string) => (storage ? storage.getItem(key) : memory.get(key) ?? null);
    const write = (key: string, value: string) => {
        if (storage)
            storage.setItem(key, value);
        else
            memory.set(key, value);
    };
    const remove = (key: string) => {
        if (storage)
            storage.removeItem(key);
        else
            memory.delete(key);
    };
    const readLength = (): number | null => {
        const n = Number(read(PIN_LENGTH_KEY));
        return Number.isInteger(n) && n >= PIN_MIN_LENGTH && n <= PIN_MAX_LENGTH ? n : null;
    };
    const listeners = new Set<() => void>();
    let state: AuthLockState | null = null;
    let lastActivity = Date.now();
    const getState = (): AuthLockState => {
        if (!state) {
            const pinEnabled = read(PIN_ENABLED_KEY) === '1';
            // The lock screen is shown whenever `isLocked` is true AND a PIN is set.
            state = { pinEnabled, isLocked: pinEnabled, pinLength: pinEnabled ? readLength() : null };
        }
        return state;
    };
    const setState = (patch: Partial<AuthLockState>) => {
        state = { ...getState(), ...patch };
        listeners.forEach(listener => listener());
    };
    const clearPin = () => {
        remove(PIN_HASH_KEY);
        remove(PIN_ENABLED_KEY);
        remove(PIN_LENGTH_KEY);
        setState({ pinEnabled: false, isLocked: false, pinLength: null });
    };
    return {
        getState,
        subscribe(listener: () => void) {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        bumpActivity() {
            lastActivity = Date.now();
        },
        idleFor() {
            return Date.now() - lastActivity;
        },
        lock() {
            if (!getState().pinEnabled)
                return;
            setState({ isLocked: true });
        },
        async unlock(pinAttempt: string): Promise<boolean> {
            const stored = read(PIN_HASH_KEY) || '';
            if (!stored) {
                // No PIN set; treat as unlocked.
                setState({ isLocked: false });
                return true;
            }
            const hash = await sha256Hex(pinAttempt);
            if (hash !== stored)
                return false;
            // A PIN saved before its length was stored: remember it now, so the
            // lock screen asks for the right number of digits next time.
            if (readLength() === null)
                write(PIN_LENGTH_KEY, String(pinAttempt.length));
            lastActivity = Date.now();
            setState({ isLocked: false, pinLength: pinAttempt.length });
            return true;
        },
        async setPin(pin: string) {
            if (!pin || pin.length < PIN_MIN_LENGTH) {
                clearPin();
                return;
            }
            const hash = await sha256Hex(pin);
            write(PIN_HASH_KEY, hash);
            write(PIN_ENABLED_KEY, '1');
            write(PIN_LENGTH_KEY, String(pin.length));
            setState({ pinEnabled: true, isLocked: false, pinLength: pin.length });
        },
        disablePin() {
            clearPin();
        },
    };
}
export type AuthLockStore = ReturnType<typeof createAuthLockStore>;
function browserStorage(): PinStorage | null {
    try {
        return typeof window !== 'undefined' ? window.localStorage : null;
    }
    catch {
        return null;
    }
}
export const authLockStore: AuthLockStore = createAuthLockStore(browserStorage());
export interface UseAuthLockOptions {
    autoLockMs?: number;
}
export function useAuthLock(options: UseAuthLockOptions = {}) {
    const autoLockMs = options.autoLockMs ?? AUTO_LOCK_MS;
    const { pinEnabled, isLocked, pinLength } = useSyncExternalStore(authLockStore.subscribe, authLockStore.getState, authLockStore.getState);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Inactivity timer: lock when the page becomes hidden for too long, or
    // the user is idle past the threshold.
    useEffect(() => {
        if (!pinEnabled)
            return;
        const bumpActivity = () => {
            authLockStore.bumpActivity();
        };
        const checkAndLock = () => {
            const idleFor = authLockStore.idleFor();
            if (idleFor >= autoLockMs)
                authLockStore.lock();
            else {
                timerRef.current = setTimeout(checkAndLock, autoLockMs - idleFor);
            }
        };
        const onVisibility = () => {
            if (document.visibilityState === 'hidden') {
                bumpActivity();
            }
            else {
                const idleFor = authLockStore.idleFor();
                if (idleFor >= autoLockMs)
                    authLockStore.lock();
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
    }, [pinEnabled, autoLockMs]);
    return {
        pinEnabled,
        isLocked: pinEnabled && isLocked,
        pinLength,
        lock: authLockStore.lock,
        unlock: authLockStore.unlock,
        setPin: authLockStore.setPin,
        disablePin: authLockStore.disablePin,
    };
}
