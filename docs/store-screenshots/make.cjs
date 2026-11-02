// Renders Microsoft Store illustrations (1366x768 PNG) for each listing language into <lang>/NN-*.png.
// The before/after texts are real KeyFlip 0.2.0 outputs (checked with the detector); the window is a drawing, not a
// screenshot, and every image says so in its corner.
// Usage: FONTS=<dir with Heebo.ttf, Inter.ttf, NotoSansArabic.ttf> node docs/store-screenshots/make.cjs
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const FONTS = process.env.FONTS;
if (!FONTS) throw new Error('set FONTS to a folder with Heebo.ttf, Inter.ttf and NotoSansArabic.ttf (Google Fonts, OFL)');
const font = (f) => `url(data:font/ttf;base64,${fs.readFileSync(path.join(FONTS, f)).toString('base64')})`;

const DEMOS = {
  he: { typed: ['akuo jcrho'], fixed: ['שלום חברים'], typedOn: 'latin' },
  short: { typed: ['kt tck nv akunl'], fixed: ['לא אבל מה שלומך'], typedOn: 'latin' },
  ru: { typed: ['ghbdtn rfr ltkf'], fixed: ['привет как дела'], typedOn: 'latin' },
  ar: { typed: ['Hkh lvpfh'], fixed: ['أنا مرحبا'], typedOn: 'latin' },
  rev: { typed: ["יקךךם 'םרךג", 'руддщ цщкдв', 'اثممخ صخقمي'], fixed: ['hello world', 'hello world', 'hello world'], typedOn: 'other' },
};

const T = {
  en: {
    dir: 'ltr',
    he: ['Typed on the wrong keyboard? Fixed as you type', 'Hebrew ↔ English'],
    short: ['Even short words in a sentence', 'kt tck → לא אבל'],
    ru: ['Russian ↔ English', 'Turns on when the Russian keyboard is installed'],
    ar: ['Arabic ↔ English', 'Including أ إ آ and the لا key'],
    rev: ['And the other way round', 'English typed on a Hebrew, Russian or Arabic keyboard'],
    privacy: ['Private by design', 'Nothing you type leaves your computer'],
    chips: ['Runs entirely on your PC – no internet', 'Never touches password fields', 'Undo any fix: Ctrl+Alt+Space'],
    typedLatin: 'Typed (keyboard on English)',
    typedRev: ['Typed on a Hebrew keyboard', 'Typed on a Russian keyboard', 'Typed on an Arabic keyboard'],
    typedOther: 'Typed (keyboard on Hebrew / Russian / Arabic)',
    fixed: 'After KeyFlip',
    note: 'Illustration',
    footer: 'Windows app · Chrome extension · free & open source',
    order: ['he', 'short', 'ru', 'ar', 'rev', 'privacy'],
  },
  he: {
    dir: 'rtl',
    he: ['הקלדתם בשפה הלא נכונה? מתוקן תוך כדי הקלדה', 'עברית ↔ אנגלית'],
    short: ['גם מילים קצרות בתוך משפט', 'kt tck ← לא אבל'],
    ru: ['רוסית ↔ אנגלית', 'נדלק כשהמקלדת הרוסית מותקנת'],
    ar: ['ערבית ↔ אנגלית', 'כולל أ إ آ והמקש لا'],
    rev: ['וגם בכיוון ההפוך', 'אנגלית שהוקלדה במקלדת עברית, רוסית או ערבית'],
    privacy: ['פרטיות מובנית', 'שום דבר שאתם מקלידים לא יוצא מהמחשב'],
    chips: ['הכול רץ במחשב שלכם – בלי אינטרנט', 'לא נוגע בשדות סיסמה', 'ביטול כל תיקון: Ctrl+Alt+Space'],
    typedLatin: 'הוקלד (המקלדת באנגלית)',
    typedRev: ['הוקלד במקלדת עברית', 'הוקלד במקלדת רוסית', 'הוקלד במקלדת ערבית'],
    typedOther: 'הוקלד (המקלדת בעברית / רוסית / ערבית)',
    fixed: 'אחרי KeyFlip',
    note: 'איור להמחשה',
    footer: 'תוכנה ל-Windows · תוסף ל-Chrome · חינם וקוד פתוח',
    order: ['he', 'short', 'ru', 'ar', 'rev', 'privacy'],
  },
  ru: {
    dir: 'ltr',
    he: ['Набрали не в той раскладке? Исправится сразу', 'Иврит ↔ английский'],
    short: ['Даже короткие слова в предложении', 'kt tck → לא אבל'],
    ru: ['Русский ↔ английский', 'Включается, если установлена русская раскладка'],
    ar: ['Арабский ↔ английский', 'Включая أ إ آ и клавишу لا'],
    rev: ['И в обратную сторону', 'Английский, набранный в раскладке иврит, русский или арабский'],
    privacy: ['Конфиденциальность по умолчанию', 'Ничего из набранного не покидает компьютер'],
    chips: ['Всё работает на вашем компьютере – без интернета', 'Не трогает поля пароля', 'Отмена любого исправления: Ctrl+Alt+Space'],
    typedLatin: 'Набрано (раскладка: английский)',
    typedRev: ['Набрано в раскладке иврит', 'Набрано в русской раскладке', 'Набрано в арабской раскладке'],
    typedOther: 'Набрано (раскладка: иврит / русский / арабский)',
    fixed: 'После KeyFlip',
    note: 'Иллюстрация',
    footer: 'Программа для Windows · расширение для Chrome · бесплатно, открытый код',
    order: ['ru', 'rev', 'he', 'ar', 'short', 'privacy'],
  },
  ar: {
    dir: 'rtl',
    he: ['كتبت بلغة لوحة المفاتيح الخطأ؟ يُصحَّح أثناء الكتابة', 'العبرية ↔ الإنجليزية'],
    short: ['حتى الكلمات القصيرة داخل الجملة', 'kt tck ← לא אבל'],
    ru: ['الروسية ↔ الإنجليزية', 'تُفعَّل عند تثبيت لوحة المفاتيح الروسية'],
    ar: ['العربية ↔ الإنجليزية', 'بما في ذلك أ إ آ ومفتاح لا'],
    rev: ['وفي الاتجاه المعاكس أيضاً', 'الإنجليزية المكتوبة بلوحة مفاتيح عبرية أو روسية أو عربية'],
    privacy: ['الخصوصية أولاً', 'لا يغادر أي شيء تكتبه جهازك'],
    chips: ['كل شيء يعمل على جهازك – بلا إنترنت', 'لا يلمس حقول كلمات المرور', 'تراجع عن أي تصحيح: Ctrl+Alt+Space'],
    typedLatin: 'المكتوب (لوحة المفاتيح بالإنجليزية)',
    typedRev: ['مكتوب بلوحة مفاتيح عبرية', 'مكتوب بلوحة مفاتيح روسية', 'مكتوب بلوحة مفاتيح عربية'],
    typedOther: 'المكتوب (لوحة المفاتيح بالعبرية / الروسية / العربية)',
    fixed: 'بعد KeyFlip',
    note: 'صورة توضيحية',
    footer: 'برنامج لـ Windows · إضافة لـ Chrome · مجاني ومفتوح المصدر',
    order: ['ar', 'rev', 'he', 'ru', 'short', 'privacy'],
  },
};

const ICON = `<svg width="56" height="56" viewBox="0 0 128 128"><rect width="128" height="128" rx="24" fill="#fff"/>
<text x="64" y="58" font-family="Inter" font-weight="800" font-size="44" text-anchor="middle" fill="#1d4ed8">A</text>
<text x="64" y="106" font-family="Heebo" font-weight="800" font-size="44" text-anchor="middle" fill="#7c3aed">א</text>
<path d="M98 36 L110 48 L98 60" fill="none" stroke="#1d4ed8" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function page(lang, kind) {
  const t = T[lang];
  const [title, sub] = t[kind];
  let body;
  if (kind === 'privacy') {
    body = `<div class="chips">${t.chips.map((c, i) => `<div class="chip"><span class="dot d${i}"></span><bdi>${esc(c)}</bdi></div>`).join('')}</div>`;
  } else {
    const d = DEMOS[kind];
    const rows = d.typed.map((typed, i) => `
      <div class="pair">
        <div class="lbl">${esc(d.typedOn === 'latin' ? t.typedLatin : t.typedRev[i])}</div>
        <div class="txt bad" dir="auto">${esc(typed)}</div>
        <div class="arrow">↓</div>
        <div class="lbl">${esc(t.fixed)}</div>
        <div class="txt good" dir="auto">${esc(d.fixed[i])}</div>
      </div>`);
    body = `<div class="win ${d.typed.length > 1 ? 'multi' : ''}"><div class="bar"><i></i><i></i><i></i></div><div class="content">${rows.join('')}</div></div>`;
  }
  return `<!doctype html><html lang="${lang}" dir="${t.dir}"><meta charset="utf-8"><style>
@font-face{font-family:Heebo;src:${font('Heebo.ttf')};font-weight:100 900}
@font-face{font-family:Inter;src:${font('Inter.ttf')};font-weight:100 900}
@font-face{font-family:NotoArabic;src:${font('NotoSansArabic.ttf')};font-weight:100 900}
*{box-sizing:border-box;margin:0}
body{width:1366px;height:768px;overflow:hidden;font-family:Inter,Heebo,NotoArabic,sans-serif;color:#fff;
 background:radial-gradient(900px 600px at 15% 0%,#2563eb 0%,transparent 60%),radial-gradient(900px 700px at 100% 100%,#7c3aed 0%,transparent 60%),#0b1220;
 display:flex;flex-direction:column;align-items:center;padding:34px 60px}
.top{width:100%;display:flex;align-items:center;justify-content:space-between}
.brand{display:flex;align-items:center;gap:14px;font-weight:800;font-size:30px;direction:ltr}
.note{font-size:16px;opacity:.75;border:1px solid rgba(255,255,255,.4);border-radius:999px;padding:4px 12px}
h1{margin-top:18px;font-size:50px;font-weight:800;text-align:center;line-height:1.15}
h2{margin-top:10px;font-size:26px;font-weight:500;opacity:.9;text-align:center}
.main{flex:1;display:flex;align-items:center;justify-content:center;width:100%}
.win{width:1000px;background:#fff;color:#0f172a;border-radius:18px;box-shadow:0 30px 80px rgba(0,0,0,.45);overflow:hidden}
.bar{height:38px;background:#e2e8f0;display:flex;gap:8px;align-items:center;padding:0 16px;direction:ltr}
.bar i{width:13px;height:13px;border-radius:50%;background:#94a3b8;display:block}
.content{padding:34px 40px 38px}
.multi .content{display:flex;gap:26px;padding:20px 26px}
.pair{flex:1;text-align:center}
.lbl{font-size:21px;color:#64748b;font-weight:600}
.txt{font-size:60px;font-weight:800;margin:8px 0;unicode-bidi:isolate}
.multi .txt{font-size:38px}.multi .lbl{font-size:17px}
.bad{color:#dc2626}.good{color:#059669}
.arrow{font-size:36px;color:#94a3b8;line-height:1;margin:4px 0}
.chips{display:flex;flex-direction:column;gap:22px;width:860px}
.chip{display:flex;align-items:center;gap:20px;background:rgba(255,255,255,.12);border:2px solid rgba(255,255,255,.25);border-radius:22px;padding:24px 30px;font-size:32px;font-weight:700}
.dot{width:22px;height:22px;border-radius:50%;flex:none}.d0{background:#f59e0b}.d1{background:#6366f1}.d2{background:#10b981}
.footer{font-size:20px;opacity:.85}
</style><body>
<div class="top"><div class="brand">${ICON}KeyFlip</div><div class="note">${esc(t.note)}</div></div>
<h1>${esc(title)}</h1><h2><bdi>${esc(sub)}</bdi></h2>
<div class="main">${body}</div>
<div class="footer">${esc(t.footer)}</div>
</body></html>`;
}

(async () => {
  const browser = await chromium.launch();
  const p = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  for (const lang of Object.keys(T)) {
    const dir = path.join(__dirname, lang);
    fs.mkdirSync(dir, { recursive: true });
    for (const [i, kind] of T[lang].order.entries()) {
      await p.setContent(page(lang, kind));
      await p.evaluate(() => document.fonts.ready);
      await p.screenshot({ path: path.join(dir, `${String(i + 1).padStart(2, '0')}-${kind}.png`) });
    }
  }
  await browser.close();
  console.log('done');
})();
