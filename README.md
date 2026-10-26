# KeyFlip

Fixes text typed in the wrong keyboard layout between Hebrew and English: `akuo` → `שלום`, `יקךךם` → `hello`.
A Chrome extension (Manifest V3) and a Windows tray app. Everything runs locally; no data leaves your computer.

- License: [Apache-2.0](LICENSE)
- **[Code signing policy](docs/CODE_SIGNING_POLICY.md)** · [Privacy policy](docs/PRIVACY.md) · [Accessibility statement (draft)](docs/ACCESSIBILITY.md)
- Download: see the [Releases](../../releases) page (Windows `KeyFlip.exe`, Chrome extension ZIP).

---

מתקן טקסט שהוקלד בטעות במקלדת הלא נכונה: `akuo` ← `שלום`, `יקךךם` ← `hello`.

- `extension/` – תוסף Chrome (Manifest V3). **מוכן.**
- `desktop/` – תוכנת Windows (Tray, .NET 8). נבנית ונבדקת ב-GitHub Actions (`.github/workflows/keyflip.yml`), הקבצים ב-Artifacts של הריצה.
- `shared/` – מיפוי המקלדת המשותף (`mapping.json`) ומקרי בדיקה.

## תוסף Chrome

```bash
cd extension
npm install
npm test          # בדיקות יחידה
npm run typecheck
npm run build     # יוצר extension/dist
npm run e2e       # בדיקה בדפדפן אמיתי (דורש build ו-Playwright)
npm run eval      # מדידת דיוק הזיהוי
npm run a11y      # בדיקת נגישות אוטומטית (axe-core)
```

התקנה: `chrome://extensions` ← מצב מפתח ← "טען תוסף לא ארוז" ← בחרו את `extension/dist`.

### שימוש
- **אוטומטי:** מקלידים מילה ולוחצים רווח. אם המילה נראית כאילו הוקלדה בשפה שגויה היא מוחלפת. `Ctrl+Z` מבטל.
- **ידני:** מסמנים טקסט (או משאירים את הסמן אחרי המילים) ו-`Alt+Shift+Z`, או תפריט הקשר.
- **הגדרות:** בחלון התוסף (השבתה לפי אתר) ובדף האפשרויות.

### פרטיות ואבטחה
- אין רשת: שום טקסט לא יוצא מהמחשב. אין אנליטיקה ואין עוגיות.
- הרשאות: `storage` (הגדרות), `contextMenus`, `activeTab` (חלון התוסף). סקריפט התוכן רץ בדפי http/https כדי לזהות הקלדה.
- לא פועל בשדות סיסמה, כרטיס אשראי, קוד חד-פעמי, עורכי קוד, ובמילים עם ספרות, `@`, כתובות או אותיות גדולות.

### מגבלות
- Google Docs ועורכי canvas אחרים עלולים לא לתמוך.
- הזיהוי מבוסס מילון (~96% שחזור, ~0.5% תיקון שגוי במילים נדירות). מילים קצרות (3 אותיות) נבדקות בקפדנות יותר.

> מסמכי מדיניות פרטיות והצהרת נגישות הם טיוטות הדורשות בדיקה מקצועית לפני פרסום.

## תוכנת Windows

- **אוטומטי:** אחרי כל מילה (רווח) נבדקת המילה ומתוקנת אם הוקלדה בשפה שגויה. `Ctrl+Alt+Space` מיד אחרי תיקון מבטל אותו.
- **ידני:** `Ctrl+Alt+Space` ממיר את הטקסט המסומן, או את המילים האחרונות שהוקלדו בשורה.
- **פרטיות:** משתמשת ב-keyboard hook כדי לזהות סוף מילה. שומרת בזיכרון רק את השורה הנוכחית (עד 200 תווים), ללא דיסק/לוג/רשת. כברירת מחדל לא פועלת בדפדפנים (התוסף מטפל בהם), מנהלי סיסמאות, טרמינלים ושדות סיסמה קלאסיים. רשימת התוכנות המוחרגות: `%APPDATA%\KeyFlip\settings.json`.
- **דפדפנים:** אפשר להפעיל מתפריט המגש "פעל גם בדפדפנים" (שימושי בלי התוסף, או לשורת הכתובת). אל תפעילו יחד עם התוסף כדי למנוע תיקון כפול. בדפדפן אין זיהוי שדות סיסמה.
- **בנייה מקומית (Windows):** `dotnet test desktop/KeyFlip.Core.Tests` ואז `dotnet publish desktop/KeyFlip.App -c Release -r win-x64`.
- **מגבלות:** לא פועלת בחלונות שרצים כמנהל; תוכנות שחוסמות הקלדה מדומה יפעלו חלקית; ההמרה הידנית של טקסט מסומן משתמשת בלוח (ומשחזרת טקסט בלבד); אנטי-וירוס עלול לסמן תוכנה עם keyboard hook (False Positive), לכן מומלץ חתימה דיגיטלית לפני הפצה.
- **טרם נבדקה ידנית על מחשב Windows אמיתי** – הקומפילציה והבדיקות האוטומטיות של הליבה עברו ב-CI בלבד.

## מסמכים (טיוטות לבדיקה משפטית/מקצועית)
`docs/PRIVACY.md`, `docs/TERMS.md`, `docs/ACCESSIBILITY.md`, `docs/STORE_LISTING.md`, `docs/PRODUCTION_CHECKLIST.md`.

## רישיון
Apache-2.0. מילוני הזיהוי נגזרים מנתונים ברישיון CC BY-SA (ראו `NOTICE.md`).

## העברה לריפו עצמאי (`keyflip`)
```bash
git clone https://github.com/diamondrubinny/diamondrubinny.git && cd diamondrubinny
git checkout claude/typing-error-translation-addon-ae6d7h
git subtree split --prefix=keyboard-fixer -b keyflip-standalone
git push https://github.com/diamondrubinny/keyflip.git keyflip-standalone:main
```
