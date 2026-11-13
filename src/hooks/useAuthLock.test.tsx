import assert from 'node:assert/strict';
import { createAuthLockStore, type Biometrics, type LockStorage } from './useAuthLock';

// V14-1: the lock with the fingerprint or the face. A fake phone stands for WebAuthn.
const storage = (): LockStorage & { map: Map<string, string> } => {
    const map = new Map<string, string>();
    return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => { map.set(k, v); }, removeItem: (k) => { map.delete(k); } };
};
const phone = (answers: { register?: string; verify?: boolean; available?: boolean } = {}): Biometrics & { asked: number } => {
    const p = {
        asked: 0,
        available: async () => answers.available ?? true,
        register: async () => answers.register ?? 'cred-1',
        verify: async () => { p.asked += 1; return answers.verify ?? true; },
    };
    return p;
};
(async () => {
    // 1. An old PIN is removed: the owner is never stuck on a PIN screen that no longer exists.
    {
        const s = storage();
        s.setItem('app_pin_hash', 'x'); s.setItem('app_pin_enabled', '1'); s.setItem('app_pin_length', '4');
        const store = createAuthLockStore(s, phone());
        assert.deepEqual(store.getState(), { enabled: false, isLocked: false });
        assert.equal(s.map.size, 0, 'PIN keys removed');
    }
    // 2. Turned on: the phone makes the passkey; the app stays open now, and is locked at the next opening.
    {
        const s = storage();
        const store = createAuthLockStore(s, phone());
        assert.equal(await store.enable(), true);
        assert.deepEqual(store.getState(), { enabled: true, isLocked: false });
        const reopened = createAuthLockStore(s, phone());
        assert.deepEqual(reopened.getState(), { enabled: true, isLocked: true }, 'locked when opened');
        assert.equal(await reopened.unlock(), true);
        assert.equal(reopened.getState().isLocked, false, 'fingerprint or face: open');
    }
    // 3. Refused or cancelled: stays locked; « sign in again » opens it, the lock stays on.
    {
        const s = storage();
        await createAuthLockStore(s, phone()).enable();
        const store = createAuthLockStore(s, phone({ verify: false }));
        assert.equal(await store.unlock(), false);
        assert.equal(store.getState().isLocked, true);
        store.releaseAfterSignIn();
        assert.deepEqual(store.getState(), { enabled: true, isLocked: false });
    }
    // 4. The phone refuses to make the passkey: nothing is turned on.
    {
        const store = createAuthLockStore(storage(), phone({ register: '' }));
        assert.equal(await store.enable(), false);
        assert.deepEqual(store.getState(), { enabled: false, isLocked: false });
    }
    // 5. Lock now / turn off.
    {
        const s = storage();
        const store = createAuthLockStore(s, phone());
        await store.enable();
        store.lock();
        assert.equal(store.getState().isLocked, true);
        store.disable();
        assert.deepEqual(store.getState(), { enabled: false, isLocked: false });
        assert.equal(s.map.size, 0);
    }
    console.log('useAuthLock tests passed (fingerprint or face lock, PIN removed)');
})();
