const fs = require('fs');
const { chromium } = require('playwright');

(async () => {
  const url = process.argv[2] || 'https://proodigital-7ec70--test-a47n5lr6.web.app/';
  const out = { url, console: [], errors: [], responses: [], failedRequests: [], pageErrors: [] };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => {
    out.console.push({ type: msg.type(), text: msg.text() });
  });

  page.on('pageerror', err => {
    out.pageErrors.push(String(err));
  });

  page.on('requestfailed', req => {
    out.failedRequests.push({ url: req.url(), failure: (req.failure() || {}).errorText });
  });

  page.on('response', async res => {
    try {
      const status = res.status();
      const url = res.url();
      if (status >= 400) {
        out.responses.push({ url, status, statusText: res.statusText() });
      }
    } catch (e) {
      out.errors.push(String(e));
    }
  });

  try {
    const resp = await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    out.mainStatus = resp ? resp.status() : null;
  } catch (e) {
    out.errors.push('goto-error: ' + String(e));
  }

  // wait a bit to let lazy scripts run
  await page.waitForTimeout(5000);

  // capture screenshot for visual clue
  try {
    const shot = await page.screenshot({ fullPage: true });
    fs.writeFileSync('deploy-screenshot.png', shot);
    out.screenshot = 'deploy-screenshot.png';
  } catch (e) {
    out.errors.push('screenshot-error: ' + String(e));
  }

  await browser.close();

  fs.writeFileSync('deploy-inspect.json', JSON.stringify(out, null, 2));
  console.log('Wrote deploy-inspect.json and deploy-screenshot.png (if created)');
  console.log(JSON.stringify(out, null, 2));
})().catch(e => { console.error(e); process.exit(1); });
