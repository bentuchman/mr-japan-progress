// ============================================================
// שלב 2 — פתרון פעולה סמנטית לנתוני הלקוח הנוכחי.
//
// רכיבי ה-UI אינם מכירים עמודות Monday. פעולה במסע נושאת מפתח סמנטי
// (dataKey), והמודול הזה — בלבד — יודע לאיזה שדה ב-CustomerJourneyData
// הוא מתורגם:
//
//   פעולה במסע → dataKey → CustomerJourneyData → הכתובת של הלקוח הזה
//
// לקוח X מקבל אך ורק את הערכים של לקוח X. אין כתובת גנרית מחליפה
// בשקט כתובת לקוח חסרה: חסר = כישלון בטוח (מסך "לא זמין" הקיים).
// ============================================================

import type { CustomerJourneyData } from './monday/customerJourneyData.ts';
import type { ActionStatus, PackageId } from './journeyConfig';

export type CustomerActionKey =
  | 'servicePayment'
  | 'meeting'
  | 'meetingSchedule'
  | 'meetingReschedule'
  | 'planChanges'
  | 'hotelSelection'
  | 'attractionsPayment'
  | 'feedback';

export interface ResolvedActionUrl {
  url: string | null;
  // הסיבה כשאין כתובת — לדוחות ולמסך ה-DEV, לא ללוגיקה עסקית
  reason?: 'missing' | 'ambiguous' | 'blocked-host' | 'unverified-mapping';
}

// webhooks של אוטומציה אינם עמודים ללקוח. גם אם עמודת קישור ב-Monday
// מחזיקה כתובת כזו — לא פותחים, לא מטמיעים: כישלון בטוח.
function blockedAutomationHost(url: string): boolean {
  try {
    return /(^|\.)make\.com$/i.test(new URL(url).hostname);
  } catch {
    return true;   // לא-URL אינו יעד ניווט
  }
}

function isFilloutHost(url: string): boolean {
  try {
    return /(^|\.)fillout\.com$/i.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

const safe = (url: string | null): ResolvedActionUrl =>
  url === null
    ? { url: null, reason: 'missing' }
    : blockedAutomationHost(url)
      ? { url: null, reason: 'blocked-host' }
      : { url };

export function resolveCustomerAction(
  key: CustomerActionKey,
  d: CustomerJourneyData,
): ResolvedActionUrl {
  switch (key) {
    case 'servicePayment':
      return safe(d.payments.service.paymentUrl);
    case 'meeting':
      return safe(d.meeting.meetingUrl);
    case 'meetingSchedule':
      // טרם אומת איזה שדה Monday הוא כתובת *קביעת* הפגישה הראשונית.
      // לא ממציאים ולא משתמשים ב-Meeting link כתחליף — מיפוי פתוח.
      return { url: null, reason: 'unverified-mapping' };
    case 'meetingReschedule': {
      // חוויית השינוי/ביטול המאומתת ללקוח היא טופס Fillout. לכן רק
      // מועמד שמתארח על fillout.com כשר; כל דבר אחר — ובמיוחד webhook
      // של Make, שהוא תשתית אוטומציה — לעולם אינו נפתח ואינו תחליף.
      const candidates = [d.meeting.rescheduleUrl, d.meeting.rescheduleUrlMaster]
        .filter((u): u is string => u !== null && isFilloutHost(u));
      if (candidates.length === 0) return { url: null, reason: 'missing' };
      if (candidates.length === 2 && candidates[0] !== candidates[1]) {
        return { url: null, reason: 'ambiguous' };
      }
      return { url: candidates[0] };
    }
    case 'planChanges':
      return safe(d.forms.planChangesUrl);
    case 'hotelSelection':
      return safe(d.forms.hotelSelectionUrl);
    case 'attractionsPayment':
      return safe(d.payments.attractions.paymentUrl);
    case 'feedback':
      return safe(d.forms.feedbackUrl);
  }
}

// ===== שלב 5 — מחזור טופס השינויים (אישור עסקי של מור) =====
// מקור אמת יחיד: עמודת Plan Approval (color_mkym5k62). שתי תוויות
// מאושרות בלבד:
//   'Changes form submitted' → הלקוח שלח ומור מטפלת — שלב 5 פעיל
//   'Approved'               → הטיפול הסתיים — שלב 5 הושלם, ממשיכים ל-6
// כל ערך אחר (או ריק) אינו מפורש: 'unknown', בלי ניחוש ובלי קידום.
// בכוונה לא Internal Status / Close date / Automations / Manual trigger.
export type PlanChangesPhase = 'inProgress' | 'approved' | 'unknown';

export function planChangesPhase(d: CustomerJourneyData | null): PlanChangesPhase {
  const label = d?.planApprovalStatus?.trim().toLowerCase() ?? null;
  if (label === 'changes form submitted') return 'inProgress';
  if (label === 'approved') return 'approved';
  return 'unknown';
}

// ===== אותות תפעוליים — פרשנים טהורים (שלב 1 של המסע בזמן-ריצה) =====
// מתרגמים אות Monday גולמי אחד למצב עסקי מוגדר. אינם קובעים עמדת מסע —
// מנוע ה-JourneyRuntimeState העתידי יצרוך אותם. העיקרון האחיד: ערך
// חסר/לא-מוכר → 'unknown', לעולם לא מסקנה עסקית.

// checkbox המלונות: הושלם רק כשהצוות סימן במפורש. false מפורש ≠ חסר.
export type HotelsReservationPhase = 'completed' | 'incomplete' | 'unknown';

export function hotelsReservationPhase(d: CustomerJourneyData | null): HotelsReservationPhase {
  const booked = d?.operations?.hotelsBooked ?? null;
  if (booked === true) return 'completed';
  if (booked === false) return 'incomplete';
  return 'unknown';
}

// Internal Status: התוויות המאומתות בלבד + 'other' לכל תווית קיימת אחרת
// (מצב תפעולי מוכר-כקיים אך לא ממופה) + 'unknown' לחסר. השוואה מדויקת
// תלוית-רישיות: מקצצים רק רווחי-שוליים (היגיינת תעבורה); "archive" או
// "ARCHIVE" אינם התווית המאומתת "Archive" — תווית ששונתה ב-Monday לעולם
// אינה מתפרשת בשקט כמצב עסקי מאומת.
// אזור פגישה↔שינויים (אימות פרודקשן): 'Waiting for meeting' = הלקוח
// באזור הפגישה; 'Changes window open' = חלון טופס השינויים שאחריה.
// אזור מלונות (אימות פרודקשן, חבילת Advanced): 'Hotels catalog' =
// הלקוח בוחר; 'Hotels Reservations' = הבחירה התקבלה והצוות מזמין
// (checkbox המלונות עדיין false בשלב הזה — הוא אות *השלמה* מאוחר).
export type InternalStatusPhase =
  | 'waitingForMeeting'
  | 'changesWindowOpen'
  | 'hotelsCatalog'
  | 'hotelsReservations'
  | 'abroad'
  | 'archive'
  | 'cancelled'
  | 'other'
  | 'unknown';

export function internalStatusPhase(d: CustomerJourneyData | null): InternalStatusPhase {
  const label = d?.operations?.internalStatus?.trim() ?? null;
  if (label === null || label === '') return 'unknown';
  if (label === 'Waiting for meeting') return 'waitingForMeeting';
  if (label === 'Changes window open') return 'changesWindowOpen';
  if (label === 'Hotels catalog') return 'hotelsCatalog';
  if (label === 'Hotels Reservations') return 'hotelsReservations';
  if (label === 'Archive') return 'archive';
  if (label === 'Cancelled') return 'cancelled';
  if (label === 'Abroad') return 'abroad';
  return 'other';
}

// Attractions Reservations: ארבע התוויות המאומתות מהגדרת העמודה החיה —
// 'Yet to start' / 'Paid' / 'In Progress' / 'Completed'. אותו עיקרון
// בדיוק כמו internalStatusPhase: השוואה מדויקת תלוית-רישיות (קיצוץ
// שוליים בלבד); תווית אחרת → 'other', חסר → 'unknown'.
// חשוב: 'paid' הוא ייצוג מצב בלבד — *אין* לו מעבר מסע מאומת. המשמעות
// העסקית של Paid בעמודה הזו (לעומת תשלום האטרקציות בלוח התשלומים)
// טרם אומתה, והמנוע אינו מקדם שלב על סמכה.
export type AttractionsReservationsPhase =
  | 'notStarted' | 'paid' | 'inProgress' | 'completed' | 'other' | 'unknown';

export function attractionsReservationsPhase(
  d: CustomerJourneyData | null,
): AttractionsReservationsPhase {
  const label = d?.operations?.attractionsReservationsStatus?.trim() ?? null;
  if (label === null || label === '') return 'unknown';
  if (label === 'Yet to start') return 'notStarted';
  if (label === 'Paid') return 'paid';
  if (label === 'In Progress') return 'inProgress';
  if (label === 'Completed') return 'completed';
  return 'other';
}

// ===== payment-stage-internal — מקור האמת לתשלומים (color_mm145w28) =====
// רצף מאומת: (ריק) → service-sent → service-paid → advance-sent →
// advance-paid → consolidation-sent → consolidation-done.
// עמודה ריקה אומתה כמצב עסקי: הלקוח טרם הגיע לבקשת תשלום פעילה.
// תווית לא מוכרת → 'unknown' — ואז נסוגים למקור הקודם (לוח התשלומים),
// לא ממציאים. תשלום לעולם אינו נגזר מעמודות טריגר של אוטומציה.
export type PaymentStagePhase =
  | 'notRequested'
  | 'serviceSent'
  | 'servicePaid'
  | 'advanceSent'
  | 'advancePaid'
  | 'consolidationSent'
  | 'consolidationDone'
  | 'unknown';

const PAYMENT_STAGE_LABELS: Record<string, PaymentStagePhase> = {
  'service-sent': 'serviceSent',
  'service-paid': 'servicePaid',
  'advance-sent': 'advanceSent',
  'advance-paid': 'advancePaid',
  'consolidation-sent': 'consolidationSent',
  'consolidation-done': 'consolidationDone',
};

export function paymentStagePhase(d: CustomerJourneyData | null): PaymentStagePhase {
  const label = d?.operations?.paymentStageInternal?.trim() ?? null;
  if (label === null || label === '') return 'notRequested';
  return PAYMENT_STAGE_LABELS[label] ?? 'unknown';
}

// הרצף מסודר: שלב מאוחר מוכיח את המוקדמים ממנו
const SERVICE_PAID_STAGES: ReadonlySet<PaymentStagePhase> =
  new Set(['servicePaid', 'advanceSent', 'advancePaid', 'consolidationSent', 'consolidationDone']);
const ADVANCE_PAID_STAGES: ReadonlySet<PaymentStagePhase> =
  new Set(['advancePaid', 'consolidationSent', 'consolidationDone']);

export const paymentStageServicePaid = (p: PaymentStagePhase): boolean => SERVICE_PAID_STAGES.has(p);
export const paymentStageAdvancePaid = (p: PaymentStagePhase): boolean => ADVANCE_PAID_STAGES.has(p);

// ===== Plan (status8) — מקור החבילה. בדיוק שלוש תוויות ממופות =====
// (לא status1 — הוא Type של הלקוח.) 'סטנדרטי' וכל תווית אחרת → null:
// חבילה לא ידועה אינה מנחשת מסע.
export function packageFromPlan(d: CustomerJourneyData | null): PackageId | null {
  const label = d?.operations?.plan?.trim() ?? null;
  if (label === 'Basic') return 'basic';
  if (label === 'Standard') return 'standard';
  if (label === 'Advanced') return 'advanced';
  return null;
}

// ===== חלון תשלום האטרקציות — חוק 90 הימים =====
// פתוח כשנותרו 90 ימים או פחות עד תחילת הטיול (כולל טיול שכבר התחיל —
// עמדת המסע עצמה אינה נקבעת כאן). 91+ ימים → סגור. תאריך חסר/שבור →
// null: "לא ידוע" לעולם אינו הופך ל"סגור".
//
// השוואת תאריכים-בלבד בלי סחף אזורי-זמן: שני הצדדים מפורקים למרכיבי
// שנה-חודש-יום ליטרליים וממופים ל-Date.UTC באותה חצות-UTC. אף צד אינו
// עובר דרך שעון מקומי או new Date(string), ולכן ההפרש הוא תמיד כפולה
// שלמה של יממה — בלי DST ובלי תלות באזור הזמן של הדפדפן.
const DAY_MS = 86_400_000;

function utcMidnight(isoDate: string | null | undefined): number | null {
  if (typeof isoDate !== 'string') return null;
  const m = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const [, y, mo, day] = m.map(Number);
  if (mo < 1 || mo > 12 || day < 1 || day > 31) return null;
  const t = Date.UTC(y, mo - 1, day);
  // דוחה גלגול תאריכים (למשל 31 בפברואר) — ערך שבור אינו "סגור", הוא לא-ידוע
  return new Date(t).getUTCDate() === day ? t : null;
}

export function paymentWindowOpen(
  todayIsoDate: string,
  tripStartDate: string | null,
): boolean | null {
  const today = utcMidnight(todayIsoDate);
  const start = utcMidnight(tripStartDate);
  if (today === null || start === null) return null;
  const daysUntilStart = Math.round((start - today) / DAY_MS);
  return daysUntilStart <= 90;
}

// האם תאריך (או תאריך-שעה — נלקח רק רכיב התאריך) כבר חלף? השוואת
// תאריכים-בלבד באותו מנגנון חצות-UTC. "היום" אינו "חלף". חסר/שבור →
// null — לא ידוע אינו הופך למסקנה.
export function isoDatePassed(
  todayIsoDate: string,
  isoDate: string | null,
): boolean | null {
  const today = utcMidnight(todayIsoDate);
  const date = utcMidnight(isoDate);
  if (today === null || date === null) return null;
  return date < today;
}

// ===== סטטוס פעולה מנתוני הלקוח =====
// הערך המאומת היחיד כרגע הוא "Paid". כל ערך אחר אינו מפורש —
// הפעולה נשארת פתוחה. null = אין דריסה (המצב הקיים נשמר).
export function isPaid(status: string | null): boolean {
  return status !== null && status.trim().toLowerCase() === 'paid';
}

export function customerActionStatus(
  key: CustomerActionKey | undefined,
  d: CustomerJourneyData | null,
): ActionStatus | null {
  if (!d || !key) return null;
  // מקור האמת: payment-stage-internal. תווית לא מוכרת בלבד נסוגה למקור
  // הקודם (תווית 'Paid' בלוח התשלומים) — בלי לנחש.
  const stage = paymentStagePhase(d);
  if (key === 'servicePayment') {
    if (stage !== 'unknown') return paymentStageServicePaid(stage) ? 'completed' : 'pending';
    return isPaid(d.payments.service.status) ? 'completed' : 'pending';
  }
  if (key === 'attractionsPayment') {
    if (stage !== 'unknown') return paymentStageAdvancePaid(stage) ? 'completed' : 'pending';
    return isPaid(d.payments.attractions.status) ? 'completed' : 'pending';
  }
  return null;
}

// ===== בחירת renderer לכתובת לקוח =====
// טופס Fillout ציבורי מוטמע דרך ההטמעה הרשמית — מזהה הטופס נלקח
// מנתיב הכתובת (מידע טכני של הספק, לא נתון לקוח). כל השאר — iframe
// גנרי בתוך אותו גיליון. אין כאן פירוק פרמטרים ואין קריאת מזהי לקוח.
export function rendererForUrl(url: string): { provider: 'fillout' | 'zite'; filloutFormId?: string } {
  try {
    const u = new URL(url);
    if (/(^|\.)fillout\.com$/i.test(u.hostname)) {
      const m = u.pathname.match(/^\/t\/([A-Za-z0-9]+)/);
      if (m) return { provider: 'fillout', filloutFormId: m[1] };
    }
  } catch {
    /* לא-URL לא מגיע לכאן — resolveCustomerAction חוסם */
  }
  return { provider: 'zite' };
}

// שורת המועד בכרטיס הפגישה — "12/08 · 19:00" מתוך ISO. בלי ניחושי
// אזור זמן: מציגים את הערך כפי שנשמר ב-Monday.
export function meetingDateLine(scheduledAt: string | null): string | undefined {
  if (!scheduledAt) return undefined;
  const m = scheduledAt.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (!m) return undefined;
  const [, , mo, day, hh, mm] = m;
  return hh ? `${day}/${mo} · ${hh}:${mm}` : `${day}/${mo}`;
}
