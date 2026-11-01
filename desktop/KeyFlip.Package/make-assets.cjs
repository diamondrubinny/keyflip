// Renders the MSIX logo assets from the same inline SVG as extension/scripts/make-icons.cjs.
// Usage (from this folder): node make-assets.cjs   (needs Playwright with Chromium)
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const mark = `<rect width="128" height="128" rx="24" fill="#1d4ed8"/>
<text x="64" y="58" font-family="Arial, 'Liberation Sans', sans-serif" font-weight="700" font-size="44" text-anchor="middle" fill="#fff">A</text>
<text x="64" y="106" font-family="Arial, 'Liberation Sans', sans-serif" font-weight="700" font-size="44" text-anchor="middle" fill="#fde68a">א</text>
<path d="M98 36 L110 48 L98 60" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`;

// Square icon, optionally padded (tiles look better with some margin around the mark).
const square = (s, pad = 0) => `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="${-pad} ${-pad} ${128 + 2 * pad} ${128 + 2 * pad}">${mark}</svg>`;
// Wide tile: mark centred on a transparent 310x150 canvas.
const wide = () => `<svg xmlns="http://www.w3.org/2000/svg" width="310" height="150" viewBox="0 0 310 150"><g transform="translate(103,23) scale(0.8)">${mark}</g></svg>`;

const outputs = [
  ['StoreLogo.png', 50, 50, square(50)],
  ['Square44x44Logo.png', 44, 44, square(44)],
  ['Square150x150Logo.png', 150, 150, square(150, 24)],
  ['Wide310x150Logo.png', 310, 150, wide()],
  ...[16, 24, 32, 48, 256].map((s) => [`Square44x44Logo.targetsize-${s}_altform-unplated.png`, s, s, square(s)]),
];

(async () => {
  const outDir = process.argv[2] || 'Assets';
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const [name, w, h, svg] of outputs) {
    await page.setViewportSize({ width: w, height: h });
    await page.setContent(`<body style="margin:0;background:transparent">${svg}</body>`);
    await page.screenshot({ path: path.join(outDir, name), omitBackground: true });
  }
  // Optional Store listing artwork (not part of the package).
  if (process.argv[3]) {
    fs.mkdirSync(process.argv[3], { recursive: true });
    for (const s of [300]) {
      await page.setViewportSize({ width: s, height: s });
      await page.setContent(`<body style="margin:0;background:transparent">${square(s)}</body>`);
      await page.screenshot({ path: path.join(process.argv[3], `store-icon-${s}.png`), omitBackground: true });
    }
  }
  await browser.close();
})();
