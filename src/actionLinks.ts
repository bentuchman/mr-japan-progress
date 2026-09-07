import { JOURNEY_ACTIONS } from './journeyConfig';

// ============================================================
// שכבת אספקת קישורי הפעולה.
//
// היום (פרוטוטייפ): הקישור מגיע מהקונפיג המקומי.
// בהמשך (פרודקשן): אותו חוזה בדיוק, אבל המקור הוא הבקאנד —
//
//   לקוח מחובר
//     → הבקאנד / שכבת האוטומציה
//     → הרשומה הרלוונטית ב-Monday
//     → הקישור המלא לפעולה
//     → הפרונט
//     → EmbeddedActionSheet
//
// הפרונט מקבל כתובת אטומה בלבד. הוא אינו יודע איך היא נבנתה, אינו
// מפרק אותה, ואינו מחזיק שום סוד: טוקנים של Monday/Make חיים בבקאנד
// בלבד ולעולם לא בקוד הלקוח.
//
// כדי לעבור לפרודקשן מחליפים מקור אחד — setActionLinkSource — בלי
// לגעת ב-UI, במסע או במיפוי הפעולות.
// ============================================================

export interface ActionLinkQuery {
  actionId: string;    // מזהה הפעולה במסע (למשל 'hotels')
  clientId: string;    // מזהה הלקוח מהמערכת הפנימית
}

export interface ActionLink {
  url: string | null;          // null = טרם קיים קישור מאומת לפעולה
  filloutFormId?: string;      // נדרש טכנית ל-renderer של Fillout
}

export type ActionLinkSource = (q: ActionLinkQuery) => Promise<ActionLink>;

// ===== נתוני דמו פנימיים =====
// מזהה סינתטי מובהק — *לא* לקוח אמיתי. מזהה הלקוח האמיתי יגיע בפרודקשן
// משכבת ההזדהות, לעולם לא מקבוע בקוד. אינו מוצג בממשק.
export const DEMO_CLIENT = {
  clientId: '000000-demo-client',
} as const;

// מקור הדמו: קורא מהקונפיג המקומי, בלי רשת ובלי הפעלת אוטומציה.
export const demoActionLinkSource: ActionLinkSource = async ({ actionId }) => {
  const a = JOURNEY_ACTIONS.find((x) => x.id === actionId);
  return { url: a?.url ?? null, filloutFormId: a?.filloutFormId };
};

let source: ActionLinkSource = demoActionLinkSource;

// בפרודקשן: setActionLinkSource(q => fetch('/api/action-link', {...}))
// הבקאנד הוא שמדבר עם Monday/Make ומחזיר { url }.
export function setActionLinkSource(next: ActionLinkSource): void {
  source = next;
}

export function resolveActionLink(q: ActionLinkQuery): Promise<ActionLink> {
  return source(q);
}
