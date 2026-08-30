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
  | 'form'
  | 'payment'
  | 'selections-form'     // טופס בחירת המלונות (בחירה בפרוטוטייפ)
  | 'selections-review'   // סיכום בחירת המלונות לפני שליחה
  | 'selections-view'     // צפייה בבחירה שנשלחה (קריאה בלבד)
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

export interface StageAction {
  id: string;
  icon: string;
  title: string;                // שם הפעולה — מוצג כשיש יותר מפעולה אחת
  cta: string;                  // תווית קצרה לשורת פעולה ("לבחירה")
  ctaFull?: string;             // תווית ל-CTA ראשי (פעולה בודדת) — ברירת מחדל: cta
  opens: SheetKind;             // מה ה-CTA פותח כשאין url
  url?: string;                 // כתובת פעולה אטומה — נפתחת מוטמעת בתוך האפליקציה
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
  actions?: StageAction[];      // פעולות הלקוח בשלב (0 / 1 / רבות)
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
        actions: [
          { id: 'service-payment', icon: '💳', title: 'תשלום דמי השירות', cta: 'לתשלום', opens: 'payment' },
        ],
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
        actions: [
          { id: 'meeting', icon: '📅', title: 'פרטי הפגישה', cta: 'לצפייה', ctaFull: 'לפרטי הפגישה', opens: 'meeting' },
        ],
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
        actions: [
          { id: 'changes-form', icon: '✏️', title: 'טופס שינויים', cta: 'למילוי', ctaFull: 'למילוי הטופס', opens: 'form' },
        ],
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
    // שלב אדפטיבי לפי זמן-לטיול. הפעולות עצמן מוגדרות ב-SELECTIONS_ACTIONS
    // (למטה) ונגזרות דרך activeSelectionActions() לפי חלון תשלום האטרקציות —
    // אין תנאים מקודדים ב-JSX. כשהחלון פתוח App מרחיב את שם השלב.
    id: 'selections',
    name: 'בחירת מלונות',
    icon: '🏨',
    packages: ALL,
    historyAsset: 'הבחירות שלך',
    historyOpens: 'selections-view',
    historyText: 'הפעולות הושלמו והועברו לטיפול.',
    subStates: [
      // הפעולות הפעילות והשלמתן נגזרות ב-App מ-activeSelectionActions()
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
        actions: [
          { id: 'feedback', icon: '💬', title: 'משוב על הטיול', cta: 'למילוי', ctaFull: 'למילוי המשוב', opens: 'feedback' },
        ],
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

// בחירת המלונות של הלקוח — נתוני דמו ריאליסטיים (mock; בעתיד מ-Monday)
export const SELECTIONS_MOCK = {
  hotels: [
    { city: 'Tokyo', name: 'Hotel Gracery Shinjuku' },
    { city: 'Kyoto', name: 'Cross Hotel Kyoto' },
    { city: 'Osaka', name: 'Hotel The Flag' },
  ],
};

// ===== קישורי פעולה (נתוני דמו) =====
// הקישור המלא כפי שהוא קיים ב-Monday, כמות שהוא — כתובת פעולה *אטומה*.
// ה-UI אינו מפרש אותה: לא מפרק פרמטרים, לא מחלץ מזהים, לא בונה כתובת
// ולא מנהל מזהה לקוח. בפרודקשן הקישור יגיע מהבקאנד לפי הלקוח המחובר.
export const DEMO_ACTION_LINKS = {
  hotelSelection:
    'https://mrjapan.fillout.com/t/ohzZe7sCBrus?clientName=%D7%A9%D7%92%D7%99%D7%AA%20%D7%A7%D7%99%D7%A0%D7%9F-%D7%92%D7%A8%D7%95%D7%A1%D7%A4%D7%9C%D7%93%20%20(%D7%94%D7%92%D7%A8%D7%95%D7%A1%D7%A4%D7%9C%D7%93%D7%99%D7%9D)&clientAirtableID=recPNgSfcIpGwEROL&plan=Advanced&dest1=%D7%98%D7%95%D7%A7%D7%99%D7%95&date1=08/12/2026%20-%2011/12/2026&dest2=%D7%94%D7%90%D7%A7%D7%95%D7%A0%D7%94&date2=11/12/2026%20-%2012/12/2026&dest3=%D7%A7%D7%99%D7%95%D7%98%D7%95&date3=12/12/2026%20-%2015/12/2026&dest4=%D7%90%D7%95%D7%A1%D7%A7%D7%94&date4=15/12/2026%20-%2017/12/2026&dest5=%D7%98%D7%95%D7%A7%D7%99%D7%95&date5=17/12/2026%20-%2020/12/2026&dest1days=3&dest2days=1&dest3days=3&dest4days=2&dest5days=3',
} as const;

// ===== הפעולות של השלב האדפטיבי — מקור האמת =====
// hotels פעיל תמיד; attractions דורש שחלון תשלום האטרקציות יהיה פתוח.
// מקור החלון הוא מצב עסקי (Monday / תאריכי הטיול), לא חישוב תאריך בפרונט —
// בפרוטוטייפ הוא מגיע מדגל התרחיש. כשהחלון סגור הפעולה פשוט אינה קיימת:
// אין שורה מושבתת, אין "בקרוב", ואין מציין מקום.
export const SELECTIONS_ACTIONS: (StageAction & { requiresPaymentWindow?: boolean })[] = [
  {
    id: 'hotels', icon: '🏨', title: 'בחירת מלונות',
    cta: 'לבחירה', ctaFull: 'לבחירת המלונות',
    opens: 'selections-form', url: DEMO_ACTION_LINKS.hotelSelection,
  },
  {
    id: 'attractions', icon: '🎟️', title: 'תשלום אטרקציות',
    cta: 'לתשלום', opens: 'attractions-pay', requiresPaymentWindow: true,
  },
];

// הפעולות הנדרשות כרגע. הרשימה נגזרת מחדש בכל רינדור — כך שפעולה
// שנפתחת מאוחר יותר (בכניסה לחלון 3 החודשים) מחזירה את השלב למצב פעיל
// גם אם הפעולה הראשונה כבר הושלמה.
export function activeSelectionActions(paymentWindowOpen: boolean): StageAction[] {
  return SELECTIONS_ACTIONS.filter((a) => !a.requiresPaymentWindow || paymentWindowOpen);
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
