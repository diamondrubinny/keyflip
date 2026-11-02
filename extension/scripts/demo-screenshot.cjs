// Real screenshot of the extension at work: Chromium with the built extension (npm run build) and all four languages on.
// Every field is typed in the wrong layout key by key; the corrections on the picture are made by KeyFlip itself.
// Usage: [FONTS=<folder with Heebo.ttf, NotoSansArabic.ttf>] node scripts/demo-screenshot.cjs [out.png]
const { chromium } = require('playwright');
const http = require('node:http');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');

const out = path.resolve(process.argv[2] ?? path.join(__dirname, '../../docs/screenshots/demo-languages.png'));
const fontFace = (family, file) => {
  const p = process.env.FONTS && path.join(process.env.FONTS, file);
  return p && fs.existsSync(p) ? `@font-face{font-family:${family};src:url(/fonts/${file})}` : '';
};

const FIELDS = [
  { id: 'he', label: 'Message (Hebrew)', dir: 'rtl', typed: 'akuo jcrho thl gucr gkhfo vhuo ' },
  { id: 'en', label: 'Subject (English)', dir: 'ltr', typed: "יקךךם 'םרךג קהקרטאיןמע 'םרלד ערקשא " },
  { id: 'ru', label: 'Message (Russian)', dir: 'ltr', typed: 'ghbdtn lhepmz rfr e dfc ltkf ' },
  { id: 'ar', label: 'Message (Arabic)', dir: 'rtl', typed: 'Hkh fodv a;vh ;dt phg; ' },
];

const PAGE = `<!doctype html><meta charset=utf-8><title>KeyFlip demo</title><style>
${fontFace('Heebo', 'Heebo.ttf')}${fontFace('NotoArabic', 'NotoSansArabic.ttf')}
*{box-sizing:border-box;margin:0}
body{font-family:Inter,Heebo,NotoArabic,system-ui,sans-serif;background:linear-gradient(180deg,#eef1fb,#f6f7fb);color:#0f172a;
 width:1366px;height:768px;display:flex;align-items:center;justify-content:center}
.card{width:1180px;background:#fff;border-radius:18px;box-shadow:0 20px 50px rgba(15,23,42,.12);padding:30px 40px 24px}
h1{font-size:30px;font-weight:700}
.sub{color:#64748b;font-size:18px;margin:6px 0 16px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px 26px}
label{display:block;font-size:16px;font-weight:600;color:#475569;margin-bottom:6px}
input{width:100%;font:inherit;font-size:28px;padding:16px 18px;border:2px solid #cbd5e1;border-radius:12px;color:#0f172a}
input:focus{outline:none;border-color:#6366f1;box-shadow:0 0 0 4px rgba(99,102,241,.15)}
.foot{color:#94a3b8;font-size:15px;margin-top:16px}
</style>
<div class=card><h1>New message</h1>
<div class=sub>Type naturally — KeyFlip fixes words typed in the wrong keyboard layout.</div>
<div class=grid>${FIELDS.map((f) => `<div><label for=${f.id}>${f.label}</label><input id=${f.id} dir=${f.dir} autocomplete=off spellcheck=false></div>`).join('')}</div>
<div class=foot>Demo page · KeyFlip 0.2 Chrome extension · everything runs locally in the browser · Hebrew, English, Russian, Arabic</div></div>`;

(async () => {
  const server = http.createServer((req, res) => {
    const font = req.url?.startsWith('/fonts/') && process.env.FONTS ? path.join(process.env.FONTS, path.basename(req.url)) : null;
    if (font && fs.existsSync(font)) { res.setHeader('content-type', 'font/ttf'); return res.end(fs.readFileSync(font)); }
    res.setHeader('content-type', 'text/html'); res.end(PAGE);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const ext = path.resolve(__dirname, '../dist');
  const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'kf-demo-')), {
    headless: false, viewport: { width: 1366, height: 768 },
    args: ['--headless=new', `--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
  });
  const worker = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'));
  await worker.evaluate(() => chrome.storage.local.set({ languages: ['en', 'he', 'ru', 'ar'] }));
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.evaluate(() => document.fonts.ready);
  for (const f of FIELDS) {
    await page.click(`#${f.id}`);
    await page.waitForTimeout(f.id === 'he' ? 3000 : 300); // the first focus loads the word lists
    await page.keyboard.type(f.typed, { delay: 60 });
    await page.waitForTimeout(900);
    console.log(f.id, JSON.stringify(await page.$eval(`#${f.id}`, (e) => e.value)));
  }
  await page.click('#ar');
  await page.keyboard.press('End');
  await page.screenshot({ path: out });
  await ctx.close();
  server.close();
  console.log('saved', out);
})();
