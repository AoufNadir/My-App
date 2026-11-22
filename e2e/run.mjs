// V24-3: `npm run e2e` — builds the app for the emulator (VITE_E2E_EMULATOR=1, never the published build), starts the
// Firebase emulator (Auth + Firestore with the real rules, project demo-prodigital) and the preview, seeds fake data,
// runs e2e/flows.mjs, then stops everything. Needs Java (for the emulator) and Playwright's Chromium.
import { spawn, execSync } from 'node:child_process';
import { copyFileSync, openSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const firebaseTools = process.env.FIREBASE_TOOLS || 'npx --yes firebase-tools@13.29.1';
const env = { ...process.env, NO_UPDATE_NOTIFIER: '1', NO_PROXY: '127.0.0.1,localhost', no_proxy: '127.0.0.1,localhost' };
const children = [];
const log = openSync(path.join(root, 'e2e', '.run.log'), 'w');
const start = (cmd, cwd) => { const child = spawn(cmd, { cwd, env, shell: true, detached: true, stdio: ['ignore', log, log] }); children.push(child); return child; };
const stopAll = () => children.forEach((c) => { try { process.kill(-c.pid, 'SIGTERM'); } catch { /* gone */ } });
const waitFor = async (url, ms) => { const end = Date.now() + ms; while (Date.now() < end) { try { await fetch(url); return; } catch { await new Promise((r) => setTimeout(r, 1000)); } } throw new Error(`timeout: ${url}`); };

let code = 1;
try {
    execSync('npx vite build --outDir dist-e2e', { cwd: root, env: { ...env, VITE_E2E_EMULATOR: '1' }, stdio: 'inherit' });
    copyFileSync(path.join(root, 'firestore.rules'), path.join(root, 'e2e', '.firestore.rules')); // the emulator reads rules inside its folder only
    start(`${firebaseTools} emulators:start --only auth,firestore --project demo-prodigital`, path.join(root, 'e2e'));
    await waitFor('http://127.0.0.1:8080/', 120_000);
    await waitFor('http://127.0.0.1:9099/', 60_000);
    start('npx vite preview --outDir dist-e2e --port 4173 --strictPort --host 127.0.0.1', root);
    await waitFor('http://127.0.0.1:4173/', 60_000);
    execSync('node e2e/seed.mjs', { cwd: root, env, stdio: 'inherit' });
    execSync('node e2e/flows.mjs', { cwd: root, env, stdio: 'inherit' });
    code = 0;
} catch (error) {
    console.error(String(error?.message || error).split('\n')[0]);
} finally {
    stopAll();
}
process.exit(code);
