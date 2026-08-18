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

export interface SubState {
  id: string;
  demoLabel: string;            // ל-DEMO בלבד
  ownership: Ownership;         // מי בכדור בתת-מצב הזה
  pill?: string;                // דריסת קופי הבעלות — קופי הקשרי לשלב
  jpLine?: string;              // רגע יפני — רק בשלב "ביפן" (ようこそ)
  message?: string;             // בשפת לקוח — קצר
  dateLine?: string;            // שורת מועד שמוצגת בבית (📅)
  detail?: string;
  cta?: string;                 // קיים רק כשיש פעולה אמיתית
  ctaOpens?: SheetKind;         // מה ה-CTA פותח
  confirms?: string[];          // אישורי "התקבל ✓" (ירוק — רק כאן)
  summary?: string[];           // סיכום קומפקטי אחרי שליחה (🏨 3 מלונות...)
  secondary?: string;           // פעולה נוספת — טקסט משני
  viewLabel?: string;           // כפתור משני לצפייה בנכס שנשלח
  viewOpens?: SheetKind;        // מה כפתור הצפייה פותח (קריאה בלבד)
  nextLabel?: string;           // דריסת שורת "הבא:" (למשל "אחר כך: ...")
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
export const OWNERSHIP_PILL: Record<Ownership, string> = {
  client: 'הכדור אצלכם',
  team: 'צוות מר יפן מטפל בזה',
  both: 'נפגשים עם מר יפן 🤝',
  none: 'אין צורך לעשות דבר כרגע',
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
        message: 'אנחנו בונים את התוכנית שלכם.',
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
        cta: 'לתשלום',
        ctaOpens: 'payment',
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
        cta: 'פרטי הפגישה',
        ctaOpens: 'meeting',
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
        cta: 'מילוי טופס השינויים',
        ctaOpens: 'form',
        nextLabel: 'צוות מר יפן מעדכן את התוכנית',
      },
      {
        id: 'submitted',
        demoLabel: 'נשלח (אישור זמני)',
        ownership: 'none',
        confirms: ['קיבלנו את השינויים שלכם'],
        autoAdvance: true,
        nextLabel: 'צוות מר יפן יעדכן את התוכנית',
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
        detail: 'אין צורך לעשות דבר כרגע.',
      },
    ],
  },
  {
    // שלב אדפטיבי לפי זמן-לטיול: הלקוח בוחר מלונות; עבור אטרקציות הפעולה
    // היא תשלום בלבד (אין "בחירת אטרקציות"). כשחלון התשלום פתוח (פחות
    // מ-3 חודשים) App מרחיב את השם ל"בחירת מלונות ותשלום אטרקציות"
    // ובונה את תוכן השלב (משימה אחת/שתיים + השלמות) לפי התרחיש.
    id: 'selections',
    name: 'בחירת מלונות',
    icon: '🏨',
    packages: ALL,
    historyAsset: 'הבחירות שלך',
    historyOpens: 'selections-view',
    historyText: 'הפעולות הושלמו והועברו לטיפול.',
    subStates: [
      // התוכן בפועל (משימה אחת/שתיים, השלמות) נגזר מהתרחיש ב-App
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
        pill: 'צוות מר יפן מטפל בהזמנות',
        message: 'אנחנו מטפלים בהזמנת המלונות שבחרתם.',
        detail: 'אין צורך לעשות דבר כרגע.',
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
        detail: 'אין צורך לעשות דבר כרגע.',
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
        cta: 'למילוי משוב',
        ctaOpens: 'feedback',
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
