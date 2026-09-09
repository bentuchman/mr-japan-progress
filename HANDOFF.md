# Mr. Japan — Progress / Customer Journey — Developer Handoff

מסמך המסירה הסופי. קהל היעד: **נתנאל**.
המסמך משקף אחד-לאחד את הקוד שבמאגר (commit שממנו נארז ה-ZIP). כל טענה כאן אומתה מול הקוד ומול חבילת הבדיקות.

---

# START HERE — נתנאל (2 דקות)

**1. מה המוצר?**
ה-UI המאושר של עמוד הטיול ללקוח, ובו כרטיס **המסע / Progress** בן 10 השלבים. המוצר הוא מה שמרונדר על-ידי `src/App.tsx` ורכיבי המוצר שלו — מה שרואים **בתוך** מסגרת הטלפון. אין לבנות מחדש ואין לעצב מחדש את ה-Progress במהלך האינטגרציה: משתמשים בקוד הזה כפי שהוא.

**2. מה לפתוח קודם?**
```bash
npm install
npm run dev        # לפתוח את הכתובת שמודפסת (בד"כ http://localhost:5173/)
```
תצוגת ברירת המחדל מציגה את ה-UI של הלקוח (עם פאנל Demo כהה בתחתית — כלי פיתוח, לא חלק מהמוצר). לחלופין, בלי שום התקנה: לפתוח את `prototype-single.html` בדאבל-קליק — אותה אפליקציה בקובץ אחד.

**3. איך רואים את שני התרחישים של מור?**
תצוגת ברירת המחדל מציגה **מצב לקוח אחד בכל רגע** — זה לא אומר שמומש רק תרחיש אחד. לסקירה ויזואלית של שני התרחישים (יותר/פחות מ-3 חודשים):
- `http://localhost:5173/?compare=1` — שני iPhone זה לצד זה, או
- `http://localhost:5173/?validate=1` — 15 תרחישי QA שמריצים נתוני דמה דרך מנוע המסע האמיתי אל אותו UI,
- או מפאנל ה-Demo: "📱 השוואת תרחישים" / "🧭 אימות המסע (Phase 2)".

**4. מה הוא כלי QA/דמו בלבד (לא מוצר)?**
DemoControls (הפאנל הכהה), מסגרת ה-iPhone, תצוגת ההשוואה, תצוגת האימות, ה-fixtures, מדרג התרחישים. הם נשארים במאגר כי הם שימושיים ל-Preview ול-QA — **אסור לחשוף אותם ללקוחות בפרודקשן.**

**5. מה כבר ממומש?**
ה-UI המלא, קונפיגורציית 10 השלבים, מיפוי Monday המלא, שכבת הנרמול (`CustomerJourneyData`), מנוע המסע (`journeyRuntime`), לוגיקת החבילות, שני התרחישים של מור, הטיפול בתשלום אטרקציות מאוחר בלי רגרסיית Progress, התנהגות שלבים היסטוריים, ניתוב כל פעולות הלקוח, הטמעות Fillout/iframe, ובדיקות עצמיות מקיפות. **הכול לשימוש חוזר — לא לבנייה מחדש.**

**6. מה עדיין דורש אינטגרציית פרודקשן (שלך)?**
זהות הלקוח, הזרקת כתובת השער (BENS WORKSPACE), קריאת `loadCustomerJourney` בעליית האפליקציה, חיבור המנוע ל-`currentStageId`, עיגון במצב לקוח (`demoMode=false`), מדיניות רענון, ובדיקת EXISTS למשוב. הרשימה המלאה בפרק "אינטגרציית פרודקשן".

**7. מה אסור להריץ?** ⚠️
את שני ה-webhooks של האוטומציה שמתועדים ב-`journeyConfig.ts` (`AUTOMATION_WEBHOOKS`) — **לעולם לא** לפתוח/לקרוא/להטמיע, בשום סביבה. הם מפעילים אוטומציות אמיתיות. פירוט בפרק "בטיחות".

---

# 1. יעד המימוש (Implementation Target)

המוצר לאינטגרציה הוא ה-UI המאושר של עמוד הטיול ללקוח עם כרטיס המסע/Progress. היעד הוויזואלי הוא בדיוק מה שמוצג בפרוטוטייפ בברירת המחדל.

**אותו UI אחד משמש את כל מצבי הלקוח.** מצבי לקוח שונים אינם מסכים שונים: מנוע המסע קובע מה אותו UI מציג — איזה שלב נוכחי, איזה תת-מצב, אילו פעולות. העטיפות הבאות הן תצוגה/QA בלבד ואינן פונקציונליות פרודקשן ללקוח: מסגרת הטלפון, ההשוואה, האימות, ה-fixtures, ו-DemoControls.

# 2. שלבים 1–2 — לפני שהלקוח נכנס לאפליקציה

שלבים 1 (תוכנית בבנייה) ו-2 (תשלום שירות) קורים **לפני** שהלקוח מתחיל להשתמש באפליקציה באופן פעיל, ונשארים גלויים במסע כהקשר/היסטוריה. לקוח יכול להיכנס לראשונה כשהוא כבר בשלב 3.

ללקוח בשלב 3+ שמציץ אחורה (במצב לקוח, `demoMode=false`):
- **שלב 1:** היסטורי/קריאה-בלבד, בלי CTA.
- **שלב 2:** היסטורי/קריאה-בלבד; התשלום מוצג כהושלם; **אין** "נדרשת פעולה"; **אין** CTA "לתשלום"; אי-אפשר להפעיל תשלום מחדש (רכיב ההיסטוריה `HistoricalStagePanel` אינו מרנדר פעולות כלל, ופעולה שהושלמה בתצוגה חיה היא `div` לא-לחיץ).
- צפייה בשלב קודם משנה **רק** את `previewStageId` — לעולם לא את `currentStageId`, ולא מזיזה את הלקוח אחורה.

הטקסט ההיסטורי הנוכחי של שלב 2: **"תשלום השירות הושלם — ומכאן נפתחה הגישה לאזור האישי."**

**האות מ-Monday שמוכיח השלמת שלב 2:** `payment-stage-internal` (`color_mm145w28`) = `service-paid` או כל שלב מאוחר יותר ברצף (`advance-sent` / `advance-paid` / `consolidation-*` — שלב מאוחר מוכיח את המוקדמים). נסיגת-עבר: תווית `Paid` בעמודת הסטטוס בלוח התשלומים.

# 3. המסע — 10 השלבים (מאומת מול הקוד)

| # | id | שם | בעלות עיקרית | תתי-מצב | פעולות לקוח | חבילות | אות Monday עיקרי |
|---|---|---|---|---|---|---|---|
| 1 | `plan-building` | תוכנית בבנייה | צוות | `working` | — | הכול | `payment-stage-internal` ריק (טרם נשלחה בקשת תשלום) |
| 2 | `service-payment` | תשלום שירות | לקוח | `due`, `paid`* | `service-payment` | הכול | `payment-stage-internal = service-sent` |
| 3 | `meeting` | פגישה עם צוות מר יפן | ביחד/לקוח | `scheduled`, `upcoming` | `meeting` (Zoom), משנית: `consultation-reschedule` | הכול | Internal Status `Waiting for meeting`; `date_mkkb5x8a` |
| 4 | `changes-form` | מילוי טופס שינויים | לקוח | `open`, `submitted`* | `changes-form` | הכול | Internal Status `Changes window open` |
| 5 | `changes-processing` | שינויים בתהליך | צוות | `working` | — | הכול | Plan Approval `Changes form submitted` (אישור מור) |
| 6 | `selections` | בחירת מלונות (אדפטיבי: + תשלום אטרקציות) | לקוח | `open`, `done`*, `all-ready` (בסיס בלבד) | `hotels`, `attractions` | הכול | Plan Approval `Approved` + Internal Status `Hotels catalog` / חלון 90 הימים / `advance-sent` |
| 7 | `hotels-booking` | מלונות בהזמנה | צוות (וריאנט לקוח) | `working`, `working-payment-due` | ב-`working-payment-due`: `attractions` | **Advanced בלבד** | Internal Status `Hotels Reservations`; יציאה: checkbox `dup__of_skeleton__1`=true |
| 8 | `attractions-booking` | אטרקציות בהזמנה | צוות | `working`, `queued`, `all-ready` | — | Standard+Advanced | `advance-paid` + `status__1` (`In Progress`/`Yet to start`/`Completed`) |
| 9 | `in-japan` | ביפן | — | `traveling` | — | הכול | Internal Status `Abroad` |
| 10 | `feedback` | משוב על הטיול | לקוח | `open`, `submitted` | `feedback` | הכול | Internal Status `Archive`; הגשה = EXISTS בלוח ה-Feedbacks |

\* תתי-מצב של אישור-זמני/דמו (autoAdvance) — סימולציית תצוגה, לא מצב שהמנוע גוזר.
מצב סופני: Internal Status `Cancelled` גובר על הכול (ביטול ≠ השלמת מסע). כל אות חסר/לא-מוכר → תוצאה מפורשת `unknown` — המנוע לעולם אינו מנחש.

# 4. שני התרחישים העסקיים של מור

אלה **חוקים עסקיים הממומשים במנוע המסע** — לא שני מסכים. תצוגת שני הטלפונים היא כלי QA/דמו ויזואלי בלבד. **בפרודקשן אין בורר תרחישים ידני** — נתוני הלקוח האמיתיים מ-Monday קובעים איזה מצב ואילו פעולות אותו UI מציג.

**תרחיש א׳ — יותר מ-3 חודשים לטיול:** בחירת מלונות יכולה להיות פעילה בלי שתשלום האטרקציות נדרש. חריג מאומת: אם מצב תשלום מפורש (`payment-stage-internal = advance-sent` ומעלה) אומר שהבקשה כבר נשלחה — המצב המפורש גובר על חוק הזמן והפעולה מוצגת.

**תרחיש ב׳ — פחות מ-3 חודשים:** בחירת מלונות ותשלום אטרקציות יכולים להידרש **בו-זמנית**, באותו מצב לקוח, בתצוגת שתי-הפעולות הקומפקטית הקיימת של שלב 6.

**הערת Preview חשובה:** ברירת המחדל מציגה מצב לקוח אחד — לראות מצב שלב-6 אחד אין פירושו שרק תרחיש אחד ממומש. לסקירה ויזואלית של שניהם: `?compare=1` או `?validate=1` (תרחישים 5 ו-7א שם).

**תשלום מאוחר (החלטת מוצר, ממומש ונבדק):** לקוח שכבר הגיע לשלב 7 ותשלום האטרקציות נדרש אחר-כך (`advance-sent` + ראיה שהמלונות התקדמו: checkbox מסומן או Internal Status `Hotels Reservations`) — **נשאר בשלב 7** (תת-מצב `working-payment-due`), פעולת התשלום מוצגת שם במקביל, בחירת המלונות **אינה** נפתחת מחדש, וה-Progress **לעולם לא נסוג 7/10→6/10**. מעוגן בבדיקות המנוע (רצף 6→7→7→8 מונוטוני).

# 5. לוגיקת חבילות

`status8` (Plan, לוח Clients) → `operations.plan` → `packageFromPlan` (`src/customerActions.ts`): מיפוי מדויק תלוי-רישיות `Basic`→`basic`, `Standard`→`standard`, `Advanced`→`advanced`; **כל ערך אחר → `null`** (כולל `סטנדרטי`, שהכרעתו העסקית פתוחה — אין כינויים נתמכים נוספים).

- **Advanced:** המסע המלא (10 שלבים).
- **Standard:** בלי שלב 7 (מלונות בהזמנה) — 9 שלבים.
- **Basic:** בלי שלבים 7–8 — 8 שלבים; "הכול מוכן לטיול" = `selections/all-ready`.
- **חבילה לא ידועה:** המנוע פותר רק שלבים אוניברסליים (קיימים בכל החבילות) ומחזיר `unknown` מפורש לכל שלב תלוי-חבילה. **חבילה לא ידועה אינה הופכת בשקט ל-Advanced** (מעוגן בבדיקות).

# 6. מיפוי Monday → CustomerJourneyData

לוחות: **Clients `3573104071`** · **Payments `18241802903`** (דרך relation, לא לפי שם) · **Feedbacks 🧡 `9107032141`**.

| מושג | מקור | עמודה | שדה מנורמל | נצרך ב- |
|---|---|---|---|---|
| שלב תשלומים (מקור האמת) | Clients | `color_mm145w28` | `operations.paymentStageInternal` | `paymentStagePhase` → מנוע, סטטוס פעולות |
| חבילה (Plan) | Clients | `status8` | `operations.plan` | `packageFromPlan` → מנוע |
| Internal Status | Clients | `dup__of_internal_status__1` | `operations.internalStatus` | `internalStatusPhase` → גבולות 3↔4, 6↔7, שלבים 9–10, ביטול |
| Plan Approval (מור) | Clients | `color_mkym5k62` | `planApprovalStatus` | `planChangesPhase` → שלב 5 ומעבר ל-6 |
| מלונות הוזמנו (checkbox) | Clients | `dup__of_skeleton__1` | `operations.hotelsBooked` | `hotelsReservationPhase` → השלמת שלב 7 |
| מצב הזמנות אטרקציות | Clients | `status__1` | `operations.attractionsReservationsStatus` | `attractionsReservationsPhase` → שלב 8 |
| תחילת טיול | Clients | `date2` | `trip.startDate` | `paymentWindowOpen` (חוק 90 הימים) |
| סוף טיול | Clients | `date3` | `trip.endDate` | נשלף; שמור לחוקים עתידיים |
| תאריך יצירה | Clients | `date38__1` | `trip.createdAt` | נשלף בלבד |
| מועד פגישה | Clients | `date_mkkb5x8a` | `meeting.scheduledAt` | תת-מצב שלב 3 + שורת המועד |
| מזהה Zoom | Clients | `text2__1` | `meeting.zoomMeetingId` | נשלף בלבד |
| קישור פגישה (Zoom) | Clients | `link_mkkc5hf3` | `meeting.meetingUrl` | פעולת `meeting` |
| שינוי מועד | Clients | `formula_mkrs2ca0` / `formula_mkxr13vp` | `meeting.rescheduleUrl(/Master)` | פעולת `meetingReschedule` (מסנן fillout-בלבד) |
| טופס שינויים | Clients | `link_mkyr785r` | `forms.planChangesUrl` | פעולת `planChanges` (חסימת make.com) |
| בחירת מלונות | Clients | `text37__1` | `forms.hotelSelectionUrl` | פעולת `hotelSelection` |
| טופס משוב | Clients | `formula_mkqsm1n3` | `forms.feedbackUrl` | פעולת `feedback` |
| תשלום שירות — קישור | Payments | `link_mkwz73ze` | `payments.service.paymentUrl` | פעולת `servicePayment` |
| תשלום שירות — סטטוס/מועד/קבלה | Payments | `status` / `date_mm45fm8c` / `link_mkwzhc8x` | `payments.service.{status,paidAt,receiptUrl}` | סטטוס (נסיגת-עבר); קבלה נשלפת ולא נצרכת |
| תשלום אטרקציות — קישור | Payments | `link_mkx3zd4` | `payments.attractions.paymentUrl` | פעולת `attractionsPayment` |
| תשלום אטרקציות — סטטוס/מועד/קבלה | Payments | `color_mkx33ksf` / `date_mm4zjj26` / `link_mkx3wqha` | `payments.attractions.{status,paidAt,receiptUrl}` | סטטוס (נסיגת-עבר); קבלה נשלפת ולא נצרכת |
| קשר ללוח התשלומים | Clients | `board_relation_mkx3224n` | `paymentsMondayItemId` | שאילתת ה-hop השני |
| הגשת משוב | Feedbacks | `board_relation_mkqs44fs` | (דרך `getFeedbackSubmitted` → `extras.feedbackSubmitted`) | שלב 10 `submitted` |

השאילתות מסוננות-עמודות תמיד (לעולם לא לוח שלם ללקוח); mutation נחסם בשער (`gateway.ts`); ערך חסר/שבור → `null`, בלי הסקה.

# 7. ניתוב פעולות הלקוח

כל פעולה נושאת `dataKey` סמנטי; `resolveCustomerAction` (`src/customerActions.ts`) מתרגם אותו לכתובת של הלקוח הנוכחי בלבד. שום פעולה אינה משנה את מצב המסע — לחיצה רק פותחת גיליון/חלון.

| פעולה | שלב/תת-מצב | שדה נתונים | Renderer | פתיחה | יעד באימות | סטטוס נתוני-אמת | הגבלה |
|---|---|---|---|---|---|---|---|
| תשלום שירות | 2 `due` | `payments.service.paymentUrl` | iframe גנרי בגיליון | **בתוך האפליקציה** | עמוד מוק 🧪 (`data:`) | ממופה; ייטען עם האינטגרציה | frameability של עמוד התשלום — לאימות בפרודקשן |
| כניסה לפגישה | 3 `scheduled` | `meeting.meetingUrl` | — | **חיצוני** (Zoom, בכוונה; לא מוטמע) | `zoom.us/test` | ממופה | — |
| שינוי זמן הפגישה | 3 (משנית) | `rescheduleUrl(/Master)` | Fillout רשמי | **בתוך האפליקציה** | טופס נקי `tuqZnYRAxeus` | ממופה | קדימות רגיל/MASTER לא הוכרעה (מסנן fillout מטפל ברוב המקרים) |
| מילוי טופס שינויים | 4 `open` | `forms.planChangesUrl` | Fillout אם היעד Fillout | **בתוך האפליקציה** | טופס נקי (placeholder) | הערך בפרודקשן = webhook → נחסם בכוונה | דורש הכרעה: מה היעד פונה-הלקוח האמיתי |
| בחירת מלונות | 6 `open` | `forms.hotelSelectionUrl` | Fillout רשמי | **בתוך האפליקציה** | טופס נקי `ohzZe7sCBrus` | ממופה | — |
| תשלום אטרקציות | 6 `open` **או** 7 `working-payment-due` | `payments.attractions.paymentUrl` | iframe גנרי | **בתוך האפליקציה** | עמוד מוק 🧪 | ממופה | כמו תשלום השירות |
| משוב | 10 `open` | `forms.feedbackUrl` | Fillout רשמי | **בתוך האפליקציה** | טופס נקי `vYY9mWeMQsus` | ממופה | השלמה דורשת קריאת EXISTS (קיימת, ללא caller) |

כללי פתיחה: **Fillout → בתוך האפליקציה** · **עמודי תשלום → בכוונה בתוך האפליקציה** (בכפוף לאימות frameability בפרודקשן) · **Zoom → חיצוני בכוונה** · **webhook של Make → לעולם לא כתובת ללקוח, נחסם לפני כל מסלול תצוגה** · **כתובת חסרה/לא-נתמכת → מסך "לא זמין" הבטוח** · **הטמעה שנכשלת → אחרי timeout מוצג fallback "פתיחה בחלון חדש"**.

# 8. External Notifications → Return to App

⚠️ **התנהגות מוצר מיועדת / הקשר אינטגרציה — לא ממומש במאגר הזה.**

ערוצי התקשורת/אוטומציה הקיימים של מר יפן (אימייל / WhatsApp) יכולים להודיע ללקוח שפעולה זמינה ולהחזיר אותו לאפליקציה. הזרימה הרעיונית:

```
אימייל / WhatsApp
→ הלקוח חוזר לאפליקציית מר יפן
→ נתוני הלקוח האמיתיים נטענים (Monday דרך השער)
→ מנוע המסע גוזר את המצב הנוכחי
→ ה-UI מציג את השלב הנכון והפעולה הנדרשת
→ הלקוח מבצע את הפעולה מתוך האפליקציה
```

היכן שנתמך טכנית, הכוונה היא שהלקוח נשאר **בתוך** האפליקציה בזמן הפעולה (Fillout בפנים; עמודי תשלום בכוונה בפנים בכפוף לאימות; Zoom חיצוני; webhooks לעולם לא פונים ללקוח).

**גבול אחריות:** המאגר הזה **אינו** שולח WhatsApp, אינו שולח אימיילים, אינו מממש את אוטומציות ההתראה, אינו מוכיח deep-links בפרודקשן ואינו הבעלים של תהליך ההתראות הקיים — כל אלה בסביבת מר יפן / Monday / Make הקיימת. אחריות המימוש הזה מתחילה כשהלקוח מגיע לאפליקציה: **מצב מסע נכון + הפעולה הרלוונטית הנכונה.** הזרימה הזו מיועדת לסקירה/אישור ב-Preview.

# 9. הזרימה החיה אחרי פעולה

הארכיטקטורה המיועדת וסטטוס כל חוליה:

| חוליה | סטטוס |
|---|---|
| הלקוח מבצע פעולה → תהליך טופס/תשלום/חיצוני קיים | **IMPLEMENTED** |
| התהליך → שינוי נתונים ב-Monday | **EXTERNAL / NETHANEL** (האוטומציות הקיימות) |
| רענון/סנכרון נתוני הלקוח | **IMPLEMENTED BUT NOT WIRED** (`loadCustomerJourney` מוכן; אין caller; מדיניות רענון לא הוגדרה) |
| מנוע המסע גוזר מצב חדש | **IMPLEMENTED** (נבדק) |
| ה-UI מתעדכן מהמנוע | **IMPLEMENTED BUT NOT WIRED** (מוכח ב-`?validate=1`; חיבור הסמכות ב-`App` — שלב האינטגרציה) |

אין חוליה במצב MISSING. **סנכרון בזמן-אמת בפרודקשן אינו קיים כיום** — הוא נבנה מהחוליות המסומנות.

# 10. קבלות

- נשלפות ומנורמלות: `link_mkwzhc8x` (שירות) ו-`link_mkx3wqha` (אטרקציות) → `payments.*.receiptUrl`.
- **ה-UI אינו צורך אותן כיום.** כפתורי הנכסים ההיסטוריים ("קבלה — תשלום שירות", "סיכום פגישה", "המשוב שלך") הם כרגע **no-op** — המסכים שלהם מעולם לא מומשו.
- המאגר **אינו** שולח קבלות ו**אינו** שולח אימיילים של תשלום.

**"Receipt delivery is outside the current Progress Bar implementation and must be confirmed against the existing Mr Japan payment/automation flow."**

זה אינו חוסם Preview/מסירה.

# 11. הטמעות וקישורים — לפי סביבה

| נושא | A. פרודקשן (מיועד) | B. מגבלת Claude Artifact | C. Preview מקומי | D. נדרש אימות בפרודקשן |
|---|---|---|---|---|
| טופסי Fillout | בתוך האפליקציה (הטמעה רשמית) | CSP חוסם frames חיצוניים → מוצג fallback "פתיחה בחלון חדש" | נטענים בפנים | — |
| עמודי תשלום | בכוונה בתוך האפליקציה (iframe) | כנ"ל | עמודי המוק נטענים בפנים | **frameability של עמודי התשלום האמיתיים** |
| Zoom | חיצוני בכוונה | נפתח בטאב | נפתח בטאב | — |
| webhooks של Make | לעולם לא נפתחים | — | — | — |
| כתובת חסרה | מסך "לא זמין" | זהה | זהה | — |

**על ה-CSP:** זו מגבלה של פלטפורמת ה-Artifact בלבד. הטמעה שנחסמת שם **אינה מוכיחה** שההטמעה תיכשל בפרודקשן. מנגנון ה-fallback (timeout ללא `onInit` → הודעה + "פתיחה בחלון חדש") ממומש ומכסה גם כישלון עתידי אמיתי.

# 12. מפת קוד — מוצר מול QA/דמו

**מוצר / יעד אינטגרציה:**
```
src/App.tsx                            המסך הראשי; חיווט הפעולות והמצב
src/journeyConfig.ts                   מקור האמת של 10 השלבים, תתי-המצב והפעולות
src/journeyRuntime.ts                  מנוע המסע (deriveJourneyRuntimeState)
src/customerActions.ts                 פרשנים + resolveCustomerAction + חוק 90 הימים
src/customerSession.ts                 store הלקוח הנוכחי + loadCustomerJourney
src/monday/gateway.ts                  תעבורה לשער (query בלבד; endpoint מוזרק בזמן-ריצה)
src/monday/customerJourneyData.ts      עמודות, נרמול, getCustomerJourneyData, getFeedbackSubmitted
src/components/JourneyPath.tsx         פס ההתקדמות
src/components/CurrentStagePanel.tsx   כרטיס השלב הנוכחי
src/components/HistoricalStagePanel.tsx  צפייה בשלב שהושלם (קריאה-בלבד)
src/components/EmbeddedActionSheet.tsx גיליון הפעולה המוטמע + מנגנון ה-fallback
src/components/ActionContentRenderer.tsx  בחירת renderer (Fillout/iframe)
src/components/FilloutRenderer.tsx     הטמעת Fillout הרשמית
src/components/BottomSheet.tsx         גיליון תחתון גנרי
src/components/CardDecor.tsx           רקע הכרטיס
src/styles.css · src/assets/           עיצוב, פונטים (Heebo), תמונות
```

**QA / דמו בלבד (לא נחשף ללקוחות בפרודקשן):**
```
src/components/DemoControls.tsx        הפאנל הכהה
src/components/IPhoneDemoFrame.tsx     מסגרת ה-iPhone
src/components/CompareView.tsx         שני התרחישים זה לצד זה
src/components/JourneyValidationView.tsx  תצוגת האימות (15 תרחישים)
src/journeyValidationStates.ts         ה-fixtures הסינתטיים
src/components/LinkDiagnostics.tsx     אבחון קישורים (DEV)
src/actionLinks.ts                     קבועי דמו
scripts/*.mjs                          בדיקות עצמיות + סקריפטי אימות מקומיים + בניית הבאנדלים
```

# 13. אינטגרציית פרודקשן — נתנאל

מה שנותר **במכוון** לא-מחווט (לא פגמים — תפרי האינטגרציה):

1. אספקת/הזרקת כתובת השער (BENS WORKSPACE) — `configureMondayGateway({endpoint})`; הכתובת אינה במאגר בכוונה ו**אסור** לקבע אותה בבאנדל ציבורי.
2. זהות הלקוח האמיתי (מאיפה מגיע `clientMondayItemId` — לא קיים כיום שום מנגנון; הקונבנציה הקרובה: קישורים מותאמים עם `?clientMondayID=` — לא מאומתת-זהות, דורשת הכרעה).
3. קריאת `loadCustomerJourney(customerId)` בעליית האפליקציה.
4. מדיניות רענון/סנכרון אחרי שינויי Monday (polling / refocus / push).
5. סמכות המנוע: `deriveJourneyRuntimeState` → `currentStageId` ב-`App` (כיום מוכח רק בתצוגת האימות).
6. עיגון פרודקשן במצב לקוח: `demoMode=false` (הפרוטוטייפ עולה במצב דמו לנוחות הסקירה).
7. חיבור בדיקת הגשת המשוב (`getFeedbackSubmitted` קיימת; אם לוח ה-Feedbacks יגדל מעבר לכ-3,000 אייטמים — להעביר את בדיקת ה-EXISTS לצד השער).
8. האוטומציות הקיימות ב-Monday/Make שמעדכנות את סטטוסי המקור.
9. שילוב/אירוח בעמוד הטיול האמיתי של מר יפן.
10. אימות הטמעת עמודי התשלום האמיתיים (frameability).
11. הכרעת היעד פונה-הלקוח של טופס השינויים (הערך הנוכחי ב-Monday הוא webhook — נחסם בכוונה).
12. אישור תהליך משלוח הקבלות מול הזרימה הקיימת.
13. אישור אינטגרציית ההחזרה-לאפליקציה מאימייל/WhatsApp (deep-links) מול התהליך הקיים.

# 14. פריטים פתוחים ידועים (לא חוסמים)

- יעד טופס השינויים ללקוח — דורש הכרעה עסקית/אינטגרציה (סעיף 13.11).
- שני ה-webhooks המתועדים חייבים להישאר חסומים (ראו "בטיחות").
- frameability של עמודי תשלום אמיתיים — לאימות בפרודקשן.
- כפתורי קבלה/נכסי היסטוריה — no-op כיום.
- תוויות Internal Status לא ממופות בכוונה: `Mid QA`, `Final QA`, `Waiting for flight`, `Waiting for flight - Final`, `Stuck` → `other` (לא קובעות שלב; דגימות ה-changed_at שתוכננו יכולות למפות אותן בעתיד).
- תווית חבילה `סטנדרטי` — לא ממופה עד הכרעה (→ `unknown`, לא Advanced).
- קדימות `Meeting reschedule` מול `MASTER` — לא הוכרעה (מסנן fillout-בלבד מטפל ברוב המקרים).
- `advance-paid` עם עוקב הזמנות ריק/לא-מוכר → `unknown` (מקרה קצה; מדיניות רצויה פתוחה).
- מגבלת CSP של ה-Artifact (סעיף 11) — לא רלוונטית לפרודקשן.

# 15. בטיחות ⚠️

**לעולם אין להריץ את כתובות ה-webhook של האוטומציה שמופיעות במאגר** — `AUTOMATION_WEBHOOKS` ב-`src/journeyConfig.ts` (makeA + planChanges, `hook.eu2.make.com/...`). אלה נקודות קצה של אוטומציה, **לא** קישורים ללקוח: פתיחה/קריאה/הטמעה שלהן עלולה להפעיל אוטומציה אמיתית על נתוני אמת. הן מתועדות במאגר לצורך היכרות בלבד, וקוד הניתוב חוסם אותן מכל מסלול תצוגה.

בנוסף: אין לבצע mutation ב-Monday במהלך Preview (השער ממילא מסרב לכל דבר שאינו `query`); אין לקבע את כתובת השער בפרונטאנד ציבורי; אין לקבע מזהי לקוח בקוד; אין לארוז סודות; אין להתייחס ל-fixtures כנתוני לקוח אמיתיים (הם סינתטיים לחלוטין, וכתובות הטפסים בהם הן טפסי הדמו הנקיים, לא של לקוח).

# 16. הרצה / Preview

דרישה: Node 20.19+ (או 22+; הפרויקט על Vite 8).

```bash
npm install
npm run dev            # פיתוח — לפתוח את הכתובת המודפסת
npm run build          # בניית פרודקשן (dist/)
npm run build:single   # קובץ יחיד: prototype-single.html
npm run build:artifact # גרסת ה-Artifact (מתוך prototype-single)

# בדיקות (מקומיות לחלוטין — אפס רשת, אפס Monday/Make):
npx tsc --noEmit
node --experimental-strip-types scripts/monday-phase1-selftest.mjs
node --experimental-strip-types scripts/journey-runtime-selftest.mjs

# אימות חי מול השער — מהמחשב שלך בלבד, קריאה-בלבד, פלט מצונזר:
BENS_WORKSPACE_URL=... node --experimental-strip-types scripts/monday-phase1-check.mjs <clientItemId>
BENS_WORKSPACE_URL=... node --experimental-strip-types scripts/feedback-check.mjs <ids...>
```

**תצוגות (מה לפתוח):**

| כתובת | מה זה | סוג |
|---|---|---|
| `/` | **לפתוח ראשון** — ה-UI של הלקוח בדסקטופ + פאנל Demo | מוצר (בעטיפת סקירה) |
| `/?phone=1` | המוצר במסגרת iPhone | עטיפת תצוגה |
| `/?compare=1` | **שני התרחישים של מור** זה לצד זה | QA בלבד |
| `/?validate=1` | **15 תרחישי אימות** → המנוע האמיתי → אותם טלפונים | QA בלבד |
| `prototype-single.html` | הכול בקובץ אחד, נפתח בדאבל-קליק בלי build | סקירה |

Compare/Validation הן עטיפות QA — לא מסכי פרודקשן. כל התצוגות נגישות גם בכפתורים מפאנל ה-Demo.

# 17. סטטוס בדיקות ומה הן מוכיחות

בוצעו בפועל על ה-commit הארוז (וגם בחדר-נקי על ה-ZIP): `tsc --noEmit` נקי · חבילת שער/נרמול/פרשנים — עוברת · חבילת מנוע המסע — עוברת, כולל **סריקת דטרמיניזם/תקפות-קונפיג של 1,944 לקוחות סינתטיים × 3 חבילות** · build פרודקשן — עובר · 15 תרחישי האימות אומתו בדפדפן אמיתי (מצבים, CTA, אי-רגרסיה, אפס תעבורת Monday/Make).

**האימות מוכיח:** מיפוי, חוקי מסע, גזירת מצב, שני התרחישים, הצגת/ניתוב פעולות.
**האימות אינו מוכיח:** זהות בפרודקשן, קישוריות Make חיה מהאפליקציה, סנכרון Monday חי, השלמת תשלום, משלוח קבלות, משלוח אימייל/WhatsApp, deep-links בפרודקשן.

---
*המסמך הזה מחליף כל גרסה קודמת של HANDOFF.md.*
