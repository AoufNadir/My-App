import { useEffect, useRef, useSyncExternalStore } from 'react';

/**
 * V14-1: the app locks itself like a banking app, with the phone's fingerprint or face (WebAuthn, a passkey kept on
 * the phone). It locks when opened and after 3 minutes without use. The PIN code is gone: a PIN saved by an older
 * version is removed on first load. If the phone cannot verify, the only way back in is signing in again.
 *
 * The lock guards the screen of this phone; the data itself is guarded by the sign-in, as before.
 */
const BIO_ENABLED_KEY = 'app_bio_enabled';
const BIO_CREDENTIAL_KEY = 'app_bio_credential';
const LEGACY_PIN_KEYS = ['app_pin_hash', 'app_pin_enabled', 'app_pin_length'];
export const AUTO_LOCK_MS = 3 * 60 * 1000;

export interface AuthLockState {
    enabled: boolean;
    isLocked: boolean;
}
export interface LockStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}
/** What the phone does: create a passkey (returns its id) and ask for the fingerprint/face on it. */
export interface Biometrics {
    available(): Promise<boolean>;
    register(): Promise<string>;
    verify(credentialId: string): Promise<boolean>;
}

export function createAuthLockStore(storage: LockStorage | null, biometrics: Biometrics) {
    const memory = new Map<string, string>();
    const read = (key: string) => (storage ? storage.getItem(key) : memory.get(key) ?? null);
    const write = (key: string, value: string) => (storage ? storage.setItem(key, value) : memory.set(key, value));
    const remove = (key: string) => (storage ? storage.removeItem(key) : memory.delete(key));
    LEGACY_PIN_KEYS.forEach(remove);
    const listeners = new Set<() => void>();
    let state: AuthLockState | null = null;
    let lastActivity = Date.now();
    const getState = (): AuthLockState => {
        if (!state) {
            const enabled = read(BIO_ENABLED_KEY) === '1' && Boolean(read(BIO_CREDENTIAL_KEY));
            state = { enabled, isLocked: enabled };
        }
        return state;
    };
    const setState = (patch: Partial<AuthLockState>) => {
        state = { ...getState(), ...patch };
        listeners.forEach((listener) => listener());
    };
    return {
        getState,
        subscribe(listener: () => void) {
            listeners.add(listener);
            return () => { listeners.delete(listener); };
        },
        bumpActivity() { lastActivity = Date.now(); },
        idleFor() { return Date.now() - lastActivity; },
        lock() {
            if (getState().enabled) setState({ isLocked: true });
        },
        /** Fingerprint or face on this phone. False when refused or cancelled. */
        async unlock(): Promise<boolean> {
            const id = read(BIO_CREDENTIAL_KEY);
            if (!id) {
                setState({ isLocked: false });
                return true;
            }
            const ok = await biometrics.verify(id).catch(() => false);
            if (ok) {
                lastActivity = Date.now();
                setState({ isLocked: false });
            }
            return ok;
        },
        /** Turned on from the settings: the phone asks for the fingerprint/face once to make the passkey. */
        async enable(): Promise<boolean> {
            const id = await biometrics.register().catch(() => '');
            if (!id) return false;
            write(BIO_CREDENTIAL_KEY, id);
            write(BIO_ENABLED_KEY, '1');
            lastActivity = Date.now();
            setState({ enabled: true, isLocked: false });
            return true;
        },
        disable() {
            remove(BIO_CREDENTIAL_KEY);
            remove(BIO_ENABLED_KEY);
            setState({ enabled: false, isLocked: false });
        },
        /** After signing in again (the way out when the phone cannot verify): open, the lock stays on. */
        releaseAfterSignIn() {
            lastActivity = Date.now();
            setState({ isLocked: false });
        },
        available: () => biometrics.available().catch(() => false),
    };
}
export type AuthLockStore = ReturnType<typeof createAuthLockStore>;

const toB64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64 = (text: string) => Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const random = (n: number) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return a; };
export const webAuthnBiometrics: Biometrics = {
    async available() {
        const pkc = typeof window !== 'undefined' ? (window as unknown as { PublicKeyCredential?: { isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean> } }).PublicKeyCredential : undefined;
        return Boolean(pkc?.isUserVerifyingPlatformAuthenticatorAvailable && await pkc.isUserVerifyingPlatformAuthenticatorAvailable());
    },
    async register() {
        const credential = await navigator.credentials.create({
            publicKey: {
                challenge: random(32),
                rp: { name: 'ProDigital', id: window.location.hostname },
                user: { id: random(16), name: 'ProDigital', displayName: 'ProDigital' },
                pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
                authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
                timeout: 60_000,
            },
        }) as PublicKeyCredential | null;
        return credential ? toB64(credential.rawId) : '';
    },
    async verify(credentialId) {
        const assertion = await navigator.credentials.get({
            publicKey: {
                challenge: random(32),
                allowCredentials: [{ type: 'public-key', id: fromB64(credentialId) }],
                userVerification: 'required',
                timeout: 60_000,
            },
        });
        return Boolean(assertion);
    },
};
function browserStorage(): LockStorage | null {
    try {
        return typeof window !== 'undefined' ? window.localStorage : null;
    }
    catch {
        return null;
    }
}
export const authLockStore: AuthLockStore = createAuthLockStore(browserStorage(), webAuthnBiometrics);

export function useAuthLock(options: { autoLockMs?: number } = {}) {
    const autoLockMs = options.autoLockMs ?? AUTO_LOCK_MS;
    const { enabled, isLocked } = useSyncExternalStore(authLockStore.subscribe, authLockStore.getState, authLockStore.getState);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        if (!enabled) return;
        const bump = () => authLockStore.bumpActivity();
        const check = () => {
            const idle = authLockStore.idleFor();
            if (idle >= autoLockMs) authLockStore.lock();
            else timerRef.current = setTimeout(check, autoLockMs - idle);
        };
        const onVisibility = () => {
            if (document.visibilityState === 'hidden') bump();
            else if (authLockStore.idleFor() >= autoLockMs) authLockStore.lock();
        };
        const events: ReadonlyArray<keyof WindowEventMap> = ['mousemove', 'keydown', 'touchstart', 'click'];
        events.forEach((ev) => window.addEventListener(ev, bump, { passive: true }));
        document.addEventListener('visibilitychange', onVisibility);
        timerRef.current = setTimeout(check, autoLockMs);
        return () => {
            events.forEach((ev) => window.removeEventListener(ev, bump));
            document.removeEventListener('visibilitychange', onVisibility);
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [enabled, autoLockMs]);
    return {
        enabled,
        isLocked: enabled && isLocked,
        lock: authLockStore.lock,
        unlock: authLockStore.unlock,
        enable: authLockStore.enable,
        disable: authLockStore.disable,
        releaseAfterSignIn: authLockStore.releaseAfterSignIn,
        available: authLockStore.available,
    };
}
