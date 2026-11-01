# תוכנית פרסום – KeyFlip ב-Microsoft Store (MSIX)

עודכן: 01.11.2026 · מוצר: `9NRH88MVCTQF` · סוג: MSIX

## זהות החבילה (מ-Partner Center → Product identity)
| שדה | ערך |
|---|---|
| Package/Identity/Name | `DiamondRubinny.KeyFlip` |
| Package/Identity/Publisher | `CN=A2694403-EEEE-4D3F-80BB-589A9E34AEA9` |
| PublisherDisplayName | `Diamond Rubinny` |
| PFN | `DiamondRubinny.KeyFlip_1q7b68dwp3rpe` |
| Store URL | https://apps.microsoft.com/detail/9NRH88MVCTQF |

## החלטות
1. **MSIX ולא EXE/MSI** – החנות חותמת את החבילה בעצמה → אין צורך בתעודת חתימת קוד, ונעלמות אזהרות SmartScreen/אנטי-וירוס להתקנה מהחנות. ההתקנה וההסרה נקיות.
   חלופה: מוצר מסוג "EXE or MSI" – דורש מתקין חתום ו-URL הורדה. נדחה.
2. **Full trust (`runFullTrust`)** – תוכנת Win32 עם keyboard hook ו-SendInput חייבת full trust. זו יכולת מוגבלת: נדרש נימוק ב-Submission options (טקסט מוכן בהמשך).
3. **self-contained, x64, לא single-file** – אין חבילת framework של .NET 10 בחנות. גודל ~60–80MB.
4. **"הפעל עם Windows" ב-MSIX** – ב-MSIX כתיבה ל-`HKCU\...\Run` מנותבת לאזור פרטי ולא עובדת. לכן בבנייה הארוזה (`-p:KeyFlipPackaged=true`) משתמשים ב-`StartupTask` של WinRT + הצהרת `windows.startupTask` במניפסט. הבנייה הרגילה (EXE מ-GitHub) לא משתנה.
5. **הודעת "רץ במגש"** – אפליקציית מגש בלי חלון עלולה להיראות לבודקי החנות כ"לא נפתחת". נוסף: בלון בהפעלה הראשונה, והודעה כשמפעילים מופע שני.
6. **גרסה** – `0.1.0.0` (הספרה הרביעית חייבת להיות 0 בחנות). כל הגשה הבאה חייבת גרסה גבוהה יותר.
7. **שפות** – he-IL (ראשית) ו-en-US. לכל שפה שמוצהרת בחבילה נדרש כרטיס חנות.

## שלבים
| # | שלב | מי | סטטוס |
|---|---|---|---|
| 1 | `desktop/KeyFlip.Package/` – מניפסט, אייקונים, `build-msix.ps1` | Claude | ✅ |
| 2 | שינוי קוד: StartupTask בבנייה ארוזה, הודעת הפעלה ראשונה, מופע שני | Claude | ✅ |
| 3 | CI: job בשם `msix` (windows-latest) שמפיק `KeyFlip-<ver>-x64.msix` כ-artifact | Claude | ✅ |
| 4 | טקסטים לחנות HE/EN – `docs/MS_STORE_LISTING.md` | Claude | ✅ |
| 5 | Partner Center: Pricing ✅, Properties ✅, Age ratings ✅ (3+), Store listings HE/EN ✅ (חסרים צילומי מסך), הערות לבודקים ✅ | Claude (דפדפן) | ✅ |
| 6 | Push לריפו (`push-ms-store.bat`) → CI → הורדת ה-MSIX מה-Artifacts | Diamond | ⬜ |
| 7 | בדיקת התקנה מקומית של העותק החתום-לבדיקה (ראו "בדיקה מקומית") | Diamond | ⬜ |
| 8 | צילומי מסך של תוכנת Windows (לפחות 1, 1366×768 ומעלה) | Diamond | ⬜ |
| 9 | העלאת ה-MSIX ב-Packages + צילומי מסך בשתי השפות + נימוק runFullTrust (מופיע אחרי ההעלאה, טקסט ב-`MS_STORE_LISTING.md`) | Diamond | ⬜ |
| 10 | Submit for certification (בד"כ עד 3 ימי עסקים) | Diamond / Claude באישור | ⬜ |

## בדיקה מקומית (לפני העלאה)
ה-CI מפיק שני Artifacts:
- `keyflip-msix-store-upload` – **הקובץ שמעלים לחנות** (לא חתום; החנות חותמת).
- `keyflip-msix-local-test-only` – עותק חתום בתעודה עצמית + `KeyFlip-test.cer`, **לבדיקה מקומית בלבד, לא להעלות**.

התקנת הבדיקה (PowerShell כמנהל, פעם אחת):
```powershell
Import-Certificate -FilePath .\KeyFlip-test.cer -CertStoreLocation Cert:\LocalMachine\TrustedPeople
Add-AppxPackage .\KeyFlip-0.1.0-x64-TEST-SIGNED.msix
```
לבדוק: הפעלה מתפריט התחל, בלון "פועל ברקע", הפעלה שנייה מציגה "כבר פועל", תיקון ב-Notepad, `Ctrl+Alt+Space`, "הפעל עם Windows" (נדלק ושורד הפעלה מחדש), הסרה מ-Settings → Apps.
אחרי הבדיקה: להסיר את האפליקציה ואת התעודה (`certlm.msc` → Trusted People → KeyFlip local test), לפני התקנה מהחנות.

## סיכונים
- **מדיניות החנות ל-keyboard hook** – מותר, אבל הבודקים עשויים לבקש הבהרה. מוכנים: הערות לבודקים + מדיניות פרטיות מפורשת. דורש אימות מול התיעוד הרשמי (Microsoft Store Policies 10.5 – פרטיות).
- **מדיניות פרטיות חובה** – אפליקציה שניגשת להקשות. כתובת: GitHub (`docs/PRIVACY.md`). עדיף כתובת יציבה (GitHub Pages / rubinny). הטיוטה עדיין דורשת בדיקה משפטית.
- **IARC** – שאלון הדירוג מחייב הצהרה נכונה. KeyFlip: אין תוכן, אין רשת, אין רכישות → צפוי 3+/Everyone.
- **ציבורי בכל השווקים** – ההנחה: חינם, כל השווקים, פרסום מיידי אחרי אישור. אפשר לשנות לפני ההגשה.
