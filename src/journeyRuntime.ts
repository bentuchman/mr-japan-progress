// ============================================================
// מנוע מצב המסע בזמן-ריצה — גזירה טהורה בלבד:
//   CustomerJourneyData + "היום" (+ חבילה, + ראיות נלוות) → עמדת הלקוח
//
// המנוע *אינו* מחובר ל-UI: currentStageId באפליקציה נשאר דמו/מקומי עד
// חיווט הזהות (שלב 3). אין כאן React, רשת, מזהי עמודות Monday או
// תופעות-לוואי. לחיצה על תחנה במסע ממשיכה לגעת אך ורק ב-previewStageId.
//
// עקרון-העל — לעולם לא מנחשים: כל פרשנות עסקית חיה בפרשני
// customerActions בלבד; המנוע רק משלב אותם לפי הכללים שאומתו מול
// פרודקשן. ראיה חסרה/סותרת/לא-מאומתת → 'unknown' מפורש עם סיבה.
//
// מקורות האמת המאומתים:
//   תשלומים  — payment-stage-internal (color_mm145w28). לעולם לא עמודות
//              טריגר של אוטומציה; לוח התשלומים נשאר נסיגה בלבד.
//   גבולות   — תוויות Internal Status: Waiting for meeting /
//              Changes window open / Hotels catalog / Hotels Reservations
//   מחזור חיים — Abroad / Archive / Cancelled (סופני)
//   שלב 5    — Plan Approval של מור (planChangesPhase)
//   מלונות   — checkbox המלונות הוא אות *השלמה* בלבד, לא הפעלת שלב 7
//   אטרקציות — advance-paid (תשלום) + Attractions Reservations (עבודה):
//              שני מצבים שונים; 'Yet to start' אינו "לא שולם"
//   משוב     — הגשה מוכחת רק ע"י relation בלוח ה-Feedbacks (extras)
//   חבילה    — Plan (status8) דרך packageFromPlan
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
  packageFromPlan,
  paymentStageAdvancePaid,
  paymentStagePhase,
  paymentStageServicePaid,
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

// ראיות שנאספות מחוץ לאייטם הלקוח (שאילתה נפרדת, לפי דרישה):
//   feedbackSubmitted — קיום אייטם משוב מקושר (getFeedbackSubmitted).
//   undefined/null = לא נבדק / לא ידוע — לעולם אינו נחשב "הוגש".
export interface JourneyRuntimeExtras {
  feedbackSubmitted?: boolean | null;
}

const unknown = (reason: string): JourneyRuntimeState => ({ kind: 'unknown', reason });

// כל תוצאה "resolved" מאומתת מול journeyConfig: שלב או תת-מצב שאינם
// קיימים לחבילה הזו לעולם אינם מוחזרים.
// pkg === null — החבילה אינה ידועה (Plan לא ממופה ואין דריסה): מותר
// לפתור אך ורק שלבים/תתי-מצב אוניברסליים (קיימים בכל שלוש החבילות).
// חבילה לא ידועה לעולם אינה הופכת בשקט ל-Advanced.
function resolved(
  pkg: PackageId | null,
  stageId: string,
  substateId: string,
  reason: string,
): JourneyRuntimeState {
  const stage = STAGES.find((s) => s.id === stageId);
  if (!stage) return unknown(`השלב '${stageId}' אינו קיים במסע`);
  if (pkg === null) {
    const universalStage = stage.packages.length === 3;
    const sub = stage.subStates.find((ss) => ss.id === substateId);
    if (!universalStage || !sub || sub.packages) {
      return unknown(`השלב '${stageId}/${substateId}' תלוי-חבילה, וחבילת הלקוח אינה ידועה (Plan לא ממופה)`);
    }
    return { kind: 'resolved', currentStageId: stageId, currentSubstateId: substateId, reason };
  }
  if (!stage.packages.includes(pkg)) {
    return unknown(`השלב '${stageId}' אינו קיים במסע של חבילת '${pkg}' — אין מיפוי מאומת`);
  }
  if (!relevantSubStates(stage, pkg).some((ss) => ss.id === substateId)) {
    return unknown(`תת-המצב '${substateId}' אינו קיים בשלב '${stageId}' לחבילת '${pkg}'`);
  }
  return { kind: 'resolved', currentStageId: stageId, currentSubstateId: substateId, reason };
}

// ===== שלב 3 — ישות הפגישה (תת-מצב לפי מועד) =====
// regionConfirmed: האם תווית Internal Status מאומתת ('Waiting for
// meeting') מעגנת את אזור הפגישה. בלעדיה, מועד שחלף אינו הוכחה שהפגישה
// התקיימה *או* שלא — מעבר 3↔4 נשאר לא-ידוע (רק התווית סוגרת אותו).
function deriveMeetingStage(
  d: CustomerJourneyData,
  today: string,
  pkg: PackageId | null,
  reasonPrefix: string,
  regionConfirmed: boolean,
): JourneyRuntimeState {
  const scheduledAt = d.meeting.scheduledAt;
  if (scheduledAt !== null && isoDatePassed(today, scheduledAt) === false) {
    return resolved(pkg, 'meeting', 'scheduled', `${reasonPrefix}; הפגישה קבועה להיום או לעתיד`);
  }
  if (scheduledAt === null) {
    return resolved(pkg, 'meeting', 'upcoming', `${reasonPrefix}; פגישה טרם נקבעה`);
  }
  if (regionConfirmed) {
    // התווית מעגנת את האזור; המועד אינו תקף → נדרש תיאום מחדש
    return resolved(pkg, 'meeting', 'upcoming', `${reasonPrefix}; אין מועד פגישה עתידי תקף`);
  }
  return unknown('מועד הפגישה חלף ואין תווית Internal Status שמכריעה בין שלב הפגישה לטופס השינויים');
}

// ===== אזור שלבים 6–8 — אחרי שמור אישרה את התוכנית =====
function deriveSelectionsRegion(
  d: CustomerJourneyData,
  today: string,
  pkg: PackageId | null,
): JourneyRuntimeState {
  const hotels = hotelsReservationPhase(d);
  const attrRes = attractionsReservationsPhase(d);
  const pay = paymentStagePhase(d);
  const windowOpen = paymentWindowOpen(today, d.trip.startDate);

  if (hotels === 'completed') {
    // ההזמנות הושלמו — "הכול מוכן לטיול"
    if (attrRes === 'completed') {
      return pkg === 'basic'
        ? resolved(pkg, 'selections', 'all-ready', 'המלונות הוזמנו והאטרקציות הוזמנו (Completed)')
        : resolved(pkg, 'attractions-booking', 'all-ready', 'המלונות הוזמנו והאטרקציות הוזמנו (Completed)');
    }

    // advance-paid (מקור האמת לתשלום) + מצב עבודת ההזמנות המאומת:
    //   Yet to start — שולם, ההזמנה בתור הצוות; In Progress — בביצוע.
    // בשני המקרים הכדור אצל צוות מר יפן → שלב 8.
    if (paymentStageAdvancePaid(pay) && (attrRes === 'inProgress' || attrRes === 'notStarted')) {
      return resolved(pkg, 'attractions-booking', 'working',
        attrRes === 'inProgress'
          ? 'advance-paid והזמנת האטרקציות בביצוע (In Progress)'
          : 'advance-paid — ההזמנה בתור הצוות (Yet to start)');
    }
    if (paymentStageAdvancePaid(pay)) {
      return unknown('advance-paid אך מצב עבודת ההזמנות אינו זמין/מוכר — אין שלב מאומת');
    }

    // advance-sent: Monday עצמו מסמן שבקשת תשלום האטרקציות פעילה —
    // עדות עסקית ישירה, חזקה מחישוב חלון בפרונט.
    if (pay === 'advanceSent') {
      return resolved(pkg, 'selections', 'open', 'advance-sent — תשלום האטרקציות נדרש מהלקוח');
    }

    // אין מידע תשלום מהעמודה הפנימית — נסיגה לכללים הקודמים:
    // תשלום לפי לוח התשלומים + חלון 90 הימים. In Progress לבדו *אינו*
    // מפעיל שלב 8 (נדחה בדגימת פרודקשן — העוקב עלול להיות ישן).
    if (isPaid(d.payments.attractions.status) || attrRes === 'paid'
        || attrRes === 'notStarted' || attrRes === 'inProgress') {
      return unknown('אין payment-stage-internal מוכר, והאותות הישנים אינם מספיקים לקביעת שלב 8');
    }
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
  // מגיעים לכאן רק כשהמלונות לא הוזמנו (checkbox false/null): checkbox
  // true הוא אות השלמה במורד הזרם — תווית ישנה לעולם אינה מחזירה לקוח
  // שהוזמנו לו מלונות אל שלב 7.
  const region = internalStatusPhase(d);
  if (region === 'hotelsReservations') {
    return pkg === 'advanced'
      ? resolved(pkg, 'hotels-booking', 'working',
          'Internal Status = Hotels Reservations — הבחירה התקבלה והצוות מזמין')
      : unknown(pkg === null
          ? 'Internal Status = Hotels Reservations אך חבילת הלקוח אינה ידועה — שלב הזמנת המלונות תלוי-חבילה'
          : `Internal Status = Hotels Reservations אינה ממופה לחבילת '${pkg}' (אין בה שלב הזמנת מלונות)`);
  }
  if (region === 'hotelsCatalog' && pkg === 'advanced') {
    return resolved(pkg, 'selections', 'open', 'Internal Status = Hotels catalog — הלקוח בוחר מלונות');
  }

  // הצוות סימן במפורש שהמלונות טרם הוזמנו → הלקוח באזור הבחירות
  if (hotels === 'incomplete') {
    return resolved(pkg, 'selections', 'open', 'הצוות סימן שהמלונות טרם הוזמנו — הבחירות פתוחות');
  }

  // checkbox המלונות לא זמין (null ≠ false). אם יש ללקוח פעולה מאומתת
  // פתוחה — advance-sent, או תשלום פתוח בתוך החלון — הבחירות פתוחות.
  if (pay === 'advanceSent') {
    return resolved(pkg, 'selections', 'open', 'advance-sent — תשלום האטרקציות נדרש מהלקוח');
  }
  if (!paymentStageAdvancePaid(pay) && pay !== 'unknown'
      && !isPaid(d.payments.attractions.status) && windowOpen === true) {
    return resolved(pkg, 'selections', 'open',
      'תשלום האטרקציות פתוח בתוך החלון — פעולה מאומתת של הלקוח, גם כשמצב המלונות לא ידוע');
  }
  return unknown('מצב הזמנת המלונות אינו זמין (checkbox חסר) — לא ניתן למקם בין שלבים 6–8');
}

// ===== שלבים 1–4 — לפני שטופס השינויים נקלט =====
function deriveEarlyRegion(
  d: CustomerJourneyData,
  today: string,
  pkg: PackageId | null,
): JourneyRuntimeState {
  const pay = paymentStagePhase(d);

  // מקור האמת: payment-stage-internal
  if (pay === 'serviceSent') {
    return resolved(pkg, 'service-payment', 'due', 'payment-stage-internal = service-sent — תשלום השירות נדרש');
  }
  if (paymentStageServicePaid(pay)) {
    return deriveMeetingStage(d, today, pkg, 'תשלום השירות הושלם (payment-stage-internal)', false);
  }
  if (pay === 'notRequested') {
    // העמודה ריקה = טרם נשלחה בקשת תשלום. אבל ראיה במורד הזרם גוברת:
    // לקוח ותיק שלוח התשלומים שלו כבר מסמן Paid אינו מוחזר לשלב 1.
    if (isPaid(d.payments.service.status)) {
      return deriveMeetingStage(d, today, pkg, 'תשלום השירות הושלם (לוח התשלומים)', false);
    }
    return resolved(pkg, 'plan-building', 'working',
      'payment-stage-internal ריק — טרם נשלחה בקשת תשלום; התוכנית בהכנה');
  }

  // תווית תשלום לא מוכרת → נסיגה למקור הקודם (לוח התשלומים) בלבד
  const serviceStatus = d.payments.service.status;
  if (serviceStatus === null) {
    return unknown('תווית payment-stage-internal לא מוכרת וסטטוס לוח התשלומים חסר — אין ראיה לעמדה');
  }
  if (!isPaid(serviceStatus)) {
    return resolved(pkg, 'service-payment', 'due', 'תשלום השירות טרם שולם (לוח התשלומים)');
  }
  return deriveMeetingStage(d, today, pkg, 'תשלום השירות הושלם (לוח התשלומים)', false);
}

// ===== הכניסה הראשית =====
// today: 'YYYY-MM-DD' (הזמן של הקורא — המנוע אינו קורא שעון).
// pkg: דריסה מפורשת של החבילה; בהיעדרה — נגזרת מ-Plan (status8).
// Plan לא ממופה ואין דריסה → החבילה לא ידועה (null): נפתרים רק שלבים
// אוניברסליים; שלב תלוי-חבילה → unknown. לעולם לא ברירת Advanced.
// extras: ראיות חיצוניות לאייטם (הגשת משוב) — ראו JourneyRuntimeExtras.
export function deriveJourneyRuntimeState(
  customer: CustomerJourneyData,
  today: string,
  pkg?: PackageId,
  extras?: JourneyRuntimeExtras,
): JourneyRuntimeState {
  const resolvedPkg: PackageId | null = pkg ?? packageFromPlan(customer);

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
    return resolved(resolvedPkg, 'in-japan', 'traveling', 'Internal Status = Abroad — הלקוח בטיול');
  }
  if (lifecycle === 'archive') {
    // הגשת משוב מוכחת אך ורק ע"י relation בלוח ה-Feedbacks (extras).
    // Archive לבדו לעולם אינו "המשוב נשלח"; לא-נבדק/לא-ידוע = פתוח.
    if (extras?.feedbackSubmitted === true) {
      return resolved(resolvedPkg, 'feedback', 'submitted',
        'Internal Status = Archive וקיים אייטם משוב מקושר ללקוח — המשוב הוגש');
    }
    return resolved(resolvedPkg, 'feedback', 'open',
      'Internal Status = Archive — הטיול הסתיים, המשוב פתוח');
  }

  // 3. טרום-הטיול — האות המאוחר המאומת גובר (Plan Approval של מור).
  // תווית אזור שנשארה מאחור אינה מבטלת הגשה/אישור.
  const plan = planChangesPhase(customer);
  if (plan === 'approved') return deriveSelectionsRegion(customer, today, resolvedPkg);
  if (plan === 'inProgress') {
    return resolved(resolvedPkg, 'changes-processing', 'working',
      'Plan Approval = Changes form submitted — הצוות מטמיע את השינויים');
  }

  // 3א. גבול שלב 3↔4 — תוויות האזור המאומתות ב-Internal Status.
  // מועד פגישה שחלף לבדו לעולם אינו מפיק שלב 4; רק התווית קובעת.
  if (lifecycle === 'changesWindowOpen') {
    return resolved(resolvedPkg, 'changes-form', 'open',
      'Internal Status = Changes window open — הפגישה מאחור וחלון טופס השינויים פתוח');
  }
  if (lifecycle === 'waitingForMeeting') {
    return deriveMeetingStage(customer, today, resolvedPkg, 'Internal Status = Waiting for meeting', true);
  }

  return deriveEarlyRegion(customer, today, resolvedPkg);
}
