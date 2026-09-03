# Mr. Japan — Progress · מסמך מסירה למפתח

פרוטוטייפ של רכיב "מסע הלקוח" (Progress) לאפליקציית מר יפן.
React 19 + TypeScript + Vite. עברית RTL. **דמו בלבד — אין אינטגרציות פרודקשן.**

## הרצה

```bash
npm install
npm run dev            # שרת פיתוח
npm run build:single   # קובץ HTML יחיד עצמאי (prototype-single.html)
npm run build:artifact # גרסת artifact.html (כולל publish-guard, ראו בהמשך)
```

אפשר גם בלי כלום: לפתוח את `prototype-single.html` בדפדפן — הכול (JS, CSS, פונט) מוטמע בקובץ.

## מפת הקוד — איפה מה חי

| קובץ | תפקיד |
|---|---|
| `src/journeyConfig.ts` | **מקור האמת היחיד**: 10 שלבי המסע, תתי-מצבים, `JOURNEY_ACTIONS` (פעולות הלקוח), וקבוצות הקישורים. אין לוגיקת שלבים ב-JSX |
| `src/App.tsx` | חיווט. `handleAction` מנתב לפי `action.provider` בלבד — אין `if (stageId === ...)` |
| `src/components/EmbeddedActionSheet.tsx` | הגיליון שנפתח מעל המסע לפעולה חיצונית |
| `src/components/ActionContentRenderer.tsx` | בחירת renderer לפי provider: `fillout` → הטמעה רשמית, אחרת iframe גנרי |
| `src/components/FilloutRenderer.tsx` | `@fillout/react` / `FilloutStandardEmbed`, כל פרמטרי ה-URL מועברים, `dynamicResize` |
| `src/actionLinks.ts` | תפר לבקאנד: `setActionLinkSource()` — במעבר לפרודקשן מחליפים מקור אחד, לא UI |
| `src/components/LinkDiagnostics.tsx` | הארנס בדיקות DEV (בתוך Advanced Demo Controls) — לא חלק ממסך הלקוח |

## מודל המצב — שני מושגים שאסור לבלבל

- `currentStageId` — איפה הלקוח **בפועל**. בפרודקשן נשלט ע"י Monday בלבד.
- `previewStageId` — איזה שלב **מודגם** כרגע (פס ההתקדמות בדמו). לעולם לא מזיז את המצב בפועל.
- סטטוס פעולה הוא תלת-מצבי: `pending` → `waitingForTeam` ("✓ נשלח" — הלקוח ביצע) → `completed` ("✓ הושלם" — רק סימון V ב-Monday). פתיחת פעולה **לעולם** אינה מקדמת את המסע.

## מיפוי הפעולות (אומת עסקית)

כתובות הדמו הפעילות הן כתובות בסיס *נקיות* — בלי שם לקוח, אימייל או
מזהים. בפרודקשן הבקאנד יספק את הכתובת המלאה ללקוח המחובר.

| פעולה | שלב | provider | יעד (דמו נקי) |
|---|---|---|---|
| בחירת מלונות | 6 (שני התרחישים) | `fillout` | `mrjapan.fillout.com/t/ohzZe7sCBrus` |
| שינוי זמן פגישת ייעוץ | 3 | `fillout` | `mrjapan.fillout.com/t/tuqZnYRAxeus` |
| משוב | 10 | `fillout` | `mrjapan.fillout.com/t/vYY9mWeMQsus` |
| מילוי טופס שינויים | 4 | `make-webhook` | **חסום בקוד, בלי url על הפעולה** — ראו אזהרה |
| תשלום שירות / פגישה / אטרקציות | 2/3/6 | — | טרם נמסרו כתובות; מוצג מצב "טרם חובר" |

שני תרחישי הדמו (יותר/פחות מ-3 חודשים לטיול) חולקים מסע אחד; ההבדל בשלב 6 נגזר מ-`requiresPaymentWindow` בקונפיג.

## ⚠️ אזהרות — לא לשבור

1. **ה-webhook של Make (שלב 4) אסור להפעלה.** לא fetch, לא iframe, לא ניווט — ייתכן שהוא מריץ אוטומציה אמיתית על נתוני לקוח. הנתב חוסם אותו לפני כל שימוש ב-URL (`verifiedDisplayTarget: false`). עד שמאומת מה הוא מחזיר — ככה זה נשאר.
2. **הכתובות אטומות.** לא מפרקים מהן מזהי לקוח ללוגיקה, לא בונים אותן מחדש. בפרודקשן הן יגיעו מהבקאנד/Monday דרך `actionLinks.ts`.
3. **פרטיות:** שם לקוח, אימייל, מזהי Monday/Airtable ופרמטרים לא מוצגים בשום UI — כולל מסכי DEV (שם מוצג host+path בלבד).
4. **אין סודות בפרונט.** טוקנים של Monday/Make שייכים לבקאנד בלבד.

## publish-guard (ב-`scripts/build-artifact.mjs`)

הולידטור של פרסום Artifacts ב-claude.ai מסווג בטעות עמוד שבו `id=` ואחריו 2048+ תווים ללא רווח (קורה בבאנדל ממוזער כשכתובת עם `?id=` נושקת למחרוזות ארוכות). הבנייה מזהה זאת ומוסיפה `\n` בגבול חוקי בין שדות אובייקט — אפס שינוי התנהגות. לא למחוק.

## מה נשאר פתוח

- אימות ויזואלי שה-Zite וה-Fillout באמת מרונדרים בתוך הגיליון (סביבת הפיתוח שבה נבנה הפרוטוטייפ חסמה רשת חיצונית). אם ספק חוסם הטמעה — יופיע `X-Frame-Options`/`frame-ancestors` ב-Console.
- התנהגות ה-webhook של Make (מה הוא מחזיר?) — ואז חיבור שלב 4.
- כתובות אמיתיות לתשלום שירות, פרטי פגישה (Zoom) ותשלום אטרקציות.
- אינטגרציית Monday אמיתית (קריאת שלב + סטטוסי פעולות) דרך `actionLinks.ts`.
