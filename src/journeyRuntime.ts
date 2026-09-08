// ============================================================
// שלב 2 (Phase 2) — מנוע מצב המסע בזמן-ריצה.
//
// גזירה טהורה בלבד:
//   CustomerJourneyData + "היום" (+ חבילה) → עמדת הלקוח במסע הקיים
//
// המנוע *אינו* מחובר ל-UI: currentStageId באפליקציה נשאר דמו/מקומי
// עד שלב 3. אין כאן React, רשת, מזהי עמודות Monday או תופעות-לוואי.
//
// עקרון-העל — לעולם לא מנחשים:
//   כל פרשנות עסקית חיה בפרשני שלב 1 (customerActions) בלבד; המנוע רק
//   משלב אותם לפי כללי המסע שאושרו. ראיה חסרה/סותרת/לא-מאומתת →
//   תוצאה מפורשת 'unknown' עם סיבה — לא עמדת מסע מומצאת.
//
// סדר הקדימויות (מהחזק לחלש):
//   1. Cancelled — מצב סופני. לעולם אינו "השלמת מסע", ושום שלב
//      (כולל משוב) אינו גובר עליו.
//   2. תוויות מחזור-החיים המאומתות: Abroad → "ביפן"; Archive → "משוב"
//      (פתוח בלבד — אין למנוע שום אות הגשה מאומת, ולכן 'submitted'
//      נשאר דמו-בלבד).
//   3. שלבי טרום-הטיול, מהאות המאוחר לחלש: Plan Approval (אישור מור)
//      ואז תשלום השירות והפגישה.
//
// מעברים שאין להם אות מאומת אינם ממומשים בכוונה (ראו הדוח):
//   1→2 (מוכנות התוכנית). המנוע עוצר על העמדה המאוחרת ביותר שיש לה
//   ראיה. הגבולות 3↔4 ו-6↔7 נסגרו עם תוויות Internal Status מאומתות:
//   Waiting for meeting / Changes window open / Hotels catalog /
//   Hotels Reservations (האחרונות — Advanced בלבד).
// ============================================================

import type { CustomerJourneyData } from './monday/customerJourneyData.ts';
import type { PackageId } from './journeyConfig.ts';
import { STAGES, relevantSubStates } from './journeyConfig.ts';
import {
  attractionsReservationsPhase,
  hotelsReservationPhase,
  internalStatusPhase,
  isPaid,
  isoDatePassed,
  paymentWindowOpen,
  planChangesPhase,
} from './customerActions.ts';

export type JourneyRuntimeState =
  | {
      kind: 'resolved';
      currentStageId: string;
      currentSubstateId: string;
      reason: string;
    }
  | { kind: 'unknown'; reason: string }
  | { kind: 'terminal'; terminalState: 'cancelled'; reason: string };

const unknown = (reason: string): JourneyRuntimeState => ({ kind: 'unknown', reason });

// כל תוצאה "resolved" מאומתת מול journeyConfig: שלב או תת-מצב שאינם
// קיימים לחבילה הזו לעולם אינם מוחזרים — נקבל 'unknown' מפורש במקום
// עמדה שה-UI לא יודע להציג.
function resolved(
  pkg: PackageId,
  stageId: string,
  substateId: string,
  reason: string,
): JourneyRuntimeState {
  const stage = STAGES.find((s) => s.id === stageId);
  if (!stage || !stage.packages.includes(pkg)) {
    return unknown(`השלב '${stageId}' אינו קיים במסע של חבילת '${pkg}' — אין מיפוי מאומת`);
  }
  if (!relevantSubStates(stage, pkg).some((ss) => ss.id === substateId)) {
    return unknown(`תת-המצב '${substateId}' אינו קיים בשלב '${stageId}' לחבילת '${pkg}'`);
  }
  return { kind: 'resolved', currentStageId: stageId, currentSubstateId: substateId, reason };
}

// ===== אזור שלבים 6–8 — אחרי שמור אישרה את התוכנית =====
function deriveSelectionsRegion(
  d: CustomerJourneyData,
  today: string,
  pkg: PackageId,
): JourneyRuntimeState {
  const hotels = hotelsReservationPhase(d);
  const attrRes = attractionsReservationsPhase(d);
  const attractionsPaid = isPaid(d.payments.attractions.status);
  const windowOpen = paymentWindowOpen(today, d.trip.startDate);

  // הכול הוזמן — "הכול מוכן לטיול". שני האותות נדרשים במפורש.
  if (hotels === 'completed' && attrRes === 'completed') {
    return pkg === 'basic'
      ? resolved(pkg, 'selections', 'all-ready', 'המלונות הוזמנו והאטרקציות הוזמנו (Completed)')
      : resolved(pkg, 'attractions-booking', 'all-ready', 'המלונות הוזמנו והאטרקציות הוזמנו (Completed)');
  }

  // שלב 8 פעיל רק על סמך האות הישיר של עוקב ההזמנות: 'In Progress'.
  // בכוונה *לא* מספיקים: תשלום האטרקציות בלוח התשלומים (ההנחה הקודמת —
  // סומנה כטעונת-אימות), 'Paid' בעוקב ההזמנות (מצב מוכר אך ללא מעבר
  // עסקי מאומת), או 'Yet to start' (הצוות טרם התחיל).
  if (hotels === 'completed' && attrRes === 'inProgress') {
    return resolved(pkg, 'attractions-booking', 'working',
      'המלונות הוזמנו והזמנת האטרקציות בביצוע (In Progress)');
  }

  if (hotels === 'completed') {
    // הלקוח שילם (בלוח התשלומים) או שהעוקב מסמן Paid — אך ההזמנה טרם
    // בביצוע: אין שלב מאומת למצב הזה. עצירה בטוחה עד אישור עסקי.
    if (attractionsPaid || attrRes === 'paid' || attrRes === 'notStarted') {
      return unknown('האטרקציות שולמו אך ההזמנה טרם בביצוע — המעבר לשלב 8 במצב הזה טרם אומת עסקית');
    }
    // תשלום האטרקציות עדיין פתוח — לפי חלון 90 הימים
    if (windowOpen === true) {
      return resolved(pkg, 'selections', 'open',
        'המלונות הוזמנו; חלון תשלום האטרקציות פתוח והתשלום טרם שולם');
    }
    if (windowOpen === false) {
      return unknown('המלונות הוזמנו וחלון תשלום האטרקציות טרם נפתח — אין שלב מאומת לתקופת ההמתנה');
    }
    return unknown('תאריך תחילת הטיול חסר — לא ניתן לקבוע את חלון תשלום האטרקציות');
  }

  // ===== גבול 6↔7 — תוויות אזור המלונות ב-Internal Status =====
  // מגיעים לכאן רק כשהמלונות *לא* הוזמנו (checkbox false/null): checkbox
  // true הוא אות השלמה במורד הזרם וכבר טופל למעלה — תווית ישנה לעולם
  // אינה מחזירה לקוח שהוזמנו לו מלונות אל שלב 7.
  const region = internalStatusPhase(d);
  if (region === 'hotelsReservations') {
    // אומת בפרודקשן לחבילת Advanced בלבד; לחבילות בלי שלב הזמנת
    // מלונות התווית אינה ממופה — עצירה בטוחה, לא המצאת שלב.
    return pkg === 'advanced'
      ? resolved(pkg, 'hotels-booking', 'working',
          'Internal Status = Hotels Reservations — הבחירה התקבלה והצוות מזמין')
      : unknown(`Internal Status = Hotels Reservations אינה ממופה לחבילת '${pkg}' (אין בה שלב הזמנת מלונות)`);
  }
  if (region === 'hotelsCatalog' && pkg === 'advanced') {
    return resolved(pkg, 'selections', 'open', 'Internal Status = Hotels catalog — הלקוח בוחר מלונות');
  }

  // הצוות סימן במפורש שהמלונות טרם הוזמנו → הלקוח באזור הבחירות.
  if (hotels === 'incomplete') {
    return resolved(pkg, 'selections', 'open', 'הצוות סימן שהמלונות טרם הוזמנו — הבחירות פתוחות');
  }

  // checkbox המלונות לא זמין (null). null ≠ "לא הוזמן" — אבל אם תשלום
  // האטרקציות פתוח והחלון פתוח, יש ללקוח פעולה מאומתת פתוחה בכל מקרה.
  if (!attractionsPaid && windowOpen === true) {
    return resolved(pkg, 'selections', 'open',
      'תשלום האטרקציות פתוח בתוך החלון — פעולה מאומתת של הלקוח, גם כשמצב המלונות לא ידוע');
  }
  return unknown('מצב הזמנת המלונות אינו זמין (checkbox חסר) — לא ניתן למקם בין שלבים 6–8');
}

// ===== שלבים 2–4 — לפני שטופס השינויים נקלט =====
function deriveEarlyRegion(
  d: CustomerJourneyData,
  today: string,
  pkg: PackageId,
): JourneyRuntimeState {
  const serviceStatus = d.payments.service.status;
  if (serviceStatus === null) {
    return unknown('סטטוס תשלום השירות חסר וטופס השינויים טרם נקלט — אין ראיה לעמדה');
  }
  if (!isPaid(serviceStatus)) {
    // תקדים מאושר (customerActionStatus): תווית שאינה 'Paid' = התשלום פתוח.
    // ההבחנה 1↔2 (מוכנות התוכנית) חסרת אות — נשארים בשלב התשלום.
    return resolved(pkg, 'service-payment', 'due', 'תשלום השירות טרם שולם');
  }

  const scheduledAt = d.meeting.scheduledAt;
  if (scheduledAt === null) {
    return resolved(pkg, 'meeting', 'upcoming', 'שולם; פגישה טרם נקבעה');
  }
  const passed = isoDatePassed(today, scheduledAt);
  if (passed === false) {
    return resolved(pkg, 'meeting', 'scheduled', 'שולם; הפגישה קבועה להיום או לעתיד');
  }
  if (passed === true) {
    // מעבר 3→4: "הפגישה התקיימה" אינו אות מאומת (מועד שחלף אינו הוכחה),
    // ואין אות ל"טופס פתוח אך טרם נשלח" — לא ממציאים עמדה.
    return unknown('מועד הפגישה חלף אך אין אות מאומת בין שלב הפגישה לטופס השינויים (מעבר 3→4 לא נפתר)');
  }
  return unknown('מועד הפגישה השמור אינו תאריך תקין');
}

// ===== הכניסה הראשית =====
// today: 'YYYY-MM-DD' (הזמן של הקורא — המנוע עצמו אינו קורא שעון).
// pkg: חבילת הלקוח. אין לה מקור Monday מאומת — עד שיהיה, הקורא מספק
// אותה (בדמו זה מתג החבילה); ברירת המחדל 'advanced' = המסע המלא.
export function deriveJourneyRuntimeState(
  customer: CustomerJourneyData,
  today: string,
  pkg: PackageId = 'advanced',
): JourneyRuntimeState {
  // 1. מצב סופני — גובר על הכול, כולל משוב. ביטול ≠ השלמת מסע.
  const lifecycle = internalStatusPhase(customer);
  if (lifecycle === 'cancelled') {
    return {
      kind: 'terminal',
      terminalState: 'cancelled',
      reason: 'Internal Status = Cancelled — מסלול סופני נפרד, לא השלמת מסע',
    };
  }

  // 2. מחזור החיים המאומת של הטיול עצמו
  if (lifecycle === 'abroad') {
    return resolved(pkg, 'in-japan', 'traveling', 'Internal Status = Abroad — הלקוח בטיול');
  }
  if (lifecycle === 'archive') {
    // 'open' בלבד: הוכחת הגשת משוב חיה בלוח ה-Feedbacks (בדיקת EXISTS
    // בצד השער — שלב עתידי). Archive לבדו לעולם אינו "המשוב נשלח".
    return resolved(pkg, 'feedback', 'open', 'Internal Status = Archive — הטיול הסתיים, המשוב פתוח');
  }
  // lifecycle 'other' (תווית תפעולית קיימת אך לא ממופה, למשל Final QA)
  // או 'unknown' (חסר) — אינם קובעים עמדה; ממשיכים לראיות טרום-הטיול.

  // 3. טרום-הטיול — האות המאוחר המאומת גובר (Plan Approval של מור).
  // תווית אזור ב-Internal Status שנשארה מאחור אינה מבטלת הגשה/אישור.
  const plan = planChangesPhase(customer);
  if (plan === 'approved') return deriveSelectionsRegion(customer, today, pkg);
  if (plan === 'inProgress') {
    return resolved(pkg, 'changes-processing', 'working',
      'Plan Approval = Changes form submitted — הצוות מטמיע את השינויים');
  }

  // 3א. גבול שלב 3↔4 — תוויות האזור המאומתות ב-Internal Status.
  // מועד פגישה שחלף לבדו לעולם אינו מפיק שלב 4; רק התווית קובעת.
  if (lifecycle === 'changesWindowOpen') {
    return resolved(pkg, 'changes-form', 'open',
      'Internal Status = Changes window open — חלון טופס השינויים פתוח');
  }
  if (lifecycle === 'waitingForMeeting') {
    const scheduledAt = customer.meeting.scheduledAt;
    if (scheduledAt !== null && isoDatePassed(today, scheduledAt) === false) {
      return resolved(pkg, 'meeting', 'scheduled',
        'Internal Status = Waiting for meeting; פגישה קבועה להיום או לעתיד');
    }
    // אין מועד עתידי תקף (חסר / חלף / שבור) — לפי התווית עדיין באזור
    // הפגישה, כלומר נדרש תיאום: תת-המצב הקיים 'upcoming'.
    return resolved(pkg, 'meeting', 'upcoming',
      'Internal Status = Waiting for meeting; אין מועד פגישה עתידי תקף');
  }

  return deriveEarlyRegion(customer, today, pkg);
}
