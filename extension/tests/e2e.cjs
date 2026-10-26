// End-to-end check in real Chromium with the built extension loaded (requires `npm run build`).
const { chromium } = require('playwright');
const http = require('node:http');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const assert = require('node:assert/strict');

const PAGE = `<!doctype html><meta charset=utf-8><body>
<textarea id=ta rows=3></textarea><input id=inp type=text><input id=pw type=password>
<div id=ce contenteditable=true style="min-height:40px;border:1px solid"></div>
<iframe id=fr srcdoc="<body contenteditable=true style='min-height:40px'></body>"></iframe></body>`;

(async () => {
  const server = http.createServer((_, res) => { res.setHeader('content-type', 'text/html'); res.end(PAGE); });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/`;
  const ext = path.resolve(__dirname, '../dist');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'kf-'));
  const ctx = await chromium.launchPersistentContext(profile, {
    headless: false,
    args: ['--headless=new', `--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
  });
  let worker = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'));
  const page = await ctx.newPage();
  await page.goto(url);
  await page.waitForTimeout(500);

  const type = async (sel, text) => { await page.click(sel); await page.keyboard.type(text, { delay: 15 }); await page.waitForTimeout(400); };
  const val = (sel) => page.$eval(sel, (e) => e.value ?? e.textContent);
  const results = [];
  const check = async (name, fn) => { try { await fn(); results.push(['PASS', name]); } catch (e) { results.push(['FAIL', name, e.message.split('\n').slice(0,6).join(' ')]); } };

  await check('textarea: en->he', async () => { await type('#ta', 'akuo tck '); assert.equal(await val('#ta'), 'שלום אבל '); });
  await check('textarea: caret after boundary, typing continues', async () => { await page.keyboard.type('hello ', { delay: 15 }); await page.waitForTimeout(400); assert.equal(await val('#ta'), 'שלום אבל hello '); });
  await check('input: he->en', async () => { await type('#inp', 'יקךךם '); assert.equal(await val('#inp'), 'hello '); });
  await check('input: punctuation kept', async () => { await page.fill('#inp', ''); await type('#inp', 'akuo, '); assert.equal(await val('#inp'), 'שלום, '); });
  await check('input: correct words untouched', async () => { await page.fill('#inp', ''); await type('#inp', 'hello world שלום '); assert.equal(await val('#inp'), 'hello world שלום '); });
  await check('input: undo restores original', async () => { await page.fill('#inp', ''); await type('#inp', 'akuo '); await page.keyboard.press('Control+z'); await page.waitForTimeout(200); assert.equal((await val('#inp')).trim(), 'akuo'); });
  await check('password untouched', async () => { await type('#pw', 'akuo '); assert.equal(await val('#pw'), 'akuo '); });
  await check('contenteditable: en->he', async () => { await type('#ce', 'akuo tck '); assert.equal((await val('#ce')).replace(/ /g, ' '), 'שלום אבל '); });
  await check('srcdoc iframe editor (match_origin_as_fallback): en->he', async () => {
    const frame = page.frameLocator('#fr');
    await frame.locator('body').click();
    await page.keyboard.type('akuo ', { delay: 15 });
    await page.waitForTimeout(400);
    assert.equal((await frame.locator('body').textContent()).replace(/\u00a0/g, ' '), 'שלום ');
  });
  await check('manual shortcut path: convert message', async () => {
    await page.fill('#inp', 'tk,');
    await page.click('#inp'); await page.keyboard.press('End');
    await worker.evaluate(async () => { const [t] = await chrome.tabs.query({ active: true }); await chrome.tabs.sendMessage(t.id, { type: 'convert' }); });
    await page.waitForTimeout(300);
    assert.equal(await val('#inp'), 'אלת');
  });
  await check('disabled host respected', async () => {
    await worker.evaluate(() => chrome.storage.local.set({ disabledHosts: ['127.0.0.1'] }));
    await page.waitForTimeout(300);
    await page.fill('#inp', ''); await type('#inp', 'akuo ');
    assert.equal(await val('#inp'), 'akuo ');
    await worker.evaluate(() => chrome.storage.local.set({ disabledHosts: [] }));
  });

  for (const r of results) console.log(r.join(' | '));
  await ctx.close(); server.close();
  process.exit(results.some((r) => r[0] === 'FAIL') ? 1 : 0);
})();
