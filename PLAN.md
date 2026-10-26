# KeyFlip – תיקון הקלדה בשפה לא נכונה (עברית ↔ אנגלית)

> **סטטוס (26.10.2026):** שלבים 1–4 הושלמו, וגם חיזוק אבטחה ותשתית (ראו `docs/HARDENING_PLAN.md`, `CHANGELOG.md`).
> **נותר:** בדיקות ידניות מקיפות (ראו `docs/PRODUCTION_CHECKLIST.md`), Release ראשון בריפו העצמאי, הגשה ל-SignPath, מתקין (MSIX/Inno Setup), פרסום בחנות Chrome.
> **החלטות שאושרו:** Windows ראשון; זיהוי אוטומטי + המרה ידנית; קיצורים `Alt+Shift+Z` (תוסף) ו-`Ctrl+Alt+Space` (תוכנה); קוד פתוח Apache-2.0.
> המסמך הוא מקור האמת לבנייה. כל שלב מעדכן כאן את הסטטוס.

## 1. מטרה
כותבים בטעות כשהמקלדת בשפה הלא נכונה: `akuo` במקום `שלום`, `יקךךם` במקום `hello`.
1. **תוסף Chrome**: תיקון בתוך דפי אינטרנט.
2. **תוכנת Windows**: תיקון בכל אפליקציה (Word, Slack וכו').

## 2. הנחות
| # | הנחה |
|---|------|
| A1 | Windows 10/11 x64 בלבד ב-MVP |
| A2 | פריסת עברית: SI-1452 (התקנית) מול US QWERTY |
| A3 | **תיקון אוטומטי בסוף מילה** (רווח), וגם המרה ידנית בקיצור מקשים |
| A4 | עיבוד מקומי בלבד: אין שרת, אין רשת, אין טלמטריה |

## 3. User Stories
- כמשתמש, אני מקליד מילה בשפה שגויה ולוחץ רווח. המילה מתוקנת, ו-Undo מחזיר אותה.
- כמשתמש, אני מסמן טקסט (או משאיר את הסמן אחרי מילים), לוחץ קיצור, והטקסט מומר.
- כמשתמש, אני יכול לכבות, להשבית אתרים או אפליקציות ולבחור כיווני המרה.
- כמשתמש, שום טקסט שלי לא נשמר ולא יוצא מהמחשב, ובשדות סיסמה לא קורה כלום.

## 4. אלגוריתם
1. **מיפוי מקשים** מ-`shared/mapping.json`, מקור אמת אחד לשני המימושים.
2. **זיהוי מילה שגויה** (`Detector`): מילה בכתב לטיני שאינה באנגלית אבל ההמרה שלה היא מילה עברית תקינה, או להפך. הבדיקה נעשית מול מילוני תדירות (FrequencyWords, 40 אלף מילים לכל שפה), עם תחיליות עבריות (ו/ה/ב/ל/מ/ש/כ), סיומות אנגליות וסף תדירות מחמיר למילים של 3 אותיות.
3. **החרגות:** פחות מ-3 תווים, ספרות, `@`, URL, אותיות גדולות.
4. **פיסוק:** פיסוק מוביל נשמר. פיסוק בסוף נבדק גם כאות ממופה (למשל `,` = ת).
5. **המרה ידנית:** כל מילה מומרת לפי הכתב שלה. בלי בחירה, ההמרה חלה על הרצף האחרון בשורה באותו כתב.

## 5. ארכיטקטורה
### תוסף Chrome (`extension/`)
- MV3, TypeScript, esbuild. הרשאות: `storage`, `contextMenus`, `activeTab`. סקריפט תוכן ב-http/https, כולל frames מסוג `about:blank`/`srcdoc` (`match_origin_as_fallback`).
- Content script מזהה סוף מילה (`input` event) ושולח את המילה בלבד ל-service worker. ה-worker מחזיק את המילונים ומחזיר תיקון. ההחלפה נעשית ב-`execCommand('insertText')` כדי לשמור Undo.
- הודעות מתקבלות רק מהתוסף עצמו (`sender.id`). CSP קשיח לדפי התוסף. `_locales` בעברית ובאנגלית.

### תוכנת Windows (`desktop/`)
- .NET 10 LTS, WinForms tray. `KeyFlip.Core` (מיפוי, זיהוי, מאגר שורה) נבדק ב-xUnit מול `shared/test-cases.json`.
- **`WH_KEYBOARD_LL` + `WH_MOUSE_LL`** לזיהוי סוף מילה ולאיפוס בקליק. התיקון נעשה ב-`SendInput` (Backspace + Unicode), והקלט המוזרק מסומן כדי שה-hook יתעלם ממנו.
- המרה ידנית ו-Undo ב-`RegisterHotKey` (`Ctrl+Alt+Space`). טקסט מסומן נקרא דרך הלוח: `Ctrl+C` ואחר כך שחזור הלוח.
- **הגנות:** שום הקשה לא נשמרת בתוכנות מוחרגות או בשדה סיסמה (בדיקת Win32, ולפני תיקון גם UI Automation `IsPassword`). כתיבות ללוח מסומנות כמוחרגות מ-Clipboard History ומ-Cloud sync. אין השפעה על חלונות מוגבהים.

### CI/CD (`.github/workflows/`)
- `ci.yml`: בדיקת גרסה אחידה, `npm audit`, typecheck, unit, build, e2e, a11y, בדיקות C#, בדיקת חולשות NuGet, publish. Pre-release לא חתום רק בהפעלה ידנית.
- `codeql.yml` (JS/TS, C#, Actions), Dependabot (npm, NuGet, Actions). כל ה-Actions מוצמדים ל-SHA.

## 6. מבנה תיקיות
```
keyflip/
├── PLAN.md · README.md · CHANGELOG.md · SECURITY.md · CONTRIBUTING.md · CODE_OF_CONDUCT.md · LICENSE · NOTICE.md
├── global.json                      # .NET SDK band
├── .github/ (workflows/ci.yml, workflows/codeql.yml, dependabot.yml, CODEOWNERS, templates)
├── shared/ (mapping.json, test-cases.json)
├── extension/
│   ├── src/ (background, content, core, detect, editable, settings, popup, options, data/*.txt)
│   ├── static/ (manifest.json, popup.html, options.html, ui.css, _locales/{en,he})
│   ├── scripts/ (build, build-dicts, eval, check-version, make-icons)
│   └── tests/ (core.test.ts, e2e.cjs, a11y.cjs)
├── desktop/
│   ├── KeyFlip.slnx · Directory.Build.props (Version)
│   ├── KeyFlip.Core/ (LayoutMap, Detector, LineBuffer)
│   ├── KeyFlip.Core.Tests/
│   └── KeyFlip.App/ (TrayApp, KeyboardMonitor, TextInjector, WindowInfo, FocusInspector, ClipboardPrivacy, AppSettings)
└── docs/ (PRIVACY, TERMS, ACCESSIBILITY, CODE_SIGNING_POLICY, SIGNPATH_SETUP, STORE_LISTING, PRODUCTION_CHECKLIST, HARDENING_PLAN)
```

## 7. שלבי עבודה
| שלב | תוצר | סטטוס |
|-----|------|-------|
| 1 | `shared/`, מנוע המרה ב-TS, בדיקות יחידה | ✅ |
| 2 | תוסף Chrome: אוטומטי, ידני, Undo, Options | ✅ |
| 3 | תוכנת Windows: tray, hook, קיצור, Undo | ✅ |
| 4 | מסמכי פרטיות, תנאים ונגישות (טיוטות), צ'קליסט | ✅ |
| 4.1 | ריפו עצמאי, Apache-2.0, חיזוק אבטחה, .NET 10, CI מלא | ✅ |
| 5 | בדיקות ידניות מקיפות, Release, SignPath, מתקין | ⬜ |
| 6 | חנות Chrome (מדיניות פרטיות בכתובת ציבורית, צילומי מסך) | ⬜ |

## 8. Threat Model
| נכס | איום | בקרה |
|-----|------|------|
| טקסט מוקלד (עלול לכלול סיסמאות) | דליפה, לוג, שמירה | אין רשת. מאגר בזיכרון בלבד, עד 200 תווים, מתאפס ב-Enter/Tab/קליק/החלפת חלון/30 שניות. לא נשמר כלום בתוכנות מוחרגות ובשדות סיסמה |
| שדות סיסמה | תיקון או המרה בטעות | תוסף: `type=password`, `autocomplete` של סיסמה/כרטיס/OTP. תוכנה: Win32 `ES_PASSWORD` + UI Automation `IsPassword` (נכשל לצד הבטוח בתום זמן), מנהלי סיסמאות מוחרגים גם מהמרה ידנית |
| Clipboard | חשיפה בהיסטוריה או בענן | שחזור מיידי. כתיבות KeyFlip מסומנות `CanIncludeInClipboardHistory=0` / `CanUploadToCloudClipboard=0`. ההעתקה של התוכנה היעד מתועדת כמגבלה |
| keyboard hook | נתפס כ-keylogger, ניצול | קוד פתוח, ללא רשת, ללא דיסק, חתימה דיגיטלית מתוכננת (SignPath), CodeQL |
| תוסף | הודעות מתוסף או דף זר | בדיקת `sender.id`, הרשאות מינימליות, CSP, אין `eval` |
| שרשרת אספקה | תלות או Action זדוניים | lockfile, `npm audit`, בדיקת NuGet, Dependabot, Actions מוצמדים ל-SHA, build רק ב-CI ציבורי |
| חלונות מוגבהים | הזרקה ל-Admin | לא אפשרי (UIPI), התוכנה לא דורשת הרשאות מנהל |

## 9. פרטיות, עוגיות, נגישות
- **מידע אישי:** לא נאסף. נשמרות רק הגדרות מקומיות (`chrome.storage.local` / `%APPDATA%\KeyFlip\settings.json`). טבלת מידע מלאה ב-`docs/PRIVACY.md`.
- **עוגיות/Trackers:** אין, ולכן אין צורך באנר הסכמה.
- **נגישות:** דפי התוסף ב-RTL, HTML סמנטי, מקלדת, focus נראה, ניגודיות AA (axe ב-CI). היעד הוא WCAG 2.1 AA / ת"י 5568, ללא הצהרת ציות מלא.

## 10. סיכונים ומגבלות
- Google Docs ועורכי canvas. אפליקציות שחוסמות קלט מדומה. חלונות Admin.
- זיהוי אוטומטי במילים קצרות או נדירות (מדידה ב-`npm run eval`).
- אנטי-וירוס עלול לסמן False Positive עד לחתימה דיגיטלית.
- SignPath: הקבלה תלויה במוניטין הפרויקט (ראו `docs/SIGNPATH_SETUP.md`).
- מסמכים משפטיים ונגישות: טיוטות. **דורש בדיקה משפטית ובדיקת יועץ נגישות.**

## 11. הצעד הבא
בדיקה ידנית מקיפה של Release ה-preview הראשון (Word, Slack, Outlook, WhatsApp Web, Gmail, NVDA), ואחר כך הגשה ל-SignPath.
