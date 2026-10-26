// One-off: renders icons/{16,32,48,128}.png from an inline SVG using the preinstalled Playwright.
const { chromium } = require('playwright');
const fs = require('node:fs');
const svg = (s) => `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 128 128">
<rect width="128" height="128" rx="24" fill="#1d4ed8"/>
<text x="64" y="58" font-family="Arial" font-weight="700" font-size="44" text-anchor="middle" fill="#fff">A</text>
<text x="64" y="106" font-family="Arial" font-weight="700" font-size="44" text-anchor="middle" fill="#fde68a">א</text>
<path d="M98 36 L110 48 L98 60" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
(async () => {
  fs.mkdirSync('icons', { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage();
  for (const s of [16, 32, 48, 128]) {
    await p.setViewportSize({ width: s, height: s });
    await p.setContent(`<body style="margin:0;background:transparent">${svg(s)}</body>`);
    await p.screenshot({ path: `icons/${s}.png`, omitBackground: true });
  }
  await b.close();
})();
