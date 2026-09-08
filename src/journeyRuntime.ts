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
//   1→2 (מוכנות התוכנית), 3→4 (הפגישה התקיימה), 6→7 (הלקוח שלח
//   בחירת מלונות). המנוע עוצר על העמדה המאוחרת ביותר שיש לה ראיה.
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

  // המלונות הוזמנו והלקוח שילם אטרקציות → הכדור אצל הצוות (הזמנת אטרקציות)
  if (hotels === 'completed' && attractionsPaid) {
    return resolved(pkg, 'attractions-booking', 'working',
      'המלונות הוזמנו ותשלום האטרקציות שולם — הזמנת האטרקציות בטיפול הצוות');
  }

  // המלונות הוזמנו אך תשלום האטרקציות עדיין פתוח
  if (hotels === 'completed') {
    if (windowOpen === true) {
      return resolved(pkg, 'selections', 'open',
        'המלונות הוזמנו; חלון תשלום האטרקציות פתוח והתשלום טרם שולם');
    }
    if (windowOpen === false) {
      return unknown('המלונות הוזמנו וחלון תשלום האטרקציות טרם נפתח — אין שלב מאומת לתקופת ההמתנה');
    }
    return unknown('תאריך תחילת הטיול חסר — לא ניתן לקבוע את חלון תשלום האטרקציות');
  }

  // הצוות סימן במפורש שהמלונות טרם הוזמנו → הלקוח באזור הבחירות.
  // (מעבר 6→7 — "הלקוח שלח בחירה והצוות מזמין" — אין לו אות מאומת,
  // ולכן המנוע נשאר ב-selections עד ש-hotelsBooked הופך true.)
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

  // 3. טרום-הטיול — האות המאוחר המאומת גובר (Plan Approval של מור)
  const plan = planChangesPhase(customer);
  if (plan === 'approved') return deriveSelectionsRegion(customer, today, pkg);
  if (plan === 'inProgress') {
    return resolved(pkg, 'changes-processing', 'working',
      'Plan Approval = Changes form submitted — הצוות מטמיע את השינויים');
  }
  return deriveEarlyRegion(customer, today, pkg);
}
