# KeyFlip

[![CI](https://github.com/diamondrubinny/keyflip/actions/workflows/ci.yml/badge.svg)](https://github.com/diamondrubinny/keyflip/actions/workflows/ci.yml)
[![CodeQL](https://github.com/diamondrubinny/keyflip/actions/workflows/codeql.yml/badge.svg)](https://github.com/diamondrubinny/keyflip/actions/workflows/codeql.yml)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

Fixes text typed in the wrong keyboard layout between Hebrew and English: `akuo` → `שלום`, `יקךךם` → `hello`.
A Chrome extension (Manifest V3) and a Windows tray app. **Everything runs locally; no data leaves your computer.**

- **[Code signing policy](docs/CODE_SIGNING_POLICY.md)** · [Privacy policy](docs/PRIVACY.md) · [Terms](docs/TERMS.md) · [Accessibility statement](docs/ACCESSIBILITY.md) · [Security](SECURITY.md) · [Changelog](CHANGELOG.md)
- All builds: [Releases](https://github.com/diamondrubinny/keyflip/releases). Current builds are **unsigned previews** (pre-releases) – verify them with `SHA256SUMS.txt`.

## ⬇️ Download

| File | For |
|---|---|
| **[KeyFlip-windows-x64-self-contained.exe](https://github.com/diamondrubinny/keyflip/releases/download/latest-preview/KeyFlip-windows-x64-self-contained.exe)** | Windows 10/11 x64 – runs as is (recommended) |
| [KeyFlip-windows-x64-needs-dotnet10.exe](https://github.com/diamondrubinny/keyflip/releases/download/latest-preview/KeyFlip-windows-x64-needs-dotnet10.exe) | Windows 10/11 x64 – smaller, needs the [.NET 10 Desktop Runtime](https://dotnet.microsoft.com/download/dotnet/10.0) |
| **[KeyFlip-chrome-extension.zip](https://github.com/diamondrubinny/keyflip/releases/download/latest-preview/KeyFlip-chrome-extension.zip)** | Chrome / Edge – unzip, then `chrome://extensions` → Developer mode → *Load unpacked* → the unzipped folder |
| [SHA256SUMS.txt](https://github.com/diamondrubinny/keyflip/releases/download/latest-preview/SHA256SUMS.txt) | Checksums to verify the files |

These links always point to the newest build ([`latest-preview`](https://github.com/diamondrubinny/keyflip/releases/tag/latest-preview)). The builds are not code-signed yet, so Windows SmartScreen or antivirus software may warn about the keyboard hook – see the [Code signing policy](docs/CODE_SIGNING_POLICY.md).

![KeyFlip in action: text typed in the wrong layout, like "akuo jcrho", turns into Hebrew words as you type, and Hebrew-layout gibberish turns into the English sentence "hello world everything works great"](docs/screenshots/demo.gif)

| Result | Extension popup (Hebrew UI) |
|---|---|
| ![The demo form after typing: "שלום חברים איך עובר עליכם היום" in the Hebrew field and "hello world everything works great" in the English field](docs/screenshots/demo-after.webp) | ![The KeyFlip popup: auto-correct while typing is on, a switch to disable it on the current site, the manual shortcut Alt+Shift+Z and a link to advanced settings](docs/screenshots/popup.png) |

<sub>Recorded with the real built Chrome extension on a local demo page.</sub>

[עברית למטה ↓](#עברית)

## Chrome extension

**Automatic:** type a word and press Space. If it was clearly typed in the wrong layout, it is replaced; `Ctrl+Z` undoes it.
**Manual:** select text (or leave the caret after the words) and press `Alt+Shift+Z`, or use the context menu. Change the shortcut at `chrome://extensions/shortcuts`.
**Settings:** the toolbar popup (on/off, disable per site) and the options page (directions, list of disabled sites).

Privacy and permissions:
- No network access, analytics or cookies. Detection uses word lists bundled in the extension.
- Permissions: `storage` (settings), `contextMenus` (menu item), `activeTab` (current site in the popup). The content script runs on http/https pages (including `about:blank`/`srcdoc` editor frames) to see the word you just finished.
- Never acts in password, credit-card or one-time-code fields, code editors, or on words with digits, `@`, URLs or capital letters.

Limits: Google Docs and other canvas-based editors may not work. Detection is dictionary-based (≈96% recall, ≈0.5% wrong corrections on rare words); 3-letter words are checked more strictly.

Install for development: `chrome://extensions` → Developer mode → *Load unpacked* → `extension/dist`.

## Windows app

Requires Windows 10/11 x64. The self-contained `.exe` runs as is; the smaller `needs-dotnet10` build needs the [.NET 10 Desktop Runtime](https://dotnet.microsoft.com/download/dotnet/10.0).

- **Automatic:** after each word (Space) the word is checked and fixed if typed in the wrong layout. `Ctrl+Alt+Space` right after a fix undoes it.
- **Manual:** `Ctrl+Alt+Space` converts the selected text, or the last words typed on the line.
- **Privacy:** a keyboard hook detects word ends. Only the current line (max. 200 characters) is kept in memory – never on disk, in logs or on the network. Nothing at all is recorded in ignored applications (password managers, terminals, remote-desktop tools, code editors/IDEs) or while a password field has focus (classic Win32 check + UI Automation for Electron/WPF/UWP apps). Browsers are skipped by default (the extension handles them) and can be enabled from the tray menu. The list of ignored applications is in `%APPDATA%\KeyFlip\settings.json`.
- **Clipboard:** converting *selected* text copies it with `Ctrl+C` and restores your previous text clipboard. KeyFlip's own clipboard writes are excluded from Clipboard History and cloud sync, but the copy made by the target application may appear in Clipboard History (`Win+V`).
- **Limits:** does not work in windows running as administrator; apps that block synthetic input work partially; non-text clipboard content disables the selected-text path; antivirus products may flag keyboard hooks (false positive) – code signing is planned.
- **Uninstall:** exit from the tray menu, untick "Start with Windows", delete the `.exe` and `%APPDATA%\KeyFlip`.

## Build and test

```bash
# Chrome extension (Node.js 22+)
cd extension
npm ci
npm run typecheck
npm test                       # unit tests (shared cases with the C# core)
npm run build                  # -> extension/dist
npx playwright install chromium
npm run e2e                    # real Chromium with the extension loaded
npm run a11y                   # axe-core WCAG 2.1 A/AA scan
npm run eval                   # detection accuracy
npm run check-version          # same version in package.json, manifest, desktop

# Windows app (.NET 10 SDK; global.json pins the SDK band)
dotnet test desktop/KeyFlip.Core.Tests
dotnet publish desktop/KeyFlip.App -c Release -r win-x64
```

CI: `.github/workflows/ci.yml` builds and tests both products on every push to `main` and every pull request. A maintainer publishes a preview pre-release by running the workflow manually with **release = true**.

## Repository layout

| Path | Contents |
|---|---|
| `extension/` | Chrome extension (TypeScript, esbuild) |
| `desktop/` | Windows tray app (`KeyFlip.App`), shared core (`KeyFlip.Core`), tests; `KeyFlip.slnx` |
| `shared/` | `mapping.json` (layout map, single source of truth) and `test-cases.json` |
| `docs/` | Privacy, terms, accessibility, code signing, store listing, production checklist |

## License

[Apache-2.0](LICENSE). The detection word lists are derived from FrequencyWords (CC BY-SA 4.0) – see [NOTICE.md](NOTICE.md).

---

<div dir="rtl">

## עברית

מתקן טקסט שהוקלד בטעות במקלדת הלא נכונה: `akuo` ← `שלום`, `יקךךם` ← `hello`. תוסף Chrome ותוכנת Windows. **הכול רץ מקומית ושום מידע לא יוצא מהמחשב.**

### הורדה
- **[תוכנת Windows (מומלץ, רצה מיד)](https://github.com/diamondrubinny/keyflip/releases/download/latest-preview/KeyFlip-windows-x64-self-contained.exe)** · [גרסה קטנה שדורשת .NET 10 Desktop Runtime](https://github.com/diamondrubinny/keyflip/releases/download/latest-preview/KeyFlip-windows-x64-needs-dotnet10.exe)
- **[תוסף Chrome (ZIP)](https://github.com/diamondrubinny/keyflip/releases/download/latest-preview/KeyFlip-chrome-extension.zip)** – מחלצים, ואז `chrome://extensions` ← מצב מפתח ← "טען תוסף לא ארוז" ← התיקייה שחולצה.
- [SHA256SUMS.txt](https://github.com/diamondrubinny/keyflip/releases/download/latest-preview/SHA256SUMS.txt) לאימות הקבצים. הקישורים מפנים תמיד לגרסה האחרונה. הקבצים עדיין לא חתומים דיגיטלית, ולכן Windows או האנטי-וירוס עלולים להציג אזהרה.

### תוסף Chrome
- **אוטומטי:** מקלידים מילה ולוחצים רווח. אם המילה הוקלדה בשפה שגויה היא מוחלפת. `Ctrl+Z` מבטל.
- **ידני:** מסמנים טקסט (או משאירים את הסמן אחרי המילים) ולוחצים `Alt+Shift+Z`, או משתמשים בתפריט ההקשר.
- **הגדרות:** בחלון התוסף (הפעלה/כיבוי, השבתה לפי אתר) ובדף האפשרויות.
- **פרטיות:** אין רשת, אין אנליטיקה ואין עוגיות. התוסף לא פועל בשדות סיסמה, כרטיס אשראי, קוד חד-פעמי ועורכי קוד.
- **מגבלות:** Google Docs ועורכי canvas עלולים לא לעבוד. הזיהוי מבוסס מילון (כ-96% זיהוי, כ-0.5% תיקון שגוי במילים נדירות).

### תוכנת Windows
- דורשת Windows 10/11 x64. הקובץ self-contained רץ כמו שהוא. הקובץ `needs-dotnet10` דורש את .NET 10 Desktop Runtime.
- **אוטומטי:** כל מילה נבדקת אחרי רווח. `Ctrl+Alt+Space` מיד אחרי תיקון מבטל אותו.
- **ידני:** `Ctrl+Alt+Space` ממיר את הטקסט המסומן, או את המילים האחרונות שהוקלדו בשורה.
- **פרטיות:** התוכנה שומרת בזיכרון רק את השורה הנוכחית (עד 200 תווים), בלי דיסק, לוג או רשת. בתוכנות מוחרגות (מנהלי סיסמאות, טרמינלים, שליטה מרחוק, עורכי קוד) ובשדות סיסמה **לא נשמר כלום**. דפדפנים מוחרגים כברירת מחדל, ואפשר להפעיל אותם מתפריט המגש.
- **לוח:** בהמרה של טקסט מסומן נעשה שימוש בלוח, והתוכן הקודם משוחזר. הכתיבות של KeyFlip עצמה לא נשמרות בהיסטוריית הלוח, אבל העתקה שהתוכנה היעד מבצעת עשויה להופיע ב-`Win+V`.
- **מגבלות:** לא עובדת בחלונות שרצים כמנהל. אנטי-וירוס עלול לסמן אותה בגלל ה-keyboard hook (חתימה דיגיטלית מתוכננת).
- **הסרה:** יציאה מתפריט המגש, ביטול "הפעל עם Windows", מחיקת הקובץ ומחיקת `%APPDATA%\KeyFlip`.

### מסמכים
מדיניות פרטיות, תנאי שימוש והצהרת נגישות הם **טיוטות הדורשות בדיקה משפטית ומקצועית** לפני פרסום רשמי: `docs/PRIVACY.md`, `docs/TERMS.md`, `docs/ACCESSIBILITY.md`, `docs/STORE_LISTING.md`, `docs/PRODUCTION_CHECKLIST.md`.

### סטטוס בדיקות
- אוטומטי (CI): בדיקות יחידה בשני המימושים, בדיקות קצה-לקצה בכרומיום אמיתי, סריקת נגישות axe-core, CodeQL ובדיקת חולשות בתלויות.
- ידני: תוכנת Windows נבדקה ידנית על כמה מחשבים מסוגים שונים ועובדת. בדיקה ידנית מקיפה לפי תוכנות (Word, Slack, Outlook, WhatsApp Web, Gmail, קורא מסך) עדיין פתוחה. ראו `docs/PRODUCTION_CHECKLIST.md`.

</div>

---

## 💼 Commercial license & rights acquisition

KeyFlip is free and open source under the Apache-2.0. If you are interested in a **commercial agreement** or custom licensing terms, **white-label / exclusive rights**, or **acquiring full rights to the code**, send your proposal to **[d@rubinny.net](mailto:d@rubinny.net)**.

Please include: who you are (company / contact), how you intend to use the code, and your offer.

> 🇮🇱 מעוניינים ברישיון מסחרי, בזכויות בלעדיות או ברכישת הזכויות בקוד? שלחו הצעה ל-**[d@rubinny.net](mailto:d@rubinny.net)** — כולל פרטי קשר, אופן השימוש המתוכנן וההצעה שלכם.
