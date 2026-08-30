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
  openMode: OpenMode;
  // כתובת מלאה ואטומה כפי שהיא מגיעה מ-Monday. null = טרם סופקה כתובת
  // אמיתית לפעולה הזו (לא ממציאים קישורים). ה-UI אינו מפרש אותה.
  url: string | null;
  opens?: SheetKind;            // ל-openMode 'sheet' — איזה מסך פנימי נפתח
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

// ===== קישורי פעולה (נתוני דמו) =====
// הקישור המלא כפי שהוא קיים ב-Monday, כמות שהוא — כתובת פעולה *אטומה*.
// ה-UI אינו מפרש אותה: לא מפרק פרמטרים, לא מחלץ מזהים, לא בונה כתובת
// ולא מנהל מזהה לקוח. בפרודקשן הקישור יגיע מהבקאנד לפי הלקוח המחובר.
export const DEMO_ACTION_LINKS = {
  // ⚠️ שיוך עסקי לאישור: הקישור הזה נמסר עבור פעולת בחירת המלונות.
  // מקורו (עמודת Monday) טרם אומת מולנו — יש לאשר לפני פרודקשן.
  hotelSelection:
    'https://mrjapan.fillout.com/t/ohzZe7sCBrus?clientName=%D7%A9%D7%92%D7%99%D7%AA%20%D7%A7%D7%99%D7%A0%D7%9F-%D7%92%D7%A8%D7%95%D7%A1%D7%A4%D7%9C%D7%93%20%20(%D7%94%D7%92%D7%A8%D7%95%D7%A1%D7%A4%D7%9C%D7%93%D7%99%D7%9D)&clientAirtableID=recPNgSfcIpGwEROL&plan=Advanced&dest1=%D7%98%D7%95%D7%A7%D7%99%D7%95&date1=08/12/2026%20-%2011/12/2026&dest2=%D7%94%D7%90%D7%A7%D7%95%D7%A0%D7%94&date2=11/12/2026%20-%2012/12/2026&dest3=%D7%A7%D7%99%D7%95%D7%98%D7%95&date3=12/12/2026%20-%2015/12/2026&dest4=%D7%90%D7%95%D7%A1%D7%A7%D7%94&date4=15/12/2026%20-%2017/12/2026&dest5=%D7%98%D7%95%D7%A7%D7%99%D7%95&date5=17/12/2026%20-%2020/12/2026&dest1days=3&dest2days=1&dest3days=3&dest4days=2&dest5days=3',
  // קישור אמיתי שנמסר אך *טרם שויך* לפעולה במסע. לא מחברים אותו לשום
  // שלב עד שיימסר לאיזו פעולה (ואיזו עמודת Monday) הוא שייך.
  unassignedZitePage: 'https://wnzocgbazy.zite.so/?id=12683534596',
} as const;

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
    // אין עדיין כתובת תשלום אמיתית. נשאר על מסך המוצר הקיים.
    openMode: 'sheet', opens: 'payment', url: null,
  },
  {
    id: 'meeting', stageId: 'meeting',
    icon: '📅', title: 'פרטי הפגישה', cta: 'לצפייה', ctaFull: 'לפרטי הפגישה',
    // הפגישה עצמה מתקיימת מחוץ למר יפן (Zoom) ולא מוטמעת. כשתסופק
    // כתובת פגישה אמיתית — openMode: 'external' עם ה-url שלה.
    openMode: 'sheet', opens: 'meeting', url: null,
  },
  {
    id: 'changes-form', stageId: 'changes-form',
    icon: '✏️', title: 'טופס שינויים', cta: 'למילוי', ctaFull: 'למילוי הטופס',
    // חסר: קישור טופס בקשות השינויים (Plan changes requests form).
    // במפורש *לא* משתמשים בקישור המלונות ולא בטופס מדומה.
    openMode: 'fillout', url: null,
  },
  {
    id: 'hotels', stageId: 'selections',
    icon: '🏨', title: 'בחירת מלונות', cta: 'לבחירה', ctaFull: 'לבחירת המלונות',
    openMode: 'fillout', url: DEMO_ACTION_LINKS.hotelSelection,
  },
  {
    id: 'attractions', stageId: 'selections',
    icon: '🎟️', title: 'תשלום אטרקציות', cta: 'לתשלום',
    // חסר: קישור התשלום. כתובת נפרדת משלה — לא הקישור של המלונות.
    openMode: 'sheet', opens: 'attractions-pay', url: null,
    requiresPaymentWindow: true,
  },
  {
    id: 'feedback', stageId: 'feedback',
    icon: '💬', title: 'משוב על הטיול', cta: 'למילוי', ctaFull: 'למילוי המשוב',
    // חסר: קישור טופס המשוב (Feedback Form Link).
    openMode: 'sheet', opens: 'feedback', url: null,
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
