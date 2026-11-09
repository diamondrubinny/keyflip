// Microsoft Store "Store display images" per listing language: 1:1 app tile icons (300, 150, 71), 1:1 box art (2160)
// and 2:3 poster art (1440x2160), all opaque PNGs in the KeyFlip icon design. Output: docs/store-images/<lang>/.
// Usage: FONTS=<folder with Inter.ttf, Heebo.ttf, NotoSansArabic.ttf> node extension/scripts/make-store-images.cjs
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

// en uses the Hebrew icon (the product's original pair).
const LANGS = {
  en: { letter: 'א', font: 'Heebo', y: 106, tagline: 'Typed in the wrong keyboard layout?<br>Fixed.' },
  he: { letter: 'א', font: 'Heebo', y: 106, tagline: 'הקלדתם בשפה הלא נכונה?<br>מתוקן.', dir: 'rtl' },
  ru: { letter: 'Я', font: 'Inter', y: 106, tagline: 'Набрали не в той раскладке?<br>Исправлено.' },
  ar: { letter: 'ع', font: 'NotoArabic', y: 96, tagline: 'كتبت بتخطيط لوحة المفاتيح الخطأ؟<br>تم التصحيح.', dir: 'rtl' },
};
const fonts = process.env.FONTS;
if (!fonts) throw new Error('Set FONTS to a folder with Inter.ttf, Heebo.ttf and NotoSansArabic.ttf');
const face = (family, file) => `@font-face{font-family:${family};font-weight:100 900;src:url(data:font/ttf;base64,${fs.readFileSync(path.join(fonts, file)).toString('base64')})}`;
const css = face('Inter', 'Inter.ttf') + face('Heebo', 'Heebo.ttf') + face('NotoArabic', 'NotoSansArabic.ttf');

// Square tile, full bleed (the Store crops/rounds tiles itself).
const glyphs = (l) => `<text x="64" y="58" font-family="Inter" font-weight="700" font-size="44" text-anchor="middle" fill="#fff">A</text>
<text x="64" y="${l.y}" font-family="${l.font}" font-weight="700" font-size="44" text-anchor="middle" fill="#fde68a">${l.letter}</text>
<path d="M98 36 L110 48 L98 60" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`;
const tile = (l, s) => `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 128 128"><rect width="128" height="128" fill="#1d4ed8"/>${glyphs(l)}</svg>`;
const poster = (l) => `<div style="width:1440px;height:2160px;background:linear-gradient(180deg,#1d4ed8,#1e3a8a);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:90px;color:#fff;font-family:Inter,Heebo,NotoArabic">
<svg width="900" height="900" viewBox="0 0 128 128">${glyphs(l)}</svg>
<div style="font-size:190px;font-weight:800;letter-spacing:-4px">KeyFlip</div>
<div dir="${l.dir ?? 'ltr'}" style="font-size:72px;font-weight:600;color:#fde68a;text-align:center;max-width:1340px;line-height:1.3">${l.tagline}</div></div>`;

(async () => {
  const out = path.resolve(__dirname, '../../docs/store-images');
  const b = await chromium.launch();
  const p = await b.newPage();
  const shot = async (html, w, h, file) => {
    await p.setViewportSize({ width: w, height: h });
    await p.setContent(`<style>${css}body{margin:0}</style>${html}`);
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(150);
    await p.screenshot({ path: file });
  };
  for (const [lang, l] of Object.entries(LANGS)) {
    const dir = path.join(out, lang);
    fs.mkdirSync(dir, { recursive: true });
    for (const s of [300, 150, 71]) await shot(tile(l, s), s, s, path.join(dir, `tile-${s}x${s}.png`));
    await shot(tile(l, 2160), 2160, 2160, path.join(dir, 'box-art-2160x2160.png'));
    await shot(poster(l), 1440, 2160, path.join(dir, 'poster-art-1440x2160.png'));
  }
  await b.close();
  console.log('saved', out);
})();
