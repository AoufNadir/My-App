// V24-3: the app's everyday paths, run in a real browser against the local emulator (fake data from e2e/seed.mjs).
// Each flow checks what the owner would see. Run with `npm run e2e` (see e2e/README.md).
import { createRequire } from 'node:module';
// Playwright may be installed globally (require resolves it, an ESM import does not).
const { chromium } = createRequire(import.meta.url)('playwright');
import assert from 'node:assert/strict';

const BASE = process.env.E2E_URL || 'http://127.0.0.1:4173/';
const results = [];
const flow = async (name, run) => {
    const started = Date.now();
    try { await run(); results.push(`✅ ${name} (${Date.now() - started} ms)`); }
    catch (error) {
        results.push(`❌ ${name}: ${String(error?.message || error).split('\n')[0]}`);
        await page.screenshot({ path: new URL(`.fail-${results.length}.png`, import.meta.url).pathname }).catch(() => undefined);
        await page.keyboard.press('Escape').catch(() => undefined);
    }
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
await context.addInitScript(() => { try { localStorage.setItem('app_lang', 'fr'); } catch { /* */ } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const navTo = (index) => page.locator('nav.bottom-0 button').nth(index).click(); // the bottom bar (the client page has its own nav)
const dialog = () => page.locator('[role=dialog]').last();
const homeReady = () => page.waitForFunction(() => /Solde Caisse/.test(document.body.innerText) && !document.querySelector('.animate-pulse'), null, { timeout: 90_000 });
const caisse = async () => {
    await navTo(0); await homeReady();
    const text = await page.locator('text=Solde Caisse').locator('xpath=ancestor::*[contains(@class,"rounded")][1]').innerText();
    return Number(text.replace(/[^\d,]/g, '').replace(',', '.'));
};

await flow('Connexion et accueil', async () => {
    await page.goto(BASE);
    await page.fill('input[type=email]', 'demo@example.com');
    await page.fill('input[type=password]', 'demo1234');
    await page.keyboard.press('Enter');
    await homeReady();
});

let before = 0;
await flow('Vente USDT au comptant à un client', async () => {
    before = await caisse();
    await navTo(2);
    await dialog().locator('button', { hasText: 'Vendre' }).first().click();
    await dialog().locator('button', { hasText: /Vente avec DZD/ }).first().click();
    await dialog().locator('input').first().fill('Client B');
    await dialog().locator('button, [role=option]').filter({ hasText: 'Client B' }).first().click();
    await dialog().locator('button', { hasText: /esp[eè]ces/i }).first().click();
    await page.locator('[data-op-quantity] input').fill('100');
    const inputs = dialog().locator('input[inputmode=decimal]');
    for (let i = 0; i < await inputs.count(); i++) if (!(await inputs.nth(i).inputValue())) { await inputs.nth(i).fill('262'); break; }
    for (let i = 0; i < 2 && await dialog().locator('button', { hasText: 'Confirmer' }).count(); i++) {
        await dialog().locator('button', { hasText: 'Confirmer' }).click();
        await page.waitForTimeout(1500);
    }
    await page.locator('button', { hasText: 'Envoyer au client' }).first().waitFor({ timeout: 15_000 });
    assert.equal(await caisse(), before + 26_200);
});

await flow('Suppression puis « Annuler »', async () => {
    await navTo(1);
    await page.locator('text=Vente USDT').first().waitFor();
    // The delete button is in the row's swipe actions (hidden until a swipe): pressed directly.
    await page.evaluate(() => { const b = [...document.querySelectorAll('button[aria-label]')].find((x) => x.getAttribute('aria-label') === 'Supprimer'); b?.click(); });
    await dialog().locator('button', { hasText: 'Supprimer' }).last().click();
    // « Annuler » of the message « Transaction supprimée. » (not a dialog's cancel button)
    await page.locator('div', { hasText: 'Transaction supprimée' }).locator('button', { hasText: 'Annuler' }).last().click({ timeout: 15_000 });
    await page.waitForTimeout(3000);
    const after = await caisse();
    assert.equal(after, before + 26_200, `caisse ${after} (avant la vente ${before})`);
});

await flow('Page client : solde et boutons', async () => {
    await navTo(3);
    // The app may still show the last client's page: back to the list first.
    await page.waitForTimeout(1000);
    const back = page.locator('button[aria-label="Retour"]');
    if (await back.count()) await back.first().click();
    await page.getByText('Client A', { exact: true }).first().click();
    await page.getByText('Encaisser', { exact: true }).first().waitFor();
});

await flow('Trésorerie et inventaire', async () => {
    await navTo(4);
    await page.getByRole('dialog', { name: 'Plus' }).locator('button', { hasText: 'Trésorerie' }).click();
    await page.locator('text=Inventaire').first().waitFor();
});

await flow('Aucune erreur JavaScript', async () => { assert.deepEqual(errors, []); });

await browser.close();
console.log(results.join('\n'));
if (results.some((line) => line.startsWith('❌'))) process.exit(1);
