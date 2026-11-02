// Renders per-language variants of the KeyFlip icon (same design as icons/*.png: "A", arrow, letter of the
// other language) to docs/icons/<lang>/{icon.svg,16,32,48,128,300,512}.png.
// Usage: FONTS=<folder with Inter.ttf, Heebo.ttf, NotoSansArabic.ttf> node extension/scripts/make-language-icons.cjs
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const LANGS = {
  he: { letter: 'א', font: 'Heebo', y: 106 },
  ru: { letter: 'Я', font: 'Inter', y: 106 },
  ar: { letter: 'ع', font: 'NotoArabic', y: 96 },
};
const fonts = process.env.FONTS;
if (!fonts) throw new Error('Set FONTS to a folder with Inter.ttf, Heebo.ttf and NotoSansArabic.ttf');
const face = (family, file) => `@font-face{font-family:${family};font-weight:100 900;src:url(data:font/ttf;base64,${fs.readFileSync(path.join(fonts, file)).toString('base64')})}`;
const css = face('Inter', 'Inter.ttf') + face('Heebo', 'Heebo.ttf') + face('NotoArabic', 'NotoSansArabic.ttf');

const svg = (l, size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 128 128">
<rect width="128" height="128" rx="24" fill="#1d4ed8"/>
<text x="64" y="58" font-family="Inter" font-weight="700" font-size="44" text-anchor="middle" fill="#fff">A</text>
<text x="64" y="${l.y}" font-family="${l.font}" font-weight="700" font-size="44" text-anchor="middle" fill="#fde68a">${l.letter}</text>
<path d="M98 36 L110 48 L98 60" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

(async () => {
  const out = path.resolve(__dirname, '../../docs/icons');
  const b = await chromium.launch();
  const p = await b.newPage();
  for (const [lang, l] of Object.entries(LANGS)) {
    const dir = path.join(out, lang);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'icon.svg'), svg(l, 128) + '\n');
    for (const s of [16, 32, 48, 128, 300, 512]) {
      await p.setViewportSize({ width: s, height: s });
      await p.setContent(`<style>${css}body{margin:0;background:transparent}</style>${svg(l, s)}`);
      await p.evaluate(() => document.fonts.ready);
      await p.waitForTimeout(100);
      await p.screenshot({ path: path.join(dir, `${s}.png`), omitBackground: true });
    }
  }
  await b.close();
  console.log('saved', out);
})();
