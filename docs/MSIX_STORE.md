# חבילת MSIX ל-Microsoft Store – תוכנית ותפעול

> מחבר: Diamond Rubinny. סטטוס: מוכן לדחיפה, טרם אומת ב-CI.

## 1. מטרה
CI בונה חבילת `.msix` לא חתומה של תוכנת Windows, להעלאה ל-Partner Center (מוצר KeyFlip, ‏Store ID ‏`9NRH88MVCTQF`). ה-Store חותם את החבילה בעצמו.

## 2. הנחות
| # | הנחה |
|---|------|
| M1 | Partner Center מקבל `.msix` לא חתום להגשה (ה-Store חותם). דורש אימות מול התיעוד הרשמי |
| M2 | ארכיטקטורה x64 בלבד; Windows 10 1809 ומעלה (`10.0.17763.0`) |
| M3 | התוכן: ה-EXE ה-self-contained הקיים (‏.NET 10 כלול, אין תלות ב-Runtime) |
| M4 | שפות בחבילה: `he-IL` (ברירת מחדל) ו-`en-US`. ה-Store ידרוש כרטיס חנות לכל שפה |
| M5 | גרסת MSIX = `MAJOR.MINOR.PATCH.0` מ-`desktop/Directory.Build.props`. ה-Store דורש שהספרה הרביעית תהיה 0 ושכל הגשה תעלה גרסה |

## 3. זהות (GitHub → Settings → Secrets and variables → Actions → Variables)
| משתנה | ערך | מקור |
|---|---|---|
| `MSIX_IDENTITY_NAME` | `DiamondRubinny.KeyFlip` | Partner Center → Product identity |
| `MSIX_PUBLISHER` | `CN=A2694403-EEEE-4D3F-80BB-589A9E34AEA9` | כנ"ל |
| `MSIX_PUBLISHER_DISPLAY` | `Diamond Rubinny` | כנ"ל |

אלה מזהים ציבוריים, לא סודות. אם המשתנים חסרים (למשל PR מ-fork), ה-job של MSIX מדולג.

## 4. ארכיטקטורה
```
desktop/packaging/
  AppxManifest.template.xml   # תבנית; טוקנים __NAME__ __PUBLISHER__ __PUBLISHER_DISPLAY__ __VERSION__
  Assets/*.png                # לוגואים ב-scale-100/200 ו-targetsize (נוצרו מה-SVG של האייקון)
  build-msix.ps1              # layout → makepri → makeappx pack → SHA256
  test-msix.ps1               # בדיקת התקנה ב-CI: עותק חתום בתעודה זמנית → Add-AppxPackage → בדיקה → הסרה
.github/workflows/ci.yml      # job חדש: msix (needs: extension, desktop)
```
זרימה: `desktop` מעלה את `keyflip-windows-self-contained` → `msix` מוריד אותו, בונה `KeyFlip_<ver>.0_x64.msix`, מעלה artifact בשם `keyflip-windows-msix`, ואז מריץ בדיקת התקנה.

## 5. שינויי קוד באפליקציה
- **הפעלה עם Windows:** בתוך MSIX, כתיבה ל-`HKCU\...\Run` מנותבת לרג'יסטרי פרטי של החבילה, ולכן לא תעבוד. במצב ארוז:
  - המניפסט מצהיר על `desktop:StartupTask` בשם `KeyFlipStartup` עם `Enabled="false"`. ההפעלה רק בהסכמת המשתמש.
  - פריט התפריט פותח את `ms-settings:startupapps`, שם המשתמש מדליק את KeyFlip.
  - בגרסת ה-EXE הרגילה ההתנהגות לא משתנה.
- **חלון "פרטיות ומידע":** בגרסת ה-Store, ההגדרות נשמרות בתיקייה הפרטית של האפליקציה (Windows מנתב את ‎`%APPDATA%`‎). הטקסט מעודכן בהתאם.
- זיהוי מצב ארוז: `GetCurrentPackageFullName` (kernel32).

## 6. אבטחה, פרטיות ונגישות
- **הרשאות:** `runFullTrust` (הרשאה מוגבלת, נדרשת לכל אפליקציית Win32). ב-Partner Center צריך לנמק: "Win32 desktop app: global keyboard hook (WH_KEYBOARD_LL) and SendInput to fix text typed in the wrong layout. All processing is local; nothing is stored or sent." הנוסח דורש אימות מול מדיניות ה-Store.
- **מדיניות Store:** אפליקציה שמנטרת מקלדת עלולה לעבור בדיקה ידנית. ההצהרה במדיניות הפרטיות (`docs/PRIVACY.md`) חייבת להיות זמינה בכתובת ציבורית. דורש בדיקה משפטית.
- **מידע אישי:** אין שינוי. אין איסוף, אין רשת. טבלת המידע ב-`PRIVACY.md` נשארת בתוקף.
- **CI:** הערכים עוברים דרך `env`, לא אינטרפולציה בתוך סקריפט, כדי למנוע הזרקה. הסקריפט מאמת את הפורמט שלהם. תעודת הבדיקה נוצרת על הרצת ה-CI ונמחקת בסוף ההרצה. ה-artifact נשאר לא חתום.
- **נגישות:** ללא שינוי בממשק. פריט התפריט נשאר נגיש למקלדת ולקורא מסך.

## 7. תפעול: מהדחיפה ועד ההגשה
1. מריצים את `deploy-msix.bat` (מעתיק קבצים לריפו המקומי, commit ו-push ל-`main`).
2. GitHub → Actions → KeyFlip: מחכים שהריצה תסתיים בירוק, כולל ה-job ‏`msix`.
3. מורידים את ה-artifact ‏`keyflip-windows-msix` (קובץ ZIP שמכיל את `.msix` ואת `SHA256SUMS.txt`) ומחלצים.
4. Partner Center → KeyFlip → Submission → Packages: גוררים את ה-`.msix`, ממתינים לאימות.
5. משלימים: Pricing, Properties, Age ratings, Store listings (עברית + אנגלית), Submission options (נימוק ל-`runFullTrust`) → Submit.
6. הגשה הבאה: מעלים גרסה ב-`Directory.Build.props`, ב-`extension/package.json` וב-`manifest.json` (בדיקת הגרסה ב-CI אוכפת זאת).

## 8. בדיקות
- **CI:** בניית ה-MSIX, ואז התקנה בפועל על ה-runner. הבדיקה מאמתת את ה-Name, ה-Publisher וה-Version, ואז מסירה את החבילה.
- **ידני (על מחשב Windows 10/11, אחרי התקנה מה-Store או ב-sideload חתום):**
  - האייקון מופיע במגש. תיקון אוטומטי עובד ב-Notepad וב-Word. Ctrl+Alt+Space עובד.
  - "הפעלה עם Windows" פותח את דף Startup apps, KeyFlip מופיע שם, ואחרי הפעלה והתחברות מחדש התוכנה עולה.
  - הסרה מ-Start → Uninstall לא משאירה קבצים או ערכי רג'יסטרי.
  - ניווט בתפריט המגש במקלדת בלבד ועם NVDA.

## 9. סיכונים
| סיכון | טיפול |
|---|---|
| `Add-AppxPackage` על Windows Server runner עלול להיכשל בגלל התאמת device family | ה-artifact מועלה לפני הבדיקה. אם רק הבדיקה נכשלת, החבילה עדיין זמינה. בודקים את הלוג |
| דחייה בהסמכת ה-Store בגלל keyboard hook | נימוק ברור, מדיניות פרטיות ציבורית, והערות לבודקים |
| שימוש ב-SmartScreen/Defender | חבילת Store חתומה ע"י Microsoft, ולכן הבעיה פחותה |
| מגבלה ידועה: גרסת ה-Store וגרסת ה-EXE על אותו מחשב | ה-Mutex משותף, כך שרק אחת רצה. מומלץ להסיר את ה-EXE ואת ערך ה-Run שלו |

## 10. סטטוס
- ✅ תוכנית
- ✅ קבצי אריזה וסקריפטים
- ✅ שינוי הפעלה עם Windows במצב ארוז
- ⬜ דחיפה ו-CI ירוק
- ⬜ העלאה ל-Partner Center והגשה
