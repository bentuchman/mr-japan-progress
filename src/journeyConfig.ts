// ============================================================
// journeyConfig — המסע הגלוי ללקוח (מקור אמת יחיד)
//
// תשלום השירות הוא שלב 2 במסע הלקוח. לאחר השלמתו נפתחת הגישה
// לאזור האישי — לכן בכניסה הראשונה שלבים 1–2 כבר מושלמים.
// שלבים שאינם רלוונטיים לחבילה פשוט אינם קיימים בתצוגה.
// "מוכנים לטיסה" אינו אבן-דרך — "הכול מוכן לטיול" הוא סטטוס בלבד
// בתוך השלב הרלוונטי האחרון לפני הטיסה (החלטת stakeholder).
//
// שני מושגי מצב נפרדים (המימוש ב-App.tsx):
//   currentStage — היכן הלקוח נמצא בפועל (מצב הפרודקשן).
//   previewStage — איזה שלב מודגם כרגע. שינוי ה-preview לעולם
//   אינו מזיז את currentStage.
// ============================================================

export type PackageId = 'basic' | 'standard' | 'advanced';
export type Ownership = 'client' | 'team' | 'both' | 'none';
export type SheetKind =
  | 'meeting'
  | 'payment'
  | 'attractions-pay'     // תשלום אטרקציות (סימולציה; המנגנון בפועל יוגדר)
  | 'feedback'            // טופס משוב (דמו)
  | 'feedback-view'       // צפייה במשוב שנשלח (קריאה בלבד)
  | 'none';

// תרחיש זמן-לטיול — הכלל העסקי: "3 חודשים לפני הטיול".
// בפרוטוטייפ זהו דגל תרחיש דמו; במימוש אמיתי ייגזר מתאריכי הטיול /
// סטטוס backend / אוטומציית Monday — הסף המדויק לא נקבע כאן בכוונה.
export type TimeToTripScenario = 'moreThanThreeMonths' | 'lessThanThreeMonths';

// ===== פעולות לקוח — יחידת המידע שהמסך בנוי סביבה =====
// כל פעולה נושאת מצב משלה. לחיצה על CTA פותחת את ה-Sheet ומעבירה
// ל-waitingForTeam בלבד; ההשלמה (completed) מגיעה מ-Monday.
export type ActionStatus = 'pending' | 'waitingForTeam' | 'completed';

// איך הפעולה נפתחת:
//   fillout  — טופס Fillout מוטמע (ספק ידוע; אם יידרש embed רשמי,
//              השינוי יהיה כאן בלבד ולא ב-UI)
//   embedded — תוכן חיצוני אחר מוטמע באפליקציה
//   external — פעולה שקורית באמת מחוץ למר יפן (למשל פגישת Zoom)
//   sheet    — מסך פנימי קיים של המוצר (BottomSheet)
export type OpenMode = 'fillout' | 'embedded' | 'external' | 'sheet';

export interface JourneyAction {
  id: string;
  stageId: string;              // לאיזה שלב במסע הפעולה שייכת
  icon: string;
  title: string;                // שם הפעולה — מוצג כשיש יותר מפעולה אחת
  cta: string;                  // תווית קצרה לשורת פעולה ("לבחירה")
  ctaFull?: string;             // תווית ל-CTA ראשי (פעולה בודדת) — ברירת מחדל: cta
  // null = טרם נקבע כיצד הפעולה נפתחת (אין קישור מאומת). ה-CTA נשאר
  // גלוי, ולחיצה מציגה מצב "טרם חובר" (DEV) — לא תוכן מומצא.
  openMode: OpenMode | null;
  // כתובת מלאה ואטומה כפי שהיא מגיעה מ-Monday. null = טרם סופקה כתובת
  // אמיתית לפעולה הזו (לא ממציאים קישורים). ה-UI אינו מפרש אותה.
  url: string | null;
  opens?: SheetKind;            // ל-openMode 'sheet' — איזה מסך פנימי נפתח
  // ל-openMode 'fillout': מזהה הטופס אצל הספק. נשמר בקונפיג ולא נגזר
  // מהכתובת — הכתובת נשארת אטומה.
  filloutFormId?: string;
  // דומיין מותאם ל-Fillout. לא מוגדר = משטח ההגשה הרגיל של הספק.
  filloutDomain?: string;
  requiresPaymentWindow?: boolean;  // פעילה רק כשחלון תשלום האטרקציות פתוח
}

export interface SubState {
  id: string;
  demoLabel: string;            // ל-DEMO בלבד
  ownership: Ownership;         // מי בכדור בתת-מצב הזה
  pill?: string;                // דריסת קופי הבעלות — קופי הקשרי לשלב
  jpLine?: string;              // רגע יפני — רק בשלב "ביפן" (ようこそ)
  message?: string;             // בשפת לקוח — קצר
  dateLine?: string;            // שורת מועד שמוצגת בבית (📅)
  detail?: string;
  actions?: string[];           // מזהי פעולות מ-JOURNEY_ACTIONS (0 / 1 / רבות)
  confirms?: string[];          // אישורי "התקבל ✓" (ירוק — רק כאן)
  summary?: string[];           // סיכום קומפקטי אחרי שליחה (🏨 3 מלונות...)
  viewLabel?: string;           // כפתור משני לצפייה בנכס שנשלח
  viewOpens?: SheetKind;        // מה כפתור הצפייה פותח (קריאה בלבד)
  autoAdvance?: boolean;        // תת-מצב אישור זמני שמתגלגל לשלב הבא
  packages?: PackageId[];       // תת-מצב רלוונטי רק לחלק מהחבילות
}

export interface Stage {
  id: string;
  name: string;
  icon: string;                 // איור הקשר קטן אחד (לא בכל מקום)
  packages: PackageId[];
  subStates: SubState[];
  historyAsset?: string;        // נשאר לצפייה אחרי השלמה
  historyOpens?: SheetKind;     // מה כפתור ההיסטוריה פותח (אם קיים sheet)
  historyText?: string;         // מוצג בצפייה בשלב שהושלם (מצב לקוח)
}

export const PACKAGES: { id: PackageId; label: string }[] = [
  { id: 'basic', label: 'בסיסי' },
  { id: 'standard', label: 'סטנדרטי' },
  { id: 'advanced', label: 'מתקדם' },
];

// בעלות כפיצ'ר מוצר: עונה תוך שנייה "מי מטפל בזה עכשיו?"
// תווית קומפקטית — צ'יפ, לא משפט. ההרחבה חיה ב-message של תת-המצב.
export const OWNERSHIP_PILL: Record<Ownership, string> = {
  client: 'אתם',
  team: 'צוות מר יפן',
  both: 'ביחד עם צוות מר יפן',
  none: 'אין צורך בפעולה',
};

// גרסה קצרה ושקטה — לשורות של שלבים עתידיים ב"כל שלבי המסע".
// "הכדור אצלכם" בשלב עתידי היה נקרא כאילו נדרשת פעולה עכשיו.
export const OWNERSHIP_SHORT: Record<Ownership, string> = {
  client: 'פעולה שלכם',
  team: 'צוות מר יפן',
  both: 'פגישה משותפת',
  none: '',
};

const ALL: PackageId[] = ['basic', 'standard', 'advanced'];

export const STAGES: Stage[] = [
  {
    id: 'plan-building',
    name: 'תוכנית בבנייה',
    icon: '🗺️',
    packages: ALL,
    historyText: 'צוות מר יפן הכין את התוכנית הראשונית שלכם.',
    subStates: [
      {
        id: 'working',
        demoLabel: 'הצוות מכין',
        ownership: 'team',
        message: 'אנחנו עובדים על התוכנית שלכם. אין צורך לבצע פעולה כרגע.',
      },
    ],
  },
  {
    id: 'service-payment',
    name: 'תשלום שירות',
    icon: '💳',
    packages: ALL,
    historyAsset: 'קבלה — תשלום שירות',
    historyText: 'תשלום השירות הושלם — ומכאן נפתחה הגישה לאזור האישי.',
    subStates: [
      {
        id: 'due',
        demoLabel: 'ממתין לתשלום',
        ownership: 'client',
        message: 'התוכנית מוכנה — ממשיכים לתשלום.',
        actions: ['service-payment'],
      },
      {
        id: 'paid',
        demoLabel: 'הושלם (אישור זמני)',
        ownership: 'none',
        confirms: ['תשלום השירות הושלם — הגישה לאזור האישי נפתחה'],
        autoAdvance: true,
      },
    ],
  },
  {
    id: 'meeting',
    name: 'פגישה עם צוות מר יפן',
    icon: '📅',
    packages: ALL,
    historyAsset: 'סיכום פגישה',
    historyText: 'נפגשנו ועברנו יחד על התוכנית.',
    subStates: [
      {
        id: 'scheduled',
        demoLabel: 'נקבעה',
        ownership: 'both',
        dateLine: 'יום ג׳, 12/08 · 19:00',
        actions: ['meeting'],
      },
      {
        id: 'upcoming',
        demoLabel: 'טרם נקבעה',
        ownership: 'both',
        message: 'נעבור יחד על התוכנית ונדייק את הפרטים.',
      },
    ],
  },
  {
    id: 'changes-form',
    name: 'מילוי טופס שינויים',
    icon: '✏️',
    packages: ALL,
    historyAsset: 'טופס שינויים',
    historyText: 'טופס השינויים התקבל וטופל.',
    subStates: [
      {
        id: 'open',
        demoLabel: 'פתוח למילוי',
        ownership: 'client',
        message: 'עכשיו אפשר לדייק את התוכנית.',
        dateLine: 'פתוח עד 18/08',
        actions: ['changes-form'],
      },
      {
        id: 'submitted',
        demoLabel: 'נשלח (אישור זמני)',
        ownership: 'none',
        confirms: ['קיבלנו את השינויים שלכם'],
        autoAdvance: true,
      },
    ],
  },
  {
    id: 'changes-processing',
    name: 'שינויים בתהליך',
    icon: '📝',
    packages: ALL,
    historyText: 'השינויים שביקשתם הוטמעו בתוכנית.',
    subStates: [
      {
        id: 'working',
        demoLabel: 'הצוות מעדכן',
        ownership: 'team',
        message: 'אנחנו מעדכנים את התוכנית.',
      },
    ],
  },
  {
    // שלב אדפטיבי לפי זמן-לטיול. שתי הפעולות מוגדרות ב-JOURNEY_ACTIONS
    // ונגזרות דרך stageActions('selections', paymentWindowOpen) — אין
    // תנאים מקודדים ב-JSX. כשהחלון פתוח App מרחיב את שם השלב.
    id: 'selections',
    name: 'בחירת מלונות',
    icon: '🏨',
    packages: ALL,
    historyText: 'הפעולות הושלמו והועברו לטיפול.',
    subStates: [
      // הפעולות הפעילות והשלמתן נגזרות ב-App מ-stageActions()
      { id: 'open', demoLabel: 'פתוח לפעולות', ownership: 'client' },
      {
        id: 'done',
        demoLabel: 'הושלם',
        ownership: 'none',
        confirms: ['הפעולות הושלמו'],
        autoAdvance: true,
      },
      {
        id: 'all-ready',
        demoLabel: 'הכול מוכן לטיול',
        ownership: 'none',
        message: 'הכול מוכן לטיול 🇯🇵',
        detail: 'נתראה בשדה התעופה.',
        confirms: ['הכול מוכן לטיול'],
        packages: ['basic'],
      },
    ],
  },
  {
    id: 'hotels-booking',
    name: 'מלונות בהזמנה',
    icon: '🛎️',
    packages: ['advanced'],
    historyText: 'המלונות שבחרתם הוזמנו בהצלחה.',
    subStates: [
      {
        id: 'working',
        demoLabel: 'בהזמנה',
        ownership: 'team',
        pill: 'צוות מר יפן · הזמנות',
        message: 'אנחנו מטפלים בהזמנת המלונות שבחרתם.',
      },
    ],
  },
  {
    id: 'attractions-booking',
    name: 'אטרקציות בהזמנה',
    icon: '🎟️',
    packages: ['standard', 'advanced'],
    historyText: 'האטרקציות שבחרתם הוזמנו בהצלחה.',
    subStates: [
      {
        id: 'working',
        demoLabel: 'בהזמנה',
        ownership: 'team',
        message: 'אנחנו מטפלים באטרקציות שבחרתם.',
      },
      {
        id: 'all-ready',
        demoLabel: 'הכול מוכן לטיול',
        ownership: 'none',
        message: 'הכול מוכן לטיול 🇯🇵',
        detail: 'נתראה בשדה התעופה.',
        confirms: ['הכול מוכן לטיול'],
      },
    ],
  },
  {
    id: 'in-japan',
    name: 'ביפן',
    icon: '⛩️',
    packages: ALL,
    historyText: 'הייתם ביפן — מקווים שנהניתם מכל רגע.',
    subStates: [
      {
        id: 'traveling',
        demoLabel: 'בטיול',
        ownership: 'none',
        jpLine: 'ようこそ、日本へ！',
        message: 'הטיול שלכם התחיל!',
        detail: 'אנחנו כאן לצדכם לאורך הטיול.',
      },
    ],
  },
  {
    id: 'feedback',
    name: 'מילוי פידבק',
    icon: '💬',
    packages: ALL,
    historyAsset: 'המשוב שלך',
    historyOpens: 'feedback-view',
    historyText: 'תודה על המשוב — היה לנו לעונג ללוות אתכם.',
    subStates: [
      {
        id: 'open',
        demoLabel: 'פתוח למילוי',
        ownership: 'client',
        message: 'נשמח לשמוע את חוות הדעת שלכם על הטיול.',
        actions: ['feedback'],
      },
      {
        id: 'submitted',
        demoLabel: 'נשלח — המסע הושלם',
        ownership: 'none',
        message: 'תודה ששיתפתם אותנו בחוויה שלכם.',
        confirms: ['המשוב שלכם התקבל'],
        viewLabel: 'צפייה במשוב',
        viewOpens: 'feedback-view',
      },
    ],
  },
];

// פרטי הפגישה — תוכן ה-Bottom Sheet (mock; בעתיד מ-Monday)
export const MEETING_DETAILS = {
  title: 'פגישה עם צוות מר יפן',
  date: 'יום ג׳, 12 באוגוסט',
  time: '19:00',
  location: 'Zoom',
  description: 'נעבור יחד על התוכנית ונדייק את הפרטים.',
  cta: 'כניסה לפגישה',
  afterNote: 'אחרי הפגישה: מילוי טופס שינויים',
};

// פרטי תשלום השירות — תוכן ה-Bottom Sheet (mock)
export const PAYMENT_DETAILS = {
  title: 'תשלום שירות',
  description: 'תשלום דמי השירות של מר יפן. לאחר התשלום נפתחת הגישה המלאה לאזור האישי — וממשיכים במסע.',
  line: '💳 תשלום מאובטח · אישור מיידי',
  cta: 'מעבר לתשלום',
};

// ============================================================
// מלאי הקישורים. מופרד לשלוש קבוצות, ורק הראשונה משויכת לפעולה.
// כל כתובת נשמרת שלמה וכ*אטומה*: לא מפרקים פרמטרים, לא מחלצים מזהים,
// לא בונים מחדש ולא מציגים כתובות גולמיות ללקוח.
// ============================================================

// (1) מאומת ומשויך לפעולה
export const DEMO_ACTION_LINKS = {
  // טופס בחירת המלונות — הקישור היחיד שאושר לשיוך בשלב זה
  hotelSelection:
    'https://mrjapan.fillout.com/t/ohzZe7sCBrus?clientName=%D7%A9%D7%92%D7%99%D7%AA%20%D7%A7%D7%99%D7%A0%D7%9F-%D7%92%D7%A8%D7%95%D7%A1%D7%A4%D7%9C%D7%93%20%20(%D7%94%D7%92%D7%A8%D7%95%D7%A1%D7%A4%D7%9C%D7%93%D7%99%D7%9D)&clientAirtableID=recPNgSfcIpGwEROL&plan=Advanced&dest1=%D7%98%D7%95%D7%A7%D7%99%D7%95&date1=08/12/2026%20-%2011/12/2026&dest2=%D7%94%D7%90%D7%A7%D7%95%D7%A0%D7%94&date2=11/12/2026%20-%2012/12/2026&dest3=%D7%A7%D7%99%D7%95%D7%98%D7%95&date3=12/12/2026%20-%2015/12/2026&dest4=%D7%90%D7%95%D7%A1%D7%A7%D7%94&date4=15/12/2026%20-%2017/12/2026&dest5=%D7%98%D7%95%D7%A7%D7%99%D7%95&date5=17/12/2026%20-%2020/12/2026&dest1days=3&dest2days=1&dest3days=3&dest4days=2&dest5days=3',
} as const;

// (2) קישורים אמיתיים שתפקידם העסקי *טרם אומת* — לא משויכים לשום שלב
export const UNASSIGNED_LINKS = {
  filloutUnknown:
    'https://mrjapan.fillout.com/t/vYY9mWeMQsus?clientName=%D7%AA%D7%9E%D7%A8%20%D7%98%D7%9C%20%D7%A7%D7%A8%D7%A1%D7%95%20%20(%D7%9E%D7%A9%D7%A4%D7%97%D7%AA%20%D7%A7%D7%A8%D7%A1%D7%95)&mondayClientId=11395841792',
  zitePage: 'https://wnzocgbazy.zite.so/?id=12683534596',
} as const;

// (3) Webhooks של אוטומציה — *לא* עמודים ללקוח.
// לא מוטמעים, לא נפתחים מ-CTA, ולא מופיעים בשום מקום ב-UI.
// מוחזקים כאן לתיעוד בלבד עד שתפקידם יאומת.
export const AUTOMATION_WEBHOOKS = {
  makeA: 'https://hook.eu2.make.com/bcpqbqhj3c3ww2biylmmlw4buljklg26?id=11395841792',
  makeB: 'https://hook.eu2.make.com/uishntrm4b5350rij0ssujkmv8krqosn?clientMondayID=11395841792',
} as const;

// ============================================================
// DEV_LINK_INVENTORY — מלאי טכני לבדיקות בלבד.
// לא מחובר לשום שלב במסע. journeyAction נקבע רק אחרי אימות עסקי;
// מזהה טופס אינו ראיה לתפקיד. הכתובות נשמרות שלמות ואטומות, ואינן
// מוצגות בשום ממשק — גם לא ב-DEV (מוצג host+path בלבד).
// ============================================================
export type LinkProvider = 'fillout' | 'zite' | 'make';

export interface DevLink {
  id: string;
  provider: LinkProvider;
  url: string;
  filloutId?: string;
  journeyAction: string | 'unknown';
  customerFacing: boolean | 'unknown';
}

export const DEV_LINK_INVENTORY: DevLink[] = [
  {
    id: 'hotelFillout', provider: 'fillout', filloutId: 'ohzZe7sCBrus',
    url: DEMO_ACTION_LINKS.hotelSelection,
    journeyAction: 'hotels', customerFacing: true,
  },
  {
    id: 'filloutC', provider: 'fillout', filloutId: 'tuqZnYRAxeus',
    url: 'https://mrjapan.fillout.com/t/tuqZnYRAxeus?mondayId=11395841792&clientName=%D7%AA%D7%9E%D7%A8%20%D7%98%D7%9C%20%D7%A7%D7%A8%D7%A1%D7%95%20%20(%D7%9E%D7%A9%D7%A4%D7%97%D7%AA%20%D7%A7%D7%A8%D7%A1%D7%95)&email=tamartal@gmail.com',
    journeyAction: 'unknown', customerFacing: true,
  },
  {
    id: 'filloutD', provider: 'fillout', filloutId: 'vYY9mWeMQsus',
    url: UNASSIGNED_LINKS.filloutUnknown,
    journeyAction: 'unknown', customerFacing: true,
  },
  {
    id: 'ziteA', provider: 'zite', url: UNASSIGNED_LINKS.zitePage,
    journeyAction: 'unknown', customerFacing: 'unknown',
  },
  {
    id: 'makeB', provider: 'make', url: AUTOMATION_WEBHOOKS.makeB,
    journeyAction: 'unknown', customerFacing: false,
  },
];

// ============================================================
// JOURNEY_ACTIONS — הרישום המרכזי של פעולות הלקוח במסע.
// מקור אמת אחד: שלב → 0 / 1 / כמה פעולות, ולכל פעולה יעד משלה.
// אין לוגיקת פעולה מפוזרת בקומפוננטות ואין יעדים מקודדים ב-JSX.
//
// בפרודקשן הרשימה תגיע מהבקאנד (Monday) באותו מבנה בדיוק:
//   { title, cta, openMode, url } — הפרונט לא צריך לדעת איך נבנה ה-URL.
// ============================================================
export const JOURNEY_ACTIONS: JourneyAction[] = [
  {
    id: 'service-payment', stageId: 'service-payment',
    icon: '💳', title: 'תשלום דמי השירות', cta: 'לתשלום',
    openMode: null, url: null,
  },
  {
    id: 'meeting', stageId: 'meeting',
    icon: '📅', title: 'פרטי הפגישה', cta: 'לצפייה', ctaFull: 'לפרטי הפגישה',
    // הפגישה מתקיימת מחוץ למר יפן; הכתובת עצמה טרם נמסרה
    openMode: 'external', url: null,
  },
  {
    id: 'changes-form', stageId: 'changes-form',
    icon: '✏️', title: 'מילוי טופס שינויים', cta: 'למילוי', ctaFull: 'למילוי הטופס',
    openMode: null, url: null,
  },
  {
    id: 'hotels', stageId: 'selections',
    icon: '🏨', title: 'בחירת מלונות', cta: 'לבחירה', ctaFull: 'לבחירת המלונות',
    openMode: 'fillout', url: DEMO_ACTION_LINKS.hotelSelection,
    filloutFormId: 'ohzZe7sCBrus',
  },
  {
    id: 'attractions', stageId: 'selections',
    icon: '🎟️', title: 'תשלום אטרקציות', cta: 'לתשלום',
    openMode: null, url: null,
    requiresPaymentWindow: true,
  },
  {
    id: 'feedback', stageId: 'feedback',
    icon: '💬', title: 'משוב', cta: 'למילוי', ctaFull: 'למילוי המשוב',
    openMode: null, url: null,
  },
];

const ACTIONS_BY_ID = new Map(JOURNEY_ACTIONS.map((a) => [a.id, a]));

export function actionById(id: string): JourneyAction | undefined {
  return ACTIONS_BY_ID.get(id);
}

// פעולות השלב. paymentWindowOpen מגיע ממצב עסקי (Monday / תאריכי הטיול),
// לא מחישוב תאריך בפרונט. כשהחלון סגור הפעולה פשוט אינה קיימת.
export function stageActions(stageId: string, paymentWindowOpen = true): JourneyAction[] {
  return JOURNEY_ACTIONS.filter(
    (a) => a.stageId === stageId && (!a.requiresPaymentWindow || paymentWindowOpen),
  );
}

// תשלום אטרקציות — פעולה מסומלצת בדמו; מנגנון התשלום בפועל טרם אושר
// והחיבור אליו יוגדר בהתאם לתהליך הקיים של מר יפן.
export const ATTRACTIONS_PAYMENT = {
  title: 'תשלום אטרקציות',
  description: 'השלמת התשלום עבור האטרקציות בטיול שלכם.',
  note: 'אופן החיבור לתשלום יוגדר בהתאם לתהליך הקיים של מר יפן.',
  cta: 'מעבר לתשלום',
};

// תרחיש הצגה — רצף מצבי מוצר אמיתיים (לקוח מתקדם), מהקונפיג בלבד.
// התרחיש מזיז את currentStage (המצב בפועל) — לא את ה-preview.
export const SCENARIO: { stageId: string; subId: string }[] = [
  { stageId: 'plan-building', subId: 'working' },
  { stageId: 'service-payment', subId: 'due' },
  { stageId: 'meeting', subId: 'scheduled' },
  { stageId: 'changes-form', subId: 'open' },
  { stageId: 'changes-form', subId: 'submitted' },
  { stageId: 'changes-processing', subId: 'working' },
  { stageId: 'selections', subId: 'open' },
  { stageId: 'hotels-booking', subId: 'working' },
  { stageId: 'attractions-booking', subId: 'working' },
  { stageId: 'attractions-booking', subId: 'all-ready' },
  { stageId: 'in-japan', subId: 'traveling' },
  { stageId: 'feedback', subId: 'open' },
  { stageId: 'feedback', subId: 'submitted' },
];

export function relevantStages(pkg: PackageId): Stage[] {
  return STAGES.filter((s) => s.packages.includes(pkg));
}

export function relevantSubStates(stage: Stage, pkg: PackageId): SubState[] {
  return stage.subStates.filter((ss) => !ss.packages || ss.packages.includes(pkg));
}
