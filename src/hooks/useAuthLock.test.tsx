import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { authLockStore, createAuthLockStore, useAuthLock, type PinStorage } from './useAuthLock';

// The lock screen used to accept only 4 digits: a 5- or 6-digit PIN locked its owner out, and
// « Verrouiller » or a new PIN only reached the lock screen after a reload. Now one store holds
// the lock for the whole app, the PIN keeps its length (4 to 6 digits), and a PIN saved before
// its length was kept still opens the app and has its length remembered.

function memoryStorage(initial: Record<string, string> = {}) {
    const data = new Map(Object.entries(initial));
    const storage: PinStorage = {
        getItem: (key) => (data.has(key) ? data.get(key)! : null),
        setItem: (key, value) => { data.set(key, value); },
        removeItem: (key) => { data.delete(key); },
    };
    return { data, storage };
}
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

// No PIN: nothing is locked, and « Verrouiller » does nothing.
{
    const { storage } = memoryStorage();
    const store = createAuthLockStore(storage);
    assert.deepEqual(store.getState(), { pinEnabled: false, isLocked: false, pinLength: null });
    store.lock();
    assert.equal(store.getState().isLocked, false, 'nothing to lock without a PIN');
    assert.equal(await store.unlock('1234'), true, 'without a PIN the app is open');
}

// A 4-, 5- or 6-digit PIN: saved with its length, locks at once, opens with the right digits only.
for (const pin of ['4829', '48291', '482917']) {
    const { data, storage } = memoryStorage();
    const store = createAuthLockStore(storage);
    await store.setPin(pin);
    assert.deepEqual(store.getState(), { pinEnabled: true, isLocked: false, pinLength: pin.length });
    assert.equal(data.get('app_pin_hash'), sha256(pin), 'the PIN is kept as its SHA-256 hash');
    assert.equal(data.get('app_pin_enabled'), '1');
    assert.equal(data.get('app_pin_length'), String(pin.length));
    store.lock();
    assert.equal(store.getState().isLocked, true, `« Verrouiller » locks a ${pin.length}-digit PIN at once`);
    assert.equal(await store.unlock(pin.slice(0, 4) === pin ? '1111' : pin.slice(0, 4)), false, 'the wrong digits keep it locked');
    assert.equal(store.getState().isLocked, true);
    assert.equal(await store.unlock(pin), true);
    assert.equal(store.getState().isLocked, false);
    // Reopening the app: locked from the start, and the lock screen knows how many digits to ask.
    const reopened = createAuthLockStore(storage);
    assert.deepEqual(reopened.getState(), { pinEnabled: true, isLocked: true, pinLength: pin.length });
}

// A 6-digit PIN saved by the previous version, without its length: it opens, and the length
// is remembered for next time.
{
    const { data, storage } = memoryStorage({ app_pin_hash: sha256('730164'), app_pin_enabled: '1' });
    const store = createAuthLockStore(storage);
    assert.deepEqual(store.getState(), { pinEnabled: true, isLocked: true, pinLength: null });
    assert.equal(await store.unlock('7301'), false, 'its first 4 digits are not enough');
    assert.equal(await store.unlock('73016'), false);
    assert.equal(data.has('app_pin_length'), false, 'a wrong try remembers nothing');
    assert.equal(await store.unlock('730164'), true);
    assert.deepEqual(store.getState(), { pinEnabled: true, isLocked: false, pinLength: 6 });
    assert.equal(data.get('app_pin_length'), '6');
    assert.equal(createAuthLockStore(storage).getState().pinLength, 6, 'next time the lock screen asks for 6 digits');
}

// A length that is not 4 to 6 is ignored rather than trusted.
for (const length of ['3', '7', 'abc', '']) {
    const { storage } = memoryStorage({ app_pin_hash: sha256('4829'), app_pin_enabled: '1', app_pin_length: length });
    assert.equal(createAuthLockStore(storage).getState().pinLength, null, `stored length ${JSON.stringify(length)}`);
}

// Turning the PIN off, or saving fewer than 4 digits, removes it everywhere.
{
    const { data, storage } = memoryStorage();
    const store = createAuthLockStore(storage);
    await store.setPin('48291');
    store.lock();
    store.disablePin();
    assert.deepEqual(store.getState(), { pinEnabled: false, isLocked: false, pinLength: null });
    assert.deepEqual([...data.keys()], [], 'hash, switch and length are all removed');
    await store.setPin('48291');
    await store.setPin('12');
    assert.equal(store.getState().pinEnabled, false);
    assert.deepEqual([...data.keys()], []);
}

// Everyone reading the store hears each change (the settings window and the lock screen).
{
    const store = createAuthLockStore(memoryStorage().storage);
    const heard: string[] = [];
    const stopA = store.subscribe(() => heard.push(`A:${store.getState().isLocked}`));
    store.subscribe(() => heard.push(`B:${store.getState().isLocked}`));
    await store.setPin('4829');
    store.lock();
    stopA();
    await store.unlock('4829');
    assert.deepEqual(heard, ['A:false', 'B:false', 'A:true', 'B:true', 'B:false']);
}

// Without localStorage (tests, private browsing that refuses it) the store keeps its values in memory.
{
    const store = createAuthLockStore(null);
    await store.setPin('48291');
    store.lock();
    assert.equal(await store.unlock('48291'), true);
    assert.equal(store.getState().pinLength, 5);
}

// useAuthLock reads the one store of the app: two parts of the screen see the same PIN.
function PinState({ name }: { name: string }) {
    const { pinEnabled, isLocked, pinLength } = useAuthLock();
    return <span>{`${name}:${pinEnabled}:${isLocked}:${pinLength}`}</span>;
}
const screen = () => renderToStaticMarkup(<><PinState name="settings"/><PinState name="lock"/></>);
assert.equal(screen(), '<span>settings:false:false:null</span><span>lock:false:false:null</span>');
await authLockStore.setPin('482917');
authLockStore.lock();
assert.equal(screen(), '<span>settings:true:true:6</span><span>lock:true:true:6</span>');
authLockStore.disablePin();
assert.equal(screen(), '<span>settings:false:false:null</span><span>lock:false:false:null</span>');

console.log('useAuthLock.test: PINs of 4 to 6 digits lock and open, an old PIN has its length remembered, and every part of the app shares one lock');
