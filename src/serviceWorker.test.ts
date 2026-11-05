import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// V9-13: the service worker leaves Firebase/Google API requests to the browser. Proxying Firestore's long
// Listen channel through respondWith(fetch()) made every cancelled request a « Failed to fetch » in the console.

const source = readFileSync(new URL('../public/service-worker.js', import.meta.url), 'utf8');
const start = source.indexOf("url.hostname === 'firestore.googleapis.com'");
assert.ok(start > 0, 'the Firebase hosts are still listed');
const block = source.slice(start, source.indexOf('// Network-first for the app shell', start));
for (const host of ['firestore.googleapis.com', 'identitytoolkit.googleapis.com', 'securetoken.googleapis.com', 'firebaseinstallations.googleapis.com'])
    assert.ok(block.includes(host), `${host} is not intercepted`);
assert.ok(!/event\.respondWith\(/.test(block), 'no event.respondWith(...) for those hosts');
assert.match(block, /return;/, 'the handler returns, so the browser handles the request itself');
// The push and notification click handlers of V9-4 are still there.
assert.ok(source.includes("addEventListener('push'") && source.includes("addEventListener('notificationclick'"));
console.log('service worker tests passed');
